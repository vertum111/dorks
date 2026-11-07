import {Euler,Quaternion,Vector3} from 'three';
const axis=new Vector3(0,0,1);
// Turn only expressive poses palm-out, like the familiar hand emoji. Rotate
// around the wrist; saved grip transforms and throw trajectories stay intact.
export function presentGesture(hand,name,blend=1,palmBlend=1,rotation=null){
 hand.userData.gesture(name,blend,rotation);
 const pivot=hand.userData.wristPivot,before=pivot.clone().applyQuaternion(hand.quaternion);
 hand.quaternion.multiply(new Quaternion().setFromAxisAngle(axis,Math.PI*palmBlend));
 if(['middle','rock'].includes(name)&&rotation)hand.quaternion.multiply(new Quaternion().setFromEuler(new Euler(rotation.pitch*Math.PI/180*blend,rotation.yaw*Math.PI/180*blend,rotation.roll*Math.PI/180*blend,'XYZ')));
 hand.position.add(before).sub(pivot.clone().applyQuaternion(hand.quaternion));
 if(['middle','rock'].includes(name)&&rotation)hand.position.add(new Vector3(rotation.positionX??0,rotation.positionY??0,rotation.positionZ??0).multiplyScalar(blend));
}
