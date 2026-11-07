import * as THREE from 'three';
import {capMesh,updateCapFoil,setCapOpacity} from './caps.js';
import {dragons,capDistance,isFound,wrapCap} from './cap-catalog.js';
// The carousel camera stays fixed. Dragging rotates only the active 3D cap.
export function createCollectionGallery({renderer,renderScene,environment,onSelect,onFlip,onInteract,reduced}){
 const scene=new THREE.Scene();scene.environment=environment;scene.environmentIntensity=.7;
 const camera=new THREE.PerspectiveCamera(36,1,.1,100);camera.position.set(0,0,9);
 scene.add(new THREE.HemisphereLight('#fff9ea','#c6c5d8',1.8));
 const light=new THREE.DirectionalLight('#ffffff',2.4);light.position.set(-3,4,6);scene.add(light);
 const fill=new THREE.DirectionalLight('#f3e8ff',1);fill.position.set(4,-1,5);scene.add(fill);
 const items=dragons.map((dragon,index)=>({dragon,index,cap:null,opacity:0,offset:99}));
 function ensure(item){if(item.cap)return item.cap;const cap=capMesh(item.dragon);cap.material[2].map.rotation+=Math.PI;for(const material of cap.material)if(material.isMeshPhysicalMaterial){material.clearcoat=isFound(item.dragon) ? 0 : .45;material.clearcoatRoughness=.2;material.specularIntensity=.35;material.envMapIntensity=.4;}cap.userData.galleryIndex=item.index;cap.visible=false;scene.add(cap);item.cap=cap;return cap;}

 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),base=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2),targetQuat=new THREE.Quaternion();
 let visibleIndices=items.map(item=>item.index);
 let active=0,enabled=false,spinX=0,spinY=0,flip=0,zoom=1,previousTime=0,drag;
 function select(index){index=wrapCap(index);if(index!==active){spinX=spinY=flip=0;zoom=1;}active=index;ensure(items[active]);}
 function step(direction){
  return visibleIndices[wrapCap(visibleIndices.indexOf(active)+direction,visibleIndices.length)];
 }
 function setFilter(indices){visibleIndices=indices;drag=null;}
 function hit(event){const r=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(items.filter(i=>i.cap?.visible).map(i=>i.cap),true)[0];let node=hit?.object;while(node&&node.userData.galleryIndex===undefined)node=node.parent;return node?.userData.galleryIndex;}
 renderer.domElement.addEventListener('pointerdown',event=>{if(!enabled||event.button!==0)return;event.preventDefault();drag={x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,hit:hit(event),moved:false};renderer.domElement.setPointerCapture(event.pointerId);});
 renderer.domElement.addEventListener('pointermove',event=>{if(!enabled||!drag)return;const dx=event.clientX-drag.lastX,dy=event.clientY-drag.lastY;if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>5)drag.moved=true;if(drag.hit===active){if(drag.moved)onInteract?.();spinY+=dx*.009;spinX+=dy*.009;}drag.lastX=event.clientX;drag.lastY=event.clientY;});
 renderer.domElement.addEventListener('pointerup',event=>{if(!enabled||!drag)return;if(!drag.moved&&drag.hit===active){spinX=spinY=0;flip=flip===0?Math.PI:0;onInteract?.();onFlip?.();}else if(!drag.moved&&drag.hit!==undefined&&drag.hit!==active)onSelect(drag.hit);else if(drag.moved&&drag.hit===undefined&&Math.abs(event.clientX-drag.x)>45)onSelect(step(event.clientX<drag.x?1:-1));drag=null;});
 renderer.domElement.addEventListener('pointercancel',()=>drag=null);
 renderer.domElement.addEventListener('wheel',event=>{if(!enabled)return;event.preventDefault();zoom=THREE.MathUtils.clamp(zoom*Math.exp(-event.deltaY*.001),.7,1.4);},{passive:false});
 function draw(time){
  const dt=previousTime?Math.min(60,time-previousTime):16;previousTime=time;const ease=reduced?1:1-Math.exp(-dt/95);
  const mobile=camera.aspect<1.25;
  const activePosition=visibleIndices.indexOf(active);
  items.forEach(item=>{
   const positionInFilter=visibleIndices.indexOf(item.index);
   const offset=positionInFilter<0?Infinity:capDistance(positionInFilter,activePosition,visibleIndices.length);
   const distance=Math.abs(offset),visible=distance<=(mobile?2:3),side=Math.sign(offset);
   if(!visible){if(item.cap)item.cap.visible=false;item.opacity=0;item.offset=offset;return;}
   ensure(item);
   const x=distance===0?0:side*(mobile?[0,2.28,3.55][distance]:[0,3.0,4.85,6.05][distance]);
   const scale=[1.85,.87,.56,.35][distance]*(distance===0?zoom:1),opacity=[1,.65,.29,.11][distance];
   const position=new THREE.Vector3(x,distance===0?.1:0,distance===0?.35:-distance*.3);
   if(!item.cap.visible||Math.abs(offset-item.offset)>2){item.cap.position.copy(position);item.cap.scale.setScalar(scale);}
   item.cap.visible=true;item.offset=offset;item.cap.position.lerp(position,ease);item.cap.scale.lerp(new THREE.Vector3().setScalar(scale),ease);
   targetQuat.setFromEuler(new THREE.Euler(distance===0?spinX:0,distance===0?spinY+flip:-side*.28,distance===0?0:-side*.055)).multiply(base);item.cap.quaternion.slerp(targetQuat,ease);
   item.opacity=THREE.MathUtils.lerp(item.opacity,opacity,ease);setCapOpacity(item.cap,item.opacity);updateCapFoil(item.cap,reduced?0:time/1000,camera);item.cap.renderOrder=10-distance;
  });
  renderScene(scene,camera);
 }
 return {draw,select,step,setFilter,setEnabled(value){enabled=value;drag=null;},resize(width,height){camera.aspect=width/Math.max(1,height);camera.updateProjectionMatrix();},flip(){flip=flip===0?Math.PI:0;return flip!==0;},reset(){spinX=spinY=flip=0;zoom=1;},get activeCap(){return ensure(items[active]);},get isBack(){return flip!==0;}};
}
