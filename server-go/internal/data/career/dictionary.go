package career

import (
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"sync"
)

// The 道具图鉴 (item dictionary): which items it lists, by category in
// display order, items hidden until a date (embargo), and the reward per
// newly collected item. dictionary.json is generated with careers.json by
// rewrite/tools/export-career-data.mjs from zeta_/cn/content/itemDictionary.xml.
//
// An item counts as collected once the account has ever had it (expired
// rentals included, as the original tip 期限制道具也可以激活道具图鉴 says); the
// dictionary careers (types 12-23) count the same entries.

//go:embed dictionary.json
var embeddedDictionary []byte

// DictionaryCategory is one listed category.
type DictionaryCategory struct {
	Name     string `json:"name"`
	Category int    `json:"category"`
	Items    []int  `json:"items"`
}

// DictionaryReward is what each newly collected item is worth (the original
// rewardItem: one item 56:1, the 酷币 / koin).
type DictionaryReward struct {
	Category int `json:"category"`
	Item     int `json:"item"`
	Count    int `json:"count"`
}

// Dictionary is the embedded dictionary table.
type Dictionary struct {
	Version    string
	Categories []DictionaryCategory
	Reward     DictionaryReward
	// KartGrades is each listed kart's engine grade (kartBodyGrade 1-13).
	KartGrades map[int]int
	listed     map[int]map[int]bool
	embargo    map[[2]int]int64 // listed only from this Unix ms
}

// ParseDictionary reads a dictionary.json document.
func ParseDictionary(raw []byte) (*Dictionary, error) {
	var doc struct {
		Version    string               `json:"version"`
		Categories []DictionaryCategory `json:"categories"`
		Embargo    []struct {
			Since int64    `json:"since"`
			Items [][2]int `json:"items"`
		} `json:"embargo"`
		KartGrades map[string]int   `json:"kartGrades"`
		Reward     DictionaryReward `json:"reward"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, fmt.Errorf("dictionary.json: %w", err)
	}
	if doc.Version == "" || len(doc.Categories) == 0 || doc.Reward.Count <= 0 {
		return nil, errors.New("dictionary.json: missing version, categories or reward")
	}
	d := &Dictionary{Version: doc.Version, Categories: doc.Categories, Reward: doc.Reward,
		KartGrades: map[int]int{}, listed: map[int]map[int]bool{}, embargo: map[[2]int]int64{}}
	for _, category := range doc.Categories {
		if d.listed[category.Category] != nil {
			return nil, fmt.Errorf("dictionary.json: category %d listed twice", category.Category)
		}
		set := make(map[int]bool, len(category.Items))
		for _, id := range category.Items {
			set[id] = true
		}
		d.listed[category.Category] = set
	}
	for _, row := range doc.Embargo {
		for _, item := range row.Items {
			if !d.listed[item[0]][item[1]] {
				return nil, fmt.Errorf("dictionary.json: embargo names unlisted item %v", item)
			}
			d.embargo[item] = row.Since
		}
	}
	for key, grade := range doc.KartGrades {
		id, err := strconv.Atoi(key)
		if err != nil || !d.listed[3][id] {
			return nil, fmt.Errorf("dictionary.json: kart grade for unlisted kart %q", key)
		}
		d.KartGrades[id] = grade
	}
	return d, nil
}

var loadDictionary = sync.OnceValues(func() (*Dictionary, error) { return ParseDictionary(embeddedDictionary) })

// DefaultDictionary returns the embedded dictionary.
func DefaultDictionary() (*Dictionary, error) { return loadDictionary() }

// Listed reports whether the dictionary shows an item at now (Unix ms).
func (d *Dictionary) Listed(category, item int, now int64) bool {
	if !d.listed[category][item] {
		return false
	}
	since, embargoed := d.embargo[[2]int{category, item}]
	return !embargoed || now >= since
}

// Collected is the listed items among owned, by category in display order.
func (d *Dictionary) Collected(owned map[int]map[int]bool, now int64) map[int][]int {
	collected := map[int][]int{}
	for _, category := range d.Categories {
		ids := []int{}
		for _, id := range category.Items {
			if owned[category.Category][id] && d.Listed(category.Category, id, now) {
				ids = append(ids, id)
			}
		}
		collected[category.Category] = ids
	}
	return collected
}

// Count is how many listed items are among owned (in one category, or
// every category when category is 0).
func (d *Dictionary) Count(owned map[int]map[int]bool, category int, now int64) int {
	total := 0
	for _, row := range d.Categories {
		if category != 0 && row.Category != category {
			continue
		}
		for _, id := range row.Items {
			if owned[row.Category][id] && d.Listed(row.Category, id, now) {
				total++
			}
		}
	}
	return total
}

// Size is how many items the dictionary lists at now.
func (d *Dictionary) Size(now int64) int {
	total := 0
	for _, row := range d.Categories {
		for _, id := range row.Items {
			if d.Listed(row.Category, id, now) {
				total++
			}
		}
	}
	return total
}
