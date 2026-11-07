import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {throwFrame,applyHandFrame,tableHeight} from '../src/throw-motion.js';
import {rigHand} from '../src/rigged-hand.js';
const bytes=await fs.readFile(new URL('../public/models/webxr-hand/right.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const hand=rigHand(gltf.scene),center=hand.userData.grip;
const tip=name=>hand.userData.bones.get(name).getWorldPosition(new THREE.Vector3());
test('finger pads meet opposite edges of the actual 0.85-radius cap',()=>{
 hand.userData.pose(0);hand.updateMatrixWorld(true);
 const a=tip('thumb-tip').sub(center),b=tip('index-finger-tip').sub(center);
 for(const v of [a,b]){assert.ok(Math.abs(v.y)<.03);assert.ok(v.length()>.88&&v.length()<.97);}
 assert.ok(a.normalize().dot(b.normalize())<-.98);
});
test('release clears both pads outwards without sweeping through the cap',()=>{
 let previous=[0,0];
 for(let i=0;i<=20;i++){
  hand.userData.pose(i/20);hand.updateMatrixWorld(true);
  const radii=['thumb-tip','index-finger-tip'].map(n=>tip(n).distanceTo(center));
  radii.forEach((r,k)=>assert.ok(r>=previous[k]-.001));previous=radii;
 }
 previous.forEach(r=>assert.ok(r>1.10));
});
test('all 25 joints retain finite skinning transforms throughout release',()=>{
 for(let i=0;i<=20;i++){
  hand.userData.pose(i/20);hand.updateMatrixWorld(true);
  assert.equal(hand.userData.bones.size,25);
  for(const bone of hand.userData.bones.values())assert.ok(bone.matrixWorld.elements.every(Number.isFinite));
 }
});

test('the deformed hand clears the table during the complete throw',()=>{
 let mesh;hand.traverse(o=>{if(o.isSkinnedMesh)mesh=o;});
 for(let i=0;i<=50;i++){
  applyHandFrame(hand,i/50,new THREE.Vector3(0,.28,0),0);hand.updateMatrixWorld(true);mesh.skeleton.update();
  for(let v=0;v<mesh.geometry.attributes.position.count;v++){
   const p=new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,v);mesh.applyBoneTransform(v,p);p.applyMatrix4(mesh.matrixWorld);assert.ok(p.y>tableHeight(hand.userData.settings)+.015,`skin touched actual game table at frame ${i}`);
  }
 }
});

test('editing a grip during a transformed throw preserves the hand transform',()=>{
 const position=hand.position.clone(),rotation=hand.quaternion.clone();
 hand.userData.applyGripSettings({capY:.9,capRoll:10});hand.userData.pose(0);hand.updateMatrixWorld(true);
 assert.ok(hand.position.distanceTo(position)<1e-10);assert.ok(hand.quaternion.angleTo(rotation)<1e-7);
 const localTip=hand.worldToLocal(tip('index-finger-tip'));
 const expected=new THREE.Vector3(.53,0,-.848).normalize().multiplyScalar(.91).applyQuaternion(hand.userData.gripRotation).add(hand.userData.grip);
 assert.ok(localTip.distanceTo(expected)<.001);assert.equal(hand.userData.grip.y,.9);
});

test('expressive hand poses isolate the extended fingers and preserve the grip',()=>{
 const gripBefore=JSON.stringify(hand.userData.settings);
 function extension(finger){const chain=hand.userData.chains[finger];return chain.at(-1).getWorldPosition(new THREE.Vector3()).distanceTo(chain[1].getWorldPosition(new THREE.Vector3()));}
 const values={};
 for(const name of ['paper','rock','scissors','middle']){
  hand.userData.pose(1,true);hand.userData.gesture(name);hand.updateMatrixWorld(true);
  values[name]=['index-finger','middle-finger','ring-finger'].map(extension);
  for(const bone of hand.userData.bones.values())assert.ok(bone.matrixWorld.elements.every(Number.isFinite));
 }
 assert.ok(values.rock[0]<values.paper[0]*.65);assert.ok(values.rock[1]<values.paper[1]*.65);
 assert.ok(values.middle[1]>values.middle[0]*1.5);assert.ok(values.middle[1]>values.middle[2]*1.5);
 assert.ok(values.scissors[0]>values.scissors[2]*1.5);assert.ok(values.scissors[1]>values.scissors[2]*1.5);
 assert.equal(JSON.stringify(hand.userData.settings),gripBefore);
});

test('middle gesture rotation keeps the wrist fixed without changing saved grip',async()=>{
 const {presentGesture}=await import('../src/gestures.js');
 const {normalizeGesture,gestureDefaults}=await import('../src/gesture-settings.js');
 const settingsBefore=JSON.stringify(hand.userData.settings);
 hand.position.set(1,2,3);hand.rotation.set(.3,.8,-.2);
 const wrist=hand.userData.wristPivot.clone().applyQuaternion(hand.quaternion).add(hand.position);
 const initial=hand.quaternion.clone();
 presentGesture(hand,'middle',1,1,{pitch:70,yaw:-35,roll:20});
 assert.ok(hand.userData.wristPivot.clone().applyQuaternion(hand.quaternion).add(hand.position).distanceTo(wrist)<1e-9);
 assert.ok(initial.angleTo(hand.quaternion)>.1);
 assert.equal(JSON.stringify(hand.userData.settings),settingsBefore);
 assert.deepEqual(normalizeGesture({pitch:400,yaw:NaN,roll:-45}),{...gestureDefaults,pitch:180,yaw:0,roll:-45});
});

test('finger settings migrate saved wrist rotation and adjust only the selected victory finger',async()=>{
 const {normalizeGesture,gestureDefaults}=await import('../src/gesture-settings.js');
 const settings=normalizeGesture({pitch:45,yaw:-20,roll:12});
 assert.deepEqual(settings,{...gestureDefaults,pitch:45,yaw:-20,roll:12});
 const gripBefore=JSON.stringify(hand.userData.settings);
 hand.userData.pose(1,true);hand.userData.gesture('middle',1,settings);
 const baseline=new Map([...hand.userData.bones].map(([n,b])=>[n,b.quaternion.clone()]));
 hand.userData.pose(1,true);hand.userData.gesture('middle',1,{...settings,indexJoint1:40});
 for(const [name,bone] of hand.userData.bones){
  const angle=bone.quaternion.clone().normalize().angleTo(baseline.get(name).clone().normalize());
  if(name==='index-finger-phalanx-intermediate')assert.ok(angle>.6);
  else assert.ok(angle<1e-6,`${name} changed with index adjustment`);
 }
 const tuned=hand.userData.bones.get('index-finger-phalanx-intermediate').quaternion.clone();
 // Rebuild the same adjustment after changing the root transform.
 hand.userData.gesture('middle',1,{...settings,indexJoint1:39});
 hand.position.set(-4,6,2);hand.rotation.set(-.7,1.3,.8);
 hand.userData.pose(1,true);hand.userData.gesture('middle',1,{...settings,indexJoint1:40});
 assert.ok(tuned.clone().normalize().angleTo(hand.userData.bones.get('index-finger-phalanx-intermediate').quaternion.clone().normalize())<1e-6);
 hand.userData.pose(1,true);hand.userData.gesture('paper',1,settings);
 const paper=new Map([...hand.userData.bones].map(([n,b])=>[n,b.quaternion.clone()]));
 hand.userData.gesture('paper',1,{...settings,indexJoint1:40,thumbSpread:45});
 for(const [name,bone] of hand.userData.bones)assert.ok(bone.quaternion.clone().normalize().angleTo(paper.get(name).clone().normalize())<1e-6);
 assert.equal(JSON.stringify(hand.userData.settings),gripBefore);
 // Clearing adjustments restores exactly the original middle-finger pose.
 hand.userData.gesture('middle',1,settings);
 for(const [name,bone] of hand.userData.bones)assert.ok(bone.quaternion.clone().normalize().angleTo(baseline.get(name).clone().normalize())<1e-6);
});

test('victory offsets move only the winning gesture and keep its wrist rotation intact',async()=>{
 const {presentGesture}=await import('../src/gestures.js');
 const {normalizeGesture}=await import('../src/gesture-settings.js');
 const basePosition=new THREE.Vector3(-2.45,.28,-2),baseRotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,Math.PI+.3,0));
 const settings=normalizeGesture({pitch:-90,yaw:20,roll:0,indexJoint1:30});
 function show(name,value){hand.position.copy(basePosition);hand.quaternion.copy(baseRotation);hand.userData.pose(1,true);presentGesture(hand,name,1,1,value);return {position:hand.position.clone(),rotation:hand.quaternion.clone(),wrist:hand.userData.wristPivot.clone().applyQuaternion(hand.quaternion).add(hand.position)};}
 const before=show('middle',settings),after=show('middle',{...settings,positionX:.35,positionY:-.2,positionZ:2});
 assert.ok(after.wrist.clone().sub(before.wrist).distanceTo(new THREE.Vector3(.35,-.2,2))<1e-9);
 assert.ok(after.rotation.clone().normalize().angleTo(before.rotation.clone().normalize())<1e-6);
 const paper=show('paper',settings),paperOffset=show('paper',{...settings,positionZ:2});assert.ok(paper.position.distanceTo(paperOffset.position)<1e-9);
});

test('the wrist bone bends at a fixed joint without changing the local finger pose or cap grip',async()=>{
 const {normalizeGesture}=await import('../src/gesture-settings.js');const settings=normalizeGesture({indexJoint1:25,ringJoint2:-10});
 const gripBefore=JSON.stringify(hand.userData.settings);hand.userData.pose(1,true);hand.userData.gesture('middle',1,settings);hand.updateMatrixWorld(true);
 const wrist=hand.userData.bones.get('wrist'),anchor=wrist.getWorldPosition(new THREE.Vector3());
 const local=new Map([...hand.userData.bones].map(([n,b])=>[n,b.quaternion.clone().normalize()]));
 const oldTip=hand.userData.bones.get('middle-finger-tip').getWorldPosition(new THREE.Vector3());
 hand.userData.gesture('middle',1,{...settings,wristJointPitch:25,wristJointYaw:-10,wristJointRoll:15});hand.updateMatrixWorld(true);
 assert.ok(wrist.getWorldPosition(new THREE.Vector3()).distanceTo(anchor)<1e-9);
 assert.ok(hand.userData.bones.get('middle-finger-tip').getWorldPosition(new THREE.Vector3()).distanceTo(oldTip)>.1);
 for(const [name,bone] of hand.userData.bones){const delta=bone.quaternion.clone().normalize().angleTo(local.get(name));if(name==='wrist')assert.ok(delta>.2);else assert.ok(delta<1e-6,`${name} local pose changed with wrist bend`);}
 hand.userData.pose(0);const capGripWrist=wrist.quaternion.clone();hand.userData.pose(0);assert.ok(wrist.quaternion.clone().normalize().angleTo(capGripWrist.normalize())<1e-6);
 assert.equal(JSON.stringify(hand.userData.settings),gripBefore);
});

test('custom rock pose changes the selected joint and preserves the saved cap grip',()=>{
 const settings={...hand.userData.settings};hand.userData.pose(1);hand.userData.gesture('rock');hand.updateMatrixWorld(true);const before=tip('thumb-tip');
 hand.userData.pose(1);hand.userData.gesture('rock',1,{thumbJoint0:19});hand.updateMatrixWorld(true);assert.ok(before.distanceTo(tip('thumb-tip'))>.03);assert.deepEqual(hand.userData.settings,settings);
 hand.userData.pose(0);
});
test('finger-drumming cycles articulate the rig without writing to the grip or wrist settings',()=>{
 const settings={...hand.userData.settings},positions=[];
 for(const t of [0,.25,.5,.75,1,1.25,1.5,1.75]){hand.userData.drum(t);hand.updateMatrixWorld(true);positions.push(tip('index-finger-tip'));for(const bone of hand.userData.bones.values())assert.ok(bone.quaternion.toArray().every(Number.isFinite));}
 assert.ok(positions.some(p=>p.distanceTo(positions[0])>.02));assert.deepEqual(hand.userData.settings,settings);hand.userData.pose(0);
});

test('thumb grip bends toward the palm side instead of buckling above the palm',async()=>{
 const model=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const rig=rigHand(model.scene);
 for(const openness of [0,.25,.5,.75,1]){
  rig.userData.pose(openness);rig.updateMatrixWorld(true);
  const points=rig.userData.chains.thumb.map(b=>b.getWorldPosition(new THREE.Vector3()));
  const chord=points[2].clone().sub(points[0]).normalize(),bend=points[1].clone().sub(points[0]);
  const perpendicular=bend.addScaledVector(chord,-bend.dot(chord));
  assert.ok(perpendicular.y<0,'thumb hinge must stay on the palm side throughout release');
 }
});

test('thumb distal joint does not counter-fold through grip and release for either player',async()=>{
 const model=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');const rig=rigHand(model.scene);
 const saved=JSON.parse(await fs.readFile(new URL('../presets/user-grip-2026-11-03.json',import.meta.url),'utf8'));
 for(const profile of [{},saved])for(const player of [0,1]){
  rig.userData.applyGripSettings(profile);rig.rotation.set(0,player===0?.3:Math.PI+.3,0);
  for(let i=0;i<=20;i++){
   rig.userData.pose(i/20);rig.updateMatrixWorld(true);const points=rig.userData.chains.thumb.map(b=>b.getWorldPosition(new THREE.Vector3()));
   const incoming=points[2].clone().sub(points[1]).normalize(),outgoing=points[3].clone().sub(points[2]).normalize();
   assert.ok(incoming.dot(outgoing)>Math.cos(Math.PI/4),`distal thumb kink at player ${player}, release ${i/20}`);
  }
 }
});
