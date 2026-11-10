import './style.css';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {dragons,capMesh,disposeCap,frontImage,updateCapFoil} from './caps.js';
import {isFound,wrapCap} from './cap-catalog.js';
import {foilFinish} from './foil.js';
import {createCollectionGallery} from './collection-gallery.js';
import {makeHand} from './hands.js';
import {GRIP_KEY,gripDefaults,readGripSettings} from './grip-settings.js';
import {throwFrame,applyHandFrame,applyCapFlight,tableHeight,DURATION,READY} from './throw-motion.js';
import {createHandRenderer} from './hand-outline.js';
import {mountRoundUi} from './round-ui.js';
import {presentGesture} from './gestures.js';
import {mountGameWallet} from './game-wallet.js';
import {mountGestureTuner,publishedGestureSettings} from './gesture-settings.js';
import {newGame,resolveTurn} from './game.js';
import {mountThrowMeter,timingPosition,MIN_HOLD_MS} from './throw-meter.js';
import {mountSessionUi,arrow} from './session-ui.js';
import {createAudioDesign} from './audio.js';
import {resultReaction,countdownReaction,revealReaction} from './audio-reactions.js';
import {mountLoader} from './loading.js';
import {mountSpinHint} from './spin-hint.js';
import {mountMatchCues} from './match-cues.js';
import {mountTeaserRecorder} from './teaser-recorder.js';
const bootLoader=mountLoader();const audio=createAudioDesign();const matchCues=mountMatchCues();

const $=s=>document.querySelector(s);
let saved={score:[0,0]};
try {
  const s=JSON.parse(localStorage.getItem('dragon-caps-v1'));
  if(s&&Array.isArray(s.score)&&s.score.length===2&&s.score.every(n=>Number.isFinite(n)&&n>=0))
    saved={score:s.score};
} catch {}
let teaserRecorder=null;
let state=newGame(saved.score),selected=0,equipped=0,view='arena',busy=false,charging=false;
let galleryIndices=[], walletCaps=[], selectedToken;
const editGestures=import.meta.env.DEV;
let chargeStart=0,position=0,timer,animation=null,chargePickup=null,handShow=null;
let roundDragons=[0,2],meshes=[],held=[true,true],searchingHand=false,lastDrumBeat=-1;const drumPoint=new THREE.Vector3();
const capFromMint=new URLSearchParams(location.search).get('cap');
try{
 const savedCap=capFromMint??localStorage.getItem('dorks-equipped');
 const n=Number(savedCap);
 if(savedCap!==null&&Number.isInteger(n)&&n>=0&&n<dragons.length){
  selected=equipped=n;roundDragons=[n,practiceOpponents()[1]];
  if(capFromMint!==null)localStorage.setItem('dorks-equipped',String(n));
 }
}catch{}
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;

$('#app').innerHTML=`
<main class="playground">
  <header class="hud">
    <button class="brand" id="home" aria-label="Dorks — back to game"><img src="/brand/dorks-wordmark.svg" alt="DORKS"><span>very odd dragons</span></button>
    <div class="hud-actions"><div class="wallet-controls"><span data-wallet-account hidden></span><button class="paper-button" data-found-wallet>Connect wallet</button></div><button id="open-session" class="paper-button">Session <span id="session-count">0 played</span></button></div>
  </header>
  <div id="stage" role="img" aria-label="3D cap game table"></div>
  <div class="table-note" aria-hidden="true">slap it. snag it.</div>
  <section class="shot-controls" aria-label="Throw">
    <p id="status" role="status" aria-live="polite"></p>
    <div id="throw-meter" class="throw-meter" data-state="ready" data-zone="idle"></div>
    <button id="slam" class="primary" aria-describedby="shot-hint" aria-pressed="false" aria-keyshortcuts="Space Enter Escape"><span class="slam-action">Hold to aim</span><span class="slam-subtitle">then release to slam</span></button>
    <button id="next" class="primary" hidden>One more!</button>
    <span id="shot-hint">Focus button + hold Space · Esc cancels</span>
  </section>
  <nav class="bottom-bar" aria-label="Game menu"><button id="open-collection" class="paper-button">My dorks <span id="owned-count">0</span></button><div>${editGestures?'<button id="tune-gesture" class="paper-button">Gesture</button>':''}<a class="round-button x-link" href="https://x.com/playdorks" target="_blank" rel="noopener noreferrer" aria-label="DORKS on X · opens a new tab"><svg viewBox="0 0 28 28" aria-hidden="true"><path d="M5 4 L12 4 24 24 17 24 Z M23 4 Q14 14 5 24"/></svg></a><button id="sound" class="round-button" aria-label="Sound settings" aria-pressed="false">♪</button><button id="help" class="round-button" aria-label="How to play">?</button></div></nav>
  <section id="collection" class="collection" hidden aria-label="Cap collection">
    <div class="collection-heading"><div><h1>Your dorks.</h1><a class="found-mint-link" href="/mint">Found drop</a></div><div class="collection-actions"><div class="wallet-controls"><span data-wallet-account hidden></span><button class="paper-button" data-found-wallet>Connect wallet</button></div><button id="close-collection" class="paper-button">${arrow('left')} Back to lobby</button></div></div>
    <div class="wallet-empty" id="wallet-empty"><p id="wallet-message" role="status"></p><button class="primary" data-found-wallet>Connect wallet</button><button class="paper-button" id="retry-wallet" hidden>Retry</button></div>
    <div class="gallery-navigation" aria-label="Browse caps"><button id="previous-cap" class="round-button" aria-label="Previous cap">${arrow('left')}</button><span id="gallery-loading" role="status" hidden>Waking this dork…</span><button id="next-cap" class="round-button" aria-label="Next cap">${arrow('right')}</button></div><div class="cap-info" aria-live="polite"><span id="serial"></span><h2 id="dragon-name"></h2><div id="traits"></div><p id="dragon-desc"></p></div>
    
    <div class="cards" role="group" aria-label="Your Found Caps"></div>
    <div class="collection-pick"><span id="chosen-status">Your next troublemaker.</span><button id="choose" class="primary">Use this dork</button></div>
  </section>
</main>
<dialog id="rules"><button id="close-help" class="round-button" aria-label="Close rules">×</button><img class="rules-logo" src="/brand/dorks-wordmark.svg" alt="DORKS"><h2>Caps on the table!</h2><ol><li>Find a player and both tap Ready, or choose Bot practice. Hold the yellow button to aim. Release inside the striped target; the star marks perfect timing. A better release helps, but every flip still has some chaos.</li><li>You and your rival throw one cap each. Only yours lands face up? You get to slam the pair!</li><li>Flip both face up in one slam to win the pair. Missed? Your rival gets a turn.</li><li>A tie? Rock, paper, scissors! You have 5 seconds to choose. First winner takes the pair.</li></ol><p>Timing helps. Chaos helps itself. Connect your wallet to see your Found Caps. Bot practice and casual online matches never move your NFTs.</p><button id="start-help" class="primary">Got it. Slam!</button></dialog>`;

const throwMeter=mountThrowMeter($('#throw-meter'),{onTarget:()=>audio.play('target')});
const container=$('#stage');
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}
catch {bootLoader.fail();container.innerHTML='<p class="fallback">Enable WebGL to wake the dragons.</p>';$('#slam').disabled=true;throw new Error('WebGL unavailable');}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
container.appendChild(renderer.domElement);
const spinHint=mountSpinHint(container);
const renderScene=createHandRenderer(renderer);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(36,1,.1,100);scene.add(camera);
const controls=new OrbitControls(camera,renderer.domElement);controls.enabled=false;controls.enablePan=false;
controls.minDistance=3.3;controls.maxDistance=9;controls.enableDamping=true;controls.dampingFactor=.12;
const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
scene.environment=pmrem.fromScene(room,.04).texture;scene.environmentIntensity=.6;room.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight('#fff8e9','#e7e9ed',.65));
const key=new THREE.DirectionalLight('#fff9eb',1.6);key.position.set(-3,7,4);key.castShadow=true;
key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-8,right:8,top:8,bottom:-8});key.shadow.normalBias=.035;scene.add(key);
// A camera-relative soft fill illuminates whichever cap face is being inspected.
const fill=new THREE.DirectionalLight('#ffffff',.7);fill.position.set(2,3,4);fill.target.position.set(0,0,-5);camera.add(fill,fill.target);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.ShadowMaterial({opacity:.14}));
ground.rotation.x=-Math.PI/2;ground.position.y=-.055;ground.receiveShadow=true;scene.add(ground);
const ring=new THREE.Mesh(new THREE.RingGeometry(2.35,2.36,100),new THREE.MeshBasicMaterial({color:'#ded9c9',side:THREE.DoubleSide,transparent:true,opacity:.6}));ring.rotation.x=-Math.PI/2;ring.position.y=-.05;scene.add(ring);
$('#status').textContent='Dragons are warming up their fingers…';
const gameGrip=editGestures?readGripSettings():gripDefaults;
const hands=await Promise.all([makeHand(gameGrip),makeHand(gameGrip)]).catch(error=>{bootLoader.fail();throw error;});
hands.forEach((hand,i)=>{hand.position.set(i===0?2.45:-2.45,.28,i===0?2:-2);hand.rotation.y=i===0?.3:Math.PI+.3;hand.userData.yaw=i===0?.3:Math.PI+.3;hand.userData.rest=hand.position.clone();applyHandFrame(hand,null,hand.userData.rest,hand.userData.yaw);scene.add(hand);});
addEventListener('storage',event=>{if(editGestures&&event.key===GRIP_KEY){hands.forEach(h=>h.userData.applyGripSettings(readGripSettings()));updateTable();}});
const restingPositions=[new THREE.Vector3(.83,.016,.28),new THREE.Vector3(-.83,.016,-.28)];
function updateTable(){const y=tableHeight(hands[0].userData.settings);ground.position.y=y;ring.position.y=y+.005;restingPositions.forEach(v=>v.y=y+.012);meshes.forEach((m,i)=>{if(!held[i]&&!animation)m.position.y=y+.012;});}
updateTable();
function gripPosition(player,stack=0){const h=hands[player];h.updateWorldMatrix(true,false);return h.localToWorld(h.userData.grip.clone().add(new THREE.Vector3(.025*stack,.028*stack,0)));}
const heldEuler=new THREE.Euler(),heldQuaternion=new THREE.Quaternion();
function orientHeld(mesh,player,face){
  heldEuler.set(face?0:Math.PI,0,0);heldQuaternion.setFromEuler(heldEuler);
  mesh.quaternion.copy(hands[player].quaternion).multiply(hands[player].userData.gripRotation).multiply(heldQuaternion);
}
function refreshMeshes(){
  meshes.forEach(disposeCap);held=[true,true];
  meshes=roundDragons.map((n,i)=>{const m=capMesh(dragons[n]);m.position.copy(gripPosition(i));orientHeld(m,i,false);m.scale.setScalar(.85);scene.add(m);return m;});
}
function arenaCamera(){camera.position.set(0,9.4,8.5).multiplyScalar(Math.max(1,.95/camera.aspect));controls.target.set(0,0,0);camera.lookAt(controls.target);}
arenaCamera();refreshMeshes();
const gallery=createCollectionGallery({renderer,renderScene,environment:scene.environment,onSelect:showDragon,onFlip:()=>audio.play('flip'),onInteract:()=>spinHint.hide(),reduced});
const roundUi=mountRoundUi({
 getResultDelay:()=>teaserRecorder?.active?3200:1100,
 onClock:seconds=>audio.tick(seconds),
 onReplay:()=>sessionUi.replay(),
 onLobby:()=>sessionUi.back(),
 onOnlineChoice:choice=>sessionUi.rps(choice),
 onCountdown:(round=1)=>{matchCues.tie(round);audio.resetClock();audio.play(countdownReaction(round));handShow={kind:'rps',stage:'choose',palmReady:handShow?.kind==='rps',started:performance.now()};},
 onReveal:(yours,theirs)=>{audio.play(revealReaction(yours,theirs));handShow={kind:'rps',stage:'reveal',choices:[yours||'rock',theirs||'rock'],started:performance.now()};},
 onRpsFinished:finishRound,
 onResultOpen:()=>{busy=false;update();}
});
function resize(){const {width,height}=container.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();if(view==='arena'&&!controls.enabled)arenaCamera();gallery.resize(width,height);if(view==='collection')document.querySelector(`[data-dragon="${selected}"]`)?.scrollIntoView({block:'nearest',inline:'center'});}
new ResizeObserver(resize).observe(container);

function draw(t){
  requestAnimationFrame(draw);
  if(charging)position=throwMeter.frame(t-chargeStart);
  hands.forEach((hand,i)=>{
    const ready=charging&&i===0&&!reduced?READY*Math.min(1,(t-chargeStart)/180):null;
    applyHandFrame(hand,ready,hand.userData.rest,hand.userData.yaw,reduced);
    hand.userData.pose(held[i]||animation?.player===i||(charging&&i===0)?0:1);
    if(!reduced&&view==='arena'&&!charging)hand.position.y+=Math.sin(t/1400+i*3)*.015;
  });
  if(!animation){
    meshes.forEach((m,i)=>{if(held[i]){m.position.copy(gripPosition(i));orientHeld(m,i,state.faces[i]);}});
    if(charging&&chargePickup){const p=Math.min(1,(t-chargeStart)/180);chargePickup.indices.forEach((i,k)=>{meshes[i].position.lerpVectors(chargePickup.positions[i],gripPosition(0,k),p);orientHeld(meshes[i],0,state.faces[i]);});}
  }
  if(animation){
    const p=Math.min(1,(t-animation.start)/animation.duration),hand=hands[animation.player];
    const f=applyHandFrame(hand,p,hand.userData.rest,hand.userData.yaw,reduced);
    animation.indices.forEach((i,k)=>{
      const m=meshes[i];
      if(p<f.release){
        const pick=Math.min(1,p/.15);m.position.lerpVectors(animation.positions[i],gripPosition(animation.player,k),pick);
        orientHeld(m,animation.player,state.faces[i]);
      }else{
        if(!animation.release[i]){
          const oldPosition=hand.position.clone(),oldQuaternion=hand.quaternion.clone();
          applyHandFrame(hand,f.release,hand.userData.rest,hand.userData.yaw,reduced);
          animation.release[i]=gripPosition(animation.player,k);orientHeld(m,animation.player,state.faces[i]);animation.releaseRotation[i]=m.quaternion.clone();
          hand.position.copy(oldPosition);hand.quaternion.copy(oldQuaternion);hand.updateMatrixWorld(true);
        }
        applyCapFlight(m,p,{releasePosition:animation.release[i],releaseQuaternion:animation.releaseRotation[i],landingPosition:restingPositions[i],initialFace:state.faces[i],resultFace:animation.faces[i],yaw:i===0?-.2:Math.PI-.2,settings:hand.userData.settings,reduced});
      }
    });
    if(p>=f.release&&!animation.throwSound){audio.play('throw');animation.throwSound=true;}
    if(p>=f.impact&&!animation.hitSound){audio.play('impact',animation.skill);animation.hitSound=true;}
    if(p===1){const done=animation.done;animation=null;done();}
  }
  if(handShow&&view==='arena'){
    const blend=reduced?1:THREE.MathUtils.smootherstep((t-handShow.started)/350,0,1);
    hands.forEach((h,i)=>{
      applyHandFrame(h,null,h.userData.rest,h.userData.yaw,reduced);h.userData.pose(1);
      if(handShow.kind==='winner')presentGesture(h,i===handShow.winner?'middle':'paper',blend,handShow.palmReady?1:blend,gestureTuner.settingsFor(i));
      else if(handShow.kind==='preview')presentGesture(h,i===handShow.player?handShow.gesture:'paper',1,1,i===handShow.player?gestureTuner.settingsFor(i,handShow.gesture):null);
      else if(handShow.stage==='choose')presentGesture(h,'rock',blend,handShow.palmReady?1:blend,gestureTuner.settingsFor(i,'rock'));
      else {h.userData.gesture('rock');presentGesture(h,handShow.choices[i],blend,1,handShow.choices[i]==='rock'?gestureTuner.settingsFor(i,'rock'):null);}
    });
  }
  if(searchingHand&&view==='arena'&&!gestureSnapshot){
    const h=hands[1];applyHandFrame(h,null,h.userData.rest,h.userData.yaw,reduced);h.userData.drum(t/1000,reduced);
    const skin=[];h.updateMatrixWorld(true);h.traverse(o=>{if(o.isSkinnedMesh)skin.push(o);});
    let low=Infinity;for(const bone of h.userData.bones.values())low=Math.min(low,bone.getWorldPosition(drumPoint).y);
    h.position.y+=tableHeight(h.userData.settings)+.15-low;
    const beat=Math.floor(t/1000/1.9*4);if(beat!==lastDrumBeat){lastDrumBeat=beat;audio.play('tap',.3);}
  }
  if(view==='collection'){gallery.draw(t);return;}
  meshes.forEach(m=>updateCapFoil(m,reduced?0:t/1000,camera));if(controls.enabled)controls.update();renderScene(scene,camera);teaserRecorder?.frame();
}
requestAnimationFrame(draw);
let sessionUi;sessionUi=mountSessionUi({
 getSelected:()=>equipped,
 lockStake:stake=>gameWallet.lockStake(stake),refundStake:stake=>gameWallet.refundStake(stake),onStakeChange:()=>gameWallet.refresh(),
 foundPass(cap){const owned=walletCaps.find(entry=>entry.index===cap&&entry.id===selectedToken)??walletCaps.find(entry=>entry.index===cap);return owned&&walletOwner?{tokenId:owned.id,accountId:walletOwner,sign:challenge=>gameWallet.sign(challenge)}:null;},
 onSearch(searching,lobby){if(searching&&!searchingHand)audio.play('search');searchingHand=searching;if(meshes[1])meshes[1].visible=!searching&&view==='arena'&&!document.body.classList.contains('tuning-gesture');hands[1].traverse(o=>{if(!o.material)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.transparent=true;m.opacity=1;if(m.userData.outlineParameters)m.userData.outlineParameters.alpha=m.opacity;}});document.querySelector('.shot-controls').hidden=lobby||view==='collection';if(lobby||searching)matchCues.reset();else matchCues.sync(state,{visible:view==='arena',busy,charging,opponent:sessionUi?.opponent||'Bot'});},
 onRoom(name,status,stake){roundUi.setOpponent(name);if(status==='result')roundUi.setStakeStatus(stake);if(status==='playing'&&!animation){busy=false;update();}},
 onLobby(){matchCues.reset();throwMeter.reset();audio.setActive(false);clearTimeout(timer);cancelCharge();roundUi.reset();animation=null;handShow=null;busy=false;state=newGame();held=[true,true];refreshMeshes();update();},
 onPractice(){audio.play('found');audio.setActive(true);roundUi.setOpponent('Bot');resetMatch();},
 onStart(next,caps){matchCues.reset();throwMeter.reset();audio.play('found');audio.setActive(true);clearTimeout(timer);roundUi.reset();animation=null;handShow=null;busy=false;state=next;roundDragons=caps;refreshMeshes();if(view==='collection')setView('arena');update();},
 onTurn(previous,next,skill){charging=false;chargePickup=null;animateTurn(previous,next,skill);},
 onRps(next,deadline){animation=null;state=next;held=[false,false];meshes.forEach((m,i)=>{m.position.copy(restingPositions[i]);m.rotation.set(next.faces[i]?0:Math.PI,i===0?-.2:Math.PI-.2,0);});busy=true;update();roundUi.startOnlineRps(next,deadline);},
 onReveal(choices,next){roundUi.revealOnline(choices,next);},
 onResult(next){finishRound(next,true);},
 onResume(next,caps,restoredHeld){audio.setActive(true);roundUi.reset();animation=null;handShow=null;busy=false;state=next;roundDragons=caps;refreshMeshes();held=restoredHeld;meshes.forEach((m,i)=>{if(!held[i]){m.position.copy(restingPositions[i]);m.rotation.set(next.faces[i]?0:Math.PI,i===0?-.2:Math.PI-.2,0);}});update();}

});
$('#open-session').onclick=()=>sessionUi.showHistory();
let gestureSnapshot=null;
const gestureTuner=editGestures?mountGestureTuner({
 onOpen(settings,player,gesture){
  gestureSnapshot={handShow,visibility:meshes.map(m=>m.visible),minDistance:controls.minDistance,maxDistance:controls.maxDistance};clearTimeout(timer);busy=true;
  handShow={kind:'preview',player,gesture,palmReady:true,started:performance.now()-1000};
  meshes.forEach(m=>m.visible=false);controls.minDistance=4;controls.maxDistance=30;arenaCamera();controls.enabled=true;document.body.classList.add('tuning-gesture');update();
 },
 onGameView(){arenaCamera();},
 onChange(settings,player,gesture){handShow={kind:'preview',player,gesture,palmReady:true,started:performance.now()-1000};},
 onClose(){
  if(!gestureSnapshot)return;handShow=gestureSnapshot.handShow;meshes.forEach((m,i)=>m.visible=gestureSnapshot.visibility[i]);controls.minDistance=gestureSnapshot.minDistance;controls.maxDistance=gestureSnapshot.maxDistance;gestureSnapshot=null;
  controls.enabled=false;arenaCamera();busy=false;document.body.classList.remove('tuning-gesture');update();scheduleBot();
 }
}):{settingsFor:publishedGestureSettings};
if(editGestures)$('#tune-gesture').onclick=()=>{if(busy||charging||view!=='arena')return;gestureTuner.open();};
function persist(){saved.score=[...state.score];try{localStorage.setItem('dragon-caps-v1',JSON.stringify(saved));}catch{}}
function update(){
  const finished=state.phase==='finished';
  matchCues.sync(state,{visible:view==='arena'&&Boolean(sessionUi?.canThrow)&&!document.body.classList.contains('in-lobby'),busy,charging,opponent:sessionUi?.opponent||'Bot'});

  $('#status').textContent=state.phase==='rps'?'A tie! Let the fingers decide.':finished?(state.player===0?'You win the round!':'Your rival wins the round.'):busy?(animation?'Sla-a-ap!':`Waiting for ${sessionUi?.opponent||'your rival'}…`):state.player===0?(state.phase==='pair'?'SLAM · Flip both caps to win.':'Your turn.'):`${sessionUi?.opponent||'Your rival'}’s turn${state.phase==='pair'?' · SLAM':''}.`;

  $('#slam').disabled=!sessionUi?.canThrow||busy||state.player!==0||!['duel','pair'].includes(state.phase);$('#slam').hidden=finished;
  $('#next').hidden=!finished||busy;$('#next').textContent='Rematch?';throwMeter.sync({available:!$('#slam').disabled,finished:finished||state.phase==='rps',turn:state.turn,sharedTarget:sessionUi?.target});
  $('#slam').setAttribute('aria-pressed',String(charging));$('.slam-action').textContent=charging?'Release to slam!':$('#slam').disabled?'Wait for your turn':'Hold to aim';$('.slam-subtitle').textContent=charging?'aim for the striped target':$('#slam').disabled?'watch the caps fly':'then release to slam';
  $('#shot-hint').hidden=finished||busy||state.player!==0;
  $('#owned-count').textContent=`${walletCaps.length}`;
  $('#open-collection').disabled=busy||charging;
  if(editGestures)$('#tune-gesture').disabled=busy||charging;
  if(view==='arena')container.setAttribute('aria-disabled',String(busy||state.player!==0||finished));else container.removeAttribute('aria-disabled');
}

function takeTurn(skill,prepared=0){
  if(!sessionUi?.canThrow)return;
  if(busy||view!=='arena'||!['duel','pair'].includes(state.phase))return;
  if(sessionUi.online){busy=true;update();sessionUi.throw(skill).then(ok=>{if(!ok){busy=false;update();}});return;}
  const previous=state,next=resolveTurn(state,skill,teaserRecorder?.active?()=>state.phase==='pair'||state.player===0?0:.999:Math.random);animateTurn(previous,next,skill,prepared);
}
function animateTurn(previous,next,skill,prepared=0){
  busy=true;state=previous;
  const indices=previous.phase==='pair'?[0,1]:[previous.player];
  const positions=meshes.map(m=>m.position.clone());
  update();animation={start:performance.now()-(reduced?0:prepared*DURATION),duration:reduced?150:DURATION,player:previous.player,indices,positions,faces:next.faces,skill,hitSound:false,release:[],releaseRotation:[],done:()=>{
    state=next;indices.forEach(i=>held[i]=false);
    meshes.forEach((m,i)=>{m.rotation.set(state.faces[i]?0:Math.PI,i===0?-.2:Math.PI-.2,0);m.position.copy(restingPositions[i]);});
    busy=false;
    if(sessionUi.online){busy=true;update();return;}
    if(state.phase==='finished'){finishRound(state);return;}
    if(state.phase==='rps'){busy=true;update();roundUi.startRps(state);return;}
    update();scheduleBot();
  }};
}
function scheduleBot(){clearTimeout(timer);if(sessionUi?.mode==='practice'&&state.player===1&&['duel','pair'].includes(state.phase)&&view==='arena')timer=setTimeout(()=>takeTurn(.3+Math.random()*.6),state.phase==='pair'?2400:1800);}
let activeThrowPointer=null;
function startCharge(){if(!sessionUi?.canThrow)return;if(view!=='arena'||busy||charging||state.player!==0||!['duel','pair'].includes(state.phase)||document.querySelector('dialog[open]'))return;audio.play('charge');charging=true;sessionUi.startCharge();chargeStart=performance.now();position=0;throwMeter.start();chargePickup={indices:state.phase==='pair'?[0,1]:[0],positions:meshes.map(m=>m.position.clone()),held:[...held]};chargePickup.indices.forEach(i=>held[i]=false);update();}
function releaseCharge(){if(!charging)return;const elapsed=performance.now()-chargeStart;if(elapsed<MIN_HOLD_MS){cancelCharge(true);return;}position=timingPosition(elapsed);const prepared=READY*Math.min(1,elapsed/MIN_HOLD_MS);charging=false;activeThrowPointer=null;chargePickup=null;const result=throwMeter.release(position);takeTurn(result.skill,prepared);}
function cancelCharge(short=false){if(!charging)return;sessionUi?.cancelCharge();charging=false;activeThrowPointer=null;if(chargePickup){held=[...chargePickup.held];meshes.forEach((m,i)=>{m.position.copy(chargePickup.positions[i]);m.rotation.set((state.faces[i]?0:Math.PI),held[i]?hands[i].rotation.y:(i===0?-.2:Math.PI-.2),0);});chargePickup=null;}throwMeter.cancel(short===true);update();}
$('#slam').addEventListener('pointerdown',e=>{if(view!=='arena'||e.button!==0||activeThrowPointer!==null)return;e.preventDefault();e.currentTarget.focus({preventScroll:true});startCharge();if(charging){activeThrowPointer=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);}});
$('#slam').addEventListener('pointerup',e=>{if(e.pointerId!==activeThrowPointer)return;e.preventDefault();releaseCharge();});
$('#slam').addEventListener('pointercancel',()=>cancelCharge());
$('#slam').addEventListener('lostpointercapture',()=>cancelCharge());
$('#slam').addEventListener('keydown',e=>{if(e.code==='Enter'){e.preventDefault();if(!e.repeat)charging?releaseCharge():startCharge();}});
$('#slam').addEventListener('click',e=>{if(e.detail===0){charging?releaseCharge():startCharge();}});
window.addEventListener('keydown',e=>{if(e.code==='Escape'&&charging){e.preventDefault();cancelCharge();}if(e.code==='Space'&&!e.repeat&&view==='arena'&&!$('#rules').open&&e.target===$('#slam')){e.preventDefault();startCharge();}});
window.addEventListener('keyup',e=>{if(e.code==='Space'&&charging){e.preventDefault();releaseCharge();}});
window.addEventListener('blur',()=>cancelCharge());
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelCharge();});
function practiceOpponents(){
 const found=isFound(dragons[equipped]);
 const opponents=[];
 for(let offset=1;offset<dragons.length;offset++){
  const index=wrapCap(equipped+offset);
  if(isFound(dragons[index])===found)opponents.push(index);
 }
 return opponents;
}
function resetMatch(){
 matchCues.reset();throwMeter.reset();
 clearTimeout(timer);roundUi.reset();handShow=null;busy=false;state=newGame(state.score);const opponents=practiceOpponents();roundDragons=[equipped,opponents[Math.floor(Math.random()*opponents.length)]];refreshMeshes();update();
}
function finishRound(next,online=false){
 cancelCharge();animation=null;state=next;clearTimeout(timer);held=[false,false];audio.play(resultReaction(state));
 if(state.wonBy==='forfeit')meshes.forEach((mesh,i)=>{mesh.position.copy(restingPositions[i]);mesh.rotation.set(state.faces[i]?0:Math.PI,i===0?-.2:Math.PI-.2,0);});
 if(!online)sessionUi.recordPractice(state,roundDragons);
 persist();
 busy=true;handShow={kind:'winner',winner:state.player,palmReady:state.wonBy==='rps',started:performance.now()};update();roundUi.showResult(state,online?sessionUi.stake:null);
}
$('#next').onclick=()=>sessionUi.replay();


function setView(v){
  if(busy||charging)return;clearTimeout(timer);view=v;
  $('#collection').hidden=v!=='collection';$('.hud').hidden=v==='collection';$('.shot-controls').hidden=v==='collection';$('.bottom-bar').hidden=v==='collection';$('.table-note').hidden=v==='collection';
  document.body.classList.toggle('inspecting',v==='collection');
  hands.forEach(h=>h.visible=v==='arena');meshes.forEach(m=>m.visible=v==='arena');ground.visible=v==='arena';ring.visible=v==='arena';
  controls.enabled=false;gallery.setEnabled(v==='collection'&&galleryIndices.length>0);container.tabIndex=-1;container.setAttribute('role',v==='collection'?'group':'img');container.setAttribute('aria-label',v==='arena'?'3D cap game table':'3D cap: drag to rotate');sessionUi.setHidden(v==='collection');
  $('#close-collection').innerHTML=`${arrow('left')} Back to ${sessionUi.mode==='lobby'?'lobby':'table'}`;
  if(v==='collection'){if(galleryIndices.length){showDragon(galleryIndices.includes(selected)?selected:galleryIndices[0]);spinHint.show();}void gameWallet.refresh();}else{spinHint.hide();arenaCamera();scheduleBot();}
  update();
}
function showDragon(i,tokenId){
 if(!galleryIndices.includes(i))return;
 const cap=walletCaps.find(entry=>entry.index===i&&entry.id===(tokenId??selectedToken))??walletCaps.find(entry=>entry.index===i);
 if(!cap)return;
 selectedToken=cap.id;
 if(selected!==wrapCap(i))audio.play('browse');selected=wrapCap(i);const d=dragons[selected];gallery.select(selected);
 $('#dragon-name').textContent=d.name;$('#dragon-desc').textContent=d.desc;$('#serial').textContent=`${walletCaps.indexOf(cap)+1} / ${walletCaps.length} · ${cap.id.toUpperCase()}`;
 $('#traits').innerHTML=`<span>${d.element}</span><span data-rarity="${d.rarity.toLowerCase()}">${d.rarity}</span>${d.foil?`<span class="foil-badge">✦ ${foilFinish(d.foil).label}</span>`:''}<span class="ownership">In your wallet</span>`;
 $('#choose').textContent=selected===equipped?`${d.name} selected`:`Use ${d.name}`;
 $('#gallery-loading').textContent='Waking this dork…';$('#gallery-loading').hidden=false;
 gallery.activeCap.userData.ready.then(()=>{if(selected===wrapCap(i)){$('#gallery-loading').hidden=true;}}).catch(()=>{if(selected===wrapCap(i))$('#gallery-loading').textContent='Art failed to load. Please reload.';});
 for(const button of document.querySelectorAll('[data-token]')){
  const active=button.dataset.token===selectedToken;
  button.classList.toggle('selected',active);
  button.setAttribute('aria-pressed',String(active));
  if(active&&view==='collection')button.scrollIntoView({block:'nearest',inline:'center',behavior:reduced?'instant':'smooth'});
 }
}
$('#open-collection').onclick=()=>setView('collection');$('#close-collection').onclick=()=>setView('arena');$('#home').onclick=()=>setView('arena');

let walletOwner;
const gameWallet=mountGameWallet({onChange({accountId,caps,busy:loading,error,available}){
 const inventoryChanged=walletOwner!==accountId||caps.length!==walletCaps.length||caps.some((cap,i)=>cap.id!==walletCaps[i]?.id);
 walletOwner=accountId;
 walletCaps=caps;
 galleryIndices=[...new Set(caps.map(cap=>cap.index))];
 gallery.setFilter(galleryIndices);
 gallery.setEnabled(view==='collection'&&caps.length>0);
 $('#owned-count').textContent=String(caps.length);
 $('#wallet-message').textContent=error||(loading?'Checking your wallet…':!available?'Wallet collections are unavailable on this network.':!accountId?'Connect a NEAR wallet to see your Found Caps.':'This wallet has no Found Caps yet.');
 $('#wallet-empty').hidden=caps.length>0;
 $('#wallet-empty [data-found-wallet]').hidden=Boolean(accountId)||!available||loading;
 $('#retry-wallet').hidden=!error||loading;
 for(const selector of ['.gallery-navigation','.cap-info','.cards','.collection-pick'])$(selector).hidden=caps.length===0;
 if(inventoryChanged){
  $('.cards').replaceChildren(...caps.map(entry=>{
   const dragon=dragons[entry.index];
   const button=document.createElement('button');
   button.className='cap-card';
   button.dataset.token=entry.id;
   button.style.setProperty('--cap-bg',dragon.color);
   const art=document.createElement('span');
   art.className='thumb-art';
   const img=new Image(100,100);
   img.src=frontImage(dragon);
   img.alt='';
   art.append(img);
   const label=document.createElement('span');
   label.textContent=`${dragon.name} #${entry.serial}`;
   button.append(art,label);
   button.onclick=()=>showDragon(entry.index,entry.id);
   return button;
  }));
  if(view==='collection'&&caps.length)showDragon(galleryIndices.includes(selected)?selected:galleryIndices[0]);
 }
 if(!caps.length)spinHint.hide();
 if(!loading&&sessionUi.mode==='lobby'&&isFound(dragons[equipped])&&!caps.some(cap=>cap.index===equipped)){
  equipped=0;
  try{localStorage.removeItem('dorks-equipped');}catch{}
  roundDragons=[equipped,practiceOpponents()[1]];
  refreshMeshes();
  sessionUi.refresh();
 }
}});
$('#retry-wallet').onclick=()=>gameWallet.refresh();
$('#previous-cap').onclick=()=>showDragon(gallery.step(-1));
$('#next-cap').onclick=()=>showDragon(gallery.step(1));
$('#choose').onclick=()=>{equipped=selected;try{localStorage.setItem('dorks-equipped',equipped);}catch{}if(sessionUi.mode==='lobby'){roundDragons=[equipped,practiceOpponents()[1]];refreshMeshes();}setView('arena');sessionUi.refresh();};
$('#help').onclick=()=>{if(busy||state.phase==='rps')return;cancelCharge();$('#rules').showModal();};$('#close-help').onclick=$('#start-help').onclick=()=>$('#rules').close();
$('#sound').onclick=()=>audio.open();
update();

Promise.all(meshes.map(m=>m.userData.ready)).then(()=>bootLoader.done()).catch(()=>bootLoader.fail());
window.addEventListener('keydown',e=>{if(view!=='collection')return;if(e.key==='Escape')setView('arena');else if((e.key==='ArrowLeft'||e.key==='ArrowRight')&&galleryIndices.length>0&&!e.target.closest('button')){e.preventDefault();showDragon(gallery.step(e.key==='ArrowRight'?1:-1));}});


// Explicit recording mode, absent from the normal game UI.
teaserRecorder=mountTeaserRecorder({prepare:()=>audio.prepareRecording(),finish:()=>audio.finishRecording(),getState:()=>({...state,busy,charging}),start(){document.querySelector('#practice').click();},throwCap(){startCharge();setTimeout(releaseCharge,650);}});
