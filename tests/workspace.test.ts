import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {GitWorkspaceMemory} from '../base/persona/memory.ts';

test('workspace rejects reads and writes through symlinks or Windows junctions',()=>{
  const root=mkdtempSync(join(tmpdir(),'memory-workspace-'));
  const inside=join(root,'inside'),outside=join(root,'outside');
  mkdirSync(inside);mkdirSync(outside);
  writeFileSync(join(outside,'private.txt'),'outside secret');
  symlinkSync(outside,join(inside,'linked'),process.platform==='win32'?'junction':'dir');
  const memory=new GitWorkspaceMemory({memoryDir:inside});
  try {
    assert.throws(()=>memory.readFile('linked/private.txt'),/symbolic link|符号链接/);
    assert.throws(()=>memory.writeFileAtomic('linked/new.txt','changed'),/symbolic link|符号链接/);
    assert.throws(()=>memory.appendFile('linked/private.txt','changed'),/symbolic link|符号链接/);
    assert.throws(()=>memory.ensureDirs(['linked/new-dir']),/symbolic link|符号链接/);
    assert.throws(()=>memory.blobs.put('linked/new.bin',Buffer.from('changed'),'application/octet-stream'),/symbolic link|符号链接/);
    assert.equal(memory.blobs.get('mem:linked/private.txt'),null);
    assert.equal(readFileSync(join(outside,'private.txt'),'utf8'),'outside secret');
    assert.equal(existsSync(join(outside,'new.txt')),false);
  } finally {rmSync(root,{recursive:true,force:true});}
});

test('workspace enumeration skips external and cyclic links while retaining normal files',()=>{
  const root=mkdtempSync(join(tmpdir(),'memory-listing-'));
  const inside=join(root,'inside'),outside=join(root,'outside');
  mkdirSync(inside);mkdirSync(outside);
  writeFileSync(join(inside,'notes.md'),'searchable note');
  writeFileSync(join(outside,'private.md'),'searchable secret');
  symlinkSync(outside,join(inside,'linked'),process.platform==='win32'?'junction':'dir');
  const memory=new GitWorkspaceMemory({memoryDir:inside});
  try {
    assert.deepEqual(memory.walkFiles(),['notes.md']);
    symlinkSync(inside,join(inside,'cycle'),process.platform==='win32'?'junction':'dir');
    assert.deepEqual(memory.walkFiles(),['notes.md']);
    assert.deepEqual(memory.listDir(),['notes.md']);
    assert.equal(memory.listing().includes('private'),false);
    assert.equal(memory.tree().includes('cycle'),false);
    assert.equal(memory.treeShallow().includes('linked'),false);
    assert.deepEqual(memory.grep({match:line=>line.includes('searchable')}).map(hit=>hit.path),['notes.md']);
    assert.deepEqual(memory.blobs.list('').map(blob=>blob.handle),['mem:notes.md']);
    memory.writeFileAtomic('regular/note.txt','ok');
    assert.equal(memory.readFile('regular/note.txt'),'ok');
  } finally {rmSync(root,{recursive:true,force:true});}
});
