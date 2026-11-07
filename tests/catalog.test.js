import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {dragons,frontImage,backImage,isFound,wrapCap,capDistance} from '../src/cap-catalog.js';
test('carousel wraps correctly at either end of the expanded collection',()=>{
 assert.ok(dragons.length>=12);const n=dragons.length;
 assert.equal(wrapCap(-1),n-1);assert.equal(wrapCap(n),0);assert.equal(wrapCap(3*n+2),2);
 assert.equal(capDistance(n-1,0),-1);assert.equal(capDistance(0,n-1),1);
 for(let active=0;active<n;active++)for(let step=-3;step<=3;step++)assert.equal(capDistance(wrapCap(active+step),active),step);
});
test('collection metadata has unique stable IDs and foil backgrounds use isolated sprites',()=>{
 assert.equal(new Set(dragons.map(d=>d.id)).size,dragons.length);
 for(const d of dragons){assert.ok(Number.isInteger(d.id)&&d.id>0);assert.ok(d.desc.length>0);if(d.foil){assert.equal(d.sprite,true);assert.ok(['Epic','Legendary'].includes(d.rarity));}}
 assert.ok(dragons.filter(d=>d.foil).length>=3);
});
test('every selectable cap has its real art file',async()=>{
 for(const dragon of dragons){
  const faces=isFound(dragon)?[frontImage(dragon),backImage(dragon)]:[frontImage(dragon)];
  for(const face of faces){
   const bytes=await fs.readFile(new URL(`../public${face}`,import.meta.url));
   assert.equal(bytes.subarray(1,4).toString(),'PNG',`${face} has no PNG art`);
  }
 }
});
