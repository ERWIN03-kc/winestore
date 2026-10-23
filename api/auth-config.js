const {json}=require('./_ptero-config');
// Client ID Google bersifat publik (bukan rahasia). Diambil dari Environment Variable GOOGLE_CLIENT_ID.
module.exports=async(req,res)=>{
 if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
 return json(res,200,{googleClientId:(process.env.GOOGLE_CLIENT_ID||'').trim()});
};
