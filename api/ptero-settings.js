const {json,adminOK,setConfig,getConfig,validateDomain}=require('./_ptero-config');
module.exports=async(req,res)=>{
 if(!['GET','POST'].includes(req.method))return json(res,405,{error:'Method not allowed'});
 if(!adminOK(req))return json(res,401,{error:'Kunci admin salah atau belum disetel.'});
 try{
  if(req.method==='POST'){
   const b=req.body||{};const domain=validateDomain(String(b.domain||'').trim());
   const old=await getConfig();const newPlta=String(b.plta||'').trim();const newPltc=String(b.pltc||'').trim();
   const plta=newPlta||old?.plta||'';const pltc=newPltc||old?.pltc||'';
   if(!plta) return json(res,400,{error:'PLTA wajib diisi pertama kali.'});
   if(newPlta&&!/^ptla_[A-Za-z0-9_-]+$/.test(newPlta))return json(res,400,{error:'Format PLTA tidak sesuai. Pastikan memakai Application API key (biasanya diawali ptla_).'});
   if(newPltc&&!/^ptlc_[A-Za-z0-9_-]+$/.test(newPltc))return json(res,400,{error:'Format PLTC tidak sesuai. Pastikan memakai Client API key (biasanya diawali ptlc_).'});
   const updatedAt=new Date().toISOString();await setConfig({domain,plta,pltc,updatedAt});
   return json(res,200,{ok:true,message:'Domain, PLTA, dan PLTC tersimpan terenkripsi di database.',domain,hasPlta:true,hasPltc:!!pltc,updatedAt});
  }
  const c=await getConfig();return json(res,200,{ok:true,configured:!!c,domain:c?.domain||'',hasPlta:!!c?.plta,hasPltc:!!c?.pltc,updatedAt:c?.updatedAt||null});
 }catch(e){return json(res, e.message&&(/Isi UPSTASH|WINE_PTERO_ENCRYPTION_KEY/.test(e.message))?503:400,{error:e.message||'Pengaturan gagal diproses.'});}
};
