import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server/app.mjs';
import {createStore} from '../server/store.mjs';
import {createRandom, createStage, targetPose} from '../public/range-engine.js';

test('the public range leaderboard verifies rounds and publishes only new records', async () => {
  const store = createStore(':memory:');
  const app = createApp({store});
  await new Promise(resolve => app.listen(0,'127.0.0.1',resolve));
  const origin = 'http://127.0.0.1:' + app.address().port;
  const session = await fetch(origin+'/api/session');
  const cookie = session.headers.getSetCookie()[0].split(';')[0];
  const {csrf} = await session.json();
  async function request(path,body,headers={}) {
    const response = await fetch(origin+'/api/range/'+path,body?{
      method:'POST',headers:{cookie,origin,'content-type':'application/json','x-csrf-token':csrf,...headers},
      body:JSON.stringify(body),
    }:undefined);
    return {status:response.status,data:await response.json()};
  }
  function proof(round,offset) {
    const width = 800, height = 400, at = .2;
    const first = createStage(1,createRandom(round.seed)).targets[0];
    const target = targetPose(first,at,width,height);
    return [[1,at,(target.x+offset*target.radius)/width,target.y/height,width,height]];
  }
  try {
    assert.deepEqual((await request('records')).data,[]);
    assert.equal((await request('round',{}, {origin:'https://example.test'})).status,403);
    const round=(await request('round',{})).data;
    const entry={roundId:round.id,displayName:'Żaneta',shots:proof(round,0)};
    assert.equal((await request('records',entry)).status,400);
    store.db.prepare('UPDATE range_rounds SET started_at=? WHERE id=?').run(Date.now()-31000,round.id);
    const other=await fetch(origin+'/api/session');
    assert.equal((await request('records',entry,{
      cookie:other.headers.getSetCookie()[0].split(';')[0],
      'x-csrf-token':(await other.json()).csrf,
    })).status,400);
    assert.equal((await request('records',{...entry,displayName:'<script>'})).status,400);
    assert.equal((await request('records',{...entry,shots:[[3,...entry.shots[0].slice(1)]]})).status,400);
    const published=await request('records',{...entry,score:99999});
    assert.equal(published.status,201);
    assert.deepEqual(published.data,{published:true,records:[{name:'Żaneta',score:100}]});
    const replay=await request('records',{...entry,displayName:'Different name'});
    assert.deepEqual(replay.data,published.data);

    const second=(await request('round',{})).data;
    store.db.prepare('UPDATE range_rounds SET started_at=? WHERE id=?').run(Date.now()-31000,second.id);
    const lower=await request('records',{roundId:second.id,displayName:'Ada',shots:proof(second,.92)});
    assert.equal(lower.status,200);
    assert.equal(lower.data.published,false);
    assert.deepEqual((await request('records')).data,[{name:'Żaneta',score:100}]);
  } finally {
    await new Promise(resolve=>app.close(resolve));
    store.close();
  }
});
