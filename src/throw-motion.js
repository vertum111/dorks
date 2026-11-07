import * as THREE from 'three';
export const RELEASE=.36,IMPACT=.58,DURATION=1250,READY=.18;
const smooth=(a,b,x)=>THREE.MathUtils.smootherstep(x,a,b);
export function throwFrame(p,settings={}){
  const release=settings.releaseAt??RELEASE,impact=release+.22;
  const windup=smooth(0,READY,p),strike=smooth(.22,release+.04,p),recover=smooth(impact,.87,p);
  const withdraw=smooth(release-.01,release+.035,p)*(1-smooth(.84,1,p));
  return {
    release,impact,
    lift:.42*windup-.54*strike+.12*recover+(settings.retractLift??.72)*withdraw,
    pitch:.10*windup-.30*strike+.20*recover,
    retreat:(settings.retractDistance??1.15)*withdraw,
    fingers:smooth(release-.06,release+.015,p),
    fall:THREE.MathUtils.clamp((p-release)/(impact-release),0,1),
    bounce:THREE.MathUtils.clamp((p-impact)/(1-impact),0,1),
    phase:p<.22?'Wind-up':p<release?'Impact':p<impact?'Release':p<.84?'Bounce':'Finish'
  };
}
const axisX=new THREE.Vector3(1,0,0),axisY=new THREE.Vector3(0,1,0);
export function applyHandFrame(hand,p,base=new THREE.Vector3(0,.28,0),yaw=0,reduced=false){
  const settings=hand.userData.settings,f=p===null?{lift:0,pitch:0,retreat:0,fingers:0}:throwFrame(p,settings);
  const yawRotation=new THREE.Quaternion().setFromAxisAngle(axisY,yaw);
  const wrist=new THREE.Quaternion().setFromEuler(new THREE.Euler(...['wristPitch','wristYaw','wristRoll'].map(k=>THREE.MathUtils.degToRad(settings[k]??0))));
  const motion=new THREE.Quaternion().setFromAxisAngle(axisX,reduced?0:f.pitch);
  hand.quaternion.copy(yawRotation).multiply(wrist).multiply(motion);
  const pivot=hand.userData.wristPivot;
  hand.position.copy(base).add(pivot.clone().applyQuaternion(yawRotation)).sub(pivot.clone().applyQuaternion(hand.quaternion));
  if(!reduced)hand.position.add(new THREE.Vector3(0,f.lift,f.retreat).applyQuaternion(yawRotation));
  hand.userData.pose(f.fingers);hand.updateMatrixWorld(true);return f;
}
export function tableHeight(settings){return -(settings.tableDrop??1.35);}
export function capSupportHeight(quaternion){
  const normal=new THREE.Vector3(0,1,0).applyQuaternion(quaternion),vertical=Math.abs(normal.y);
  return .85*Math.sqrt(Math.max(0,1-vertical*vertical))+.012*vertical;
}
export function applyCapFlight(mesh,p,{releasePosition,releaseQuaternion,landingPosition,initialFace=false,resultFace=true,yaw=0,settings={},reduced=false}){
  const f=throwFrame(p,settings),b=f.bounce,ease=1-(1-b)**2;
  const flat=new THREE.Quaternion().setFromEuler(new THREE.Euler(initialFace?0:Math.PI,yaw,0));
  const landing=new THREE.Quaternion().setFromEuler(new THREE.Euler(resultFace?0:Math.PI,yaw,0));
  if(p<f.impact)mesh.quaternion.slerpQuaternions(releaseQuaternion,flat,smooth(.30,.95,f.fall));
  else {mesh.quaternion.slerpQuaternions(flat,landing,ease);if(!reduced)mesh.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axisX,Math.PI*2*ease));}
  mesh.position.lerpVectors(releasePosition,landingPosition,f.fall*f.fall);
  const floor=tableHeight(settings),support=capSupportHeight(mesh.quaternion);
  if(p<f.impact)mesh.position.y=Math.max(floor+support,THREE.MathUtils.lerp(releasePosition.y,landingPosition.y,.55*f.fall+.45*f.fall*f.fall));
  else mesh.position.y=floor+support+(reduced?0:Math.sin(b*Math.PI)*.16*(1-.55*b));
  return f;
}
