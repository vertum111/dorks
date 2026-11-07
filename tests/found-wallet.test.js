import test from 'node:test';
import assert from 'node:assert/strict';
import {ownedFoundCaps} from '../src/found-wallet.js';

test('collection contains each owned NFT once, including copies of the same design', () => {
 const owner_id = 'alice.testnet';
 const token = token_id => ({token_id, owner_id});
 const tokens = [token('found-03-01'), token('found-03-02'), token('found-03-01'),
  {token_id:'found-09-01', owner_id:'bob.testnet'}, token('found-00-01')];
 assert.deepEqual(ownedFoundCaps(tokens, owner_id), [
  {id:'found-03-01', index:34, serial:'01'}, {id:'found-03-02', index:34, serial:'02'},
 ]);
 assert.deepEqual(ownedFoundCaps(tokens, 'bob.testnet').map(cap => cap.id), ['found-09-01']);
 assert.deepEqual(ownedFoundCaps(tokens, undefined), []);
});

test('lobby restores the wallet, then clears and reloads collection when switching wallets', async () => {
 const {mountGameWallet} = await import('../src/game-wallet.js');
 const originals = {document:globalThis.document, window:globalThis.window};
 const button = {}, label = {};
 const players = ['alice.testnet', 'bob.testnet'];
 let accountId = players[0], state, nextRender;
 const wallet = {};
 const connector = {
  async getConnectedWallet() {
   if (!accountId) throw new Error('Not connected');
   return {wallet, accounts:[{accountId}]};
  },
  async disconnect() { accountId = undefined; },
  async connect() { accountId = players[1]; },
 };
 globalThis.document = {querySelectorAll: selector => selector === '[data-found-wallet]' ? [button] : [label]};
 globalThis.window = {addEventListener() {}};
 const finished = () => new Promise(resolve => { nextRender = resolve; });
 try {
  const restored = finished();
  mountGameWallet({
   connectorFor: async () => connector,
   fetchPage: async path => ({
    ok:true,
    json: async () => path.endsWith('/status') ? {network:'testnet',contractId:'found.testnet'} :
     {tokens:[{token_id:accountId === players[0] ? 'found-03-01':'found-09-01',owner_id:accountId}]},
   }),
   onChange(value) {
    state = value;
    if (!value.busy) nextRender?.();
   },
  });
  await restored;
  assert.equal(label.textContent, players[0]);
  assert.deepEqual(state.caps.map(cap => cap.id), ['found-03-01']);
  await button.onclick();
  assert.equal(label.hidden, true);
  assert.equal(button.textContent,'Connect wallet');
  assert.deepEqual(state.caps, []);
  await button.onclick();
  assert.equal(label.textContent, players[1]);
  assert.deepEqual(state.caps.map(cap => cap.id), ['found-09-01']);
 } finally {
  for (const [key, value] of Object.entries(originals)) {
   if (value === undefined) delete globalThis[key];
   else globalThis[key] = value;
  }
 }
});
