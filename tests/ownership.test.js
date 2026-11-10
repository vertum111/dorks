import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, sign} from 'node:crypto';
import {createOwnershipGate, decodeBase58, tokenMatchesCap} from '../found-ownership.mjs';
import {messageHash} from '../found-api.mjs';
import {createMatchmaker, guardFoundAction} from '../match-server.mjs';
import {dragons, isFound} from '../src/cap-catalog.js';

const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function encodeBase58(bytes) {
 let value = BigInt('0x' + Buffer.from(bytes).toString('hex'));
 let out = '';
 while (value > 0n) { out = alphabet[Number(value % 58n)] + out; value /= 58n; }
 for (const byte of bytes) { if (byte !== 0) break; out = '1' + out; }
 return out;
}
function wallet(accountId) {
 const {publicKey, privateKey} = generateKeyPairSync('ed25519');
 const raw = publicKey.export({format:'der', type:'spki'}).subarray(-32);
 return {
  accountId, publicKey:'ed25519:' + encodeBase58(raw),
  sign:challenge => ({publicKey:'ed25519:' + encodeBase58(raw), signature:sign(null,
   messageHash({message:challenge.message, recipient:challenge.recipient, nonce:challenge.nonce}), privateKey).toString('base64')}),
 };
}
const foundCap = original => dragons.findIndex(cap => isFound(cap) && cap.originalId === original);

function world() {
 const owners = new Map([['found-05-12', 'alice.near'], ['found-07-01', 'bob.near']]);
 const keys = new Set();
 const gate = createOwnershipGate({
  network:'mainnet', contractId:'caps.near', secret:'x'.repeat(40), recipient:'dorksplay.lol',
  isFullAccessKey:async (account, key) => keys.has(`${account}|${key}`),
  ownerOf:async token => owners.get(token) ?? null,
 });
 const mm = createMatchmaker();
 const send = async (c, body) => {
  const action = {round:mm.snapshot(c).room?.round, ...body};
  const reply = await guardFoundAction(gate, mm, c, action);
  if (!reply) mm.action(c, action);
  return reply;
 };
 const join = async (c, w) => {
  keys.add(`${w.accountId}|${w.publicKey}`);
  const challenge = await send(c, {type:'wallet-challenge', accountId:w.accountId});
  return send(c, {type:'wallet-bind', ...challenge, ...w.sign(challenge), accountId:w.accountId});
 };
 return {owners, keys, gate, mm, send, join};
}

test('base58 decoding round-trips NEAR public keys', () => {
 const bytes = Buffer.from([0, 0, 7, 255, 1, 2]);
 assert.deepEqual(decodeBase58(encodeBase58(bytes)), bytes);
});

test('token ids must match the equipped Found design', () => {
 assert.equal(tokenMatchesCap('found-05-12', foundCap(5)), true);
 assert.equal(tokenMatchesCap('found-05-12', foundCap(6)), false);
 assert.equal(tokenMatchesCap('found-05-12', 4), false, 'a regular cap is not a Found token');
 assert.equal(tokenMatchesCap('found-99-01', foundCap(5)), false);
});

test('only the signed owner of a Found NFT can queue with it', async () => {
 const w = world(), a = w.mm.create(), b = w.mm.create();
 const alice = wallet('alice.near');
 await assert.rejects(w.send(a, {type:'queue', cap:foundCap(5), tokenId:'found-05-12'}), /Connect the wallet/);
 await w.join(a, alice);
 await assert.rejects(w.send(a, {type:'queue', cap:foundCap(7), tokenId:'found-07-01'}), /no longer in your wallet/);
 await assert.rejects(w.send(a, {type:'queue', cap:foundCap(7), tokenId:'found-05-12'}), /not this Found Cap/);
 await w.send(a, {type:'queue', cap:foundCap(5), tokenId:'found-05-12'});
 assert.equal(w.mm.snapshot(a).queued, true);
 // Regular caps stay open to guests.
 await w.send(b, {type:'queue', cap:3});
 assert.equal(w.mm.snapshot(b).queued, true);
});

test('a signature is bound to its session, account and key', async () => {
 const w = world(), a = w.mm.create(), thief = w.mm.create();
 const alice = wallet('alice.near'), mallory = wallet('mallory.near');
 w.keys.add(`alice.near|${alice.publicKey}`);
 const challenge = await w.send(a, {type:'wallet-challenge', accountId:'alice.near'});
 const proof = alice.sign(challenge);
 await assert.rejects(w.send(thief, {type:'wallet-bind', ...challenge, ...proof, accountId:'alice.near'}), /expired/);
 await assert.rejects(w.send(a, {type:'wallet-bind', ...challenge, ...mallory.sign(challenge), accountId:'alice.near'}), /full-access/);
 const forged = {type:'wallet-bind', ...challenge, ...proof, signature:mallory.sign(challenge).signature, accountId:'alice.near'};
 await assert.rejects(w.send(a, forged), /could not be verified/);
 assert.deepEqual(await w.send(a, {type:'wallet-bind', ...challenge, ...proof, accountId:'alice.near'}), {ok:true, accountId:'alice.near'});
});

test('transferring the NFT mid-session removes it from the table', async () => {
 const w = world(), a = w.mm.create(), b = w.mm.create();
 await w.join(a, wallet('alice.near'));
 await w.join(b, wallet('bob.near'));
 await w.send(a, {type:'queue', cap:foundCap(5), tokenId:'found-05-12'});
 await w.send(b, {type:'queue', cap:foundCap(7), tokenId:'found-07-01'});
 assert.equal(w.mm.snapshot(a).room.status, 'ready');
 w.owners.set('found-05-12', 'bob.near');
 await assert.rejects(w.send(a, {type:'ready'}), /no longer in your wallet/);
 assert.equal(w.mm.snapshot(b).room.status, 'left');
});

test('without a configured contract the Found queue stays closed', async () => {
 const mm = createMatchmaker(), c = mm.create();
 await assert.rejects(guardFoundAction(null, mm, c, {type:'queue', cap:foundCap(5), tokenId:'found-05-12'}), /NEAR contract/);
 assert.deepEqual(await guardFoundAction(null, mm, c, {type:'queue', cap:2}), {ok:true});
});

test('the second ready checks both owners, even after a failed queue request', async () => {
 const w = world(), a = w.mm.create(), b = w.mm.create();
 await w.join(a, wallet('alice.near'));
 await w.join(b, wallet('bob.near'));
 await w.send(a, {type:'queue', cap:foundCap(5), tokenId:'found-05-12'});
 await w.send(b, {type:'queue', cap:foundCap(7), tokenId:'found-07-01'});
 await w.send(a, {type:'ready'});
 await assert.rejects(w.send(a, {type:'queue', cap:-1}), /Choose a valid cap/);
 assert.equal(a.foundToken, 'found-05-12');
 w.owners.set('found-05-12', 'bob.near');
 await assert.rejects(w.send(b, {type:'ready'}), /no longer in your wallet/);
 assert.equal(w.mm.snapshot(a).room.status, 'left');
});
