const https = require('https');
const http = require('http');
const {getConfig}=require('./_ptero-config');
function json(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body));}
function requestJson(base,path,method,key,body){return new Promise((resolve,reject)=>{const u=new URL(base);const transport=u.protocol==='https:'?https:http;const payload=body?JSON.stringify(body):'';const req=transport.request({hostname:u.hostname,port:u.port||undefined,path,method,headers:{Accept:'application/json','Content-Type':'application/json',Authorization:`Bearer ${key}`,...(payload?{'Content-Length':Buffer.byteLength(payload)}:{})},timeout:15000},res=>{let raw='';res.on('data',c=>raw+=c);res.on('end',()=>{let data={};try{data=raw?JSON.parse(raw):{}}catch{}if(res.statusCode<200||res.statusCode>=300){const detail=data?.errors?.map(e=>e.detail||e.code||e.title).join('; ')||`HTTP ${res.statusCode}`;return reject(new Error(detail));}resolve(data);});});req.on('timeout',()=>req.destroy(new Error('Pterodactyl API timeout')));req.on('error',reject);if(payload)req.write(payload);req.end();});}
function cleanUsername(v){return String(v||'').trim().toLowerCase().replace(/[^a-z0-9._-]/g,'').slice(0,20);}
function password(){const chars='abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$';let out='';for(let i=0;i<16;i++)out+=chars[Math.floor(Math.random()*chars.length)];return out;}
module.exports=async(req,res)=>{
 if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
 const secret=(process.env.WINE_PTERO_ADMIN_SECRET||'').trim();if(!secret)return json(res,503,{error:'WINE_PTERO_ADMIN_SECRET belum diatur di Vercel.'});
 const auth=String(req.headers.authorization||'');if(auth!==`Bearer ${secret}`)return json(res,401,{error:'Kunci admin salah.'});
 let saved;try{saved=await getConfig();}catch(e){return json(res,503,{error:e.message||'Database konfigurasi tidak tersedia.'});}
 const base=(saved?.domain||'').trim().replace(/\/$/,'');const key=(saved?.plta||'').trim();const egg=Number(process.env.PTERO_EGG_ID);const location=Number(process.env.PTERO_LOCATION_ID);
 if(!base||!key||!Number.isInteger(egg)||egg<1||!Number.isInteger(location)||location<1)return json(res,503,{error:'Konfigurasi belum lengkap. Isi Domain dan PLTA di Admin → Panel Pterodactyl → Pengaturan, serta PTERO_EGG_ID dan PTERO_LOCATION_ID di Vercel.'});
 let u;try{u=new URL(base);if(!['https:','http:'].includes(u.protocol))throw Error();}catch{return json(res,500,{error:'PTERO_URL tidak valid.'});}
 const b=req.body||{};const type=b.type==='admin'?'admin':'panel';const gb=b.gb==='unlimited'?'unlimited':Number(b.gb);let username=cleanUsername(b.username);if(username.length<4)return json(res,400,{error:'Username harus 4–20 karakter: huruf kecil, angka, titik, strip, underscore.'});if(type==='panel'&&gb!=='unlimited'&&(!Number.isInteger(gb)||gb<1||gb>10))return json(res,400,{error:'Ukuran panel tidak valid.'});
 const pass=password();let user;
 try{
  // Create user through the Application API. Username uniqueness is handled without silently creating a different requested name.
  const email=`${username}@${(process.env.PTERO_EMAIL_DOMAIN||'gmail.com').replace(/[^a-zA-Z0-9.-]/g,'')}`;
  const userData=await requestJson(base,'/api/application/users','POST',key,{email,username,first_name:username,last_name:type==='admin'?'Admin':'Panel',language:'en',...(type==='admin'?{root_admin:true}:{}),password:pass});
  user=userData.attributes;if(!user||!user.id)throw new Error('API tidak mengembalikan data user yang valid.');
  if(type==='admin')return json(res,200,{ok:true,type,username:user.username,password:pass,domain:base,userId:user.id,note:'Akun root admin telah dibuat. Jaga password dan jangan bagikan.'});
  const unlimited=gb==='unlimited';const ram=unlimited?0:gb*1024;const disk=unlimited?0:gb*1024;const cpu=unlimited?0:Math.min(300,gb*30);
  const serverData=await requestJson(base,'/api/application/servers','POST',key,{name:`${username}-${unlimited?'unlimited':gb+'gb'}`,user:user.id,egg,docker_image:process.env.PTERO_DOCKER_IMAGE||'ghcr.io/parkervcp/yolks:nodejs_20',startup:process.env.PTERO_STARTUP||'if [[ -d .git ]] && [[ {{AUTO_UPDATE}} == "1" ]]; then git pull; fi; if [[ ! -z ${NODE_PACKAGES} ]]; then npm install ${NODE_PACKAGES}; fi; if [ -f package.json ]; then npm install; fi; npm start',environment:{INST:'npm',USER_UPLOAD:'0',AUTO_UPDATE:'0',CMD_RUN:'npm start'},limits:{memory:ram,swap:0,disk,io:500,cpu},feature_limits:{databases:5,backups:5,allocations:1},deploy:{locations:[location],dedicated_ip:false,port_range:[]}});
  const server=serverData.attributes;if(!server||!server.id)throw new Error('API tidak mengembalikan data server yang valid.');
  return json(res,200,{ok:true,type,username:user.username,password:pass,domain:base,userId:user.id,serverId:server.id,note:`RAM ${unlimited?'Unlimited':gb+' GB'} · CPU ${unlimited?'Unlimited':cpu+'%'} · Disk ${unlimited?'Unlimited':gb+' GB'}`});
 }catch(e){
  // If user creation succeeded but server creation failed, delete the orphaned user.
  if(user&&user.id&&type==='panel'){try{await requestJson(base,`/api/application/users/${user.id}`,'DELETE',key,null);}catch(rollbackError){console.error('Pterodactyl rollback failed:',rollbackError.message);}}
  const msg=String(e.message||'Pterodactyl API error');return json(res,502,{error:'Gagal membuat akun/server: '+msg});
 }
};
