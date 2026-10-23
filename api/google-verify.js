const {json}=require('./_ptero-config');
// Memverifikasi ID token Google di server: tanda tangan dicek oleh Google (tokeninfo),
// lalu audience (Client ID), masa berlaku, dan status email dicek di sini.
module.exports=async(req,res)=>{
 if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
 const clientId=(process.env.GOOGLE_CLIENT_ID||'').trim();
 if(!clientId)return json(res,503,{error:'Login Google belum diaktifkan oleh owner.'});
 const credential=String((req.body&&req.body.credential)||'');
 if(!credential||credential.length>4096)return json(res,400,{error:'Token Google tidak valid.'});
 try{
  const r=await fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(credential),{signal:AbortSignal.timeout(10000),cache:'no-store'});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||d.error_description||d.error)return json(res,401,{error:'Token Google ditolak. Coba masuk lagi.'});
  if(d.aud!==clientId)return json(res,401,{error:'Token Google bukan untuk website ini.'});
  if(!['accounts.google.com','https://accounts.google.com'].includes(d.iss))return json(res,401,{error:'Penerbit token tidak valid.'});
  if(Number(d.exp)*1000<Date.now())return json(res,401,{error:'Token Google sudah kedaluwarsa.'});
  if(String(d.email_verified)!=='true'||!d.email)return json(res,401,{error:'Email Google belum terverifikasi.'});
  return json(res,200,{ok:true,email:String(d.email).toLowerCase(),name:d.name||'',picture:d.picture||''});
 }catch(e){return json(res,502,{error:'Gagal menghubungi Google. Coba lagi.'});}
};
