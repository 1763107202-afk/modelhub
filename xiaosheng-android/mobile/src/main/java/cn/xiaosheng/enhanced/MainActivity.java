package cn.xiaosheng.enhanced;

import android.app.*;
import android.content.*;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import androidx.webkit.WebViewAssetLoader;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.*;
import java.util.concurrent.*;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
import org.json.*;

public final class MainActivity extends Activity {
 private final ExecutorService worker=Executors.newFixedThreadPool(2);
 private WebView web;
 private ValueCallback<Uri[]> filePicker;
 private final String[] names={"小王","木马","魔女","薇薇","港姐"};
 private final String[] ids={"lead_wang_xiaomiao","lead_muma","lead_monv","lead_vivi","lead_gangjie"};
 private final String[] voiceDefaults={"longhua_v3","longyingling_v3","longyingjing_v3","longanwen_v3","longanqin_v3"};
 private final String[] souls={
 "甜美俏皮、略微傲娇，嘴硬心软，喜欢亲切打趣但不会无条件顺从",
 "慢热细腻、温柔治愈，认真记得小约定，拥有自己的主见",
 "高冷御姐、成熟独立，说话干练，会吐槽但也会温柔关心",
 "知性温润、温和率直，重视沟通、平等和被认真倾听",
 "明媚自信、开朗大方，爱发现有趣的事，直接表达但不强迫别人"
 };
 private static final int FILE_PICK=601;

 @Override public void onCreate(Bundle b){super.onCreate(b);
  getWindow().setStatusBarColor(Color.rgb(16,26,36));
  FrameLayout root=new FrameLayout(this);
  web=new WebView(this);
  root.addView(web,new FrameLayout.LayoutParams(-1,-1));
  TextView gear=new TextView(this);
  gear.setText("⚙ AI");gear.setGravity(Gravity.CENTER);gear.setTextColor(Color.WHITE);
  android.graphics.drawable.GradientDrawable shape=new android.graphics.drawable.GradientDrawable();
  shape.setColor(Color.rgb(26,89,76));shape.setCornerRadius(28);
  gear.setBackground(shape);
  FrameLayout.LayoutParams lp=new FrameLayout.LayoutParams(px(62),px(39),Gravity.TOP|Gravity.RIGHT);
  lp.setMargins(0,px(28),px(9),0);root.addView(gear,lp);
  gear.setOnClickListener(v->settingsDialog());
  setContentView(root);
  WebViewAssetLoader assets=new WebViewAssetLoader.Builder()
   .addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
  WebSettings settings=web.getSettings();
  settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
  settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);
  settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  settings.setMediaPlaybackRequiresUserGesture(true);
  web.addJavascriptInterface(new Bridge(),"PhoneAI");
  web.setWebViewClient(new WebViewClient(){
   @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){
    return assets.shouldInterceptRequest(r.getUrl());
   }
   @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){
    Uri u=r.getUrl();
    if(u.getHost()!=null&&u.getHost().equals("appassets.androidplatform.net")&&u.getPath()!=null&&u.getPath().startsWith("/assets/"))return false;
    if("https".equals(u.getScheme()))try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception ignored){}
    return true;
   }
  });
  web.setWebChromeClient(new WebChromeClient(){
   @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> callback,FileChooserParams params){
    if(filePicker!=null)filePicker.onReceiveValue(null);filePicker=callback;
    try{startActivityForResult(params.createIntent(),FILE_PICK);return true;}
    catch(Exception e){filePicker=null;return false;}
   }
  });
  web.loadUrl("https://appassets.androidplatform.net/assets/index.html");
 }
 private int px(int n){return (int)(getResources().getDisplayMetrics().density*n+.5f);}
 @Override protected void onActivityResult(int request,int result,Intent intent){super.onActivityResult(request,result,intent);
  if(request==FILE_PICK&&filePicker!=null){filePicker.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,intent));filePicker=null;}
 }
 @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else new AlertDialog.Builder(this).setMessage("退出小圣的手机？").setPositiveButton("退出",(d,w)->finish()).setNegativeButton("取消",null).show();}
 @Override protected void onDestroy(){worker.shutdownNow();web.destroy();super.onDestroy();}
 private SharedPreferences pref(){return getPreferences(MODE_PRIVATE);}
 private SecretKey cryptKey() throws Exception{
  KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
  String alias="xiaosheng-api-key-v1";
  if(!store.containsAlias(alias)){
   KeyGenerator gen=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
   gen.init(new KeyGenParameterSpec.Builder(alias,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
     .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());gen.generateKey();
  }
  return ((KeyStore.SecretKeyEntry)store.getEntry(alias,null)).getSecretKey();
 }
 private void saveKey(String name,String key){try{
  Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,cryptKey());
  byte[] iv=c.getIV(),out=c.doFinal(key.getBytes(StandardCharsets.UTF_8)),both=new byte[iv.length+out.length];
  System.arraycopy(iv,0,both,0,iv.length);System.arraycopy(out,0,both,iv.length,out.length);
  pref().edit().putString(name,Base64.encodeToString(both,Base64.NO_WRAP)).apply();
 }catch(Exception e){Toast.makeText(this,"安全保存失败",Toast.LENGTH_SHORT).show();}}
 private String loadKey(String name){try{
  String value=pref().getString(name,"");if(value.isEmpty())return "";
  byte[] both=Base64.decode(value,Base64.DEFAULT);Cipher c=Cipher.getInstance("AES/GCM/NoPadding");
  c.init(Cipher.DECRYPT_MODE,cryptKey(),new GCMParameterSpec(128,Arrays.copyOfRange(both,0,12)));
  return new String(c.doFinal(both,12,both.length-12),StandardCharsets.UTF_8);
 }catch(Exception e){return "";}}
 private EditText input(LinearLayout col,String title,String value,boolean secret){
  TextView label=new TextView(this);label.setText(title);label.setPadding(0,px(13),0,0);col.addView(label);
  EditText e=new EditText(this);e.setSingleLine(true);e.setText(value);
  if(secret)e.setInputType(129);col.addView(e);return e;
 }
 private void settingsDialog(){runOnUiThread(()->{
  ScrollView scroll=new ScrollView(this);LinearLayout col=new LinearLayout(this);
  col.setOrientation(LinearLayout.VERTICAL);col.setPadding(px(18),px(12),px(18),px(10));scroll.addView(col);
  TextView notice=new TextView(this);
  notice.setText("仅在此手机本地保存密钥（Android Keystore 加密）。API 调用会产生费用；不自动向其他人分享。\n您填写的钥匙不会打包进APK，也不会写入GitHub。");
  col.addView(notice);
  EditText deep=input(col,"DeepSeek API Key",loadKey("deep"),true);
  EditText ali=input(col,"阿里云百炼 API Key（北京）",loadKey("ali"),true);
  EditText space=input(col,"北京地域业务空间 ID",pref().getString("space",""),false);
  EditText model=input(col,"DeepSeek 模型",pref().getString("model","deepseek-flash"),false);
  String[] modes={"文字回复","文字 + 可选语音","语音优先"};
  Spinner mode=new Spinner(this);mode.setAdapter(new ArrayAdapter<String>(this,android.R.layout.simple_spinner_dropdown_item,modes));col.addView(mode);
  mode.setSelection(pref().getInt("mode",1));
  EditText[] voice=new EditText[5];
  for(int i=0;i<5;i++)voice[i]=input(col,names[i]+"音色 ID",pref().getString("voice"+i,voiceDefaults[i]),false);
  new AlertDialog.Builder(this).setTitle("小圣手机 · AI 配置").setView(scroll)
   .setNegativeButton("取消",null).setPositiveButton("保存",(d,w)->{
    saveKey("deep",deep.getText().toString().trim());saveKey("ali",ali.getText().toString().trim());
    SharedPreferences.Editor e=pref().edit().putString("space",space.getText().toString().trim())
       .putString("model",model.getText().toString().trim()).putInt("mode",mode.getSelectedItemPosition());
    for(int i=0;i<5;i++)e.putString("voice"+i,voice[i].getText().toString().trim());
    e.apply();Toast.makeText(this,"AI配置已保存",Toast.LENGTH_SHORT).show();
   }).show();
 });}
 private int person(String id){for(int i=0;i<ids.length;i++)if(ids[i].equals(id))return i;return -1;}
 private static byte[] read(InputStream stream,int max)throws IOException{
  try(InputStream in=stream;ByteArrayOutputStream out=new ByteArrayOutputStream()){
   byte[] buf=new byte[8192];int n;while((n=in.read(buf))!=-1){if(out.size()+n>max)throw new IOException("返回体过大");out.write(buf,0,n);}return out.toByteArray();}
 }
 private JSONObject post(String endpoint,String key,JSONObject body)throws Exception{
  HttpsURLConnection c=(HttpsURLConnection)new URL(endpoint).openConnection();
  c.setRequestMethod("POST");c.setDoOutput(true);c.setConnectTimeout(12000);c.setReadTimeout(40000);
  c.setRequestProperty("Content-Type","application/json");c.setRequestProperty("Authorization","Bearer "+key);
  try(OutputStream out=c.getOutputStream()){out.write(body.toString().getBytes(StandardCharsets.UTF_8));}
  int status=c.getResponseCode();if(status!=200){c.disconnect();throw new IOException("API HTTP "+status);}
  JSONObject result=new JSONObject(new String(read(c.getInputStream(),1048576),StandardCharsets.UTF_8));c.disconnect();return result;
 }
 private JSONObject chat(JSONObject req)throws Exception{
  int idx=person(req.optString("characterId"));if(idx<0)throw new IOException("未知角色");
  String key=loadKey("deep");if(key.isEmpty())throw new IOException("请在 AI 设置填写 DeepSeek 密钥");
  JSONArray messages=new JSONArray();
  messages.put(new JSONObject().put("role","system").put("content",
   "你扮演虚构模拟手机中的成年游戏女主"+names[idx]+"。人物性格："+souls[idx]+"。你不是现实真人，不编造真实隐私。不代替用户发言。用自然微信口吻每次回复1到3个短句，先回应最新内容。禁止引导付费或虚构真实见面。玩家要求停止暧昧时要尊重。"));
  JSONArray input=req.optJSONArray("messages");
  if(input==null||input.length()==0)throw new IOException("聊天内容为空");
  for(int j=Math.max(0,input.length()-15);j<input.length();j++){
   JSONObject m=input.optJSONObject(j);if(m==null)continue;
   String role=m.optString("role"),content=m.optString("content");
   if((role.equals("user")||role.equals("assistant"))&&!content.isEmpty())
     messages.put(new JSONObject().put("role",role).put("content",content.substring(0,Math.min(1000,content.length()))));
  }
  if(messages.length()<2||!messages.getJSONObject(messages.length()-1).optString("role").equals("user"))throw new IOException("末条消息不是玩家输入");
  String model=pref().getString("model","deepseek-flash");
  if(!model.matches("[a-zA-Z0-9._-]{3,64}"))throw new IOException("模型名无效");
  JSONObject payload=new JSONObject().put("model",model).put("messages",messages).put("max_tokens",240).put("stream",false)
   .put("thinking",new JSONObject().put("type","disabled"));
  String reply=post("https://api.deepseek.com/chat/completions",key,payload)
    .getJSONArray("choices").getJSONObject(0).getJSONObject("message").optString("content");
  if(reply.isEmpty())throw new IOException("模型未返回文字");
  return new JSONObject().put("reply",reply.substring(0,Math.min(1000,reply.length())));
 }
 private JSONObject tts(JSONObject req)throws Exception{
  int idx=person(req.optString("characterId"));if(idx<0)throw new IOException("未知角色");
  String key=loadKey("ali");if(key.isEmpty())throw new IOException("请填写阿里云密钥");
  String space=pref().getString("space","");if(!space.matches("[A-Za-z0-9_-]{5,100}"))throw new IOException("请填写正确的北京业务空间 ID");
  String voice=pref().getString("voice"+idx,voiceDefaults[idx]);if(!voice.matches("[A-Za-z0-9_-]{3,128}"))throw new IOException("音色 ID 无效");
  String text=req.optString("text");text=text.substring(0,Math.min(240,text.length()));
  if(text.trim().isEmpty())throw new IOException("没有需要合成的文字");
  JSONObject payload=new JSONObject().put("model","cosyvoice-v3-flash")
    .put("input",new JSONObject().put("text",text).put("voice",voice).put("format","mp3").put("sample_rate",24000));
  JSONObject result=post("https://"+space+".cn-beijing.maas.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer",key,payload);
  String audioUrl=result.getJSONObject("output").getJSONObject("audio").getString("url");
  URL url=new URL(audioUrl);String host=url.getHost().toLowerCase(Locale.ROOT);
  if(!url.getProtocol().equals("https")||!(host.endsWith(".aliyuncs.com")||host.endsWith(".aliyun.com")||host.endsWith(".alicdn.com")))
    throw new IOException("音频地址不在信任范围");
  HttpsURLConnection stream=(HttpsURLConnection)url.openConnection();stream.setConnectTimeout(10000);stream.setReadTimeout(35000);
  stream.setInstanceFollowRedirects(false);
  if(stream.getResponseCode()!=200){stream.disconnect();throw new IOException("语音下载失败");}
  byte[] bytes=read(stream.getInputStream(),3*1024*1024);stream.disconnect();
  return new JSONObject().put("audio",Base64.encodeToString(bytes,Base64.NO_WRAP)).put("mime","audio/mpeg");
 }
 private void invoke(String operation,String json,String callId){
  worker.execute(()->{
   JSONObject out;try{
    JSONObject request=new JSONObject(json);
    out=operation.equals("chat")?chat(request):tts(request);
    out.put("ok",true);
   }catch(Exception e){
    out=new JSONObject();try{out.put("ok",false).put("error",e.getMessage()==null?"请求失败":e.getMessage());}catch(Exception ignored){}
   }
   String callback="window.XiaoBridge&&window.XiaoBridge.finish("+JSONObject.quote(callId)+","+JSONObject.quote(out.toString())+")";
   runOnUiThread(()->{if(web!=null)web.evaluateJavascript(callback,null);});
  });
 }
 public final class Bridge{
  @JavascriptInterface public void openSettings(){settingsDialog();}
  @JavascriptInterface public void chat(String json,String requestId){if(json.length()<22000&&requestId.length()<100)invoke("chat",json,requestId);}
  @JavascriptInterface public void tts(String json,String requestId){if(json.length()<1000&&requestId.length()<100)invoke("tts",json,requestId);}
  @JavascriptInterface public String mode(){return String.valueOf(pref().getInt("mode",1));}
 }
}