import {dragons} from './cap-catalog.js';

const connectors = new Map();

export function getFoundConnector(network) {
 if (!connectors.has(network)) {
  const features = {signMessage:true, signAndSendTransaction:true};
  if (network === 'testnet') features.testnet = true;
  const ready = import('@hot-labs/near-connect')
   .then(({NearConnector}) => new NearConnector({network, features, autoConnect:false}))
   .catch(error => { connectors.delete(network); throw error; });
  connectors.set(network, ready);
 }
 return connectors.get(network);
}

export function ownedFoundCaps(tokens, accountId) {
 if (!accountId) return [];
 const seen = new Set();
 return tokens.flatMap(token => {
  const id = token?.token_id;
  const match = /^found-(0[1-9]|[12][0-9]|3[0-2])-(0[1-9]|[12][0-9]|3[0-2])$/.exec(id);
  if (!match || token.owner_id !== accountId || seen.has(id)) return [];
  const index = dragons.findIndex(cap => cap.originalId === Number(match[1]));
  if (index < 0) return [];
  seen.add(id);
  return [{id, index, serial:match[2]}];
 });
}
