// Package names holds the nickname comparison rule shared by the game
// node's local duplicate check and its presence bookkeeping.
package names

import shared "kartsim/internal/shared/names"

// Fold returns the case-insensitive form of a nickname. It is the same rule
// as the data service's presence keys (internal/shared/names), so a name
// that collides on one node collides on every node.
func Fold(name string) string { return shared.Fold(name) }
