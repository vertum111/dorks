import {gripDefaults,readGripSettings,normalizeGrip,GRIP_KEY,DRAFT_KEY} from './grip-settings.js';
export function mountGripTuner(hand,onChange){
 const panel=document.createElement('aside');panel.id='grip-tuner';panel.setAttribute('aria-label','Налаштування хвату');
 let settings=readGripSettings();try{const draft=JSON.parse(localStorage.getItem(DRAFT_KEY));if(draft)settings=normalizeGrip(draft);}catch{}
 const input=(key,label,min,max,step=.01)=>`<label class="tune-row"><span>${label}</span><input type="range" data-key="${key}" aria-label="${label}" min="${min}" max="${max}" step="${step}" value="${settings[key]}"><input type="number" data-number="${key}" aria-label="${label}: точне значення" min="${min}" max="${max}" step="${step}" value="${settings[key]}"></label>`;
 const section=(label,content,open=false)=>`<details ${open?'open':''}><summary>${label}</summary>${content}</details>`;
 const xyz=(prefix,label,min=-1,max=1)=>['X','Y','Z'].map(axis=>input(`${prefix}${axis}`,`${label} · ${axis}`,min,max)).join('');
 const joints=(prefix,label)=>[0,1,2].map((i)=>input(`${prefix}Joint${i}`,`${label} · ${['основа','середина','кінчик'][i]}`,-85,85,1)).join('');
 panel.innerHTML=`<div class="tuner-head"><div><h2>Налаштуй хват</h2><p>Тимчасове меню · зміни видно одразу</p></div><button id="hide-tuner" aria-label="Сховати налаштування">×</button></div><p class="tuner-help">Покрути руку мишею. X — ліворуч/праворуч, Y — висота, Z — уздовж долоні. Зберегти — застосує хват у грі.</p>
 ${section('Кисть: поворот',['Pitch','Yaw','Roll'].map((a,i)=>input(`wrist${a}`,`Кисть · ${['нахил вперед','поворот','нахил убік'][i]}`,-90,90,1)).join(''))}
 ${section('Вигляд руки',`<label class="tune-check"><input type="checkbox" data-check="outlineEnabled" aria-label="Чорна обводка руки" ${settings.outlineEnabled?'checked':''}> Чорна обводка руки</label>`+input('outlineWidth','Товщина обводки',.5,5,.25),true)}
 ${section('Кидок і стіл',input('tableDrop','Опустити стіл',.8,2.5,.05)+input('retractDistance','Відвести кисть назад',.5,3,.05)+input('retractLift','Підняти кисть після кидка',.3,1.5,.05)+input('releaseAt','Момент відриву кепса',.25,.44,.005))}
 ${section('Кепс: положення й нахил',xyz('cap','Кепс',-3,3)+['Pitch','Yaw','Roll'].map((a,i)=>input(`cap${a}`,`Кепс · ${['нахил вперед','поворот','нахил убік'][i]}`,-90,90,1)).join(''),true)}
 ${section('Великий палець',xyz('thumb','Великий: контакт')+input('thumbArch','Великий: напрям дуги',-75,75,1)+input('thumbTip','Великий: нахил кінчика',-60,60,1)+joints('thumb','Великий'))}
 ${section('Вказівний палець',xyz('index','Вказівний: контакт')+input('indexArch','Вказівний: напрям дуги',-75,75,1)+input('indexTip','Вказівний: нахил кінчика',-60,60,1)+joints('index','Вказівний'))}
 ${section('Решта пальців',joints('middle','Середній')+joints('ring','Безіменний')+joints('pinky','Мізинець'))}
 ${section('Відпускання',input('releaseGap','Наскільки розтискати пальці',0,.7)+input('releaseUncurl','Розпрямити кінчики при відпусканні',0,1,.05))}
 <div class="tuner-actions"><button id="save-grip">Зберегти хват у грі</button><button id="reset-grip">Скинути</button><button id="export-grip">Завантажити JSON</button></div><p id="grip-message" role="status">Чернетка зберігається автоматично.</p><details><summary>Параметри для збереження в проєкт</summary><textarea id="grip-json" aria-label="Параметри хвату JSON"></textarea><button id="import-grip">Застосувати JSON</button></details>`;
 document.body.append(panel);
 const saveButton=panel.querySelector('#save-grip');panel.insertBefore(saveButton,panel.querySelector('details'));
 const show=document.createElement('button');show.id='show-tuner';show.textContent='Налаштувати хват ⚙';document.body.append(show);
 function refresh(){panel.querySelector('#grip-json').value=JSON.stringify(settings,null,2);hand.userData.applyGripSettings(settings);onChange?.();}
 panel.addEventListener('input',e=>{
  const key=e.target.dataset.key||e.target.dataset.number||e.target.dataset.check;if(!key)return;
  if(e.target.dataset.check){settings[key]=e.target.checked?1:0;}
  else {
    const value=Number(e.target.value);if(!Number.isFinite(value))return;
    const range=panel.querySelector(`[data-key="${key}"]`);settings[key]=Math.max(Number(range.min),Math.min(Number(range.max),value));
    for(const field of panel.querySelectorAll(`[data-key="${key}"],[data-number="${key}"]`))if(field!==e.target)field.value=settings[key];
  }
  saveButton.textContent='Зберегти хват у грі';settings=normalizeGrip(settings);localStorage.setItem(DRAFT_KEY,JSON.stringify(settings));panel.querySelector('#grip-message').textContent='Чернетку оновлено. Збережи, щоб застосувати у грі.';refresh();
 });
 panel.querySelector('#save-grip').onclick=()=>{localStorage.setItem(GRIP_KEY,JSON.stringify(settings));saveButton.textContent='Збережено у грі ✓';panel.querySelector('#grip-message').textContent='Хват збережено й застосовано у грі ✓';};
 panel.querySelector('#reset-grip').onclick=()=>{settings={...gripDefaults};for(const field of panel.querySelectorAll('[data-key],[data-number]'))field.value=settings[field.dataset.key||field.dataset.number];for(const field of panel.querySelectorAll('[data-check]'))field.checked=!!settings[field.dataset.check];localStorage.setItem(DRAFT_KEY,JSON.stringify(settings));refresh();panel.querySelector('#grip-message').textContent='Чернетку скинуто. Збережи, щоб скинути хват у грі.';};
 panel.querySelector('#import-grip').onclick=()=>{
  try{settings=normalizeGrip(JSON.parse(panel.querySelector('#grip-json').value));for(const field of panel.querySelectorAll('[data-key],[data-number]'))field.value=settings[field.dataset.key||field.dataset.number];for(const field of panel.querySelectorAll('[data-check]'))field.checked=!!settings[field.dataset.check];localStorage.setItem(DRAFT_KEY,JSON.stringify(settings));refresh();saveButton.textContent='Зберегти хват у грі';panel.querySelector('#grip-message').textContent='JSON завантажено в чернетку. Збережи, щоб застосувати у грі.';}
  catch{panel.querySelector('#grip-message').textContent='Не вдалося прочитати JSON. Перевір формат параметрів.';}
 };
 panel.querySelector('#export-grip').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(settings,null,2)],{type:'application/json'}));a.href=url;a.download='dorks-grip.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 function visible(value){panel.hidden=!value;show.hidden=value;document.body.classList.toggle('tuning',value);dispatchEvent(new Event('resize'));}
 panel.querySelector('#hide-tuner').onclick=()=>visible(false);show.onclick=()=>visible(true);
 refresh();visible(true);
}
