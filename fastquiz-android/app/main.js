"auto";
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
  toastLog("已加载词典"+count+"条");
}
function lookup(word){
 var c=db.rawQuery("SELECT translation FROM dictionary WHERE word=? LIMIT 1",[word.toLowerCase()]);
 try{return c.moveToFirst()?String(c.getString(0)):"";}finally{c.close();}
}
function normalized(s){return String(s||"").replace(/^(n|v|adj|adv|vt|vi)\\.?\\s*/ig,"").replace(/[\\s，。;；:：、()（）]+/g,"");}
function match(meaning,options){
 var parts=meaning.split(/[;；\\n]/).map(normalized), scores=options.map(function(o){
   o=normalized(o);var best=0;
   parts.forEach(function(m){if(!m||!o)return;
     if(m===o)best=Math.max(best,1);
     else if(m.indexOf(o)>=0&&o.length>1)best=Math.max(best,.9);
     else if(o.indexOf(m)>=0&&m.length>2)best=Math.max(best,.82);
   });return best;
 });
 var idx=scores.indexOf(Math.max.apply(Math,scores)),sorted=scores.slice().sort(function(a,b){return b-a;});
 return sorted[0]>=.8&&sorted[0]-sorted[1]>=.1?idx:-1;
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
    if(best>=0&&/[\\u3400-\\u9fff]/.test(String(r.text)))options[best]+=r.text;
 });
 return {word:word,options:options,centers:centers,w:w,h:h};
}
function status(t){log(t);if(p)try{p.message.post(function(){p.message.setText(t.slice(0,22));});}catch(e){}}
auto.waitFor();
if(!images.requestScreenCapture(false)){toastLog("截图授权失败");exit();}
ocr.mode="mlkit";
try{startupDb();}catch(e){toastLog(String(e));exit();}
p=floaty.window(<horizontal bg="#DD15243A" padding="4"><text id="message" text="准备就绪" textColor="#FFFFFF" w="100" textSize="11sp"/><button id="toggle" text="开始" w="63"/><button id="quit" text="退出" w="63"/></horizontal>);
p.setPosition(0,Math.round(device.height*.13));
p.toggle.click(function(){running=!running;p.toggle.setText(running?"暂停":"开始");});
p.quit.click(function(){alive=false;exit();});
events.on("exit",function(){try{db.close();}catch(e){}try{p.close();}catch(e){}});
var last="",lastAt=0;
while(alive){
 if(!running){sleep(120);continue;}
 try{
  if(currentPackage()!=="com.jiongji.andriod.card"){sleep(150);continue;}
  var img=images.captureScreen(),q;
  try{q=screenRead(img);}finally{if(img)img.recycle();}
  if(!q.word||q.options.some(function(s){return !/[\\u3400-\\u9fff]/.test(s); })){sleep(70);continue;}
  var sig=q.word+"|"+q.options.join("|");
  if(sig===last||Date.now()-lastAt<700){sleep(70);continue;}
  var meaning=lookup(q.word),idx=meaning?match(meaning,q.options):-1;
  if(idx<0){status("无法确定:"+q.word);sleep(160);continue;}
  if(currentPackage()==="com.jiongji.andriod.card"&&running){
   click(Math.round(q.w*.5),Math.round(q.h*q.centers[idx]));
   last=sig;lastAt=Date.now();status(q.word+" → "+(idx+1));
  }
 }catch(e){log("识别异常:"+e);sleep(300);}
 sleep(70);
}