package local.kartsim.server;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Small SQLite boundary. Each operation has one connection and transaction.
 * Synchronization keeps room and account writes simple for a local server.
 */
@Component
public class Database {
    private final String jdbcUrl;

    public Database(@Value("${kart.data-dir}") String dataDir) throws Exception {
        Path directory = Path.of(dataDir).toAbsolutePath().normalize();
        Files.createDirectories(directory);
        jdbcUrl = "jdbc:sqlite:" + directory.resolve("kart.db");
        try (Connection connection = DriverManager.getConnection(jdbcUrl);
             Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA journal_mode=WAL");
            statement.execute("PRAGMA busy_timeout=5000");
            statement.execute("""
                CREATE TABLE IF NOT EXISTS accounts (
                  id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE,
                  nickname TEXT NOT NULL COLLATE NOCASE UNIQUE,
                  password_hash TEXT NOT NULL, admin INTEGER NOT NULL DEFAULT 0,
                  created_at INTEGER NOT NULL
                )""");
            statement.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                  token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL,
                  expires_at INTEGER NOT NULL,
                  FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
                )""");
            statement.execute("""
                CREATE TABLE IF NOT EXISTS invites (
                  code_hash TEXT PRIMARY KEY, created_at INTEGER NOT NULL,
                  used_by TEXT, FOREIGN KEY(used_by) REFERENCES accounts(id)
                )""");
            statement.execute("""
                CREATE TABLE IF NOT EXISTS owner_keys (
                  owner_id TEXT PRIMARY KEY, secret_hash TEXT NOT NULL,
                  created_at INTEGER NOT NULL
                )""");
            statement.execute("""
                CREATE TABLE IF NOT EXISTS profiles (
                  owner_id TEXT PRIMARY KEY, json TEXT NOT NULL,
                  updated_at INTEGER NOT NULL
                )""");
            statement.execute("""
                CREATE TABLE IF NOT EXISTS records (
                  owner_id TEXT NOT NULL, record_id TEXT NOT NULL,
                  json TEXT NOT NULL, updated_at INTEGER NOT NULL,
                  PRIMARY KEY(owner_id, record_id)
                )""");
            statement.execute("""
                CREATE TABLE IF NOT EXISTS race_results (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  room_id TEXT NOT NULL, race_id TEXT NOT NULL,
                  player_id TEXT NOT NULL, name TEXT NOT NULL,
                  rank INTEGER NOT NULL, elapsed_ms INTEGER,
                  points INTEGER NOT NULL, created_at INTEGER NOT NULL,
                  UNIQUE(race_id, player_id)
                )""");
            statement.execute("""
                CREATE TABLE IF NOT EXISTS room_rules (
                  room_id TEXT PRIMARY KEY, json TEXT NOT NULL,
                  updated_at INTEGER NOT NULL
                )""");
        }
    }

    @FunctionalInterface
    public interface Work<T> {
        T run(Connection connection) throws Exception;
    }

    public synchronized <T> T transaction(Work<T> work) {
        try (Connection connection = DriverManager.getConnection(jdbcUrl)) {
            try (Statement statement = connection.createStatement()) {
                statement.execute("PRAGMA foreign_keys=ON");
                statement.execute("PRAGMA busy_timeout=5000");
            }
            connection.setAutoCommit(false);
            try {
                T result = work.run(connection);
                connection.commit();
                return result;
            } catch (Exception error) {
                connection.rollback();
                if (error instanceof RuntimeException runtime) throw runtime;
                throw new IllegalStateException("Database operation failed", error);
            }
        } catch (SQLException error) {
            throw new IllegalStateException("Cannot open local database", error);
        }
    }
}
