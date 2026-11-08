import {randomBytes,randomUUID} from 'node:crypto';
import {STAGES,STAGE_NOTICE_SECONDS,SHOT_INTERVAL,createRandom,createStage,takeShot} from '../public/range-engine.js';
import {problem} from './store.mjs';

const ROUND_TTL = 30*60*1000;
const MAX_SHOTS = 850;
const badRound = () => problem(400,'Nie udało się zweryfikować rundy.');

function replay(seed, shots) {
  if (!Array.isArray(shots) || shots.length > MAX_SHOTS) throw badRound();
  const random = createRandom(seed);
  let stageNumber=1, stage=createStage(stageNumber,random), score=0, seconds=0;
  for (const shot of shots) {
    if (!Array.isArray(shot) || shot.length!==6 || !shot.every(Number.isFinite)) throw badRound();
    const [number,at,x,y,width,height]=shot;
    if (number!==stageNumber || at<0 || at>=stage.end || at-stage.lastShot<SHOT_INTERVAL ||
        x<.01 || x>.99 || y<.01 || y>.99 || width<1 || width>10000 || height<1 || height>1500) throw badRound();
    score += takeShot(stage,at,x,y,width,height,random)?.points ?? 0;
    const next=STAGES[stageNumber];
    if (next && score>=next.points) {
      seconds+=at+STAGE_NOTICE_SECONDS;
      stage=createStage(++stageNumber,random);
    }
  }
  return {score,seconds:seconds+stage.end};
}

export function createRangeRecords(db) {
  const records=()=>db.prepare('SELECT name,score FROM range_records ORDER BY score DESC LIMIT 10').all();
  return {
    records,
    start(owner) {
      const id=randomUUID(), seed=randomBytes(4).readUInt32LE(), now=Date.now();
      db.prepare('DELETE FROM range_rounds WHERE started_at < ?').run(now-ROUND_TTL);
      db.prepare('INSERT INTO range_rounds(id,owner,seed,started_at) VALUES(?,?,?,?)').run(id,owner,seed,now);
      return {id,seed};
    },
    submit(owner,{roundId,displayName,shots}) {
      const name=typeof displayName==='string'&&displayName.length<=48?displayName.trim().normalize('NFC'):'';
      if (name.length>24 || !/^[\p{L}\p{N}][\p{L}\p{M}\p{N} ._'’-]*$/u.test(name)) {
        throw problem(400,'Podaj nazwę do 24 znaków: litery, cyfry, spacje lub proste znaki.');
      }
      if (typeof roundId!=='string' || roundId.length!==36) throw badRound();
      const round=db.prepare('SELECT seed,started_at FROM range_rounds WHERE id=? AND owner=?').get(roundId,owner);
      const age=round?Date.now()-round.started_at:Infinity;
      if (age>ROUND_TTL) throw badRound();
      const result=replay(round.seed,shots);
      // Permit small browser/server clock drift but require time for all
      // completed stages, their notices and any earned extensions.
      if (age+250<result.seconds*1000) throw badRound();
      db.prepare(`INSERT OR IGNORE INTO range_records(round_id,name,score)
                  SELECT ?,?,? WHERE ?>COALESCE((SELECT MAX(score) FROM range_records),0)`)
        .run(roundId,name,result.score,result.score);
      const published=Boolean(db.prepare('SELECT 1 FROM range_records WHERE round_id=?').get(roundId));
      return {published,records:records()};
    },
  };
}
