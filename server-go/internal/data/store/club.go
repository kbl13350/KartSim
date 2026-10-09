package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"kartsim/internal/data/club"
	"kartsim/internal/data/economy"
	"kartsim/internal/shared/apierr"
)

// 俱乐部 (CLUB.md): clubs, their members and applications, the 俱乐部基地
// facilities, donations to the budget, the racing center welfare and the
// activity points members earn in multiplayer races. Every change runs in
// one transaction that locks the club row (and the wallet when lucci or
// koin move). A club whose disband grace ended is deleted the next time
// any club transaction runs.

// Ledger reasons of club wallet changes.
const (
	ReasonClubCreate  = "clubcreate"  // creating a club; ref = club id
	ReasonClubDonate  = "clubdonate"  // a donation to the budget; ref = "<club id>:<day>"
	ReasonClubWelfare = "clubwelfare" // a racing center welfare; ref = "<day>:<slot>"
)

var (
	errClubNotFound      = apierr.New(http.StatusNotFound, "CLUB_NOT_FOUND")
	errNotInClub         = apierr.New(http.StatusConflict, "NOT_IN_CLUB")
	errAlreadyInClub     = apierr.New(http.StatusConflict, "ALREADY_IN_CLUB")
	errClubNameTaken     = apierr.New(http.StatusConflict, "CLUB_NAME_TAKEN")
	errInvalidClubName   = apierr.New(http.StatusBadRequest, "INVALID_CLUB_NAME")
	errInvalidClubIntro  = apierr.New(http.StatusBadRequest, "INVALID_CLUB_INTRO")
	errInvalidClubMark   = apierr.New(http.StatusBadRequest, "INVALID_CLUB_MARK")
	errClubCooldown      = apierr.New(http.StatusConflict, "CLUB_COOLDOWN")
	errClubFull          = apierr.New(http.StatusConflict, "CLUB_FULL")
	errApplicantsFull    = apierr.New(http.StatusConflict, "CLUB_APPLICANTS_FULL")
	errClubBreaking      = apierr.New(http.StatusConflict, "CLUB_BREAKING")
	errNoClubApplication = apierr.New(http.StatusNotFound, "NO_CLUB_APPLICATION")
	errClubPermission    = apierr.New(http.StatusForbidden, "CLUB_PERMISSION")
	errClubMasterLeave   = apierr.New(http.StatusConflict, "CLUB_MASTER_CANNOT_LEAVE")
	errClubBudgetLow     = apierr.New(http.StatusConflict, "CLUB_BUDGET_LOW")
	errClubBudgetFull    = apierr.New(http.StatusConflict, "CLUB_BUDGET_FULL")
	errDonatedToday      = apierr.New(http.StatusConflict, "CLUB_DONATED_TODAY")
	errInvalidDonation   = apierr.New(http.StatusBadRequest, "INVALID_DONATION")
	errClubMaxLevel      = apierr.New(http.StatusConflict, "CLUB_MAX_LEVEL")
	errClubHQFirst       = apierr.New(http.StatusConflict, "CLUB_HQ_LEVEL")
	errClubCSLow         = apierr.New(http.StatusConflict, "CLUB_CS_LOW")
	errClubMembersLow    = apierr.New(http.StatusConflict, "CLUB_MEMBERS_LOW")
	errInvalidFacility   = apierr.New(http.StatusBadRequest, "INVALID_FACILITY")
	errWelfareLocked     = apierr.New(http.StatusConflict, "CLUB_WELFARE_LOCKED")
	errWelfareClaimed    = apierr.New(http.StatusConflict, "CLUB_WELFARE_CLAIMED")
	errSameClubName      = apierr.New(http.StatusConflict, "CLUB_SAME_NAME")
	errSameClubMark      = apierr.New(http.StatusConflict, "CLUB_SAME_MARK")
	errInvalidGrade      = apierr.New(http.StatusBadRequest, "INVALID_GRADE")
	errClubMember        = apierr.New(http.StatusNotFound, "CLUB_MEMBER_NOT_FOUND")
	errClubNotBreaking   = apierr.New(http.StatusConflict, "CLUB_NOT_BREAKING")
)

// ClubInfo is a club as the pages show it.
type ClubInfo struct {
	ID         int64                `json:"id"`
	Name       string               `json:"name"`
	Intro      string               `json:"intro"`
	Mark       int                  `json:"mark"`
	Frame      int                  `json:"frame"`
	Level      int                  `json:"level"` // the 总部 level
	Facilities [club.Facilities]int `json:"facilities"`
	MasterID   string               `json:"-"`
	Master     string               `json:"master"`
	Members    int                  `json:"members"`
	MaxMembers int                  `json:"maxMembers"`
	CS         int64                `json:"cs"`
	CSWeek     int64                `json:"csWeek"`
	Budget     int64                `json:"budget"`
	AutoJoin   bool                 `json:"autoJoin"`
	BreakAt    int64                `json:"breakAt,omitempty"`
	CreatedAt  int64                `json:"createdAt"`
}

// ClubMember is a member (or an applicant: Grade 0, JoinedAt the application).
type ClubMember struct {
	AccountID string `json:"accountId"`
	Nickname  string `json:"nickname"`
	Exp       int64  `json:"-"`
	Grade     int    `json:"grade"`
	JoinedAt  int64  `json:"joinedAt"`
	CSWeek    int64  `json:"csWeek"`
	CSTotal   int64  `json:"csTotal"`
}

// ClubMe is an account's place: its club and grade, or its application,
// and until when it may not join or create a club.
type ClubMe struct {
	ClubID        int64      `json:"clubId,omitempty"`
	Grade         int        `json:"grade,omitempty"`
	Applied       *ClubBrief `json:"applied,omitempty"`
	CooldownUntil int64      `json:"cooldownUntil,omitempty"`
}

// ClubBrief names a club.
type ClubBrief struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

const clubColumns = `c.id, c.name, c.intro, c.mark, c.frame, c.hq, c.racing, c.rider, c.bank, c.master_id,
	COALESCE(a.nickname, ''), (SELECT COUNT(*) FROM club_members m WHERE m.club_id = c.id),
	c.cs, c.cs_week, c.week, c.budget, c.auto_join, c.break_at, c.created_at`

func scanClub(row interface{ Scan(...any) error }, now int64) (ClubInfo, error) {
	var (
		info    ClubInfo
		week    string
		breakAt sql.NullInt64
	)
	err := row.Scan(&info.ID, &info.Name, &info.Intro, &info.Mark, &info.Frame, &info.Facilities[club.FacilityHQ],
		&info.Facilities[club.FacilityRacing], &info.Facilities[club.FacilityRider], &info.Facilities[club.FacilityBank],
		&info.MasterID, &info.Master, &info.Members, &info.CS, &info.CSWeek, &week, &info.Budget, &info.AutoJoin,
		&breakAt, &info.CreatedAt)
	if err != nil {
		return ClubInfo{}, err
	}
	if week != club.Week(now) {
		info.CSWeek = 0
	}
	info.BreakAt = breakAt.Int64
	info.Level = info.Facilities[club.FacilityHQ]
	info.MaxMembers = club.MemberCap(info.Facilities[club.FacilityRider])
	return info, nil
}

// sweepBrokenClubs deletes the clubs whose disband grace has ended; their
// members, applications and donations go with them.
func sweepBrokenClubs(ctx context.Context, e execer, now int64) error {
	_, err := e.ExecContext(ctx, "DELETE FROM clubs WHERE break_at IS NOT NULL AND break_at <= ?", now)
	return err
}

// clubByID reads a club, locking it when lock is set.
func clubByID(ctx context.Context, q queryer, id int64, now int64, lock bool) (ClubInfo, error) {
	query := "SELECT " + clubColumns + " FROM clubs c LEFT JOIN accounts a ON a.id = c.master_id WHERE c.id = ?"
	if lock {
		query += " FOR UPDATE OF c"
	}
	info, err := scanClub(q.QueryRowContext(ctx, query, id), now)
	if errors.Is(err, sql.ErrNoRows) {
		return ClubInfo{}, errClubNotFound
	}
	return info, err
}

// membership reads an account's club and grade (0 when none), locking the row.
func membership(ctx context.Context, q queryer, accountID string, lock bool) (clubID int64, grade int, err error) {
	query := "SELECT club_id, grade FROM club_members WHERE account_id = ?"
	if lock {
		query += " FOR UPDATE"
	}
	err = q.QueryRowContext(ctx, query, accountID).Scan(&clubID, &grade)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, 0, nil
	}
	return clubID, grade, err
}

// memberClub locks the account's membership and its club; errNotInClub without one.
func memberClub(ctx context.Context, tx *sql.Tx, accountID string, now int64) (ClubInfo, int, error) {
	clubID, grade, err := membership(ctx, tx, accountID, false)
	if err != nil {
		return ClubInfo{}, 0, err
	}
	if clubID == 0 {
		return ClubInfo{}, 0, errNotInClub
	}
	info, err := clubByID(ctx, tx, clubID, now, true)
	if err != nil {
		return ClubInfo{}, 0, err
	}
	// Re-read under the club lock: a concurrent change of grade or a kick.
	if clubID2, grade2, err := membership(ctx, tx, accountID, true); err != nil {
		return ClubInfo{}, 0, err
	} else if clubID2 != clubID {
		return ClubInfo{}, 0, errNotInClub
	} else {
		grade = grade2
	}
	return info, grade, nil
}

// clubTx runs fn in an economy transaction after sweeping disbanded clubs.
func (s *Store) clubTx(ctx context.Context, now int64, fn func(*sql.Tx) error) error {
	return inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		if err := sweepBrokenClubs(ctx, tx, now); err != nil {
			return err
		}
		return fn(tx)
	})
}

// cooldownUntil is when an account that left a club may join or create one.
func cooldownUntil(ctx context.Context, q queryer, accountID string) (int64, error) {
	var left int64
	err := q.QueryRowContext(ctx, "SELECT left_at FROM club_leaves WHERE account_id = ?", accountID).Scan(&left)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, nil
	}
	return left + club.RejoinCooldown.Milliseconds(), err
}

// ClubState returns an account's place and, for a member, its club and members.
func (s *Store) ClubState(ctx context.Context, accountID string, now int64) (ClubMe, *ClubInfo, []ClubMember, error) {
	var (
		me      ClubMe
		info    *ClubInfo
		members []ClubMember
	)
	err := s.clubTx(ctx, now, func(tx *sql.Tx) error {
		me, info, members = ClubMe{}, nil, nil
		clubID, grade, err := membership(ctx, tx, accountID, false)
		if err != nil {
			return err
		}
		until, err := cooldownUntil(ctx, tx, accountID)
		if err != nil {
			return err
		}
		if until > now {
			me.CooldownUntil = until
		}
		if clubID == 0 {
			var brief ClubBrief
			err := tx.QueryRowContext(ctx, `SELECT c.id, c.name FROM club_applications p JOIN clubs c ON c.id = p.club_id
				WHERE p.account_id = ?`, accountID).Scan(&brief.ID, &brief.Name)
			if err == nil {
				me.Applied = &brief
			} else if !errors.Is(err, sql.ErrNoRows) {
				return err
			}
			return nil
		}
		me.ClubID, me.Grade = clubID, grade
		loaded, err := clubByID(ctx, tx, clubID, now, false)
		if err != nil {
			return err
		}
		info = &loaded
		members, err = clubMembers(ctx, tx, clubID, now)
		return err
	})
	return me, info, members, err
}

func clubMembers(ctx context.Context, tx *sql.Tx, clubID int64, now int64) ([]ClubMember, error) {
	rows, err := tx.QueryContext(ctx, `SELECT m.account_id, a.nickname, COALESCE(p.exp, 0), m.grade, m.joined_at,
		m.cs_week, m.week, m.cs_total FROM club_members m JOIN accounts a ON a.id = m.account_id
		LEFT JOIN account_progress p ON p.account_id = m.account_id
		WHERE m.club_id = ? ORDER BY m.grade, m.cs_total DESC, m.joined_at`, clubID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	week := club.Week(now)
	members := []ClubMember{}
	for rows.Next() {
		var (
			member ClubMember
			stamp  string
		)
		if err := rows.Scan(&member.AccountID, &member.Nickname, &member.Exp, &member.Grade, &member.JoinedAt,
			&member.CSWeek, &stamp, &member.CSTotal); err != nil {
			return nil, err
		}
		if stamp != week {
			member.CSWeek = 0
		}
		members = append(members, member)
	}
	return members, rows.Err()
}

// ClubQuery searches the 俱乐部目录.
type ClubQuery struct {
	Name    string
	Master  string
	Page    int
	PerPage int
}

// Clubs lists clubs by activity points, most active first.
func (s *Store) Clubs(ctx context.Context, query ClubQuery, now int64) ([]ClubInfo, int, error) {
	where := []string{"(c.break_at IS NULL OR c.break_at > ?)"}
	args := []any{now}
	if name := strings.TrimSpace(query.Name); name != "" {
		where = append(where, "c.name LIKE ?")
		args = append(args, "%"+escapeLike(name)+"%")
	}
	if master := strings.TrimSpace(query.Master); master != "" {
		where = append(where, "a.nickname LIKE ?")
		args = append(args, "%"+escapeLike(master)+"%")
	}
	condition := strings.Join(where, " AND ")
	var total int
	if err := s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM clubs c LEFT JOIN accounts a ON a.id = c.master_id WHERE "+
		condition, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	perPage := max(1, query.PerPage)
	rows, err := s.db.QueryContext(ctx, "SELECT "+clubColumns+" FROM clubs c LEFT JOIN accounts a ON a.id = c.master_id WHERE "+
		condition+" ORDER BY c.cs DESC, c.id LIMIT ? OFFSET ?", append(args, perPage, max(0, query.Page)*perPage)...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	clubs := []ClubInfo{}
	for rows.Next() {
		info, err := scanClub(rows, now)
		if err != nil {
			return nil, 0, err
		}
		clubs = append(clubs, info)
	}
	return clubs, total, rows.Err()
}

// Club returns one club.
func (s *Store) Club(ctx context.Context, id int64, now int64) (ClubInfo, error) {
	info, err := clubByID(ctx, s.db, id, now, false)
	if err == nil && info.BreakAt != 0 && info.BreakAt <= now {
		return ClubInfo{}, errClubNotFound
	}
	return info, err
}

// ClubCreate is a new club.
type ClubCreate struct {
	AccountID string
	Name      string
	Intro     string
	Mark      int
	Frame     int
	Now       int64
	Data      *club.Data
}

// CreateClub founds a club with the account as its 会长 for
// club.CreateLucci, cancelling the account's application.
func (s *Store) CreateClub(ctx context.Context, in ClubCreate) (ClubInfo, error) {
	name, ok := club.CleanName(in.Name)
	if !ok {
		return ClubInfo{}, errInvalidClubName
	}
	intro, ok := club.CleanIntro(in.Intro)
	if !ok {
		return ClubInfo{}, errInvalidClubIntro
	}
	if !in.Data.MarkUsable(in.Mark, 0) || !in.Data.FrameUsable(in.Frame, 0) {
		return ClubInfo{}, errInvalidClubMark
	}
	var info ClubInfo
	err := s.clubTx(ctx, in.Now, func(tx *sql.Tx) error {
		l, err := s.lockLedger(ctx, tx, in.AccountID, in.Now)
		if err != nil {
			return err
		}
		if clubID, _, err := membership(ctx, tx, in.AccountID, true); err != nil {
			return err
		} else if clubID != 0 {
			return errAlreadyInClub
		}
		if until, err := cooldownUntil(ctx, tx, in.AccountID); err != nil {
			return err
		} else if until > in.Now {
			return errClubCooldown
		}
		result, err := tx.ExecContext(ctx, `INSERT INTO clubs(name, intro, mark, frame, master_id, week, created_at, updated_at)
			VALUES(?, ?, ?, ?, ?, ?, ?, ?)`, name, intro, in.Mark, in.Frame, in.AccountID, club.Week(in.Now), in.Now, in.Now)
		if _, duplicate := duplicateKey(err); duplicate {
			return errClubNameTaken
		} else if err != nil {
			return err
		}
		id, err := result.LastInsertId()
		if err != nil {
			return err
		}
		if _, err := l.add(economy.Lucci, -club.CreateLucci, ReasonClubCreate, fmt.Sprint(id), ""); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, "DELETE FROM club_applications WHERE account_id = ?", in.AccountID); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO club_members(account_id, club_id, grade, joined_at, week)
			VALUES(?, ?, ?, ?, ?)`, in.AccountID, id, club.GradeMaster, in.Now, club.Week(in.Now)); err != nil {
			return err
		}
		info, err = clubByID(ctx, tx, id, in.Now, false)
		return err
	})
	return info, err
}

// joinClub adds a member under the locked club.
func joinClub(ctx context.Context, tx *sql.Tx, info ClubInfo, accountID string, now int64) error {
	if info.Members >= info.MaxMembers {
		return errClubFull
	}
	if _, err := tx.ExecContext(ctx, "DELETE FROM club_applications WHERE account_id = ?", accountID); err != nil {
		return err
	}
	_, err := tx.ExecContext(ctx, `INSERT INTO club_members(account_id, club_id, grade, joined_at, week)
		VALUES(?, ?, ?, ?, ?)`, accountID, info.ID, club.GradeMember, now, club.Week(now))
	if _, duplicate := duplicateKey(err); duplicate {
		return errAlreadyInClub
	}
	return err
}

// ApplyClub applies to a club, replacing an earlier application; a club
// with auto join takes the account in at once (joined).
func (s *Store) ApplyClub(ctx context.Context, accountID string, clubID int64, now int64) (joined bool, err error) {
	err = s.clubTx(ctx, now, func(tx *sql.Tx) error {
		joined = false
		info, err := clubByID(ctx, tx, clubID, now, true)
		if err != nil {
			return err
		}
		if current, _, err := membership(ctx, tx, accountID, true); err != nil {
			return err
		} else if current != 0 {
			return errAlreadyInClub
		}
		if until, err := cooldownUntil(ctx, tx, accountID); err != nil {
			return err
		} else if until > now {
			return errClubCooldown
		}
		if info.BreakAt != 0 {
			return errClubBreaking
		}
		if info.AutoJoin {
			joined = true
			return joinClub(ctx, tx, info, accountID, now)
		}
		if info.Members >= info.MaxMembers {
			return errClubFull
		}
		var waiting int
		if err := tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM club_applications WHERE club_id = ? AND account_id <> ?",
			clubID, accountID).Scan(&waiting); err != nil {
			return err
		}
		if waiting >= club.MaxApplicants {
			return errApplicantsFull
		}
		_, err = tx.ExecContext(ctx, `INSERT INTO club_applications(account_id, club_id, created_at) VALUES(?, ?, ?)
			AS incoming ON DUPLICATE KEY UPDATE club_id = incoming.club_id, created_at = incoming.created_at`,
			accountID, clubID, now)
		return err
	})
	return joined, err
}

// CancelClubApplication withdraws the account's application.
func (s *Store) CancelClubApplication(ctx context.Context, accountID string) error {
	result, err := s.db.ExecContext(ctx, "DELETE FROM club_applications WHERE account_id = ?", accountID)
	if err != nil {
		return err
	}
	if removed, err := result.RowsAffected(); err != nil {
		return err
	} else if removed == 0 {
		return errNoClubApplication
	}
	return nil
}

// ClubApplicants lists the applications to the account's club (approvers only).
func (s *Store) ClubApplicants(ctx context.Context, accountID string, now int64) ([]ClubMember, error) {
	clubID, grade, err := membership(ctx, s.db, accountID, false)
	if err != nil {
		return nil, err
	}
	if clubID == 0 {
		return nil, errNotInClub
	}
	if !club.CanApprove(grade) {
		return nil, errClubPermission
	}
	rows, err := s.db.QueryContext(ctx, `SELECT p.account_id, a.nickname, COALESCE(g.exp, 0), p.created_at
		FROM club_applications p JOIN accounts a ON a.id = p.account_id
		LEFT JOIN account_progress g ON g.account_id = p.account_id
		WHERE p.club_id = ? ORDER BY p.created_at`, clubID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	applicants := []ClubMember{}
	for rows.Next() {
		var applicant ClubMember
		if err := rows.Scan(&applicant.AccountID, &applicant.Nickname, &applicant.Exp, &applicant.JoinedAt); err != nil {
			return nil, err
		}
		applicants = append(applicants, applicant)
	}
	return applicants, rows.Err()
}

// DecideClubApplicant accepts or rejects an application to the account's club.
func (s *Store) DecideClubApplicant(ctx context.Context, accountID, applicantID string, accept bool, now int64) error {
	return s.clubTx(ctx, now, func(tx *sql.Tx) error {
		info, grade, err := memberClub(ctx, tx, accountID, now)
		if err != nil {
			return err
		}
		if !club.CanApprove(grade) {
			return errClubPermission
		}
		var applied int64
		err = tx.QueryRowContext(ctx, "SELECT club_id FROM club_applications WHERE account_id = ? FOR UPDATE",
			applicantID).Scan(&applied)
		if errors.Is(err, sql.ErrNoRows) || (err == nil && applied != info.ID) {
			return errNoClubApplication
		} else if err != nil {
			return err
		}
		if !accept {
			_, err := tx.ExecContext(ctx, "DELETE FROM club_applications WHERE account_id = ?", applicantID)
			return err
		}
		if info.BreakAt != 0 {
			return errClubBreaking
		}
		return joinClub(ctx, tx, info, applicantID, now)
	})
}

// leaveClub removes a member and starts its rejoin cooldown.
func leaveClub(ctx context.Context, tx *sql.Tx, accountID string, now int64) error {
	if _, err := tx.ExecContext(ctx, "DELETE FROM club_members WHERE account_id = ?", accountID); err != nil {
		return err
	}
	_, err := tx.ExecContext(ctx, `INSERT INTO club_leaves(account_id, left_at) VALUES(?, ?) AS incoming
		ON DUPLICATE KEY UPDATE left_at = incoming.left_at`, accountID, now)
	return err
}

// LeaveClub leaves the account's club; the 会长 disbands it instead.
func (s *Store) LeaveClub(ctx context.Context, accountID string, now int64) error {
	return s.clubTx(ctx, now, func(tx *sql.Tx) error {
		_, grade, err := memberClub(ctx, tx, accountID, now)
		if err != nil {
			return err
		}
		if grade == club.GradeMaster {
			return errClubMasterLeave
		}
		return leaveClub(ctx, tx, accountID, now)
	})
}

// targetMember locks another member of the club.
func targetMember(ctx context.Context, tx *sql.Tx, info ClubInfo, targetID string) (int, error) {
	clubID, grade, err := membership(ctx, tx, targetID, true)
	if err != nil {
		return 0, err
	}
	if clubID != info.ID {
		return 0, errClubMember
	}
	return grade, nil
}

// KickClubMember removes another member (club.CanKick).
func (s *Store) KickClubMember(ctx context.Context, accountID, targetID string, now int64) error {
	return s.clubTx(ctx, now, func(tx *sql.Tx) error {
		info, grade, err := memberClub(ctx, tx, accountID, now)
		if err != nil {
			return err
		}
		target, err := targetMember(ctx, tx, info, targetID)
		if err != nil {
			return err
		}
		if targetID == accountID || !club.CanKick(grade, target) {
			return errClubPermission
		}
		return leaveClub(ctx, tx, targetID, now)
	})
}

// SetClubGrade gives another member a grade (会长 only; never 会长).
func (s *Store) SetClubGrade(ctx context.Context, accountID, targetID string, grade int, now int64) error {
	if grade < club.GradeManager || grade > club.GradeMember {
		return errInvalidGrade
	}
	return s.clubTx(ctx, now, func(tx *sql.Tx) error {
		info, own, err := memberClub(ctx, tx, accountID, now)
		if err != nil {
			return err
		}
		if own != club.GradeMaster || targetID == accountID {
			return errClubPermission
		}
		if _, err := targetMember(ctx, tx, info, targetID); err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, "UPDATE club_members SET grade = ? WHERE account_id = ?", grade, targetID)
		return err
	})
}

// UpdateClub changes the introduction or the auto join setting (会长, 管理层).
func (s *Store) UpdateClub(ctx context.Context, accountID string, intro *string, autoJoin *bool, now int64) error {
	var cleaned string
	if intro != nil {
		var ok bool
		if cleaned, ok = club.CleanIntro(*intro); !ok {
			return errInvalidClubIntro
		}
	}
	return s.clubTx(ctx, now, func(tx *sql.Tx) error {
		info, grade, err := memberClub(ctx, tx, accountID, now)
		if err != nil {
			return err
		}
		if !club.CanManage(grade) {
			return errClubPermission
		}
		if intro != nil {
			if _, err := tx.ExecContext(ctx, "UPDATE clubs SET intro = ?, updated_at = ? WHERE id = ?", cleaned, now,
				info.ID); err != nil {
				return err
			}
		}
		if autoJoin != nil {
			_, err = tx.ExecContext(ctx, "UPDATE clubs SET auto_join = ?, updated_at = ? WHERE id = ?", *autoJoin, now,
				info.ID)
		}
		return err
	})
}

// BreakClub disbands the account's club (会长 only): at once when the 会长
// is its only member, otherwise after club.BreakGrace (immediate reports which).
func (s *Store) BreakClub(ctx context.Context, accountID string, now int64) (immediate bool, err error) {
	err = s.clubTx(ctx, now, func(tx *sql.Tx) error {
		immediate = false
		info, grade, err := memberClub(ctx, tx, accountID, now)
		if err != nil {
			return err
		}
		if grade != club.GradeMaster {
			return errClubPermission
		}
		if info.BreakAt != 0 {
			return errClubBreaking
		}
		if info.Members <= 1 {
			immediate = true
			_, err := tx.ExecContext(ctx, "DELETE FROM clubs WHERE id = ?", info.ID)
			return err
		}
		_, err = tx.ExecContext(ctx, "UPDATE clubs SET break_at = ?, updated_at = ? WHERE id = ?",
			now+club.BreakGrace.Milliseconds(), now, info.ID)
		return err
	})
	return immediate, err
}

// CancelClubBreak withdraws a disband request (会长 only).
func (s *Store) CancelClubBreak(ctx context.Context, accountID string, now int64) error {
	return s.clubTx(ctx, now, func(tx *sql.Tx) error {
		info, grade, err := memberClub(ctx, tx, accountID, now)
		if err != nil {
			return err
		}
		if grade != club.GradeMaster {
			return errClubPermission
		}
		if info.BreakAt == 0 {
			return errClubNotBreaking
		}
		_, err = tx.ExecContext(ctx, "UPDATE clubs SET break_at = NULL, updated_at = ? WHERE id = ?", now, info.ID)
		return err
	})
}

// ClubDonation is one donation to the budget.
type ClubDonation struct {
	Nickname  string `json:"nickname"`
	Amount    int64  `json:"amount"`
	CreatedAt int64  `json:"createdAt"`
}

// ClubHouse is the 俱乐部基地: the club, recent donations, the top donor,
// the account's own donations and today's welfare claims.
type ClubHouse struct {
	Club         ClubInfo       `json:"club"`
	Grade        int            `json:"grade"`
	Donations    []ClubDonation `json:"donations"`
	TopDonor     string         `json:"topDonor"`
	MyDonations  int64          `json:"myDonations"`
	DonatedToday bool           `json:"donatedToday"`
	WelfareToday []int          `json:"welfareToday"`
}

// ClubHouseView returns the account's 俱乐部基地.
func (s *Store) ClubHouseView(ctx context.Context, accountID string, now int64) (ClubHouse, error) {
	var house ClubHouse
	err := s.clubTx(ctx, now, func(tx *sql.Tx) error {
		house = ClubHouse{Donations: []ClubDonation{}, WelfareToday: []int{}}
		clubID, grade, err := membership(ctx, tx, accountID, false)
		if err != nil {
			return err
		}
		if clubID == 0 {
			return errNotInClub
		}
		if house.Club, err = clubByID(ctx, tx, clubID, now, false); err != nil {
			return err
		}
		house.Grade = grade
		rows, err := tx.QueryContext(ctx, `SELECT a.nickname, d.amount, d.created_at FROM club_donations d
			JOIN accounts a ON a.id = d.account_id WHERE d.club_id = ? ORDER BY d.id DESC LIMIT 8`, clubID)
		if err != nil {
			return err
		}
		for rows.Next() {
			var donation ClubDonation
			if err := rows.Scan(&donation.Nickname, &donation.Amount, &donation.CreatedAt); err != nil {
				rows.Close()
				return err
			}
			house.Donations = append(house.Donations, donation)
		}
		if err := rows.Close(); err != nil {
			return err
		}
		err = tx.QueryRowContext(ctx, `SELECT a.nickname FROM club_members m JOIN accounts a ON a.id = m.account_id
			WHERE m.club_id = ? AND m.donated_total > 0 ORDER BY m.donated_total DESC, m.joined_at LIMIT 1`, clubID).
			Scan(&house.TopDonor)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		var day string
		if err := tx.QueryRowContext(ctx, "SELECT donated_total, donated_day FROM club_members WHERE account_id = ?",
			accountID).Scan(&house.MyDonations, &day); err != nil {
			return err
		}
		house.DonatedToday = day == club.Day(now)
		slots, err := tx.QueryContext(ctx, "SELECT slot FROM club_welfare WHERE account_id = ? AND day = ? ORDER BY slot",
			accountID, club.Day(now))
		if err != nil {
			return err
		}
		defer slots.Close()
		for slots.Next() {
			var slot int
			if err := slots.Scan(&slot); err != nil {
				return err
			}
			house.WelfareToday = append(house.WelfareToday, slot)
		}
		return slots.Err()
	})
	return house, err
}

// DonateClub gives lucci to the budget, once a Beijing day, within the
// 俱乐部银行's cap.
func (s *Store) DonateClub(ctx context.Context, accountID string, amount int64, now int64) error {
	if !club.ValidDonation(amount) {
		return errInvalidDonation
	}
	day := club.Day(now)
	return s.clubTx(ctx, now, func(tx *sql.Tx) error {
		l, err := s.lockLedger(ctx, tx, accountID, now)
		if err != nil {
			return err
		}
		info, _, err := memberClub(ctx, tx, accountID, now)
		if err != nil {
			return err
		}
		var donated string
		if err := tx.QueryRowContext(ctx, "SELECT donated_day FROM club_members WHERE account_id = ?", accountID).
			Scan(&donated); err != nil {
			return err
		}
		if donated == day {
			return errDonatedToday
		}
		if info.Budget+amount > club.BudgetCap(info.Facilities[club.FacilityBank]) {
			return errClubBudgetFull
		}
		if _, err := l.add(economy.Lucci, -amount, ReasonClubDonate, fmt.Sprintf("%d:%s", info.ID, day), ""); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, "UPDATE clubs SET budget = budget + ?, updated_at = ? WHERE id = ?", amount, now,
			info.ID); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `UPDATE club_members SET donated_total = donated_total + ?, donated_day = ?
			WHERE account_id = ?`, amount, day, accountID); err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, "INSERT INTO club_donations(club_id, account_id, amount, created_at) VALUES(?, ?, ?, ?)",
			info.ID, accountID, amount, now)
		return err
	})
}

var facilityColumns = [club.Facilities]string{"hq", "racing", "rider", "bank"}

// UpgradeClub raises a facility one level for its activity points and
// budget (会长, 管理层): the 总部 needs the members, the others may not pass
// the 总部's level.
func (s *Store) UpgradeClub(ctx context.Context, accountID string, facility int, now int64) (ClubInfo, error) {
	if facility < 0 || facility >= club.Facilities {
		return ClubInfo{}, errInvalidFacility
	}
	var result ClubInfo
	err := s.clubTx(ctx, now, func(tx *sql.Tx) error {
		info, grade, err := memberClub(ctx, tx, accountID, now)
		if err != nil {
			return err
		}
		if !club.FacilityManagers(facility, grade) {
			return errClubPermission
		}
		next := info.Facilities[facility] + 1
		cost, ok := club.UpgradeTo(next)
		switch {
		case !ok:
			return errClubMaxLevel
		case facility != club.FacilityHQ && next > info.Facilities[club.FacilityHQ]:
			return errClubHQFirst
		case facility == club.FacilityHQ && info.Members < cost.Members:
			return errClubMembersLow
		case info.CS < cost.CS:
			return errClubCSLow
		case info.Budget < cost.Lucci:
			return errClubBudgetLow
		}
		if _, err := tx.ExecContext(ctx, "UPDATE clubs SET "+facilityColumns[facility]+` = ?, cs = cs - ?,
			budget = budget - ?, updated_at = ? WHERE id = ?`, next, cost.CS, cost.Lucci, now, info.ID); err != nil {
			return err
		}
		result, err = clubByID(ctx, tx, info.ID, now, false)
		return err
	})
	return result, err
}

// RenameClub renames the account's club for club.NameChangeLucci of budget (会长, 管理层).
func (s *Store) RenameClub(ctx context.Context, accountID, name string, now int64) (ClubInfo, error) {
	name, ok := club.CleanName(name)
	if !ok {
		return ClubInfo{}, errInvalidClubName
	}
	var result ClubInfo
	err := s.clubTx(ctx, now, func(tx *sql.Tx) error {
		info, grade, err := memberClub(ctx, tx, accountID, now)
		if err != nil {
			return err
		}
		if !club.CanManage(grade) {
			return errClubPermission
		}
		if info.Name == name {
			return errSameClubName
		}
		if info.Budget < club.NameChangeLucci {
			return errClubBudgetLow
		}
		_, err = tx.ExecContext(ctx, "UPDATE clubs SET name = ?, budget = budget - ?, updated_at = ? WHERE id = ?",
			name, club.NameChangeLucci, now, info.ID)
		if _, duplicate := duplicateKey(err); duplicate {
			return errClubNameTaken
		} else if err != nil {
			return err
		}
		result, err = clubByID(ctx, tx, info.ID, now, false)
		return err
	})
	return result, err
}

// ChangeClubMark changes the mark and frame for club.MarkChangeLucci of
// budget (会长, 管理层), among those the club's level allows.
func (s *Store) ChangeClubMark(ctx context.Context, data *club.Data, accountID string, mark, frame int,
	now int64) (ClubInfo, error) {
	var result ClubInfo
	err := s.clubTx(ctx, now, func(tx *sql.Tx) error {
		info, grade, err := memberClub(ctx, tx, accountID, now)
		if err != nil {
			return err
		}
		if !club.CanManage(grade) {
			return errClubPermission
		}
		if !data.MarkUsable(mark, info.Level) || !data.FrameUsable(frame, info.Level) {
			return errInvalidClubMark
		}
		if info.Mark == mark && info.Frame == frame {
			return errSameClubMark
		}
		if info.Budget < club.MarkChangeLucci {
			return errClubBudgetLow
		}
		if _, err := tx.ExecContext(ctx, "UPDATE clubs SET mark = ?, frame = ?, budget = budget - ?, updated_at = ? WHERE id = ?",
			mark, frame, club.MarkChangeLucci, now, info.ID); err != nil {
			return err
		}
		result, err = clubByID(ctx, tx, info.ID, now, false)
		return err
	})
	return result, err
}

// ClaimClubWelfare takes a 赛事中心 welfare slot once a Beijing day; the
// reward waits in the 奖励箱.
func (s *Store) ClaimClubWelfare(ctx context.Context, accountID string, slot int, now int64) (club.Welfare, Wallet, error) {
	var (
		welfare club.Welfare
		wallet  Wallet
	)
	found := false
	for _, entry := range club.Welfares {
		if entry.Slot == slot {
			welfare, found = entry, true
		}
	}
	if !found {
		return club.Welfare{}, Wallet{}, errWelfareLocked
	}
	day := club.Day(now)
	err := s.clubTx(ctx, now, func(tx *sql.Tx) error {
		l, err := s.lockLedger(ctx, tx, accountID, now)
		if err != nil {
			return err
		}
		info, _, err := memberClub(ctx, tx, accountID, now)
		if err != nil {
			return err
		}
		if info.Facilities[club.FacilityRacing] < welfare.Level {
			return errWelfareLocked
		}
		_, err = tx.ExecContext(ctx, "INSERT INTO club_welfare(account_id, day, slot, created_at) VALUES(?, ?, ?, ?)",
			accountID, day, slot, now)
		if _, duplicate := duplicateKey(err); duplicate {
			return errWelfareClaimed
		} else if err != nil {
			return err
		}
		// The welfare goes to the 奖励箱 ("获得的道具请在奖励箱内确认").
		wallet = l.wallet
		return addRewardBox(ctx, tx, accountID, []RewardBoxEntry{{Source: BoxSourceClub,
			Message: "俱乐部基地 赛事中心福利", Name: welfare.Name, Count: int(welfare.Amount),
			Currency: welfare.Currency}}, now)
	})
	return welfare, wallet, err
}

// addClubActivity credits a member's race to its activity points and its
// club's (weekly points restart each Thursday). No-op without a club.
func addClubActivity(ctx context.Context, tx *sql.Tx, accountID string, points int64, now int64) error {
	if points <= 0 {
		return nil
	}
	clubID, _, err := membership(ctx, tx, accountID, false)
	if err != nil || clubID == 0 {
		return err
	}
	week := club.Week(now)
	if _, err := tx.ExecContext(ctx, `UPDATE club_members SET cs_total = cs_total + ?,
		cs_week = IF(week = ?, cs_week + ?, ?), week = ? WHERE account_id = ?`,
		points, week, points, points, week, accountID); err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `UPDATE clubs SET cs = cs + ?, cs_week = IF(week = ?, cs_week + ?, ?), week = ?
		WHERE id = ? AND (break_at IS NULL OR break_at > ?)`, points, week, points, points, week, clubID, now)
	return err
}

// raceClubPoints is what one result earns: club.RaceFinishPoints for a
// finished race, plus club.RaceWinPoints for winning it.
func raceClubPoints(result SettledResult) int64 {
	if result.ElapsedMs == nil {
		return 0
	}
	points := int64(club.RaceFinishPoints)
	if result.Rank == 1 {
		points += club.RaceWinPoints
	}
	return points
}

// ClubOf returns the club of an account (0 when none) and its name, for
// rooms and user cards.
func (s *Store) ClubOf(ctx context.Context, accountID string, now int64) (ClubBrief, int, error) {
	var (
		brief ClubBrief
		grade int
	)
	err := s.db.QueryRowContext(ctx, `SELECT c.id, c.name, m.grade FROM club_members m JOIN clubs c ON c.id = m.club_id
		WHERE m.account_id = ? AND (c.break_at IS NULL OR c.break_at > ?)`, accountID, now).Scan(&brief.ID, &brief.Name, &grade)
	if errors.Is(err, sql.ErrNoRows) {
		return ClubBrief{}, 0, nil
	}
	return brief, grade, err
}
