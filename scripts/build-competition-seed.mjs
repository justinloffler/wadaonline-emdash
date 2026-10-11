import { readFile, readdir, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve, relative, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { competitionCollections } from './competition-schema.mjs';
import { derivePlayers, playerRelation } from './player-model.mjs';

const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/build-competition-seed.mjs /path/to/original-wada');
const project = resolve(dirname(new URL(import.meta.url).pathname), '..');
const sourceRoot = resolve(source);
const root = resolve(sourceRoot, 'src/content');
const directory = JSON.parse(await readFile(resolve(project, 'seed/wada.json'), 'utf8'));
const content = Object.fromEntries(competitionCollections.map(c => [c.slug, []]));
const provenance = { sourceCommit: process.argv[3] ?? null, files: [], entries: [], assets: [] };
const ref = (collection, slug) => `$ref:${collection}:${slug}`;
const slugify = s => s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g,'');
const textRows = (values, key = 'text') => (values ?? []).map(value => ({ [key]: value }));
const paragraphs = values => (values ?? []).map((text, i) => ({ _type:'block', _key:`p-${i}`, style:'normal', markDefs:[], children:[{ _type:'span', _key:`s-${i}`, text, marks:[] }] }));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function keys(obj, allowed, location) {
  const unknown = Object.keys(obj).filter(k => !allowed.includes(k));
  if (unknown.length) throw new Error(`Unmapped source fields at ${location}: ${unknown.join(', ')}`);
}
function rename(obj, mapping) { return Object.fromEntries(Object.entries(obj).map(([k,v]) => [mapping[k] ?? k, v])); }
function add(collection, slug, data, file, pointer = '') {
  if (content[collection].some(e => e.slug === slug)) throw new Error(`Duplicate ${collection}/${slug}`);
  content[collection].push({ id:`${collection}:${slug}`, slug, status:'published', data });
  provenance.entries.push({ collection, slug, file, pointer });
  return ref(collection, slug);
}
async function files(collection) {
  const base = resolve(root,collection);
  const paths = [];
  async function walk(dir) {
    for (const entry of await readdir(dir,{withFileTypes:true})) {
      const path = resolve(dir,entry.name);
      if (entry.isDirectory()) await walk(path); else if (entry.name.endsWith('.json')) paths.push(path);
    }
  }
  await walk(base);
  return Promise.all(paths.sort().map(async path => {
    const raw = await readFile(path);
    const file = relative(root,path);
    provenance.files.push({ file, sha256:hash(raw) });
    return { file, path, slug:relative(base,path).replace(/\.json$/,'').replaceAll('/','-'), data:JSON.parse(raw) };
  }));
}
for (const {file,slug,data:d} of await files('divisions')) {
  keys(d,['name','short','order','gamesPerMatch','championShield','premierShield'],file);
  add('divisions',slug,rename(d,{order:'display_order',gamesPerMatch:'games_per_match',championShield:'champion_shield',premierShield:'premier_shield'}),file);
}
for (const {file,slug,data:d} of await files('seasons')) {
  keys(d,['name','start','end','status','totalRounds','divisions','events'],file);
  const {divisions,...rest}=d;
  for (const e of d.events) keys(e,['date','title','kind','note'],file);
  add('seasons',slug,rename(rest,{status:'season_status',totalRounds:'total_rounds'}),file);
  divisions.forEach((division,i) => {
    keys(division,['division','teams'],file);
    add('season_divisions',`${slug}-${division.division}`,{title:`${d.name} · ${division.division}`,season:ref('seasons',slug),division:ref('divisions',division.division),teams:division.teams.map(t=>ref('teams',t)),display_order:i},file,`/divisions/${i}`);
  });
}
const site = (await files('settings')).find(f=>f.slug==='site');
keys(site.data,['name','shortName','established','email','facebook','homeGround','resultsDue','currentSeason','pointsForWin','pointsForDraw','minGamesForAverage','eligibilityNotice'],site.file);
add('league_settings','rules',{title:'WADA league rules',current_season:ref('seasons',site.data.currentSeason),established:site.data.established,points_for_win:site.data.pointsForWin,points_for_draw:site.data.pointsForDraw,min_games_for_average:site.data.minGamesForAverage},site.file);
for (const {file,data:d} of await files('fixtures')) {
  keys(d,['season','division','rounds'],file);
  d.rounds.forEach((round,ri)=>{
    keys(round,['round','date','matches'],file);
    round.matches.forEach((m,mi)=>{
      keys(m,['home','away'],file);
      add('fixtures',`${d.season}-${d.division}-r${round.round}-${m.home}-${m.away}`,{title:`R${round.round} · ${m.home} v ${m.away}`,season:ref('seasons',d.season),division:ref('divisions',d.division),round:round.round,date:round.date,home:ref('teams',m.home),away:ref('teams',m.away),display_order:mi},file,`/rounds/${ri}/matches/${mi}`);
    });
  });
}
for (const {file,data:d} of await files('results')) {
  keys(d,['season','round','date','divisions'],file);
  d.divisions.forEach((division,di)=>{
    keys(division,['division','matches'],file);
    division.matches.forEach((m,mi)=>{
      keys(m,['home','away','homeScore','awayScore','forfeit','note'],file);
      add('results',`${d.season}-${division.division}-r${d.round}-${m.home}-${m.away}`,{...rename(m,{homeScore:'home_score',awayScore:'away_score'}),title:`R${d.round} · ${m.home} v ${m.away}`,season:ref('seasons',d.season),division:ref('divisions',division.division),round:d.round,date:d.date,home:ref('teams',m.home),away:ref('teams',m.away),display_order:mi},file,`/divisions/${di}/matches/${mi}`);
    });
  });
}
for (const {file,data:d} of await files('ladders')) {
  keys(d,['season','round','source','divisions'],file);
  d.divisions.forEach((division,di)=>{
    keys(division,['division','rows'],file);
    const slug=`${d.season}-${division.division}-r${d.round}`;
    const snapshot=add('ladders',slug,{title:`${d.season} · ${division.division} · Round ${d.round}`,season:ref('seasons',d.season),division:ref('divisions',division.division),round:d.round,source:d.source},file,`/divisions/${di}`);
    division.rows.forEach((row,ri)=>{
      keys(row,['team','played','won','points','legsFor','legsAgainst'],file);
      add('ladder_rows',`${slug}-${row.team}`,{...rename(row,{legsFor:'legs_for',legsAgainst:'legs_against'}),title:`${slug} · ${row.team}`,snapshot,team:ref('teams',row.team),display_order:ri},file,`/divisions/${di}/rows/${ri}`);
    });
  });
}
for (const {file,data:d} of await files('stats')) {
  keys(d,['season','round','division','players'],file);
  d.players.forEach((p,i)=>{
    keys(p,['name','reg','team','games','score','darts','highOut','tons180','annual180','lifetime180'],file);
    // Registration numbers include OCC and duplicates. Never treat them as unique player IDs.
    const slug=`${d.season}-${d.division}-r${d.round}-${slugify(p.name)}-${slugify(p.reg)}-${p.team}`;
    add('stats',slug,{...rename(p,{reg:'registration',highOut:'high_out',tons180:'tons_180',annual180:'annual_180',lifetime180:'lifetime_180'}),season:ref('seasons',d.season),division:ref('divisions',d.division),round:d.round,team:ref('teams',p.team),display_order:i},file,`/players/${i}`);
  });
}
const playerImport = derivePlayers(content.stats);
content.players = playerImport.players;
const playerByAverage = new Map(playerImport.links.map(link => [link.statsSlug, link.playerSlug]));
for (const average of content.stats) average.data.player = ref('players', playerByAverage.get(average.slug));
for (const {file,slug,data:d} of await files('honours')) {
  keys(d,['title','order','note','awards'],file);
  const {awards,...rest}=d;
  const honours=add('honours',slug,rename(rest,{order:'display_order'}),file);
  awards.forEach((a,i)=>{
    keys(a,['division','shield','winner','second','roster'],file);
    add('honour_awards',`${slug}-${slugify(a.shield)}-${i+1}`,{...a,title:`${d.title} · ${a.shield}`,honours,roster:textRows(a.roster,'name'),display_order:i},file,`/awards/${i}`);
  });
}
async function photos(values, competition, event, sourceFile, prefix, id) {
  for (const [i,p] of (values??[]).entries()) {
    keys(p,['src','alt','caption','kind'],sourceFile);
    const original=resolve(root,dirname(sourceFile),p.src);
    if (!original.startsWith(resolve(sourceRoot,'src/assets')+'/')) throw new Error(`Unexpected asset path ${original}`);
    const bytes=await readFile(original);
    const asset=relative(sourceRoot,original);
    const destination=resolve(project,'migration-assets',asset);
    await mkdir(dirname(destination),{recursive:true});
    await copyFile(original,destination);
    const slug=`${id}-photo-${i+1}`;
    add('competition_photos',slug,{title:p.caption||p.alt,competition,...(event?{event}:{}),alt:p.alt,...(p.caption?{caption:p.caption}:{}),kind:p.kind??'photo',source_path:asset,display_order:i},sourceFile,`${prefix}/${i}`);
    provenance.assets.push({collection:'competition_photos',slug,source:asset,local:relative(project,destination),sha256:hash(bytes),status:'awaiting-media-library-upload'});
  }
}
for (const {file,slug,data:d} of await files('competitions')) {
  keys(d,['name','order','summary','introTitle','intro','memorial','photos','events'],file);
  const {events,photos:introPhotos,memorial,intro,...rest}=d;
  const competition=add('competitions',slug,{...rename(rest,{order:'display_order',introTitle:'intro_title'}),intro:paragraphs(intro),...(memorial?{memorial:ref('memorials',memorial)}:{})},file);
  await photos(introPhotos,competition,null,file,'/photos',slug);
  for (const [i,e] of events.entries()) {
    keys(e,['year','title','date','dateNote','venue','players','cancelled','report','results','teams','highlights','notes','photos'],file);
    const {results,teams,photos:eventPhotos,report,notes,highlights,...rest}=e;
    const eventSlug=`${slug}-${e.year}-${slugify(e.title)}-${i+1}`;
    for (const h of highlights??[]) keys(h,['label','value'],file);
    const event=add('competition_events',eventSlug,{...rename(rest,{dateNote:'date_note'}),competition,cancelled:e.cancelled??false,report:paragraphs(report),notes:textRows(notes),highlights:highlights??[],display_order:i},file,`/events/${i}`);
    (results??[]).forEach((r,ri)=>{
      keys(r,['label','winner','runnersUp','score','details'],file);
      const {runnersUp,details,...rest}=r;
      add('competition_results',`${eventSlug}-result-${ri+1}`,{...rest,title:`${d.name} ${e.year} · ${r.label||r.winner||`Result ${ri+1}`}`,event,runners_up:textRows(runnersUp,'name'),details:textRows(details),display_order:ri},file,`/events/${i}/results/${ri}`);
    });
    (teams??[]).forEach((t,ti)=>{
      keys(t,['label','name','players'],file);
      add('competition_teams',`${eventSlug}-team-${ti+1}`,{...t,event,players:textRows(t.players,'name'),display_order:ti},file,`/events/${i}/teams/${ti}`);
    });
    await photos(eventPhotos,competition,event,file,`/events/${i}/photos`,eventSlug);
  }
}
for (const {file,slug,data:d} of await files('records')) {
  keys(d,['title','asAt','topAllTime'],file);
  add('association_records',slug,{title:d.title,as_at:d.asAt,top_all_time:textRows(d.topAllTime,'name')},file);
}
for (const {file,slug,data:d} of await files('checkouts')) {
  keys(d,['note','verified','rows'],file);
  for (const row of d.rows) keys(row,['score','route'],file);
  add('checkouts',slug,{title:'WADA checkout chart',...d},file);
}
// Existing directory entries are included only so the seed engine can resolve $ref IDs.
// Applying with --on-conflict=skip preserves their edited values and published revisions.
const seed={version:'1',meta:{name:'WADA league and history import'},collections:[...directory.collections,...competitionCollections],relations:[playerRelation],content:{...directory.content,...content}};
const known=new Set(Object.values(seed.content).flat().map(e=>e.id));
for (const c of seed.collections) for (const e of seed.content[c.slug]??[]) {
  for (const [key,value] of Object.entries(e.data)) {
    const field=c.fields.find(f=>f.slug===key);
    if (!field) throw new Error(`Undeclared field ${c.slug}.${key}`);
    if (field.type==='reference') {
      const relation = seed.relations.find(r => r.slug === field.validation.relation);
      const target = field.validation.targetCollection ?? (relation?.parentCollection === c.slug ? relation.childCollection : relation?.parentCollection);
      for (const v of Array.isArray(value)?value:[value]) {
        if (!v.startsWith(`$ref:${target}:`) || !known.has(v.slice(5))) throw new Error(`Unresolved reference ${e.id}.${key}: ${v}`);
      }
    }
  }
}
await mkdir(resolve(project,'seed'),{recursive:true});
for (const [filename,data] of [['wada-competition-schema.json',{version:'1',collections:competitionCollections,relations:[playerRelation]}],['wada-competition.json',seed],['wada-source-manifest.json',provenance]]) await writeFile(resolve(project,'seed',filename),JSON.stringify(data,null,2)+'\n');
// Keep future fresh installations aligned, without replacing existing starter/menu definitions.
const bundled=JSON.parse(await readFile(resolve(project,'seed/seed.json'),'utf8'));
const newSlugs=new Set(competitionCollections.map(c=>c.slug));
bundled.collections=[...bundled.collections.filter(c=>!newSlugs.has(c.slug)),...competitionCollections];
bundled.content={...bundled.content,...content};
bundled.relations=[...(bundled.relations??[]).filter(r=>r.slug!==playerRelation.slug),playerRelation];
bundled.meta={...bundled.meta,name:'WADA',description:'Western Area Darts Association: directories, league data and competition history.'};
await writeFile(resolve(project,'seed/seed.json'),JSON.stringify(bundled,null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(content).map(([k,v])=>[k,v.length])),null,2));
console.log(`${provenance.assets.length} original image files preserved in migration-assets/; media uploads remain separate.`);
