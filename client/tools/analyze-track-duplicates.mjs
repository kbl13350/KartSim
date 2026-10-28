#!/usr/bin/env node
// Read-only. Run with --project CODE_CHECKOUT --mirror RESOURCE_CHECKOUT --out OUTPUT.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadResourceLibrary } from './economy-export/resource-library.mjs';
const option=n=>{const i=process.argv.indexOf(n);return i<0?undefined:process.argv[i+1];};
const original=fileURLToPath(new URL('../../',import.meta.url));
const project=path.resolve(option('--project')??original),mirror=path.resolve(option('--mirror')??original),out=path.resolve(option('--out')??path.join(original,'output/track-dedup'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function canonical(v,dropNames=false){
  if(v===undefined)return undefined;
  if(typeof v==='number')return Number.isFinite(v)?(Object.is(v,-0)?0:v):String(v);
  if(v instanceof Uint8Array)return {bytes:Buffer.from(v).toString('base64')};
  if(ArrayBuffer.isView(v))return Array.from(v);
  if(Array.isArray(v))return v.map(x=>canonical(x,dropNames));
  if(!v||typeof v!=='object')return v;
  return Object.fromEntries(Object.keys(v).sort().filter(k=>!/Occurrences?$/.test(k)&&v[k]!==undefined&&!(dropNames&&k==='name'&&!('attributes'in v)&&!('value'in v&&Object.keys(v).length===2))).map(k=>[k,canonical(v[k],dropNames)]));
}
const hash=(v,drop=false)=>sha(JSON.stringify(canonical(v,drop))??'undefined');
function write(name,v,compact=false){const p=path.join(out,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,compact?0:2)+'\n');}
const identity=[1,0,0,0,0,1,0,0,0,0,1,0];
function localMatrix(n){const b=n.transform??n.basis??[[1,0,0],[0,1,0],[0,0,1]],s=n.scale??[1,1,1],p=n.position??[0,0,0];return b.flatMap((r,i)=>[r[0]*s[0],r[1]*s[1],r[2]*s[2],p[i]]);}
function multiply(a,b){const c=[];for(let r=0;r<3;r++){for(let j=0;j<3;j++)c[r*4+j]=a[r*4]*b[j]+a[r*4+1]*b[4+j]+a[r*4+2]*b[8+j];c[r*4+3]=a[r*4]*b[3]+a[r*4+1]*b[7]+a[r*4+2]*b[11]+a[r*4+3];}return c;}
const point=(m,p)=>[0,1,2].map(i=>m[i*4]*p[0]+m[i*4+1]*p[1]+m[i*4+2]*p[2]+m[i*4+3]);
function indices(n){if(n.rigidGeometry)return n.rigidGeometry.faces.flatMap(f=>f.positionIndices);const r=n.vertexData?.indices??[];if(n.className!=='ReTriStrip')return r;const a=[];for(let i=2;i<r.length;i++){const t=i%2?[r[i-1],r[i-2],r[i]]:[r[i-2],r[i-1],r[i]];if(new Set(t).size===3)a.push(...t);}return a;}
function triangleKey(p){const v=p.map(x=>JSON.stringify(x));return [v.join('|'),[v[1],v[2],v[0]].join('|'),[v[2],v[0],v[1]].join('|')].sort()[0];}
function sceneContent(root,formats){
  const transforms=new Map(),controls=new Map();
  function walk(n,parent=identity,ancestors=[]){const world=multiply(parent,localMatrix(n));transforms.set(n,world);const current=n.slots?.slice(0,3).map(v=>canonical(v,true))??[];const chain=[...ancestors,...(current.some(Boolean)?[current]:[])];controls.set(n,chain);for(const c of n.children??[])walk(c,world,chain);}
  walk(root);const inspection=formats.hB(root),triangles=[],meshes=[];
  for(const candidate of inspection.candidates){
    const n=candidate.node,verts=n.vertexData?.positions??n.rigidGeometry?.positions??[],idx=indices(n),world=transforms.get(n),vertices=verts.map(p=>point(world,p)),shape=[];
    for(let i=0;i+2<idx.length;i+=3){const p=idx.slice(i,i+3).map(j=>vertices[j]);if(p.some(v=>!v))throw Error('geometry index out of range');shape.push(triangleKey(p));}
    shape.sort();for(const t of shape)triangles.push(t);
    meshes.push({geometryHash:sha(shape.join('\n')),transform:world,controllers:controls.get(n),candidate,
      vertexHash:hash(n.vertexData??n.rigidGeometry,true),properties:canonical({additionalProperty:n.additionalProperty,sortDepthBias:n.sortDepthBias,orientationMode:n.orientationMode,cullingTraversalMode:n.cullingTraversalMode,bounds0:n.bounds0,bounds1:n.bounds1,serializedBoundsOverride:n.serializedBoundsOverride},true)});
  }
  triangles.sort();return {geometryHash:sha(triangles.join('\n')),triangles:triangles.length,meshes,
    animationHash:hash(meshes.map(m=>({geometry:m.geometryHash,controllers:m.controllers})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))),
    omissions:inspection.omitted.map(x=>({name:x.node.name,reason:x.reason})),issues:inspection.candidates.flatMap(c=>c.issues.map(issue=>({node:c.node.name,issue})))};
}
function collisionContent(r){const rows=a=>a.map(t=>canonical({a:t.a,b:t.b,c:t.c,normal:t.normal,auxiliaryDirection:t.auxiliaryDirection,road:t.roadDescriptor?.road})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));return {active:rows(r.collisionTriangles),deferred:rows(r.deferredRoadTriangles??[])};}
function sameGroups(rows,key){const m=new Map();for(const r of rows){const k=key(r);if(!k)continue;const a=m.get(k)??[];a.push(r);m.set(k,a);}return [...m.values()].filter(a=>a.length>1);}
const digestFields=['modelSha256','routeFingerprint','routePathFingerprint','collisionFingerprint','geometryFingerprint','animationFingerprint','appearanceFingerprint','textureContentFingerprint','objectFingerprint','configFingerprint','weatherFingerprint','skyFingerprint','raceRulesFingerprint','backgroundMusicFingerprint'];
function candidates(rows,preliminary=false){
  const groups=[],seen=new Set();
  function append(sets,reason){for(const maps of sets){const key=maps.map(m=>m.id).sort().join('\0');if(seen.has(key))continue;seen.add(key);groups.push({id:`group-${sha(key).slice(0,12)}`,reason,preliminary,needsVisualReview:true,differentFields:digestFields.filter(f=>new Set(maps.map(m=>m[f]??'<unavailable>')).size>1),textureProblemMaps:maps.filter(m=>m.textureProblems?.length).map(m=>m.id),maps:maps.map(m=>({id:m.id,title:m.title,path:m.path,canonicalPath:m.canonicalPath,reverse:m.reverse,theme:m.theme,gameType:m.gameType,...Object.fromEntries(digestFields.filter(f=>m[f]!==undefined).map(f=>[f,m[f]])),textureProblems:m.textureProblems,report:m.report}))});}}
  append(sameGroups(rows,r=>r.modelSha256&&`${r.modelSha256}:${r.routeFingerprint??r.reverse}`),'identical-model');
  if(!preliminary){append(sameGroups(rows,r=>r.routeFingerprint&&r.geometryFingerprint&&`${r.routeFingerprint}:${r.geometryFingerprint}:${r.animationFingerprint}`),'same-geometry-and-route');append(sameGroups(rows,r=>r.routeFingerprint&&r.collisionFingerprint&&`${r.routeFingerprint}:${r.collisionFingerprint}`),'same-route-and-collision');append(sameGroups(rows,r=>r.routePathFingerprint),'same-route-path');}
  return {schemaVersion:1,preliminary,automaticMerge:false,groups};
}
function routePath(route){return {start:route.start,firstSection:route.firstSection,lastSection:route.lastSection,sections:route.sections.map(s=>({frames:s.frames,incoming:s.incoming.map(e=>e.section),outgoing:s.outgoing.map(e=>e.section)}))};}
if(process.argv.includes('--regroup')){
  const document=JSON.parse(fs.readFileSync(path.join(out,'tracks.json'),'utf8'));
  for(const row of document.maps){const d=JSON.parse(fs.readFileSync(path.join(out,row.report),'utf8'));if(d.route){row.routePathFingerprint=d.routePathFingerprint=hash(routePath(d.route));write(row.report,d,true);}}
  const grouped=candidates(document.maps);document.summary.candidateGroups=grouped.groups.length;document.summary.distinctCandidateMaps=new Set(grouped.groups.flatMap(g=>g.maps.map(m=>m.id))).size;document.summary.reasons=Object.fromEntries(['identical-model','same-geometry-and-route','same-route-and-collision','same-route-path'].map(r=>[r,grouped.groups.filter(g=>g.reason===r).length]));
  document.method.routePath='Additional near-candidate key retains the exact oriented frame path and topology but excludes gate shapes, surfaces and race UI parameters. Requires visual review.';
  write('tracks.json',document);write('candidates.json',{...grouped,summary:document.summary});write('summary.json',document.summary);
  const rawIds=new Set(JSON.parse(fs.readFileSync(path.join(out,'raw-model-candidates.json'),'utf8')).groups.map(g=>g.id));
  // Review batches are immutable once handed to the visual reviewer. A rerun
  // produces a fresh proposal without changing the order or membership of a
  // batch whose screenshots and decisions may already be in progress.
  const extraName=fs.existsSync(path.join(out,'additional-candidates.json'))?'additional-candidates-latest.json':'additional-candidates.json';
  write(extraName,{...grouped,groups:grouped.groups.filter(g=>!rawIds.has(g.id)),summary:document.summary});console.log(JSON.stringify(document.summary));process.exit(0);
}
fs.mkdirSync(out,{recursive:true});
const {library,formats,manifest}=await loadResourceLibrary(project,'p3553',mirror);
const catalogModule=await import(pathToFileURL(path.join(project,'client/src/resources/track-catalog.ts')).href);
const practice=await import(pathToFileURL(path.join(project,'client/src/resources/practice-scene.ts')).href);
const xmas=await import(pathToFileURL(path.join(project,'client/src/resources/xmas-theme.ts')).href);
const catalog=await (catalogModule.timeAttackTrackCatalogAll?.(library)??library.timeAttackTrackCatalog()),rows=[],textureCache=new Map();
const priorSummary=fs.existsSync(path.join(out,'summary.json'))?JSON.parse(fs.readFileSync(path.join(out,'summary.json'),'utf8')):undefined;
const resumeAllowed=process.argv.includes('--resume')&&priorSummary?.revision===manifest.revision;
async function textureDigest(e){const key=`${e.containerId}:${e.virtualPath}`;if(!textureCache.has(key)){const b=await e.bytes();textureCache.set(key,{sha256:sha(b),size:b.length});}return textureCache.get(key);}
for(const choice of catalog){const runtimePath=xmas.xmasTrackModelPath(library,choice.path,choice.id)??choice.path;const e=library.get(runtimePath),row={...choice,declaredPath:choice.path,path:runtimePath,runtimePath,reverse:choice.reverse===true,canonicalPath:e?.canonicalPath,sourceName:e?.sourceName,errors:[]};try{if(!e)throw Error('Model not mounted');const b=await e.bytes();row.modelSha256=sha(b);row.modelBytes=b.length;}catch(e){row.errors.push(e.message);}rows.push(row);}
write(fs.existsSync(path.join(out,'raw-model-candidates.json'))?'runtime-model-candidates.json':'raw-model-candidates.json',candidates(rows,true));write('model-hashes.json',{revision:manifest.revision,catalogTotal:catalog.length,maps:rows});console.log(`model SHA pass: ${catalog.length} maps; ${candidates(rows,true).groups.length} exact groups`);
let count=0;
for(const row of rows){
  let d={...row,textureProblems:[]};
  const report=`maps/${row.id.replace(/[^a-zA-Z0-9_.-]/g,'_')}.json`;
  const metadata=await library.trackMetadata(row.id);
  const previous=resumeAllowed&&fs.existsSync(path.join(out,report))?JSON.parse(fs.readFileSync(path.join(out,report),'utf8')):undefined;
  if(previous&&previous.modelSha256===row.modelSha256&&hash(previous.metadata)===hash(metadata)&&previous.reverse===row.reverse&&!previous.errors.length)d=previous;
  else try{
    const model=formats.y9(await library.get(row.path).bytes());if(model.root.kind!=='track')throw Error('Not TrackContainer');
    practice.preparePracticeScene(model,row.id);
    const r=formats.YW(model,'time-attack',{forceReverse:row.reverse,consistentUvTangents:true,roadExtent:metadata?.roadExtent,practiceScene:practice.PRACTICE_SCENE_IDS.has(row.id)?row.id:undefined});
    const route=canonical({sections:r.sections,firstSection:r.firstSection,lastSection:r.lastSection,start:r.start},true),collision=collisionContent(r);
    d.metadata=metadata;d.routeFingerprint=hash(route);d.routePathFingerprint=hash(routePath(route));d.collisionFingerprint=hash(collision);d.route={...route,sectionCount:r.sections.length,frameCount:r.sections.reduce((n,s)=>n+s.frames.length,0),length:r.sections.reduce((n,s)=>n+s.length,0)};
    d.collision={activeTriangles:collision.active.length,deferredTriangles:collision.deferred.length,stats:canonical(r.collisionStats),roadIssueCount:r.roadIssues?.length,runtimeIssues:r.runtimeIssues};
    const roots=[model.root.scene,...model.root.trackObjects.flatMap(o=>o.object?.kind==='node'?[o.object]:[])],scenes=roots.map(n=>sceneContent(n,formats));
    d.geometryFingerprint=hash(scenes.map(s=>s.geometryHash).sort());d.animationFingerprint=hash(scenes.map(s=>s.animationHash).sort());d.geometry={roots:scenes.length,meshes:scenes.reduce((n,s)=>n+s.meshes.length,0),triangles:scenes.reduce((n,s)=>n+s.triangles,0),omissions:scenes.flatMap(s=>s.omissions),issues:scenes.flatMap(s=>s.issues)};
    const textures=new Map(),appearances=[];
    for(const scene of scenes)for(const mesh of scene.meshes){const texture=mesh.candidate.state.texture.value,name=texture.name,resolved=formats.sn(library,row.path,metadata,texture);let content;
      if(resolved.status==='found'){const e=resolved.entry,digest=await textureDigest(e);textures.set(`${name}:${e.virtualPath}`,{name,status:'found',path:e.virtualPath,canonicalPath:e.canonicalPath,sourceName:e.sourceName,...digest});content={status:'found',sha256:digest.sha256};}
      else{content={status:resolved.status,name,reason:resolved.reason};textures.set(`${name}:${resolved.status}`,content);if(resolved.status!=='none'&&!d.textureProblems.some(p=>p.name===name))d.textureProblems.push(content);}
      const state=Object.fromEntries(Object.entries(mesh.candidate.state).map(([k,v])=>[k,canonical(v.value,true)]));state.texture={...state.texture,content};appearances.push(hash({geometry:mesh.geometryHash,transform:mesh.transform,controllers:mesh.controllers,vertexHash:mesh.vertexHash,properties:mesh.properties,state}));
    }
    d.textures=[...textures.values()].sort((a,b)=>String(a.name).localeCompare(String(b.name)));d.textureContentFingerprint=hash(d.textures.map(t=>({status:t.status,sha256:t.sha256??null,missing:t.status==='found'?undefined:t.name})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));d.appearanceFingerprint=hash({meshes:appearances.sort(),settings:model.settings});d.settings=canonical(model.settings);
    d.objects=model.root.trackObjects.filter(o=>o.kind!=='ToRoad').map(o=>{const fields=Object.fromEntries(Object.entries(o).filter(([k])=>!['object','name'].includes(k)&&!/Occurrence/.test(k)));return {kind:o.kind,name:o.name,sha256:hash(fields,true),nestedScene:o.object?.kind==='node',fields:canonical(fields,true)};});
    d.objectFingerprint=hash(d.objects.map(o=>({kind:o.kind,sha256:o.sha256})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
    d.config=canonical((await library.loadTrackConfig(row.path)).root??null);d.configFingerprint=hash(d.config);
    const m=metadata??{};d.raceRules={gameType:row.gameType,laps:m.laps,showLapUi:m.showLapUi,crazy:m.crazy,isOnlyItemTrack:m.isOnlyItemTrack,isOnlyRoadBlockTrack:m.isOnlyRoadBlockTrack,isOnlyTraining:m.isOnlyTraining,roadExtent:m.roadExtent};d.raceRulesFingerprint=hash(d.raceRules);d.backgroundMusic={theme:m.bgmTheme??m.theme??row.theme,file:m.bgmFile};d.backgroundMusicFingerprint=hash(d.backgroundMusic);
  }catch(e){d.errors.push(e.stack??String(e));}
  d.report=report;if(d.route)d.routePathFingerprint=hash(routePath(d.route));write(d.report,d,true);
  for(const key of [...digestFields,'metadata','textureProblems','report','errors','geometry','textures'])row[key]=d[key];row.routeSummary=d.route?Object.fromEntries(Object.entries(d.route).filter(([k])=>k!=='sections')):undefined;
  if(++count%20===0){write('progress.json',{complete:count,total:rows.length,last:row.id});console.log(`content ${count}/${rows.length}: ${row.id}`);}
}
const groups=candidates(rows),summary={revision:manifest.revision,catalogTotal:rows.length,analyzed:rows.filter(r=>!r.errors?.length).length,failed:rows.filter(r=>r.errors?.length).map(r=>({id:r.id,errors:r.errors})),candidateGroups:groups.groups.length,distinctCandidateMaps:new Set(groups.groups.flatMap(g=>g.maps.map(m=>m.id))).size,reasons:Object.fromEntries(['identical-model','same-geometry-and-route','same-route-and-collision','same-route-path'].map(reason=>[reason,groups.groups.filter(g=>g.reason===reason).length])),textureProblems:rows.filter(r=>r.textureProblems?.length).length,uniqueTextureFilesRead:textureCache.size};
write('tracks.json',{schemaVersion:1,summary,method:{geometry:'Exact decoded coordinates with cumulative static transforms; no tolerance rounding. Triangle winding retained; cyclic starts and triangle/node ordering ignored. Includes main scene and nested objects. Inherited animation controls fingerprinted independently.',route:'Actual YW graph with forceReverse. Frame directions, gates, surfaces, connectivity and start retained; serializer and gate labels removed.',runtimePath:'Uses the real xmas-theme substitution before hashing. declaredPath retains the unfiltered catalog entry; path/runtimePath are the model actually loaded for that ID.',appearance:'Actual hB effective inherited state, vertex channels, transforms, controls, culling data and sn-resolved texture SHA256; camera/fog settings retained.',objects:'Object labels removed from semantic digest but preserved in per-map reports. XML element and attribute names retained. Effective graph separately resolves course references.',missing:'Unresolved textures explicitly reported. No guessed substitute. Candidate groups require same effective route so opposite directions remain separate.',config:'Actual same-container parsed config; authoritative absence represented as null. Laps and other race rules fingerprinted separately.'},maps:rows});write('candidates.json',{...groups,summary});write('summary.json',summary);console.log(JSON.stringify(summary));if(summary.failed.length)process.exitCode=1;

// This second pass avoids confusing dynamically supplied ad slots with missing
// assets, and includes the separate skydome/weather owners used by the loader.
if(!summary.failed.length&&!process.argv.includes('--structural-only')){
  const supplement=spawnSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./track-dedup-runtime-appearance.mjs',import.meta.url)),'--project',project,'--out',out],{stdio:'inherit'});
  if(supplement.status!==0)process.exit(supplement.status??1);
  const regroup=spawnSync(process.execPath,['--import','tsx',fileURLToPath(import.meta.url),'--out',out,'--regroup'],{stdio:'inherit'});
  if(regroup.status!==0)process.exit(regroup.status??1);
}
