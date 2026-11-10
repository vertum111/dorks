import {randomBytes,randomInt} from 'node:crypto';
import {dragons,isFound} from './src/cap-catalog.js';
import {newGame,resolveTurn} from './src/game.js';
import {rpsWinner,RPS_CHOICES} from './src/rps.js';
const token=()=>randomBytes(24).toString('hex');
const rand=()=>randomInt(0,0x1000000)/0x1000000;
export function createMatchmaker({now=Date.now,random=rand}={}){
 const clients=new Map(),rooms=new Map();let queue=[];
 const event=(room,type,data={})=>{room.events.push({id:++room.seq,type,...data});room.events=room.events.slice(-80);};
 function create(){const c={token:token(),name:`Dork ${randomInt(100,999)}`,room:null,queued:false,last:now()};clients.set(c.token,c);return c;}
 function auth(key){const c=clients.get(key);if(!c)throw Error('Session expired. Please reconnect.');c.last=now();return c;}
 function cancel(c){queue=queue.filter(x=>x!==c);c.queued=false;}
 function leave(c){cancel(c);const r=rooms.get(c.room);if(r){r.closed=true;r.ready=[false,false];event(r,'left',{name:c.name});c.room=null;}}
 function start(r){r.round++;r.ready=[false,false];r.state=newGame([0,0]);r.status='playing';r.until=0;r.choices=[null,null];event(r,'start',{state:r.state,caps:r.caps,round:r.round});}
 function join(c,cap){if(!Number.isInteger(cap)||cap<0||cap>=dragons.length)throw Error('Choose a valid cap.');leave(c);c.cap=cap;c.queued=true;queue.push(c);const other=queue.find(x=>x!==c&&now()-x.last<12000&&isFound(dragons[x.cap])===isFound(dragons[cap]));if(other){cancel(c);cancel(other);const r={id:token(),players:[other,c],caps:[other.cap,c.cap],state:null,status:'playing',ready:[false,false],events:[],seq:0,round:0,history:[],until:0,closed:false};rooms.set(r.id,r);c.room=other.room=r.id;r.status='ready';r.state=newGame();event(r,'matched');}}
 function result(r){if(r.history.some(h=>h.round===r.round))return;r.status='result';r.history.push({round:r.round,caps:[...r.caps],winner:r.state.player,turns:r.state.turn,method:r.state.wonBy==='rps'?'RPS':'Caps',at:now()});event(r,'result',{state:r.state});}
 function beginRps(r){r.status='rps';r.choices=[null,null];r.deadline=now()+5000;event(r,'rps',{state:r.state,deadline:r.deadline});}
 function tick(){
  for(const c of clients.values()){if(now()-c.last>15000){if(c.queued)cancel(c);if(c.room)leave(c);}if(now()-c.last>3600000)clients.delete(c.token);}
  for(const r of rooms.values()){
   if(r.closed){if(r.players.every(c=>c.room!==r.id))rooms.delete(r.id);continue;}
   if(r.until&&now()>=r.until){r.until=0;if(r.state.phase==='finished')result(r);else if(r.state.phase==='rps')beginRps(r);else r.status='playing';}
   if(r.status==='rps'&&now()>=r.deadline){
    const [a,b]=r.choices;const winner=a===null&&b===null?null:a===null?1:b===null?0:rpsWinner(a,b);
    if(winner===null){r.state={...r.state,rpsRound:r.state.rpsRound+1};}
    else{r.state={...r.state,phase:'finished',player:winner,score:winner===0?[2,0]:[0,2],wonBy:'rps'};}
    r.status='revealing';r.until=now()+1800;event(r,'reveal',{choices:[...r.choices],state:r.state});
   }
  }
 }
 function action(c,body){tick();if(body.type==='queue'){join(c,body.cap);return;}if(body.type==='cancel'){cancel(c);return;}if(body.type==='leave'){leave(c);return;}
  const r=rooms.get(c.room);if(!r||r.closed)throw Error('This table has closed. Find another dork.');const side=r.players.indexOf(c);
  if(body.round!==r.round)throw Error('That round has ended.');
  if(body.type==='ready'){
   if(r.status!=='ready')throw Error('This table is already playing.');r.ready[side]=true;if(r.ready.every(Boolean))start(r);
  }else if(body.type==='throw'){
   if(r.status!=='playing'||r.until||r.state.player!==side)throw Error('Wait for your turn.');
   if(!Number.isFinite(body.skill)||body.skill<0||body.skill>1)throw Error('Invalid throw.');
   const previous=r.state;r.state=resolveTurn(r.state,body.skill,random);r.until=now()+1600;r.status='throwing';event(r,'throw',{previous,state:r.state,skill:body.skill});
  }else if(body.type==='rps'){
   if(r.status!=='rps'||!RPS_CHOICES.includes(body.choice))throw Error('Pick before the timer ends.');r.choices[side]=body.choice;
  }else if(body.type==='rematch'){
   if(r.status!=='result')throw Error('Finish this round first.');r.ready[side]=true;if(r.ready.every(Boolean))start(r);
  }else throw Error('Unknown action.');
 }
 function snapshot(c,after=0){tick();const r=rooms.get(c.room),side=r?.players.indexOf(c);if(r?.closed)c.room=null;return {name:c.name,queued:c.queued,serverTime:now(),room:r?{id:r.id,side,opponent:r.players[1-side].name,caps:r.caps,state:r.state,status:r.closed?'left':r.status,ready:r.ready,round:r.round,deadline:r.deadline,history:r.history,seq:r.seq,events:r.events.filter(e=>e.id>after)}:null};}
 function table(c){return rooms.get(c.room);}
 return {create,auth,action,snapshot,tick,table};
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
  if(table?.status===status&&!table.closed&&body.round===table.round&&isFound(dragons[c.cap])){
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
export function matchApi({siteOrigin,gate=null}={}){const mm=createMatchmaker();return async(req,res,url)=>{
 if(!url.pathname.startsWith('/api/'))return false;
 res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
 try{
  if(req.headers.origin&&req.headers.origin!==siteOrigin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`){res.writeHead(403).end(JSON.stringify({error:'Same-origin requests only.'}));return true;}
  if(url.pathname==='/api/session'&&req.method==='POST'){const c=mm.create();res.end(JSON.stringify({token:c.token,...mm.snapshot(c)}));return true;}
  const c=mm.auth((req.headers.authorization||'').replace(/^Bearer /,''));
  if(url.pathname==='/api/state'&&req.method==='GET'){res.end(JSON.stringify(mm.snapshot(c,Number(url.searchParams.get('after'))||0)));return true;}
  if(url.pathname==='/api/action'&&req.method==='POST'){
   let text='';for await(const data of req){text+=data;if(text.length>2048)throw Error('Request too large.');}
   const body=JSON.parse(text);if(!body||typeof body!=='object')throw Error('Invalid request.');const reply=await guardFoundAction(gate,mm,c,body);if(reply){res.end(JSON.stringify(reply));return true;}mm.action(c,body);res.end(JSON.stringify({ok:true}));return true;
  }
  res.writeHead(404).end(JSON.stringify({error:'Unknown endpoint.'}));
 }catch(e){res.writeHead(400).end(JSON.stringify({error:e.message}));}
 return true;
};}
