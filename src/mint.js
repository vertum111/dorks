import {getFoundConnector} from './found-wallet.js';
import './style.css';
import './mint.css';
import {FOUND_OPENS_AT} from './found-launch.js';
import {dragons, frontImage} from './cap-catalog.js';

const action = document.querySelector('#mint-action');
const disconnect = document.querySelector('#mint-disconnect');
const status = document.querySelector('#mint-status');
const inventory = document.querySelector('#mint-inventory');
let drop;
let connector;
let accountId;
const countdown = document.querySelector('#mint-countdown');
const opens = document.querySelector('#mint-opens');
const clock = document.querySelector('#mint-clock');
let opensAt = Date.parse(FOUND_OPENS_AT);


function tickCountdown() {
 const seconds = Math.max(0, Math.ceil((opensAt - Date.now()) / 1000));
 countdown.hidden = seconds === 0;
 if (!seconds) return false;
 opens.dateTime = new Date(opensAt).toISOString();
 opens.textContent = new Intl.DateTimeFormat('en-GB', {
  timeZone:'Europe/Kyiv', weekday:'long', day:'numeric', month:'long', hour:'2-digit', minute:'2-digit',
 }).format(opensAt) + ' Kyiv time';
 clock.textContent = [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24,
  Math.floor(seconds / 60) % 60, seconds % 60].map((value,index)=>String(value).padStart(2,'0') + ['d','h','m','s'][index]).join(' ');
 return true;
}


const friendPanel = document.querySelector('#friend-caps');
const friendForm = document.querySelector('#friend-lookup');
const friendResults = document.querySelector('#friend-inventory');
const friendStatus = document.querySelector('#friend-status');
let friendId;
let transferBusy = false;
const requestDeposit = '10000000000000000000000';

function activeRequest(cap) {
 return cap.request?.owner_id === cap.owner_id && cap.request.expires_at_ms > Date.now();
}

function transferButton(label, operation) {
 const button = document.createElement('button');
 button.type = 'button';
 button.className = 'paper-button';
 button.textContent = label;
 button.onclick = operation;
 return button;
}

async function refreshTransfers() {
 const currentAccount = accountId;
 const currentFriend = friendId;
 if (!currentAccount) return;
 const load = account => request('transfers?account=' + encodeURIComponent(account));
 const [mine, friend] = await Promise.all([
  load(currentAccount), currentFriend ? load(currentFriend) : null,
 ]);
 if (currentAccount !== accountId || currentFriend !== friendId) return;
 showTokens(mine.caps);
 friendResults.replaceChildren();
 if (!friend) return;
 if (!friend.caps.length) {
  friendResults.textContent = 'No Found Caps in this wallet yet.';
  return;
 }
 for (const cap of friend.caps) {
  const row = document.createElement('article');
  const title = document.createElement('span');
  title.textContent = cap.metadata?.title ?? cap.token_id;
  row.append(title);
  const pending = cap.request;
  if (pending?.requester_id === currentAccount) {
   row.append(transferButton('Cancel request', () => resolveTransfer(cap, false)));
  } else if (activeRequest(cap)) {
   const badge = document.createElement('span');
   badge.textContent = 'Request pending';
   row.append(badge);
  } else {
   row.append(transferButton('Request cap', () => sendTransferAction('request_transfer', {
    token_id: cap.token_id, owner_id: currentFriend,
   }, requestDeposit, 'Request sent. The 0.01 NEAR deposit is refundable.')));
  }
  friendResults.append(row);
 }
}

async function sendTransferAction(methodName, args, deposit, success) {
 if (transferBusy || !accountId) return;
 transferBusy = action.disabled = disconnect.disabled = true;
 friendStatus.textContent = 'Confirm in your NEAR wallet.';
 try {
  const wallet = await connector.wallet();
  const outcome = await wallet.signAndSendTransaction({
   network: drop.network, signerId: accountId, receiverId: drop.contractId,
   actions: [{type:'FunctionCall', params:{methodName, args, gas:'35000000000000', deposit}}],
  });
  if (!outcome || outcome.status?.Failure) throw new Error('Transaction did not complete.');
  await refreshTransfers();
  friendStatus.textContent = success;
 } catch (error) {
  friendStatus.textContent = error.message || 'The transaction did not complete.';
 } finally {
  transferBusy = disconnect.disabled = false;
  render();
 }
}

function resolveTransfer(cap, accept) {
 return sendTransferAction('resolve_transfer', {
  token_id: cap.token_id, request_id: cap.request.request_id, accept,
 }, '1', accept ? 'Cap sent to your friend.' : 'Request closed.');
}

async function loadTransfers() {
 try {
  await refreshTransfers();
 } catch (error) {
  friendStatus.textContent = error.message;
 }
}

friendForm.addEventListener('submit', event => {
 event.preventDefault();
 if (transferBusy || !accountId) return;
 friendId = document.querySelector('#friend-account').value.trim().toLowerCase();
 friendResults.replaceChildren();
 if (friendId === accountId) {
  friendId = null;
  friendStatus.textContent = 'Enter a different NEAR account.';
  return;
 }
 friendStatus.textContent = 'Requests cost network gas and a refundable 0.01 NEAR deposit.';
 void loadTransfers();
});
document.querySelector('#refresh-requests').onclick = loadTransfers;

async function request(path, data) {
 const options = data === undefined ? {} : {
  method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data),
 };
 if (path === 'status') options.signal = AbortSignal.timeout(5000);
 const response = await fetch('/api/found/' + path, options);
 const result = await response.json().catch(() => ({}));
 if (!response.ok || !Object.keys(result).length) throw new Error(result.error ?? 'The Found drop is unavailable.');
 return result;
}

function capIndex(token) {
 const match = /^found-(\d{2})-(\d{2})$/.exec(token.token_id);
 if (!match || token.owner_id !== accountId) return -1;
 return dragons.findIndex(cap => cap.originalId === Number(match[1]) && cap.rarity === 'Found');
}

function playUrl(index) {
 return '/play?cap=' + index;
}

function showTokens(tokens) {
 inventory.replaceChildren();
 for (const token of tokens) {
  const match = /^found-(\d{2})-(\d{2})$/.exec(token.token_id);
  if (!match || token.owner_id !== accountId) continue;
  const index = capIndex(token);
  if (index < 0) continue;
  const cap = dragons[index];
  const row = document.createElement('article');
  const image = new Image(52, 52);
  image.src = frontImage(cap);
  image.alt = '';
  const label = document.createElement('span');
  label.textContent = `Found ${cap.name} · #${match[2]}`;
  const use = document.createElement('a');
  use.className = 'paper-button';
  use.href = playUrl(index);
  use.textContent = 'Use in game';
  row.append(image, label, use);
  if (token.request) {
   const pending = document.createElement('span');
   const active = activeRequest(token);
   pending.textContent = active ? 'Requested by ' + token.request.requester_id : 'Request expired or the cap changed owners.';
   row.append(pending);
   if (active) row.append(transferButton('Approve & send', () => resolveTransfer(token, true)));
   row.append(transferButton(active ? 'Decline' : 'Close request', () => resolveTransfer(token, false)));
  }
  inventory.append(row);
 }
 inventory.hidden = !inventory.childElementCount;
}

function render() {
 if (Date.now() < opensAt) {
  action.textContent = 'Mint opens Monday';
  action.disabled = true;
  return;
 }
 action.textContent = accountId ? 'Claim Found Caps' : 'Connect NEAR wallet';
 action.disabled = !drop?.contractId || (Boolean(accountId) && (!drop.enabled || drop.remaining === 0));
 if (action.disabled) action.textContent = drop?.remaining === 0 ? 'Sold out' : 'Drop not open';
 disconnect.hidden = !accountId;
 friendPanel.hidden = !accountId;
}

async function connect() {
 connector ??= await getFoundConnector(drop.network);
 const wallet = await connector.connect();
 const [account] = await wallet.getAccounts();
 if (!account) throw new Error('No NEAR account connected.');
 accountId = account.accountId;
 status.textContent = `Connected as ${accountId}.`;
 await loadTransfers();
}

action.addEventListener('click', async () => {
 action.disabled = disconnect.disabled = true;
 try {
  if (!accountId) {
   status.textContent = 'Choose your NEAR wallet.';
   await connect();
   return;
  }
  status.textContent = 'Confirm the claim in your wallet.';
  const challenge = await request('challenge', {accountId});
  const wallet = await connector.wallet();
  const nonce = Uint8Array.from(challenge.nonce.match(/../g), byte => parseInt(byte,16));
  const proof = await wallet.signMessage({
   message:challenge.message, recipient:challenge.recipient, nonce,
   signerId:accountId, network:drop.network,
  });
  if (proof?.accountId !== accountId) throw new Error('Sign with the connected NEAR account.');
  status.textContent = 'Waiting for NEAR confirmation…';
  const {tokens, tokenIds} = await request('claim', {...challenge, ...proof, accountId});
  showTokens(tokens);
  await loadTransfers();
  const claimed = tokens.find(token => tokenIds.includes(token.token_id) && capIndex(token) >= 0);
  if (claimed) {
   window.location.assign(playUrl(capIndex(claimed)));
   return;
  }
  const owned = tokens.filter(token => tokenIds.includes(token.token_id)).length;
  status.textContent = owned
   ? `${owned} of your claimed Found Caps ready to play.`
   : 'Your claimed Found Caps have been transferred.';
  drop = await request('status');
  document.querySelector('#mint-supply').textContent = `${drop.remaining.toLocaleString()} left`;
 } catch (error) {
  status.textContent = error.message || 'Wallet action cancelled.';
 } finally {
  disconnect.disabled = false;
  render();
 }
});

disconnect.addEventListener('click', async () => {
 try {
  await connector.disconnect();
  accountId = friendId = null;
  friendResults.replaceChildren();
  friendStatus.textContent = '';
  showTokens([]);
  status.textContent = 'Wallet disconnected.';
 } catch {
  status.textContent = 'Could not disconnect the wallet.';
 }
 render();
});

async function refreshDrop() {
 try {
  drop = await request('status');
  if (drop.opensAt && Number.isFinite(Date.parse(drop.opensAt))) opensAt = Date.parse(drop.opensAt);
  document.querySelector('#mint-network').textContent = drop.contractId
   ? `NEAR ${drop.network} · ${drop.contractId}` : 'NEAR Found drop';
  if (Number.isInteger(drop.remaining)) document.querySelector('#mint-supply').textContent = `${drop.remaining.toLocaleString()} left`;
  status.textContent = drop.enabled ? 'DORKS covers the network fee.' : 'Mint is not open yet.';
 } catch {
  status.textContent = 'Mint is not open yet.';
 } finally {
  if (tickCountdown()) status.textContent = 'Come back when the countdown ends.';
  render();
 }
}

if (tickCountdown()) status.textContent = 'Come back when the countdown ends.';
render();
await refreshDrop();
if (tickCountdown()) {
 const timer = setInterval(() => {
  if (tickCountdown()) return;
  clearInterval(timer);
  void refreshDrop();
 }, 1000);
}
