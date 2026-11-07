import {t, tr} from './i18n.js?v=20261107-english';
import {createRangeAudio} from './range-audio.js?v=20261107-range-audio';

const ASSETS = '/assets/range-game/';
const RECORD_KEY = 'skaut-range-high-score';
const STAGE_SECONDS = 30;
const STAGE_NOTICE_SECONDS = 1;
const STAGES = [
  {points: 0, life: [3.1, 4.2], speed: .45, drift: .55, size: 1.45},
  {points: 500, life: [1.85, 3.1], speed: 1, drift: 1, size: 1},
  {points: 1000, life: [1.5, 2.55], speed: 1.23, drift: 1.15, size: .87},
];
const INTRO_MS = 3270;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const between = (min, max) => min + Math.random() * (max - min);

export function rangeGameMarkup() {
  return `<section class="range-game" data-range-game data-phase="intro" aria-labelledby="range-game-title">
    <img class="range-art" src="${ASSETS}poster.webp" alt="" width="1120" height="480" fetchpriority="high">
    <img class="range-art range-art--arena" src="${ASSETS}arena.webp" data-range-arena alt="" hidden>
    <canvas class="range-canvas" aria-label="${t("Plansza gry w ruchome tarcze")}" aria-describedby="range-game-controls" tabindex="-1" hidden></canvas>
    <p class="range-stage-notice" data-range-stage-notice hidden></p>
    <div class="range-hud">
      <p class="range-hud-label">SKAUT <span>·</span> ${t("Strefa gry")}</p>
      <div class="range-readouts" data-range-readouts hidden>
        <div class="range-stat" role="status"><span>${t("Etap")}</span><strong data-range-stage>1 / ${STAGES.length}</strong></div>
        <div class="range-stat"><span>${t("Czas")}</span><strong data-range-time>30 s</strong></div>
        <div class="range-stat range-stat--score" role="status">
          <span>${t("Wynik")}</span><strong data-range-score>0000</strong>
          <small class="range-record">${t("Rekord")} <b data-range-high-score>0000</b></small>
        </div>
      </div>
    </div>
    <div class="range-overlay" data-range-overlay>
      <h2 id="range-game-title">${t("Ruchome tarcze.")}</h2>
      <p data-range-message>${t("Masz")} ${STAGE_SECONDS} ${t("sekund na etap. Etap 2 zaczyna się przy")} ${STAGES[1].points} ${t("pkt, a etap 3 przy")} ${STAGES[2].points} ${t("pkt. Celuj myszą i kliknij albo dotknij tarczy.")}</p>
      <button type="button" class="btn light range-play" data-range-play hidden>${t("Graj")}</button>
      <button type="button" class="range-utility" data-range-skip>${t("Pomiń intro")}</button>
    </div>
    <button type="button" class="range-utility range-pause" data-range-pause hidden>${t("Pauza")}</button>
    <button type="button" class="range-utility range-sound" data-range-sound aria-label="${t("Dźwięk gry")}" aria-pressed="true" hidden>${t("Dźwięk: wł.")}</button>
    <p class="range-sr" id="range-game-controls">${t("Celuj myszą i kliknij, by strzelić. Na ekranie dotykowym dotknij tarczy. Użyj strzałek, aby celować z klawiatury. Spacja oddaje strzał, a Escape wstrzymuje rundę.")}</p>
  </section>`;
}

function newTarget(at, stage) {
  const difficulty = STAGES[stage - 1];
  const direction = Math.random() < .5 ? -1 : 1;
  return {
    born: at,
    life: between(...difficulty.life),
    x: between(.12, .88),
    y: between(.23, .51),
    velocity: direction * between(.095, .23) * difficulty.speed,
    wave: between(0, Math.PI * 2),
    drift: between(.025, .075) * difficulty.drift,
    size: between(.84, 1.15) * difficulty.size,
  };
}

function targetPose(target, elapsed, width, height) {
  const age = elapsed - target.born;
  const x = target.x + target.velocity * age;
  const radius = clamp(width * .025, 17, 30) * target.size;
  const edge = Math.max(.08, (radius + 2) / width);
  // Bounce inside the lane so even the quickest targets stay reachable.
  const lane = 1 - edge * 2;
  const wrapped = ((x - edge) % (lane * 2) + lane * 2) % (lane * 2);
  return {
    x: (edge + Math.min(wrapped, lane * 2 - wrapped)) * width,
    y: (target.y + Math.sin(age * 3.1 + target.wave) * target.drift) * height,
    radius,
    opacity: Math.min(1, age / .13, (target.life - age) / .2),
  };
}

export function mountRangeGame(root) {
  const canvas = root.querySelector('canvas');
  const context = canvas.getContext('2d');
  const intro = new Image();
  intro.alt = '';
  intro.className = 'range-art';
  intro.hidden = true;
  const arena = root.querySelector('[data-range-arena]');
  const overlay = root.querySelector('[data-range-overlay]');
  const title = root.querySelector('#range-game-title');
  const message = root.querySelector('[data-range-message]');
  const play = root.querySelector('[data-range-play]');
  const skip = root.querySelector('[data-range-skip]');
  const pause = root.querySelector('[data-range-pause]');
  const soundButton = root.querySelector('[data-range-sound]');
  const audio = createRangeAudio();
  const readouts = root.querySelector('[data-range-readouts]');
  const stageNotice = root.querySelector('[data-range-stage-notice]');
  const stageValue = root.querySelector('[data-range-stage]');
  const scoreValue = root.querySelector('[data-range-score]');
  const recordValue = root.querySelector('[data-range-high-score]');
  const timeValue = root.querySelector('[data-range-time]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  const options = {signal: controller.signal};
  const sprite = new Image();
  let phase = 'intro';
  let introTimer = 0;
  let introStarted = false;
  let assetsStarted = false;
  let frame = 0;
  let width = 1;
  let height = 1;
  let density = 1;
  let stage = 1;
  let noticeTime = 0;
  let elapsed = 0;
  let lastFrame = 0;
  let nextTarget = 0;
  let lastShot = -1;
  let score = 0;
  let record = 0;
  try {
    const saved = Number(localStorage.getItem(RECORD_KEY));
    if (Number.isSafeInteger(saved) && saved > 0) record = saved;
  } catch {}
  recordValue.textContent = String(record).padStart(4, '0');
  let shots = 0;
  let hits = 0;
  let targets = [];
  let feedback = [];
  let aim = {x: .5, y: .4};
  let pose = {...aim};

  function loadArt() {
    if (assetsStarted) return;
    assetsStarted = true;
    sprite.src = ASSETS + 'hands.webp';
  }

  function setPhase(next) {
    phase = next;
    root.dataset.phase = next;
    const inRound = ['playing', 'paused', 'finished'].includes(next);
    arena.hidden = !inRound;
    canvas.hidden = !inRound;
    canvas.tabIndex = next === 'playing' ? 0 : -1;
    overlay.hidden = next === 'playing';
    pause.hidden = next !== 'playing';
    soundButton.hidden = next === 'intro' || !audio.supported;
    stageNotice.hidden = next !== 'playing' || noticeTime <= 0;
    readouts.hidden = next === 'intro';
    skip.hidden = next !== 'intro';
    play.hidden = next === 'intro' || !context;
  }

  function ready(skipIntro = false) {
    if (phase !== 'intro' || controller.signal.aborted) return;
    const skipHadFocus = document.activeElement === skip;
    clearTimeout(introTimer);
    if (skipIntro) intro.hidden = true;
    loadArt();
    setPhase('ready');
    if (!context) message.textContent = t('Gra wymaga obsługi grafiki Canvas.');
    else if (skipHadFocus) play.focus({preventScroll: true});
  }

  function startIntro() {
    if (introStarted || phase !== 'intro') return;
    introStarted = true;
    loadArt();
    if (reduced.matches) {
      ready(true);
      return;
    }
    // A fresh image identity restarts the one-shot animation on every visit.
    intro.src = ASSETS + 'turn-intro.webp?v=20261107-longer&play=' + crypto.randomUUID();
    arena.before(intro);
    introTimer = setTimeout(() => ready(true), 4200);
    intro.decode().then(() => {
      if (controller.signal.aborted || phase !== 'intro') return;
      intro.hidden = false;
      clearTimeout(introTimer);
      introTimer = setTimeout(ready, INTRO_MS);
    }).catch(() => ready(true));
  }

  function resize() {
    const bounds = root.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    density = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(height * density);
    if (!canvas.hidden) paint();
  }

  function drawTarget(target) {
    const {x, y, radius, opacity} = targetPose(target, elapsed, width, height);
    if (opacity <= 0) return;
    context.save();
    context.globalAlpha = opacity;
    context.lineWidth = 2;
    context.fillStyle = '#1a2021';
    context.strokeStyle = '#ffce80';
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.globalAlpha = opacity * .8;
    context.beginPath();
    context.arc(x, y, radius * .67, 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = opacity;
    context.fillStyle = '#ffce80';
    context.beginPath();
    context.arc(x, y, radius * .34, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawHands() {
    if (!sprite.naturalWidth) return;
    const ratio = sprite.naturalWidth / sprite.naturalHeight;
    const spriteHeight = Math.min(height * .52, width * .61 / ratio);
    const spriteWidth = spriteHeight * ratio;
    const turn = (pose.x - .5) * 2;
    const tilt = (pose.y - .4) * height * .2;
    const recoil = reduced.matches ? 0 : Math.max(0, 1 - (elapsed - lastShot) / .14);
    context.save();
    context.translate(width * (.5 + turn * .24), height * 1.025 + tilt - recoil * 8);
    context.rotate(turn * .28 + recoil * (turn < 0 ? .018 : -.018));
    context.drawImage(sprite, -spriteWidth / 2, -spriteHeight, spriteWidth, spriteHeight);
    if (recoil > .65) {
      const glow = context.createRadialGradient(0, -spriteHeight * .91, 0, 0, -spriteHeight * .91, 17);
      glow.addColorStop(0, '#ffeac5');
      glow.addColorStop(1, '#ffb15b00');
      context.fillStyle = glow;
      context.fillRect(-18, -spriteHeight * .91 - 18, 36, 36);
    }
    context.restore();
  }

  function paint() {
    if (!context) return;
    context.setTransform(density, 0, 0, density, 0, 0);
    context.clearRect(0, 0, width, height);
    targets.forEach(drawTarget);
    drawHands();
    context.textAlign = 'center';
    context.font = '700 20px system-ui';
    for (const hit of feedback) {
      const age = elapsed - hit.born;
      context.globalAlpha = 1 - age / .55;
      context.fillStyle = '#ffe0a9';
      context.fillText('+' + hit.points, hit.x * width, hit.y * height - 12 - (reduced.matches ? 0 : age * 30));
    }
    context.globalAlpha = 1;
    if (phase !== 'playing' || noticeTime > 0) return;
    const x = aim.x * width;
    const y = aim.y * height;
    const reticle = new Path2D();
    reticle.moveTo(x - 13, y); reticle.lineTo(x - 5, y);
    reticle.moveTo(x + 5, y); reticle.lineTo(x + 13, y);
    reticle.moveTo(x, y - 13); reticle.lineTo(x, y - 5);
    reticle.moveTo(x, y + 5); reticle.lineTo(x, y + 13);
    context.strokeStyle = '#111';
    context.lineWidth = 3.5;
    context.stroke(reticle);
    context.strokeStyle = '#fff';
    context.lineWidth = 1.5;
    context.stroke(reticle);
  }

  function updateReadouts() {
    const stageLabel = stage + ' / ' + STAGES.length;
    if (stageValue.textContent !== stageLabel) stageValue.textContent = stageLabel;
    const time = Math.max(0, Math.ceil(STAGE_SECONDS - elapsed)) + ' s';
    if (timeValue.textContent !== time) timeValue.textContent = time;
    const formatted = String(score).padStart(4, '0');
    if (scoreValue.textContent !== formatted) scoreValue.textContent = formatted;
  }

  function stopFrame() {
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function finish() {
    stopFrame();
    audio.pause();
    audio.play('over');
    setPhase('finished');
    title.textContent = 'GAME OVER';
    const result = tr`Trafienia: ${hits} / ${shots}. Wynik: ${score} pkt.`;
    const next = STAGES[stage];
    message.textContent = next
      ? tr`${result} Etap ${stage + 1} odblokujesz po zdobyciu ${next.points} pkt.`
      : result;
    play.textContent = t('Zagraj ponownie');
    updateReadouts();
    paint();
    play.focus({preventScroll: true});
  }

  function tick(now) {
    if (phase !== 'playing') return;
    const dt = clamp((now - lastFrame) / 1000, 0, .08);
    lastFrame = now;
    const noticeStep = Math.min(noticeTime, dt);
    noticeTime -= noticeStep;
    if (noticeTime === 0 && !stageNotice.hidden) stageNotice.hidden = true;
    elapsed = Math.min(STAGE_SECONDS, elapsed + dt - noticeStep);
    if (elapsed >= STAGE_SECONDS) {
      finish();
      return;
    }
    if (elapsed >= nextTarget) {
      targets.push(newTarget(elapsed, stage));
      nextTarget = elapsed + between(.52, .95);
    }
    targets = targets.filter(target => elapsed - target.born < target.life);
    feedback = feedback.filter(hit => elapsed - hit.born < .55);
    const ease = reduced.matches ? 1 : 1 - Math.exp(-dt * 15);
    pose.x += (aim.x - pose.x) * ease;
    pose.y += (aim.y - pose.y) * ease;
    updateReadouts();
    paint();
    frame = requestAnimationFrame(tick);
  }

  function startStage(number) {
    stage = number;
    elapsed = 0;
    noticeTime = number === 1 ? 0 : STAGE_NOTICE_SECONDS;
    stageNotice.textContent = noticeTime ? `STAGE ${number}` : '';
    stageNotice.hidden = !noticeTime;
    lastShot = -1;
    nextTarget = between(.45, .7);
    targets = [newTarget(0, stage)];
    feedback = [];
    lastFrame = performance.now();
    updateReadouts();
  }

  function start() {
    if (phase === 'playing' || phase === 'intro' || !context) return;
    const restart = phase !== 'paused';
    if (restart) {
      score = shots = hits = 0;
      startStage(1);
      aim = {x: .5, y: .4};
      pose = {...aim};
    }
    audio.start(restart);
    setPhase('playing');
    resize();
    updateReadouts();
    lastFrame = performance.now();
    frame = requestAnimationFrame(tick);
    canvas.focus({preventScroll: true});
  }

  function pauseRound(focus = false) {
    if (phase !== 'playing') return;
    stopFrame();
    audio.pause();
    setPhase('paused');
    title.textContent = t('Pauza.');
    message.textContent = t('Wznów rundę, gdy będziesz gotowy.');
    play.textContent = t('Wznów grę');
    paint();
    if (focus) play.focus({preventScroll: true});
  }

  function moveAim(event) {
    if (phase !== 'playing') return;
    const bounds = canvas.getBoundingClientRect();
    aim.x = clamp((event.clientX - bounds.left) / bounds.width, .01, .99);
    aim.y = clamp((event.clientY - bounds.top) / bounds.height, .01, .99);
  }

  function shoot() {
    if (phase !== 'playing' || noticeTime > 0 || elapsed - lastShot < .13) return;
    lastShot = elapsed;
    shots++;
    audio.play('shot');
    for (let index = targets.length - 1; index >= 0; index--) {
      const target = targetPose(targets[index], elapsed, width, height);
      const distance = Math.hypot(aim.x * width - target.x, aim.y * height - target.y);
      if (target.opacity < .2 || distance > target.radius) continue;
      const points = distance <= target.radius * .35 ? 100 : 50;
      hits++;
      score += points;
      if (score > record) {
        record = score;
        recordValue.textContent = String(record).padStart(4, '0');
        try { localStorage.setItem(RECORD_KEY, String(record)); } catch {}
      }
      targets.splice(index, 1);
      feedback.push({x: target.x / width, y: target.y / height, points, born: elapsed});
      const next = STAGES[stage];
      if (next && score >= next.points) {
        audio.play('stage');
        startStage(stage + 1);
      } else {
        audio.play('hit');
        updateReadouts();
      }
      break;
    }
  }

  function updateSoundButton() {
    soundButton.setAttribute('aria-pressed', String(audio.enabled));
    soundButton.textContent = audio.enabled ? t('Dźwięk: wł.') : t('Dźwięk: wył.');
  }
  updateSoundButton();
  soundButton.addEventListener('click', () => {
    audio.toggle();
    updateSoundButton();
  }, options);
  skip.addEventListener('click', () => { ready(true); play.focus({preventScroll: true}); }, options);
  play.addEventListener('click', start, options);
  pause.addEventListener('click', () => pauseRound(true), options);
  canvas.addEventListener('pointermove', moveAim, options);
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary) return;
    moveAim(event);
    shoot();
  }, options);
  root.addEventListener('keydown', event => {
    if (phase !== 'playing') return;
    if (event.key === 'Escape') {
      event.preventDefault();
      pauseRound(true);
      return;
    }
    if (event.target !== canvas) return;
    const direction = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[event.key];
    if (direction) {
      event.preventDefault();
      aim.x = clamp(aim.x + direction[0] * .022, .01, .99);
      aim.y = clamp(aim.y + direction[1] * .035, .01, .99);
    } else if (event.code === 'Space' || event.key === 'Enter') {
      event.preventDefault();
      shoot();
    }
  }, options);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseRound();
  }, options);
  reduced.addEventListener('change', () => { if (reduced.matches) ready(true); }, options);
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.intersectionRatio >= .16) startIntro();
    else pauseRound();
  }, {threshold: [.16]});
  observer.observe(root);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(root);

  return () => {
    controller.abort();
    clearTimeout(introTimer);
    stopFrame();
    audio.dispose();
    observer.disconnect();
    resizeObserver.disconnect();
  };
}
