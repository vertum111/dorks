export const dragons = [
 {id:1,name:'EMBER',element:'Fire',rarity:'Rare',color:'#ed703b',light:'#ffd386',desc:'Has fire. Has no plan.'},
 {id:2,name:'MOSS',element:'Forest',rarity:'Common',color:'#62a785',light:'#d7ef9d',desc:'Grew horns. No longer fits in the bushes.'},
 {id:3,name:'RIPPLE',element:'Water',rarity:'Rare',color:'#6aafcf',light:'#cef5fa',desc:'Mouth full of water. Forgot why.'},
 {id:4,name:'VOLT',element:'Storm',rarity:'Epic',color:'#a18bda',light:'#efdbff',desc:'Licked lightning three times. Learned on the fourth.'},
 {id:5,name:'SOL',element:'Sun',rarity:'Legendary',color:'#d7ae52',light:'#fff0ac',desc:'Thought he was the sun. Turns out he is a bun.'},
 {id:6,name:'NOX',element:'Night',rarity:'Epic',color:'#7883a5',light:'#c9c9ef',desc:'Came to play. Fell asleep during the rules.'},
 {id:7,name:'BOOP',element:'Bubblegum',rarity:'Common',sprite:true,color:'#ed95b9',light:'#ffe1b6',desc:'One brain cell. Currently blowing bubbles.'},
 {id:8,name:'SPUD',element:'Earth',rarity:'Common',sprite:true,color:'#97ad78',light:'#f1dfa3',desc:'Not a potato. Stop asking.'},
 {id:9,name:'FROST',element:'Ice',rarity:'Rare',sprite:true,color:'#86bbc9',light:'#e2f4eb',desc:'Cool under pressure. Mostly because he is frozen.'},
 {id:10,name:'GLITCH',element:'Chaos',rarity:'Epic',sprite:true,foil:'etched',color:'#b78bda',light:'#ffc3eb',desc:'A feature. Probably.'},
 {id:11,name:'ORBIT',element:'Cosmos',rarity:'Epic',sprite:true,foil:'cosmos',color:'#777fad',light:'#e2d8ff',desc:'No gravity. Still tripped over his tail.'},
 {id:12,name:'PRISM',element:'Rainbow',rarity:'Legendary',sprite:true,foil:'prism',color:'#d4ab68',light:'#fff1bf',desc:'All that shine. Absolutely no idea what is going on.'},
 {"id":13,"name":"PICKLE","element":"Forest","rarity":"Common","color":"#90b76b","sprite":true,"light":"#f7e6bc","desc":"A pickle with wings. Still no plan."},
 {"id":14,"name":"SNOOZE","element":"Cloud","rarity":"Common","color":"#b5a7d4","sprite":true,"light":"#f7e6bc","desc":"Five more minutes. Make it six."},
 {"id":15,"name":"TOAST","element":"Fire","rarity":"Common","color":"#d6a56f","sprite":true,"light":"#f7e6bc","desc":"Crispy outside. Confused inside."},
 {"id":16,"name":"GLOOP","element":"Slime","rarity":"Common","color":"#74bbae","sprite":true,"light":"#f7e6bc","desc":"Mostly jelly. Entirely unbothered."},
 {"id":17,"name":"PEBBLE","element":"Stone","rarity":"Common","color":"#a7b0a2","sprite":true,"light":"#f7e6bc","desc":"Found a rock. Promoted it to best friend."},
 {"id":18,"name":"BLOOM","element":"Flower","rarity":"Common","color":"#e9a99a","sprite":true,"light":"#f7e6bc","desc":"Grew a flower. Forgot to water himself."},
 {"id":19,"name":"SQUIRT","element":"Water","rarity":"Common","color":"#75b8cd","sprite":true,"light":"#f7e6bc","desc":"A water dragon. Terrible at swimming."},
 {"id":20,"name":"CRUMB","element":"Earth","rarity":"Common","color":"#c8aa7d","sprite":true,"light":"#f7e6bc","desc":"Leaves crumbs. Claims they are treasure."},
 {"id":21,"name":"ZAPPA","element":"Storm","rarity":"Rare","color":"#e1c565","sprite":true,"light":"#f7e6bc","desc":"All charged up. Nothing plugged in."},
 {"id":22,"name":"DRIZZLE","element":"Rain","rarity":"Rare","color":"#8daec9","sprite":true,"light":"#f7e6bc","desc":"Forecast: light rain. Heavy sighing."},
 {"id":23,"name":"CACTO","element":"Desert","rarity":"Rare","color":"#91be91","sprite":true,"light":"#f7e6bc","desc":"Free hugs. Terms and conditions apply."},
 {"id":24,"name":"SHROOM","element":"Forest","rarity":"Rare","color":"#bca5cc","sprite":true,"light":"#f7e6bc","desc":"Wears a mushroom. Calls it real estate."},
 {"id":25,"name":"PEPPER","element":"Fire","rarity":"Rare","color":"#dd927b","sprite":true,"light":"#f7e6bc","desc":"Too spicy for his own good."},
 {"id":26,"name":"BUBBA","element":"Bubble","rarity":"Common","color":"#e8a0b4","sprite":true,"light":"#f7e6bc","desc":"Big belly. Tiny life goals."},
 {"id":27,"name":"MUNCH","element":"Forest","rarity":"Common","color":"#acc486","sprite":true,"light":"#f7e6bc","desc":"Came for the caps. Ate the garnish."},
 {"id":28,"name":"PIXEL","element":"Chaos","rarity":"Epic","color":"#99c6bc","sprite":true,"light":"#f7e6bc","desc":"Low resolution. High self-esteem.","foil":"etched"},
 {"id":29,"name":"LUNA","element":"Moon","rarity":"Epic","color":"#afa5c8","sprite":true,"light":"#f7e6bc","desc":"Moonlights as a pillow.","foil":"cosmos"},
 {"id":30,"name":"AURORA","element":"Ice","rarity":"Epic","color":"#9accc6","sprite":true,"light":"#f7e6bc","desc":"Saw the northern lights. Claimed credit.","foil":"prism"},
 {"id":31,"name":"MIDAS","element":"Sun","rarity":"Legendary","color":"#d6b568","sprite":true,"light":"#f7e6bc","desc":"Everything he touches turns mildly expensive.","foil":"prism"},
 {"id":32,"name":"VOID","element":"Cosmos","rarity":"Legendary","color":"#9a9cb7","sprite":true,"light":"#f7e6bc","desc":"Stared into the void. The void blinked first.","foil":"cosmos"}
];
export function frontImage(d){return isFound(d) ? `/art/found/${d.originalId}-front.png` : `/art/${d.name.toLowerCase()}-${d.sprite?"sprite":"derpy"}.png`;}
export function wrapCap(index,count=dragons.length){return ((index%count)+count)%count;}
export function capDistance(index,active,count=dragons.length){const n=wrapCap(index-active,count);return n>count/2?n-count:n;}

export const originalCaps = dragons.slice();
const foundSpots = ['Under the bleachers.', 'By the curb.', 'Behind the arcade.', 'In a puddle.'];

for (const dragon of originalCaps) {
 dragons.push({
  id: dragon.id + 32,
  name: dragon.name,
  element: dragon.element,
  rarity: 'Found',
  color: '#b8a47d',
  originalId: dragon.id,
  desc: `Found ${foundSpots[(dragon.id - 1) % foundSpots.length].toLowerCase()} Still flips.`,
 });
}

export const isFound = cap => cap.rarity === 'Found';
export const backImage = cap => isFound(cap) ? `/art/found/${cap.originalId}-back.png` : '/brand/cap-back.svg';
