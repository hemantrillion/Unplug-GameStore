import test from 'node:test';
import assert from 'node:assert/strict';
import { totp,verifyTotp,newTotpSecret } from '../services/totp.mjs';
test('TOTP matches RFC 6238 vectors truncated to six digits',()=>{
  const secret='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  for(const [timestamp,code] of [[59,'287082'],[1111111109,'081804'],[1111111111,'050471'],[1234567890,'005924'],[2000000000,'279037'],[20000000000,'353130']])assert.equal(totp(secret,Math.floor(timestamp/30)),code);
});
test('TOTP accepts a current code once and rejects malformed values',()=>{
  const secret=newTotpSecret(),step=Math.floor(Date.now()/30000),code=totp(secret,step);
  assert.equal(verifyTotp(secret,code),step);
  assert.equal(verifyTotp(secret,code,step),null);
  assert.equal(verifyTotp(secret,'123'),null);
});
