package plugin

// Trap makes the test plugin trap (its op 99).
func Trap(p *Plugin) { p.request(99, nil) }
