import {OutlineEffect} from 'three/addons/effects/OutlineEffect.js';
export function createHandRenderer(renderer){
 const effect=new OutlineEffect(renderer,{defaultThickness:0,defaultAlpha:0});
 return (scene,camera)=>{
  scene.traverse(o=>{for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])if(!m.userData.outlineParameters)m.userData.outlineParameters={visible:false};});
  effect.render(scene,camera);
 };
}
