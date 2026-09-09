import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function newTotpSecret(){const bytes=randomBytes(20);let bits='';for(const b of bytes)bits+=b.toString(2).padStart(8,'0');return bits.match(/.{5}/g).map(b=>alphabet[parseInt(b,2)]).join('');}
function decode(value){let bits='';for(const c of value)bits+=alphabet.indexOf(c).toString(2).padStart(5,'0');return Buffer.from(bits.match(/.{8}/g).map(b=>parseInt(b,2)));}
export function totp(secret,step=Math.floor(Date.now()/30000)){
  const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(step));const hmac=createHmac('sha1',decode(secret)).update(counter).digest();const offset=hmac[19]&15;return ((hmac.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,'0');
}
export function verifyTotp(secret,code,lastStep=-1){
  if(typeof code!=='string'||!/^\d{6}$/.test(code))return null;
  const step=Math.floor(Date.now()/30000);
  for(const candidate of [step-1,step,step+1])if(candidate>lastStep&&timingSafeEqual(Buffer.from(totp(secret,candidate)),Buffer.from(code)))return candidate;
  return null;
}
