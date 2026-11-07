import test from 'node:test';
import assert from 'node:assert/strict';
import {GESTURE_KEY,BOT_GESTURE_KEY,gestureKey,normalizeGesture,readGestureSettings,defaultBotGesture} from '../src/gesture-settings.js';
test('legacy player settings survive and seed an independent bot pose',()=>{
 const legacy={pitch:-93,yaw:26,roll:8,indexJoint1:31,thumbSpread:-19};
 const before=JSON.stringify(legacy),own=normalizeGesture(legacy),bot=defaultBotGesture(own);
 assert.equal(own.pitch,legacy.pitch);assert.equal(own.indexJoint1,31);assert.equal(own.positionZ,0);
 assert.equal(bot.pitch,legacy.pitch);assert.equal(bot.thumbSpread,-19);assert.equal(bot.positionZ,3.5);
 bot.pitch=45;bot.indexJoint1=-20;assert.equal(own.pitch,legacy.pitch);assert.equal(own.indexJoint1,31);assert.equal(JSON.stringify(legacy),before);
});
test('bot storage is independent and absent bot settings retain the saved player pose',()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');const data=new Map([[GESTURE_KEY,JSON.stringify({pitch:-93,yaw:26,ringJoint2:-17})]]);
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>data.get(key)??null}});
 try{
  const before=data.get(GESTURE_KEY);assert.equal(gestureKey(0),GESTURE_KEY);assert.equal(gestureKey(1),BOT_GESTURE_KEY);
  assert.equal(readGestureSettings(1).ringJoint2,-17);assert.equal(readGestureSettings(1).positionZ,3.5);
  data.set(BOT_GESTURE_KEY,JSON.stringify({pitch:-80,positionY:-.5,positionZ:2.8,ringJoint2:-25}));
  assert.equal(readGestureSettings(1).positionZ,2.8);assert.equal(readGestureSettings(1).ringJoint2,-25);
  assert.equal(readGestureSettings(0).pitch,-93);assert.equal(readGestureSettings(0).positionZ,0);assert.equal(data.get(GESTURE_KEY),before);
  data.set(BOT_GESTURE_KEY,'broken JSON');assert.equal(readGestureSettings(1).positionZ,3.5);assert.equal(readGestureSettings(1).pitch,-93);
 }finally{if(previous)Object.defineProperty(globalThis,'localStorage',previous);else delete globalThis.localStorage;}
});
test('victory positions have finite bounds while saved wrist angles keep their range',()=>{
 const value=normalizeGesture({pitch:170,positionX:100,positionY:NaN,positionZ:-100});assert.equal(value.pitch,170);assert.equal(value.positionX,4);assert.equal(value.positionY,0);assert.equal(value.positionZ,-4);
});

test('rock settings have independent keys and never inherit the victory pose',()=>{
 const keys=new Map([[GESTURE_KEY,JSON.stringify({pitch:71,thumbJoint0:39})]]);globalThis.localStorage={getItem:key=>keys.get(key)??null};
 assert.equal(readGestureSettings(0,'rock').pitch,0);assert.equal(readGestureSettings(0,'rock').thumbJoint0,-94);assert.equal(readGestureSettings(1,'rock').thumbJoint0,-65);
 assert.notEqual(gestureKey(0,'rock'),GESTURE_KEY);assert.notEqual(gestureKey(0,'rock'),gestureKey(1,'rock'));
});
