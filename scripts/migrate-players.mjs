// Local-only migration: no login bypass, API tokens or account creation.
import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {Kysely} from 'kysely';
import {runMigrations} from 'emdash/db';
import {createDialect} from 'emdash/db/sqlite';
import {applySeed,SchemaRegistry,handleContentGet,handleContentUpdate,handleContentPublish} from 'emdash';
import {playerField} from './player-model.mjs';
const project=resolve(dirname(new URL(import.meta.url).pathname),'..');
const dbPath=resolve(process.argv[2]??'data.db');
const db=new Kysely({dialect:createDialect({url:`file:${dbPath}`})});
const seed=JSON.parse(await readFile(resolve(project,'seed/wada-players.json'),'utf8'));
const mapping=JSON.parse(await readFile(resolve(project,'seed/wada-player-links.json'),'utf8'));
const unwrap=result=>{if(!result.success)throw new Error(JSON.stringify(result.error));return result.data;};
try{
  await runMigrations(db);
  // Abort before changing schema if an editor has pending work on an affected average.
  for(const link of mapping){
    const row=await db.selectFrom('ec_stats').selectAll().where('slug','=',link.statsSlug).executeTakeFirst();
    if(!row||row.deleted_at||row.status!=='published'||row.draft_revision_id)throw new Error(`Average missing, unpublished or has a pending draft: ${link.statsSlug}`);
  }
  const result=await applySeed(db,seed,{includeContent:true,onConflict:'skip'});
  const schema=new SchemaRegistry(db);
  if(!await schema.getField('stats','player')) await schema.createField('stats',{...playerField,required:false,validation:{relation:'player_averages',relationSide:'parent',targetCollection:'players'}});
  await schema.updateCollection('stats',{label:'Player averages',labelSingular:'Player average'});
  await schema.updateField('stats','name',{label:'Name as published'});
  let linked=0,skipped=0;
  for(const link of mapping){
    const row=await db.selectFrom('ec_stats').selectAll().where('slug','=',link.statsSlug).executeTakeFirstOrThrow();
    const current=unwrap(await handleContentGet(db,'stats',row.id,undefined,{includeDrafts:true}));
    const existing=current.item.references?.player?.children??[];
    // Preserve any link an administrator has already set, even if different from the import mapping.
    if(existing.length){skipped++;continue;}
    if(row.name!==link.sourceName||row.registration!==link.sourceRegistration)throw new Error(`Average identity changed; manual review needed: ${link.statsSlug}`);
    const player=await db.selectFrom('ec_players').select(['id']).where('slug','=',link.playerSlug).executeTakeFirstOrThrow();
    const updated=unwrap(await handleContentUpdate(db,'stats',row.id,{_rev:current._rev,references:{player:[player.id]}}));
    unwrap(await handleContentPublish(db,'stats',row.id,{_rev:updated._rev,publishedAt:row.published_at}));
    linked++;
  }
  console.log(JSON.stringify({playersCreated:result.content.created,playersSkipped:result.content.skipped,averagesLinked:linked,existingLinksPreserved:skipped},null,2));
}finally{await db.destroy();}
