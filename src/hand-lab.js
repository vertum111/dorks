import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {mountGripTuner} from './grip-tuner.js';
import {loadRiggedHand} from './rigged-hand.js';
import {capMesh,dragons} from './caps.js';
import {throwFrame,applyHandFrame,applyCapFlight,tableHeight} from './throw-motion.js';
import {createHandRenderer} from './hand-outline.js';
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas'),antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
const renderScene=createHandRenderer(renderer);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.01,100);camera.position.set(-2,7,6);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(-.2,-.35,-.8);controls.enableDamping=true;
scene.add(new THREE.HemisphereLight('#ffffff','#a6a1a0',1));const light=new THREE.DirectionalLight('#fff6e1',1.5);light.position.set(-3,7,4);scene.add(light);
const hand=await loadRiggedHand();scene.add(hand);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;light.castShadow=true;light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-5,right:5,top:5,bottom:-5});light.shadow.normalBias=.03;
const floorShadow=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.ShadowMaterial({opacity:.12}));floorShadow.rotation.x=-Math.PI/2;floorShadow.receiveShadow=true;scene.add(floorShadow);
const cap=capMesh(dragons[0]);cap.scale.setScalar(.85);scene.add(cap);
const dots=[...hand.userData.bones.values()].map(bone=>{const dot=new THREE.Mesh(new THREE.SphereGeometry(.045,10,8),new THREE.MeshBasicMaterial({color:'#db3880',depthTest:false}));dot.renderOrder=10;dot.visible=false;scene.add(dot);return {bone,dot};});
let showBones=false,target=0,current=0,fullOpen=false,progress=0,playing=false,lastTime=0,dirty=true;
controls.addEventListener('change',()=>dirty=true);
document.addEventListener('input',()=>dirty=true);document.addEventListener('click',()=>dirty=true);
const timeline=document.querySelector('#timeline'),status=document.querySelector('#status');
for(const [id,value] of [['pose',0],['open',1]])document.getElementById(id).onclick=()=>{playing=false;progress=0;timeline.value=0;fullOpen=!!value;target=value;cap.visible=!value;document.querySelector('#pose').setAttribute('aria-pressed',String(!value));document.querySelector('#open').setAttribute('aria-pressed',String(!!value));};
document.querySelector('#bones').onclick=e=>{showBones=!showBones;e.target.setAttribute('aria-pressed',String(showBones));dots.forEach(({dot})=>dot.visible=showBones);};
document.querySelector('#side').onclick=()=>{camera.position.set(-5,2.6,3.8);controls.update();};
document.querySelector('#play').onclick=()=>{playing=!playing;fullOpen=false;target=0;cap.visible=true;if(progress>=1)progress=0;document.querySelector('#play').textContent=playing?'Пауза':'Повільний кидок';};
document.querySelector('#phase').onchange=e=>{playing=false;fullOpen=false;target=0;cap.visible=true;progress=({release:throwFrame(0,hand.userData.settings).release,impact:throwFrame(0,hand.userData.settings).impact})[e.target.value]??Number(e.target.value);timeline.value=Math.round(progress*1000);};
timeline.oninput=()=>{playing=false;fullOpen=false;target=0;cap.visible=true;progress=Number(timeline.value)/1000;};
function resize(){dirty=true;const width=Math.max(220,innerWidth-(document.body.classList.contains('tuning')?(innerWidth<=700?295:350):0));renderer.setSize(width,innerHeight);camera.aspect=width/innerHeight;camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();
const releasePosition=new THREE.Vector3(),releaseQuaternion=new THREE.Quaternion();
function setHand(p){floorShadow.position.y=tableHeight(hand.userData.settings);return applyHandFrame(hand,p);}
renderer.setAnimationLoop(t=>{
  const dt=Math.min(.05,(t-lastTime)/1000);lastTime=t;controls.update();
  if(!dirty&&!playing&&Math.abs(current-target)<.0001)return;dirty=false;
  if(playing){progress=Math.min(1,progress+dt/4);timeline.value=Math.round(progress*1000);if(progress===1){playing=false;document.querySelector('#play').textContent='Повільний кидок';}}
  const f=setHand(progress);
  if(progress===0){current=THREE.MathUtils.lerp(current,target,.13);hand.userData.pose(current,fullOpen);}
  if(progress<f.release){cap.position.copy(hand.localToWorld(hand.userData.grip.clone()));cap.quaternion.copy(hand.quaternion).multiply(hand.userData.gripRotation);}
  else {
    setHand(f.release);releasePosition.copy(hand.localToWorld(hand.userData.grip.clone()));releaseQuaternion.copy(hand.quaternion).multiply(hand.userData.gripRotation);setHand(progress);
    const floor=new THREE.Vector3(-1.1,tableHeight(hand.userData.settings)+.012,-1.8);
    applyCapFlight(cap,progress,{releasePosition,releaseQuaternion,landingPosition:floor,initialFace:true,resultFace:false,settings:hand.userData.settings});
  }
  hand.updateMatrixWorld(true);dots.forEach(({bone,dot})=>bone.getWorldPosition(dot.position));
  status.textContent=fullOpen?'Відкрита долоня':`${progress===0?'Хват':f.phase} · ${Math.round(progress*100)}%`;
  renderScene(scene,camera);
});

mountGripTuner(hand,()=>{dirty=true;playing=false;fullOpen=false;target=0;current=0;cap.visible=true;document.querySelector('#play').textContent='Повільний кидок';});
