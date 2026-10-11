import { readFile } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const sourceRoot=resolve(process.argv[2]??'');
if(!process.argv[2]) throw new Error('Pass the original source checkout/snapshot');
const project=resolve(dirname(new URL(import.meta.url).pathname),'..');
const seed=JSON.parse(await readFile(resolve(project,'seed/wada-competition.json'),'utf8'));
const manifest=JSON.parse(await readFile(resolve(project,'seed/wada-source-manifest.json'),'utf8'));
const files=new Map(), covered=new Set();
function leaves(value,path='') {
  if(value!==null&&typeof value==='object')return Object.entries(value).flatMap(([k,v])=>leaves(v,`${path}/${k}`));
  return [path];
}
function at(obj,path) {return path.split('/').filter(Boolean).reduce((o,k)=>o[k],obj);}
for(const entry of manifest.files){
 const raw=await readFile(resolve(sourceRoot,'src/content',entry.file));
 assert.equal(createHash('sha256').update(raw).digest('hex'),entry.sha256,`Source changed: ${entry.file}`);
 files.set(entry.file,JSON.parse(raw));
}
const stripRef=value=>Array.isArray(value)?value.map(stripRef):value.split(':').slice(2).join(':');
const paragraphText=value=>value.map(b=>b.children.map(c=>c.text).join(''));
for(const p of manifest.entries){
 const d=seed.content[p.collection].find(e=>e.slug===p.slug).data;
 const root=files.get(p.file),original=at(root,p.pointer);
 const compare=(key,target=key,convert=v=>v,base=p.pointer)=>{
  const path=`${base}/${key}`,expected=at(root,path);
  if(expected===undefined)return;
  assert.deepEqual(convert(d[target]),expected,`${p.collection}/${p.slug}.${target} differs from ${p.file}${path}`);
  for(const leaf of leaves(expected,path))covered.add(`${p.file}${leaf}`);
 };
 const fields=names=>names.forEach(k=>compare(k));
 const reference=(key,target=key,base=p.pointer)=>compare(key,target,stripRef,base);
 const rows=(key,target=key,sub='text')=>compare(key,target,v=>v.map(r=>r[sub]));
 switch(p.collection){
 case 'divisions':fields(['name','short']);compare('order','display_order');compare('gamesPerMatch','games_per_match');compare('championShield','champion_shield');compare('premierShield','premier_shield');break;
 case 'seasons':fields(['name','start','end','events']);compare('status','season_status');compare('totalRounds','total_rounds');break;
 case 'season_divisions':reference('division');reference('teams');break;
 case 'league_settings':reference('currentSeason','current_season');compare('pointsForWin','points_for_win');compare('pointsForDraw','points_for_draw');compare('minGamesForAverage','min_games_for_average');fields(['established']);break;
 case 'fixtures':reference('season','season','');reference('division','division','');reference('home');reference('away');compare('round','round',v=>v,p.pointer.split('/matches/')[0]);compare('date','date',v=>v,p.pointer.split('/matches/')[0]);break;
 case 'results':reference('season','season','');compare('round','round',v=>v,'');compare('date','date',v=>v,'');reference('division','division',p.pointer.split('/matches/')[0]);reference('home');reference('away');compare('homeScore','home_score');compare('awayScore','away_score');fields(['forfeit','note']);break;
 case 'ladders':reference('season','season','');compare('round','round',v=>v,'');compare('source','source',v=>v,'');reference('division');break;
 case 'ladder_rows':reference('team');fields(['played','won','points']);compare('legsFor','legs_for');compare('legsAgainst','legs_against');break;
 case 'stats':reference('season','season','');reference('division','division','');compare('round','round',v=>v,'');reference('team');fields(['name','games','score','darts']);compare('reg','registration');compare('highOut','high_out');compare('tons180','tons_180');compare('annual180','annual_180');compare('lifetime180','lifetime_180');break;
 case 'honours':fields(['title','note']);compare('order','display_order');break;
 case 'honour_awards':fields(['division','shield','winner','second']);rows('roster','roster','name');break;
 case 'competitions':fields(['name','summary']);compare('order','display_order');compare('introTitle','intro_title');compare('intro','intro',paragraphText);reference('memorial');break;
 case 'competition_events':fields(['year','title','date','venue','players','cancelled','highlights']);compare('dateNote','date_note');compare('report','report',paragraphText);rows('notes');break;
 case 'competition_results':fields(['label','winner','score']);rows('runnersUp','runners_up','name');rows('details');break;
 case 'competition_teams':fields(['name','label']);rows('players','players','name');break;
 case 'competition_photos':fields(['alt','caption','kind']);compare('src','source_path',v=>relative(resolve(sourceRoot,'src/content',dirname(p.file)),resolve(sourceRoot,v)));break;
 case 'association_records':fields(['title']);compare('asAt','as_at');rows('topAllTime','top_all_time','name');break;
 case 'checkouts':fields(['note','verified','rows']);break;
 default:throw new Error(`Missing source verification for ${p.collection}`);
 }
}
// The remaining site settings were imported in stage one and may now be edited by the administrator.
const previousSettings=new Set(['name','shortName','email','facebook','homeGround','resultsDue','eligibilityNotice']);
for(const [file,d] of files)for(const path of leaves(d)){
 if(file==='settings/site.json'&&previousSettings.has(path.split('/')[1]))continue;
 assert.ok(covered.has(`${file}${path}`),`Source value not verified: ${file}${path}`);
}
for(const asset of manifest.assets){
 const raw=await readFile(resolve(project,asset.local));
 assert.equal(createHash('sha256').update(raw).digest('hex'),asset.sha256,`Asset mismatch ${asset.local}`);
}
const stats=seed.content.stats;
assert.ok(stats.filter(e=>e.data.registration==='OCC').length>1,'OCC snapshots must remain independent');
const forfeits=seed.content.results.filter(e=>e.data.forfeit);
assert.equal(forfeits.length,1);assert.equal(forfeits[0].data.forfeit,'away');assert.equal(forfeits[0].data.home_score,0);assert.equal(forfeits[0].data.away_score,0);
assert.equal(seed.content.checkouts[0].data.verified,false);
console.log(`Verified ${covered.size} original source values, ${manifest.entries.length} new records and ${manifest.assets.length} preserved image files.`);
