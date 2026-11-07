export const REACTION_BASE_URL='/audio/memes/';
export const REACTION_POOLS={
  "throw": [
    "poke",
    "swish",
    "slip",
    "bite",
    "luigi-yahoo",
    "yeet-one"
  ],
  "win": [
    "win-yeah-boy",
    "win-wow",
    "woo-baby",
    "vector-yeah",
    "yeah-buddy"
  ],
  "lose": [
    "lose-hell-no",
    "lose-trombone",
    "lose-fart",
    "spongebob-fail",
    "wait-wait"
  ],
  "tie": [
    "tie-huh",
    "rps-tie-bruh",
    "metal-alert",
    "huh-ceeday",
    "wow-guy"
  ],
  "rps-start": [
    "rps-start-fight",
    "round-one",
    "round-two",
    "sf-round-one",
    "round-two-gong",
    "sf-coin",
    "hadouken",
    "shinchan"
  ],
  "rps-reveal": [
    "rps-reveal-boom",
    "metal-alert",
    "sf-coin",
    "poke",
    "swish",
    "slip",
    "bite",
    "shinchan"
  ],
  "rps-win": [
    "rps-win-noice",
    "flawless",
    "mario-wins",
    "happy-wheels",
    "luigi-yahoo",
    "mario-yippee",
    "luigi-bingo",
    "mario-congrats"
  ],
  "rps-lose": [
    "rps-lose-damage",
    "mario-ohno",
    "sf-ko",
    "fail-horns",
    "no-laugh",
    "lose-hell-no",
    "lose-trombone"
  ],
  "rps-tie": [
    "rps-tie-bruh",
    "huh-ceeday",
    "huh-plain",
    "cat-huh",
    "huh-ehhh"
  ],
  "found": [
    "win-wow",
    "woo-baby",
    "vector-yeah",
    "wow-guy",
    "rps-win-noice",
    "mario-congrats"
  ]
};
export const REACTION_FILES=[...new Set(Object.values(REACTION_POOLS).flat())];
const priorities={throw:1,found:1,tie:2,'rps-start':2,'rps-reveal':3,'rps-tie':3,win:4,lose:4,'rps-win':4,'rps-lose':4};
export function resultReaction(state){return `${state.wonBy==='rps'?'rps-':''}${state.player===0?'win':'lose'}`;}
export function countdownReaction(round=1){return round>1?'rps-start':'tie';}
export function revealReaction(yours,theirs){return yours===theirs?'rps-tie':'rps-reveal';}
export function createReactionSelector(random=Math.random){
 let lastAt=-Infinity,lastPriority=0,lastGlobal=null;const bags=new Map(),previous={};
 return {pick(event,{now=0,force=false,silly=true,available=null}={}){
  const pool=REACTION_POOLS[event];if(!pool||(!force&&now-lastAt<1100&&priorities[event]<=lastPriority))return null;
  if(!force&&event==='found'&&random()>.55)return null;
  const options=pool.filter(name=>(silly||!name.includes('fart'))&&(!available||available.has(name)));if(!options.length)return null;
  const key=event+'|'+options.join(',');let bag=bags.get(key);
  if(!bag?.length){bag=[...options];for(let i=bag.length-1;i>0;i--){const j=Math.min(i,Math.floor(Math.max(0,random())*(i+1)));[bag[i],bag[j]]=[bag[j],bag[i]];}bags.set(key,bag);}
  let index=bag.length-1;
  if(bag.length>1&&(bag[index]===lastGlobal||bag[index]===previous[event]))index=bag.findIndex(name=>name!==lastGlobal&&name!==previous[event]);
  if(index<0)index=bag.length-1;
  // Another event may have just played the final clip left in this bag.
  let name;
  if(bag[index]===lastGlobal&&options.length>1){const alternatives=options.filter(value=>value!==lastGlobal&&value!==previous[event]);name=(alternatives.length?alternatives:options.filter(value=>value!==lastGlobal))[0];const existing=bag.indexOf(name);if(existing>=0)bag.splice(existing,1);}
  else [name]=bag.splice(index,1);
  previous[event]=name;lastGlobal=name;lastAt=now;lastPriority=priorities[event];return name;
 }};
}
