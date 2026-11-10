import {randomBytes,randomInt} from 'node:crypto';
import {dragons,isFound} from './src/cap-catalog.js';
import {newGame,resolveTurn} from './src/game.js';
import {rpsWinner,RPS_CHOICES} from './src/rps.js';
import {createTimingTargets, MIN_HOLD_MS, timingPosition, timingResult} from './src/throw-meter.js';
const token=()=>randomBytes(24).toString('hex');
const rand=()=>randomInt(0,0x1000000)/0x1000000;
export function createMatchmaker({now=Date.now,random=rand,stakes=null}={}){
 const clients=new Map(),rooms=new Map();let queue=[];
 const event=(room,type,data={})=>{room.events.push({id:++room.seq,type,...data});room.events=room.events.slice(-80);};
 function create(){const c={token:token(),name:`Dork ${randomInt(100,999)}`,room:null,queued:false,last:now()};clients.set(c.token,c);return c;}
 function auth(key){const c=clients.get(key);if(!c)throw Error('Session expired. Please reconnect.');c.last=now();return c;}
 function cancel(c){queue=queue.filter(x=>x!==c);c.queued=false;}
 function leave(c){
  cancel(c);
  const r=rooms.get(c.room);
  if(!r)return;
  c.room=null;
  if(r.closed)return;
  if(r.stake&&r.round){
   if(r.status==='result'||r.status==='recording')return;
   if(r.state.phase!=='finished'){
    const winner=1-r.players.indexOf(c);
    if(now()-r.players[winner].last>45000||now()>=r.stake.deadline){
     r.stake.status='refund';r.closed=true;event(r,'left',{name:c.name});return;
    }
    r.state={...r.state,phase:'finished',player:winner,score:winner===0?[2,0]:[0,2],wonBy:'forfeit'};
   }
   result(r);
   return;
  }
  r.closed=true;r.ready=[false,false];event(r,'left',{name:c.name});
 }
 function start(r){r.round++;r.ready=[false,false];r.state=newGame([0,0]);r.status='playing';r.until=0;r.choices=[null,null];r.charge=null;r.turnDeadline=now()+20000;event(r,'start',{state:r.state,caps:r.caps,round:r.round});}
 function join(c,cap,staked=false){
  if(!Number.isInteger(cap)||cap<0||cap>=dragons.length)throw Error('Choose a valid cap.');
  leave(c);c.cap=cap;c.staked=staked;c.queued=true;queue.push(c);
  const other=queue.find(x=>x!==c&&now()-x.last<12000&&x.staked===staked&&
   (!staked||x.wallet!==c.wallet)&&isFound(dragons[x.cap])===isFound(dragons[cap]));
  if(!other)return;
  cancel(c);cancel(other);
  const r={id:token(),players:[other,c],caps:[other.cap,c.cap],state:newGame(),status:'ready',ready:[false,false],
   events:[],seq:0,round:0,history:[],until:0,closed:false};
  if(staked){
   r.stake={accounts:[other.wallet,c.wallet],tokens:[other.foundToken,c.foundToken],status:'opening',id:null};
   r.targets=createTimingTargets();
   const stake=r.stake;
   stakes.open(stake.accounts,stake.tokens).then(async id=>{
    if(typeof id!=='string'||!/^\d+$/.test(id))throw Error('Invalid stake match ID.');
    stake.id=id;stake.status='locking';void updateStake(r)?.catch(()=>{});
   }).catch(error=>{console.warn('Could not open stake:',error.message);stake.status='unavailable';});
  }
  rooms.set(r.id,r);c.room=other.room=r.id;event(r,'matched');
 }
 function updateStake(r){
  const stake=r.stake;
  if(!stake?.id||stake.status!=='locking')return;
  if(stake.check)return stake.check;
  if(stake.checkAfter>now())return;
  stake.checkAfter=now()+1500;
  stake.check=stakes.get(stake.id).then(game=>{
   if(!game)return;
   stake.deadline=Number(game.deadline_ms);
   stake.locked=game.entries.map(entry=>entry.locked);
   if(!r.closed&&!r.round&&stake.deadline>now()&&stake.locked.every(Boolean)){
    stake.status='active';start(r);
   }
  }).finally(()=>{stake.check=null;});
  return stake.check;
 }
 function persistWinner(r){
  const stake=r.stake;
  if(stake.recording||stake.recorded||now()<(stake.retryAt||0))return;
  const winner=stake.accounts[r.state.player];
  stake.status='pending';
  stake.recording=(async()=>{
   try{await stakes.record(stake.id,winner);}
   catch(error){
    const verdict=await stakes.verdict(stake.id);
    if(verdict?.winner!==winner)throw error;
   }
   stake.recorded=true;
   stake.status='paying';
   void stakes.pay(stake.id).then(()=>{stake.status='paid';}).catch(()=>{});
  })().catch(()=>{
   stake.retryAt=now()+2500;
   if(now()>=stake.deadline){stake.status='refund';r.closed=true;}
  }).finally(()=>{stake.recording=null;});
 }
 function result(r){
  if(r.history.some(h=>h.round===r.round))return;
  r.until=0;
  if(r.stake&&!r.stake.recorded){
   r.status='recording';persistWinner(r);return;
  }
  r.status='result';
  r.history.push({round:r.round,caps:[...r.caps],winner:r.state.player,turns:r.state.turn,
   method:({rps:'RPS',forfeit:'Forfeit'})[r.state.wonBy]||'Caps',at:now()});
  event(r,'result',{state:r.state});
 }
 function beginRps(r){r.status='rps';r.choices=[null,null];r.deadline=now()+5000;event(r,'rps',{state:r.state,deadline:r.deadline});}
 function tick(){
  for(const c of clients.values()){if(now()-c.last>(rooms.get(c.room)?.stake?45000:15000)){if(c.queued)cancel(c);if(c.room)leave(c);}if(now()-c.last>3600000)clients.delete(c.token);}
  for(const r of rooms.values()){
   if(!r.closed&&r.status==='recording')result(r);
   if(r.stake?.status==='paying'&&!r.stake.verifying&&now()>(r.stake.verifyAfter||0)){
    r.stake.verifyAfter=now()+5000;
    r.stake.verifying=stakes.verdict(r.stake.id).then(verdict=>{
     if(verdict?.paid)r.stake.status='paid';
    }).catch(()=>{}).finally(()=>{r.stake.verifying=null;});
   }
   if(r.closed||r.status==='result'){
    if(!['paying','pending'].includes(r.stake?.status)&&r.players.every(c=>c.room!==r.id))rooms.delete(r.id);
    continue;
   }
   if(r.stake?.status==='active'&&r.state.phase!=='finished'&&now()>=r.stake.deadline){r.stake.status='refund';r.closed=true;continue;}
   if(r.until&&now()>=r.until){r.until=0;if(r.state.phase==='finished')result(r);else if(r.state.phase==='rps')beginRps(r);else {r.status='playing';r.turnDeadline=now()+20000;}}
   if(r.stake&&r.status==='playing'&&now()>=r.turnDeadline){
    const winner=1-r.state.player;
    r.state={...r.state,phase:'finished',player:winner,score:winner===0?[2,0]:[0,2],wonBy:'forfeit'};
    result(r);
   }
   if(r.status==='rps'&&now()>=r.deadline){
    const [a,b]=r.choices;const winner=a===null&&b===null?null:a===null?1:b===null?0:rpsWinner(a,b);
    if(winner===null){r.state={...r.state,rpsRound:r.state.rpsRound+1};}
    else{r.state={...r.state,phase:'finished',player:winner,score:winner===0?[2,0]:[0,2],wonBy:'rps'};}
    if(r.stake&&winner!==null)persistWinner(r);
    r.status='revealing';r.until=now()+1800;event(r,'reveal',{choices:[...r.choices],state:r.state});
   }
  }
 }
 function action(c,body){tick();if(body.type==='queue'){if(body.staked&&(!stakes||stakes.enabled===false))throw Error('Stake matches are unavailable.');join(c,body.cap,body.staked===true);return;}if(body.type==='cancel'){cancel(c);return;}if(body.type==='leave'){leave(c);return;}
  const r=rooms.get(c.room);if(!r||r.closed)throw Error('This table has closed. Find another dork.');const side=r.players.indexOf(c);
  if(body.round!==r.round)throw Error('That round has ended.');
  if(r.stake&&['ready','rematch'].includes(body.type))throw Error('Stake matches start after both deposits. Find a new table for another match.');
  if(body.type==='charge'&&r.stake){
   if(r.status!=='playing'||r.state.player!==side||r.charge!==null)throw Error('You cannot aim now.');
   r.charge=now();return;
  }
  if(body.type==='cancel-charge'&&r.stake){
   if(r.status==='playing'&&r.state.player===side)r.charge=null;
   return;
  }
  if(body.type==='ready'){
   if(r.status!=='ready')throw Error('This table is already playing.');r.ready[side]=true;if(r.ready.every(Boolean))start(r);
  }else if(body.type==='throw'){
   if(r.status!=='playing'||r.until||r.state.player!==side)throw Error('Wait for your turn.');
   let skill=body.skill;
   if(r.stake){
    const elapsed=r.charge===null?0:now()-r.charge;r.charge=null;
    if(elapsed<MIN_HOLD_MS)throw Error('Hold to aim before releasing.');
    skill=timingResult(timingPosition(elapsed),r.targets.get(r.state.turn)).skill;
   }
   if(!Number.isFinite(skill)||skill<0||skill>1)throw Error('Invalid throw.');
   const previous=r.state;r.state=resolveTurn(r.state,skill,random);r.until=now()+1600;r.status='throwing';if(r.stake&&r.state.phase==='finished')persistWinner(r);event(r,'throw',{previous,state:r.state,skill});
  }else if(body.type==='rps'){
   if(r.status!=='rps'||!RPS_CHOICES.includes(body.choice))throw Error('Pick before the timer ends.');r.choices[side]=body.choice;
  }else if(body.type==='rematch'){
   if(r.status!=='result')throw Error('Finish this round first.');r.ready[side]=true;if(r.ready.every(Boolean))start(r);
  }else throw Error('Unknown action.');
 }
 function snapshot(c,after=0){tick();const r=rooms.get(c.room),side=r?.players.indexOf(c);if(r?.closed)c.room=null;return {name:c.name,queued:c.queued,stakesEnabled:Boolean(stakes&&stakes.enabled!==false),stakeNetwork:stakes?.network,serverTime:now(),room:r?{id:r.id,side,opponent:r.players[1-side].name,caps:r.caps,state:r.state,status:r.closed?'left':r.status,ready:r.ready,round:r.round,deadline:r.deadline,turnDeadline:r.stake?r.turnDeadline:undefined,stake:r.stake?{id:r.stake.id,network:stakes.network,contractId:stakes.contractId,deadline:r.stake.deadline,locked:r.stake.locked,status:r.stake.status,tokenId:r.stake.tokens[side],target:r.targets.get(r.state.turn)}:null,history:r.history,seq:r.seq,events:r.events.filter(e=>e.id>after)}:null};}
 function table(c){return rooms.get(c.room);}
 return {create,auth,action,snapshot,tick,table,updateStake};
}
// Found caps are NFTs: the session must prove its NEAR account, and the server
// checks current on-chain ownership when queueing and again before every round.
export async function guardFoundAction(gate,mm,c,body){
 if(body.type==='wallet-challenge'){if(!gate)throw Error('Found matches need the NEAR contract.');return gate.challenge(c.token,body.accountId);}
 if(body.type==='wallet-bind'){if(!gate)throw Error('Found matches need the NEAR contract.');c.wallet=await gate.bind(c.token,body);return {ok:true,accountId:c.wallet};}
 if(body.type==='queue'){
  if(!Number.isInteger(body.cap)||!dragons[body.cap])throw Error('Choose a valid cap.');
  const wallet=c.wallet;
  const found=isFound(dragons[body.cap]);
  if(body.staked&&!found)throw Error('Choose a Found Cap for a stake match.');
  if(found){
   if(!gate)throw Error('Found matches need the NEAR contract.');
   await gate.check(wallet,body.tokenId,body.cap);
   if(c.wallet!==wallet)throw Error('Wallet changed. Try again.');
  }
  c.foundToken=found?body.tokenId:null;
  mm.action(c,body);
  return {ok:true};
 }
 if(body.type==='ready'||body.type==='rematch'){
  const table=mm.table(c);
  const status=body.type==='ready'?'ready':'result';
  if(!table?.stake&&table?.status===status&&!table.closed&&body.round===table.round&&isFound(dragons[c.cap])){
   const claims=table.players.map(player=>({wallet:player.wallet,token:player.foundToken,cap:player.cap}));
   try{
    await Promise.all(claims.map(({wallet,token,cap})=>gate.check(wallet,token,cap)));
   }catch(e){
    if(mm.table(c)===table&&table.status===status&&table.round===body.round)mm.action(c,{type:'leave'});
    throw e;
   }
   if(mm.table(c)!==table||table.players.some((player,i)=>player.wallet!==claims[i].wallet||player.foundToken!==claims[i].token)){
    throw Error('Table changed. Try again.');
   }
   mm.action(c,body);
   return {ok:true};
  }
 }
 return null;
}
export function matchApi({siteOrigin,gate=null,stakes=null}={}){const mm=createMatchmaker({stakes});if(stakes){
 const recover=()=>void stakes.recover().catch(error=>console.warn('Stake payout recovery:',error.message));
 const refresh=()=>void stakes.refresh?.();
 refresh();recover();setInterval(refresh,30000).unref();setInterval(recover,5000).unref();setInterval(mm.tick,1000).unref();
}return async(req,res,url)=>{
 if(!url.pathname.startsWith('/api/'))return false;
 res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
 try{
  if(req.headers.origin&&req.headers.origin!==siteOrigin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`){res.writeHead(403).end(JSON.stringify({error:'Same-origin requests only.'}));return true;}
  if(url.pathname==='/api/session'&&req.method==='POST'){const c=mm.create();res.end(JSON.stringify({token:c.token,...mm.snapshot(c)}));return true;}
  const c=mm.auth((req.headers.authorization||'').replace(/^Bearer /,''));
  if(url.pathname==='/api/stake'&&req.method==='GET'&&stakes){
   const id=url.searchParams.get('match');
   if(!/^[1-9]\d{0,19}$/.test(id||''))throw Error('Invalid match ID.');
   const game=await stakes.get(id);
   const verdict=await stakes.verdict(id);
   res.end(JSON.stringify({match:game,verdict}));return true;
  }
  if(url.pathname==='/api/state'&&req.method==='GET'){await mm.updateStake(mm.table(c)||{})?.catch(()=>{});res.end(JSON.stringify(mm.snapshot(c,Number(url.searchParams.get('after'))||0)));return true;}
  if(url.pathname==='/api/action'&&req.method==='POST'){
   let text='';for await(const data of req){text+=data;if(text.length>2048)throw Error('Request too large.');}
   const body=JSON.parse(text);if(!body||typeof body!=='object')throw Error('Invalid request.');const reply=await guardFoundAction(gate,mm,c,body);if(reply){res.end(JSON.stringify(reply));return true;}mm.action(c,body);res.end(JSON.stringify({ok:true}));return true;
  }
  res.writeHead(404).end(JSON.stringify({error:'Unknown endpoint.'}));
 }catch(e){res.writeHead(400).end(JSON.stringify({error:e.message}));}
 return true;
};}
