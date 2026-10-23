const crypto = require('crypto');
const REDIS_KEY = 'wine:ptero:settings:v1';
function json(res, status, body) { res.statusCode=status; res.setHeader('Content-Type','application/json; charset=utf-8'); res.setHeader('Cache-Control','no-store, max-age=0'); res.setHeader('X-Content-Type-Options','nosniff'); res.end(JSON.stringify(body)); }
function adminOK(req) {
  const secret=(process.env.WINE_PTERO_ADMIN_SECRET||'').trim();
  return !!secret && String(req.headers.authorization||'') === `Bearer ${secret}`;
}
function encryptionKey() {
  const raw=(process.env.WINE_PTERO_ENCRYPTION_KEY||'').trim();
  if(!/^[a-f0-9]{64}$/i.test(raw)) throw new Error('WINE_PTERO_ENCRYPTION_KEY harus berisi 64 karakter hex (32 byte).');
  return Buffer.from(raw,'hex');
}
function encrypt(obj) {
  const iv=crypto.randomBytes(12), cipher=crypto.createCipheriv('aes-256-gcm',encryptionKey(),iv);
  const data=Buffer.concat([cipher.update(JSON.stringify(obj),'utf8'),cipher.final()]);
  return JSON.stringify({v:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')});
}
function decrypt(raw) {
  const x=JSON.parse(raw); if(x.v!==1) throw new Error('Versi konfigurasi tidak dikenal.');
  const decipher=crypto.createDecipheriv('aes-256-gcm',encryptionKey(),Buffer.from(x.iv,'base64'));
  decipher.setAuthTag(Buffer.from(x.tag,'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(x.data,'base64')),decipher.final()]).toString('utf8'));
}
function redisEnv(){const url=(process.env.UPSTASH_REDIS_REST_URL||'').trim().replace(/\/$/,'');const token=(process.env.UPSTASH_REDIS_REST_TOKEN||'').trim();if(!url||!token)throw new Error('Isi UPSTASH_REDIS_REST_URL dan UPSTASH_REDIS_REST_TOKEN untuk penyimpanan persisten.');return {url,token};}
async function redisCommand(...args){const {url,token}=redisEnv();const r=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(args),cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok||d.error)throw new Error('Database Redis gagal diakses. Periksa kredensial Upstash.');return d.result;}
async function getConfig(){const raw=await redisCommand('GET',REDIS_KEY);if(!raw)return null;return decrypt(raw);}
async function setConfig(cfg){await redisCommand('SET',REDIS_KEY,encrypt(cfg));}
function validateDomain(value){let u;try{u=new URL(value);}catch{throw new Error('Domain tidak valid. Masukkan URL lengkap, misalnya https://panel.domainmu.com');}if(u.protocol!=='https:' || u.username || u.password || u.search || u.hash || u.pathname!=='/')throw new Error('Domain panel wajib HTTPS dan hanya berisi domain, tanpa path, query, atau kredensial.');const h=u.hostname.toLowerCase();if(h==='localhost'||h.endsWith('.localhost')||h==='127.0.0.1'||h==='::1'||/^10\./.test(h)||/^192\.168\./.test(h)||/^172\.(1[6-9]|2\d|3[01])\./.test(h))throw new Error('Domain lokal/private tidak diizinkan.');return u.origin;}
module.exports={json,adminOK,getConfig,setConfig,validateDomain};
