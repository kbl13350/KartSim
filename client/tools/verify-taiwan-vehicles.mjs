import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {loadResourceLibrary} from './economy-export/resource-library.mjs';
import {taiwanVehicles} from '../src/resources/taiwan-vehicles.ts';
import {VehicleSpecCatalog} from '../src/physics/catalog.ts';
import {ModelBinaryCursor} from '../src/resources/model-binary-cursor.ts';
import {ModelObjectReader} from '../src/resources/model-object-reader.ts';
import {createModelRecordDecoders} from '../src/resources/model-record-decoders.ts';
import {defaultLocalProfile,selectLocalKart,saveLocalProfile,loadLocalProfile} from '../src/ui/local-profile.ts';
import {resolveStartupSelection} from '../src/app/boot-support.ts';
import {translateItemName} from '../src/i18n/item-names.ts';
import {normalizeLegacyTachometerLayout} from '../src/vehicle/tachometer-legacy-layout.ts';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const {library,formats}=await loadResourceLibrary(project);
const {xa,E20,GI,p5}=await import('../src/generated/library.js');
const {cv}=await import('../src/generated/vehicle.js');
const catalog=await library.timeAttackGarageCatalog();
const physics=new VehicleSpecCatalog(new Map(),new Map());
const titles=await library.vehicleTitles();
const profileDependencies={normalizeGarage:E20,validateGarage:GI,garageKart:p5,systemKarts:formats.Cr,resolveVariant:formats.xw};
const profileStorage=new Map();
const storage={getItem:key=>profileStorage.get(key)??null,setItem:(key,value)=>profileStorage.set(key,value)};
const existingOnly=process.argv.includes('--existing-only');
const requested=existingOnly?taiwanVehicles.filter(v=>v.source==='web-existing'):taiwanVehicles;
const rows=[];
const checkedTachometers=new Set();
for(const source of requested){
 const {definition:d}=source;
 try{
  const kart=catalog.karts.find(k=>k.itemId===d.itemId);assert.ok(kart,`${d.itemId} absent from garage`);
  assert.equal(kart.internalId,d.internalId);assert.equal(kart.textureKey,d.textureKey);
  assert.equal(kart.title,translateItemName(d.title));
  const title=titles.get(d.internalId.toLowerCase());assert.equal(title.title,kart.title);assert.equal(title.itemId,String(d.itemId));assert.equal(title.ambiguous,false);
  const profile=selectLocalKart(defaultLocalProfile(),d.itemId,2,undefined,undefined,profileDependencies);
  saveLocalProfile(profile,storage,profileDependencies);
  const saved=loadLocalProfile(storage,profileDependencies);assert.equal(saved.equipment.itemIds[3],d.itemId);
  const startup=resolveStartupSelection(catalog,[{path:'validation-track'}],saved,{defaultProfile:defaultLocalProfile,resolveSystemKart:()=>undefined,isSpecialKartId:formats.n3,displayKartName:String,startTrack:{mapPath:'validation-track',trackId:'validation-track'}});
  assert.equal(startup.selection.vehicleItemId,d.itemId);assert.equal(startup.selection.vehiclePath,kart.path);assert.equal(startup.vehicleTitle,kart.title);
  const identity=await library.timeAttackKartItem(d.itemId,kart.path);assert.equal(identity.engineGrade,d.engineGrade);
  assert.equal(await library.vehicleItemId(kart.path),d.itemId);
  assert.equal(await library.vehicleTextureKey(kart.path),d.textureKey);
  const resources=await formats.IR(library,kart.path);
  const model=xa(await resources.find(['model.1s']).bytes());assert.equal(model.root.value.className,'ReKart');
  const frames=formats.yw(resources,library);
  for(const frame of frames){if(!frame)continue;const cursor=new ModelBinaryCursor(await frame.bytes());const parsed=new ModelObjectReader(createModelRecordDecoders(formats.L6)).readObject(cursor);assert.equal(parsed.value.className,'KartSequence');assert.equal(cursor.remaining,0);}
  const appearance=await formats.vw(library,resources,d.textureKey,d.fixedPlateId,0,0);
  assert.ok(appearance.width>0&&appearance.height>0);
  const visual=cv(resources.parameter.value);assert.equal(typeof visual.engineSound,'string');
  const spec=physics.lookup(d.itemId,7).spec;assert.ok(spec.forwardAccel>0);
  // Every vehicle's live parsed parameters must match the audited source used
  // for physics; model-provider flattening is not a physics adjustment.
  const live=Object.fromEntries(resources.parameter.value.body.attributes.map(x=>[x.name,x.value]));
  if(visual.tachometerType==='Tacho1'&&visual.tachometerName&&!checkedTachometers.has(visual.tachometerName)){
   const folder=`gui_/tachometer/${visual.tachometerName}`;
   const sources=library.exactCanonicalCandidates(`${folder}/tacho.bml`);assert.equal(sources.length,1);
   const root=normalizeLegacyTachometerLayout(formats.s2(await sources[0].bytes()),'Tacho1');
   const nodes=[];const walk=node=>{nodes.push(node);node.children.forEach(walk)};walk(root);
   const textures=new Map();
   for(const name of new Set(nodes.map(node=>formats.T(node,'texture')).filter(Boolean))){
    const entry=library.canonicalCandidates(`${folder}/${name}.png`)[0]??(name==='aw_02@zz'?library.canonicalCandidates('stage_/common/aw_02@zz.png')[0]:undefined);
    assert.ok(entry,`${folder}/${name}.png`);textures.set(name,await formats.p2(await entry.bytes()));
   }
   for(const node of nodes.filter(node=>node.name==='Graduation'))formats.WB(node,textures.get(formats.T(node,'texture')));
   const tree=formats.d5(root,textures);
   const commands=formats.dn(tree,800,600,{text:node=>formats.T(node,'name')==='kmh'?'300':formats.T(node,'text')});
   formats.dt(commands,textures);
   checkedTachometers.add(visual.tachometerName);
  }
  for(const [key,value] of Object.entries(source.body)){
   if(key==='addModelFolder')continue;
   // Dashboard folders are isolated during import; numeric/physics fields
   // retain their audited source values. NineTacho's renderer requires "nine".
   const importedValue=source.source==='taiwan'&&key==='TachometerName'&&value&&source.body.TachometerType!=='NineTacho'?`tw_${value}`:value;
   assert.equal(live[key],importedValue,`${d.itemId} live ${key}`);
  }
  let linkedCharacter;
  if(d.linkCharacterId){
   linkedCharacter=await library.timeAttackLinkedCharacterItem(d.linkCharacterId);
   const matches=library.exactCanonicalCandidates(linkedCharacter.path);assert.equal(matches.length,1);
   const characterModel=xa(await matches[0].bytes());assert.ok(characterModel.meshCount>0);
   linkedCharacter={...linkedCharacter,modelMeshes:characterModel.meshCount};
  }
  rows.push({itemId:d.itemId,internalId:d.internalId,title:d.title,source:source.source,modelNodes:model.nodeCount,modelMeshes:model.meshCount,animationFrames:frames.filter(Boolean).length,texture:[appearance.width,appearance.height],profileRoundTrip:true,linkedCharacter,status:'ok'});
 }catch(error){rows.push({itemId:d.itemId,internalId:d.internalId,title:d.title,status:'error',error:String(error)});}
}
const errors=rows.filter(r=>r.status==='error');
const target=path.join(project,`output/${existingOnly?'existing-hidden':'taiwan'}-vehicle-validation.json`);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify({total:rows.length,passed:rows.length-errors.length,errors:errors.length,tachometerLayouts:[...checkedTachometers],rows},null,2)+'\n');
console.log(JSON.stringify({total:rows.length,passed:rows.length-errors.length,errors:errors.length,details:errors,report:target},null,2));
if(errors.length)process.exitCode=1;
