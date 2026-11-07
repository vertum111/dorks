import assert from 'node:assert/strict';
import test from 'node:test';
import {foundApi, isScopedSponsorKey} from '../found-api.mjs';

test('the sponsor key must be limited to one contract and only claim, with a gas budget', () => {
 const contract = 'found.testnet';
 const scope = {receiver_id:contract, method_names:['claim'], allowance:'100000000000000000000000'};
 assert.equal(isScopedSponsorKey({FunctionCall:scope}, contract), true);
 assert.equal(isScopedSponsorKey('FullAccess', contract), false);
 for (const override of [
  {receiver_id:'other.testnet'}, {method_names:[]},
  {method_names:['claim','nft_transfer']}, {allowance:null}, {allowance:'0'},
 ]) {
  assert.equal(isScopedSponsorKey({FunctionCall:{...scope, ...override}}, contract), false);
 }
});

test('mint stays closed by default and cannot use the contract account as sponsor', async () => {
 const config = {
  FOUND_CONTRACT_ID:'found.testnet', FOUND_SPONSOR_ID:'sponsor.testnet',
  FOUND_SPONSOR_KEY:'placeholder', FOUND_CHALLENGE_SECRET:'x'.repeat(32),
  FOUND_OPENS_AT:'2020-01-01T00:00:00Z', DORKS_SITE_ORIGIN:'https://dorksplay.lol',
 };
 for (const override of [{}, {FOUND_MINT_ENABLED:'1', FOUND_SPONSOR_ID:'found.testnet'}]) {
  const handler = foundApi({...config, ...override});
  for (const route of ['challenge', 'claim']) {
   let status;
   await handler({method:'POST'}, {
    writeHead(code) { status = code; },
    end() {},
   }, new URL('https://dorksplay.lol/api/found/' + route));
   assert.equal(status, 503);
  }
 }
});
