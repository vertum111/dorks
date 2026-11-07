import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {REACTION_FILES,REACTION_POOLS,createReactionSelector,resultReaction,countdownReaction,revealReaction} from '../src/audio-reactions.js';
test('each action has distinct variants and deployable local assets',()=>{
 for(const pool of Object.values(REACTION_POOLS)){assert.ok(pool.length>1);assert.equal(new Set(pool).size,pool.length);}
 for(const name of REACTION_FILES)assert.ok(existsSync(new URL(`../public/audio/memes/${name}.mp3`,import.meta.url)),name);
});
test('shuffle bags exhaust each pool and avoid repeats across cycle boundaries',()=>{
 for(const [event,pool] of Object.entries(REACTION_POOLS)){
  const picker=createReactionSelector(()=>0);let last;
  for(let cycle=0;cycle<3;cycle++){
   const selected=[];
   for(let i=0;i<pool.length;i++){const next=picker.pick(event,{force:true});assert.notEqual(next,last);last=next;selected.push(next);}
   assert.equal(new Set(selected).size,pool.length,event);
  }
 }
});
test('shared clips do not repeat when changing actions',()=>{
 const picker=createReactionSelector(()=>0);let last;
 for(let i=0;i<100;i++){const next=picker.pick(i%2?'rps-tie':'tie',{force:true});assert.notEqual(next,last);last=next;}
});
test('cooldown blocks chatter but outcomes can interrupt a throw',()=>{
 const picker=createReactionSelector(()=>0);assert.ok(picker.pick('throw',{now:0}));assert.equal(picker.pick('throw',{now:200}),null);assert.ok(picker.pick('win',{now:300}));assert.equal(picker.pick('lose',{now:400}),null);assert.ok(picker.pick('throw',{now:2000}));
});
test('silly loss sounds occur once per rotation and can be disabled',()=>{
 const picker=createReactionSelector(()=>.99);const losses=Array.from({length:2*REACTION_POOLS.lose.length},(_,i)=>picker.pick('lose',{now:i*2000}));
 assert.equal(losses.filter(name=>name.includes('fart')).length,2);
 for(let i=0;i<30;i++)assert.doesNotMatch(picker.pick('lose',{now:50000+i*2000,silly:false}),/fart/);
});
test('optional opponent-found reaction can be skipped; preview bypasses chance',()=>{
 const picker=createReactionSelector(()=>.99);assert.equal(picker.pick('found'),null);assert.ok(picker.pick('found',{force:true}));assert.equal(picker.pick('not-an-event',{force:true}),null);
});
test('unloaded samples are skipped without consuming the cooldown',()=>{
 const picker=createReactionSelector(()=>0);assert.equal(picker.pick('win',{available:new Set()}),null);assert.equal(picker.pick('win',{available:new Set(['win-wow'])}),'win-wow');
});
test('RPS outcomes and ties use their own reaction pools',()=>{
 assert.equal(resultReaction({player:0}),'win');assert.equal(resultReaction({player:1}),'lose');assert.equal(resultReaction({player:0,wonBy:'rps'}),'rps-win');assert.equal(resultReaction({player:1,wonBy:'rps'}),'rps-lose');
 assert.equal(countdownReaction(1),'tie');assert.equal(countdownReaction(2),'rps-start');assert.equal(revealReaction('rock','rock'),'rps-tie');assert.equal(revealReaction('rock','paper'),'rps-reveal');
});
test('every delivered clip is under five seconds and requested excerpt is seconds 2–4',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../public/audio/memes/manifest.json',import.meta.url)));
 assert.deepEqual(manifest.map(clip=>clip.name).sort(),[...REACTION_FILES].sort());
 for(const clip of manifest){assert.ok(clip.seconds>0&&clip.seconds<5,clip.name);assert.ok(Number.isFinite(clip.peak_dbfs)&&clip.peak_dbfs>-46,`${clip.name} must contain audible signal`);assert.ok(clip.source.startsWith('https://www.myinstants.com/'));}
 const excerpt=manifest.find(clip=>clip.name==='lose-hell-no');assert.equal(excerpt.start,2);assert.equal(excerpt.excerpt_seconds,2);
});
