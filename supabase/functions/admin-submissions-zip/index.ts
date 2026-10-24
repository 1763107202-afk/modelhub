import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization,apikey,x-client-info,content-type",
  "Access-Control-Allow-Methods":"POST,OPTIONS",
  "Access-Control-Expose-Headers":"Content-Disposition",
  "Cache-Control":"private, no-store",
};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{...CORS,"Content-Type":"application/json; charset=utf-8"}});
const encoder=new TextEncoder();
const MAX_FILES=100;
const MAX_TOTAL=512*1024*1024;
const MAX_FILE=150*1024*1024;
const hex=(a:Uint8Array)=>Array.from(a).map(n=>n.toString(16).padStart(2,"0")).join("");
const escaped=(s:string)=>encodeURIComponent(s).replace(/[!'()*]/g,c=>"%"+c.charCodeAt(0).toString(16).toUpperCase());
async function sha256(s:string){return new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(s)))}
async function hmac(key:Uint8Array,text:string){
 const k=await crypto.subtle.importKey("raw",key,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 return new Uint8Array(await crypto.subtle.sign("HMAC",k,encoder.encode(text)));
}
async function signedQiniuUrl(bucket:string,objectKey:string,region:string,ak:string,sk:string){
 const host="s3."+region+".qiniucs.com";
 const path="/"+escaped(bucket)+"/"+objectKey.split("/").map(escaped).join("/");
 const now=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
 const date=now.slice(0,8),scope=date+"/"+region+"/s3/aws4_request";
 const pairs=[["X-Amz-Algorithm","AWS4-HMAC-SHA256"],["X-Amz-Credential",ak+"/"+scope],["X-Amz-Date",now],["X-Amz-Expires","1200"],["X-Amz-SignedHeaders","host"]];
 const query=pairs.map(([k,v])=>[escaped(k),escaped(v)]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0).map(([k,v])=>k+"="+v).join("&");
 const canonical="GET\n"+path+"\n"+query+"\nhost:"+host+"\n\nhost\nUNSIGNED-PAYLOAD";
 const toSign="AWS4-HMAC-SHA256\n"+now+"\n"+scope+"\n"+hex(await sha256(canonical));
 const kd=await hmac(encoder.encode("AWS4"+sk),date),kr=await hmac(kd,region),ks=await hmac(kr,"s3"),key=await hmac(ks,"aws4_request");
 return "https://"+host+path+"?"+query+"&X-Amz-Signature="+hex(await hmac(key,toSign));
}
async function qiniuRegion(ak:string,bucket:string){
 const req="https://uc.qiniuapi.com/v4/query?ak="+encodeURIComponent(ak)+"&bucket="+encodeURIComponent(bucket);
 const r=await fetch(req,{signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error("七牛云区域查询失败");
 const payload=await r.json();
 const zone=String(payload?.hosts?.[0]?.region||"");
 const map:Record<string,string>={
  z0:"cn-east-1","cn-east-1":"cn-east-1","cn-east-2":"cn-east-2",
  z1:"cn-north-1","cn-north-1":"cn-north-1",
  z2:"cn-south-1","cn-south-1":"cn-south-1",
  na0:"us-north-1","us-north-1":"us-north-1",
  as0:"ap-southeast-1","ap-southeast-1":"ap-southeast-1"
 };
 if(!map[zone])throw Error("七牛云区域尚未映射");
 return map[zone];
}
function cleanName(raw:string,max=72){
 const s=String(raw||"").normalize("NFC").replace(/[\/\\:*?"<>|\u0000-\u001f\u007f]/g,"_").replace(/^\.+/,"").trim().slice(0,max);
 return s||"未命名";
}
function validKey(key:string){
 return key.startsWith("submissions/")&&key.length<=480&&!key.includes("\\")&&!key.split("/").some(x=>!x||x==="."||x==="..");
}
const crcTable=new Uint32Array(256);
for(let n=0;n<256;n++){let c=n;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;crcTable[n]=c>>>0}
function crcAdd(crc:number,buffer:Uint8Array){for(const b of buffer)crc=crcTable[(crc^b)&255]^(crc>>>8);return crc>>>0}
function set16(a:DataView,offset:number,v:number){a.setUint16(offset,v,true)}
function set32(a:DataView,offset:number,v:number){a.setUint32(offset,v>>>0,true)}
function localHeader(name:Uint8Array){
 const a=new Uint8Array(30+name.length),v=new DataView(a.buffer);
 set32(v,0,0x04034b50);set16(v,4,20);set16(v,6,0x0808);set16(v,8,0);
 set16(v,10,0);set16(v,12,0);set16(v,26,name.length);a.set(name,30);return a;
}
function descriptor(crc:number,size:number){
 const a=new Uint8Array(16),v=new DataView(a.buffer);
 set32(v,0,0x08074b50);set32(v,4,crc);set32(v,8,size);set32(v,12,size);return a;
}
function centralHeader(name:Uint8Array,crc:number,size:number,offset:number){
 const a=new Uint8Array(46+name.length),v=new DataView(a.buffer);
 set32(v,0,0x02014b50);set16(v,4,20);set16(v,6,20);set16(v,8,0x0808);set16(v,10,0);
 set16(v,12,0);set16(v,14,0);set32(v,16,crc);set32(v,20,size);set32(v,24,size);
 set16(v,28,name.length);set32(v,42,offset);a.set(name,46);return a;
}
function endOfCentral(count:number,size:number,offset:number){
 const a=new Uint8Array(22),v=new DataView(a.buffer);
 set32(v,0,0x06054b50);set16(v,8,count);set16(v,10,count);set32(v,12,size);set32(v,16,offset);return a;
}
type ArchiveItem={id:string;exam_id:string;storage_path:string;storage_backend:string;file_name:string;file_size:number|null;user_id:string;submitter_name:string;exams:{title:string}|null};
type AuthClient=ReturnType<typeof createClient>;
async function* buildZip(
 files:ArchiveItem[],admin:AuthClient,keys:{ak:string;sk:string;bucket:string;region:string}
):AsyncGenerator<Uint8Array>{
 let offset=0,totalRaw=0;const central:Uint8Array[]=[];const failed:string[]=[];
 const write=(data:Uint8Array)=>{offset+=data.length;return data};
 for(const item of files){
   const label=(item.exams?.title||"未命名任务")+" / "+(item.submitter_name||"新生")+" / "+(item.file_name||"附件");
   const path=cleanName(item.exams?.title||"未命名任务",64)+"/"+cleanName(item.submitter_name||"新生",40)+"_"+item.user_id.slice(0,8)+"/"+item.id.slice(0,8)+"_"+cleanName(item.file_name||"附件",105);
   let upstream:Response;
   try{
     if(item.storage_backend==="qiniu"||validKey(item.storage_path)){
       if(!validKey(item.storage_path))throw Error("非法七牛文件路径");
       const url=await signedQiniuUrl(keys.bucket,item.storage_path,keys.region,keys.ak,keys.sk);
       upstream=await fetch(url,{signal:AbortSignal.timeout(45000)});
     }else{
       const s=await admin.storage.from("submissions").createSignedUrl(item.storage_path,600);
       if(s.error||!s.data?.signedUrl)throw Error("旧存储签名失败");
       upstream=await fetch(s.data.signedUrl,{signal:AbortSignal.timeout(45000)});
     }
     if(!upstream.ok||!upstream.body)throw Error("源文件 HTTP "+upstream.status);
     const length=Number(upstream.headers.get("Content-Length")||0);
     if(length>MAX_FILE||totalRaw+length>MAX_TOTAL){upstream.body.cancel();throw Error("文件大小超出单包限制，请分批下载")}
   }catch(e){
     failed.push(label+"： "+(e instanceof Error?e.message:"下载初始化失败"));
     continue;
   }
   const name=encoder.encode(path),start=offset;
   yield write(localHeader(name));
   let crc=0xffffffff,size=0,readError="";
   const reader=upstream.body.getReader();
   try{
     while(true){
       const {done,value}=await reader.read();if(done)break;if(!value?.length)continue;
       if(size+value.length>MAX_FILE||totalRaw+size+value.length>MAX_TOTAL){
         readError="数据超过单包大小限制";await reader.cancel();break;
       }
       size+=value.length;crc=crcAdd(crc,value);yield write(value);
     }
   }catch(e){readError=e instanceof Error?e.message:"源文件传输中断"}
   finally{try{reader.releaseLock()}catch(_){}}
   if(readError)failed.push(label+"： "+readError+"；该文件可能只包含部分内容");
   totalRaw+=size;crc=(crc^0xffffffff)>>>0;
   yield write(descriptor(crc,size));
   central.push(centralHeader(name,crc,size,start));
 }
 const listing="实验室新生任务提交批量下载\n生成时间："+new Date().toISOString()+
   "\n请求条数："+files.length+"\nZIP 目录：任务 / 新生姓名_账号标识 / 提交标识_原文件名\n\n"+
   (failed.length?"警告：下列文件未完整打包，请单独重新下载！\n"+failed.join("\n"):"本次文件均已读取完成。")+"\n";
 const noteName=encoder.encode("下载结果说明.txt"),noteData=encoder.encode(listing),noteOffset=offset;
 yield write(localHeader(noteName));yield write(noteData);
 let noteCrc=(crcAdd(0xffffffff,noteData)^0xffffffff)>>>0;
 yield write(descriptor(noteCrc,noteData.length));
 central.push(centralHeader(noteName,noteCrc,noteData.length,noteOffset));
 const centralOffset=offset;
 for(const record of central)yield write(record);
 yield endOfCentral(central.length,offset-centralOffset,centralOffset);
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
 if(req.method!=="POST")return json({error:"只支持 POST"},405);
 try{
   const bearer=req.headers.get("Authorization")||"";
   if(!bearer.startsWith("Bearer "))return json({error:"请登录管理员账号"},401);
   const token=bearer.slice(7);
   const url=Deno.env.get("SUPABASE_URL")||"",secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
   if(!url||!secret)return json({error:"服务配置不完整"},500);
   const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
   const auth=await admin.auth.getUser(token);
   if(auth.error||!auth.data.user)return json({error:"登录已过期"},401);
   const profile=await admin.from("profiles").select("role").eq("id",auth.data.user.id).maybeSingle();
   if(profile.error||!["admin","super_admin"].includes(profile.data?.role||""))return json({error:"只有管理员可以下载全部成员附件"},403);
   const args=await req.json().catch(()=>({}));
   const ids=Array.isArray(args.ids)?args.ids:[];
   if(!ids.length||ids.length>MAX_FILES||ids.some(x=>typeof x!=="string"||!/^[a-f0-9-]{36}$/i.test(x)))return json({error:"请选择 1–100 条有效提交记录"},400);
   const unique=[...new Set(ids)];
   const data=await admin.from("submissions")
     .select("id,exam_id,storage_path,storage_backend,file_name,file_size,user_id,submitter_name,exams(title)")
     .in("id",unique);
   if(data.error)return json({error:"读取提交记录失败"},500);
   if((data.data||[]).length!==unique.length)return json({error:"有提交记录不存在，请刷新后重试"},409);
   const files=(data.data||[]) as unknown as ArchiveItem[];
   if(files.some(x=>!x.storage_path))return json({error:"选中的记录存在空附件路径，请刷新检查"},409);
   const expectedSize=files.reduce((sum,x)=>sum+Math.max(0,Number(x.file_size||0)),0);
   if(expectedSize>MAX_TOTAL)return json({error:"本次附件超过 512MB，请先勾选部分记录分批下载"},413);
   if(files.some(x=>Number(x.file_size||0)>MAX_FILE))return json({error:"存在超过 150MB 的单个附件，请使用原有单文件下载"},413);
   const qiniuFiles=files.some(x=>x.storage_backend==="qiniu"||validKey(x.storage_path));
   const ak=Deno.env.get("QINIU_ACCESS_KEY")||"",sk=Deno.env.get("QINIU_SECRET_KEY")||"",bucket=Deno.env.get("QINIU_BUCKET")||"";
   if(qiniuFiles&&(!ak||!sk||!bucket))return json({error:"七牛云打包服务未配置"},500);
   const region=qiniuFiles?await qiniuRegion(ak,bucket):"";
   const iterator=buildZip(files,admin,{ak,sk,bucket,region});
   const stream=new ReadableStream<Uint8Array>({
     async pull(ctrl){
       try{
         const next=await iterator.next();
         if(next.done)ctrl.close();else ctrl.enqueue(next.value);
       }catch(e){console.error("zip stream error",e instanceof Error?e.message:"unknown");ctrl.error(e)}
     },
     cancel(){void iterator.return?.(undefined)}
   });
   return new Response(stream,{headers:{
     ...CORS,"Content-Type":"application/zip",
     "Content-Disposition":"attachment; filename=\"freshman-submissions.zip\"",
     "X-Content-Type-Options":"nosniff"
   }});
 }catch(e){console.error("admin-submissions-zip",e instanceof Error?e.message:"error");return json({error:"服务器打包失败，请稍后再试"},500)}
});
