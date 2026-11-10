import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatchmaker} from '../match-server.mjs';
import {dragons,isFound} from '../src/cap-catalog.js';

async function table() {
 let now=1000;
 const entries=[{locked:false},{locked:false}],payouts=[];
 const chain={contractId:'caps.testnet',open:async()=> '1',get:async()=>({entries,deadline_ms:'600000'}),
  settle:async(id,winner)=>{payouts.push({id,winner});}};
 const game=createMatchmaker({now:()=>now,stakes:chain,random:()=>0.1});
 const alice=Object.assign(game.create(),{wallet:'alice.testnet',foundToken:'found-01-01'});
 const bob=Object.assign(game.create(),{wallet:'bob.testnet',foundToken:'found-02-01'});
 const [a,b]=dragons.map((cap,i)=>isFound(cap)?i:null).filter(i=>i!==null);
 game.action(alice,{type:'queue',cap:a,staked:true});
 game.action(bob,{type:'queue',cap:b,staked:true});
 await new Promise(resolve=>setImmediate(resolve));
 return {game,alice,bob,entries,payouts,advance:ms=>{now+=ms;}};
}

test('a stake match starts only with both caps locked and scores on server time', async()=>{
 const t=await table(),{game,alice,bob,entries,advance}=t;
 entries[0].locked=true;
 advance(1600);await game.updateStake(game.table(alice));
 assert.equal(game.snapshot(alice).room.status,'ready');
 assert.throws(()=>game.action(alice,{type:'ready',round:0}),/both deposits/);
 entries[1].locked=true;
 advance(1600);await game.updateStake(game.table(alice));
 assert.equal(game.snapshot(bob).room.status,'playing');
 assert.throws(()=>game.action(alice,{type:'throw',round:1,skill:1}),/Hold to aim/);
 game.action(alice,{type:'charge',round:1});
 advance(400);
 game.action(alice,{type:'throw',round:1,skill:1});
 const move=game.snapshot(bob).room.events.find(e=>e.type==='throw');
 assert.ok(move.skill<1);
});

test('leaving after the stakes lock pays the opponent once, without a loser signature', async()=>{
 const {game,alice,bob,entries,payouts,advance}=await table();
 entries.forEach(entry=>{entry.locked=true;});
 advance(1600);await game.updateStake(game.table(alice));
 game.action(alice,{type:'leave'});
 await new Promise(resolve=>setImmediate(resolve));
 const room=game.snapshot(bob).room;
 assert.equal(room.status,'result');
 assert.equal(room.stake.status,'paid');
 assert.equal(room.history[0].method,'Forfeit');
 assert.deepEqual(payouts,[{id:'1',winner:'bob.testnet'}]);
 game.action(alice,{type:'leave'});game.tick();
 assert.equal(payouts.length,1);
});

test('if both players disappear the server does not pick an arbitrary winner', async()=>{
 const {game,alice,entries,payouts,advance}=await table();
 entries.forEach(entry=>{entry.locked=true;});
 advance(1600);await game.updateStake(game.table(alice));
 advance(46000);game.tick();
 assert.deepEqual(payouts,[]);
});

test('a player cannot avoid settlement by letting the throw clock expire', async()=>{
 const {game,alice,bob,entries,payouts,advance}=await table();
 entries.forEach(entry=>{entry.locked=true;});
 advance(1600);await game.updateStake(game.table(alice));
 advance(20001);game.tick();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(game.snapshot(bob).room.status,'result');
 assert.deepEqual(payouts,[{id:'1',winner:'bob.testnet'}]);
});
