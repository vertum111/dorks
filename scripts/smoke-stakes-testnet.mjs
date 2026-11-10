import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {matchApi} from '../match-server.mjs';
import {testnetStakeChain} from '../stake-chain.mjs';
import {nearOwnershipGate} from '../found-ownership.mjs';
import {messageHash} from '../found-api.mjs';
import {dragons,isFound} from '../src/cap-catalog.js';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {setTimeout as sleep} from 'node:timers/promises';
import {Account, JsonRpcProvider, KeyPair, actions, teraToGas} from 'near-api-js';

const keys = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));
const accountId = role => {
 const id = Object.keys(keys).find(id => id.startsWith(`dorks-${role}-`) && id.endsWith('.testnet'));
 if (!id) throw Error(`Missing testnet ${role} account`);
 return id;
};
const provider = new JsonRpcProvider({url:'https://test.rpc.fastnear.com'});
const account = id => new Account(id, provider, keys[id]);
const contractId = accountId('found');
const admin = account(contractId);
const aliceId = accountId('alice'), bobId = accountId('bob');
const alice = account(aliceId), bob = account(bobId);
const arbiterId = `judge-${Date.now().toString(36)}.${contractId}`;
const arbiterKey = KeyPair.fromRandom('ed25519');
const arbiter = new Account(arbiterId, provider, arbiterKey.toString());

function result(outcome) {
 assert.ok(!outcome.status?.Failure, JSON.stringify(outcome.status?.Failure));
 return outcome.status?.SuccessValue ? JSON.parse(Buffer.from(outcome.status.SuccessValue, 'base64').toString()) : undefined;
}
const call = async (actor, methodName, args, deposit=0n) => result(await actor.callFunctionRaw({
 contractId, methodName, args, deposit, gas:teraToGas('80'), waitUntil:'FINAL',
}));
const view = (method, args) => provider.callFunction({contractId, method, args, blockQuery:{finality:'final'}});
const get = match_id => view('get_staked_match', {match_id});
const owner = async token_id => (await view('nft_token', {token_id})).owner_id;
async function owned(id) {
 const [cap] = await view('nft_tokens_for_owner', {account_id:id, limit:1});
 assert.ok(cap, `No test cap for ${id}`);
 return cap.token_id;
}

const a = await owned(aliceId), b = await owned(bobId);
console.log('Found two testnet caps');
result(await admin.deployContract(new Uint8Array(await fs.readFile(process.argv[3]))));
result(await admin.createAccount({newAccountId:arbiterId, publicKey:arbiterKey.getPublicKey(), nearToTransfer:100_000_000_000_000_000_000_000n}));
await call(admin, 'set_stake_arbiter', {account_id:arbiterId});
const open = () => call(arbiter, 'open_staked_match', {players:[aliceId,bobId], tokens:[a,b]});
const lock = (player, match_id, token_id) => call(player, 'lock_match_cap', {match_id,token_id}, 1n);
const payout = (player, match_id) => call(player, 'settle_staked_match', {match_id,winner:aliceId});
if (process.argv.includes('--lobby')) {
 await lobby();
} else {
const refundCase = await open();
await lock(alice, refundCase, a);
assert.equal(await owner(a), contractId);
assert.equal((await get(refundCase)).entries[1].locked, false);
await assert.rejects(payout(arbiter, refundCase));
await assert.rejects(call(bob, 'refund_staked_match', {match_id:refundCase}));
console.log('One cap locked. Early payout and early refund rejected');
const deadline = Number((await get(refundCase)).deadline_ms);
await sleep(Math.max(0, deadline - Date.now()) + 3500);
await call(bob, 'refund_staked_match', {match_id:refundCase});
assert.equal(await owner(a), aliceId);
assert.equal(await owner(b), bobId);
assert.equal(await get(refundCase), null);
console.log('Expired stake returned to its owner');
const match = await open();
assert.notEqual(match, refundCase);
await assert.rejects(lock(bob, match, a));
await lock(alice, match, a);
await lock(bob, match, b);
assert.deepEqual(await Promise.all([owner(a),owner(b)]), [contractId,contractId]);
await assert.rejects(payout(bob, match));
await payout(arbiter, match);
assert.deepEqual(await Promise.all([owner(a),owner(b)]), [aliceId,aliceId]);
await assert.rejects(payout(arbiter, match));
await call(alice, 'nft_transfer', {receiver_id:bobId,token_id:b}, 1n);
console.log('Both caps paid to winner. Unauthorized and repeated payouts rejected. Test holdings restored.');

}

async function lobby() {
 const key=KeyPair.fromRandom('ed25519');
 result(await arbiter.signAndSendTransaction({
  receiverId:arbiterId,waitUntil:'FINAL',actions:[
   actions.addFunctionCallAccessKey(key.getPublicKey(),contractId,
    ['open_staked_match','settle_staked_match'],200_000_000_000_000_000_000_000n),
  ],
 }));
 await provider.viewAccessKey({accountId:arbiterId,publicKey:key.getPublicKey().toString(),finalityQuery:{finality:'final'}});
 const config={
  NEAR_NETWORK:'testnet',FOUND_STAKES_ENABLED:'true',FOUND_CONTRACT_ID:contractId,
  FOUND_STAKE_ARBITER_ID:arbiterId,FOUND_STAKE_ARBITER_KEY:key.toString(),
  FOUND_CHALLENGE_SECRET:randomBytes(32).toString('hex'),
 };
 const api=matchApi({gate:nearOwnershipGate(config),stakes:testnetStakeChain(config)});
 const server=createServer((req,res)=>api(req,res,new URL(req.url,'http://localhost')));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port;
 async function request(path,session,body){
  const response=await fetch(url+path,{
   method:body?'POST':'GET',headers:{...(session?{Authorization:'Bearer '+session}:{})},
   ...(body?{body:JSON.stringify(body)}:{}),
  });
  const data=await response.json();
  if(!response.ok)throw Error(data.error);
  return data;
 }
 const state=session=>request('/api/state',session);
 const action=(session,body)=>request('/api/action',session,body);
 async function enter(id,tokenId){
  const {token:session,stakesEnabled}=await request('/api/session',null,{});
  assert.equal(stakesEnabled,true);
  const challenge=await action(session,{type:'wallet-challenge',accountId:id});
  const key=KeyPair.fromString(keys[id]);
  const {signature}=key.sign(messageHash(challenge));
  await action(session,{type:'wallet-bind',...challenge,publicKey:key.getPublicKey().toString(),signature:Buffer.from(signature).toString('base64')});
  const cap=dragons.findIndex(cap=>isFound(cap)&&cap.originalId===Number(tokenId.split('-')[1]));
  await action(session,{type:'queue',cap,tokenId,staked:true});
  return session;
 }
 async function until(session,predicate){
  for(let i=0;i<60;i++){
   const {room}=await state(session);
   if(room?.stake?.status==='unavailable')throw Error('Could not open the on-chain match.');
   if(predicate(room))return room;
   await sleep(750);
  }
  throw Error('Timed out waiting for stake match state.');
 }
 try {
  const x=await enter(aliceId,a);
  const heartbeat=setInterval(()=>void state(x).catch(()=>{}),1500);
  let y;
  try{y=await enter(bobId,b);}finally{clearInterval(heartbeat);}
  console.log('Two wallet sessions queued');
  const ready=await until(x,room=>room?.stake?.locked?.every(value=>!value));
  const id=ready.stake.id;
  await lock(alice,id,a);
  assert.equal((await state(x)).room.status,'ready');
  await lock(bob,id,b);
  await until(x,room=>room?.status==='playing');
  console.log('Both signed stakes verified by the lobby');
  // Play a full round over the actual HTTP endpoints.
  for(let i=0;i<40;i++){
   const room=await until(x,value=>['playing','rps','result'].includes(value?.status));
   if(room.status==='result')break;
   await state(y);
   if(room.status==='rps'){
    await action(x,{type:'rps',round:room.round,choice:'rock'});
    await action(y,{type:'rps',round:room.round,choice:'scissors'});
   }else{
    const actor=room.state.player===0?x:y;
    await action(actor,{type:'charge',round:room.round});
    await sleep(Math.round(room.stake.target.center*1200));
    await action(actor,{type:'throw',round:room.round});
   }
  }
  const final=await until(x,room=>room?.stake?.status==='paid');
  const winner=final.state.player===0?aliceId:bobId;
  assert.deepEqual(await Promise.all([owner(a),owner(b)]),[winner,winner]);
  console.log('HTTP match finished; both NFTs arrived in the winner’s wallet');
  if(winner===aliceId)await call(alice,'nft_transfer',{receiver_id:bobId,token_id:b},1n);
  else await call(bob,'nft_transfer',{receiver_id:aliceId,token_id:a},1n);
 }finally{server.close();}
}
