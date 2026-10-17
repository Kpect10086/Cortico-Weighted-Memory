import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {MemoryStore,key} from '../store.mjs';

test('JSON, Markdown and SQLite export approved/all scopes without mutating live WAL data',async()=>{
  const root=mkdtempSync(join(tmpdir(),'memory-export-test-'));
  const store=new MemoryStore(join(root,'live.sqlite'));
  try{
    const approved=store.manual({text:'已批准的中文记忆 🌿',scope:'main',kind:'event',importance:5,sourceType:'manual',reason:'明确依据'});
    store.review(approved,'active','确认',key(JSON.stringify(store.get(approved))));
    store.manual({text:'尚未批准的内容',scope:'other',kind:'event',importance:5,sourceType:'manual',reason:'待审批'});
    store.captureMessage({source:'source-1',scope:'main',text:'原始来源证据',createdAt:Date.now()});
    store.archiveEvent({source:'source-1',scope:'main',text:'原始来源证据',createdAt:Date.now(),run:'fixture'});
    const original=store.exportAll();
    for(const approvedOnly of [false,true]){
      const jsonResult=await store.exportFile('json',approvedOnly);
      assert.match(jsonResult.$binary.mime,/application\/json/);
      const json=JSON.parse(Buffer.from(jsonResult.$binary.base64,'base64').toString('utf8'));
      assert.equal(json.format,'cortico-weighted-memory');assert.equal(json.approvedOnly,approvedOnly);
      assert.ok(json.data.some((r:{text?:string})=>r.text==='已批准的中文记忆 🌿'));
      assert.equal(json.data.some((r:{text?:string})=>r.text==='尚未批准的内容'),!approvedOnly);
      assert.equal(json.data.some((r:{entity?:string})=>r.entity==='raw_message'),!approvedOnly);
      const md=await store.exportFile('md',approvedOnly);
      const text=Buffer.from(md.$binary.base64,'base64').toString('utf8');
      assert.match(text,/已批准的中文记忆 🌿/);assert.equal(text.includes('尚未批准的内容'),!approvedOnly);
      const sqlite=await store.exportFile('sqlite',approvedOnly);
      const bytes=Buffer.from(sqlite.$binary.base64,'base64');assert.equal(bytes.subarray(0,16).toString(),'SQLite format 3\0');
      const file=join(root,approvedOnly?'approved.sqlite':'all.sqlite');writeFileSync(file,bytes);
      const db=new DatabaseSync(file,{readOnly:true});
      try{
        assert.equal(db.prepare('PRAGMA integrity_check').get()!.integrity_check,'ok');
        assert.equal(db.prepare('SELECT count(*) AS n FROM records').get()!.n,approvedOnly?1:3);
        assert.equal(db.prepare('SELECT count(*) AS n FROM raw_messages').get()!.n,approvedOnly?0:1);
        assert.equal(db.prepare('SELECT count(*) AS n FROM event_sources').get()!.n,approvedOnly?0:1);
        assert.equal(db.prepare("SELECT count(*) AS n FROM records WHERE state='pending'").get()!.n,approvedOnly?0:1);
        const audit=db.prepare('SELECT rowid AS version,* FROM audit WHERE recordId=? ORDER BY rowid').all(approved);
        assert.deepEqual(audit,store.db.prepare('SELECT rowid AS version,* FROM audit WHERE recordId=? ORDER BY rowid').all(approved));
        assert.equal(db.prepare("SELECT count(*) AS n FROM search WHERE search MATCH '尚未'").get()!.n,approvedOnly?0:1);
      }finally{db.close();}
    }
    assert.equal(store.exportAll().jsonl,original.jsonl,'export cannot change original state or audit');
    store.put({scope:'main',text:'导出后仍可写入',source:'after-export'});
    assert.equal(store.stats().total,4);
    await assert.rejects(store.exportFile('exe' as never),/Invalid export/);
    await assert.rejects(store.exportFile('json','true' as never),/Invalid export/);
  }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
