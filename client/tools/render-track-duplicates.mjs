// node tools/render-track-duplicates.mjs [candidates.json] [group-id ...] [--compose-only]
// --compose-only refreshes contact sheets / pixel statistics from the existing report.
// Each map gets a fresh browser page; each group shares exact camera coordinates.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const input=path.resolve(process.argv[2]??path.join(project,'output/track-dedup/candidates.json'));
const document=JSON.parse(fs.readFileSync(input,'utf8'));
const composeOnly=process.argv.includes('--compose-only');
const wanted=new Set(process.argv.slice(3).filter(arg=>arg!=='--compose-only'));
const groups=document.groups.filter(group=>!wanted.size||wanted.has(group.id));
const output=path.resolve(process.env.TRACK_DEDUP_OUTPUT??path.join(project,'output/track-dedup'));
const screenshotRoot=path.join(output,'screenshots');fs.mkdirSync(screenshotRoot,{recursive:true});
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/tmp/kartsim-tw-browser/node_modules/playwright/index.mjs');
const safe=value=>String(value).replace(/[^\w.-]+/g,'_').slice(0,160);
const reportFile=path.join(output,'visual-report.json');
const previous=(process.env.RESUME==='1'||composeOnly)&&fs.existsSync(reportFile)?JSON.parse(fs.readFileSync(reportFile,'utf8')):{groups:[]};
const report=composeOnly?previous:{version:2,candidates:input,createdAt:new Date().toISOString(),capturePolicy:'Native textures/materials/skydome/fog/color pipeline; overview extends fog range only; static clock and seeded randomness; identical group camera plan; screenshots contain only canvas',groups:previous.groups.filter(group=>!groups.some(candidate=>candidate.id===group.id))};
const save=()=>fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
// Cached pixels are valid only with exactly the same map identity and 5 camera views.
const captureCache=new Map();
function cacheCapture(row,sourceReport){
 if(!row.pass||row.loaded?.captureVersion!==2||row.views?.length!==5||row.views.some(view=>!fs.existsSync(view.screenshot)))return;
 const rows=captureCache.get(row.id)??[];
 const plan=JSON.stringify(row.loaded.plan);
 if(!rows.some(entry=>entry.plan===plan))rows.push({row,plan,sourceReport});
 captureCache.set(row.id,rows);
}
for(const sourceReport of JSON.parse(process.env.TRACK_DEDUP_CACHE_REPORTS??'[]')){
 const cached=JSON.parse(fs.readFileSync(sourceReport,'utf8'));
 for(const group of cached.groups??[])for(const row of group.maps??[])cacheCapture(row,sourceReport);
}
let browser,context,stopping=false;
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{
 stopping=true;process.exitCode=signal==='SIGINT'?130:143;void close().catch(()=>{});
});
async function open(){
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,handleSIGINT:false,handleSIGTERM:false,handleSIGHUP:false,args:['--enable-webgl','--ignore-gpu-blocklist','--js-flags=--max-old-space-size=4096']});
 context=await browser.newContext({viewport:{width:960,height:540},deviceScaleFactor:1});
 await context.addInitScript(()=>{
  const NativeDate=Date,fixed=Date.UTC(2026,9,28,0,0,0);
  class ComparisonDate extends NativeDate{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}}
  globalThis.Date=ComparisonDate;let seed=0x4b415254;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 });
}
async function close(){await context?.close();await browser?.close();context=undefined;browser=undefined;}
let processed=0;
if(!composeOnly){
try{
 await open();
 for(const [groupIndex,group] of groups.entries()){
  if(stopping)break;
  const old=previous.groups.find(entry=>entry.id===group.id);
  if(old?.maps.length===group.maps.length&&old.maps.every(row=>row.pass&&row.loaded?.captureVersion===2)&&process.env.RESUME==='1'){report.groups.push(old);save();continue;}
  const result={id:group.id,reason:group.reason,referenceId:group.referenceId??group.maps.find(row=>!row.id.startsWith('tw_'))?.id??group.maps[0]?.id,maps:[]};
  report.groups.push(result);
  const maps=[...group.maps].sort((a,b)=>Number(b.id===result.referenceId)-Number(a.id===result.referenceId));
  let sharedPlan;
  const folder=path.join(screenshotRoot,safe(group.id));fs.mkdirSync(folder,{recursive:true});
  for(const candidate of maps){
   if(stopping)break;
   const row={...candidate,views:[],pass:false};result.maps.push(row);let page;
   const cached=captureCache.get(candidate.id)?.find(entry=>!sharedPlan||entry.plan===JSON.stringify(sharedPlan));
   if(cached){
    sharedPlan??=cached.row.loaded.plan;result.cameraPlan=sharedPlan;
    row.loaded=cached.row.loaded;row.pass=true;row.pageErrors=[];
    row.views=cached.row.views.map(({pixelComparison,...view})=>({...view}));
    row.captureReusedFrom=cached.sourceReport;
    fs.writeFileSync(path.join(folder,'camera-plan.json'),JSON.stringify(sharedPlan,null,2)+'\n');
    console.log('CACHED',group.id,candidate.id);save();continue;
   }
   console.log('START',group.id,candidate.id);
   try{
    page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`${process.env.TEST_ORIGIN??'http://localhost:8785'}/tests/browser/track-dedup.html`);
    await page.waitForFunction(()=>window.ready,null,{timeout:120000});
    let timeout;let loaded;
    try{loaded=await Promise.race([page.evaluate(({candidate,plan})=>window.loadComparisonTrack(candidate,plan),{candidate,plan:sharedPlan}),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('map assembly timeout')),90000);})]);}
    finally{clearTimeout(timeout);}
    if(!sharedPlan){sharedPlan=loaded.plan;result.referenceId=candidate.id;}
    result.cameraPlan=sharedPlan;row.loaded=loaded;
    fs.writeFileSync(path.join(folder,'camera-plan.json'),JSON.stringify(sharedPlan,null,2)+'\n');
    for(const view of sharedPlan.views){
     const rendered=await page.evaluate(key=>window.renderComparisonView(key),view.key);
     const imagePath=path.join(folder,`${safe(candidate.id)}--${view.key}.png`);
     await page.locator('canvas').screenshot({path:imagePath});
     row.views.push({...rendered,screenshot:imagePath});
    }
    row.pageErrors=errors;row.pass=row.views.every(view=>view.nonuniform&&view.triangles>0)&&errors.length===0;
    if(!row.pass)row.error='Blank view, zero rendered triangles, or browser exception; inspect screenshots';
    console.log(row.pass?'PASS':'REVIEW',group.id,candidate.id);
   }catch(error){row.error=error.message;row.stack=error.stack;console.log('FAIL',group.id,candidate.id,error.message);}
   finally{try{await page?.evaluate(()=>window.closeComparison?.());}catch{}await page?.close();save();}
   cacheCapture(row,reportFile);
   if(!stopping&&++processed%8===0){await close();await open();}
  }
  if(groupIndex%10===9)composeSheets();
 }
}finally{await close();save();}
}

// Standard side-by-side raster composition; source captures stay unchanged.
function composeSheets(){
const python=process.env.TRACK_DEDUP_PYTHON??'python3';
const compose=String.raw`
import json,sys,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageChops,ImageStat
report_path=Path(sys.argv[1]); report=json.loads(report_path.read_text()); out=report_path.parent/'contact-sheets'; out.mkdir(exist_ok=True)
font_path='/System/Library/Fonts/Supplemental/Arial Unicode.ttf'
font=ImageFont.truetype(font_path,19); small=ImageFont.truetype(font_path,15)
labels=['统一鸟瞰','路线起点','路线 1/3','路线 2/3','路线尾端']
keys=['overview','start','third','two-thirds','tail']; cw,ch=384,216; gap=8; rowh=260; width=5*cw+6*gap
for group in report['groups']:
 reference=next((row for row in group['maps'] if row['id']==group.get('referenceId')),None)
 if reference:
  refs={view['key']:view for view in reference.get('views',[])}
  for row in group['maps']:
   for view in row.get('views',[]):
    ref=refs.get(view['key'])
    if not ref or not Path(ref['screenshot']).exists() or not Path(view['screenshot']).exists():continue
    left=Image.open(ref['screenshot']).convert('RGB');right=Image.open(view['screenshot']).convert('RGB')
    if left.size!=right.size:continue
    delta=ImageChops.difference(left,right);mean=sum(ImageStat.Stat(delta).mean)/3
    bands=delta.split();maximum=ImageChops.lighter(ImageChops.lighter(bands[0],bands[1]),bands[2]);mask=maximum.point(lambda value:255 if value>8 else 0)
    view['pixelComparison']={'referenceId':reference['id'],'exactEquality':delta.getbbox() is None,'meanAbsoluteDifference':mean,'ratioPixelsChannelDeltaOver8':mask.histogram()[255]/(left.width*left.height)}
   comparisons=[view['pixelComparison'] for view in row.get('views',[]) if 'pixelComparison' in view]
   if comparisons:row['pixelSummary']={'exactAllViews':all(value['exactEquality'] for value in comparisons),'meanAbsoluteDifference':sum(value['meanAbsoluteDifference'] for value in comparisons)/len(comparisons),'maximumChangedPixelRatio':max(value['ratioPixelsChannelDeltaOver8'] for value in comparisons)}
 group['contactSheets']=[]
 for start in range(0,len(group['maps']),6):
  rows=group['maps'][start:start+6]; sheet=Image.new('RGB',(width,88+rowh*len(rows)),(24,32,41)); draw=ImageDraw.Draw(sheet)
  draw.text((gap,8),str(group['id'])+' | '+str(group.get('reason',''))[:170],font=font,fill='white')
  for col,label in enumerate(labels):draw.text((gap+col*(cw+gap),49),label,font=font,fill=(175,203,226))
  for n,row in enumerate(rows):
   top=88+n*rowh; name=str(row['id'])+'  '+str(row.get('title',''));summary=row.get('pixelSummary')
   if summary:name+=f"  | MAD {summary['meanAbsoluteDifference']:.3f} / max Δ>8 {summary['maximumChangedPixelRatio']:.1%}"
   draw.text((gap,top),name[:150],font=font,fill='white')
   for col,key in enumerate(keys):
    x=gap+col*(cw+gap);y=top+32; view=next((v for v in row.get('views',[]) if v['key']==key),None)
    if view and Path(view['screenshot']).exists():
     im=Image.open(view['screenshot']).convert('RGB'); im.thumbnail((cw,ch),Image.Resampling.LANCZOS); sheet.paste(im,(x,y))
    else:draw.rectangle((x,y,x+cw,y+ch),fill=(60,30,34));draw.text((x+8,y+10),'NO CAPTURE',font=font,fill=(255,180,180))
  filename=''.join(c if c.isalnum() or c in '._-' else '_' for c in str(group['id']))[:160]+f'--{start//6+1:02}.png'
  target=out/filename;sheet.save(target);group['contactSheets'].append(str(target))
report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
`;
const composed=spawnSync(python,['-c',compose,reportFile],{encoding:'utf8'});
if(composed.status!==0){console.error('Contact sheet composition failed:',composed.stderr);process.exitCode=1;}
else{report.groups=JSON.parse(fs.readFileSync(reportFile,'utf8')).groups;console.log('CONTACT_SHEETS',report.groups.length,'groups');}
}
composeSheets();
const rows=report.groups.flatMap(group=>group.maps);
console.log(JSON.stringify({groups:report.groups.length,maps:rows.length,passed:rows.filter(row=>row.pass).length,report:reportFile},null,2));
if(rows.some(row=>!row.pass))process.exitCode=1;
