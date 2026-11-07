import {createHash, createHmac, createPublicKey, randomBytes, timingSafeEqual, verify} from 'node:crypto';
import {FOUND_OPENS_AT} from './src/found-launch.js';

const accountPattern = /^(?=.{2,64}$)[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const tokenPattern = /^found-(0[1-9]|[12][0-9]|3[0-2])-(0[1-9]|[12][0-9]|3[0-2])$/;
const challengeLifetime = 5 * 60 * 1000;
const ed25519Spki = Buffer.from('302a300506032b6570032100', 'hex');

function stringBytes(value) {
 const bytes = Buffer.from(value, 'utf8');
 const length = Buffer.alloc(4);
 length.writeUInt32LE(bytes.length);
 return Buffer.concat([length, bytes]);
}

export function messageHash({message, recipient, nonce}) {
 const tag = Buffer.alloc(4);
 tag.writeUInt32LE(2 ** 31 + 413);
 return createHash('sha256').update(Buffer.concat([
  tag, stringBytes(message), Buffer.from(nonce, 'hex'), stringBytes(recipient), Buffer.from([0]),
 ])).digest();
}

async function readBody(req) {
 let raw = '';
 for await (const part of req) {
  raw += part;
  if (raw.length > 4096) throw new Error('Request too large.');
 }
 return JSON.parse(raw);
}

export function isScopedSponsorKey(permission, contractId) {
 const scope = permission?.FunctionCall;
 return scope?.receiver_id === contractId &&
  scope.method_names?.length === 1 && scope.method_names[0] === 'claim' &&
  /^[1-9][0-9]*$/.test(String(scope.allowance));
}

export function foundApi(config = process.env) {
 const network = config.NEAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
 const contractId = config.FOUND_CONTRACT_ID;
 const opensAt = config.FOUND_OPENS_AT ?? FOUND_OPENS_AT;
 const hasOpened = () => Date.now() >= Date.parse(opensAt);
 const sponsorId = config.FOUND_SPONSOR_ID;
 const secret = config.FOUND_CHALLENGE_SECRET;
 const siteOrigin = config.DORKS_SITE_ORIGIN;
 // Browsers treat loopback as a secure context. Only testnet may use HTTP here.
 const validSiteOrigin = siteOrigin?.startsWith('https://') ||
  (network === 'testnet' && /^http:\/\/(?:localhost|127\.0\.0\.1)(?::[0-9]+)?$/.test(siteOrigin ?? ''));
 const enabled = Boolean(config.FOUND_MINT_ENABLED === '1' && contractId && sponsorId &&
  contractId !== sponsorId && config.FOUND_SPONSOR_KEY && secret?.length >= 32 &&
  validSiteOrigin);
 const recipient = siteOrigin ? new URL(siteOrigin).host : 'DORKS Found local';
 let minting = false;
 let connection;

 // A prebuilt local game can run without installing NEAR dependencies.
 const chain = () => connection ??= import('near-api-js').then(sdk => {
  const rpc = new sdk.JsonRpcProvider({url:config.NEAR_RPC_URL ??
   (network === 'mainnet' ? 'https://free.rpc.fastnear.com' : 'https://test.rpc.fastnear.com')});
  return {...sdk, rpc};
 });
 const view = async (method, args = {}) => {
  const {rpc} = await chain();
  return rpc.callFunction({contractId, method, args, blockQuery:{finality:'final'}});
 };
 const mac = value => createHmac('sha256', secret).update(value).digest();
 const proofMessage = (accountId, expiresAt) =>
  `Claim up to three free DORKS Found Caps for ${accountId} on NEAR ${network}. Contract: ${contractId}. Expires: ${new Date(expiresAt).toISOString()}.`;
 const ticketData = (accountId, nonce, expiresAt) => JSON.stringify([accountId, nonce, expiresAt]);
 const inventory = (accountId, offset = 0) => view('nft_tokens_for_owner', {
  account_id:accountId, from_index:String(offset), limit:64,
 });

 return async (req, res, url) => {
  if (!url.pathname.startsWith('/api/found/')) return false;
  const send = (status, data) => {
   res.writeHead(status, {'Content-Type':'application/json', 'Cache-Control':'no-store'});
   res.end(JSON.stringify(data));
   return true;
  };
  const route = url.pathname.slice('/api/found/'.length);
  try {
   if (route === 'status' && req.method === 'GET') {
    const remaining = contractId ? await view('remaining') : null;
    return send(200, {enabled:enabled && hasOpened(), opensAt, network, contractId: contractId ?? null, remaining});
   }
   if (route === 'inventory' && req.method === 'GET' && contractId) {
    const accountId = url.searchParams.get('account');
    if (!accountPattern.test(accountId ?? '')) return send(400, {error:'Invalid NEAR account.'});
    const offset = Number(url.searchParams.get('offset') ?? 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1024) {
     return send(400, {error:'Invalid inventory offset.'});
    }
    const tokens = await inventory(accountId, offset);
    return send(200, {tokens, nextOffset:tokens.length === 64 && offset + 64 < 1024 ? offset + 64 : null});
   }
   if (route === 'transfers' && req.method === 'GET' && contractId) {
    const accountId = url.searchParams.get('account');
    if (!accountPattern.test(accountId ?? '')) return send(400, {error:'Invalid NEAR account.'});
    const tokens = await inventory(accountId);
    const requests = await view('transfer_requests', {token_ids:tokens.map(token => token.token_id)});
    return send(200, {caps:tokens.map((token, index) => ({...token, request:requests[index]}))});
   }
   if (req.method !== 'POST' || !['challenge','claim'].includes(route)) return send(404, {error:'Unknown endpoint.'});
   if (!enabled || !hasOpened()) return send(503, {error:'The Found drop is not open yet.'});
   const expectedOrigin = siteOrigin ?? `http://${req.headers.host}`;
   if (req.headers.origin !== expectedOrigin) return send(403, {error:'Open the claim page on DORKS.'});
   const body = await readBody(req);
   const {accountId} = body;
   if (typeof accountId !== 'string' || !accountPattern.test(accountId)) return send(400, {error:'Invalid NEAR account.'});

   if (route === 'challenge') {
    const nonce = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + challengeLifetime;
    const ticket = mac(ticketData(accountId, nonce, expiresAt)).toString('hex');
    return send(200, {nonce, expiresAt, ticket, recipient, message:proofMessage(accountId, expiresAt)});
   }

   const {nonce, expiresAt, ticket, publicKey, signature} = body;
   if (typeof nonce !== 'string' || !/^[0-9a-f]{64}$/.test(nonce) ||
       typeof ticket !== 'string' || !/^[0-9a-f]{64}$/.test(ticket) ||
       !Number.isSafeInteger(expiresAt) || expiresAt < Date.now() ||
       !timingSafeEqual(Buffer.from(ticket, 'hex'), mac(ticketData(accountId, nonce, expiresAt)))) {
    return send(400, {error:'Claim expired. Try again.'});
   }
   if (typeof publicKey !== 'string' || !/^ed25519:[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(publicKey) ||
       typeof signature !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(signature)) {
    return send(400, {error:'The wallet must sign with an Ed25519 full-access key.'});
   }
   const {Account, KeyPair, baseDecode, rpc, teraToGas} = await chain();
   const rawKey = Buffer.from(baseDecode(publicKey.slice(8)));
   if (rawKey.length !== 32) return send(400, {error:'Invalid wallet key.'});
   const key = createPublicKey({key:Buffer.concat([ed25519Spki, rawKey]), format:'der', type:'spki'});
   const hash = messageHash({message:proofMessage(accountId, expiresAt), recipient, nonce});
   if (!verify(null, hash, key, Buffer.from(signature, 'base64'))) return send(403, {error:'Wallet signature could not be verified.'});

   if (minting) return send(429, {error:'Another cap is being minted. Try again in a moment.'});
   minting = true;
   try {
    const access = await rpc.viewAccessKey({accountId, publicKey, finalityQuery:{finality:'final'}});
    if (access.permission !== 'FullAccess') return send(403, {error:'Use a full-access wallet key.'});
    let tokenIds = await view('claim_status', {account_id:accountId});
    if (!Array.isArray(tokenIds)) return send(503, {error:'The Found contract needs an update.'});
    if (tokenIds.length < 3 && await view('remaining') > 0) {
     const sponsorKey = config.FOUND_SPONSOR_KEY;
     const sponsorAccess = await rpc.viewAccessKey({
      accountId:sponsorId, publicKey:KeyPair.fromString(sponsorKey).getPublicKey().toString(),
      finalityQuery:{finality:'final'},
     });
     if (!isScopedSponsorKey(sponsorAccess.permission, contractId)) {
      console.error('Found sponsor key must be limited to claim with a finite gas allowance.');
      return send(503, {error:'Sponsored mint is unavailable.'});
     }
     const sponsor = new Account(sponsorId, rpc, sponsorKey);
     await sponsor.callFunction({
      contractId, methodName:'claim', args:{receiver_id:accountId},
      gas:teraToGas('100'), deposit:0n, waitUntil:'FINAL',
     });
     tokenIds = await view('claim_status', {account_id:accountId});
    }
    if (!tokenIds.length && await view('remaining') === 0) {
     return send(409, {error:'All Found Caps have been claimed.'});
    }
    if (!tokenIds.length || tokenIds.some(id => !tokenPattern.test(id))) {
     return send(503, {error:'Waiting for NEAR confirmation. Retry to check your caps.'});
    }
    return send(200, {tokenIds, tokens:await inventory(accountId)});
   } finally {
    minting = false;
   }
  } catch (error) {
   if (error instanceof SyntaxError || error.message === 'Request too large.') return send(400, {error:'Invalid request.'});
   console.error('Found API request failed:', route, error.name);
   return send(503, {error:'NEAR is temporarily unavailable. Try again in a moment.'});
  }
 };
}
