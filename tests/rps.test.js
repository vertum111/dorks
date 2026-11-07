import test from 'node:test';
import assert from 'node:assert/strict';
import {rpsWinner,resolveRps,RPS_CHOICES} from '../src/rps.js';
import {newGame,resolveTurn} from '../src/game.js';
test('all nine rock-paper-scissors outcomes obey the cycle',()=>{
 const wins={rock:'scissors',scissors:'paper',paper:'rock'};
 for(const a of RPS_CHOICES)for(const b of RPS_CHOICES)assert.equal(rpsWinner(a,b),a===b?null:wins[a]===b?0:1);
});
test('RPS ties repeat with no score until the first decisive result',()=>{
 const original={...newGame([4,6]),phase:'rps',rpsRound:1};let state=original;
 for(let i=0;i<3;i++)state=resolveRps(state,'rock','rock');
 assert.equal(state.phase,'rps');assert.equal(state.rpsRound,4);assert.deepEqual(state.score,[4,6]);
 const won=resolveRps(state,'paper','rock');assert.equal(won.phase,'finished');assert.equal(won.player,0);assert.deepEqual(won.score,[6,6]);assert.deepEqual(original.score,[4,6]);
 assert.equal(resolveRps(won,'paper','rock'),won);
});
test('missing the selection deadline loses the pair once',()=>{
 const lost=resolveRps({...newGame(),phase:'rps'},null,'scissors');assert.equal(lost.player,1);assert.deepEqual(lost.score,[0,2]);assert.equal(lost.wonBy,'rps');
 assert.equal(resolveRps(lost,null,'rock'),lost);
});
test('cap throws cannot change the score during RPS',()=>{
 const state={...newGame(),phase:'rps'};assert.equal(resolveTurn(state,1,()=>0),state);
});
