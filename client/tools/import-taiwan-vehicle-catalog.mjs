// Rebuild stable TW imports and complete hidden web vehicles from the audit.
// Run from client: node --import tsx tools/import-taiwan-vehicle-catalog.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadResourceLibrary} from './economy-export/resource-library.mjs';
import {parseItemDefinitions} from '../src/resources/item-table.ts';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const audit=path.resolve(project,'../台服资源提取与对比-2026-10-28');
const read=name=>JSON.parse(fs.readFileSync(path.join(audit,name),'utf8'));
const comparison=read('vehicle-comparison.json');
const input=read('tw-vehicle-inputs.json');
const web=read('web-vehicle-catalog.json');
const intSet=new Set(web.definitions.map(x=>x.itemId));
const extra=[
 ['brushV1',1114,'毛筆 V1',8,'V1GenTacho/v1_exceed in param@tw establishes V1; remaining metadata from matching brushX model'],
 ['plasma4RR',70,'等離子 PXT-R 資源版',undefined,'addModelFolder=plasma4 and identical model SHA-256'],
 ['saber12R',422,'黃金尖峰 SR-R',undefined,'addModelFolder=saber12; TW item 422 is 黃金尖峰 SR and model SHA-256 agrees'],
 ['toyota2_king',529,'Toyota King',undefined,'model SHA-256 matches toyota2; no TW table row, donor metadata only'],
 ['toyota2_trd86',529,'Toyota TRD 86',undefined,'model SHA-256 matches toyota2; no TW table row, donor metadata only'],
 ['toyota2_tuned86',529,'Toyota Tuned 86',undefined,'model SHA-256 matches toyota2; no TW table row, donor metadata only'],
];
function effectiveParameter(folder){
 const candidates=input.params.filter(x=>x.path.split('/')[1]?.toLowerCase()===folder.toLowerCase() && /\/param(?:@tw)?\.(bml|xml|kml|eml)$/i.test(x.path));
 candidates.sort((a,b)=>Number(/@tw\./i.test(b.path))-Number(/@tw\./i.test(a.path)) || Number(b.source.endsWith('.rho'))-Number(a.source.endsWith('.rho')) || a.path.localeCompare(b.path));
 if(!candidates.length)throw Error(`No valid TW/base BodyParam: ${folder}`);
 const p=candidates[0];if(p.root!=='BodyParam')throw Error(`${p.path}: ${p.root}`);
 return p;
}
function entry(row,itemId,title,evidence,sourceTwItemId){
 if(intSet.has(itemId)||itemId>65535)throw Error(`ID collision: ${itemId}`);intSet.add(itemId);
 const original=row.internalId,internalId=`tw${itemId}_${original}`;
 const attrs={...row.attributes,id:String(itemId),name:internalId};
 const definition=parseItemDefinitions([{name:'kart',attributes:Object.entries(attrs).map(([name,value])=>({name,value})),children:[]}])[0];
 const parameter=effectiveParameter(original);
 definition.title=title+'（台服）';definition.identityClass='taiwan-vehicle';
 return {source:'taiwan',sourceTwItemId:sourceTwItemId??null,sourceInternalId:original,definition,sourceItemAttributes:row.attributes,sourceParameter:{path:parameter.path,source:parameter.source},body:parameter.attributes,evidence};
}
const rows=[...comparison.missingGarageVehicles,...comparison.missingPaintVariants].sort((a,b)=>a.itemId-b.itemId);
const unnamed={1451:'隱形車 9',1452:'隱形車 V1'};
const vehicles=rows.map(r=>entry(r,50000+r.itemId,r.twOriginalTitle||unnamed[r.itemId]||r.displayName,
 r.twOriginalTitle?'TW ItemTable + @tw + shop title':`TW ItemTable + @tw; descriptive title from ${r.internalId}`,r.itemId));
for(let i=0;i<extra.length;i++){
 const [folder,donor,title,grade,evidence]=extra[i];
 const source=comparison.allTwVehicles.find(r=>r.itemId===donor);if(!source)throw Error(`Missing donor ${donor}`);
 const row={...source,internalId:folder,attributes:{...source.attributes,name:folder,...(grade===undefined?{}:{engineGrade:String(grade)})}};
 vehicles.push(entry(row,51901+i,title,evidence));
}
// Existing complete model folders that the CN item overlay never exposes.
// Two have exact TW metadata; the four without a table row retain a documented
// same-model / same-generation family donor, but their own actual BodyParam.
const hidden=[
 ['Brutus_Z7',375,'陆战舰 Z7 资源版','Z7 folder and cotton7 engine; metadata from the same Brutus Z7 family'],
 ['formula15',517,'方程式 HT 资源版','8soon/8main booster generation; metadata from formula13 HT family'],
 ['lesserpandaHT',625,'小浣熊 HT 资源版','model SHA-256 identical to panda8; metadata from panda8'],
 ['solid4_id',553,'合金 SR 资源版','model SHA-256 identical to solid6_id; metadata from solid6_id'],
 ['taegeukV1',null,'太极 V1','TW ItemTable 1418 identifies the same exact model folder'],
 ['taegeukV1Legend',null,'太极 V1 传奇版','TW ItemTable 1419 identifies the same exact model folder'],
];
const {library,formats}=await loadResourceLibrary(project);
for(let i=0;i<hidden.length;i++){
 const [folder,donorId,title,evidence]=hidden[i]; const itemId=52001+i;
 if(intSet.has(itemId))throw Error(`ID collision: ${itemId}`);intSet.add(itemId);
 const model=library.files.find(f=>(f.canonicalPath??f.virtualPath).toLowerCase()===`kart_/${folder}/model.1s`.toLowerCase());
 if(!model)throw Error(`Hidden model missing: ${folder}`);
 const original=model.canonicalPath.split('/')[1];
 const parameter=(await formats.IR(library,model.virtualPath)).parameter;
 let definition;let sourceItemAttributes={};
 if(donorId===null){
  const row=comparison.allTwVehicles.find(r=>r.internalId.toLowerCase()===folder.toLowerCase());
  if(!row)throw Error(`Hidden metadata missing: ${folder}`);sourceItemAttributes=row.attributes;
  const attrs={...sourceItemAttributes,id:String(itemId),name:original};
  definition=parseItemDefinitions([{name:'kart',attributes:Object.entries(attrs).map(([name,value])=>({name,value})),children:[]}])[0];
 }else{
  const donor=web.karts.find(r=>r.itemId===donorId);if(!donor)throw Error(`Hidden donor missing: ${donorId}`);
  const {path:_path,...metadata}=donor;definition={...metadata,itemId,internalId:original};
 }
 definition.title=title;definition.identityClass='restored-vehicle';
 vehicles.push({source:'web-existing',sourceTwItemId:null,sourceInternalId:original,definition,sourceItemAttributes,
  sourceParameter:{path:parameter.entry.canonicalPath,source:parameter.entry.sourceName},
  body:Object.fromEntries(parameter.value.body.attributes.map(a=>[a.name,a.value])),evidence});
}
const document={version:1,source:'KartRider_TW extraction and existing p3553 resources, 2026-10-28',idPolicy:'50000 + TW item ID; 51901..51906 for unregistered TW folders; 52001..52006 for complete hidden web folders',parameterPolicy:'TW BodyParam if present, otherwise base; TW imports have isolated flattened folders; existing web entries retain their actual current parameters',vehicles};
const target=path.resolve(project,'client/src/resources/taiwan-vehicles.json');
fs.writeFileSync(target,JSON.stringify(document,null,2)+'\n');
console.log(`Wrote ${vehicles.filter(v=>v.source==='taiwan').length} TW and ${vehicles.filter(v=>v.source==='web-existing').length} existing web identities to ${target}`);
