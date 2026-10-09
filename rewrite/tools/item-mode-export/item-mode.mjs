// Rows of server-go/internal/game/itemmode/itemmode.json: what the game node
// needs to run the item races (道具个人赛 / 组队道具赛, rewrite/ITEM_MODE.md).
// Pure functions over parsed resource nodes and decoded track models, so the
// rules can be tested without the resource library.
//
// Sources: item/slot/itemProb_indi@zz.bml and itemProb_team2@cn.bml (the
// rank-group weights), zeta_/cn/content/itemGameRestrictionItemCount.xml (the
// per-race caps), item/<folder>/item.bml (base-0 state lifetimes),
// track_/common/track@zz.bml, trackLocale@cn.bml and randomTrack@cn.bml with
// the track models (the item track list and its random pools).

const attr = (node, name) => node.attributes.find(item => item.name === name)?.value;

/** A string cut at its first NUL, as the release reads track object properties. */
const unpadded = value => {
  const end = (value ?? "").indexOf("\0");
  return end < 0 ? value : value.slice(0, end);
};

function nonNegativeInt(raw) {
  const text = (raw ?? "").trim();
  const value = Number(text);
  return text !== "" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

/** The rank groups of the probability tables, best first (ITEM_MODE.md 4). */
export const RANK_GROUPS = ["top", "high", "mid", "low"];

/**
 * One itemProb table: <items><item name idx toprank highrank midrank lowrank/>.
 * Rows keep the file order; every column must have some weight.
 */
export function probabilityTable(root, source, problem) {
  if (root?.name !== "items") {
    problem(`${source}: root is ${root?.name}, expected items`);
    return { source, items: [] };
  }
  const items = [];
  const seen = new Set();
  for (const node of root.children) {
    if (node.name !== "item") continue;
    const name = attr(node, "name");
    const idx = nonNegativeInt(attr(node, "idx"));
    if (!name || idx === undefined) { problem(`${source}: item without name or idx`); continue; }
    if (seen.has(idx)) { problem(`${source}: idx ${idx} listed twice`); continue; }
    seen.add(idx);
    const row = { idx, name };
    for (const group of RANK_GROUPS) {
      const weight = nonNegativeInt(attr(node, `${group}rank`));
      if (weight === undefined) problem(`${source}: ${name} ${group}rank ${attr(node, `${group}rank`)}`);
      row[group] = weight ?? 0;
    }
    items.push(row);
  }
  for (const group of RANK_GROUPS)
    if (!items.some(item => item[group] > 0)) problem(`${source}: no weight in ${group}rank`);
  return { source, items };
}

/**
 * itemGameRestrictionItemCount.xml: targetItemList caps how often a racer can
 * get an item in one race; disableItemList names items the restriction does
 * not apply to (ITEM_MODE.md 4 reads it as "unlimited"). Names resolve to the
 * table idx values.
 */
export function restrictionRows(root, idxByName, source, problem) {
  const caps = [];
  const unlimited = [];
  if (!/^itemGameRestrictionItemcount$/i.test(root?.name ?? "")) {
    problem(`${source}: root is ${root?.name}`);
    return { caps, unlimited };
  }
  const list = name => root.children.find(child => child.name === name)?.children
    .filter(child => child.name === "item") ?? [];
  for (const node of list("targetItemList")) {
    const name = attr(node, "name");
    const allowCount = nonNegativeInt(attr(node, "allowCount"));
    const idx = idxByName.get(name);
    if (idx === undefined || allowCount === undefined || allowCount < 1) {
      problem(`${source}: target item ${name} (allowCount ${attr(node, "allowCount")}) is not a table item`);
      continue;
    }
    caps.push({ idx, name, allowCount });
  }
  for (const node of list("disableItemList")) {
    const name = attr(node, "name");
    const idx = idxByName.get(name);
    if (idx === undefined) { problem(`${source}: disabled item ${name} is not a table item`); continue; }
    unlimited.push({ idx, name });
  }
  if (caps.length === 0) problem(`${source}: no capped items`);
  return { caps, unlimited };
}

/**
 * The item.rho folder of a table item. guideRocket and randomRocket have no
 * folder of their own and reuse the missile (rewrite/ITEM_MODE.md appendix B,
 * research 1-item-data 3); booster has no item.bml at all (its time is the
 * kart's itemBoosterTime).
 */
export const ITEM_FOLDERS = { guideRocket: "rocket", randomRocket: "rocket", booster: undefined };

export function itemFolder(name) {
  return Object.hasOwn(ITEM_FOLDERS, name) ? ITEM_FOLDERS[name] : name;
}

/**
 * The base-0 states of an item.bml: the states before the first repeated
 * state name (a file repeats its whole state list once per variant), as
 * {name: life in ms}.
 */
export function baseStates(root, folder, problem) {
  const source = `item/${folder}/item.bml`;
  if (root?.name !== "item") { problem(`${source}: root is ${root?.name}`); return {}; }
  if (attr(root, "name") !== folder) problem(`${source}: item name ${attr(root, "name")}`);
  const states = {};
  for (const node of root.children) {
    if (node.name !== "state") continue;
    const name = attr(node, "name");
    if (!name) { problem(`${source}: state without a name`); continue; }
    if (Object.hasOwn(states, name)) break;
    const life = nonNegativeInt(attr(node, "life"));
    if (life === undefined) { problem(`${source}: ${name} life ${attr(node, "life")}`); continue; }
    states[name] = life;
  }
  if (Object.keys(states).length === 0) problem(`${source}: no states`);
  return states;
}

/**
 * The item cubes of a decoded track model (formats y9): static ToItemCube
 * objects plus ToMovableObject objects whose property/object@type is
 * itemCube (moving cubes).
 */
export function cubeCount(model) {
  if (model?.root?.kind !== "track") return 0;
  let count = 0;
  for (const object of model.root.trackObjects) {
    if (object.kind === "ToItemCube") count++;
    else if (object.kind === "ToMovableObject") {
      const descriptor = object.property?.children?.find(child => unpadded(child.name) === "object");
      const type = descriptor?.attributes?.find(item => unpadded(item.name) === "type");
      if (type && unpadded(type.value) === "itemCube") count++;
    }
  }
  return count;
}

/**
 * trackLocale@cn rows that close a track: blocked="true" or
 * choosable="false" on <track id> or on <track_rvs refId> (the "<id>_rvs"
 * reverse variant).
 */
export function closedLocaleTracks(root) {
  const closed = new Set();
  for (const node of root?.children ?? []) {
    const id = node.name === "track" ? attr(node, "id")
      : node.name === "track_rvs" && attr(node, "refId") ? `${attr(node, "refId")}_rvs` : undefined;
    if (!id) continue;
    if (attr(node, "blocked")?.toLowerCase() === "true" || attr(node, "choosable")?.toLowerCase() === "false")
      closed.add(id);
  }
  return closed;
}

/**
 * The metadata the item track list starts from: gameType="item" rows of
 * track@zz. isOnlyItemTrack is cleared so the client's catalog rules
 * (timeAttackTrackCatalog, which drops item-only tracks for time attack)
 * keep them: item rooms are exactly where those tracks belong.
 */
export function itemTrackMetadata(metadata) {
  return metadata.filter(track => track.gameType === "item")
    .map(track => ({ ...track, isOnlyItemTrack: undefined }));
}

/**
 * Track rows from the client's TrackChoice list of item tracks: those not
 * closed in trackLocale@cn (a closed track closes its reverse variant too)
 * whose exact model (.1s, including the _rvs variant) holds item cubes.
 * onlyItem marks the isOnlyItemTrack rows.
 */
export function trackRows(choices, { closed, cubes, onlyItem }, problem) {
  const rows = [];
  const seen = new Set();
  for (const choice of choices) {
    if (choice.gameType !== "item") continue;
    if (seen.has(choice.id)) { problem(`track ${choice.id} listed twice`); continue; }
    seen.add(choice.id);
    if (closed.has(choice.id) || closed.has(choice.id.replace(/_rvs$/, ""))) continue;
    const count = cubes.get(choice.id) ?? 0;
    if (count <= 0) continue;
    rows.push({ id: choice.id, title: choice.title, cubes: count,
      onlyItem: onlyItem.has(choice.id.replace(/_rvs$/, "")) || undefined,
      reverse: choice.reverse ? true : undefined });
  }
  if (rows.length === 0) problem("no item track has item cubes");
  return rows;
}

/**
 * The random codes of an item room and the client random groups they draw
 * from (generated library.js Yc numbers the speed groups the same way:
 * 3-7 hot1-hot5, 0 all, 8 new, 30 reverse; 40 speedAll has no item group).
 */
export const RANDOM_CODES = [
  { code: 3, group: "item:hot1:1" },
  { code: 4, group: "item:hot2:2" },
  { code: 5, group: "item:hot3:3" },
  { code: 6, group: "item:hot4:4" },
  { code: 7, group: "item:hot5:5" },
  { code: 0, group: "item:all:0" },
  { code: 8, group: "item:new:0" },
  { code: 30, group: "item:reverse:0" },
];

/**
 * The pools of the random codes, from the client's random groups
 * (randomTrackGroupsFromBml over the item choices) restricted to the
 * exported track rows.
 */
export function randomPools(groups, rows, problem) {
  const allowed = new Set(rows.map(row => row.id));
  return RANDOM_CODES.map(({ code, group }) => {
    const found = groups.find(candidate => candidate.id === group);
    const tracks = (found?.trackIds ?? []).filter(id => allowed.has(id));
    if (tracks.length === 0) problem(`random code ${code} (${group}) has no item track`);
    return { code, group, tracks };
  });
}

/** The default track of an item room: the first track of the hot1 pool. */
export function defaultTrack(pools, problem) {
  const hot1 = pools.find(pool => pool.code === 3)?.tracks ?? [];
  if (hot1.length === 0) problem("item hot1 has no track for the default");
  return hot1[0];
}
