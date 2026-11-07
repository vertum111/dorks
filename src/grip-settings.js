export const GRIP_KEY='dorks-grip-v1',DRAFT_KEY='dorks-grip-draft-v1';
export const gripDefaults={wristPitch:0,wristYaw:0,wristRoll:0,outlineEnabled:1,outlineWidth:1.8,tableDrop:1.35,retractDistance:1.15,retractLift:.72,releaseAt:.36,releaseUncurl:.85,capX:-.84,capY:.72,capZ:-1.584,capPitch:0,capYaw:0,capRoll:0,
 thumbX:0,thumbY:0,thumbZ:0,indexX:0,indexY:0,indexZ:0,thumbArch:0,indexArch:0,thumbTip:0,indexTip:0,releaseGap:.25,
 thumbJoint0:0,thumbJoint1:0,thumbJoint2:0,indexJoint0:0,indexJoint1:0,indexJoint2:0,
 middleJoint0:11.46,middleJoint1:-4.58,middleJoint2:-2.29,ringJoint0:18.62,ringJoint1:-7.45,ringJoint2:-3.72,pinkyJoint0:24.35,pinkyJoint1:-9.74,pinkyJoint2:-4.87};
export function normalizeGrip(value={}){return Object.fromEntries(Object.entries(gripDefaults).map(([key,fallback])=>[key,typeof value?.[key]==='number'&&Number.isFinite(value[key])?Math.max(-180,Math.min(180,value[key])):fallback]));}
export function readGripSettings(key=GRIP_KEY){if(typeof window==='undefined')return {...gripDefaults};try{return normalizeGrip(JSON.parse(localStorage.getItem(key)||'{}'));}catch{return {...gripDefaults};}}
