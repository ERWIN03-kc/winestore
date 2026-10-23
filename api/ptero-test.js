const {json,adminOK,getConfig}=require('./_ptero-config');
async function call(base,path,key){const r=await fetch(base+path,{headers:{Accept:'application/json',Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(10000),cache:'no-store'});let d={};try{d=await r.json()}catch{};return {ok:r.ok,status:r.status,data:d};}
module.exports=async(req,res)=>{
 if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
 if(!adminOK(req))return json(res,401,{error:'Masukkan kunci admin yang benar.'});
 try{
  const c=await getConfig();if(!c?.domain||!c?.plta)return json(res,400,{error:'Simpan Domain dan PLTA terlebih dahulu di menu Pengaturan.'});
  const app=await call(c.domain,'/api/application/eggs?per_page=1',c.plta);
  if(!app.ok)return json(res,502,{error:`PLTA gagal (HTTP ${app.status}). Periksa token Application API dan izinnya.`,plta:false,pltc:null});
  let client=null;if(c.pltc){const x=await call(c.domain,'/api/client/account',c.pltc);client=x.ok;if(!x.ok)return json(res,502,{error:`PLTA berhasil, tetapi PLTC gagal (HTTP ${x.status}). Periksa Client API key.`,plta:true,pltc:false});}
  const envMissing=[];for(const k of ['PTERO_EGG_ID','PTERO_LOCATION_ID'])if(!(process.env[k]||'').trim())envMissing.push(k);
  return json(res,200,{ok:true,plta:true,pltc:client,message:`Domain dan PLTA terhubung${c.pltc?' · PLTC terhubung':' · PLTC belum diisi'}.`,warning:envMissing.length?`Masih perlu konfigurasi ${envMissing.join(', ')} di Vercel untuk pembuatan server.`:null});
 }catch(e){return json(res,503,{error:e.message||'Gagal memeriksa koneksi.'});}
};
