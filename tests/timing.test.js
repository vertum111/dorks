import test from 'node:test';
import assert from 'node:assert/strict';
import {timingPosition,timingResult,SWEEP_MS,createTimingTargets,INITIAL_TARGET_WIDTH,MIN_TARGET_WIDTH} from '../src/throw-meter.js';
test('sweep is continuous and offers the same target on both passes',()=>{
 assert.equal(timingPosition(0),0);assert.equal(timingPosition(SWEEP_MS),1);assert.equal(timingPosition(SWEEP_MS*2),0);
 for(const p of [.1,.64,.72,.8,.95]){assert.ok(Math.abs(timingPosition(p*SWEEP_MS)-p)<1e-12);assert.ok(Math.abs(timingPosition((2-p)*SWEEP_MS)-p)<1e-12);}
 assert.equal(timingPosition(-1),0);assert.equal(timingPosition(NaN),0);
});
test('targets shrink by match throw count, move noticeably, stay on the rail and stop shrinking at the floor',()=>{
 const targets=createTimingTargets(()=>.5);let previous=targets.get(0);
 assert.equal(previous.width,INITIAL_TARGET_WIDTH);
 for(let turn=1;turn<50;turn++){
  const target=targets.get(turn);assert.ok(target.width<=previous.width);assert.ok(target.width>=MIN_TARGET_WIDTH);assert.ok(target.start>0&&target.end<1);assert.ok(Math.abs(target.center-previous.center)>=.179999);previous=target;
 }
 assert.equal(previous.width,MIN_TARGET_WIDTH);
 assert.equal(targets.get(4),targets.get(4));
 assert.equal(createTimingTargets().get(0).width,INITIAL_TARGET_WIDTH);
});
test('a resumed match has the difficulty of its throw index and randomness changes positions',()=>{
 const a=createTimingTargets(()=>0),b=createTimingTargets(()=>.4);
 assert.notEqual(a.get(1).center,b.get(1).center);
 assert.ok(a.get(5).width<a.get(0).width);
});
test('accuracy follows the relocated narrowed target rather than the old fixed green zone',()=>{
 const target={center:.35,width:.04};
 assert.equal(timingResult(.35,target).skill,1);assert.equal(timingResult(.35,target).grade,'perfect');
 for(const p of [.33,.37]){assert.equal(timingResult(p,target).grade,'sweet');assert.ok(Math.abs(timingResult(p,target).skill-.8)<1e-12);}
 assert.equal(timingResult(.329,target).grade,'early');assert.equal(timingResult(.371,target).grade,'late');
 assert.equal(timingResult(.72,target).percent,0);
 assert.equal(timingResult(.38,{center:.35,width:.10}).grade,'sweet');assert.equal(timingResult(.38,target).grade,'late');
});
