import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {JsonlEventStore} from 'cortico/core/event-store.ts';
import {nullLogger} from 'cortico/core/util.ts';
import type {CoreApi,EventEnvelope} from 'cortico/core/types.ts';
import definition from '../index.ts';
import {MemoryStore,key} from '../store.mjs';

test('published framework APIs archive evidence, pause summarization and require operator approval',async()=>{
  const root=mkdtempSync(join(tmpdir(),'weighted-memory-install-'));
  const dataDir=join(root,'data'),memoryDir=join(root,'workspace');
  mkdirSync(dataDir);mkdirSync(memoryDir);
  const config=definition.defaults();
  const loaded={config,rootDir:root,dataDir,memoryDir,repoRoot:root};
  const parts=definition.build(loaded as never,[]);
  const store=new MemoryStore(join(dataDir,'vanilla-memory.db'));
  const events=new JsonlEventStore({dataDir,run:'fixture',timezone:config.timezone});
  let paused=true,calls=0;
  const deferred: Array<()=>unknown>=[];
  const api={log:nullLogger(),injectInternal(){},injectDeferred(_kind:string,render:()=>unknown){deferred.push(render);},
    spawnFork:async()=>{
      calls++;
      const source=store.db.prepare("SELECT * FROM records WHERE kind='raw' AND processed=2 LIMIT 1").get()!;
      return JSON.stringify([{text:'用户偏好红茶。',reason:'明确表达的个人偏好',kind:'preference',importance:8,
        sourceIds:[source.id],sourceMessageIds:[`event:fixture:${event.cursor}`],occurredAt:null}]);
    }} as unknown as CoreApi;
  parts.persona.attach(api);
  const event=events.append({run:'fixture',source:'console',type:'console.message',origin:'external',senderKey:'console.main',text:'我喜欢红茶。',ts:new Date().toISOString()});
  const wait=async(check:()=>boolean)=>{for(let i=0;i<100;i++){if(check())return;await delay(10);}assert.fail('Timed out waiting for background memory work');};
  try {
    await parts.onStart?.({core:{store:events,bus:{isPaused:()=>paused}}} as never);
    await parts.persona.onDelivery?.({events:[event]} as never);
    await wait(()=>store.pendingEvents(1).length===1);
    parts.persona.onTurnEnded?.();await delay(30);
    assert.equal(calls,0,'paused deployments do not start summary calls');
    paused=false;parts.persona.onTurnEnded?.();
    await wait(()=>store.db.prepare('SELECT count(*) AS n FROM memory_candidates').get()!.n===1);
    assert.equal(calls,1);
    assert.equal(store.pack([event.senderKey!],'红茶').records,0,'candidate must remain hidden before approval');
    const row=store.db.prepare('SELECT * FROM memory_candidates').get()!;
    const surface=parts.persona.webUi!('zh');
    await surface.invoke!('weighted-memory','batchReview',[[{id:row.id,revision:key(JSON.stringify(row))}],'active','操作员确认']);
    assert.match(store.pack([event.senderKey!],'红茶').text,/红茶/);
    const exported=await surface.invoke!('weighted-memory','exportAll',[]) as {jsonl:string};
    assert.ok(exported.jsonl.includes(`event:fixture:${event.cursor}`));
    const download=await surface.invoke!('weighted-memory','exportFile',['json',true]) as {$binary:{base64:string;mime:string}};
    assert.match(download.$binary.mime,/application\/json/);
    assert.ok(JSON.parse(Buffer.from(download.$binary.base64,'base64').toString('utf8')).data.some((row:{text?:string})=>row.text==='用户偏好红茶。'));
    const tools=parts.persona.declareSessions().flatMap(s=>s.tools()).map(t=>t.name);
    for(const name of ['memory_recall','memory_sources','memory_remember','hosting_topic','hosting_instruction']) assert.ok(tools.includes(name),name);
    parts.persona.onOpening?.({reason:'restarted'} as never);
    assert.ok(deferred.length>0);
  } finally {await parts.onStop?.();store.close();rmSync(root,{recursive:true,force:true});}
});

test('manifest ships its standalone WebUI and current bot contract',()=>{
  const root=dirname(dirname(fileURLToPath(import.meta.url)));
  const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
  assert.equal(pkg.cortico.kind,'bot');assert.equal(pkg.cortico.api,7);
  assert.equal(pkg.license,'MIT');
  for(const name of [pkg.cortico.webUiClient,pkg.cortico.webUiStyle,pkg.cortico.describe]) assert.ok(existsSync(join(root,name)),name);
});
