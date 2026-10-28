// Local evidence gallery, generated solely from the saved review decisions.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const project = fileURLToPath(new URL('../../', import.meta.url));
const out = path.join(project, 'output/track-dedup');
const read = name => JSON.parse(fs.readFileSync(path.join(out, name), 'utf8'));
const summary = read('deduplication-summary.json');
const mapping = read('reviewed-duplicates.json').groups;
const catalog = new Map(read('model-hashes.json').maps.map(map => [map.id, map]));
const documents = fs.readdirSync(out).filter(name => /^visual-decisions-.*\.json$/.test(name)).sort().map(read);
const reviews = documents.flatMap(document => document.groups);
const byGroup = new Map(reviews.map(review => [review.groupId, review]));
const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
const title = id => catalog.get(id)?.title ?? id;
const label = id => `<strong>${escape(title(id))}</strong> <code>${escape(id)}</code>`;
const pictures = sheets => [...new Set(sheets)].map(source => {
  const relative = path.isAbsolute(source) ? path.relative(out, source) : source;
  return `<a href="${escape(relative)}" target="_blank"><img loading="lazy" src="${escape(relative)}" alt="五视角实际渲染对比：${escape(path.basename(relative))}"></a>`;
}).join('');
const merged = mapping.map(group => {
  const members = new Set([group.canonicalId, ...group.aliasIds]);
  const reasons = group.evidence.reviewGroups.flatMap(id => (byGroup.get(id)?.merges ?? [])
    .filter(merge => [merge.canonicalId, ...merge.aliasIds].some(member => members.has(member)))
    .map(merge => merge.reason)).filter(Boolean);
  const search = [group.canonicalId, ...group.aliasIds].flatMap(id => [id, title(id)]).join(' ');
  return `<details class="card" data-kind="merge" data-search="${escape(search)}"><summary>${label(group.canonicalId)}<span class="badge">合并 ${group.aliasIds.length} 个重复入口</span></summary><div class="body"><p>保留：${label(group.canonicalId)}</p><p>合并的入口：</p><ul>${group.aliasIds.map(id => `<li>${label(id)}</li>`).join('')}</ul><p>${escape([...new Set(reasons)].join(' '))}</p>${pictures(group.evidence.contactSheets)}</div></details>`;
}).join('\n');
const distinct = reviews.filter(review => review.keepDistinct?.length).map(review => {
  const ids = review.keepDistinct.map(kept => typeof kept === 'string' ? kept : kept.id);
  const reasons = review.keepDistinct.map(kept => typeof kept === 'string' ? review.reason : kept.reason).filter(Boolean);
  const sheets = Array.isArray(review.evidence) ? review.evidence : [
    ...(review.evidence?.contactSheets ?? []), ...(review.evidence?.detailViews ?? [])];
  return `<details class="card" data-kind="keep" data-search="${escape(ids.flatMap(id => [id, title(id)]).join(' '))}"><summary>${escape(ids.map(title).join(' / '))}<span class="badge keep">保留不同版本</span></summary><div class="body"><ul>${ids.map(id => `<li>${label(id)}</li>`).join('')}</ul><p>${escape([...new Set(reasons)].join(' '))}</p>${pictures(sheets)}</div></details>`;
}).join('\n');
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>地图视觉去重结果</title><style>
*{box-sizing:border-box}body{margin:0;background:#f3f5f7;color:#192c3e;font:16px/1.65 system-ui,-apple-system,sans-serif}main{max-width:1260px;margin:auto;padding:40px 24px}h1{font-size:32px;margin:0 0 8px}p{margin:12px 0}header p{max-width:920px;color:#4d6071}.metrics{display:flex;gap:18px;flex-wrap:wrap;margin:28px 0}.metric{background:white;border:1px solid #dce3e9;border-radius:12px;padding:16px 24px;min-width:180px}.metric b{font-size:32px;display:block;color:#11756e}.toolbar{display:flex;gap:12px;flex-wrap:wrap;position:sticky;top:0;z-index:2;background:#f3f5f7f5;padding:14px 0}input,select{font:inherit;border:1px solid #bac8d3;border-radius:8px;background:white;padding:10px}input{flex:1;min-width:230px}.card{border:1px solid #d9e2e9;background:white;border-radius:10px;margin:12px 0;overflow:hidden}.card[hidden]{display:none}summary{cursor:pointer;padding:18px 20px}code{font:12px ui-monospace,monospace;color:#526a7d;overflow-wrap:anywhere}summary code{margin-left:8px}.badge{display:inline-block;margin-left:12px;padding:2px 9px;border-radius:20px;background:#e3f4f0;color:#116c61;font-size:12px}.keep{background:#e9effc;color:#3d5c93}.body{padding:0 20px 20px;border-top:1px solid #edf0f4}.body img{display:block;width:100%;height:auto;margin:18px 0;border-radius:6px}.body li{margin:5px 0}footer{color:#596e80;margin-top:30px;font-size:13px}#visible{font-size:13px;color:#617589;align-self:center}
</style><main><header><h1>地图视觉去重结果</h1><p>按实际加载后的画面对照，结合路线、碰撞、道具和天气核对。保留反向路线与明显不同的场景；相同地图的不同译名或地区广告版本只留一个入口。</p></header><div class="metrics"><div class="metric">原地图选项<b>${summary.originalChoices}</b></div><div class="metric">去重后选项<b>${summary.visibleChoices}</b></div><div class="metric">移除重复入口<b>${summary.hiddenAliases}</b></div><div class="metric">合并地图组<b>${summary.duplicateGroups}</b></div></div><p>原始地图 ID 和资源仍保留，旧收藏、回放及已有房间继续兼容。每组证据包含鸟瞰、起点、路线 1/3、2/3 和尾端；近景使用原生天空、雾与材质。鸟瞰仅延长可见距离。雨雪粒子另用实际天气配置核对。</p><div class="toolbar"><input id="query" type="search" placeholder="搜索地图名称或 ID" aria-label="搜索地图"><select id="kind" aria-label="审核结果筛选"><option value="merge">已合并</option><option value="keep">保留差异版本</option><option value="all">全部审核结果</option></select><span id="visible"></span></div><div id="cards">${merged}${distinct}</div><footer>点击任一组展开五视角证据，点击图片可查看原图。保留差异列表按候选组记录，因此一个地图可能出现在多组对比中。完整机器清单：reviewed-duplicates.json；逐图解析：maps/；原始截图：screenshots/、second-half/、additional/、runtime/。</footer></main><script>
const cards=[...document.querySelectorAll('.card')],query=document.querySelector('#query'),kind=document.querySelector('#kind');function filter(){const q=query.value.trim().toLocaleLowerCase();let n=0;for(const card of cards){card.hidden=!(kind.value==='all'||kind.value===card.dataset.kind)||!card.dataset.search.toLocaleLowerCase().includes(q);if(!card.hidden)n++}document.querySelector('#visible').textContent=n+' 组'}query.addEventListener('input',filter);kind.addEventListener('change',filter);filter();
</script></html>`;
fs.writeFileSync(path.join(out, '地图视觉去重结果.html'), html);
const text = ['地图视觉去重结果', '', `${summary.originalChoices} 个选项 → ${summary.visibleChoices} 个；合并 ${summary.duplicateGroups} 组，去掉 ${summary.hiddenAliases} 个重复入口。`, summary.policy, '', ...mapping.flatMap(group => [`保留 ${title(group.canonicalId)} (${group.canonicalId})`, ...group.aliasIds.map(id => `  合并 ${title(id)} (${id})`), ''])].join('\n');
fs.writeFileSync(path.join(out, '地图视觉去重结果.txt'), text + '\n');
console.log(path.join(out, '地图视觉去重结果.html'));
