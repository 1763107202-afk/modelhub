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
  .replace(/在那里/g,"那里")
  .replace(/在那儿/g,"那里")
  .replace(/向下的/g,"向下")
  .replace(/往下/g,"向下");
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
     if(coverage>=0.64)best=Math.max(best,0.78+0.19*coverage);
    }
   }
  }
  scores.push(best);
 }
 var ordered=scores.slice().sort(function(a,b){return b-a;});
 var bestIdx=scores.indexOf(ordered[0]);
 return {index:ordered[0]>=0.88&&ordered[0]-(ordered[1]||0)>=(ordered[0]===1?0.07:0.12)?bestIdx:-1,score:ordered[0],scores:scores};
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
   if(similarity<0.72)continue;
   var info=matchInfo(translation,options);
   if(info.index<0||info.score<0.94)continue;
   var item={word:candidate,translation:translation,index:info.index,similarity:similarity,score:info.score};
   if(!best||item.similarity>best.similarity){second=best;best=item;}
   else if(!second||item.similarity>second.similarity)second=item;
  }
 }finally{cur.close();}
 if(best&&second&&best.index!==second.index&&best.similarity-second.similarity<0.1)return null;
 return best;
}
function recognize(img,box){
 return ocr.mlkit.detect(img,box)||[];
}
function isWhite(pixel){
 var r=(pixel>>16)&255,g=(pixel>>8)&255,b=pixel&255;
 return r>=233&&g>=233&&b>=233;
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
   if(height>h*.036&&height<h*.14)runs.push({top:begin,bottom:prev,center:Math.round((begin+prev)/2),height:height});
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
function extractWord(items,w,h,firstTop){
 var word="",quality=-999;
 items.forEach(function(r){
  var str=String(r.text||"").trim().toLowerCase(),b=r.bounds;
  if(!b||!/^[a-z][a-z '-]{1,35}$/.test(str)||str==="vs"||str==="versus")return;
  var cy=(Number(b.top)+Number(b.bottom))/2, cx=(Number(b.left)+Number(b.right))/2;
  if(cy<h*.29||cy>firstTop-h*.055||cx<w*.15||cx>w*.85)return;
  var score=-Math.abs(cy/h-.395)*5+Number(r.confidence||0)*.20+Math.min(str.length,15)*.013;
  if(score>quality){quality=score;word=str;}
 });
 return word.replace(/\s+/g," ").trim();
}
function assignOptions(items,cards){
 var texts=["","","",""];
 items.forEach(function(r){
  if(!r.bounds||!/[一-龥]/.test(String(r.text||"")))return;
  var cy=(Number(r.bounds.top)+Number(r.bounds.bottom))/2;
  for(var i=0;i<4;i++){
   if(cy>=cards[i].top-6&&cy<=cards[i].bottom+6){
    texts[i]+=String(r.text||"");
    return;
   }
  }
 });
 return texts;
}
function fallbackWord(img,w,h){
 var region=[Math.round(w*.10),Math.round(h*.32),Math.round(w*.8),Math.round(h*.19)];
 var crop=null,scaled=null;
 try{
  crop=images.clip(img,region[0],region[1],region[2],region[3]);
  scaled=images.scale(crop,1.6,1.6);
  var rs=recognize(scaled,[0,0,scaled.getWidth(),scaled.getHeight()]);
  for(var k=0;k<rs.length;k++){
   var s=String(rs[k].text||"").toLowerCase().trim();
   if(/^[a-z][a-z '-]{1,30}$/.test(s)&&s!=="vs")return s;
  }
 }catch(e){log("放大识别回退异常:"+e);}
 finally{try{if(scaled)scaled.recycle();}catch(e){}try{if(crop)crop.recycle();}catch(e){}}
 return "";
}
function screenRead(img){
 var w=img.getWidth(),h=img.getHeight();
 var cards=findCards(img,w,h);
 if(!cards)return {word:"",options:["","","",""],centers:[],w:w,h:h,error:"未找到4个白色选项卡"};
 // One combined OCR call covers the English prompt and the four answer cards.
 var top=Math.round(h*.30),bottom=Math.min(h,Math.round(cards[3].bottom+h*.018));
 var rs=recognize(img,[Math.round(w*.10),top,Math.round(w*.80),bottom-top]);
 var word=extractWord(rs,w,h,cards[0].top);
 var options=assignOptions(rs,cards);
 if(!word)word=fallbackWord(img,w,h);
 return {word:word,options:options,centers:cards.map(function(c){return c.center;}),cards:cards,w:w,h:h,error:""};
}
function fillMissingOptions(img,q,maxCount){
 var count=0;
 for(var i=0;i<4&&count<maxCount;i++){
  if(/[一-龥]/.test(q.options[i]))continue;
  count++;
  var c=q.cards[i],x=Math.round(q.w*.17),y=Math.max(0,c.top-4);
  try{
   var rs=recognize(img,[x,y,Math.round(q.w*.66),Math.min(q.h-y,c.height+10)]);
   var arr=rs.filter(function(r){return /[一-龥]/.test(String(r.text||""));});
   q.options[i]=arr.map(function(r){return String(r.text);}).join("");
  }catch(e){log("单卡OCR失败:"+i+" "+e);}
 }
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
var lastFailed="",lastFailedAt=0,lastNotice=0,pending=null,tapCount=0,ocrTotal=0,ocrCount=0;
while(alive){
 if(!running){sleep(150);continue;}
 try{
  if(currentPackage()!=="com.jiongji.andriod.card"){sleep(160);continue;}
  var captureAt=Date.now();
  var img=images.captureScreen();
  var capTime=Date.now()-captureAt,ocrAt=Date.now(),q;
  try{
   q=screenRead(img);
   if(q.centers.length){
    var n=q.options.filter(function(s){return /[一-龥]/.test(s);}).length;
    if(q.word&&n<3)fillMissingOptions(img,q,2);
   }
  }finally{if(img)img.recycle();}
  var ocrMs=Date.now()-ocrAt;
  ocrTotal+=ocrMs;ocrCount++;
  if(!q.centers.length){
   if(Date.now()-lastNotice>2900){status("等待题目选项");log(q.error);lastNotice=Date.now();}
   sleep(150);continue;
  }
  var present=q.options.filter(function(s){return /[一-龥]/.test(s);}).length;
  if(!q.word||present<2){
   if(Date.now()-lastNotice>2500){status(!q.word?"英文单词OCR未识别":"选项OCR不足");log("OCR调试：词="+q.word+" 选项="+JSON.stringify(q.options)+" 选项中心="+q.centers+" 截屏"+capTime+"ms OCR"+ocrMs+"ms");lastNotice=Date.now();}
   sleep(95);continue;
  }
  var signature=q.word+"|"+q.options.join("|");
  if(pending){
    if(q.word!==pending.word&&present>=2){
      log("检测到新单词: "+q.word+"，上题："+pending.word);
      pending=null;
    }else{
      if(Date.now()-pending.at>3000&& !pending.warning){
        pending.warning=true;
        status("触控后题目未变化");
        log("单题仅点击一次，不重复误触："+pending.word+" → "+pending.index+"；待下一题。");
      }
      sleep(130);continue;
    }
  }
  if(signature===lastFailed&&Date.now()-lastFailedAt<2300){sleep(140);continue;}
  var meaning=lookup(q.word),info=meaning?matchInfo(meaning,q.options):{index:-1,score:0,scores:[]};
  var idx=info.index,corrected=null;
  if(idx<0&&q.word.length>=7&&present>=3){
   corrected=findNearWord(q.word,q.options);
   if(corrected){idx=corrected.index;meaning=corrected.translation;log("OCR拼写纠错："+q.word+" → "+corrected.word);}
  }
  if(idx<0){
   if(Date.now()-lastNotice>1800){
     status(meaning?"释义不能确定："+q.word:"词库没查到："+q.word);
     log("词="+q.word+" 释义="+(meaning||"[无]")+" 选项="+JSON.stringify(q.options)+" 匹配分="+JSON.stringify(info.scores)+" 截屏"+capTime+"ms OCR"+ocrMs+"ms");
     lastNotice=Date.now();
   }
   lastFailed=signature;lastFailedAt=Date.now();
   sleep(115);continue;
  }
  if(!/[一-龥]/.test(q.options[idx])){sleep(90);continue;}
  if(currentPackage()!=="com.jiongji.andriod.card"||!running)continue;
  var tx=Math.round(q.w*.5),ty=q.centers[idx],sendAt=Date.now();
  var accepted=press(tx,ty,55);
  if(!accepted)accepted=click(tx,ty);
  tapCount++;
  log("尝试点击: "+q.word+" 第"+(idx+1)+"项 ("+tx+","+ty+")；手势返回="+accepted+"；OCR="+ocrMs+"ms，匹配分="+info.score);
  status(q.word+" → 选项"+(idx+1));
  pending={word:q.word,signature:signature,index:idx+1,at:Date.now(),warning:false};
  if(tapCount%5===0){log("平均OCR耗时："+Math.round(ocrTotal/Math.max(1,ocrCount))+"ms/帧；点击尝试数="+tapCount);}
  sleep(175);
 }catch(e){log("运行异常："+e);sleep(400);}
}
