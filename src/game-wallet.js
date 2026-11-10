import {getFoundConnector, ownedFoundCaps} from './found-wallet.js';

export function mountGameWallet({onChange, connectorFor = getFoundConnector, fetchPage = fetch}) {
 let connector, network, contractId, accountId, caps = [], busy = false, error = '';
 let available = true;
 let currentWallet;
 const buttons = [...document.querySelectorAll('[data-found-wallet]')];

 function render() {
  for (const button of buttons) {
   button.disabled = busy || (!available && !accountId);
   button.textContent = busy ? 'Checking wallet…' : accountId ? 'Disconnect' : 'Connect wallet';
  }
  for (const label of document.querySelectorAll('[data-wallet-account]')) {
   label.textContent = accountId ?? '';
   label.title = accountId ?? '';
   label.hidden = !accountId;
  }
  onChange({accountId, caps, busy, error, available});
 }

 async function request(path) {
  const response = await fetchPage('/api/found/' + path, {signal:AbortSignal.timeout(12000)});
  if (!response.ok) throw new Error('Could not load your Found Caps. Try again.');
  return response.json();
 }

 async function init() {
  if (connector) return;
  const drop = await request('status');
  if (!drop.contractId || !['mainnet','testnet'].includes(drop.network)) {
   available = false;
   return;
  }
  available = true;
  network = drop.network;
  contractId = drop.contractId;
  connector = await connectorFor(network);
 }

 async function sync(interactive = false) {
  if (busy) return;
  busy = true;
  error = '';
  render();
  try {
   await init();
   if (!connector || !contractId) return;
   if (interactive) await connector.connect();
   let connection;
   try { connection = await connector.getConnectedWallet(); }
   catch (failure) {
    accountId = currentWallet = undefined;
    caps = [];
    if (interactive) throw failure;
    return;
   }
   currentWallet = connection.wallet;
   const next = connection.accounts.find(account => account.accountId === accountId) ?? connection.accounts[0];
   if (next.accountId !== accountId) caps = [];
   accountId = next.accountId;
   const tokens = [];
   let offset = 0;
   do {
    const page = await request('inventory?account=' + encodeURIComponent(accountId) + '&offset=' + offset);
    tokens.push(...page.tokens);
    offset = Number.isSafeInteger(page.nextOffset) && page.nextOffset > offset ? page.nextOffset : null;
   } while (offset !== null);
   caps = ownedFoundCaps(tokens, accountId);
  } catch {
   caps = [];
   error = 'Could not check your wallet or load its caps. Try again.';
  } finally {
   busy = false;
   render();
  }
 }

 async function toggle() {
  if (busy) return;
  if (!accountId) return sync(true);
  busy = true;
  error = '';
  render();
  try {
   await connector.disconnect(currentWallet);
   accountId = currentWallet = undefined;
   caps = [];
  } catch {
   error = 'Could not disconnect this wallet. Try again.';
  } finally {
   busy = false;
   render();
  }
 }

 // Signs the server's NEP-413 table pass so the lobby can verify NFT ownership.
 async function sign(challenge) {
  if (!accountId || challenge.accountId !== accountId) throw new Error('Connect the wallet that holds this Found Cap.');
  const wallet = currentWallet ?? await connector.wallet();
  const nonce = Uint8Array.from(challenge.nonce.match(/../g), byte => parseInt(byte, 16));
  const proof = await wallet.signMessage({
   message:challenge.message, recipient:challenge.recipient, nonce, signerId:accountId, network,
  });
  if (proof?.accountId !== accountId) throw new Error('Sign with the connected NEAR account.');
  return {publicKey:proof.publicKey, signature:proof.signature};
 }

 for (const button of buttons) button.onclick = toggle;
 window.addEventListener('focus', () => { if (accountId) void sync(); });
 window.addEventListener('pageshow', event => { if (event.persisted) void sync(); });
 void sync();
 return {refresh:sync, sign};
}
