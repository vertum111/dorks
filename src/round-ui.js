import {RPS_CHOICES,RPS_LABELS,resolveRps} from './rps.js';
import {outcomeDragon} from './outcome-dragon.js';
const icons={rock:'✊',scissors:'✌',paper:'✋'};
export function mountRoundUi({onReplay,onCountdown,onReveal,onRpsFinished,onResultOpen,onLobby,onOnlineChoice,onClock,getResultDelay=()=>1100}){
 const host=document.createElement('div');host.innerHTML=`
 <dialog id="rps-dialog" class="rps-dialog" aria-labelledby="rps-title"><div class="rps-bubble">
  <span class="rps-kicker">CAPS TIED? LET THE FINGERS DECIDE.</span>
  <div class="rps-heading"><h2 id="rps-title">Rock. Paper. Showdown!</h2><span class="rps-clock" aria-label="Seconds remaining"><b id="rps-seconds">5</b></span></div>
  <p id="rps-message" role="status">5 seconds. Make your move!</p>
  <div class="rps-choices">${RPS_CHOICES.map((c,i)=>`<button data-rps="${c}" aria-pressed="false"><span aria-hidden="true">${icons[c]}</span><b>${RPS_LABELS[c]}</b><small>${i+1}</small></button>`).join('')}</div>
  <div class="rps-time-track" aria-hidden="true"><i id="rps-time-fill"></i></div><p class="rps-foot">First win takes the pair · ties mean another round</p>
 </div></dialog>
 <dialog id="outcome-dialog" class="outcome-dialog" aria-labelledby="outcome-title"><div class="outcome-cloud">
  <button id="outcome-close" class="round-button outcome-close" aria-label="Back to the table">×</button>
  <span id="outcome-stamp" class="outcome-stamp"></span><div id="outcome-art"></div>
  <div class="outcome-copy"><p id="outcome-kicker"></p><h2 id="outcome-title"></h2><p id="outcome-message"></p><button id="outcome-replay" class="primary">Rematch?</button><button id="outcome-lobby" class="paper-button">Back to lobby</button></div>
 </div></dialog>`;
 document.body.append(host);
 const $=s=>host.querySelector(s),rps=$('#rps-dialog'),outcome=$('#outcome-dialog');
 let tick,delay,roundState,choice=null,opponent,deadline,stage='closed',online=false,opponentName='Bot';
 const buttons=[...host.querySelectorAll('[data-rps]')];
 function clearTimers(){clearInterval(tick);clearTimeout(delay);}
 function reset(){clearTimers();stage='closed';document.body.classList.remove('round-overlay');if(rps.open)rps.close();if(outcome.open)outcome.close();}
 function select(c){if(stage!=='choose')return;choice=c;if(online)onOnlineChoice(c);buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.rps===c)));$('#rps-message').textContent=`Your pick: ${RPS_LABELS[c]}. Change it before zero.`;}
 buttons.forEach(b=>b.onclick=()=>select(b.dataset.rps));
 rps.addEventListener('cancel',e=>e.preventDefault());
 rps.addEventListener('keydown',e=>{const index=Number(e.key)-1;if(stage==='choose'&&index>=0&&index<3){e.preventDefault();select(RPS_CHOICES[index]);}});
 function reveal(){
  if(stage!=='choose')return;clearInterval(tick);stage='reveal';buttons.forEach(b=>b.disabled=true);
  $('#rps-seconds').textContent='!';$('#rps-time-fill').style.transform='scaleX(0)';
  const next=resolveRps(roundState,choice,opponent),same=next.phase==='rps';
  $('#rps-message').textContent=same?`Both picked ${RPS_LABELS[opponent]}. Another tie!`:choice?`${RPS_LABELS[choice]} vs ${RPS_LABELS[opponent]}. ${next.player===0?'You win!':'Bot wins!'}`:'Out of time. Bot takes the pair!';
  onReveal(choice,opponent);
  delay=setTimeout(()=>{if(same){roundState=next;startRound();}else{rps.close();stage='closed';onRpsFinished(next);}},1600);
 }
 function updateClock(){const left=Math.max(0,deadline-performance.now());onClock?.(Math.ceil(left/1000));$('#rps-seconds').textContent=String(Math.ceil(left/1000));$('#rps-time-fill').style.transform=`scaleX(${left/5000})`;if(left===0){if(online){clearInterval(tick);stage='waiting';buttons.forEach(b=>b.disabled=true);$('#rps-message').textContent='Hands locked. Revealing…';}else reveal();}}
 function startRound(){
  document.body.classList.add('round-overlay');clearTimers();choice=null;opponent=RPS_CHOICES[Math.floor(Math.random()*RPS_CHOICES.length)];stage='choose';deadline=performance.now()+5000;
  buttons.forEach(b=>{b.disabled=false;b.setAttribute('aria-pressed','false');});
  $('#rps-title').textContent=roundState.rpsRound>1?`Round ${roundState.rpsRound}. No mercy!`:'Rock. Paper. Showdown!';
  $('#rps-message').textContent='5 seconds. Make your move!';if(!rps.open)rps.showModal();buttons[0].focus();onCountdown(roundState.rpsRound||1);updateClock();tick=setInterval(updateClock,60);
 }
 function startRps(state){reset();online=false;roundState=state;startRound();}
 function startOnlineRps(state,time){reset();online=true;roundState=state;choice=null;stage='choose';deadline=time;document.body.classList.add('round-overlay');buttons.forEach(b=>{b.disabled=false;b.setAttribute('aria-pressed','false');});$('#rps-title').textContent=state.rpsRound>1?`Round ${state.rpsRound}. No mercy!`:'Rock. Paper. Showdown!';$('#rps-message').textContent='5 seconds. Make your move!';rps.showModal();onCountdown(roundState.rpsRound||1);updateClock();tick=setInterval(updateClock,60);}
 function revealOnline(choices,next){clearTimers();stage='reveal';buttons.forEach(b=>b.disabled=true);$('#rps-seconds').textContent='!';const names=choices.map(c=>c?RPS_LABELS[c]:'No pick');$('#rps-message').textContent=`${names[0]} vs ${names[1]}. ${next.phase==='rps'?'Another tie!':next.player===0?'You win!':`${opponentName} wins!`}`;onReveal(choices[0],choices[1]);}

 function showResult(state){
  reset();document.body.classList.add('round-overlay');const won=state.player===0;
  outcome.classList.toggle('is-loss',!won);$('#outcome-art').innerHTML=outcomeDragon(won);
  $('#outcome-stamp').textContent=won?'+2 POINTS':'OOPS.';$('#outcome-kicker').textContent=state.wonBy==='rps'?'THE HANDS HAVE SPOKEN':'THE CAPS HAVE SPOKEN';
  $('#outcome-title').textContent=won?'You win!':'You lose!';
  $('#outcome-message').textContent=won?'Your dragon is looking dangerously smug.':'Round lost. Attitude intact. Fancy a rematch?';
  delay=setTimeout(()=>{outcome.showModal();$('#outcome-replay').focus();onResultOpen();},getResultDelay());
 }
 $('#outcome-lobby').onclick=()=>{reset();onLobby();};
 $('#outcome-replay').onclick=()=>{reset();onReplay();};$('#outcome-close').onclick=()=>outcome.close();outcome.addEventListener('close',()=>document.body.classList.remove('round-overlay'));
 return {startRps,startOnlineRps,revealOnline,showResult,reset,setOpponent(name){opponentName=name;}};
}
