import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {MemoryStore} from '../store.mjs';

test('conflicting imported raw evidence rejects and rolls back the whole batch',()=>{
  const root=mkdtempSync(join(tmpdir(),'memory-import-'));
  const store=new MemoryStore(join(root,'memory.sqlite'));
  try {
    store.captureMessage({source:'message',scope:'main',text:'original evidence',createdAt:1000,speaker:'alice',run:'run'});
    const original=store.db.prepare('SELECT * FROM raw_messages WHERE id=?').get('message')!;
    for(const change of [{text:'different evidence'},{scope:'other'},{speaker:'bob'},{receivedAt:2000},{run:'other-run'}]) {
      const rows=[{entity:'raw_message',...original,id:'new-message'},{entity:'raw_message',...original,...change}];
      assert.throws(()=>store.importAll(rows.map(row=>JSON.stringify(row)).join('\n')),/conflict/i);
      assert.equal(store.db.prepare('SELECT count(*) AS n FROM raw_messages').get()!.n,1);
    }
    assert.equal(store.importAll(JSON.stringify({entity:'raw_message',...original})).count,1);
  } finally {store.close();rmSync(root,{recursive:true,force:true});}
});

test('imported source and migration links cannot silently replace provenance',()=>{
  const root=mkdtempSync(join(tmpdir(),'memory-import-links-'));
  const store=new MemoryStore(join(root,'memory.sqlite'));
  try {
    const first=store.put({scope:'main',source:'first',text:'first record'});
    const second=store.put({scope:'main',source:'second',text:'second record'});
    const link={entity:'source_link',source:'message',recordId:first};
    store.importAll(JSON.stringify(link));
    assert.throws(()=>store.importAll(JSON.stringify({...link,recordId:second})),/conflict/i);
    assert.equal(store.importAll(JSON.stringify(link)).count,1);
    const migration={entity:'migration_source',recordId:first,batch:'original',previousState:'active'};
    store.importAll(JSON.stringify(migration));
    assert.throws(()=>store.importAll(JSON.stringify({...migration,batch:'different'})),/conflict/i);
    assert.throws(()=>store.importAll(JSON.stringify({...migration,recordId:'absent'})),/missing record/i);
    assert.equal(store.importAll(JSON.stringify(migration)).count,1);
  } finally {store.close();rmSync(root,{recursive:true,force:true});}
});
