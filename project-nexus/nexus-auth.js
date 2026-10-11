'use strict';
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');

const SCHEME='scrypt-v1';
const MIN_LENGTH=8;
const MAX_LENGTH=128;
const MAX_ATTEMPTS=5;
const LOCK_SECONDS=30;
function credentialPath(dir){return path.join(dir,'nexus-lock.json')}
function derive(password,salt){
 return crypto.scryptSync(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024});
}
function createHash(password){
 if(typeof password!=='string'||password.length<MIN_LENGTH||password.length>MAX_LENGTH)
  throw Error('访问密码长度需要为 8～128 个字符');
 if(!/\S/.test(password))throw Error('密码不能全部是空白字符');
 const salt=crypto.randomBytes(24);
 const digest=derive(password,salt);
 return {version:1,algorithm:SCHEME,salt:salt.toString('base64'),hash:digest.toString('base64'),createdAt:new Date().toISOString()};
}
function validRecord(data){
 return !!(data&&data.algorithm===SCHEME&&typeof data.salt==='string'&&typeof data.hash==='string'&&
 /^[A-Za-z0-9+/]{32}$/.test(data.salt)&&/^[A-Za-z0-9+/]{86}==$/.test(data.hash));
}
function verifyHash(password,record){
 if(typeof password!=='string'||password.length>MAX_LENGTH||!validRecord(record))return false;
 const expected=Buffer.from(record.hash,'base64');
 const actual=derive(password,Buffer.from(record.salt,'base64'));
 return expected.length===actual.length&&crypto.timingSafeEqual(expected,actual);
}
function createController(dir,{clock=()=>Date.now()}={}){
 let unlocked=false,failures=0,lockedUntil=0;
 const file=credentialPath(dir);
 const saved=()=>{
  if(!fs.existsSync(file))return null;
  let record;try{record=JSON.parse(fs.readFileSync(file,'utf8'))}
  catch{throw Error('密码配置文件损坏，访问已停止。请先备份用户数据再恢复。')}
  if(!validRecord(record))throw Error('密码配置不完整，访问已停止；不会自动重置密码');
  return record;
 };
 function status(){
  const record=saved();
  return {needsSetup:!record,unlocked:!!record&&unlocked,remainingSeconds:Math.max(0,Math.ceil((lockedUntil-clock())/1000))};
 }
 function setup(password,confirmation){
  if(saved())throw Error('已设置访问密码，不能重复初始化');
  if(password!==confirmation)throw Error('两次输入的密码不一致');
  const record=createHash(password);
  fs.mkdirSync(dir,{recursive:true});
  // wx: Never silently overwrite an existing credential, even on a race.
  fs.writeFileSync(file,JSON.stringify(record,null,2),{encoding:'utf8',flag:'wx',mode:0o600});
  unlocked=true;failures=0;lockedUntil=0;
  return status();
 }
 function unlock(password){
  const record=saved();
  if(!record)throw Error('请先完成访问密码初始化');
  if(clock()<lockedUntil)throw Error('尝试次数过多，请在 '+Math.ceil((lockedUntil-clock())/1000)+' 秒后重试');
  const good=verifyHash(password,record);
  if(!good){
   failures++;
   if(failures>=MAX_ATTEMPTS){failures=0;lockedUntil=clock()+LOCK_SECONDS*1000}
   throw Error('密码不正确'+(lockedUntil>clock()?'，已暂时限制尝试':''));
  }
  unlocked=true;failures=0;lockedUntil=0;
  return status();
 }
 function lock(){unlocked=false;return status()}
 function assertUnlocked(){
  if(!unlocked||!saved())throw Error('工作站已锁定，请先输入访问密码');
 }
 return {status,setup,unlock,lock,assertUnlocked};
}
module.exports={createController,createHash,verifyHash,validRecord,MIN_LENGTH};