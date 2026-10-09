package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"kartsim/internal/data/economy"
	"kartsim/internal/data/expedition"
	"kartsim/internal/shared/apierr"
)

// The 赛车探险队: account_expedition holds each account's expedition.State;
// every change runs under the account's wallet lock, which also serializes
// it with the shop, box openings and other rewards. The week's missions are
// renewed lazily on the first request after the Thursday reset, which also
// gives that week's 探险币.

// ReasonExpedition is the ledger reason of mission rewards; ref is
// "<week start>:<slot>".
const ReasonExpedition = "expedition"

var errNotFriend = apierr.New(http.StatusConflict, "NOT_FRIEND")

// ExpeditionKart is an owned kart as the crew list shows it.
type ExpeditionKart struct {
	ItemID   int    `json:"itemId"`
	KartKey  string `json:"kartKey,omitempty"` // a system kart's key
	Specific int    `json:"specific"`
	Level    int    `json:"level"` // garage upgrade level
	Parts    int    `json:"parts"` // reinforced parts' total level, 0 without
}

// ExpeditionCharacter is an owned character.
type ExpeditionCharacter struct {
	ItemID   int `json:"itemId"`
	Specific int `json:"specific"`
}

// ExpeditionFriend is a friend who can join.
type ExpeditionFriend struct {
	AccountID string `json:"accountId"`
	Nickname  string `json:"nickname"`
	Specific  int    `json:"specific"`
	Character int    `json:"character"` // their equipped character
	Kart      int    `json:"kart"`
	UsedToday bool   `json:"usedToday"`
}

// ExpeditionCrew is what the account can send.
type ExpeditionCrew struct {
	Characters []ExpeditionCharacter `json:"characters"`
	Karts      []ExpeditionKart      `json:"karts"`
	Friends    []ExpeditionFriend    `json:"friends"`
}

// ExpeditionView is the account's expedition after a request.
type ExpeditionView struct {
	State  expedition.State
	Tokens int // 探险币 held
	// Feasible tells which attributes the account can field (a matching
	// character and kart).
	Feasible [expedition.Specifics]bool
}

// ExpeditionClaim is what a finished mission paid.
type ExpeditionClaim struct {
	Slot      expedition.Slot
	Exp       int64
	Lucci     int64
	Items     []BoxReward
	Inventory []InventoryItem
	LevelUps  []economy.LevelReward
}

// ExpeditionDeparture is a crew request: Crew pairs and an optional friend.
type ExpeditionDeparture struct {
	Slot   int
	Crew   []expedition.Pair
	Friend string
}

// expeditionAssets are the account's characters and karts.
type expeditionAssets struct {
	crew ExpeditionCrew
}

func (a expeditionAssets) feasible() [expedition.Specifics]bool {
	var characters, karts, both [expedition.Specifics]bool
	for _, c := range a.crew.Characters {
		characters[c.Specific] = true
	}
	for _, k := range a.crew.Karts {
		karts[k.Specific] = true
	}
	for i := range both {
		both[i] = characters[i] && karts[i]
	}
	return both
}

func (a expeditionAssets) character(id int) (ExpeditionCharacter, bool) {
	for _, c := range a.crew.Characters {
		if c.ItemID == id {
			return c, true
		}
	}
	return ExpeditionCharacter{}, false
}

func (a expeditionAssets) kart(id int, key string) (ExpeditionKart, bool) {
	for _, k := range a.crew.Karts {
		if k.ItemID == id && (id != 0 || k.KartKey == key) {
			return k, true
		}
	}
	return ExpeditionKart{}, false
}

// kartBuild is one garage build's upgrade (profile garage.builds).
type kartBuild struct {
	Progression struct {
		Level  int   `json:"level"`
		Points []int `json:"points"`
	} `json:"progression"`
}

// expeditionAssetsOf reads the account's unexpired characters and karts
// and its karts' best upgrade from the profile.
func expeditionAssetsOf(ctx context.Context, q rowsQueryer, accountID string, now int64) (expeditionAssets, error) {
	var assets expeditionAssets
	assets.crew = ExpeditionCrew{Characters: []ExpeditionCharacter{}, Karts: []ExpeditionKart{},
		Friends: []ExpeditionFriend{}}
	builds := map[int]kartBuild{}
	var profile sql.NullString
	err := q.QueryRowContext(ctx, "SELECT json FROM account_profiles WHERE account_id = ?", accountID).Scan(&profile)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return assets, err
	}
	if profile.Valid {
		var doc struct {
			Garage struct {
				Builds map[string]kartBuild `json:"builds"`
			} `json:"garage"`
		}
		if json.Unmarshal([]byte(profile.String), &doc) == nil {
			for key, build := range doc.Garage.Builds {
				id, err := strconv.Atoi(strings.SplitN(key, ":", 2)[0])
				if err != nil {
					continue
				}
				if best, ok := builds[id]; !ok || build.Progression.Level > best.Progression.Level {
					builds[id] = build
				}
			}
		}
	}
	rows, err := q.QueryContext(ctx, `SELECT category, item_id, system_key FROM inventory_items
		WHERE account_id = ? AND category IN (1, 3) AND (expires_at IS NULL OR expires_at > ?)
		ORDER BY category, item_id, system_key`, accountID, now)
	if err != nil {
		return assets, err
	}
	defer rows.Close()
	for rows.Next() {
		var category, id int
		var key string
		if err := rows.Scan(&category, &id, &key); err != nil {
			return assets, err
		}
		if category == 1 {
			assets.crew.Characters = append(assets.crew.Characters,
				ExpeditionCharacter{ItemID: id, Specific: expedition.Specific(1, id)})
			continue
		}
		kart := ExpeditionKart{ItemID: id, KartKey: key, Specific: expedition.Specific(3, id)}
		if build, ok := builds[id]; ok && id != 0 {
			kart.Level = max(build.Progression.Level, 0)
			if len(build.Progression.Points) == 4 {
				for _, points := range build.Progression.Points {
					kart.Parts += max(points, 0)
				}
			}
		}
		assets.crew.Karts = append(assets.crew.Karts, kart)
	}
	return assets, rows.Err()
}

// expeditionTx runs fn on the account's expedition under its wallet lock,
// renewing the week (and giving its 探险币) first, and saves the state.
func (s *Store) expeditionTx(ctx context.Context, data *expedition.Data, accountID string, now int64,
	roll expedition.Roller, fn func(tx *sql.Tx, l *ledger, state *expedition.State, assets expeditionAssets) error,
) (ExpeditionView, error) {
	var view ExpeditionView
	err := inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		view = ExpeditionView{}
		l, err := s.lockLedger(ctx, tx, accountID, now)
		if err != nil {
			return err
		}
		var state expedition.State
		var stored string
		err = tx.QueryRowContext(ctx, "SELECT state_json FROM account_expedition WHERE account_id = ? FOR UPDATE",
			accountID).Scan(&stored)
		if err == nil {
			if err := json.Unmarshal([]byte(stored), &state); err != nil {
				return fmt.Errorf("expedition state of %s: %w", accountID, err)
			}
		} else if !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		assets, err := expeditionAssetsOf(ctx, tx, accountID, now)
		if err != nil {
			return err
		}
		feasible := assets.feasible()
		if data.Renew(&state, now, func(specific int) bool { return feasible[specific] }, roll) {
			token := data.Basic.Token
			if _, err := s.grantItem(ctx, tx, accountID, ItemGrant{Category: token.Category, ItemID: token.Item,
				Count: expedition.WeeklyTokens}, SourceExpedition, now); err != nil {
				return err
			}
		}
		if fn != nil {
			if err := fn(tx, l, &state, assets); err != nil {
				return err
			}
		}
		encoded, err := json.Marshal(state)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO account_expedition(account_id, state_json, updated_at)
			VALUES(?, ?, ?) AS incoming ON DUPLICATE KEY UPDATE state_json = incoming.state_json,
			updated_at = incoming.updated_at`, accountID, string(encoded), now); err != nil {
			return err
		}
		if view.Tokens, err = itemCount(ctx, tx, accountID, data.Basic.Token.Category, data.Basic.Token.Item,
			now); err != nil {
			return err
		}
		view.State, view.Feasible = state, feasible
		return nil
	})
	return view, err
}

// Expedition reads the account's expedition (renewing the week).
func (s *Store) Expedition(ctx context.Context, data *expedition.Data, accountID string, now int64,
	roll expedition.Roller) (ExpeditionView, error) {
	return s.expeditionTx(ctx, data, accountID, now, roll, nil)
}

// ExpeditionCrew lists what the account can send: its characters and
// karts, and its friends with their attribute and whether they went today.
func (s *Store) ExpeditionCrew(ctx context.Context, data *expedition.Data, accountID string,
	now int64) (ExpeditionCrew, error) {
	assets, err := expeditionAssetsOf(ctx, s.db, accountID, now)
	if err != nil {
		return ExpeditionCrew{}, err
	}
	var state expedition.State
	var stored string
	err = s.db.QueryRowContext(ctx, "SELECT state_json FROM account_expedition WHERE account_id = ?",
		accountID).Scan(&stored)
	if err == nil {
		_ = json.Unmarshal([]byte(stored), &state)
	} else if !errors.Is(err, sql.ErrNoRows) {
		return ExpeditionCrew{}, err
	}
	rows, err := s.db.QueryContext(ctx, `SELECT a.id, a.nickname, COALESCE(p.json, '') FROM friendships f
		JOIN accounts a ON a.id = f.friend_id LEFT JOIN account_profiles p ON p.account_id = a.id
		WHERE f.account_id = ? ORDER BY a.nickname`, accountID)
	if err != nil {
		return ExpeditionCrew{}, err
	}
	defer rows.Close()
	day := data.DayStart(now)
	for rows.Next() {
		var friend ExpeditionFriend
		var profile string
		if err := rows.Scan(&friend.AccountID, &friend.Nickname, &profile); err != nil {
			return ExpeditionCrew{}, err
		}
		friend.Character, friend.Kart = equippedCharacterKart(profile)
		friend.Specific = expedition.Specific(1, friend.Character)
		friend.UsedToday = state.Friends[friend.AccountID] >= day
		assets.crew.Friends = append(assets.crew.Friends, friend)
	}
	return assets.crew, rows.Err()
}

// equippedCharacterKart reads a profile's equipped character and kart
// (character 1 宝宝 when none).
func equippedCharacterKart(profile string) (character, kart int) {
	var doc struct {
		Equipment struct {
			ItemIDs map[string]int `json:"itemIds"`
		} `json:"equipment"`
	}
	character = 1
	if json.Unmarshal([]byte(profile), &doc) == nil {
		if id := doc.Equipment.ItemIDs["1"]; id > 0 {
			character = id
		}
		kart = doc.Equipment.ItemIDs["3"]
	}
	return character, kart
}

// StartExpedition sends a crew on a mission.
func (s *Store) StartExpedition(ctx context.Context, data *expedition.Data, accountID string,
	in ExpeditionDeparture, now int64, roll expedition.Roller) (ExpeditionView, error) {
	return s.expeditionTx(ctx, data, accountID, now, roll, func(tx *sql.Tx, _ *ledger, state *expedition.State,
		assets expeditionAssets) error {
		departure := expedition.Departure{Slot: in.Slot, Crew: in.Crew, Friend: in.Friend}
		for _, pair := range in.Crew {
			character, ok := assets.character(pair.Character)
			if !ok {
				return expedition.ErrInvalidCrew
			}
			kart, ok := assets.kart(pair.Kart, pair.KartKey)
			if !ok {
				return expedition.ErrInvalidCrew
			}
			departure.Members = append(departure.Members, expedition.Member{CharacterSpecific: character.Specific,
				KartSpecific: kart.Specific, KartLevel: kart.Level, KartParts: kart.Parts})
		}
		if in.Friend != "" {
			var profile sql.NullString
			err := tx.QueryRowContext(ctx, `SELECT p.json FROM friendships f
				LEFT JOIN account_profiles p ON p.account_id = f.friend_id
				WHERE f.account_id = ? AND f.friend_id = ?`, accountID, in.Friend).Scan(&profile)
			if errors.Is(err, sql.ErrNoRows) {
				return errNotFriend
			} else if err != nil {
				return err
			}
			character, _ := equippedCharacterKart(profile.String)
			departure.FriendSpecific = expedition.Specific(1, character)
		}
		_, err := data.Start(state, departure, now)
		return err
	})
}

// Expedition token actions (探险币).
const (
	TokenReduce   = "reduce"   // count × 30 minutes off a running mission
	TokenComplete = "complete" // finish a running mission now
	TokenChange   = "change"   // swap a mission not started
	TokenAdd      = "add"      // one more mission this week
)

var errUnknownTokenAction = apierr.New(http.StatusBadRequest, "INVALID_TOKEN_ACTION")

// UseExpeditionTokens spends 探险币 on a mission (slot) or the week (add).
func (s *Store) UseExpeditionTokens(ctx context.Context, data *expedition.Data, accountID, action string, slot,
	count int, now int64, roll expedition.Roller) (ExpeditionView, error) {
	return s.expeditionTx(ctx, data, accountID, now, roll, func(tx *sql.Tx, _ *ledger, state *expedition.State,
		assets expeditionAssets) error {
		feasibleSet := assets.feasible()
		feasible := func(specific int) bool { return feasibleSet[specific] }
		var cost int
		var err error
		switch action {
		case TokenReduce:
			cost = data.ReduceCost(count)
			_, err = data.Reduce(state, slot, count, now)
		case TokenComplete:
			_, cost, err = data.Complete(state, slot, now)
		case TokenChange:
			cost = data.Basic.ChangeMissionTokens
			_, err = data.Change(state, slot, feasible, roll)
		case TokenAdd:
			cost = data.Basic.AddMissionTokens
			_, err = data.Add(state, feasible, roll)
		default:
			return errUnknownTokenAction
		}
		if err != nil {
			return err
		}
		if cost > 0 {
			_, err = consumeItem(ctx, tx, accountID, data.Basic.Token.Category, data.Basic.Token.Item, cost, now)
		}
		return err
	})
}

// ClaimExpedition takes a finished mission's reward: its exp, lucci and
// reward stock items.
func (s *Store) ClaimExpedition(ctx context.Context, data *expedition.Data, names func(category, itemID int) string,
	accountID string, slot int, now int64, roll expedition.Roller) (ExpeditionView, ExpeditionClaim, error) {
	var claim ExpeditionClaim
	view, err := s.expeditionTx(ctx, data, accountID, now, roll, func(tx *sql.Tx, l *ledger, state *expedition.State,
		_ expeditionAssets) error {
		claim = ExpeditionClaim{}
		claimed, mission, err := data.Claim(state, slot, now)
		if err != nil {
			return err
		}
		claim.Slot = claimed
		ref := fmt.Sprintf("%d:%d", state.Week, claimed.Slot)
		levelsBefore := len(l.levelUps)
		if claimed.Exp > 0 {
			applied, _, err := l.addExp(claimed.Exp, ReasonExpedition, ref, "")
			if err != nil {
				return err
			}
			claim.Exp = applied
		}
		if claimed.Lucci > 0 {
			before := l.wallet.Lucci
			if _, err := l.add(economy.Lucci, claimed.Lucci, ReasonExpedition, ref, ""); err != nil {
				return err
			}
			claim.Lucci = l.wallet.Lucci - before
		}
		claim.LevelUps = l.levelUps[levelsBefore:]
		for _, item := range data.Stocks[mission.StockID].Items {
			row, err := s.grantItem(ctx, tx, accountID, ItemGrant{Category: item.Category, ItemID: item.ItemID,
				Count: item.Count, Days: item.Days}, SourceExpedition, now)
			if err != nil {
				return err
			}
			claim.Items = append(claim.Items, BoxReward{Category: item.Category, ItemID: item.ItemID,
				Count: item.Count, Days: item.Days, Name: names(item.Category, item.ItemID)})
			claim.Inventory = append(claim.Inventory, row)
		}
		return nil
	})
	return view, claim, err
}
