import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatchmaker} from '../match-server.mjs';
function setup(random=()=>0){let time=1000;const mm=createMatchmaker({now:()=>time,random});const a=mm.create(),b=mm.create();const act=(c,type,rest={})=>{c.last=time;mm.action(c,{type,round:mm.snapshot(c).room?.round,...rest});};const advance=n=>{time+=n;a.last=b.last=time;mm.tick();};return {mm,a,b,act,advance};}
function pair(s){s.act(s.a,'queue',{cap:2});s.act(s.b,'queue',{cap:8});}
function ready(s){pair(s);s.act(s.a,'ready');s.act(s.b,'ready');}
test('matchmaking pairs actual queued clients and requires both ready',()=>{const s=setup();pair(s);assert.equal(s.mm.snapshot(s.a).room.status,'ready');s.act(s.a,'ready');assert.equal(s.mm.snapshot(s.a).room.status,'ready');assert.throws(()=>s.act(s.a,'throw',{skill:1}),/turn/);s.act(s.b,'ready');assert.equal(s.mm.snapshot(s.a).room.round,1);assert.deepEqual(s.mm.snapshot(s.a).room.caps,[2,8]);});
test('cancelled search cannot match, and no bot is substituted',()=>{const s=setup();s.act(s.a,'queue',{cap:0});s.act(s.a,'cancel');s.act(s.b,'queue',{cap:1});assert.equal(s.mm.snapshot(s.b).room,null);assert.equal(s.mm.snapshot(s.b).queued,true);});
test('server rejects out-of-turn, duplicate, stale and invalid throws',()=>{const s=setup();ready(s);assert.throws(()=>s.act(s.b,'throw',{skill:1}),/turn/);assert.throws(()=>s.act(s.a,'throw',{skill:2}),/Invalid/);s.act(s.a,'throw',{skill:1});assert.throws(()=>s.act(s.a,'throw',{skill:1}),/turn/);s.advance(1700);assert.throws(()=>s.mm.action(s.b,{type:'throw',round:0,skill:1}),/ended/);});
test('RPS choices stay secret until server deadline, ties repeat',()=>{const s=setup();ready(s);s.act(s.a,'throw',{skill:1});s.advance(1700);s.act(s.b,'throw',{skill:1});s.advance(1700);s.act(s.a,'rps',{choice:'rock'});s.act(s.b,'rps',{choice:'rock'});const snap=s.mm.snapshot(s.a).room;assert.equal(snap.choices,undefined);assert.equal(JSON.stringify(snap).includes('"choices"'),false);s.advance(5100);assert.equal(s.mm.snapshot(s.a).room.status,'revealing');s.advance(1900);assert.equal(s.mm.snapshot(s.a).room.state.rpsRound,2);});
test('result is recorded once and rematch needs mutual consent',()=>{const s=setup();ready(s);s.act(s.a,'throw',{skill:1});s.advance(1700);s.act(s.b,'throw',{skill:1});s.advance(1700);s.act(s.a,'rps',{choice:'rock'});s.act(s.b,'rps',{choice:'scissors'});s.advance(5100);s.advance(1900);assert.equal(s.mm.snapshot(s.a).room.status,'result');assert.equal(s.mm.snapshot(s.a).room.history.length,1);s.act(s.a,'rematch');assert.equal(s.mm.snapshot(s.a).room.round,1);s.act(s.b,'rematch');assert.equal(s.mm.snapshot(s.a).room.round,2);assert.equal(s.mm.snapshot(s.a).room.history.length,1);});
test('both missing RPS picks is a tie, one missing pick loses',()=>{const s=setup();ready(s);s.act(s.a,'throw',{skill:1});s.advance(1700);s.act(s.b,'throw',{skill:1});s.advance(1700);s.advance(5100);s.advance(1900);assert.equal(s.mm.snapshot(s.a).room.state.phase,'rps');s.act(s.b,'rps',{choice:'paper'});s.advance(5100);s.advance(1900);assert.equal(s.mm.snapshot(s.a).room.state.player,1);});
test('leaving stops a rematch and notifies the remaining player',()=>{const s=setup();ready(s);s.act(s.a,'leave');assert.equal(s.mm.snapshot(s.a).room,null);assert.equal(s.mm.snapshot(s.b).room.status,'left');assert.throws(()=>s.act(s.b,'throw',{skill:1}),/closed/);});

test('the queue accepts the expanded collection and rejects an unknown cap index',()=>{const s=setup();s.act(s.a,'queue',{cap:31});s.act(s.b,'queue',{cap:12});assert.deepEqual(s.mm.snapshot(s.a).room.caps,[31,12]);assert.throws(()=>s.act(s.a,'queue',{cap:64}),/valid cap/);});

test('Found caps match each other and stay out of the regular queue',()=>{
 const s=setup(),c=s.mm.create();
 s.act(s.a,'queue',{cap:32});
 s.act(s.b,'queue',{cap:4});
 assert.equal(s.mm.snapshot(s.a).room,null);
 assert.equal(s.mm.snapshot(s.b).room,null);
 s.act(c,'queue',{cap:63});
 assert.deepEqual(s.mm.snapshot(s.a).room.caps,[32,63]);
 assert.equal(s.mm.snapshot(s.b).queued,true);
});
