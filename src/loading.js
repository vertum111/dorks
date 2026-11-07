export function mountLoader(){
 const started=performance.now();
 const overlay=document.createElement('div');overlay.className='boot-loader';overlay.setAttribute('role','status');overlay.setAttribute('aria-live','polite');overlay.innerHTML=`<div class="loader-toss"><img src="/brand/dorks-mark.svg" alt=""><i class="loader-cap"></i><i class="loader-shadow"></i></div><p>Waking the dorks<span>…</span></p>`;document.body.append(overlay);
 return {done(){setTimeout(()=>{overlay.classList.add('is-ready');setTimeout(()=>overlay.remove(),360);},Math.max(0,850-(performance.now()-started)));},fail(){overlay.querySelector('p').textContent='The dorks got stuck. Reload to try again.';overlay.classList.add('is-stuck');}};
}
