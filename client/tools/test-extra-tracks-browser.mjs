// Real browser map assembly, WebGL rendering and AL driving smoke test.
// PLAYWRIGHT_MODULE can point to an existing Playwright installation.
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const output=new URL('../../output/extra-tracks/',import.meta.url);mkdirSync(output,{recursive:true});
let browser,page;
async function open(){
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,
  args:['--enable-webgl','--ignore-gpu-blocklist','--js-flags=--max-old-space-size=4096']});
 page=await browser.newPage();page.on('pageerror',error=>console.log('PAGEERROR',error.message));
 await page.goto(`${process.env.TEST_ORIGIN??'http://localhost:8780'}/tests/browser/extra-tracks.html`);
 await page.waitForFunction(()=>window.ready,null,{timeout:120000});
}
await open();
const ids=process.argv.slice(2).length?process.argv.slice(2):await page.evaluate(()=>window.trackChoices.map(t=>t.id));
const rows=[];
try{
 for(const id of ids){
  console.log('START',id);let timer;
  try{
   const row=await Promise.race([page.evaluate(id=>window.testTrack(id),id),new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(Error('browser map load/drive exceeded 60 seconds')),60000);
   })]);rows.push(row);console.log(row.pass?'PASS':'FAIL',id,row.error??`${row.moved.toFixed(1)}m, ${row.groundedFrames} grounded frames`);
  }catch(error){rows.push({id,pass:false,error:error.message});console.log('FAIL',id,error.message);await browser.close();await open();}
  finally{clearTimeout(timer);}
  writeFileSync(new URL('browser.json',output),JSON.stringify(rows,null,2));
 }
 await page.screenshot({path:fileURLToPath(new URL('last-map.png',output))});
}finally{await browser.close();}
console.log(`${rows.filter(row=>row.pass).length}/${rows.length} passed`);
process.exitCode=rows.every(row=>row.pass)?0:1;
