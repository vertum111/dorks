import * as THREE from 'three';
import {backImage,frontImage,isFound} from './cap-catalog.js';
import {foilFinish,foilUniforms,foilFragment} from './foil.js';
export {dragons,frontImage} from './cap-catalog.js';
const foilData=new WeakMap();
const loader=new THREE.TextureLoader(),ink=[.025,.028,.03];
const outline=()=>({visible:true,thickness:1.8/900,color:ink,alpha:1});
let stampAsset;
function foilStamp(){
 if(!stampAsset){let done,fail;const ready=new Promise((resolve,reject)=>{done=resolve;fail=reject;});const map=loader.load('/brand/dorks-foil-stamp.svg',done,undefined,fail);map.anisotropy=8;stampAsset={map,ready};ready.catch(()=>{});}
 return stampAsset;
}
function makeFoil(material,mask,mode){
 const finish=foilFinish(mode),stamp=foilStamp();
 const data={time:{value:0},view:{value:new THREE.Vector3(0,1,0)},mask};foilData.set(material,data);
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,{dorksFoilTime:data.time,dorksFoilView:data.view,dorksFoilMask:{value:mask},dorksFoilStamp:{value:stamp.map},dorksFoilMode:{value:finish.index},dorksFoilGrid:{value:new THREE.Vector2(...finish.grid)}});
  shader.fragmentShader=foilUniforms+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>\n${foilFragment}`);
 };
 material.customProgramCacheKey=()=>`dorks-foil-v2-${mode}`;
 return stamp.ready;
}
function composeFront(image,dragon){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const c=canvas.getContext('2d');
 c.fillStyle=dragon.color;c.fillRect(0,0,1024,1024);
 if(dragon.foil){
  const finish=foilFinish(dragon.foil),gradient=c.createLinearGradient(0,1024,1024,0);finish.colors.forEach((v,i)=>gradient.addColorStop(i/3,v));c.fillStyle=gradient;c.fillRect(0,0,1024,1024);
  c.save();c.strokeStyle=dragon.foil==='cosmos'?'#e8d7ff55':'#fff8df55';c.lineWidth=1.5;
  if(dragon.foil==='cosmos'){for(let i=0;i<125;i++){const x=(i*173+37)%1024,y=(i*317+71)%1024;c.fillStyle='#eee4ff99';c.beginPath();c.arc(x,y,1+i%3,0,Math.PI*2);c.fill();}}
  else{const step=dragon.foil==='etched'?17:65;for(let i=-1024;i<2048;i+=step){c.beginPath();c.moveTo(i,0);c.lineTo(i+1024,1024);c.stroke();if(dragon.foil==='prism'){c.beginPath();c.moveTo(i,0);c.lineTo(i-1024,1024);c.stroke();}}}c.restore();
 }
 const mask=document.createElement('canvas');mask.width=mask.height=1024;const m=mask.getContext('2d');const fit=Math.min(884/image.width,884/image.height),w=image.width*fit,h=image.height*fit;m.drawImage(image,(1024-w)/2,(1024-h)/2,w,h);c.drawImage(mask,0,0);
 c.strokeStyle='#fbefcf';c.lineWidth=26;c.beginPath();c.arc(512,512,499,0,Math.PI*2);c.stroke();
 return {canvas,mask};
}
export function capMesh(d){
 const loading=[];
 const worn=isFound(d);
 function face(url,front=false){
  let resolveTexture,rejectTexture;loading.push(new Promise((resolve,reject)=>{resolveTexture=resolve;rejectTexture=reject;}));
  let material;
  const map=loader.load(url,async texture=>{
   try{
   if(front&&d.sprite){const composite=composeFront(texture.image,d);texture.image=composite.canvas;texture.needsUpdate=true;
    if(d.foil){const mask=new THREE.CanvasTexture(composite.mask);const stampReady=makeFoil(material,mask,d.foil);material.needsUpdate=true;await stampReady;}}
   resolveTexture(texture);
   }catch(error){rejectTexture(error);}
  },undefined,rejectTexture);
  map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;map.center.set(.5,.5);map.rotation=front?Math.PI/2:-Math.PI/2;
  material=new THREE.MeshPhysicalMaterial({map,roughness:worn ? .73 : .22,metalness:front&&d.foil ? .22:.02,clearcoat:worn ? 0 : 1,clearcoatRoughness:.08,emissiveMap:map,emissive:'#ffffff',emissiveIntensity:.10,envMapIntensity:.65,specularIntensity:.65});
  material.userData.outlineParameters={visible:false};return material;
 }
 const rim=new THREE.MeshStandardMaterial({color:worn ? '#9f865d' : d.foil ? '#d4c9e8' : '#dbcba1',metalness:worn ? 0 : .5,roughness:worn ? .75 : .26});rim.userData.outlineParameters=outline();
 const cap=new THREE.Mesh(new THREE.CylinderGeometry(1,1,.028,96),[rim,face(frontImage(d),true),face(backImage(d))]);
 const bevelMaterial=new THREE.MeshBasicMaterial({color:'#111418'});bevelMaterial.userData.outlineParameters={visible:false};
 for(const y of [-.010,.010]){const bevel=new THREE.Mesh(new THREE.TorusGeometry(.997,.004,8,96),bevelMaterial);bevel.rotation.x=Math.PI/2;bevel.position.y=y;cap.add(bevel);}
 cap.castShadow=true;cap.receiveShadow=true;cap.userData.dragon=d.id;cap.userData.ready=Promise.all(loading);cap.userData.ready.catch(()=>{});return cap;
}
const foilEye=new THREE.Vector3();
export function updateCapFoil(cap,time,camera){
 for(const material of cap.material||[])if(foilData.has(material)){
  const data=foilData.get(material);data.time.value=time;
  if(camera){cap.updateWorldMatrix(true,false);camera.getWorldPosition(foilEye);cap.worldToLocal(foilEye).normalize();data.view.value.copy(foilEye);}
 }
}
export function setCapOpacity(cap,opacity){cap.traverse(node=>{if(!node.material)return;for(const m of Array.isArray(node.material)?node.material:[node.material]){if(!m.transparent){m.transparent=true;m.needsUpdate=true;}m.opacity=opacity;m.depthWrite=opacity>.97;if(m.userData.outlineParameters)m.userData.outlineParameters.alpha=opacity;}});}
export function disposeCap(cap){
 const materials=new Set(),geometries=new Set(),textures=new Set();cap.traverse(node=>{if(node.geometry)geometries.add(node.geometry);if(node.material)for(const m of Array.isArray(node.material)?node.material:[node.material])materials.add(m);});
 materials.forEach(m=>{if(m.map)textures.add(m.map);if(foilData.has(m))textures.add(foilData.get(m).mask);m.dispose();});textures.forEach(t=>t.dispose());geometries.forEach(g=>g.dispose());cap.removeFromParent();
}
