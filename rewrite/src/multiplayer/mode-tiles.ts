/** Mode cards positioned on the multiplayer lobby's 1600×900 canvas. */
export const multiplayerModeTiles = [
  { name: "ordinaryRace", label: "普通竞速", image: "ordinary-race.png",
    gameplay: "ordinary", x: 0, y: 0 },
  { name: "gripRace", label: "抓地模式", image: "grip-mode.png",
    gameplay: "grip", x: 278, y: 0 },
  { name: "shadowRace", label: "幽灵模式", image: "ghost-mode.png",
    gameplay: "shadow", x: 0, y: 138 },
  { name: "blockingRace", label: "挡人模式", image: "blocking-mode.png",
    gameplay: "roadblock", x: 278, y: 138 },
  { name: "giantRace", label: "巨人模式", image: "giant-mode-hd.png",
    gameplay: "giant", x: 0, y: 276 },
  { name: "rpRace", label: "RP竞速", image: "cn_스피드복불복개인전_0",
    resourceRoot: "zeta_/cn/stage/mainMenu", editedImage: "rp-race-neutral-0",
    gameplay: "rp", x: 278, y: 276 },
  // The recovered menu has six cards. Reuse its normal card art and paint an
  // explicit trial label so LTE is reachable without depending on new assets.
  { name: "lteRace", label: "LTE Web试玩", image: "ordinary-race.png",
    gameplay: "lte", x: 0, y: 414 },
] as const;
