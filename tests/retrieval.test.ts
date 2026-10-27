import {test} from 'node:test';
import type {TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import definition from '../index.ts';
import {MemoryStore,key,chars} from '../store.mjs';
import {nullLogger} from 'cortico/core/util.ts';

function fixture(t:TestContext,budget=5000){
  const dir=mkdtempSync(join(tmpdir(),'weighted-retrieval-')),store=new MemoryStore(join(dir,'vanilla-memory.db'));
  const config=definition.defaults();config.weightedMemory.autoContentReview=false;config.weightedMemory.recallChars=budget;
  const parts=definition.build({config,rootDir:dir,dataDir:dir,memoryDir:join(dir,'workspace')} as never,[]);
  parts.persona.attach({log:nullLogger(),injectDeferred(){}} as never);
  t.after(async()=>{await parts.onStop?.();store.close();rmSync(dir,{recursive:true,force:true});});
  return {store,parts,config};
}
const note=(store:MemoryStore,id:string,text:string,extra:Partial<Parameters<MemoryStore['put']>[0]>={})=>store.put({id,text,scope:'main',kind:'event',source:'fixture',importance:5,createdAt:1000,...extra});

test('paged search preserves weighted ordering and reaches every substring result',t=>{
  const {store}=fixture(t);note(store,'whole','茉莉',{importance:1});
  for(let i=0;i<35;i++)note(store,'part'+String(i).padStart(2,'0'),'喜欢茉莉花茶。',{importance:1+i%12,createdAt:1000+i});
  const ids:string[]=[];let offset:number|null=0;
  while(offset!==null){const page=store.lookup('茉莉',['main'],{offset,limit:5});ids.push(...page.rows.map(r=>r.id));offset=page.receipt.nextOffset;assert.equal(page.receipt.matchedRecords,36);}
  assert.equal(new Set(ids).size,36);assert.equal(ids[0],'whole');assert.deepEqual(ids.slice(0,30),store.search('茉莉',['main'],30).map(r=>r.id));
});

test('all pages enforce literal escaping, approval, scope and record time bounds',t=>{
  const {store}=fixture(t);
  for(const [id,extra] of Object.entries({allowed:{},other:{scope:'private:other'},pending:{state:'pending'},future:{metadata:{effectiveAt:'2099-01-01T00:00:00Z'}},old:{createdAt:100}}))note(store,id,'原样 %_\\ 记号。',extra);
  const page=store.lookup('%_\\',['main'],{from:'1970-01-01T00:00:00.500Z',to:'1970-01-01T00:00:02Z'});
  assert.deepEqual(page.rows.map(r=>r.id),['allowed']);assert.equal(page.receipt.eligibleRecords,1);assert.equal(page.receipt.historyCompleteness,'unknown');
  assert.throws(()=>store.lookup('x',['main'],{from:'yesterday'}),/time/);assert.throws(()=>store.lookup('x',['main'],{offset:-1}),/bounds/);
});

test('sources link only to current approved memories and preserve the original speaker',t=>{
  const {store}=fixture(t);store.captureMessage({source:'message',scope:'main',text:'我替你保管花盆。',createdAt:1000,speaker:'visitor:42'});
  const source=store.archiveEvent({scope:'main',source:'message',text:'我替你保管花盆。',createdAt:1000,run:'fixture'});
  const id=store.remember({text:'访客42保管花盆。',sourceId:source,kind:'event',importance:8,reason:'物品保管关系'},['main']);store.review(id,'active','确认',key(JSON.stringify(store.get(id))));
  const changed=store.correct(id,'访客42临时保管花盆。',8,'补充条件',key(JSON.stringify(store.get(id))));
  assert.deepEqual(store.lookup('花盆',['main'],{view:'sources'}).rows[0].memoryIds,[]);
  store.review(changed,'active','确认新版本',key(JSON.stringify(store.get(changed))));
  const before=store.exportAll().jsonl,page=store.lookup('花盆',['main'],{view:'sources'});
  assert.deepEqual(page.rows[0].memoryIds,[changed]);assert.deepEqual(page.rows[0].sourceMessageIds,['message']);
  const proof=store.evidence(source,0,['main']);assert.equal(proof.rows[0].speaker,'visitor:42');assert.equal(store.evidence(changed,0,['main']).rows[0].id,'message');
  assert.throws(()=>store.evidence(source,0,['private:other']),/scope/);assert.equal(store.exportAll().jsonl,before);
});

test('model and console share bounded results while model scope stays host-owned',async t=>{
  const {store,parts}=fixture(t,2000);note(store,'long','"\\'.repeat(3000));note(store,'secret','另一个会话的花盆。',{scope:'private:other'});
  const tool=parts.persona.declareSessions().find(s=>s.id==='main')!.tools().find(t=>t.name==='memory_search')!;
  const reply=await tool.handler({query:'"\\'},{} as never) as string;assert.ok(chars(reply)<=2000);const parsed=JSON.parse(reply);
  assert.equal(parsed.rows[0].id,'long');assert.equal(parsed.rows[0].textTruncated,true);assert.equal(parsed.receipt.outputComplete,false);
  assert.match(await tool.handler({query:'花盆',scope:'private:other'},{} as never) as string,/host-owned/);
  const page=await parts.persona.webUi!('zh').invoke!('weighted-memory','search',[{query:'"\\',scope:'main'}]) as typeof parsed;assert.deepEqual(page.rows,parsed.rows);
  assert.equal(definition.memoryName,'权重检索');
});

test('budget pagination reaches every record and missing results do not assert complete history',async t=>{
  const {store,parts}=fixture(t,1500);for(let i=0;i<12;i++)note(store,'row'+i,'分页标记 '+i+'；'+'正文'.repeat(100));
  const tool=parts.persona.declareSessions().find(s=>s.id==='main')!.tools().find(t=>t.name==='memory_search')!;
  const ids:string[]=[];let offset:number|null=0;
  while(offset!==null){const reply=await tool.handler({query:'分页标记',offset},{} as never) as string;assert.ok(chars(reply)<=1500);const page=JSON.parse(reply);assert.ok(page.rows.length>0);ids.push(...page.rows.map((r:{id:string})=>r.id));offset=page.receipt.nextOffset;}
  assert.equal(new Set(ids).size,12);
  const empty=JSON.parse(await tool.handler({query:'ZXVUNFOUND'},{} as never) as string);assert.equal(empty.receipt.matchedRecords,0);assert.equal(empty.receipt.historyCompleteness,'unknown');assert.equal(empty.receipt.queryComplete,true);
});
