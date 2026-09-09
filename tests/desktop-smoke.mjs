import { _electron as electron } from 'playwright';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(path.join(tmpdir(),'unplug-electron-'));
const executablePath=path.resolve('apps/desktop/dist/win-unpacked/UNPLUG Desktop.exe');
const app=await electron.launch({executablePath,args:[`--user-data-dir=${dir}`]});
try{
  const page=await app.firstWindow();await page.getByRole('heading',{name:'A little room to create.'}).waitFor();
  assert.equal(await page.evaluate(()=>typeof window.require),'undefined');
  assert.equal(await page.evaluate(()=>typeof window.process),'undefined');
  console.log('PASS: desktop setup opens with no renderer Node.js access.');
}finally{await app.close();await rm(dir,{recursive:true,force:true});}
