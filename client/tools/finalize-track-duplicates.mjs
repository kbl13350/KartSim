// Assemble explicitly reviewed visual decisions; this tool never infers a merge
// from matching names, hashes or pixel similarity. --write-catalog applies them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../../', import.meta.url));
const out = path.join(project, 'output/track-dedup');
const read = name => JSON.parse(fs.readFileSync(path.join(out, name), 'utf8'));
const files = fs.readdirSync(out).filter(name => /^visual-decisions-.*\.json$/.test(name)).sort();
const documents = files.map(name => ({ name, ...read(name) }));
const decisions = documents.flatMap(document => document.groups.map(group => ({ ...group, source: document.name,
  evidence: Array.isArray(group.evidence) ? group.evidence : [
    ...(group.evidence?.contactSheets ?? []), ...(group.evidence?.detailViews ?? [])],
  keepDistinct: (group.keepDistinct ?? []).map(kept => typeof kept === 'string' ? { id: kept, reason: group.reason } : kept),
})));
const catalog = read('model-hashes.json').maps;
const byId = new Map(catalog.map(map => [map.id, map]));
const parent = new Map();
const root = id => { if (!parent.has(id)) parent.set(id, id); const p = parent.get(id); return p === id ? id : (parent.set(id, root(p)), parent.get(id)); };
const unite = (a, b) => parent.set(root(b), root(a));
const votes = new Map();
for (const decision of decisions) for (const merge of decision.merges ?? []) {
  if (!merge.aliasIds.length) continue;
  votes.set(merge.canonicalId, (votes.get(merge.canonicalId) ?? 0) + 1);
  for (const id of [merge.canonicalId, ...merge.aliasIds]) {
    if (!byId.has(id)) throw Error(`Reviewed ID is not mounted: ${id}`);
    if (!!byId.get(id).reverse !== !!byId.get(merge.canonicalId).reverse) throw Error(`Mixed directions: ${id}`);
    unite(merge.canonicalId, id);
  }
}
const sets = new Map();
for (const id of parent.keys()) { const key = root(id); sets.set(key, [...(sets.get(key) ?? []), id]); }
const preference = id => {
  const map = byId.get(id);
  return (map.resourceCategory ? 100 : 0) + (/track_\/tw_/i.test(map.canonicalPath ?? map.path) ? 50 : 0)
    + (id.includes('__') ? 10 : 0) + (/_old(?:_|$)/i.test(id) ? 5 : 0);
};
const groups = [...sets.values()].filter(ids => ids.length > 1).map(ids => {
  ids.sort((a, b) => preference(a) - preference(b) || (votes.get(b) ?? 0) - (votes.get(a) ?? 0) || a.localeCompare(b));
  const references = decisions.filter(d => (d.merges ?? []).some(m => [m.canonicalId, ...m.aliasIds].some(id => ids.includes(id))));
  return { canonicalId: ids[0], aliasIds: ids.slice(1).sort(), reason: '已逐组核对原生画面的鸟瞰与四个赛道视角，并检查实际路线、天气及驾驶机制；同一地图保留一个入口。具体差异见审核记录。',
    evidence: { reviewGroups: [...new Set(references.map(d => d.groupId))], contactSheets: [...new Set(references.flatMap(d => d.evidence ?? []))] } };
}).sort((a, b) => a.canonicalId.localeCompare(b.canonicalId));
const conflicts = [];
const candidates = [...read('raw-model-candidates.json').groups, ...read('additional-candidates.json').groups];
const runtimeFile = path.join(out, 'runtime-candidates.json');
if (fs.existsSync(runtimeFile)) candidates.push(...read('runtime-candidates.json').groups);
const candidateById = new Map(candidates.map(group => [group.id, group]));
for (const decision of decisions) {
  const ids = (candidateById.get(decision.groupId)?.maps ?? []).map(map => map.id);
  for (const kept of decision.keepDistinct ?? []) for (const other of ids) {
    if (kept.id === other || !parent.has(kept.id) || !parent.has(other) || root(kept.id) !== root(other)) continue;
    if ((decision.merges ?? []).some(m => [m.canonicalId, ...m.aliasIds].includes(kept.id) && [m.canonicalId, ...m.aliasIds].includes(other))) continue;
    conflicts.push({ group: decision.groupId, kept: kept.id, mergedWith: other, reason: kept.reason });
  }
}
const hidden = groups.reduce((n, group) => n + group.aliasIds.length, 0);
const summary = { originalChoices: catalog.length, visibleChoices: catalog.length - hidden, hiddenAliases: hidden,
  duplicateGroups: groups.length, reviewedCandidateGroups: new Set(decisions.map(d => d.groupId)).size,
  decisionFiles: documents.map(d => ({ name: d.name, status: d.status, groups: d.groups.length })), conflicts,
  policy: '保留反向、明显不同主题/昼夜/天气，以及路线、路面机制、机关或道具布置有实质差异的版本；仅圈数差异不另留地图。旧ID与资源保留用于回放和已有房间。' };
fs.writeFileSync(path.join(out, 'deduplication-summary.json'), JSON.stringify(summary, null, 2) + '\n');
fs.writeFileSync(path.join(out, 'reviewed-duplicates.json'), JSON.stringify({ version: 1, groups }, null, 2) + '\n');
if (process.argv.includes('--write-catalog')) {
  if (conflicts.length) throw Error(`Resolve ${conflicts.length} conflicting review decisions before applying`);
  if (documents.some(d => d.status !== 'complete')) throw Error('Visual reviews are not complete');
  const reviewed = new Set(decisions.map(d => d.groupId));
  if (candidates.some(group => !reviewed.has(group.id))) throw Error('Some candidate groups have no visual decision');
  // The browser only needs identities. Keep local screenshot paths and review
  // details in reviewed-duplicates.json instead of shipping them in the bundle.
  const catalogGroups = groups.map(({ canonicalId, aliasIds }) => ({ canonicalId, aliasIds }));
  fs.writeFileSync(path.join(project, 'client/src/resources/track-duplicates.json'), JSON.stringify({ version: 1, groups: catalogGroups }, null, 2) + '\n');
}
console.log(JSON.stringify(summary, null, 2));
