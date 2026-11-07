// A short-lived affordance; it never intercepts the 3D cap's pointer events.
export function mountSpinHint(stage){
 const hint=document.createElement('div');hint.className='collection-spin-hint';hint.hidden=true;hint.setAttribute('role','status');
 hint.innerHTML=`<svg viewBox="0 0 96 44" aria-hidden="true"><path class="spin-hint-arrows" d="M26 13 Q13 9 5 16 M12 8 L4 16 13 22 M70 13 Q83 9 91 16 M84 8 L92 16 83 22"/><g class="spin-hint-hand"><path d="M40 36 L34 24 Q32 19 36 18 Q38 18 40 22 L40 8 Q40 3 44 4 Q47 4 47 9 L47 19 Q51 14 54 20 Q59 16 61 23 Q66 21 66 27 L64 37 Q55 43 44 39 Z"/><path d="M47 19 L47 26 M54 20 L54 27 M61 23 L60 29"/></g></svg><span>Drag to spin</span>`;
 stage.append(hint);let timer;
 function hide(){clearTimeout(timer);hint.hidden=true;}
 return {show(){clearTimeout(timer);hint.hidden=false;timer=setTimeout(hide,7000);},hide};
}
