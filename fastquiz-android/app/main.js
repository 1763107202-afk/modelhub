var db=null, running=false, alive=true, p=null;
var dbFile=files.join(String(context.getFilesDir().getAbsolutePath()),"lexicon.db");
function startupDb(){
  var input=context.getAssets().open("project/lexicon.db");
  if(!files.exists(dbFile)||new java.io.File(dbFile).length()<1000000){
    var out=new java.io.FileOutputStream(dbFile);
    var b=java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE,65536),n;
    try{while((n=input.read(b))!==-1)out.write(b,0,n);}
    finally{out.close();}
  }
  input.close();
  db=android.database.sqlite.SQLiteDatabase.openDatabase(dbFile,null,android.database.sqlite.SQLiteDatabase.OPEN_READONLY);
  var c=db.rawQuery("SELECT COUNT(*) FROM dictionary",[]);
  c.moveToFirst();var count=c.getLong(0);c.close();
  if(count<100000)throw Error("词库不完整:"+count);
  var ctest=db.rawQuery("SELECT translation FROM dictionary WHERE word='tiger'",[]);
  var tiger=ctest.moveToFirst()?String(ctest.getString(0)):"";
  ctest.close();
  if(tiger.indexOf("老虎")<0)throw Error("词典校验失败：tiger="+tiger);
  log("词典自检：tiger → "+tiger);
  toastLog("词库已加载："+count+"条；tiger检测通过");
}
function lookup(word){
 var c=db.rawQuery("SELECT translation FROM dictionary WHERE word=? LIMIT 1",[word.toLowerCase()]);
 try{return c.moveToFirst()?String(c.getString(0)):"";}finally{c.close();}
}
function normalized(s){
 return String(s||"").replace(/^\s*(?:n|v|a|adj|adv|vt|vi|prep|pron|conj|int|art)\.?\s*/ig,"")
   .replace(/\[[^\]]+\]/g,"").replace(/[\s，。;；:：、()（）\[\]“”"‘’]+/g,"").toLowerCase();
}
function senses(text){
 return String(text||"").split(/[\n\r;,，；、]/).map(normalized).filter(function(x){return x.length>0;});
}
function match(meaning,options){
 var terms=senses(meaning),scores=[];
 for(var i=0;i<options.length;i++){
  var choice=String(options[i]||"");
  var choices=choice.split(/[，,；;、\/]/).map(normalized).filter(function(x){return x.length>0;});
  var best=0;
  for(var a=0;a<choices.length;a++){
   for(var b=0;b<terms.length;b++){
    var o=choices[a],m=terms[b];
    if(o===m){best=Math.max(best,1);continue;}
    if(o.length>=2&&m.length>=2&&(o.indexOf(m)>=0||m.indexOf(o)>=0)){
      var coverage=Math.min(o.length,m.length)/Math.max(o.length,m.length);
      best=Math.max(best,coverage>=0.65?0.88:0.76);
    }
   }
  }
  scores.push(best);
 }
 var ranked=scores.slice().sort(function(a,b){return b-a;});
 var idx=scores.indexOf(ranked[0]);
 return ranked[0]>=0.86&&ranked[0]-ranked[1]>=0.1?idx:-1;
}
function recognize(img,box){
 var r=ocr.mlkit.detect(img,box);
 return r||[];
}
function screenRead(img){
 var w=img.getWidth(),h=img.getHeight();
 var wx=Math.round(.25*w),wy=Math.round(.34*h),ww=Math.round(.5*w),wh=Math.round(.13*h);
 var words=recognize(img,[wx,wy,ww,wh]),word="";
 words.forEach(function(x){var s=String(x.text||"").trim();if(/^[A-Za-z][A-Za-z '-]{0,28}$/.test(s)&&s.length>word.length)word=s.toLowerCase();});
 var opt=recognize(img,[Math.round(.14*w),Math.round(.54*h),Math.round(.72*w),Math.round(.44*h)]);
 var options=["","","",""],centers=[.588,.699,.811,.921];
 opt.forEach(function(r){
    var b=r.bounds;if(!b)return;
    var y=(Number(b.top)+Number(b.bottom))/2/h;
    var best=-1,dist=.048;
    for(var i=0;i<4;i++){var d=Math.abs(y-centers[i]);if(d<dist){dist=d;best=i;}}
    if(best>=0&&/[\u3400-\u9fff]/.test(String(r.text)))options[best]+=r.text;
 });
 return {word:word,options:options,centers:centers,w:w,h:h};
}
function status(t){log(t);if(p)try{p.message.post(function(){p.message.setText(t.slice(0,22));});}catch(e){}}
function ensureAccessibility(){
  for(var attempt=0;attempt<3;attempt++){
    try { auto.waitFor(); return true; }
    catch(e){
      var explain='无障碍服务未正常运行。请打开手机设置→辅助功能→无障碍→极速词汇助手，关闭后重新开启。返回此应用，再尝试启动。';
      log('无障碍状态异常：'+String(e));
      if(!dialogs.confirm('需要无障碍服务',explain+'\n\n点击「确定」打开系统设置，或取消退出。'))return false;
      app.startActivity({action:'android.settings.ACCESSIBILITY_SETTINGS'});
      sleep(1500);
    }
  }
  dialogs.alert('授权未成功','请先在系统设置中重新启用极速词汇助手无障碍服务，然后再打开本软件。');
  return false;
}
if(!ensureAccessibility())exit();
if(!images.requestScreenCapture(false)){toastLog("截图授权失败");exit();}
ocr.mode="mlkit";
try{startupDb();}catch(e){toastLog(String(e));exit();}
p=floaty.window(<horizontal bg="#DD15243A" padding="4"><text id="message" text="准备就绪" textColor="#FFFFFF" w="100" textSize="11sp"/><button id="toggle" text="开始" w="63"/><button id="quit" text="退出" w="63"/></horizontal>);
p.setPosition(0,Math.round(device.height*.13));
p.toggle.click(function(){running=!running;p.toggle.setText(running?"暂停":"开始");});
p.quit.click(function(){alive=false;exit();});
events.on("exit",function(){try{db.close();}catch(e){}try{p.close();}catch(e){}});
var last="",lastAt=0,lastOcrNotice=0;
while(alive){
 if(!running){sleep(120);continue;}
 try{
  if(currentPackage()!=="com.jiongji.andriod.card"){sleep(150);continue;}
  var img=images.captureScreen(),q;
  try{q=screenRead(img);}finally{if(img)img.recycle();}
  if(!q.word||q.options.some(function(s){return !/[\u3400-\u9fff]/.test(s); })){
   if(Date.now()-lastOcrNotice>2500){
    status(!q.word?"OCR未识别到单词":"OCR未读全选项");
    log("OCR原始识别：单词="+q.word+" 选项="+JSON.stringify(q.options));
    lastOcrNotice=Date.now();
   }
   sleep(70);continue;
  }
  var sig=q.word+"|"+q.options.join("|");
  if(sig===last||Date.now()-lastAt<700){sleep(70);continue;}
  var meaning=lookup(q.word),idx=meaning?match(meaning,q.options):-1;
  if(idx<0){
   var reason=meaning?"选项未匹配:":"词库未收录:";
   if(sig!==last||Date.now()-lastAt>2000){
    status(reason+q.word);
    log("识别题目="+q.word+" | 释义="+(meaning||"[词库无此项]")+" | 选项="+JSON.stringify(q.options));
    last=sig;lastAt=Date.now();
   }
   sleep(160);continue;
  }
  if(currentPackage()==="com.jiongji.andriod.card"&&running){
   click(Math.round(q.w*.5),Math.round(q.h*q.centers[idx]));
   last=sig;lastAt=Date.now();status(q.word+" → "+(idx+1));
  }
 }catch(e){log("识别异常:"+e);sleep(300);}
 sleep(70);
}