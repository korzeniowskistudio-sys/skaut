// Shared gameplay rules. The server replays the same target sequence before
// accepting a public record.
export const STAGE_SECONDS = 30;
export const STAGE_NOTICE_SECONDS = 1;
export const TARGET_RINGS = 5;
export const BONUS_POINTS = 200;
export const CLOCK_SECONDS = 6;
export const SHOT_INTERVAL = .13;

export const STAGES = [
  {points: 0, life: [3.1, 4.2], speed: .45, drift: .55, size: 1.45},
  {points: 500, life: [1.85, 3.1], speed: 1, drift: 1, size: 1},
  {points: 1000, life: [1.5, 2.55], speed: 1.23, drift: 1.15, size: .87, clockTimes: [6, 14, 23]},
];

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function createRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), seed | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

function between(random, min, max) {
  return min + random() * (max - min);
}

function newTarget(born, difficulty, random, kind = 'regular') {
  const direction = random() < .5 ? -1 : 1;
  const clock = kind === 'clock';
  return {
    kind, born,
    life: clock ? 3.3 : between(random,...difficulty.life),
    x: between(random,.12,.88),
    y: between(random,.23,.51),
    velocity: direction * between(random,.095,.23) * (clock ? .65 : difficulty.speed),
    wave: between(random,0,Math.PI * 2),
    drift: between(random,.025,.075) * difficulty.drift,
    size: between(random,.84,1.15) * difficulty.size * (kind === 'bonus' ? .62 : 1),
  };
}

export function targetPose(target, elapsed, width, height) {
  const age = elapsed - target.born;
  const x = target.x + target.velocity * age;
  const radius = Math.max(10, clamp(width * .025,17,30) * target.size);
  const edge = clamp((radius + 2) / width,.08,.48);
  const lane = 1 - edge * 2;
  const wrapped = ((x - edge) % (lane * 2) + lane * 2) % (lane * 2);
  return {
    x: (edge + Math.min(wrapped,lane * 2 - wrapped)) * width,
    y: (target.y + Math.sin(age * 3.1 + target.wave) * target.drift) * height,
    radius,
    opacity: Math.min(1,age / .13,(target.life - age) / .2),
  };
}

export function createStage(number, random) {
  const difficulty = STAGES[number-1];
  return {
    difficulty, end:STAGE_SECONDS, lastShot:-1,
    nextTarget:between(random,.45,.7),
    upcomingClocks:[...(difficulty.clockTimes ?? [])],
    targets:[newTarget(0,difficulty,random)],
  };
}

export function advanceTargets(stage, elapsed, random) {
  const {difficulty} = stage;
  // Schedule at the exact spawn times, so browser frames and sparse server
  // replays consume the same random numbers in the same order.
  while (true) {
    const clockTime = stage.upcomingClocks[0] ?? Infinity;
    const spawnTime = Math.min(stage.nextTarget,clockTime);
    if (spawnTime > elapsed) break;
    stage.targets = stage.targets.filter(target => spawnTime - target.born < target.life);
    if (clockTime < stage.nextTarget) {
      stage.upcomingClocks.shift();
      stage.targets.push(newTarget(clockTime,difficulty,random,'clock'));
    } else {
      const kind = random() < .2 ? 'bonus' : 'regular';
      const target = newTarget(spawnTime,difficulty,random,kind);
      const insertAt = stage.targets.at(-1)?.kind === 'clock' ? stage.targets.length-1 : stage.targets.length;
      stage.targets.splice(insertAt,0,target);
      stage.nextTarget += between(random,.52,.95);
    }
  }
  stage.targets = stage.targets.filter(target => elapsed - target.born < target.life);
}

export function takeShot(stage, elapsed, x, y, width, height, random) {
  advanceTargets(stage,elapsed,random);
  stage.lastShot = elapsed;
  for (let index=stage.targets.length-1; index>=0; index--) {
    const entry = stage.targets[index];
    const pose = targetPose(entry,elapsed,width,height);
    const distance = Math.hypot(x*width-pose.x,y*height-pose.y);
    if (pose.opacity < .2 || distance > pose.radius) continue;
    stage.targets.splice(index,1);
    if (entry.kind === 'clock') {
      stage.end += CLOCK_SECONDS;
      return {...pose,points:0,clock:true};
    }
    const ring = Math.min(TARGET_RINGS-1,Math.floor(distance/pose.radius*TARGET_RINGS));
    const points = entry.kind === 'bonus' ? BONUS_POINTS : (TARGET_RINGS-ring)*20;
    return {...pose,points,clock:false};
  }
  return null;
}
