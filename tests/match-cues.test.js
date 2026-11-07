import test from 'node:test';
import assert from 'node:assert/strict';
import {turnCue} from '../src/match-cues.js';
import {resolveTurn,newGame} from '../src/game.js';
import {outcomeDragon} from '../src/outcome-dragon.js';
test('duel explains whose turn and that a single cap is in play',()=>{
 const mine=turnCue(newGame()),theirs=turnCue({...newGame(),player:1},'Alice');
 assert.equal(mine.title,'Your turn!');assert.equal(mine.caps,1);assert.equal(theirs.title,'Rival’s turn!');assert.match(theirs.detail,/Alice/);assert.notEqual(mine.key,theirs.key);
});
test('both advantage and missed slams announce the pair for the correct player',()=>{
 let state=resolveTurn(newGame(),1,()=>0);state=resolveTurn(state,0,()=>1);
 assert.equal(state.phase,'pair');let cue=turnCue(state);assert.equal(cue.title,'SLAM!');assert.equal(cue.caps,2);assert.match(cue.detail,/YOU/);
 const next=resolveTurn(state,0,()=>1);cue=turnCue(next,'Sam');assert.equal(cue.title,'SLAM!');assert.equal(cue.caps,2);assert.match(cue.detail,/SAM/);assert.notEqual(turnCue(state).key,cue.key);
});
test('RPS and completed rounds do not announce stale cap turns',()=>{
 assert.equal(turnCue({phase:'rps'}),null);assert.equal(turnCue({phase:'finished'}),null);
});
test('result characters are vector rigs with distinct expressions and accessible labels',()=>{
 const win=outcomeDragon(true),loss=outcomeDragon(false);
 assert.match(win,/dragon-won/);assert.match(win,/Happy green dragon/);assert.match(win,/dragon-crown/);assert.match(loss,/Sad red dragon/);assert.match(loss,/dragon-tear/);assert.doesNotMatch(loss,/dragon-crown/);
});

test('callouts do not replay on refresh and a tie survives RPS polling',async()=>{
 const {mountMatchCues}=await import('../src/match-cues.js');const nodes=new Map();let body,modal,host;const scheduled=[];
 const node=()=>({hidden:true,dataset:{},setAttribute(){},querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{textContent:'',innerHTML:''});return nodes.get(selector);},animate(){return {cancel(){}};}});
 body={append(element){element.parent=this;host=element;}};modal={append(element){element.parent=this;}};
 const prior={document:globalThis.document,matchMedia:globalThis.matchMedia,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
 globalThis.document={body,createElement:node,querySelector:()=>modal};globalThis.matchMedia=()=>({matches:false});globalThis.setTimeout=callback=>scheduled.push(callback);globalThis.clearTimeout=()=>{};
 try{
  const cues=mountMatchCues();cues.sync(newGame());assert.equal(host.hidden,false);assert.equal(nodes.get('strong').textContent,'Your turn!');
  scheduled.at(-1)();assert.equal(host.hidden,true);cues.sync(newGame());assert.equal(host.hidden,true,'polling must not replay the same turn');
  cues.sync({...newGame(),turn:1,player:1});assert.equal(host.hidden,false);assert.equal(nodes.get('strong').textContent,'Rival’s turn!');
  cues.tie(1);assert.equal(host.parent,modal);cues.sync({phase:'rps'},{busy:true});assert.equal(host.hidden,false,'RPS polling must preserve the tie announcement');
  cues.sync({phase:'finished'});assert.equal(host.hidden,true);cues.reset();
  cues.sync(newGame());assert.equal(host.parent,body);assert.equal(host.hidden,false);cues.sync(newGame(),{visible:false});assert.equal(host.hidden,true);
 }finally{for(const [key,value]of Object.entries(prior)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
