#!/usr/bin/env python3
"""Build an offline searchable gallery from the exported UI icon index."""

import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent / "ui_icon_export"
PAGE_SIZE = 120


def main() -> None:
    with (ROOT / "export_index.csv").open(newline="", encoding="utf-8") as stream:
        rows = [row for row in csv.DictReader(stream) if row["png"]]
    data = [
        {"name": row["asset_path"], "category": row["asset_path"].split("/")[1], "path": row["png"]}
        for row in rows
    ]
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    html = r'''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>跑跑卡丁车 APK UI 图标图库</title>
<style>
:root{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;color:#182436;background:#f5f7fb}
*{box-sizing:border-box}body{margin:0}header{position:sticky;top:0;z-index:2;background:#fff;border-bottom:1px solid #e1e5ed;padding:14px 20px;box-shadow:0 1px 6px #1824360d}
h1{font-size:20px;margin:0 0 12px}.controls{display:flex;gap:10px;flex-wrap:wrap;align-items:center}input,select,button{font:inherit;border:1px solid #cbd3df;border-radius:7px;padding:8px 10px;background:#fff;color:#182436}input{min-width:240px;flex:1}button{cursor:pointer}button:disabled{opacity:.4;cursor:default}#status{color:#56657b;font-size:13px}
main{padding:18px 20px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:12px}.card{min-width:0;background:#fff;border:1px solid #e0e5ee;border-radius:9px;overflow:hidden;text-decoration:none;color:inherit;display:block}.card:hover{border-color:#4495eb;box-shadow:0 3px 12px #18243620}.thumb{height:150px;display:flex;align-items:center;justify-content:center;background:linear-gradient(45deg,#eef1f6 25%,#fff 25%,#fff 75%,#eef1f6 75%) 0 0/20px 20px}.thumb img{max-width:100%;max-height:100%;object-fit:contain}.label{padding:8px 9px;font-size:11px;line-height:1.35;overflow-wrap:anywhere;min-height:45px}.pager{display:flex;justify-content:center;align-items:center;gap:12px;padding:22px}
</style>
</head><body>
<header><h1>跑跑卡丁车 APK UI 图标图库</h1><div class="controls"><input id="search" placeholder="搜索资源名，例如 kart、skill、item"><select id="category"></select><span id="status"></span></div></header>
<main><div id="grid" class="grid"></div><div class="pager"><button id="prev">上一页</button><span id="page"></span><button id="next">下一页</button></div></main>
<script>
const DATA = __DATA__;
const PAGE_SIZE = __PAGE_SIZE__;
const search = document.getElementById('search'), category = document.getElementById('category');
const grid = document.getElementById('grid'), status = document.getElementById('status'), pageLabel = document.getElementById('page');
const prev = document.getElementById('prev'), next = document.getElementById('next');
const counts = new Map(); for (const d of DATA) counts.set(d.category,(counts.get(d.category)||0)+1);
const all = document.createElement('option'); all.value=''; all.textContent=`全部分类 (${DATA.length})`; category.append(all);
for (const [name,count] of [...counts].sort((a,b)=>a[0].localeCompare(b[0]))) {const o=document.createElement('option');o.value=name;o.textContent=`${name} (${count})`;category.append(o)}
let filtered=DATA,page=0;
function render(){
  const q=search.value.trim().toLowerCase(),c=category.value;
  filtered=DATA.filter(d=>(!c||d.category===c)&&(!q||d.name.toLowerCase().includes(q)));
  const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));page=Math.min(page,pages-1);
  grid.replaceChildren();
  for(const d of filtered.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE)){
    const card=document.createElement('a');card.className='card';card.href=encodeURI(d.path);card.target='_blank';card.title=d.name;
    const thumb=document.createElement('div');thumb.className='thumb';const img=document.createElement('img');img.src=encodeURI(d.path);img.loading='lazy';img.alt=d.name;thumb.append(img);
    const label=document.createElement('div');label.className='label';label.textContent=d.name;card.append(thumb,label);grid.append(card);
  }
  status.textContent=`找到 ${filtered.length} 张`;pageLabel.textContent=`第 ${page+1} / ${pages} 页`;prev.disabled=page===0;next.disabled=page>=pages-1;
}
search.addEventListener('input',()=>{page=0;render()});category.addEventListener('change',()=>{page=0;render()});
prev.addEventListener('click',()=>{page--;render();window.scrollTo(0,0)});next.addEventListener('click',()=>{page++;render();window.scrollTo(0,0)});render();
</script></body></html>'''
    html = html.replace("__DATA__", payload).replace("__PAGE_SIZE__", str(PAGE_SIZE))
    output = ROOT / "gallery.html"
    output.write_text(html, encoding="utf-8")
    print(f"Built {output} with {len(data)} icons")


if __name__ == "__main__":
    main()
