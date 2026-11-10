import {loadRiggedHand} from './rigged-hand.js';
// The same bare hand in the editor and game; base cap grip stays shared; victory gestures use separate hand profiles.
export async function makeHand(settings){return loadRiggedHand(settings);}
