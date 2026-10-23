import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {migrate} from '../migrate.mjs';
import {MemoryStore} from '../store.mjs';

test('legacy JSON migration succeeds without an optional workspace directory',()=>{
  const root=mkdtempSync(join(tmpdir(),'memory-legacy-import-'));
  mkdirSync(join(root,'data'));
  writeFileSync(join(root,'data','memory-data.json'),JSON.stringify({notes:{main:[{text:'legacy note',ts:1000}]}}));
  try {
    assert.equal(migrate(root).added,1);
    const store=new MemoryStore(join(root,'data','vanilla-memory.db'));
    try {
      assert.equal(store.db.prepare('SELECT text,state FROM records').get()!.text,'legacy note');
      assert.equal(store.db.prepare('SELECT text,state FROM records').get()!.state,'pending');
    } finally {store.close();}
    assert.equal(migrate(root).added,0);
  } finally {rmSync(root,{recursive:true,force:true});}
});
