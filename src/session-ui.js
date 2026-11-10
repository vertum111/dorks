import {dragons,frontImage,isFound} from './cap-catalog.js';
export const arrow=direction=>`<svg viewBox="0 0 32 28" aria-hidden="true" focusable="false"><path d="${direction==='right'?'M3 15 Q16 13 28 14 M19 4 L29 14 19 24':'M29 14 Q16 16 4 14 M13 4 L3 14 13 24'}"/></svg>`;
export function mountSessionUi({getSelected,foundPass=()=>null,lockStake,refundStake,onStakeChange,onStart,onTurn,onRps,onReveal,onResult,onLobby,onPractice,onRoom,onSearch,onResume}){
 const host=document.createElement('div');host.className='session-ui';host.innerHTML=`
 <section id="lobby" class="lobby-card" aria-labelledby="lobby-title">
  <p class="eyebrow" id="lobby-kicker">THE VERY ODD LOBBY</p><h1 id="lobby-title">Collect caps.<br>Lose friends.</h1>
  <p id="lobby-message" role="status">One cap each. One wonderfully bad decision.</p>
  <div class="lobby-cap"><img id="lobby-cap-art" alt="Your chosen dragon"><span>Your cap<strong id="lobby-cap-name"></strong></span><button id="lobby-change" class="text-button">Change</button></div>
  <button id="find-player" class="primary">Find a dork</button><button id="practice" class="paper-button">Practice with Bot</button>
  <button id="find-staked" class="paper-button" hidden>Find a stake match · Testnet</button>
  <button id="refund-stake" class="paper-button" hidden>Recover expired stake</button>
  <button id="cancel-search" class="paper-button" hidden>Cancel search</button>
  <p id="lobby-foot">Casual online and Bot practice. No caps are transferred.</p>
 </section>
 <div id="match-banner" class="match-banner" hidden><span id="match-opponent"></span><b id="match-series"></b><span id="stake-status" role="status"></span><button id="leave-table" class="text-button">Leave table</button></div>
 <dialog id="session-history" class="session-history" aria-labelledby="history-title"><button id="close-history" class="round-button" aria-label="Close session history">×</button><p class="eyebrow">THIS VISIT. ALL THE CHAOS.</p><h2 id="history-title">Your session</h2><div id="session-summary"></div><ol id="match-history"></ol><p class="history-empty">Your first bad decision is still ahead of you.</p></dialog>`;
 document.body.append(host);const $=s=>host.querySelector(s);
 let stakesEnabled=false,stakeBusy=false,heldStake=null,chargeRequest=null;
 let boundAccount=null,mode='lobby',room=null,token=null,seq=0,pollTimer,networkBusy=false,queued=false,connected=false,hidden=false,rematch=false,seenRoom=null,seenRound=0,practiceRound=0,history=[],error='',searchStarted=0;
 try{token=sessionStorage.getItem('dorks-lobby-token');history=JSON.parse(sessionStorage.getItem('dorks-session-history')||'[]');if(!Array.isArray(history))history=[];practiceRound=history.filter(h=>h.practice).length;}catch{}
 try{heldStake=JSON.parse(localStorage.getItem('dorks-testnet-stake')||'null');}catch{}
 function rememberStake(value){
  heldStake=value;
  try{localStorage.setItem('dorks-testnet-stake',JSON.stringify(value));}catch{}
 }
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function saveHistory(){try{sessionStorage.setItem('dorks-session-history',JSON.stringify(history));}catch{}renderHistory();}
 function renderHistory(){
  const wins=history.filter(h=>h.won).length;document.querySelector('#session-count').textContent=`${history.length} played`;$('#session-summary').innerHTML=`<span><b>${history.length}</b> ${history.length===1?'match':'matches'}</span><span><b>${wins}</b> ${wins===1?'win':'wins'}</span><span><b>${history.length-wins}</b> ${history.length-wins===1?'loss':'losses'}</span>`;
  $('.history-empty').hidden=history.length>0;
  $('#match-history').innerHTML=history.slice().reverse().map(h=>`<li><div class="history-result ${h.won?'won':''}">${h.won?'WIN':'LOSS'}<small>${h.won?'1 : 0':'0 : 1'}</small></div><div><strong>vs ${escape(h.opponent)}</strong><p>${h.caps.map((n,i)=>`${i?' vs ':''}<img src="${frontImage(dragons[n])}" alt="">${dragons[n].name}`).join('')}</p><small>${h.method} · ${h.turns} throws · ${h.practice?'Practice':'Player match'}</small></div></li>`).join('');
 }
 async function request(path,body){const res=await fetch(path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await res.json();if(!res.ok)throw Error(data.error||'Cannot reach the lobby.');return data;}
 async function action(type,extra={}){try{await request('/api/action',{type,round:room?.round,...extra});error='';await poll();return true;}catch(e){error=e.message;render();return false;}}
 function render(){
  const lobbyVisible=!hidden&&(mode==='lobby'||room?.status==='ready'||rematch);$('#lobby').hidden=!lobbyVisible;
  const d=dragons[getSelected()],stake=room?.stake;$('#lobby-cap-art').src=frontImage(d);$('#lobby-cap-name').textContent=isFound(d)?`${d.name} · Found`:d.name;
  $('#lobby-kicker').textContent=queued?'SHAKING THE DORK TREE':room?.status==='ready'?'A WILD DORK APPEARED':rematch?'RUN IT BACK?':'THE VERY ODD LOBBY';
  $('#lobby-title').innerHTML=queued?'Looking for<br>trouble…':room?.status==='ready'?`${escape(room.opponent)}<br>takes a seat.`:rematch?'One more<br>bad decision?':'Collect caps.<br>Lose friends.';
  $('#lobby-message').textContent=error||(queued?(isFound(d)?'Looking for another player with a Found cap.':'Waiting for another player to tap Find a dork.'):room?.status==='ready'?(room.ready[room.side]?'You are ready. Waiting for the other dork…':'Both players must be ready before the caps fly.'):rematch?(room?.ready[room.side]?'Rematch requested. Waiting for your opponent…':'Same dork. Fresh pair. Both players must agree.'):'One cap each. One wonderfully bad decision.');
  $('#find-staked').hidden=!stakesEnabled||queued||Boolean(room)||!isFound(d)||Boolean(heldStake);
  $('#find-staked').disabled=!connected||stakeBusy;
  $('#refund-stake').hidden=!stakesEnabled||queued||Boolean(room)||!heldStake?.deadline||Date.now()<heldStake.deadline;
  $('#refund-stake').disabled=stakeBusy;
  $('#find-player').hidden=queued;$('#find-player').disabled=(!connected&&mode!=='practice')||Boolean(room?.ready[room.side]);
  $('#find-player').textContent=room?.status==='ready'?'Ready to play':rematch?'Request rematch':'Find a dork';
  if(stake&&room.status==='ready'){
   $('#lobby-message').textContent=error||(stake.status==='unavailable'?'Could not prepare this stake. Return to the lobby.':
    stake.locked?.[room.side]?'Your cap is locked. Waiting for the other player.':
    'Both players lock one Found Cap. The winner takes both. Leaving after play starts forfeits your cap. An expired match can be refunded.');
   $('#find-player').textContent='Lock my cap';
   $('#find-player').disabled=stakeBusy||stake.status!=='locking'||Boolean(stake.locked?.[room.side])||
    (stake.deadline??0)<=Date.now();
  }
  $('#practice').hidden=queued||Boolean(room);$('#cancel-search').hidden=!queued&&!rematch&&room?.status!=='ready';$('#cancel-search').textContent=queued?'Cancel search':'Back to lobby';
  $('.lobby-cap').hidden=queued||Boolean(room);$('#lobby-foot').textContent=error?'Your cap is safe. Try again or practice with Bot.':queued?'Keep this tab open. No sneaky bot substitutions.':'Casual online and Bot practice. No caps are transferred.';
  $('#match-banner').hidden=hidden||mode==='lobby'||rematch||room?.status==='ready';
  $('#match-opponent').textContent=mode==='practice'?'Practice · Bot':`You vs ${room?.opponent||'another dork'}`;
  $('#stake-status').textContent=({active:room?.status==='playing'?('Throw clock · '+Math.max(0,Math.ceil((room.turnDeadline-Date.now())/1000))+'s'):'Both caps locked',pending:'Paying winner…',paying:'Paying winner…',
   paid:'Both caps sent to winner',refund:'Match expired. Recover your cap in the lobby.'})[stake?.status]||'';
  const records=history.filter(h=>mode==='practice'?h.practice:h.room===room?.id),w=records.filter(h=>h.won).length;
  $('#match-series').textContent=`${w} — ${records.length-w} · ${records.length} played`;
  document.body.classList.toggle('in-lobby',lobbyVisible);document.body.classList.toggle('searching-opponent',queued&&!hidden);onSearch(queued,lobbyVisible);
 }
 function local(state){if(!room||room.side===0)return {...state,faces:[...state.faces],score:[...state.score]};return {...state,player:1-state.player,faces:[...state.faces].reverse(),score:[...state.score].reverse()};}
 function record(state,practice=false){const key=practice?`practice-${++practiceRound}`:`${room.id}-${room.round}`;if(history.some(h=>h.key===key))return;history.push({key,room:practice?'practice':room.id,opponent:practice?'Bot':room.opponent,caps:practice?[...api.practiceCaps]:room.side===0?[...room.caps]:[...room.caps].reverse(),won:state.player===0,turns:state.turn,method:({rps:'RPS showdown',forfeit:'Forfeit'})[state.wonBy]||'Cap slam',practice,at:Date.now()});saveHistory();}
 function process(data){connected=true;stakesEnabled=Boolean(data.stakesEnabled);queued=data.queued;const nextRoom=data.room;
  if(!nextRoom){if(room&&mode==='online'){room=null;mode='lobby';rematch=false;onLobby();}render();return;}
  room=nextRoom;mode='online';
  if(room.stake?.status==='paid'&&heldStake?.id===room.stake.id){rememberStake(null);onStakeChange?.();}
  else if(room.stake?.id===heldStake?.id&&room.stake?.deadline&&room.stake.deadline!==heldStake.deadline)
   rememberStake({...heldStake,deadline:room.stake.deadline});
  onRoom(room.opponent,room.status,room.stake);
  const fresh=seenRoom!==room.id;
  if(fresh){seq=0;seenRoom=room.id;seenRound=0;onLobby();}
  if(room.status==='left'){error='The other dork left the table. Find a fresh rival.';room=null;seenRoom=null;seq=0;mode='lobby';rematch=false;onLobby();render();return;}
  if(fresh&&room.status!=='ready'){
   seq=room.seq;const caps=room.side===0?[...room.caps]:[...room.caps].reverse();let held=room.state.phase==='duel'?(room.state.turn===0?[true,true]:[false,true]):[false,false];if(room.side===1)held.reverse();
   onResume(local(room.state),caps,held);
   if(room.status==='rps')onRps(local(room.state),performance.now()+Math.max(0,room.deadline-data.serverTime));
   if(room.status==='revealing'){const e=[...room.events].reverse().find(e=>e.type==='reveal');if(e){onRps(local(room.state),performance.now());onReveal(room.side===0?e.choices:[...e.choices].reverse(),local(room.state));}}
   if(room.status==='result'){const state=local(room.state);record(state);onResult(state);}
  }
  for(const e of room.events){if(e.id<=seq)continue;seq=e.id;
   if(e.type==='start'){seenRound=e.round;rematch=false;onStart(local(e.state),room.side===0?e.caps:[...e.caps].reverse());}
   if(e.type==='throw')onTurn(local(e.previous),local(e.state),e.skill);
   if(e.type==='rps')onRps(local(e.state),performance.now()+Math.max(0,e.deadline-data.serverTime));
   if(e.type==='reveal')onReveal(room.side===0?e.choices:[...e.choices].reverse(),local(e.state));
   if(e.type==='result'){const state=local(e.state);record(state);onResult(state);}
  }
  render();
 }
 async function poll(){if(networkBusy)return;networkBusy=true;try{if(!token){const c=await request('/api/session',{});token=c.token;try{sessionStorage.setItem('dorks-lobby-token',token);}catch{}}const data=await request(`/api/state?after=${seq}`);error='';process(data);}catch(e){connected=false;error='Lobby connection lost. Reconnecting…';if(/expired/.test(e.message)){token=null;seq=0;seenRoom=null;}render();}finally{networkBusy=false;}}
 async function back(){if(queued||room)await action('leave');room=null;mode='lobby';rematch=false;seq=0;seenRoom=null;onLobby();render();}
 async function queueFound(cap,staked=false){
  const pass=foundPass(cap);
  if(!pass){error='Connect the wallet that holds this Found Cap.';render();return;}
  try{
   if(boundAccount!==`${token}:${pass.accountId}`){
    error='';$('#lobby-message').textContent='Confirm the table pass in your wallet. It is a free signature, not a transaction.';
    const challenge=await request('/api/action',{type:'wallet-challenge',accountId:pass.accountId});
    const proof=await pass.sign(challenge);
    await request('/api/action',{type:'wallet-bind',...challenge,...proof,accountId:pass.accountId});
    boundAccount=`${token}:${pass.accountId}`;
   }
  }catch(e){error=e?.message&&!/reject|cancel|closed/i.test(e.message)?e.message:'Wallet check cancelled. Your cap stays put.';render();return;}
  await action('queue',{cap,tokenId:pass.tokenId,staked});
 }
 $('#find-player').onclick=async()=>{if(room?.status==='ready'){
   if(!room.stake){await action('ready');return;}
   if(stakeBusy)return;
   const {id,tokenId,contractId,deadline}=room.stake;
   stakeBusy=true;render();
   try{
    // Keep the recovery ID even if the browser closes during wallet signing.
    const match={id,tokenId,contractId,deadline};rememberStake(match);
    await lockStake(match);error='';await poll();
   }catch(e){error=e.message;}finally{stakeBusy=false;render();}
   return;
  }if(rematch){await action('rematch');return;}searchStarted=Date.now();const cap=getSelected();if(isFound(dragons[cap])){await queueFound(cap);return;}await action('queue',{cap});};
 $('#find-staked').onclick=async()=>{searchStarted=Date.now();await queueFound(getSelected(),true);};
 $('#refund-stake').onclick=async()=>{
  if(stakeBusy||!heldStake)return;
  stakeBusy=true;render();
  try{
   const status=await request('/api/stake?match='+encodeURIComponent(heldStake.id));
   if(status.match){
    rememberStake({...heldStake,deadline:Number(status.match.deadline_ms)});
    if(Date.now()<heldStake.deadline)throw Error('This stake is still active.');
    await refundStake(heldStake);
   }
   rememberStake(null);error='';onStakeChange?.();
  }catch(e){error=e.message;}finally{stakeBusy=false;render();}
 };
 $('#cancel-search').onclick=back;$('#leave-table').onclick=()=>{
  if(room?.stake&&room.round>0&&room.status!=='result'&&!window.confirm('Leave this testnet match and forfeit your staked cap?'))return;
  void back();
 };
 $('#practice').onclick=async()=>{if(room||queued)await action('leave');room=null;mode='practice';rematch=false;onPractice();render();};
 $('#lobby-change').onclick=()=>document.querySelector('#open-collection').click();$('#close-history').onclick=()=>$('#session-history').close();
 renderHistory();const api={practiceCaps:[0,2],get mode(){return mode;},get online(){return mode==='online'&&room?.status!=='ready';},get opponent(){return mode==='practice'?'Bot':room?.opponent||'Opponent';},get canThrow(){return mode==='practice'||(room?.status==='playing'&&!rematch);},refresh:render,setHidden(value){hidden=value;render();},get stake(){return room?.stake;},get target(){return room?.stake?.target;},startCharge(){if(room?.stake)chargeRequest=action('charge');},
 cancelCharge(){if(chargeRequest){const pending=chargeRequest;chargeRequest=null;void pending.then(ok=>{if(ok)return action('cancel-charge');});}},
 async throw(skill){if(chargeRequest){const pending=chargeRequest;chargeRequest=null;if(!await pending)return false;}return action('throw',{skill});},rps(choice){return action('rps',{choice});},showHistory(){renderHistory();$('#session-history').showModal();},recordPractice(state,caps){api.practiceCaps=caps;record(state,true);render();},replay(){if(mode==='practice'){onPractice();render();}else if(room?.stake){void back();}else{rematch=true;render();action('rematch');}},back};
 render();awaitInitial();function awaitInitial(){poll().finally(()=>{pollTimer=setTimeout(awaitInitial,700);});}
 return api;
}
