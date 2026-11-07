export function turnCue(state,opponent='Bot'){
 if(!['duel','pair'].includes(state.phase))return null;
 const yours=state.player===0,pair=state.phase==='pair';
 return {key:`${state.turn}:${state.phase}:${state.player}`,kind:pair?'slam':yours?'yours':'rival',title:pair?'SLAM!':yours?'Your turn!':"Rival’s turn!",detail:pair?`${yours?'YOU':opponent.toUpperCase()} · FLIP BOTH CAPS`:yours?'One cap. Make it count.':`${opponent} is throwing.`,caps:pair?2:1,duration:pair?2400:1800};
}
const capIcon='<svg viewBox="0 0 64 55" aria-hidden="true"><ellipse cx="31" cy="31" rx="24" ry="17" fill="#f7ebcb"/><path d="M7 26v7c1 11 46 25 48-2v-5" fill="#f7ebcb" stroke="currentColor" stroke-width="2.5"/><ellipse cx="31" cy="25" rx="24" ry="17" fill="var(--cue-disc,#e99879)" stroke="currentColor" stroke-width="2.5"/><path d="m23 25 6 6 11-12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export function mountMatchCues(){
 const host=document.createElement('div');host.className='match-cue';host.hidden=true;host.setAttribute('role','status');host.setAttribute('aria-live','polite');host.setAttribute('aria-atomic','true');
 host.innerHTML='<div class="cue-caps" aria-hidden="true"></div><div><strong></strong><span></span></div><i aria-hidden="true">✦</i>';document.body.append(host);
 let lastKey=null,timer,entry;
 function hide(){clearTimeout(timer);entry?.cancel();host.hidden=true;}
 function show(cue,parent=document.body){
  if(cue.key===lastKey)return;lastKey=cue.key;hide();parent.append(host);host.dataset.kind=cue.kind;host.querySelector('strong').textContent=cue.title;host.querySelector('span').textContent=cue.detail;
  host.querySelector('.cue-caps').innerHTML=cue.kind==='tie'?'<b>?!</b>':capIcon.repeat(cue.caps);host.hidden=false;
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)entry=host.animate([{opacity:0,translate:'0 12px',rotate:'-5deg',scale:'.82'},{opacity:1,translate:'0 -3px',rotate:'2deg',scale:'1.04'},{opacity:1,translate:'0 0',rotate:'-1deg',scale:'1'}],{duration:360,easing:'cubic-bezier(.2,.8,.2,1)',fill:'both'});
  timer=setTimeout(hide,cue.duration);
 }
 return {sync(state,{visible=true,busy=false,charging=false,opponent='Bot'}={}){if(!visible){hide();lastKey=null;return;}if(state.phase==='rps')return;if(busy||charging||!['duel','pair'].includes(state.phase)){hide();return;}show(turnCue(state,opponent));},tie(round=1){show({key:`tie:${round}`,kind:'tie',title:round>1?'TIE. AGAIN?!':'TIE!',detail:'Let the fingers decide.',caps:0,duration:2000},document.querySelector('#rps-dialog')||document.body);},reset(){hide();lastKey=null;}};
}
