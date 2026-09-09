import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createApp} from '../services/app.mjs';
test('online backup restores exact artifacts, signing key and account records',async t=>{
  const parent=await mkdtemp(path.join(tmpdir(),'unplug-recovery-'));
  t.after(()=>rm(parent,{recursive:true,force:true}));
  const data=path.join(parent,'source'),backup=path.join(parent,'backup'),target=path.join(parent,'restored');
  const source=await createApp({dataDir:data,adminEmail:'admin@restore.local',adminPassword:'restore-test-password-123'});
  const before=source.db.prepare('SELECT id,sha256,signature FROM releases ORDER BY id').all();
  const result=spawnSync(process.execPath,['tools/backup.mjs',backup],{env:{...process.env,DATA_DIR:data},encoding:'utf8'});
  source.close();assert.equal(result.status,0,result.stderr);
  const restored=spawnSync(process.execPath,['tools/restore.mjs',backup,target],{encoding:'utf8'});assert.equal(restored.status,0,restored.stderr);
  const ctx=await createApp({dataDir:target,adminEmail:'admin@restore.local',seed:false});
  try{assert.deepEqual(ctx.db.prepare('SELECT id,sha256,signature FROM releases ORDER BY id').all(),before);assert.equal(ctx.db.prepare('SELECT count(*) AS n FROM users').get().n,1);assert.equal(await readFile(path.join(data,'release-key.pem'),'utf8'),await readFile(path.join(target,'release-key.pem'),'utf8'));}finally{ctx.close();}
});
