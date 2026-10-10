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
 return ocr.mlkit.detect(img,box)||[];
}
function isWhite(pixel){
 var r=(pixel>>16)&255,g=(pixel>>8)&255,b=pixel&255;
 return r>=234&&g>=234&&b>=234;
}
function detectCardCenters(w,h,sample){
 var x1=Math.round(w*.20),x2=Math.round(w*.80);
 var step=Math.max(3,Math.round(h*.003)),lo=Math.round(h*.48),hi=Math.round(h*.985);
 var runs=[],begin=-1,prev=-1;
 for(var y=lo;y<=hi+step;y+=step){
  var yes=y<=hi&&isWhite(sample(x1,y))&&isWhite(sample(x2,y));
  if(yes){if(begin<0)begin=y;prev=y;}
  else if(begin>=0){
   var height=prev-begin+step;
   if(height>h*.038&&height<h*.15)runs.push({top:begin,bottom:prev,center:Math.round((begin+prev)/2),height:height});
   begin=-1;
  }
 }
 if(runs.length!==4)return null;
 for(var i=1;i<4;i++)if(runs[i].center-runs[i-1].center<h*.055)return null;
 return runs;
}
var cachedCards=null;
function findCards(img,w,h){
 if(cachedCards&&cachedCards.length===4&&cachedCards.every(function(c){
  return isWhite(images.pixel(img,Math.round(w*.20),c.center))&&isWhite(images.pixel(img,Math.round(w*.80),c.center));
 }))return cachedCards;
 cachedCards=detectCardCenters(w,h,function(x,y){return images.pixel(img,x,y);});
 return cachedCards;
}
function pickWord(items,h){
 var best="",quality=-1;
 items.forEach(function(r){
  var text=String(r.text||"").trim().toLowerCase(),rect=r.bounds;
  if(!/^[a-z][a-z '-]{1,36}$/.test(text)||text==="vs"||text==="versus"||!rect)return;
  var center=(Number(rect.top)+Number(rect.bottom))/2;
  var score=-Math.abs(center/h-.40)*8+Math.min(30,text.length)*.013+Number(r.confidence||0)*.08;
  if(score>quality){quality=score;best=text;}
 });
 return best.replace(/\s+/g," ").trim();
}
function readWord(img,w,h){
 var region=[Math.round(w*.09),Math.round(h*.29),Math.round(w*.82),Math.round(h*.25)];
 var word=pickWord(recognize(img,region),h);
 if(word)return word;
 try{
  var cut=images.clip(img,region[0],region[1],region[2],region[3]);
  var scaled=null;
  try{
   scaled=images.scale(cut,2,2);
   var res=recognize(scaled,[0,0,scaled.getWidth(),scaled.getHeight()]);
   word=pickWord(res,scaled.getHeight());
   if(!word){
    for(var i=0;i<res.length;i++){
     var t=String(res[i].text||"").trim().toLowerCase();
     if(/^[a-z][a-z-]{1,30}$/.test(t)&&t!=="vs"){word=t;break;}
    }
   }
  }finally{if(scaled)scaled.recycle();if(cut)cut.recycle();}
 }catch(e){log("英文OCR放大后备失败:"+e);}
 return word;
}
function screenRead(img){
 var w=img.getWidth(),h=img.getHeight();
 var cards=findCards(img,w,h);
 if(!cards)return {word:"",options:["","","",""],centers:[],w:w,h:h,error:"未找到4个白色选项卡片"};
 var word=readWord(img,w,h);
 var options=["","","",""],ys=cards.map(function(x){return x.center;});
 var opt=recognize(img,[Math.round(w*.12),Math.round(h*.47),Math.round(w*.76),Math.round(h*.51)]);
 opt.forEach(function(r){
  if(!r.bounds||!/[一-龥]/.test(String(r.text||"")))return;
  var cy=(Number(r.bounds.top)+Number(r.bounds.bottom))/2,best=-1,diff=h*.055;
  for(var i=0;i<4;i++){
   var gap=Math.abs(cy-ys[i]);if(gap<diff){diff=gap;best=i;}
  }
  if(best>=0)options[best]+=String(r.text||"");
 });
 for(var i=0;i<4;i++){
  if(!options[i]){
   var top=Math.max(0,Math.round(cards[i].top-3)),height=Math.min(h-top,Math.round(cards[i].height+6));
   var parts=recognize(img,[Math.round(w*.16),top,Math.round(w*.68),height]);
   var lines=[];
   parts.forEach(function(x){if(/[一-龥]/.test(String(x.text||"")))lines.push(String(x.text));});
   options[i]=lines.join("");
  }
 }
 return {word:word,options:options,centers:ys,w:w,h:h,error:""};
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
var last="",lastAt=0,lastOcrNotice=0,pending=null;
while(alive){
 if(!running){sleep(120);continue;}
 try{
  if(currentPackage()!=="com.jiongji.andriod.card"){sleep(140);continue;}
  var img=images.captureScreen(),q;
  try{q=screenRead(img);}finally{if(img)img.recycle();}
  if(!q.centers.length){
   if(Date.now()-lastOcrNotice>2500){status("等待答题界面");log(q.error);lastOcrNotice=Date.now();}
   sleep(130);continue;
  }
  if(!q.word){
   if(Date.now()-lastOcrNotice>2400){status("英文OCR未识别");log("屏幕卡片位置："+q.centers+"；选项="+JSON.stringify(q.options));lastOcrNotice=Date.now();}
   sleep(100);continue;
  }
  var sig=q.word+"|"+q.options.join("|");
  if(pending){
   if(q.word!==pending.word||sig!==pending.sig){
    log("点击后检测到题面发生变化："+pending.word);
    pending=null;
   }else{
    var delta=Date.now()-pending.at;
    if(delta<850){sleep(100);continue;}
    if(pending.tries===1&&delta>1000&&delta<2900){
     var retry=press(pending.x,pending.y,90);
     pending.tries=2;pending.at=Date.now();
     log("题目未变化，再发送一次触控："+pending.word+" 返回="+retry);
     sleep(120);continue;
    }
    if(delta>1600&&pending.tries>=2){
     if(delta<2200)log("已重试触控但题面仍未变化，请检查卡片坐标或应用限制："+pending.word);
     pending=null;last=sig;lastAt=Date.now();
    }else{sleep(100);continue;}
   }
  }
  var nonempty=q.options.filter(function(s){return /[一-龥]/.test(s);}).length;
  if(nonempty<2){
   if(Date.now()-lastOcrNotice>2500){status("选项OCR不完整");log("单词="+q.word+"，选项="+JSON.stringify(q.options)+"，卡片中心="+q.centers);lastOcrNotice=Date.now();}
   sleep(90);continue;
  }
  if(sig===last&&Date.now()-lastAt<1800){sleep(110);continue;}
  var meaning=lookup(q.word),idx=meaning?match(meaning,q.options):-1;
  var corrected=null;
  if(idx<0&&q.word.length>=7){
   corrected=findNearWord(q.word,q.options);
   if(corrected){idx=corrected.index;meaning=corrected.translation;log("英文OCR纠错："+q.word+" → "+corrected.word);}
  }
  if(idx<0){
   if(sig!==last||Date.now()-lastAt>4500){
    status(meaning?"释义未匹配："+q.word:"词库无此词："+q.word);
    log("词="+q.word+"；释义="+(meaning||"[无]")+"；选项="+JSON.stringify(q.options)+"；卡片中心="+q.centers);
    last=sig;lastAt=Date.now();
   }
   sleep(100);continue;
  }
  if(currentPackage()!=="com.jiongji.andriod.card"||!running)continue;
  var x=Math.round(q.w*.5),y=q.centers[idx];
  var did=press(x,y,65);
  if(!did)did=click(x,y);
  log("发送点击："+(corrected?corrected.word:q.word)+" 第"+(idx+1)+"项 @("+x+","+y+") 手势返回="+did+" 可读选项数="+nonempty);
  status((corrected?corrected.word:q.word)+" 点击第"+(idx+1)+"项");
  pending={word:q.word,sig:sig,x:x,y:y,at:Date.now(),tries:1};
  last=sig;lastAt=Date.now();
 }catch(e){log("运行异常："+e);sleep(300);}
 sleep(90);
}