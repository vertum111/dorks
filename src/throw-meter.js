export const SWEEP_MS=1200, MIN_HOLD_MS=180;
export const INITIAL_TARGET_WIDTH=.10,MIN_TARGET_WIDTH=.04;
export function timingPosition(elapsed){
 const pass=(Math.max(0,Number.isFinite(elapsed)?elapsed:0)%(SWEEP_MS*2))/SWEEP_MS;
 return pass<=1?pass:2-pass;
}
export function createTimingTargets(random=Math.random){
 const targets=[];
 return {get(turn=0){
  turn=Math.max(0,Math.floor(Number.isFinite(turn)?turn:0));
  while(targets.length<=turn){
   const index=targets.length,width=Math.max(MIN_TARGET_WIDTH,INITIAL_TARGET_WIDTH*.86**index);
   let center=.72;
   if(index){const previous=targets[index-1].center;let tries=0;do{center=.30+Math.max(0,Math.min(1,random()))*.55;tries++;}while(Math.abs(center-previous)<.18&&tries<8);if(Math.abs(center-previous)<.18)center=previous>.575?.30:.85;}
   targets.push(Object.freeze({center,width,start:center-width/2,end:center+width/2}));
  }
  return targets[turn];
 }};
}
export function timingResult(position,target={center:.72,width:INITIAL_TARGET_WIDTH}){
 const distance=Math.abs(position-target.center),inside=distance<=target.width/2+1e-12;
 const skill=Math.max(0,Math.min(1,1-distance/(target.width*2.5)));
 const grade=skill>=.94?'perfect':inside?'sweet':position<target.center?'early':'late';
 return {skill,grade,percent:Math.round(skill*100),label:{perfect:'Perfect!',sweet:'Sweet spot!',early:'Too early',late:'Too late'}[grade]};
}
export function mountThrowMeter(host,{onTarget=()=>{}}={}){
 host.innerHTML=`<div class="meter" role="meter" aria-label="Release timing" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-valuetext="Hold, then release inside the striped target">
  <div class="timing-fill" aria-hidden="true"></div><div class="sweet" aria-hidden="true"><span>★</span></div><div id="needle" aria-hidden="true"></div>
 </div><p id="timing-callout" role="status"></p>`;
 const meter=host.querySelector('.meter'),callout=host.querySelector('#timing-callout');
 let mode='ready',lastZone=false,lastValue=-1,result=null,roundTurn=-1,targets=createTimingTargets(),target;
 function setTarget(turn,sharedTarget){roundTurn=turn;target=sharedTarget||targets.get(turn);host.style.setProperty('--target-start',`${target.start*100}%`);host.style.setProperty('--target-end',`${target.end*100}%`);host.style.setProperty('--target-width',`${target.width*100}%`);}
 function place(position){host.style.setProperty('--timing-position',position);const value=Math.round(position*100);if(value!==lastValue){meter.setAttribute('aria-valuenow',String(value));lastValue=value;}}
 function paint(position){
  place(position);const r=timingResult(position,target),inside=r.grade==='sweet'||r.grade==='perfect';host.dataset.zone=r.grade;
  if(inside!==lastZone){if(inside)onTarget();lastZone=inside;}
  const message=inside?'Release!':r.grade==='late'?'Wait for it…':'Hold…';
  if(callout.textContent!==message){callout.textContent=message;meter.setAttribute('aria-valuetext',inside?'Inside target. Release now.':message);}
 }
 setTarget(0);
 return {
  start(){mode='charging';result=null;lastZone=false;host.dataset.state=mode;paint(0);},
  frame(elapsed){const position=timingPosition(elapsed);if(mode==='charging')paint(position);return position;},
  release(position){result=timingResult(position,target);mode='result';host.dataset.state=mode;host.dataset.zone=result.grade;place(position);callout.textContent=`${result.label} · ${result.percent}%`;meter.setAttribute('aria-valuetext',`${result.label}. ${result.percent} percent timing accuracy, not a guaranteed win.`);return result;},
  cancel(short=false){mode='ready';result=null;lastZone=false;host.dataset.state=mode;host.dataset.zone='idle';place(0);callout.textContent=short?'Hold, don’t tap':'Cancelled';meter.setAttribute('aria-valuetext',callout.textContent);},
  sync({available,finished,turn=0,sharedTarget}){
   host.hidden=finished;if(mode==='charging')return;
   if(available&&(roundTurn!==turn||(sharedTarget&&sharedTarget.center!==target.center))){setTarget(turn,sharedTarget);mode='ready';result=null;lastZone=false;place(0);callout.textContent='';host.dataset.zone='idle';}
   if(result)return;host.dataset.state=available?'ready':'waiting';if(!available){mode='waiting';callout.textContent='';}else if(mode!=='ready'){mode='ready';callout.textContent='';}
  },
  reset(){targets=createTimingTargets();setTarget(0);mode='ready';result=null;lastZone=false;host.dataset.state=mode;host.dataset.zone='idle';place(0);callout.textContent='';}
 };
}
