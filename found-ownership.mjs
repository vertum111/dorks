// Server-side gate for the Found queue: a game session proves which NEAR
// account it speaks for (NEP-413 signed message), then every Found cap it
// brings to the table is checked against the contract's current owner.
import {createHash, createHmac, createPublicKey, randomBytes, timingSafeEqual, verify} from 'node:crypto';
import {messageHash} from './found-api.mjs';
import {dragons, isFound} from './src/cap-catalog.js';

const accountPattern = /^(?=.{2,64}$)[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const tokenPattern = /^found-(0[1-9]|[12][0-9]|3[0-2])-(0[1-9]|[12][0-9]|3[0-2])$/;
const keyPattern = /^ed25519:[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const signaturePattern = /^[A-Za-z0-9+/]{86}==$/;
const ed25519Spki = Buffer.from('302a300506032b6570032100', 'hex');
const base58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const proofLifetime = 5 * 60 * 1000;

export function decodeBase58(text) {
 let value = 0n;
 for (const char of text) {
  const digit = base58.indexOf(char);
  if (digit < 0) throw new Error('Invalid base58.');
  value = value * 58n + BigInt(digit);
 }
 const bytes = [];
 while (value > 0n) { bytes.unshift(Number(value & 0xffn)); value >>= 8n; }
 for (const char of text) { if (char !== '1') break; bytes.unshift(0); }
 return Buffer.from(bytes);
}

/** True when the token id is a Found edition of the design at `cap`. */
export function tokenMatchesCap(tokenId, cap) {
 const match = tokenPattern.exec(tokenId ?? '');
 const design = dragons[cap];
 return Boolean(match && design && isFound(design) && design.originalId === Number(match[1]));
}

export class OwnershipError extends Error {}

export function createOwnershipGate({network, contractId, secret, recipient, isFullAccessKey, ownerOf, now = Date.now}) {
 if (!contractId || !(secret?.length >= 32)) return null;
 const sessionTag = session => createHash('sha256').update(session).digest('hex').slice(0, 16);
 const mac = value => createHmac('sha256', secret).update(value).digest();
 const ticketData = (session, accountId, nonce, expiresAt) => JSON.stringify(['play', sessionTag(session), accountId, nonce, expiresAt]);
 const message = (session, accountId, expiresAt) =>
  `Play DORKS with the Found Caps held by ${accountId} on NEAR ${network}. Contract: ${contractId}. Table pass: ${sessionTag(session)}. Expires: ${new Date(expiresAt).toISOString()}.`;

 return {
  challenge(session, accountId) {
   if (!accountPattern.test(accountId ?? '')) throw new OwnershipError('Invalid NEAR account.');
   const nonce = randomBytes(32).toString('hex');
   const expiresAt = now() + proofLifetime;
   const ticket = mac(ticketData(session, accountId, nonce, expiresAt)).toString('hex');
   return {accountId, nonce, expiresAt, ticket, recipient, network, message:message(session, accountId, expiresAt)};
  },

  async bind(session, {accountId, nonce, expiresAt, ticket, publicKey, signature} = {}) {
   if (!accountPattern.test(accountId ?? '') || !/^[0-9a-f]{64}$/.test(nonce ?? '') ||
       !/^[0-9a-f]{64}$/.test(ticket ?? '') || !Number.isSafeInteger(expiresAt) || expiresAt < now() ||
       !timingSafeEqual(Buffer.from(ticket, 'hex'), mac(ticketData(session, accountId, nonce, expiresAt)))) {
    throw new OwnershipError('Wallet check expired. Try again.');
   }
   if (!keyPattern.test(publicKey ?? '') || !signaturePattern.test(signature ?? '')) {
    throw new OwnershipError('Sign with an Ed25519 full-access wallet key.');
   }
   const raw = decodeBase58(publicKey.slice(8));
   if (raw.length !== 32) throw new OwnershipError('Invalid wallet key.');
   const key = createPublicKey({key:Buffer.concat([ed25519Spki, raw]), format:'der', type:'spki'});
   const hash = messageHash({message:message(session, accountId, expiresAt), recipient, nonce});
   if (!verify(null, hash, key, Buffer.from(signature, 'base64'))) throw new OwnershipError('Wallet signature could not be verified.');
   if (!await isFullAccessKey(accountId, publicKey)) throw new OwnershipError('Use a full-access key of this NEAR account.');
   return accountId;
  },

  async check(accountId, tokenId, cap) {
   if (!accountId) throw new OwnershipError('Connect the wallet that holds this Found Cap.');
   if (!tokenMatchesCap(tokenId, cap)) throw new OwnershipError('That token is not this Found Cap.');
   if (await ownerOf(tokenId) !== accountId) throw new OwnershipError('This Found Cap is no longer in your wallet.');
  },
 };
}

/** Production wiring: NEAR RPC via near-api-js, the same config as the Found API. */
export function nearOwnershipGate(config = process.env) {
 const network = config.NEAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
 const contractId = config.FOUND_CONTRACT_ID;
 const siteOrigin = config.DORKS_SITE_ORIGIN;
 let connection;
 const rpc = () => connection ??= import('near-api-js').then(sdk => new sdk.JsonRpcProvider({url:config.NEAR_RPC_URL ??
  (network === 'mainnet' ? 'https://free.rpc.fastnear.com' : 'https://test.rpc.fastnear.com')}));
 return createOwnershipGate({
  network, contractId, secret:config.FOUND_CHALLENGE_SECRET,
  recipient:siteOrigin ? new URL(siteOrigin).host : 'DORKS Found local',
  async isFullAccessKey(accountId, publicKey) {
   try {
    const access = await (await rpc()).viewAccessKey({accountId, publicKey, finalityQuery:{finality:'final'}});
    return access.permission === 'FullAccess';
   } catch { return false; }
  },
  async ownerOf(tokenId) {
   const token = await (await rpc()).callFunction({contractId, method:'nft_token', args:{token_id:tokenId}, blockQuery:{finality:'optimistic'}});
   return token?.owner_id ?? null;
  },
 });
}
