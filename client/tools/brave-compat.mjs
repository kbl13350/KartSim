// Maintained compatibility seams for the released bundle. This also works in
// public checkouts without the private recovered/formatted generator input.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createHash } from "node:crypto";

const patches = {
  "formats.js": [
    ['  brawl: "50人乱斗", // brawl(lobby)', '  brave: "勇者组队竞速赛", // brave(lobby)\n  brawl: "50人乱斗", // brawl(lobby)'],
    ['    n === "brawl" // brawl(lobby)', '    n === "brave" || // brave(lobby)\n    n === "brawl" // brawl(lobby)'],
    ['function To(n, e, t) {', 'function To(n, e, t) {\n  if (n === "brave") return e === "speedTeamCombine" && (t === void 0 || t === "p3553"); // brave(lobby)'],
    ['    case "brawl": // brawl(lobby)', '    case "brave": return 31; // brave(lobby)\n    case "brawl": // brawl(lobby)'],
    ['  if (e === "brawl") return BRAWL_LABEL; // brawl(lobby)', '  if (e === "brave") return "勇者组队竞速赛"; // brave(lobby)\n  if (e === "brawl") return BRAWL_LABEL; // brawl(lobby)'],
  ],
  "library.js": [
    ['    case BRAWL_GAME_TYPE: // brawl(lobby)', '    case 31: // brave(lobby)\n      return Object.freeze({ [Pn]: !0, modeId: n, kind: "brave", team: !0 });\n    case BRAWL_GAME_TYPE: // brawl(lobby)'],
  ],
  "vehicle.js": [
    ['loadMultiplayerMap(path, trackId, mode) { return loadMultiplayerMap(this, path, trackId, mode, Bt, Vw, Z30); }', 'loadMultiplayerMap(path, trackId, mode, brave) { return loadMultiplayerMap(this, path, trackId, mode, Bt, Vw, Z30, brave); }'],
    ['async loadMap(path, trackId, mode, admit, lte = false, itemGame = false) { return loadTrackMap(this, path, trackId, mode, admit, lte, trackMapOps, itemGame); }', 'async loadMap(path, trackId, mode, admit, lte = false, itemGame = false, brave) { return loadTrackMap(this, path, trackId, mode, admit, lte, trackMapOps, itemGame, brave); }'],
    ['function w40(n, e) {', 'function w40(n, e) {\n  if (G2(n) === "brave" ? !isBraveRaceRules(e.brave) || !sameBraveRaceRules(e.brave, n.race?.brave) || !isBraveRoster(e.roster) || e.trackId !== "village_R07" : e.brave !== void 0)\n    throw new Error("勇者模式冻结参数无效。");'],
    [': _.loadMultiplayerMap(E.path, E.id, isItemRaceRoom(e) ? "item" : void 0)', ': G2(e) === "brave"\n          ? _.loadMultiplayerMap(E.path, E.id, "brave", braveRouteSelection(t, r.playerId))\n          : _.loadMultiplayerMap(E.path, E.id, isItemRaceRoom(e) ? "item" : void 0)'],
  ],
  "world.js": [
    ['      n.applyKartPairResponse(dE(f.linear), dE(f.angular), f.strength);', '      n.applyKartPairResponse(dE(f.linear), dE(f.angular), f.strength);\n      noteBraveKartContact(n, l); // brave: actual kart impulse, never a wall/proximity guess'],
  ],
};
const imports = {
  "vehicle.js": [
    'import { isBraveRaceRules, sameBraveRaceRules, isBraveRoster } from "../multiplayer/lobby-brave-mode.ts";',
    'import { braveRouteSelection } from "../multiplayer/brave-route.ts";',
  ],
  "world.js": ['import { noteBraveKartContact } from "../multiplayer/brave-signals.ts";'],
};

export function applyBraveCompatibility(filename, contents) {
  contents = contents.replace('throw new Error("勇者比赛冻结参数无效。");',
    'throw new Error("勇者模式冻结参数无效。");');
  for (const [before, after] of patches[filename] ?? []) {
    if (contents.includes(after)) continue;
    const at = contents.indexOf(before);
    if (at < 0 || contents.indexOf(before, at + before.length) >= 0)
      throw new Error(`Brave compatibility seam missing or ambiguous in ${filename}: ${before.slice(0, 80)}`);
    contents = contents.replace(before, () => after);
  }
  for (const line of imports[filename] ?? []) {
    if (!contents.includes(line)) contents = `${line}\n${contents}`;
  }
  return contents;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const folder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/generated");
  const manifestPath = path.join(folder, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  for (const name of Object.keys(patches)) {
    const file = path.join(folder, name);
    const before = await readFile(file, "utf8");
    const after = applyBraveCompatibility(name, before);
    if (before !== after) await writeFile(file, after);
    const row = manifest.files?.find(row => row.file === name);
    if (row) {
      row.bytes = Buffer.byteLength(after);
      row.sha256 = createHash("sha256").update(after).digest("hex");
    }
  }
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log("Brave compatibility seams installed.");
}
