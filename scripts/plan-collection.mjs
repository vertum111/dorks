import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {originalCaps as dragons,frontImage} from '../src/cap-catalog.js';
const editions={Common:48,Rare:32,Epic:16,Legendary:8};
function finish(rarity,index){if(rarity==='Common')return 'plain';if(rarity==='Rare')return index<24?'plain':'etched';if(rarity==='Epic')return index<6?'etched':index<12?'cosmos':'prism';return index<6?'prism':'cosmos';}
const records=[];for(const dragon of dragons)for(let i=0;i<editions[dragon.rarity];i++)records.push({design_id:records.length+1,species_id:dragon.id,species:dragon.name,rarity:dragon.rarity,element:dragon.element,edition:i+1,editions:editions[dragon.rarity],finish:finish(dragon.rarity,i),front_art:frontImage(dragon),back_art:'/brand/cap-back.svg',logo_mask:'/brand/dorks-foil-stamp.svg',serial:`${dragon.name}-${String(i+1).padStart(2,'0')}`,gameplay_advantage:0});
const counts=key=>Object.fromEntries([...new Set(records.map(r=>r[key]))].map(v=>[v,records.filter(r=>r[key]===v).length]));
const body=JSON.stringify(records,null,2)+'\n';const hash=createHash('sha256').update(body).digest('hex');
await fs.mkdir('collection-plan',{recursive:true});await fs.writeFile('collection-plan/design-pool.json',body);
await fs.writeFile('collection-plan/summary.json',JSON.stringify({status:'DRAFT — not a deployed mint',species:dragons.length,supply:records.length,rarities:counts('rarity'),finishes:counts('finish'),design_pool_sha256:hash,allocations:{allowlist:128,public:832,community_rewards:32,team:16,collaborations:16},notes:['Design IDs are not mint order. A reviewed future randomness protocol must assign designs without replacement.','Rarity is cosmetic. All caps have identical throw odds.','The pool hash is a local draft checksum, not an onchain commitment.']},null,2)+'\n');
console.log(`${dragons.length} species, ${records.length} planned tokens. SHA-256 ${hash}`);
