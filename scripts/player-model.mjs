import { createHash } from 'node:crypto';
export const playerRelation = {
  slug: 'player_averages', parentCollection: 'stats', childCollection: 'players',
  parentLabel: 'Player averages', parentLabelSingular: 'Player average',
  childLabel: 'Players', childLabelSingular: 'Player', maxChildrenPerParent: 1,
};
export const playerField = {slug:'player',label:'Player',type:'reference',required:false,validation:{relation:'player_averages'}};
export const playersCollection = {
  slug:'players',label:'Players',labelSingular:'Player',titleField:'name',group:'WADA',sortOrder:2,
  routable:false,supports:['drafts','revisions','search'],commentsEnabled:false,
  fields:[
    {slug:'name',label:'Full name',type:'string',required:true,searchable:true,indexed:true},
    {slug:'registration',label:'Registration number / code',type:'string',searchable:true,indexed:true},
    {slug:'registration_review',label:'Registration review',type:'select',validation:{options:['As published','OCC / unnumbered','Duplicate number — review']}},
    {slug:'aliases',label:'Other names',type:'repeater',validation:{subFields:[{slug:'name',label:'Name',type:'string',required:true}]}},
    {slug:'notes',label:'Player notes',type:'text'},
    {slug:'averages',label:'Player averages',type:'reference',validation:{relation:'player_averages'}},
  ],
};
const normalize = text => (text??'').normalize('NFC').trim().replace(/\s+/g,' ').toLowerCase();
const slugify = text => text.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
/** Only exact normalized name + numbered registration can share a profile.
 * OCC/unnumbered identities stay separate unless an editor links them deliberately. */
export function derivePlayers(stats) {
  const groups=new Map(),registrations=new Map();
  for(const entry of stats){
    const name=normalize(entry.data.name),reg=normalize(entry.data.registration);
    if(!name)throw new Error(`Missing player name on ${entry.slug}`);
    const unnumbered=!reg||reg==='occ';
    const identity=JSON.stringify([name,reg,...(unnumbered?[entry.slug]:[])]);
    if(!groups.has(identity))groups.set(identity,{name:entry.data.name,registration:entry.data.registration,unnumbered,stats:[]});
    groups.get(identity).stats.push(entry);
    if(!unnumbered){if(!registrations.has(reg))registrations.set(reg,new Set());registrations.get(reg).add(name);}
  }
  const players=[],links=[];
  for(const [identity,p] of groups){
    const hash=createHash('sha256').update(identity).digest('hex').slice(0,12);
    const slug=`${slugify(p.name).slice(0,55)}-${hash}`;
    const duplicate=(registrations.get(normalize(p.registration))?.size??0)>1;
    players.push({id:`players:${slug}`,slug,status:'published',data:{name:p.name,registration:p.registration??'',registration_review:duplicate?'Duplicate number — review':p.unnumbered?'OCC / unnumbered':'As published',aliases:[],notes:duplicate?`The source uses registration ${p.registration} for more than one name. Confirm this number with WADA; do not merge players by number alone.`:p.unnumbered?'Imported with OCC or no numbered registration. Confirm identity before combining with another profile.':''}});
    for(const stat of p.stats)links.push({statsSlug:stat.slug,playerSlug:slug,sourceName:stat.data.name,sourceRegistration:stat.data.registration});
  }
  return {players,links};
}
