// 新生作业大文件上传：七牛云 JavaScript SDK 3.x 分片、重试和断点续传。
// AccessKey / SecretKey 始终保留在 Supabase Edge Function 中。
const LIMIT = 1024 * 1024 * 1024;
const SDK_SOURCES = [
  "https://cdn.jsdelivr.net/npm/qiniu-js@3.4.4/dist/qiniu.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/qiniu-js/3.4.3/qiniu.min.js"
];
let sdkPromise = null;

function addScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    let done = false;
    const timer = setTimeout(() => finish(new Error("分片组件加载超时")), 14000);
    function finish(error) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      script.onload = script.onerror = null;
      if (error) {
        script.remove();
        reject(error);
      } else resolve();
    }
    script.async = true;
    script.referrerPolicy = "no-referrer";
    script.src = url;
    script.onload = () => finish(globalThis.qiniu?.upload ? null : new Error("上传组件版本无效"));
    script.onerror = () => finish(new Error("分片组件网络加载失败"));
    document.head.appendChild(script);
  });
}

async function loadSdk() {
  if (globalThis.qiniu?.upload) return globalThis.qiniu;
  if (!sdkPromise) {
    sdkPromise = (async () => {
      for (const url of SDK_SOURCES) {
        try {
          await addScript(url);
          if (globalThis.qiniu?.upload) return globalThis.qiniu;
        } catch (error) {
          console.warn("七牛分片 SDK 线路不可用", new URL(url).hostname, error?.message || error);
        }
      }
      throw new Error("分片上传组件加载失败，请检查网络，稍后重新提交。");
    })();
    sdkPromise.catch(() => { sdkPromise = null; });
  }
  return sdkPromise;
}

function resumeStorageKey(userId, file, category) {
  return "modelhub:qiniu-resume:v1:" + encodeURIComponent(
    [userId, category, file.name, file.size, file.lastModified].join("|")
  );
}
function readResume(key) {
  try {
    const entry = JSON.parse(localStorage.getItem(key) || "null");
    if (!entry || typeof entry.key !== "string" || !Number.isFinite(entry.time) ||
        Date.now() - entry.time > 23 * 3600 * 1000 || entry.time > Date.now() + 60000) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.key;
  } catch (_) { return null; }
}
function saveResume(key, objectKey) {
  try { localStorage.setItem(key, JSON.stringify({ key: objectKey, time: Date.now() })); } catch (_) {}
}
function clearResume(key) { try { localStorage.removeItem(key); } catch (_) {} }

async function functionError(error) {
  if (!error) return "无法获取七牛云上传凭证";
  const response = error.context;
  try {
    const body = await response?.clone?.().json();
    if (typeof body?.error === "string" && body.error) return body.error;
    if (typeof body?.message === "string" && body.message) return body.message;
  } catch (_) {}
  if (response?.status === 413) return "文件超过服务器允许的上传大小";
  if (response?.status === 401) return "登录已过期，请重新登录";
  if (response?.status === 403) return "当前账号没有该文件的上传权限";
  return error.message || "生成七牛云上传凭证失败";
}
function sdkError(error) {
  const code = Number(error?.code);
  if (code === 413) return "文件超过七牛云允许的上传大小（最大 1GB）";
  if (code === 401 || code === 612) return "上传会话已过期，请点击提交文件重新获取凭证";
  if (code === 599 || code === 0) return "网络中断，可重新选择同一文件继续上传";
  const serverMessage = typeof error?.data?.error === "string" ? error.data.error : "";
  return serverMessage || (error?.message ? "七牛云分片上传失败：" + error.message : "分片上传失败，请重试");
}

/**
 * @param {File} file
 * @param {string} category
 * @param {(percent:number, details?:{speed:number,eta:number,resumed:boolean})=>void} onProgress
 * @param {object} supabase
 * @param {(active:boolean)=>void} setUploadActive
 * @param {(key:string)=>string} publicUrlFromKey
 */
export async function uploadQiniuMultipart(file, category, onProgress, supabase, setUploadActive, publicUrlFromKey) {
  if (category !== "submission") throw new Error("仅支持新生作业分片上传");
  if (!file || !Number.isSafeInteger(file.size) || file.size < 1 || file.size > LIMIT)
    throw new Error("请选择非空的 ZIP / RAR / 7Z 文件，单文件不得超过 1GB");
  if (!/\.(zip|rar|7z)$/i.test(file.name)) throw new Error("只允许 ZIP / RAR / 7Z 压缩包");

  // SDK 在浏览器本地保留分片记录；同一文件重新选择后，后端安全地重签同一 key。
  const sdk = await loadSdk();
  const session = await supabase.auth.getSession();
  const user = session.data?.session?.user;
  if (!session.data?.session?.access_token || !user?.id)
    throw new Error("登录状态已失效，请重新登录后再上传");

  const localKey = resumeStorageKey(user.id, file, category);
  const resumeKey = readResume(localKey);
  let request = await supabase.functions.invoke("qiniu-upload-token", {
    body: { fileName: file.name, fileSize: file.size, category, ...(resumeKey ? { resumeKey } : {}) }
  });
  if (request.error && resumeKey) {
    // 旧记录失效时回退到全新上传；不会把任何不属于当前用户的 key 交给 SDK。
    const reason = await functionError(request.error);
    if (/续传|无效|过期/.test(reason)) {
      clearResume(localKey);
      request = await supabase.functions.invoke("qiniu-upload-token", {
        body: { fileName: file.name, fileSize: file.size, category }
      });
    }
  }
  if (request.error) throw new Error(await functionError(request.error));
  const cfg = request.data || {};
  if (!cfg.token || !cfg.key) throw new Error(cfg.error || "七牛云上传凭证不完整");
  const resumed = Boolean(resumeKey && cfg.key === resumeKey);
  saveResume(localKey, cfg.key);

  const startedAt = Date.now();
  let firstLoaded = null;
  let lastPercent = 0;
  let subscription = null;
  const uploadConfig = {
    useCdnDomain: false, // 让 SDK 根据上传凭证自动发现存储区域
    concurrentRequestLimit: 3,
    retryCount: 3,
    chunkSize: 4,
    forceDirect: false,
    checkByMD5: true,
    disableStatisticsReport: true
  };
  setUploadActive(true);
  try {
    const result = await new Promise((resolve, reject) => {
      let settled = false;
      const done = (err, data) => {
        if (settled) return;
        settled = true;
        globalThis.JUSTSubmissionUploadPause = null;
        if (err) reject(err); else resolve(data);
      };
      const observable = sdk.upload(
        file, cfg.key, cfg.token,
        { fname: file.name, mimeType: file.type || "application/octet-stream" },
        uploadConfig
      );
      try {
        subscription = observable.subscribe({
          next(progress) {
            const pct = Math.min(100, Math.max(0, Number(progress?.total?.percent) || 0));
            const loaded = Math.round(file.size * pct / 100);
            if (firstLoaded === null) firstLoaded = loaded;
            const elapsed = Math.max(0.1, (Date.now() - startedAt) / 1000);
            const speed = Math.max(0, loaded - firstLoaded) / elapsed;
            const eta = speed > 0 ? Math.max(0, (file.size - loaded) / speed) : 0;
            lastPercent = Math.max(lastPercent, pct);
            if (onProgress) onProgress(Math.round(lastPercent), { speed, eta, resumed });
          },
          error(error) { done(new Error(sdkError(error))); },
          complete(data) { done(null, data || {}); }
        });
        globalThis.JUSTSubmissionUploadPause = () => {
          try { subscription?.unsubscribe(); } catch (_) {}
          done(new Error("上传已暂停。重新选择同一文件并点击提交，可尝试从已上传分片继续。"));
        };
      } catch (error) { done(error); }
    });
    if (result?.key && result.key !== cfg.key)
      throw new Error("云端返回的文件标识不一致，请勿重复提交，请联系管理员");
    if (result?.size !== undefined && Number(result.size) !== file.size)
      throw new Error("云端返回文件大小不一致，请联系管理员核查");
    clearResume(localKey);
    onProgress?.(100, { speed: 0, eta: 0, resumed });
    return { key: cfg.key, url: publicUrlFromKey(cfg.key), storage_backend: "qiniu" };
  } finally {
    globalThis.JUSTSubmissionUploadPause = null;
    setUploadActive(false);
  }
}
