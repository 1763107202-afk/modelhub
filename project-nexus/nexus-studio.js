'use strict';
const path=require('node:path');
const IMAGE_SIZES=['1024x1024','1536x1024','1024x1536'];
const LANGUAGES={python:'.py',cpp:'.cpp',c:'.c',csharp:'.cs',javascript:'.js',typescript:'.ts',arduino:'.ino',html:'.html',css:'.css',json:'.json',powershell:'.ps1',matlab:'.m',text:'.txt'};
function apiUrl(value){
 let u;try{u=new URL(String(value||'').trim())}catch{throw Error('请填写完整的图像生成接口 URL')}
 if(u.username||u.password||u.hash)throw Error('接口 URL 不能包含账号、密码或片段');
 const local=['127.0.0.1','localhost','::1'].includes(u.hostname);
 if(u.protocol!=='https:'&&!(u.protocol==='http:'&&local))throw Error('只允许 HTTPS 云端接口或本机 HTTP 服务');
 return u.toString();
}
function imageSettings(raw){
 const endpoint=apiUrl(raw?.endpoint||'https://api.openai.com/v1/images/generations');
 const model=String(raw?.model||'gpt-image-1').trim().slice(0,100);
 if(!model)throw Error('请填写图像模型 ID');
 return {endpoint,model};
}
function validateImageRequest(v){
 const prompt=String(v?.prompt||'').trim();
 if(!prompt||prompt.length>3500)throw Error('生图描述需要 1～3500 字');
 const size=String(v?.size||'1024x1024');
 if(!IMAGE_SIZES.includes(size))throw Error('不支持的图片尺寸');
 return {prompt,size};
}
function imageFromResponse(body){
 const d=body?.data?.[0];
 if(!d)throw Error('图像接口没有返回图片数据');
 if(typeof d.b64_json!=='string'||!d.b64_json.length)
  throw Error('该接口未返回 base64 图片。当前仅支持 OpenAI 兼容的 b64_json 响应，不能自动下载远程 URL');
 const data=d.b64_json;
 if(data.length>23*1024*1024||!/^[A-Za-z0-9+/]+={0,2}$/.test(data))throw Error('图片数据格式不正确或超过大小限制');
 const bytes=Buffer.from(data,'base64');
 const png=bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const jpg=bytes.length>=3&&bytes.subarray(0,3).equals(Buffer.from([255,216,255]));
 const webp=bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
 if(!png&&!jpg&&!webp)throw Error('接口返回了不受支持或损坏的图像格式');
 return {dataUrl:'data:image/'+(png?'png':jpg?'jpeg':'webp')+';base64,'+data,bytes,extension:png?'png':jpg?'jpg':'webp',mime:png?'image/png':jpg?'image/jpeg':'image/webp'};
}
function codeLanguage(v){if(!Object.hasOwn(LANGUAGES,v))throw Error('尚不支持此代码语言');return v}
function unwrapCode(raw){
 let s=String(raw||'').trim();
 if(s.length>130000)throw Error('模型返回的代码过长，请拆分生成');
 const m=s.match(/^\x60{3}[a-zA-Z0-9+#._-]*\s*\n([\s\S]*?)\n\x60{3}\s*$/);
 if(m)s=m[1];
 if(!s)throw Error('模型没有返回代码');
 return s;
}
function extensionFor(language){return LANGUAGES[codeLanguage(language)]}
function safeFilename(input,language){
 let name=String(input||'').trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_');
 if(!name)name='nexus_generated'+extensionFor(language);
 if(!name.toLowerCase().endsWith(extensionFor(language)))name+=extensionFor(language);
 return path.basename(name).slice(0,160);
}
module.exports={IMAGE_SIZES,LANGUAGES,apiUrl,imageSettings,validateImageRequest,imageFromResponse,codeLanguage,unwrapCode,extensionFor,safeFilename};