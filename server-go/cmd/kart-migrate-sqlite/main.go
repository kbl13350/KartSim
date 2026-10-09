// Command kart-migrate-sqlite copies the Java service's SQLite kart.db into
// the data service's MySQL database. It opens the SQLite file read-only,
// creates the MySQL schema if needed and inserts every row with INSERT
// IGNORE, so it can be re-run safely. Stop the Java service first, or point
// -sqlite at a copy (kart.db together with any kart.db-wal and kart.db-shm).
//
//	KART_MYSQL_DSN='kart:…@tcp(127.0.0.1:3306)/kartsim' kart-migrate-sqlite -sqlite ../server/data/kart.db [-dry-run] [-allow-rejected]
//
// The MySQL DSN comes from KART_MYSQL_DSN (the data service's variable),
// which keeps the password out of the process list and shell history; the
// -mysql flag overrides it. If the SQLite file sits in a read-only
// directory, the tool opens it as immutable (see sqlitemigrate.OpenSQLite).
//
// -dry-run reads and validates every row and only checks that MySQL is
// reachable and which accounts collide; it writes nothing.
//
// MySQL compares usernames and nicknames with utf8mb4_0900_as_ci, which is
// stricter than the Java service's NOCASE: accounts such as "Émile" and
// "émile" collide, and the later one is rejected with its sessions. The
// tool exits with status 1 when any row is invalid, rejected or colliding,
// after printing the report; -allow-rejected accepts that and exits 0.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"kartsim/internal/data/sqlitemigrate"
	"kartsim/internal/data/store"
)

func main() {
	opts, err := parseOptions(os.Args[1:], os.Getenv, os.Stderr)
	if err != nil {
		if !errors.Is(err, flag.ErrHelp) {
			fmt.Fprintln(os.Stderr, "kart-migrate-sqlite:", err)
		}
		os.Exit(2)
	}
	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := run(ctx, opts, os.Stdout, os.Stderr, logger); err != nil {
		logger.Error("migration failed", "error", err)
		stop()
		os.Exit(1)
	}
}

// parseOptions reads the command line; the DSN falls back to
// KART_MYSQL_DSN so it need not appear in argv.
func parseOptions(args []string, getenv func(string) string, output io.Writer) (runOptions, error) {
	flags := flag.NewFlagSet("kart-migrate-sqlite", flag.ContinueOnError)
	flags.SetOutput(output)
	sqlitePath := flags.String("sqlite", "", "path to the Java kart.db (required)")
	mysqlDSN := flags.String("mysql", "",
		"go-sql-driver MySQL DSN; defaults to $KART_MYSQL_DSN (prefer the variable: flags are visible to other users)")
	dryRun := flags.Bool("dry-run", false, "read and validate only; write nothing to MySQL")
	allowRejected := flags.Bool("allow-rejected", false,
		"exit 0 even when rows are invalid, rejected or colliding (they are not copied)")
	if err := flags.Parse(args); err != nil {
		return runOptions{}, err
	}
	if *mysqlDSN == "" {
		*mysqlDSN = strings.TrimSpace(getenv("KART_MYSQL_DSN"))
	}
	if *sqlitePath == "" || (*mysqlDSN == "" && !*dryRun) || flags.NArg() > 0 {
		flags.Usage()
		return runOptions{}, errors.New("-sqlite is required, and KART_MYSQL_DSN (or -mysql) unless -dry-run")
	}
	return runOptions{sqlitePath: *sqlitePath, mysqlDSN: *mysqlDSN, dryRun: *dryRun, allowRejected: *allowRejected}, nil
}

type runOptions struct {
	sqlitePath, mysqlDSN  string
	dryRun, allowRejected bool
}

// run migrates (or dry-runs) and prints the report to out and row-level
// problems to problems.
func run(ctx context.Context, options runOptions, out, problems io.Writer, logger *slog.Logger) error {
	sqlitePath, mysqlDSN, dryRun := options.sqlitePath, options.mysqlDSN, options.dryRun
	src, immutable, err := sqlitemigrate.OpenSQLiteFile(ctx, sqlitePath)
	if err != nil {
		return err
	}
	defer src.Close()
	if immutable {
		logger.Warn("the SQLite directory is read-only; reading the file as immutable (stop the Java service first)",
			"path", sqlitePath)
	}

	opts := sqlitemigrate.Options{DryRun: dryRun, Log: problems}
	var reports []sqlitemigrate.TableReport
	if mysqlDSN == "" {
		reports, err = sqlitemigrate.Migrate(ctx, src, nil, opts)
	} else {
		dst, openErr := store.Open(mysqlDSN)
		if openErr != nil {
			return openErr
		}
		defer dst.Close()
		if err := store.WaitReady(ctx, dst, 10*time.Second, logger); err != nil {
			return err
		}
		if dryRun {
			version, err := store.SchemaVersion(ctx, dst)
			if err != nil {
				return err
			}
			fmt.Fprintf(out, "MySQL reachable; schema version %d (this tool creates version %d)\n",
				version, store.LatestSchemaVersion())
		} else if err := store.Migrate(ctx, dst, logger); err != nil {
			return fmt.Errorf("MySQL schema: %w", err)
		}
		reports, err = sqlitemigrate.Migrate(ctx, src, dst, opts)
	}
	if dryRun {
		fmt.Fprintln(out, "dry run: nothing was written")
	}
	sqlitemigrate.WriteReport(out, reports, dryRun)
	if err != nil {
		return err
	}
	invalid, rejected, conflicts := sqlitemigrate.Problems(reports)
	if invalid+rejected+conflicts > 0 && !options.allowRejected {
		return fmt.Errorf("%d invalid, %d rejected and %d colliding rows are not copied (see above); "+
			"fix them in the SQLite file or pass -allow-rejected to accept that", invalid, rejected, conflicts)
	}
	return nil
}
