// Complete browser assembly checks over the imported TW catalogs.
// TEST_ORIGIN=http://localhost:8785 PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs
// node tools/test-taiwan-content-browser.mjs vehicles|maps [IDs...]
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const mode=process.argv[2]??'vehicles';
if(!['vehicles','maps'].includes(mode))throw Error('Expected vehicles or maps');
const data=JSON.parse(readFileSync(new URL(mode==='maps'?'../src/resources/taiwan-tracks.json':'../src/resources/taiwan-vehicles.json',import.meta.url),'utf8'));
let ids=process.argv.slice(3).length?process.argv.slice(3).map(id=>mode==='maps'?id:Number(id))
 :mode==='maps'?data.tracks.map(t=>t.id):data.vehicles.map(v=>v.definition.itemId);
const output=new URL('../../output/taiwan-import/',import.meta.url);mkdirSync(output,{recursive:true});
const report=new URL(`browser-${mode}.json`,output);
const previous=process.env.RESUME_FAILED==='1'&&existsSync(report)?JSON.parse(readFileSync(report,'utf8')):[];
const rowId=row=>mode==='maps'?row.id:row.itemId??row.id;
if(previous.length)ids=ids.filter(id=>!previous.some(row=>rowId(row)===id&&row.pass));
let browser,page;
async function open(){
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,
  args:['--enable-webgl','--ignore-gpu-blocklist','--js-flags=--max-old-space-size=4096']});
 page=await browser.newPage();page.on('pageerror',error=>console.log('PAGEERROR',error.message));
 await page.goto(`${process.env.TEST_ORIGIN??'http://localhost:8780'}/tests/browser/${mode==='maps'?'extra-tracks':'taiwan-vehicles'}.html`);
 await page.waitForFunction(()=>window.ready,null,{timeout:120000});
}
const rows=previous.filter(row=>!ids.includes(rowId(row)));
try{
 await open();
 for(const [index,id] of ids.entries()){
  let timer;
  try{
   const row=await Promise.race([page.evaluate(({mode,id})=>mode==='maps'?window.testTrack(id):window.testVehicle(id),{mode,id}),new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(Error('Browser assembly exceeded 60 seconds')),60000);
   })]);rows.push(row);console.log(row.pass?'PASS':'FAIL',id,row.error??`${row.title??''} ${row.triangles??row.groundedFrames}`);
  }catch(error){rows.push({id,pass:false,error:error.message});console.log('FAIL',id,error.message);await browser.close();await open();}
  finally{clearTimeout(timer);}
  writeFileSync(report,JSON.stringify(rows,null,2));
  if(index===ids.length-1||index===0)await page.screenshot({path:fileURLToPath(new URL(`${mode}-${index===0?'first':'last'}.png`,output))});
  // Free decoded archive/model caches periodically during the full catalog run.
  if(index%24===23&&index+1<ids.length){await browser.close();await open();}
 }
}finally{await browser?.close();}
console.log(`${rows.filter(row=>row.pass).length}/${rows.length} passed`);
process.exitCode=rows.every(row=>row.pass)?0:1;
