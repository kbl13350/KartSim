// Maintained DeathMatchTeam seams, applied after the existing Brave seams.
// The CLI also updates public checkouts without private generator inputs.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const patches = {
  "formats.js": [
    ['  brave: "勇者组队竞速赛", // brave(lobby)', '  deathmatch: "死斗模式", // deathmatch(lobby)\n  brave: "勇者组队竞速赛", // brave(lobby)'],
    ['    n === "brave" || // brave(lobby)', '    n === "deathmatch" || // deathmatch(lobby)\n    n === "brave" || // brave(lobby)'],
    ['  if (n === "brave") return e === "speedTeamCombine" && (t === void 0 || t === "p3553"); // brave(lobby)', '  if (n === "brave") return e === "speedTeamCombine" && (t === void 0 || t === "p3553"); // brave(lobby)\n  if (n === "deathmatch") return e === "speedTeamCombine" && (t === void 0 || t === "p3553"); // deathmatch(lobby)'],
    ['    case "brave": return 31; // brave(lobby)', '    case "deathmatch": return 58; // deathmatch(lobby)\n    case "brave": return 31; // brave(lobby)'],
    ['  if (e === "brave") return "勇者组队竞速赛"; // brave(lobby)', '  if (e === "deathmatch") return "死斗模式"; // deathmatch(lobby)\n  if (e === "brave") return "勇者组队竞速赛"; // brave(lobby)'],
  ],
  "library.js": [
    ['    case 31: // brave(lobby)', '    case 58: // deathmatch(lobby)\n      return Object.freeze({ [Pn]: !0, modeId: n, kind: "deathmatch", team: !0 });\n    case 31: // brave(lobby)'],
  ],
  "vehicle.js": [
    ['loadMultiplayerMap(path, trackId, mode, brave) { return loadMultiplayerMap(this, path, trackId, mode, Bt, Vw, Z30, brave); }', 'loadMultiplayerMap(path, trackId, mode, brave, deathmatch) { return loadMultiplayerMap(this, path, trackId, mode, Bt, Vw, Z30, brave, deathmatch); }'],
    ['async loadMap(path, trackId, mode, admit, lte = false, itemGame = false, brave) { return loadTrackMap(this, path, trackId, mode, admit, lte, trackMapOps, itemGame, brave); }', 'async loadMap(path, trackId, mode, admit, lte = false, itemGame = false, brave, deathmatch) { return loadTrackMap(this, path, trackId, mode, admit, lte, trackMapOps, itemGame, brave, deathmatch); }'],
    ['    throw new Error("勇者模式冻结参数无效。");', '    throw new Error("勇者模式冻结参数无效。");\n  validateDeathmatchRace(n, e); // deathmatch(frozen-race)'],
    ['            ? itemTrackCatalog(g)\n            : g.timeAttackTrackCatalog(),', '            ? itemTrackCatalog(g)\n            : G2(e) === "deathmatch" // deathmatch(arenas)\n              ? deathmatchTrackCatalog(g)\n              : g.timeAttackTrackCatalog(),'],
    [': G2(e) === "brave"\n          ? _.loadMultiplayerMap(E.path, E.id, "brave", braveRouteSelection(t, r.playerId))', ': G2(e) === "deathmatch"\n          ? _.loadMultiplayerMap(E.path, E.id, "deathmatch", void 0, t.deathmatch)\n          : G2(e) === "brave"\n          ? _.loadMultiplayerMap(E.path, E.id, "brave", braveRouteSelection(t, r.playerId))'],
  ],
  "world.js": [
    ['      noteBraveKartContact(n, l); // brave: actual kart impulse, never a wall/proximity guess', '      noteBraveKartContact(n, l); // brave: actual kart impulse, never a wall/proximity guess\n      noteDeathmatchKartContact(n, l);'],
  ],
};
const imports = {
  "vehicle.js": [
    'import { deathmatchTrackCatalog } from "../resources/track-catalog.ts";',
    'import { validateDeathmatchRace } from "../multiplayer/deathmatch-validation.ts";',
  ],
  "world.js": ['import { noteDeathmatchKartContact } from "../multiplayer/deathmatch-runtime.ts";'],
};

export function applyDeathmatchCompatibility(filename, contents) {
  for (const [before, after] of patches[filename] ?? []) {
    if (contents.includes(after)) continue;
    const at = contents.indexOf(before);
    if (at < 0 || contents.indexOf(before, at + before.length) >= 0)
      throw new Error(`Deathmatch compatibility seam missing or ambiguous in ${filename}: ${before.slice(0, 80)}`);
    contents = contents.replace(before, () => after);
  }
  for (const line of imports[filename] ?? [])
    if (!contents.includes(line)) contents = `${line}\n${contents}`;
  return contents;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const folder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/generated");
  const manifestPath = path.join(folder, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  for (const name of Object.keys(patches)) {
    const target = path.join(folder, name);
    const before = await readFile(target, "utf8"), after = applyDeathmatchCompatibility(name, before);
    if (after !== before) await writeFile(target, after);
    const row = manifest.files?.find(row => row.file === name);
    if (row) {
      row.bytes = Buffer.byteLength(after);
      row.sha256 = createHash("sha256").update(after).digest("hex");
    }
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log("Deathmatch compatibility seams installed.");
}
