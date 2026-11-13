// Original tracker-style score and cues, with two sampled shot variations.
const RATE = 22050;
const TAU = Math.PI * 2;
const SOUND_KEY = 'skaut-range-sound';
const SHOT_URLS = ['/assets/range-game/shot-muffled.mp3', '/assets/range-game/shot-crisp.mp3'];
const frequency = note => 440 * 2 ** ((note - 69) / 12);
const quantize = value => Math.round(value * 127) / 127;

const SONG = [
  {bass: 38, chord: [62, 65, 69, 74], lead: [[0, 74, 3], [6, 77, 2], [10, 81, 3]]},
  {bass: 38, chord: [62, 65, 69, 77], lead: [[0, 79, 4], [7, 77, 3], [12, 74, 3]]},
  {bass: 34, chord: [58, 62, 65, 70], lead: [[2, 77, 3], [8, 74, 3], [13, 70, 2]]},
  {bass: 36, chord: [60, 64, 67, 72], lead: [[0, 72, 3], [6, 76, 3], [11, 79, 4]]},
  {bass: 43, chord: [55, 58, 62, 67], lead: [[0, 79, 4], [7, 82, 2], [10, 81, 4]]},
  {bass: 38, chord: [62, 65, 69, 74], lead: [[1, 77, 2], [5, 74, 3], [11, 81, 4]]},
  {bass: 34, chord: [58, 62, 65, 70], lead: [[0, 82, 3], [6, 81, 2], [10, 77, 4]]},
  {bass: 33, chord: [57, 61, 64, 69], lead: [[0, 76, 3], [6, 73, 3], [11, 69, 4]]},
];

function noiseGenerator() {
  let seed = 0x7a1f3bd2;
  return () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 0x80000000 - 1;
  };
}

function instrument(pitch, length, kind) {
  return time => {
    const phase = TAU * pitch * time;
    const attack = Math.min(1, time / .006);
    const release = Math.min(1, Math.max(0, (length - time) / .035));
    const decay = Math.exp(-time * (kind === 'arp' ? 11 : kind === 'bass' ? 4.3 : 2.2));
    const wave = kind === 'bass'
      ? Math.sin(phase) * .73 + Math.sin(phase * 2) * .17 + Math.sin(phase * 3) * .1
      : kind === 'arp'
        ? Math.sin(phase) * .66 + Math.sin(phase * 3) * .23 + Math.sin(phase * 5) * .11
        : Math.sin(phase + .15 * Math.sin(TAU * 5.6 * time)) * .77 +
          Math.sin(phase * 2.006) * .16 + Math.sin(phase * 3) * .07;
    return attack * release * decay * quantize(wave);
  };
}

function renderMusic(context) {
  const beat = 60 / 128;
  const step = beat / 4;
  const noise = noiseGenerator();
  const buffer = context.createBuffer(2, Math.round(RATE * step * SONG.length * 16), RATE);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  function mix(at, length, level, pan, sample) {
    const start = Math.round(at * RATE);
    const end = Math.ceil(length * RATE);
    const l = level * (1 - pan * .5);
    const r = level * (1 + pan * .5);
    for (let i = 0; i < end; i++) {
      const pos = (start + i) % left.length;
      const value = sample(i / RATE);
      left[pos] += value * l;
      right[pos] += value * r;
    }
  }
  function note(at, length, midi, level, pan, kind) {
    mix(at, length, level, pan, instrument(frequency(midi), length, kind));
  }
  SONG.forEach(({bass, chord, lead}, bar) => {
    const start = bar * 16 * step;
    for (const beat of [0, 6, 8, 14]) {
      mix(start + beat * step, .18, .39, 0, t =>
        Math.sin(TAU * (47 * t + 2.1 * (1 - Math.exp(-t * 41)))) * Math.exp(-t * 23) * Math.min(1, t * 550));
    }
    for (const beat of [4, 12]) {
      mix(start + beat * step, .145, .19, .07, t =>
        quantize((noise() * .74 + .24 * Math.sin(TAU * 174 * t)) * Math.exp(-t * 36)) * Math.min(1, t * 650));
    }
    for (const beat of [2, 3, 6, 7, 10, 11, 14, 15]) {
      mix(start + beat * step, .05, beat % 2 ? .027 : .061, -.34, t =>
        quantize((noise() - noise()) * .5 * Math.exp(-t * 89)) * Math.min(1, t * 900));
    }
    const bassLine = [[0, 0], [2, 0], [5, 12], [7, 0], [8, 0], [10, 7], [13, 12], [15, 0]];
    for (const [beat, offset] of bassLine) note(start + beat * step, step * 1.62, bass + offset, .23, 0, 'bass');
    const arpLine = [0, -1, 2, 1, -1, 2, 3, -1, 1, -1, 2, 3, 0, -1, 2, 1];
    arpLine.forEach((index, beat) => {
      if (index >= 0) note(start + beat * step, step * 1.6, chord[index], .079, -.52, 'arp');
    });
    for (const [beat, midi, length] of lead) {
      const at = start + beat * step;
      note(at, step * length, midi, .129, .39, 'lead');
      note(at + step * 3, step * length, midi, .022, -.42, 'arp');
    }
  });
  return buffer;
}

function renderEffects(context) {
  const noise = noiseGenerator();
  function clip(duration, sample) {
    const buffer = context.createBuffer(1, Math.ceil(duration * RATE), RATE);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / RATE;
      const edge = Math.min(1, t * 850, (duration - t) * 120);
      data[i] = quantize(sample(t) * edge);
    }
    return buffer;
  }
  function cue(notes, step) {
    const length = step * 1.45;
    const voices = notes.map(note => instrument(frequency(note), length, 'arp'));
    return clip(step * (notes.length + .5), time => {
      let sample = 0;
      voices.forEach((voice, i) => {
        const t = time - step * i;
        if (t >= 0 && t < length) sample += .56 * voice(t);
      });
      return sample;
    });
  }
  return {
    shot: clip(.115, t => (noise() * .61 + Math.sin(TAU * (92 * t + 1.4 * (1 - Math.exp(-68 * t)))) * .34) *
      Math.exp(-t * 48)),
    hit: cue([86, 93], .064),
    stage: cue([74, 77, 81, 86], .092),
    over: cue([77, 76, 72, 69], .13),
  };
}

export function createRangeAudio() {
  const Audio = window.AudioContext || window.webkitAudioContext;
  const effectsPlaying = new Set();
  let enabled = true;
  try { enabled = localStorage.getItem(SOUND_KEY) !== 'off'; } catch {}
  let active = false;
  let context, master, music, effects, loop, loopVolume, startedAt;
  let shots, lastShot = -1;
  let offset = 0;

  function prepare() {
    if (context) return context;
    context = new Audio();
    master = context.createGain();
    master.gain.value = .68;
    master.connect(context.destination);
    music = renderMusic(context);
    effects = renderEffects(context);
    shots = [effects.shot];
    const audio = context;
    for (const url of SHOT_URLS) {
      fetch(url).then(response => response.ok ? response.arrayBuffer() : null)
        .then(data => data && audio.decodeAudioData(data))
        .then(buffer => { if (buffer && context === audio) shots.push(buffer); })
        .catch(() => {});
    }
    return context;
  }

  function stopMusic() {
    if (!loop) return;
    const now = context.currentTime;
    offset = (offset + now - startedAt) % music.duration;
    const volume = loopVolume.gain;
    const currentLevel = volume.value;
    volume.cancelScheduledValues(now);
    volume.setValueAtTime(currentLevel, now);
    volume.linearRampToValueAtTime(0, now + .025);
    loop.stop(now + .025);
    loop = null;
  }

  function stopEffects() {
    for (const source of effectsPlaying) source.stop();
    effectsPlaying.clear();
  }

  function start(reset = false) {
    if (reset) {
      stopMusic();
      stopEffects();
      offset = 0;
    }
    active = true;
    if (!enabled || !Audio) return;
    try {
      const audio = prepare();
      const playLoop = () => {
        if (!active || !enabled || loop || context !== audio) return;
        loop = context.createBufferSource();
        loop.buffer = music;
        loop.loop = true;
        const source = loop;
        const volume = context.createGain();
        loopVolume = volume;
        startedAt = context.currentTime;
        volume.gain.setValueAtTime(0, startedAt);
        volume.gain.linearRampToValueAtTime(.48, startedAt + .025);
        source.connect(volume).connect(master);
        source.onended = () => { source.disconnect(); volume.disconnect(); };
        loop.start(0, offset);
      };
      if (audio.state === 'running') playLoop();
      else audio.resume().then(playLoop).catch(() => {});
    } catch { /* Audio can be unavailable without interrupting the game. */ }
  }

  return {
    supported: Boolean(Audio),
    get enabled() { return enabled; },
    start,
    pause() {
      active = false;
      stopMusic();
      stopEffects();
    },
    toggle() {
      enabled = !enabled;
      try { localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off'); } catch {}
      if (enabled && active) start();
      else {
        stopMusic();
        stopEffects();
      }
    },
    play(name) {
      if (!enabled || !effects?.[name] || context.state !== 'running' || document.hidden) return;
      const source = context.createBufferSource();
      if (name === 'shot') lastShot = (lastShot + 1) % shots.length;
      source.buffer = name === 'shot' ? shots[lastShot] : effects[name];
      source.connect(master);
      effectsPlaying.add(source);
      source.onended = () => {
        effectsPlaying.delete(source);
        source.disconnect();
      };
      source.start();
    },
    dispose() {
      active = false;
      stopMusic();
      stopEffects();
      context?.close().catch(() => {});
      context = null;
    },
  };
}
