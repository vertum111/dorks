import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,resolveTurn,accuracy,flipChance} from '../src/game.js';
test('timing rewards the green zone, probabilities bounded',()=>{assert.equal(accuracy(.72),1);assert.equal(accuracy(0),0);assert.equal(flipChance(-1),.16);assert.equal(flipChance(2),.88);});
test('different faces award the pair attempt to successful player',()=>{let s=resolveTurn(newGame(),1,()=>0);s=resolveTurn(s,0,()=>.99);assert.equal(s.phase,'pair');assert.equal(s.player,0);assert.deepEqual(s.faces,[true,false]);});
test('equal outcomes start RPS without awarding points',()=>{let s=resolveTurn(newGame(),1,()=>0);s=resolveTurn(s,1,()=>0);assert.equal(s.phase,'rps');assert.equal(s.player,0);assert.deepEqual(s.faces,[true,true]);assert.deepEqual(s.score,[0,0]);});
test('pair success awards two points once and preserves input',()=>{const s={...newGame(),phase:'pair',faces:[true,false]};const n=resolveTurn(s,1,()=>0);assert.equal(n.phase,'finished');assert.deepEqual(n.score,[2,0]);assert.deepEqual(s.score,[0,0]);assert.deepEqual(resolveTurn(n,1,()=>0).score,[2,0]);});
test('failed pair passes opportunity to opponent',()=>{const s={...newGame(),phase:'pair'};const n=resolveTurn(s,0,()=>.99);assert.equal(n.player,1);assert.equal(n.phase,'pair');assert.deepEqual(n.score,[0,0]);});
test('bot can win pair',()=>{const s={...newGame([2,4]),phase:'pair',player:1};const n=resolveTurn(s,1,()=>0);assert.deepEqual(n.score,[2,6]);assert.equal(n.phase,'finished');});
