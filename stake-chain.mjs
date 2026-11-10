import {Account, JsonRpcProvider, KeyPair, teraToGas} from 'near-api-js';

export function stakeChain(config=process.env){
 const network=config.NEAR_NETWORK;
 if(!['testnet','mainnet'].includes(network))return null;
 const acceptingMatches=config.FOUND_STAKES_ENABLED==='true';
 const contractId=config.FOUND_CONTRACT_ID,accountId=config.FOUND_STAKE_ARBITER_ID;
 if(!accountId||!config.FOUND_STAKE_ARBITER_KEY)return null;
 if(network==='testnet'&&(!contractId?.endsWith('.testnet')||!accountId.endsWith('.testnet')))return null;
 if(network==='mainnet'&&(contractId!=='vertumion-hot2.tg'||accountId!==`stakes.${contractId}`))return null;
 const rpc=new JsonRpcProvider({url:config.NEAR_RPC_URL||(network==='testnet'?'https://test.rpc.fastnear.com':'https://free.rpc.fastnear.com')});
 const key=KeyPair.fromString(config.FOUND_STAKE_ARBITER_KEY),account=new Account(accountId,rpc,key.toString());
 let pending=Promise.resolve();
 async function checkKey(){
   const access=await rpc.viewAccessKey({accountId,publicKey:key.getPublicKey().toString(),finalityQuery:{finality:'final'}});
   const permission=access.permission?.FunctionCall;
   const allowed=['open_staked_match','record_staked_winner','pay_staked_winner'];
   if(permission?.receiver_id!==contractId||!(Number(permission.allowance)>0)||
      permission.method_names?.length!==allowed.length||!allowed.every(name=>permission.method_names.includes(name))){
    throw Error('The arbiter needs a scoped access key.');
   }
 }
 function submit(methodName,args){
  const job=pending.then(async()=>{
   await checkKey();
   return account.callFunction({contractId,methodName,args,gas:teraToGas('35'),deposit:0n,waitUntil:'FINAL'});
  });
  pending=job.catch(()=>{});
  return job;
 }
 const view=(method,args)=>rpc.callFunction({contractId,method,args,blockQuery:{finality:'final'}});
 const pay=match_id=>submit('pay_staked_winner',{match_id});
 let recovery,enabled=false;
 return {
  contractId,network,get enabled(){return enabled;},
  async refresh(){
   try{
    const [judge]=await Promise.all([view('stake_arbiter',{}),checkKey()]);
    enabled=acceptingMatches&&judge===accountId;
   }catch{enabled=false;}
  },
  open:(players,tokens)=>submit('open_staked_match',{players,tokens}),
  get:match_id=>view('get_staked_match',{match_id}),
  verdict:match_id=>view('get_stake_verdict',{match_id}),
  record:(match_id,winner)=>submit('record_staked_winner',{match_id,winner}),
  pay,
  recover(){
   if(!recovery)recovery=(async()=>{
    for(const id of await view('pending_stake_payouts',{})){
     try{await pay(id);}catch(error){console.warn('Could not recover stake payout:',error.message);}
    }
   })().finally(()=>{recovery=null;});
   return recovery;
  },
 };
}
