# DORKS — дуже дивні дракони

Локальна браузерна гра в кепси. Версія 0.8: мінімальний повноекранний стіл, 3D-руки, власна сорочка, глянсові кепси та рукописний інтерфейс.

## Запуск

На Mac двічі натиснути **Start DORKS.command**. Попередній файл **Start Dragon Caps.command** також працює. Потрібен встановлений Node.js 20.19+ (на цій машині вже є). Термінал тримати відкритим; закриття терміналу зупиняє сервер.

Альтернатива: `node server.mjs` і перейти за адресою з терміналу. Сервер слухає лише 127.0.0.1. Готова збірка — в `dist/`. Для гри інтернет не потрібен: шрифт, моделі, ілюстрації та код знаходяться локально.

## Як грати

Затиснути кнопку або вільне місце на столі й відпустити в зеленій зоні. Пробіл працює так само: утримання заряджає, відпускання кидає. Для клавіатури та assistive technology доступний і двокроковий Enter на кнопці.

Ти й Ботя кидаєте по одному кепсу. Якщо лише один догори — його гравець кидає пару. Якщо обидва впали однаково — починається камінь, ножиці, папір із 5 секундами на вибір; однакові жести повторюють раунд, перший переможець забирає пару. Без вибору до нуля гравець програє пару. Обидва малюнками догори за один кидок дають два очки й два демо-кепси в локальну колекцію. Невдача з парою передає хід супернику. Кращий таймінг підвищує шанс, але випадковість залишається.

«Мої диваки» відкриває колекцію. Можна обертати кепс, масштабувати, кнопкою показати сорочку, скинути огляд, вибрати кепс для гри й експортувати GLB з матеріалами та текстурами. Escape повертає з колекції до гри. Рахунок і колекція зберігаються в localStorage. Ключ попередньої версії збережений.

## Арти, назва й шрифт

Шість оригінальних незграбних драконів створено вбудованим image_gen у погодженому користувачем напрямі. Фінальні файли: `public/art/*-derpy.png`; промпти: `art-directions/final-prompts.json`. Попередні напрями — у `art-directions/` та `public/art/drafts/` і не використовуються у грі.

DORKS — запропонована робоча назва. Власні SVG-лого й спільна сорочка з очима-крапками, ріжками та кривим написом лежать у `public/brand/`. Літери лого переведено в контури. Game UI is English-only and uses locally bundled Freckle Face (Google Fonts / Astigmatic). Its SIL OFL license is included in `public/fonts/OFL-FreckleFace.txt`. User-supplied wordmark and hand symbol are used as SVG outlines.

## 3D

Three.js: справжня геометрія тонкого циліндра з окремими лицьовою стороною, сорочкою та обідком. Фізичний матеріал з прозорим глянсовим покриттям, середовище для відбиттів і світло від камери роблять обидва боки видимими під час обертання. В огляді вимкнена площина підлоги, яка заважала освітленню звороту.

Руки — готова GLB-модель WebXR generic-hand з реальною сіткою та скелетом на 25 суглобів. Джерело: https://github.com/immersive-web/webxr-input-profiles/tree/main/packages/assets/profiles/generic-hand. MIT-ліцензія та дані джерела включені в `public/models/webxr-hand/`. Плаский XR-скелет перетворюється на ланцюжки пальців зі збереженням початкових трансформацій; великий і вказівний пальці виставляються через аналітичний inverse kinematics зі сталою площиною згину на протилежні краї кепса за відеореференсом користувача. Решта пальців розслаблені й трохи підняті над столом, із різним згином суглобів. При відпусканні розходяться лише великий і вказівний — долоня не розкривається віялом. Матеріал руки спрощений; у редакторі та грі однакова гола кисть без рукавів. Чорна обводка деформується разом зі скелетом, її видимість і товщина зберігаються в налаштуваннях.

Окрема сторінка `/hand-lab.html` дає змогу обертати модель, перемикати хват/відкриту долоню та показувати всі 25 точок суглобів. Повільний кидок, вибір фази та повзунок кадрів дають змогу перевірити хват і момент відриву збоку. Перед кидком кепс рухається з рукою; після розтискання пальців летить окремо. У грі лише два кепси: по одному для стартової дуелі та пара в наступній фазі. Кидок короткий, вниз із відскоком; замах плавно продовжує заряджання, пальці починають розходитися на 32.5%, кепс відривається за замовчуванням на 36%, удар об стіл — на 58%. Після кидка кисть плавно повертається до початкового положення; це анімація результату правил, а не симуляція фізики жорстких тіл. Reduced motion прибирає підкидання та рух руки.

## Розробка

`npm ci` → `npm run dev`.

`npm test` — тести правил дуелі, рахунку й таймінгу, контакту пальців з протилежними краями кепса, розтискання та відсутності проникнення сітки руки в стіл протягом кидка.

`npm run build` — оновлення `dist/`; запускати після змін коду перед запуском через .command.

## NFT

NFT, гаманець і мінт ще не підключені. GLB — готовий 3D-асет, а не викарбуваний токен. Гра не переказує активи та не робить ставок. Дослідження NEAR збережене в `NEAR-RESEARCH.txt`.

## Архів тимчасового меню хвату (прибрано з гри у 0.8)

Меню редактора та кнопка ⚙ прибрані. Старе посилання `/hand-lab.html` повертає до гри. Код редактора й збереження залишені для можливого повернення, але не завантажуються у звичайній грі. Нижче — опис попереднього редактора. Панель праворуч змінює положення й нахил кепса, контактні точки великого та вказівного пальців, напрям їх дуги, нахил кінчиків, додаткові оберти суглобів усіх пальців та величину розтискання. Кепс став тоншим: товщина геометрії 0.028 замість 0.09 (у тих самих одиницях).

Зміни одразу відображаються у 3D; чернетка автоматично зберігається в localStorage (`dorks-grip-draft-v1`). «Зберегти хват у грі» записує робочі параметри (`dorks-grip-v1`) і оновлює обидві руки у відкритій вкладці гри на тій самій адресі. JSON можна завантажити або прочитати в розділі «Параметри для збереження в проєкт». Коли хват погоджено, значення переносяться в `src/grip-settings.js`, а тимчасові панель та кнопку ⚙ можна видалити. Збережений хват не залежить від наявності панелі.

## Кисть, обводка та траєкторія — 0.7

Поворот кисті навколо справжнього зап’ястя задається трьома кутами. Кепс і пальці рухаються разом; положення зап’ястя не стрибає під час повороту. Нові поля сумісні зі старим збереженням — виставлені раніше пальці не скидаються. Копія користувацького хвату з 2026-11-03 включена в `presets/user-grip-2026-11-03.json`.

Стіл опущено нижче кисті. Відразу після відриву рука відводиться назад і вгору; при відкриванні пальців кінчики трохи розпрямляються. Кепс спочатку виходить із хвату вниз, а потім зміщується до місця падіння. Під час перевертання центр кепса піднімається на висоту його обернутої геометрії, тому він не проходить крізь стіл. Редактор і гра використовують одні й ті самі функції руху.

У меню: «Кисть: поворот», «Вигляд руки», «Кидок і стіл» та додаткова величина розпрямлення кінчиків при відпусканні. У JSON можна вставити раніше експортовані параметри й застосувати до чернетки.

Регресійні тести перевіряють перетин реальних трикутників деформованої руки з диском кепса на 181 кадрі для збереженого користувацького хвату, повороту кисті та обох гравців. Також перевіряється відсутність проникнення кепса в стіл протягом обертання. Це анімація з геометричними перевірками, а не повна симуляція фізики зіткнень.

## Результати та заруба — 0.8

Перед екраном результату рука переможця показує жартівливий середній палець, долонею назовні. Кулак, ножиці, папір і середній палець — окремі скелетні пози, які не записують нічого у збережений хват. Початкові положення рук, кепсів, зап’ястя, анімація кидка й налаштована обводка не змінені.

Екрани перемоги й поразки мають форму нерівної мальованої хмарки з прозорими стікерами дракона, створеними вбудованим image_gen. Переможний стікер виправлено за зауваженням користувача: лише дві лапи, обидві тримають кепси. Фінальні файли — `public/art/emotes/win-v2.png` та `lose.png`.

КНП: вибір змінюється кнопками або клавішами 1/2/3 протягом п’яти секунд; бот обирає незалежно до того, як користувач зробить вибір. Потім обидві 3D-руки показують жести. Переможець отримує два очки й пару; повторна нічия запускає нові п’ять секунд. Відсутній вибір означає поразку. Таймери скасовуються під час реваншу, результат зараховується один раз.

Тестові HTML-сторінки у `dev/` не включаються в готову збірку.

Victory gesture tuner: wrist rotation is retained under the existing dorks-middle-gesture-v1 key. Each finger has three joint offsets, spread and twist. Reset fingers and reset rotations are separate; only Save writes the pose to browser storage. Cap grip and RPS poses are unaffected.

Version 0.9 collection: 12 stable dragon IDs, including six generated transparent sprites (BOOP, SPUD, FROST, GLITCH, ORBIT, PRISM). GLITCH / ORBIT / PRISM have angle-dependent foil backgrounds with character masks. Source prompts: art-directions/collection-v09-prompts.json. The carousel supports drag-to-spin on the active cap, click-to-select neighbors, keyboard arrows, wraparound navigation, flip/reset/zoom and a horizontally scrolling thumbnail strip. Saved scores, owned IDs and both hand-setting keys are preserved. GLB exports include the composed foil artwork and physical clearcoat; the game's custom animated foil shader is a runtime effect.

Victory hand profiles: Yours keeps the existing `dorks-middle-gesture-v1` key; Bot saves independently under `dorks-middle-gesture-bot-v1`. Each hand has victory-only world translation, whole-hand rotation and actual wrist-bone bend / side bend / twist. The wrist controls preserve the finger pose; reset buttons affect only their own section. Game camera view restores gameplay framing. Existing user angles and cap grip are preserved. The default Bot gesture is moved into frame; only Save writes the selected profile.

## Lobby and sessions — 0.10

Run `npm run build`, then `node server.mjs` and open http://127.0.0.1:4173/. The Node server now serves the matchmaking API as well as the built game. Vite's static preview alone does not provide the lobby API. Use a current Node LTS (20+).

- Open two independent browser tabs at the same server URL. Each tab has its own session token. In both, click **Find a dork**, then **Ready to play**. With only one searching client, the search waits for a real player. **Cancel search** returns to the lobby; **Practice with Bot** is explicitly separate.
- A table click does nothing. Only the yellow **Hold to slam** button charges a throw; a press shorter than 180 ms is cancelled. Space is accepted only while that button has keyboard focus.
- The server validates turn order and resolves random flips. It hides both RPS choices until the shared five-second deadline, repeats ties, records the outcome once and starts a rematch only after both players agree. If both players miss RPS, it repeats; a single missed pick loses. Leaving closes the table for both. Idle clients are disconnected after 15 seconds without a heartbeat.
- **Session** shows wins/losses and each completed match's opponent, two caps, 1:0 result, throw count and cap/RPS method. This visit's history survives reload in sessionStorage. Practice is labelled separately. The table shows the score for this opponent series.
- **Rematch?** requests another round at the same table. The requester waits; the opponent can accept or leave. An abandoned unfinished game is not counted as a completed match.
- Collection: larger thumbnails, drawn SVG arrows, readable Pangolin descriptions, an explicit equip action separate from browsing. Click the active 3D cap to flip it, drag to rotate, scroll to zoom; left/right keys browse. The back reads upright after the horizontal flip. Old flip/reset/export buttons and their hint are removed. Changing a selected cap does not replace the pair already in play. The choice is saved for the next match.
- Existing grip and victory settings are preserved. Responsive camera framing changes only the view, not hand/cap transforms.

This is a local multiplayer prototype, not a deployed internet service: only clients connected to the same running Node server can meet. Server rooms are in memory and reset on restart. No blockchain transfers or NFT minting happen. Before public competition, add persistent identities/storage, rate limiting, turn deadlines, and server-verifiable throw timing: the prototype still accepts the client's timing skill value. The server-generated flip randomness and turn guards alone are not a complete anti-cheat system.

Track analysis and submission checklist: `HACKATHON-PLAN.txt`. NFT contracts, ownership checks and onchain cap progression remain future work. No submission or social post is sent by this update.

Foil finishes: GLITCH uses etched silver diffraction and small offset DORKS stamps; ORBIT uses nebula, stars and circular inclusions with larger stamps; PRISM uses gold rainbow sheets and a diamond lattice. The supplied brand mark is sampled from `public/brand/dorks-foil-stamp.svg`. A camera direction transformed into the cap's local coordinates drives color and logo visibility, so rotating the cap reveals the pattern even with motion reduction enabled. The dragon alpha mask and cream rim exclude all foil/logo effects. Shared stamp texture is loaded once and retained while per-cap masks are disposed. The static artwork fallback also has three different backgrounds.

## More dorks, rock tuning and feel — 0.11

The catalog contains 32 species: 20 new original transparent sprites generated with built-in image_gen (prompts in `art-directions/collection-v011-prompts.json`). Open `/new-dragons.html` to inspect the full new batch. Original alpha is preserved. The gallery now creates 3D cap materials lazily as neighboring caps enter view; thumbnail images use lazy loading.

**Gesture → Rock · RPS fist** edits the rock hand used in the RPS countdown and reveal. Select Yours/Bot, then adjust all five fingers, the wrist joint, whole-hand rotation and position. Save writes only that gesture/hand key (`dorks-rock-gesture-v1` / `dorks-rock-gesture-bot-v1`). Existing middle-finger and grip keys are unchanged. No editor test changes were saved into the user's profiles.

The searching opponent now drums partially bent fingers against the table, palm down. The waiting cap is hidden. This search-only animation does not modify the saved throw/grip poses. Reduced-motion mode shows a still hand. Reference terminology: finger drumming; observed descriptions include https://www.shutterstock.com/video/clip-1062758563-nervous-fingers-tapping-on-table-wooden-desk . No stock footage or third-party rig animation was downloaded.

Audio is original Web Audio synthesis: UI ticks, cap browse/flip, charge/whoosh, woody impact and bounce, search/found, finger taps, RPS clock/reveal and win/loss motifs. Sound settings has master mute, volume, optional quiet soundtrack and a clack preview. Audio begins after a user interaction, uses a shared context/compressor, suspends in hidden tabs and stores settings in `dorks-audio-v1`. No external sample packs, paid audio service or tracking are used.

A logo-hand loader cycles through wind-up, cap release, impact and recovery while the rig loads. It stays briefly visible on fast loads and stops with a readable error on failure. `/loader-preview.html` provides a looping preview. UI panels, result clouds, thumbnails and buttons have short motion, disabled under prefers-reduced-motion. The drawn X icon links to https://x.com/playdorks in a new tab; it does not post anything.

NFT planning is saved in `NFT-COLLECTION-PLAN.txt`, with platform verification limits, 1024-token draft supply, exact rarity/finish allocations, random/reveal approach, asset requirements and launch checks. Run `node scripts/plan-collection.mjs` to reproduce the draft design pool. It neither deploys a contract nor mints NFTs. The 32 source designs are serialized editions, not 1024 independently drawn characters. The game demo inventory is not onchain ownership.

Collection spin hint: an animated drawn hand and “Drag to spin” appear on entry, disappear after 7 seconds or on the first actual drag/flip, and never intercept pointer input. Leaving the collection clears the timer; reduced-motion mode keeps the illustration still.
