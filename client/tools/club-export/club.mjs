// Rows of server-go/internal/data/club/club.json: the club marks and
// frames of DataPack1 etc_/clubMark (clubMark@cn.xml, clubFrame/clubFrame@cn.xml).
// A mark or frame may be used from its club level on; the basic ones are the
// choices of a new club; a rank frame belongs to the top-3 clubs.

const attr = (node, name) => node.attributes.find(item => item.name === name)?.value;

function integer(node, name, problem, { optional = false, min = 0 } = {}) {
  const raw = attr(node, name);
  if (raw === undefined && optional) return undefined;
  const value = Number(raw);
  if (raw === undefined || !Number.isSafeInteger(value) || value < min) {
    problem(`${node.name}.${name}: bad value ${JSON.stringify(raw)}`);
    return 0;
  }
  return value;
}

function rows(root, name, problem) {
  const seen = new Set();
  return root.children.filter(node => node.name === name).map(node => {
    const id = integer(node, "id", problem);
    if (seen.has(id)) problem(`${name} ${id} repeated`);
    seen.add(id);
    const row = { id, order: integer(node, "order", problem, { optional: true }) ?? 0 };
    const level = integer(node, "level", problem, { optional: true, min: 1 });
    const rank = integer(node, "rank", problem, { optional: true, min: 1 });
    if (level !== undefined) row.level = level;
    if (rank !== undefined) row.rank = rank;
    if (level === undefined && rank === undefined) problem(`${name} ${id}: neither level nor rank`);
    if ((attr(node, "basic") ?? "").toLowerCase() === "true") row.basic = true;
    return row;
  }).sort((a, b) => a.id - b.id);
}

export function clubRows(markRoot, frameRoot, problem) {
  if (markRoot.name !== "clubMarkList") problem(`clubMark root is ${markRoot.name}`);
  if (frameRoot.name !== "clubFrameList") problem(`clubFrame root is ${frameRoot.name}`);
  const marks = rows(markRoot, "clubMark", problem);
  const frames = rows(frameRoot, "clubFrame", problem);
  if (!marks.some(mark => mark.basic)) problem("no basic club mark");
  if (!frames.some(frame => frame.basic)) problem("no basic club frame");
  return { marks, frames };
}
