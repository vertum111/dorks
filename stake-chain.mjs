import {Account, JsonRpcProvider, KeyPair, teraToGas} from 'near-api-js';

export function testnetStakeChain(config=process.env){
 if(config.NEAR_NETWORK!=='testnet'||config.FOUND_STAKES_ENABLED!=='true')return null;
 const contractId=config.FOUND_CONTRACT_ID,accountId=config.FOUND_STAKE_ARBITER_ID;
 if(!contractId?.endsWith('.testnet')||!accountId?.endsWith('.testnet')||!config.FOUND_STAKE_ARBITER_KEY)return null;
 const rpc=new JsonRpcProvider({url:config.NEAR_RPC_URL||'https://test.rpc.fastnear.com'});
 const key=KeyPair.fromString(config.FOUND_STAKE_ARBITER_KEY),account=new Account(accountId,rpc,key.toString());
 let pending=Promise.resolve();
 function submit(methodName,args){
  const job=pending.then(async()=>{
   const access=await rpc.viewAccessKey({accountId,publicKey:key.getPublicKey().toString(),finalityQuery:{finality:'final'}});
   const permission=access.permission?.FunctionCall;
   const allowed=['open_staked_match','settle_staked_match'];
   if(permission?.receiver_id!==contractId||!(Number(permission.allowance)>0)||
      permission.method_names?.length!==allowed.length||!allowed.every(name=>permission.method_names.includes(name))){
    throw Error('The testnet arbiter needs a scoped access key.');
   }
   return account.callFunction({contractId,methodName,args,gas:teraToGas('35'),deposit:0n,waitUntil:'FINAL'});
  });
  pending=job.catch(()=>{});
  return job;
 }
 return {
  contractId,
  open:(players,tokens)=>submit('open_staked_match',{players,tokens}),
  get:match_id=>rpc.callFunction({contractId,method:'get_staked_match',args:{match_id},blockQuery:{finality:'final'}}),
  settle:(match_id,winner)=>submit('settle_staked_match',{match_id,winner}),
 };
}
