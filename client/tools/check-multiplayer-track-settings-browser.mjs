import { chromium } from '/tmp/kartsim-tw-browser/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const output='/Users/zhangwang/Documents/跑跑卡丁车/KartSim/output/track-settings-validation/multiplayer';
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[],requests=[],writes=[];
page.on('pageerror',e=>errors.push(e.message));
let disabledTrackIds=[];
await page.route('https://track-settings-fixture.invalid/**',async route=>{
 const request=route.request(), url=request.url();
 if(request.method()!=='GET'){writes.push({url,method:request.method()});return route.abort();}
 if(url.endsWith('/api/track-settings')){requests.push(url);return route.fulfill({json:{disabledTrackIds,version:String(requests.length),updatedAt:1},headers:{'Access-Control-Allow-Origin':'*'}});}
 if(url.endsWith('/api/maps'))return route.fulfill({json:{maps:[]},headers:{'Access-Control-Allow-Origin':'*'}});
 return route.abort();
});
const report={errors,requests,writes,modes:{},koreaItemMaps:[]};
const save=()=>fs.writeFileSync(output+'/browser.json',JSON.stringify(report,null,2)+'\n');
try{
 await page.goto('http://127.0.0.1:8786/tests/browser/multiplayer-track-settings-smoke.html');
 await page.waitForFunction(()=>window.ready,null,{timeout:120000});
 for(const [mode,channel] of [['ordinary','speedIndiCombine'],['ordinary-team','speedTeamCombine'],['item','itemIndiCombine'],['item-team','itemTeamCombine'],['rp','speedIndiCombine'],['grip','speedIndiCombine'],['shadow','speedIndiCombine'],['brawl','speedIndiCombine'],['giant','speedIndiCombine'],['roadblock','speedIndiCombine'],['lte','speedIndiCombine'],['brave','speedTeamCombine']]){
  report.modes[mode]=await page.evaluate(([mode,channel])=>window.openLobbyPicker(mode.replace('-team',''),mode.startsWith('item')?'korea_I01':'korea_R01',channel),[mode,channel]);
  if(mode==='ordinary'||mode==='item'){
   report.modes[mode].koreaRows=await page.evaluate(()=>window.pickerTheme('korea'));
   await page.waitForTimeout(500);
   await page.locator('canvas').first().screenshot({path:output+`/korea-${mode}.png`});
  }
  save();
 }
 disabledTrackIds=['korea_R01','korea_R01_old'];
 report.disabledSpeed=await page.evaluate(()=>window.openLobbyPicker('ordinary'));
 report.disabledSpeed.favorites=await page.evaluate(()=>window.pickerTheme('favorite'));
 report.disabledSpeed.koreaRows=await page.evaluate(()=>window.pickerTheme('korea'));
 report.confirmedEnabledTrack=await page.evaluate(()=>window.confirmCurrentPicker());
 disabledTrackIds=['korea_I01'];
 report.disabledItem=await page.evaluate(()=>window.openLobbyPicker('item','korea_I01','itemIndiCombine'));
 report.disabledItem.favorites=await page.evaluate(()=>window.pickerTheme('favorite'));
 disabledTrackIds=[];
 report.restoredItem=await page.evaluate(()=>window.openLobbyPicker('item','korea_I01','itemIndiCombine'));
 disabledTrackIds=await page.evaluate(()=>window.allTrackIds);
 report.allDisabled=await page.evaluate(()=>window.openLobbyPicker('ordinary'));
 disabledTrackIds=[];
 const itemIds=await page.evaluate(()=>window.koreaItems.map(t=>t.id));
 for(const id of itemIds){try{report.koreaItemMaps.push(await page.evaluate(id=>window.loadKoreaItem(id),id));}catch(e){report.koreaItemMaps.push({id,error:e.message});}save();}
 report.pass=errors.length===0&&writes.length===0&&report.modes.ordinary.korea.length===22&&report.modes['ordinary-team'].korea.length===22&&report.modes.item.korea.length===9&&report.modes.grip.korea.length===22&&report.modes.shadow.korea.length===22&&report.modes.brawl.korea.length===0&&report.modes.brawl.unsupportedBrawlIds.length===0&&report.modes.brawl.groups.every(g=>g.id==='speed:all:0')&&report.modes['item-team'].korea.length===9&&report.disabledSpeed.korea.length===21&&report.disabledSpeed.roomTrackId==='korea_R01'&&report.disabledSpeed.selected!=='korea_R01'&&report.disabledSpeed.groups.every(g=>g.trackIds.every(id=>!['korea_R01','korea_R01_old'].includes(id)))&&!report.disabledSpeed.favorites.includes('korea_R01')&&report.disabledItem.korea.length===8&&report.restoredItem.korea.length===9&&!report.allDisabled.opened&&report.allDisabled.statuses.some(s=>s.message.includes('当前没有开放的地图'))&&report.koreaItemMaps.length===9&&report.koreaItemMaps.every(m=>!m.error&&m.cubes>0&&m.itemCatalog&&m.blocks.length===0)&&requests.every(url=>url==='https://track-settings-fixture.invalid/api/track-settings');
}catch(error){report.error=error.message;report.stack=error.stack;report.pass=false;}
finally{save();await browser.close();}
console.log(JSON.stringify({pass:report.pass,errors:report.errors,requests:requests.length,modes:Object.fromEntries(Object.entries(report.modes).map(([k,v])=>[k,{opened:v.opened,count:v.count,korea:v.korea?.length}])),itemMaps:report.koreaItemMaps,error:report.error},null,2));process.exitCode=report.pass?0:1;
