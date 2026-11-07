import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {readGripSettings,normalizeGrip} from './grip-settings.js';
import {gestureFingers,gestureFingerFields,gestureWristFields,normalizeGesture} from './gesture-settings.js';

// Actual WebXR skinned mesh, MIT licensed. The source rig uses sibling joints
// for tracked XR poses. Convert those into finger chains, preserving bind pose.
export async function loadRiggedHand() {
  const {scene}=await new GLTFLoader().loadAsync('/models/webxr-hand/right.glb');
  return rigHand(scene);
}

export function rigHand(scene) {
  const bones=new Map();scene.traverse(o=>{if(o.isBone)bones.set(o.name,o);});
  const wrist=bones.get('wrist'),chains={};
  for(const finger of ['thumb','index-finger','middle-finger','ring-finger','pinky-finger']){
    const names=finger==='thumb'?['metacarpal','phalanx-proximal','phalanx-distal','tip']:['metacarpal','phalanx-proximal','phalanx-intermediate','phalanx-distal','tip'];
    const chain=names.map(n=>bones.get(`${finger}-${n}`));let parent=wrist;
    for(const bone of chain){parent.attach(bone);parent=bone;}
    chains[finger]=chain;
  }
  scene.updateMatrixWorld(true);
  const rest=new Map([...bones.values()].map(b=>[b,{p:b.position.clone(),q:b.quaternion.clone()}]));
  const material=new THREE.MeshToonMaterial({color:'#f4dcb3'});
  scene.traverse(o=>{if(o.isSkinnedMesh){o.material=material;o.frustumCulled=false;o.castShadow=true;o.receiveShadow=true;}});
  const root=new THREE.Group();root.add(scene);
  // Model axes: x = palm normal, y = wrist->back, z = across palm.
  scene.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(1,0,0)));
  scene.scale.setScalar(24);
  const position=new THREE.Vector3(),tipPosition=new THREE.Vector3(),v=new THREE.Vector3(),w=new THREE.Vector3(),q=new THREE.Quaternion(),inv=new THREE.Quaternion();
  // Three phalanges with a prescribed bend plane. Unlike unconstrained CCD,
  // this keeps the distal joint from folding backwards to reach the cap.
  function place(chain,target,lastDirection,pole) {
    scene.updateMatrixWorld(true);
    const [base,hinge,distal,tip]=chain;
    const points=chain.map(b=>b.getWorldPosition(new THREE.Vector3()));
    const lengths=points.slice(1).map((p,i)=>p.distanceTo(points[i]));
    const end=target.clone().sub(lastDirection.clone().normalize().multiplyScalar(lengths[2]));
    const direction=end.clone().sub(points[0]);
    const distance=THREE.MathUtils.clamp(direction.length(),.01,lengths[0]+lengths[1]-.0001);direction.normalize();
    const along=(lengths[0]**2-lengths[1]**2+distance**2)/(2*distance);
    const height=Math.sqrt(Math.max(0,lengths[0]**2-along**2));
    const bend=pole.clone().addScaledVector(direction,-pole.dot(direction)).normalize();
    const elbow=points[0].clone().addScaledVector(direction,along).addScaledVector(bend,height);
    for(const [bone,child,goal] of [[base,hinge,elbow],[hinge,distal,end],[distal,tip,target]]){
      scene.updateMatrixWorld(true);bone.getWorldPosition(position);child.getWorldPosition(tipPosition);
      v.copy(tipPosition).sub(position).normalize();w.copy(goal).sub(position).normalize();q.setFromUnitVectors(v,w);
      bone.getWorldQuaternion(inv);q.multiply(inv);bone.parent.getWorldQuaternion(inv).invert();bone.quaternion.copy(inv.multiply(q));
    }
  }
  function jointOffsets(chain,angles,axis=new THREE.Vector3(1,0,0)) {
    for(let i=0;i<3;i++){
      const bone=chain[i];scene.updateMatrixWorld(true);bone.parent.getWorldQuaternion(inv).invert();
      const localAxis=axis.clone().applyQuaternion(inv);
      bone.quaternion.premultiply(q.setFromAxisAngle(localAxis,THREE.MathUtils.degToRad(angles[i])));
    }
  }
  function capture(){return new Map([...bones.values()].map(b=>[b,b.quaternion.clone()]));}
  function reset(){for(const [b,r] of rest){b.position.copy(r.p);b.quaternion.copy(r.q);}scene.updateMatrixWorld(true);}
  reset();const openPose=capture();
  // Separate expressive poses. They never write into the saved cap grip.
  const gestures=new Map([['paper',openPose]]);
  for(const name of ['rock','scissors','middle']){
    reset();
    for(const finger of ['index-finger','middle-finger','ring-finger','pinky-finger']){
      const extended=name==='middle'?finger==='middle-finger':name==='scissors'?(finger==='index-finger'||finger==='middle-finger'):false;
      if(!extended)jointOffsets(chains[finger].slice(1),[-78,-96,-48]);
      if(name==='scissors'&&extended)jointOffsets(chains[finger].slice(1),[finger==='index-finger'?10:-9,0,0],new THREE.Vector3(0,1,0));
    }
    place(chains.thumb,new THREE.Vector3(.55,.20,-.65),new THREE.Vector3(1,0,-.15),new THREE.Vector3(0,-1,0));
    gestures.set(name,capture());
  }
  reset();
  for(const finger of ['index-finger','middle-finger','ring-finger','pinky-finger'])jointOffsets(chains[finger].slice(1),[-28,-45,-18]);
  jointOffsets(chains.thumb,[8,-12,-8],new THREE.Vector3(0,0,1));
  const drumRest=capture(),drumRaised=new Map();
  for(const finger of ['index-finger','middle-finger','ring-finger','pinky-finger']){
    for(const bone of bones.values())bone.quaternion.copy(drumRest.get(bone));
    jointOffsets(chains[finger].slice(1),[22,8,0]);drumRaised.set(finger,capture());
  }
  root.userData.drum=(time,still=false)=>{
    for(const bone of bones.values())bone.quaternion.copy(drumRest.get(bone));
    ['pinky-finger','ring-finger','middle-finger','index-finger'].forEach((finger,i)=>{
      const phase=((time/1.9-i*.13)%1+1)%1;
      const lift=still?0:phase<.36?Math.sin(phase/.36*Math.PI)**2:0;
      for(const bone of chains[finger])bone.quaternion.slerp(drumRaised.get(finger).get(bone),lift);
    });
  };
  let adjustedMiddleKey=null,adjustedMiddlePose;
  function middlePose(value,name='middle'){
    const settings=normalizeGesture(value),key=name+':'+[...gestureFingerFields,...gestureWristFields].map(k=>settings[k]).join(',');
    if(key===adjustedMiddleKey)return adjustedMiddlePose;
    // Generate in canonical hand coordinates so edits behave identically for both
    // players and cannot depend on the saved wrist rotation or animation frame.
    const previous=capture(),parent=root.parent,position=root.position.clone(),rotation=root.quaternion.clone(),scale=root.scale.clone();
    root.removeFromParent();root.position.set(0,0,0);root.quaternion.identity();root.scale.setScalar(1);
    for(const bone of bones.values())bone.quaternion.copy(gestures.get(name).get(bone));
    root.updateMatrixWorld(true);
    for(const [finger] of gestureFingers){
      const chain=finger==='thumb'?chains.thumb:chains[`${finger}-finger`].slice(1);
      jointOffsets(chain,[0,1,2].map(i=>settings[`${finger}Joint${i}`]),new THREE.Vector3(...(finger==='thumb'?[0,0,1]:[1,0,0])));
      jointOffsets(chain,[settings[`${finger}Spread`],0,0],new THREE.Vector3(0,1,0));
      jointOffsets(chain,[settings[`${finger}Twist`],0,0],new THREE.Vector3(...(finger==='thumb'?[1,0,0]:[0,0,1])));
    }
    // The actual wrist bone is the parent of all five finger chains. Rotate it
    // after shaping the fingers so the palm bends without reshaping the fist.
    for(const [key,axis] of [['wristJointPitch',new THREE.Vector3(1,0,0)],['wristJointYaw',new THREE.Vector3(0,1,0)],['wristJointRoll',new THREE.Vector3(0,0,1)]]){
      scene.updateMatrixWorld(true);wrist.parent.getWorldQuaternion(inv).invert();
      wrist.quaternion.premultiply(q.setFromAxisAngle(axis.clone().applyQuaternion(inv),THREE.MathUtils.degToRad(settings[key])));
    }
    adjustedMiddlePose=capture();adjustedMiddleKey=key;
    for(const bone of bones.values())bone.quaternion.copy(previous.get(bone));
    if(parent)parent.add(root);root.position.copy(position);root.quaternion.copy(rotation);root.scale.copy(scale);root.updateMatrixWorld(true);
    return adjustedMiddlePose;
  }
  root.userData.gesture=(name,mix=1,settings=null)=>{
    const destination=['middle','rock'].includes(name)&&settings?middlePose(settings,name):gestures.get(name);if(!destination)return;
    for(const bone of bones.values())bone.quaternion.slerp(destination.get(bone),THREE.MathUtils.clamp(mix,0,1));
  };
  root.userData.gestureNames=[...gestures.keys()];
  const grip=new THREE.Vector3(),gripRotation=new THREE.Quaternion();
  const radial=new THREE.Vector3(.53,0,-.848).normalize();
  let closedPose,releasePose,lastOpenness=0,lastFullOpen=false;
  root.userData.pose=(openness,fullOpen=false)=>{
    lastOpenness=THREE.MathUtils.clamp(openness,0,1);lastFullOpen=fullOpen;
    for(const bone of bones.values())bone.quaternion.slerpQuaternions(closedPose.get(bone),(fullOpen?openPose:releasePose).get(bone),lastOpenness);
  };
  root.userData.applyGripSettings=value=>{
    const settings=normalizeGrip(value),parent=root.parent,oldPosition=root.position.clone(),oldQuaternion=root.quaternion.clone(),oldScale=root.scale.clone();
    // Pose generation runs in canonical hand coordinates, even during a throw.
    root.removeFromParent();root.position.set(0,0,0);root.quaternion.identity();root.scale.setScalar(1);root.updateMatrixWorld(true);
    grip.set(settings.capX,settings.capY,settings.capZ);
    gripRotation.setFromEuler(new THREE.Euler(...['capPitch','capYaw','capRoll'].map(k=>THREE.MathUtils.degToRad(settings[k]))));
    function pinch(clearance) {
      reset();
      for(const [name,prefix] of [['middle-finger','middle'],['ring-finger','ring'],['pinky-finger','pinky']])jointOffsets(chains[name].slice(1),[0,1,2].map(i=>settings[`${prefix}Joint${i}`]*(clearance? .9:1)));
      // Thumb pad approaches from below the disc: a downward distal direction
      // counter-folds the last joint against the proximal phalanx (an S-shaped kink).
      for(const [name,prefix,sign,approach] of [['thumb','thumb',-1,new THREE.Vector3(-.35,.72,-.6)],['index-finger','index',1,new THREE.Vector3(0,-.92,-.39)]]){
        const chain=prefix==='thumb'?chains[name]:chains[name].slice(1);
        const offset=new THREE.Vector3(settings[`${prefix}X`],settings[`${prefix}Y`],settings[`${prefix}Z`]);
        const target=radial.clone().multiplyScalar(sign*(.91+clearance)).applyQuaternion(gripRotation).add(grip).add(offset);
        const axis=prefix==='thumb'?new THREE.Vector3(0,0,1):new THREE.Vector3(1,0,0);
        approach.applyAxisAngle(axis,THREE.MathUtils.degToRad(settings[`${prefix}Tip`])).applyQuaternion(gripRotation);
        const pole=new THREE.Vector3(0,prefix==='thumb'?-1:1,0).applyAxisAngle(new THREE.Vector3(0,0,1),THREE.MathUtils.degToRad(settings[`${prefix}Arch`])).applyQuaternion(gripRotation);
        place(chain,target,approach,pole);
        jointOffsets(chain,[0,1,2].map(i=>settings[`${prefix}Joint${i}`]*(clearance?1-settings.releaseUncurl*i/2:1)),axis);
      }
      return capture();
    }
    closedPose=pinch(0);releasePose=pinch(settings.releaseGap);
    if(parent)parent.add(root);root.position.copy(oldPosition);root.quaternion.copy(oldQuaternion);root.scale.copy(oldScale);
    material.userData.outlineParameters={visible:!!settings.outlineEnabled,thickness:settings.outlineWidth/900,color:[0.025,0.028,0.03],alpha:1};
    root.userData.settings=settings;root.userData.pose(lastOpenness,lastFullOpen);root.updateMatrixWorld(true);
  };
  root.userData.wristPivot=new THREE.Vector3(.0091571668,.0391260833,.0557754710).multiplyScalar(24);
  root.userData.gripRotation=gripRotation;
  root.userData.applyGripSettings(readGripSettings());
  root.userData.bones=bones;root.userData.chains=chains;
  root.userData.grip=grip;
  root.userData.model=scene;
  root.userData.pose(0);root.updateMatrixWorld(true);
  return root;
}
