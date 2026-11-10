import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {publishedGrip} from '../src/grip-settings.js';
import {rigHand} from '../src/rigged-hand.js';
import {applyHandFrame,applyCapFlight,tableHeight,throwFrame,capSupportHeight} from '../src/throw-motion.js';
const bytes=await fs.readFile(new URL('../public/models/webxr-hand/right.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const settings=publishedGrip,hand=rigHand(gltf.scene,settings);
let mesh;hand.traverse(o=>{if(o.isSkinnedMesh)mesh=o;});
function intersectsCap(cap){
 mesh.skeleton.update();cap.updateMatrixWorld(true);const inverse=cap.matrixWorld.clone().invert();
 const vertices=[];
 for(let i=0;i<mesh.geometry.attributes.position.count;i++){
  const v=new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i);mesh.applyBoneTransform(i,v);v.applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);vertices.push(v);
 }
 const index=mesh.geometry.index.array;
 for(let i=0;i<index.length;i+=3){
  const tri=[vertices[index[i]],vertices[index[i+1]],vertices[index[i+2]]];
  if(tri.every(v=>v.y>.014)||tri.every(v=>v.y<-.014))continue;
  if(tri.some(v=>Math.abs(v.y)<.014&&v.x*v.x+v.z*v.z<1))return true;
  const cuts=[];
  for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3];if(a.y*b.y<0)cuts.push(a.clone().lerp(b,a.y/(a.y-b.y)));}
  if(cuts.length>=2){const a=cuts[0],b=cuts[1],d=b.clone().sub(a),t=THREE.MathUtils.clamp(-(a.x*d.x+a.z*d.z)/(d.x*d.x+d.z*d.z),0,1);if((a.x+t*d.x)**2+(a.z+t*d.z)**2<1)return true;}
 }
 return false;
}
for(const [wrist,player] of [[[0,0,0],-1],[[15,-20,10],-1],[[0,0,0],0],[[0,0,0],1]])test(`saved user grip: free cap clears the actual skin, wrist ${wrist}, player ${player}`,()=>{
 hand.userData.applyGripSettings({...settings,wristPitch:wrist[0],wristYaw:wrist[1],wristRoll:wrist[2]});
 const s=hand.userData.settings,release=throwFrame(0,s).release;
 const base=player<0?new THREE.Vector3(0,.28,0):new THREE.Vector3(player===0?2.45:-2.45,.28,player===0?2:-2),yaw=player<0?0:player===0?.3:Math.PI+.3;
 applyHandFrame(hand,release,base,yaw);const start=hand.localToWorld(hand.userData.grip.clone()),rotation=hand.quaternion.clone().multiply(hand.userData.gripRotation);if(player>=0)rotation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI));
 const cap=new THREE.Object3D();cap.scale.setScalar(.85);const floor=player<0?new THREE.Vector3(-1.1,tableHeight(s)+.012,-1.8):new THREE.Vector3(player===0?.83:-.83,tableHeight(s)+.012,player===0?.28:-.28),collisions=[];
 for(let i=0;i<=180;i++){
  const p=release+.005+(1-release-.005)*i/180;applyHandFrame(hand,p,base,yaw);
  applyCapFlight(cap,p,{releasePosition:start,releaseQuaternion:rotation,landingPosition:floor,initialFace:player<0,resultFace:player>=0,yaw:player<0?0:player===0?-.2:Math.PI-.2,settings:s});
  assert.ok(cap.position.y-capSupportHeight(cap.quaternion)>=tableHeight(s)-1e-5,'cap passes through table');
  if(intersectsCap(cap))collisions.push(+p.toFixed(3));
 }
 assert.deepEqual(collisions,[]);
});
test('wrist rotation preserves the world position of the wrist pivot',()=>{
 hand.userData.applyGripSettings({...settings,wristPitch:35,wristYaw:-20,wristRoll:25});applyHandFrame(hand,null);
 const pivot=hand.localToWorld(hand.userData.wristPivot.clone());const expected=hand.userData.wristPivot.clone().add(new THREE.Vector3(0,.28,0));
 assert.ok(pivot.distanceTo(expected)<1e-8);
});
