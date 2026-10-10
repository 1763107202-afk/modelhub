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
 var v=String(s||"").toLowerCase()
  .replace(/^\s*(?:n|v|a|adj|adv|vt|vi|prep|pron|conj|int|art|num)\.\s*/i,"")
  .replace(/\[[^\]]+\]/g,"")
  .replace(/外祖父或外祖母/g,"外祖父母")
  .replace(/祖父(?:或者|或)祖母/g,"祖父母")
  .replace(/哪一个/g,"哪个")
  .replace(/那一个/g,"那个")
  .replace(/那几个/g,"那些");
 return v.replace(/[\s，。;；:：、()（）\[\]“”"‘’—\-]+/g,"");
}
function senses(text){
 return String(text||"").split(/[\n\r;,，；、]/).map(normalized).filter(function(x){return x.length>0;});
}
function matchInfo(meaning,options){
 var terms=senses(meaning),scores=[];
 for(var i=0;i<options.length;i++){
  var chunks=String(options[i]||"").split(/[，,；;、\/]/).map(normalized).filter(function(x){return x.length>0;});
  var best=0;
  for(var a=0;a<chunks.length;a++){
   for(var b=0;b<terms.length;b++){
    var o=chunks[a],m=terms[b];
    if(o===m){best=1;continue;}
    if(o.length>=2&&m.length>=2&&(o.indexOf(m)>=0||m.indexOf(o)>=0)){
     var coverage=Math.min(o.length,m.length)/Math.max(o.length,m.length);
     if(coverage>=0.65)best=Math.max(best,0.78+0.15*coverage);
    }
   }
  }
  scores.push(best);
 }
 var ordered=scores.slice().sort(function(a,b){return b-a;});
 var bestIdx=scores.indexOf(ordered[0]);
 return {index:ordered[0]>=0.87&&ordered[0]-(ordered[1]||0)>=0.1?bestIdx:-1,score:ordered[0],scores:scores};
}
function match(meaning,options){return matchInfo(meaning,options).index;}
function editDistance(a,b){
 a=String(a||"");b=String(b||"");
 var dp=[],i,j,next;
 for(j=0;j<=b.length;j++)dp[j]=j;
 for(i=1;i<=a.length;i++){
  next=[i];
  for(j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,dp[j]+1,dp[j-1]+(a.charAt(i-1)===b.charAt(j-1)?0:1));
  dp=next;
 }
 return dp[b.length];
}
function findNearWord(word,options){
 if(word.length<7)return null;
 var key=word.substring(0,Math.min(6,word.length-2));
 var cur=db.rawQuery("SELECT word, translation FROM dictionary WHERE word LIKE ? LIMIT 45",["%"+key+"%"]);
 var best=null,second=null;
 try{
  while(cur.moveToNext()){
   var candidate=String(cur.getString(0)),translation=String(cur.getString(1));
   var similarity=1-editDistance(word,candidate)/Math.max(word.length,candidate.length);
   if(similarity<0.70)continue;
   var info=matchInfo(translation,options);
   if(info.index<0||info.score<0.91)continue;
   var item={word:candidate,translation:translation,index:info.index,similarity:similarity,score:info.score};
   if(!best||item.similarity>best.similarity){second=best;best=item;}
   else if(!second||item.similarity>second.similarity)second=item;
  }
 }finally{cur.close();}
 if(best&&second&&best.index!==second.index&&best.similarity-second.similarity<0.09)return null;
 return best;
}
function recognize(img,box){
 var r=ocr.mlkit.detect(img,box);
 return r||[];
}
function screenRead(img){
 var w=img.getWidth(),h=img.getHeight();
 var wx=Math.round(.08*w),wy=Math.round(.34*h),ww=Math.round(.84*w),wh=Math.round(.15*h);
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
  var corrected=null;
  if(idx<0 && q.word.length>=7){
   corrected=findNearWord(q.word,q.options);
   if(corrected){idx=corrected.index;meaning=corrected.translation;log("OCR纠错:"+q.word+" → "+corrected.word+" | 拼写相似度="+corrected.similarity);}
  }
  if(idx<0){
   var reason=meaning?"释义和选项不一致:":"词典没有识别词:";
   if(sig!==last||Date.now()-lastAt>4500){
    status(reason+q.word);
    log("识别题目="+q.word+" | 释义="+(meaning||"[无]")+" | 选项="+JSON.stringify(q.options));
    last=sig;lastAt=Date.now();
   }
   sleep(130);continue;
  }
  if(currentPackage()==="com.jiongji.andriod.card"&&running){
   click(Math.round(q.w*.5),Math.round(q.h*q.centers[idx]));
   last=sig;lastAt=Date.now();status((corrected?corrected.word:q.word)+" → "+(idx+1));
  }
 }catch(e){log("识别异常:"+e);sleep(300);}
 sleep(70);
}