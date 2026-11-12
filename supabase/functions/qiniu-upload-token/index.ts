import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });
}

function utf8Base64Url(input: string | Uint8Array) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_");
}

async function hmacSha1Base64Url(message: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
  return utf8Base64Url(sig);
}

function safeName(name: string) {
  const ext = (name.match(/\.[^.]+$/)?.[0] || "").toLowerCase();
  const base = name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9\u4e00-\u9fff._-]+/g, "_").slice(0, 80);
  return (base || "file") + ext;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "请先登录" }, 401);

    const pub = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      pub.default || Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: "登录状态无效" }, 401);

    const { data: profile, error: profileError } = await supabase
      .from("profiles").select("role,membership_status,progress_exempt").eq("id",user.id).maybeSingle();
    if (profileError || !profile) return json({error:"无法校验成员权限"},403);
    const { fileName, category = "submission", fileSize = 0, resumeKey = "" } = await req.json();
    if (!fileName || typeof fileName !== "string" || fileName.length > 180)
      return json({error:"文件名无效"},400);
    const ext=(fileName.match(/\.[^.]+$/)?.[0] || "").toLowerCase();
    const archives=[".zip",".rar",".7z"];
    const videos=[".mp4",".mov",".webm",".m4v",".avi",".mkv",".ogg"];
    const docs=[".pdf",".doc",".docx",".ppt",".pptx",".xls",".xlsx",".csv",".txt"];
    const images=[".jpg",".jpeg",".png",".gif",".webp"];
    const types={
      "submission":{prefix:"submissions",who:"member",extensions:archives},
      "progress":{prefix:"progress",who:"formal",extensions:[...archives,...videos,...docs,...images]},
      "team-progress":{prefix:"team-progress",who:"formal",extensions:[...archives,...videos,...docs,...images]},
      "admin-tutorial":{prefix:"tutorials",who:"admin",extensions:[...archives,...videos,...docs]},
      "admin-resource":{prefix:"resources",who:"admin",extensions:[...archives,...videos,...docs,...images]},
      "admin-share":{prefix:"shares",who:"admin",extensions:[...archives,...videos,...docs,...images]},
      "admin-exam":{prefix:"exams",who:"admin",extensions:[...archives,...videos,...docs,...images]},
      "admin-image":{prefix:"images",who:"admin",extensions:images},
      "admin-work":{prefix:"works",who:"admin",extensions:images},
      "video":{prefix:"videos",who:"admin",extensions:videos},
      "archive":{prefix:"archives",who:"admin",extensions:archives}
    } as Record<string,{prefix:string,who:string,extensions:string[]}>;
    const selected=types[String(category)];
    if(!selected)return json({error:"不支持的上传业务类型"},400);
    const admin=["admin","super_admin"].includes(profile.role||"") || profile.progress_exempt===true;
    const formal=admin || profile.membership_status!=="freshman";
    if(selected.who==="admin"&&!admin)return json({error:"只有管理员可发布这类资料"},403);
    if(selected.who==="formal"&&!formal)return json({error:"大一新生阶段暂不开放进度上传"},403);
    if(!selected.extensions.includes(ext))return json({error:"该业务不支持此文件格式"},400);
    const bytes=Number(fileSize);
    const categoryMax:Record<string,number>={
      submission:1024*1024*1024,
      progress:60*1024*1024,"team-progress":60*1024*1024,
      "admin-tutorial":200*1024*1024,
      "admin-resource":100*1024*1024,
      "admin-share":100*1024*1024,
      "admin-exam":100*1024*1024,
      "admin-image":10*1024*1024,
      "admin-work":15*1024*1024,
      video:200*1024*1024,archive:150*1024*1024
    };
    const max=categoryMax[String(category)]??20*1024*1024;
    if(!Number.isSafeInteger(bytes)||bytes<=0||bytes>max)return json({error:"超过该业务文件大小上限（"+Math.round(max/1048576)+"MB）"},400);
    if((selected.who==="admin"&&selected.prefix==="images")||selected.prefix==="works"){
      if(bytes>30*1024*1024)return json({error:"图片不能超过 30MB"},400);
    }
    const ak = (Deno.env.get("QINIU_ACCESS_KEY")||"").trim();
    const sk = (Deno.env.get("QINIU_SECRET_KEY")||"").trim();
    const bucket = (Deno.env.get("QINIU_BUCKET")||"").trim();
    const domain = (Deno.env.get("QINIU_DOMAIN") || "").replace(/\/$/, "");
    if (!ak || !sk || !bucket) return json({ error: "七牛云环境变量未配置完整" }, 500);

    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    const isResume=Boolean(resumeKey);
    if(isResume && (
      String(category)!=="submission" ||
      typeof resumeKey!=="string" ||
      resumeKey.length>450 ||
      !/^submissions\/[0-9a-f-]{36}\/\d{4}\/\d{2}\/\d{13}-[0-9a-f]{8}-[^/]+$/i.test(resumeKey) ||
      !resumeKey.startsWith("submissions/"+user.id+"/") ||
      !resumeKey.endsWith("-"+safeName(fileName))
    )) return json({error:"续传凭证无效，请重新选择文件上传"},400);
    const key = isResume ? resumeKey : `${selected.prefix}/${user.id}/${y}/${m}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName(fileName)}`;

    const policy = {
      scope: `${bucket}:${key}`,
      deadline: Math.floor(Date.now() / 1000) + 3600,
      insertOnly: 1,
      fsizeLimit: bytes,
      returnBody: '{"key":"$(key)","hash":"$(etag)","size":$(fsize),"mimeType":"$(mimeType)"}',
    };

    const encodedPolicy = utf8Base64Url(JSON.stringify(policy));
    const encodedSign = await hmacSha1Base64Url(encodedPolicy, sk);
    const token = `${ak}:${encodedSign}:${encodedPolicy}`;

    return json({
      token,
      key,
      uploadUrl: "https://upload.qiniup.com",
      publicUrl: domain ? `${domain}/${key.split("/").map(encodeURIComponent).join("/")}` : null,
      expiresIn: 3600,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "生成上传凭证失败" }, 500);
  }
});