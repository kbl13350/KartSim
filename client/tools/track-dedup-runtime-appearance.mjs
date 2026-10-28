#!/usr/bin/env node
// Supplements the structural audit with the game's actual advertisement lookup,
// same-container skydome, and filename-selected weather. Only report files change.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {loadResourceLibrary} from './economy-export/resource-library.mjs';
const option=n=>{const i=process.argv.indexOf(n);return i<0?undefined:process.argv[i+1];};
const original=fileURLToPath(new URL('../../',import.meta.url));
const project=path.resolve(option('--project')??original),out=path.resolve(option('--out')??path.join(original,'output/track-dedup'));
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
function clean(v){if(v===undefined)return undefined;if(v instanceof Uint8Array)return {bytes:Buffer.from(v).toString('base64')};if(ArrayBuffer.isView(v))return [...v];if(Array.isArray(v))return v.map(clean);if(!v||typeof v!=='object')return v;return Object.fromEntries(Object.keys(v).sort().filter(k=>!/Occurrences?$/.test(k)&&v[k]!==undefined&&!(k==='name'&&!('attributes'in v)&&!('value'in v&&Object.keys(v).length===2))).map(k=>[k,clean(v[k])]));}
const hash=v=>sha(JSON.stringify(clean(v))??'undefined');
const write=(n,v,pretty=false)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,pretty?2:0)+'\n');
const {library,formats,manifest}=await loadResourceLibrary(project,'p3553',original);
const {wa}=await import(pathToFileURL(path.join(project,'client/src/generated/library.js')).href);
const all=JSON.parse(fs.readFileSync(path.join(out,'tracks.json'),'utf8'));
if(all.summary.revision!==manifest.revision)throw Error('Resource revision changed since structural audit');
const attr=(n,key)=>n?.attributes.find(a=>a.name===key)?.value;
async function unique(p){const es=library.exactCanonicalCandidates(p);if(es.length!==1||es[0].absenceAuthoritative!==true)throw Error(`${p}: requires one authoritative source`);return es[0].bytes();}
const pplCommon=formats.x1(await unique('etc_/ppl.xml')).root,pplGeneral=formats.s2(await unique('zeta_/cn/ppl/ppl.bml'));
const ingame=pplGeneral.children.find(n=>attr(n,'groupName')==='ingame');
if(pplCommon.name!=='pplCommon'||pplGeneral.name!=='pplGeneral'||ingame?.children.length!==1)throw Error('Unsupported PPL configuration');
const campaign=attr(ingame.children[0],'folderName');if(!campaign)throw Error('No ingame folderName');
function advertisements(metadata){const theme=wa(metadata);const alt=pplCommon.children.find(n=>n.name==='altTheme');let fallback;
  for(const n of alt?.children??[]){const a=attr(n,'orgTheme'),b=attr(n,'altTheme');if(a===theme){fallback=b;break;}if(b===theme&&attr(n,'mirror')==='true'){fallback=a;break;}}
  return [theme,fallback].filter(Boolean).map(t=>({kind:'advertisement',id:`advertisement:${campaign}/${t}`,canonicalPrefix:`zeta_/cn/ppl/ingame/${campaign}/${t}`,mountPath:'zeta_/cn/ppl'})).filter(s=>library.entriesUnderCanonicalPrefix(s.canonicalPrefix).length>0);
}
const identity=[1,0,0,0,0,1,0,0,0,0,1,0];
function local(n){const b=n.transform??[[1,0,0],[0,1,0],[0,0,1]],s=n.scale??[1,1,1],p=n.position??[0,0,0];return b.flatMap((r,i)=>[r[0]*s[0],r[1]*s[1],r[2]*s[2],p[i]]);}
function multiply(a,b){const c=[];for(let r=0;r<3;r++){for(let j=0;j<3;j++)c[r*4+j]=a[r*4]*b[j]+a[r*4+1]*b[4+j]+a[r*4+2]*b[8+j];c[r*4+3]=a[r*4]*b[3]+a[r*4+1]*b[7]+a[r*4+2]*b[11]+a[r*4+3];}return c;}
const bytesCache=new Map();async function digest(e){const key=e.containerId+':'+e.virtualPath;if(!bytesCache.has(key)){const b=await e.bytes();bytesCache.set(key,{sha256:sha(b),size:b.length});}return bytesCache.get(key);}
async function appearance(roots,resourcePath,metadata,ads){
  const meshes=[],textures=new Map();
  for(const root of roots){const transforms=new Map(),controls=new Map();
    function walk(n,parent=identity,chain=[]){const w=multiply(parent,local(n));transforms.set(n,w);const own={controllers:n.slots?.slice(0,3),orientationMode:n.orientationMode,className:n.className==='ReBillboard'?n.className:undefined};const next=[...chain,clean(own)];controls.set(n,next);for(const c of n.children??[])walk(c,w,next);}walk(root);
    for(const c of formats.hB(root).candidates){const texture=c.state.texture.value,name=texture.name,r=formats.sn(library,resourcePath,metadata,texture,ads);let content;
      if(r.status==='found'){const e=r.entry,b=await digest(e);const isAdvertisement=ads.some(a=>(e.canonicalPath??'').startsWith(a.canonicalPrefix+'/'));content={status:'found',sha256:b.sha256};textures.set(name+':'+e.virtualPath,{name,status:'found',path:e.virtualPath,canonicalPath:e.canonicalPath,sourceName:e.sourceName,advertisement:isAdvertisement,...b});}
      else{content={status:r.status,name,reason:r.reason};textures.set(name+':'+r.status,content);}
      const state=Object.fromEntries(Object.entries(c.state).map(([k,v])=>[k,clean(v.value)]));state.texture={...state.texture,content};const n=c.node;
      meshes.push(hash({transform:transforms.get(n),controllers:controls.get(n),vertices:n.vertexData??n.rigidGeometry,state,sortDepthBias:n.sortDepthBias,additionalProperty:n.additionalProperty,cullingTraversalMode:n.cullingTraversalMode,bounds0:n.bounds0,bounds1:n.bounds1,serializedBoundsOverride:n.serializedBoundsOverride}));
    }
  }
  return {fingerprint:hash(meshes.sort()),textures:[...textures.values()].sort((a,b)=>String(a.name).localeCompare(String(b.name)))};
}
function weather(config,filename){const stem=filename.replace(/\.1s$/i,'').replace(/_rvs$/,'');const value={rainEnabled:false,rainOnStart:false,snowEnabled:stem==='track_xmas'||stem==='track_xmas_rvs'};if(!config)return value;
  const rows=config.children.filter(n=>attr(n,'filename')===stem);if(rows.length>1)throw Error('ambiguous weather track config');const t=rows[0];if(!t)return value;
  const exactBool=(n,k)=>{const v=attr(n,k);if(v===undefined||v==='false')return false;if(v==='true')return true;throw Error(`invalid boolean ${k}=${v}`);};
  const rain=t.children.filter(n=>n.name==='rainEffect'),light=t.children.filter(n=>n.name==='LightningEffect');if(rain.length>1||light.length>1)throw Error('duplicate weather node');value.rainEnabled=rain.length>0&&exactBool(rain[0],'enable');value.rainOnStart=value.rainEnabled&&exactBool(rain[0],'onStart');if(light.length){value.lightningSound=light[0].text;value.rainVolume=Math.fround(Number(attr(light[0],'rainVolume')??.2));}return value;
}
let n=0,adMaps=0,adRefs=0,missing=0;
for(const row of all.maps){const d=JSON.parse(fs.readFileSync(path.join(out,row.report),'utf8'));if(d.errors.length)continue;
  const metadata=await library.trackMetadata(row.id),ads=advertisements(metadata),model=formats.y9(await library.get(row.path).bytes());
  const roots=[model.root.scene,...model.root.trackObjects.flatMap(o=>o.object?.kind==='node'?[o.object]:[])];
  const main=await appearance(roots,row.path,metadata,ads);d.appearanceFingerprint=hash({meshes:main.fingerprint,settings:model.settings});d.appearanceVersion=2;d.advertisementSources=ads;d.textures=main.textures;
  d.textureProblems=main.textures.filter(t=>!['found','none'].includes(t.status));d.textureContentFingerprint=hash(main.textures.map(t=>({status:t.status,sha256:t.sha256,missing:t.status==='found'?undefined:t.name})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
  const ad=main.textures.filter(t=>t.advertisement);d.dynamicAdvertisementBindings=ad.length;if(ad.length){adMaps++;adRefs+=ad.length;}
  d.weather=weather(d.config,path.basename(row.path));d.weatherFingerprint=hash(d.weather);
  const sky=library.findSibling(row.path,['skydome.1s']);d.sky=null;
  if(sky){const bytes=await sky.bytes(),parsed=formats.y9(bytes),root=parsed.root.kind==='track'?parsed.root.scene:parsed.root;const visual=await appearance([root],sky.virtualPath,metadata,ads);d.sky={path:sky.virtualPath,modelSha256:sha(bytes),appearanceFingerprint:visual.fingerprint,textures:visual.textures};}
  d.skyFingerprint=hash(d.sky?{modelSha256:d.sky.modelSha256,appearanceFingerprint:d.sky.appearanceFingerprint}:null);
  write(row.report,d);
  for(const k of ['appearanceFingerprint','appearanceVersion','textureContentFingerprint','textureProblems','textures','dynamicAdvertisementBindings','weather','weatherFingerprint','skyFingerprint'])row[k]=d[k];
  row.sky=d.sky?{path:d.sky.path,modelSha256:d.sky.modelSha256,appearanceFingerprint:d.sky.appearanceFingerprint}:null;
  if(d.textureProblems.length)missing++;if(++n%40===0)console.log(`runtime appearance ${n}/${all.maps.length}`);
}
all.summary.uniqueTextureFilesRead=bytesCache.size;all.summary.textureProblems=missing;all.summary.unresolvedTextureReferences=all.maps.reduce((n,m)=>n+(m.textureProblems?.length??0),0);all.summary.dynamicAdvertisementMaps=adMaps;all.summary.dynamicAdvertisementTextureBindings=adRefs;all.summary.runtimeAppearanceVersion=2;
all.method.appearance='Runtime version 2: actual hB inherited states, full vertex channels, transforms and inherited controllers; sn receives the same current PPL ingame campaign/theme/altTheme sources as native Ln0. Main-scene/nested-object appearance hash independent from same-container sky hash. Weather uses the exact filename-selected native track config rules. Visible capture remains decisive.';
all.method.textureProblems='Remaining unresolved references are measured across decoded main/nested render candidates; hidden or non-admitted nodes may not be visible. These counts are not automatically visual defects or a reason to keep duplicate choices.';
all.method.dynamicAdvertisements='ad_* slots missing from map/theme alone are resolved using the native advertisement sources, recorded separately, and not treated as runtime missing.';
write('tracks.json',all,true);write('summary.json',all.summary,true);write('runtime-appearance-summary.json',{revision:manifest.revision,maps:n,dynamicAdvertisementMaps:adMaps,dynamicAdvertisementTextureBindings:adRefs,remainingTextureProblemMaps:missing,campaign},true);console.log(JSON.stringify(all.summary));
