import { createServer } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PROVIDERS = Object.freeze(["taste", "agent_reach", "archify", "voicestudio", "mirofish"]);
const ENV_NAMES = {
  taste: "TASTE_ADAPTER_URL",
  agent_reach: "AGENT_REACH_ADAPTER_URL",
  archify: "ARCHIFY_ADAPTER_URL",
  voicestudio: "VOICESTUDIO_ADAPTER_URL",
  mirofish: "MIROFISH_ADAPTER_URL"
};
const MAX_BYTES = 64 * 1024;

export function endpointsFromEnv(env = process.env) {
  return Object.fromEntries(PROVIDERS.map(name => [name, env[ENV_NAMES[name]] || ""]));
}
function error(res, status, code) {
  return json(res, status, { ok: false, error: code });
}
function json(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  res.end(JSON.stringify(payload));
}
function digest(s) {
  return createHash("sha256").update(s).digest();
}
function authorized(req, secret) {
  const supplied = req.headers["x-integration-key"];
  if (typeof supplied !== "string") return false;
  return timingSafeEqual(digest(supplied), digest(secret));
}
async function readJSON(req) {
  let length = 0;
  const chunks = [];
  for await (const chunk of req) {
    length += chunk.byteLength;
    if (length > MAX_BYTES) {
      const e = Error("too_large");
      e.status = 413;
      throw e;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const e = Error("invalid_json");
    e.status = 400;
    throw e;
  }
}
function validatedEndpoint(raw) {
  if (!raw) return null;
  const url = new URL(raw);
  if (url.username || url.password || url.hash) throw Error("Adapter URLs cannot contain credentials or fragments");
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(url.hostname))) {
    throw Error("Adapter URLs must be HTTPS or loopback HTTP");
  }
  return url.toString();
}
export function createGateway({
  apiKey = process.env.INTEGRATION_KEY,
  endpoints = endpointsFromEnv(),
  timeoutMs = 45_000
} = {}) {
  if (typeof apiKey !== "string" || apiKey.length < 16) throw Error("INTEGRATION_KEY must contain at least 16 characters");
  const urls = Object.fromEntries(PROVIDERS.map(name => [name, validatedEndpoint(endpoints[name])]));
  return createServer(async (req, res) => {
    const path = new URL(req.url || "/", "http://localhost").pathname;
    if (req.method === "GET" && path === "/health") {
      return json(res, 200, {
        ok: true,
        service: "chatgpt-skills-adapter-gateway",
        providers: Object.fromEntries(PROVIDERS.map(name => [name, { configured: Boolean(urls[name]) }]))
      });
    }
    if (req.method !== "POST" || path !== "/v1/execute") return error(res, 404, "not_found");
    if (!authorized(req, apiKey)) return error(res, 401, "unauthorized");
    if (!String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
      return error(res, 415, "json_content_type_required");
    }
    let body;
    try { body = await readJSON(req); } catch (e) { return error(res, e.status || 400, e.message); }
    if (!body || typeof body !== "object" || Array.isArray(body)
      || !PROVIDERS.includes(body.provider)
      || typeof body.task !== "string" || !body.task.trim() || body.task.length > 4000
      || (body.input !== undefined && (typeof body.input !== "object" || body.input === null || Array.isArray(body.input)))) {
      return error(res, 400, "invalid_request");
    }
    const target = urls[body.provider];
    if (!target) return error(res, 503, "adapter_not_configured");
    try {
      // Each provider requires a separate adapter implementing this contract.
      // Do not point these URLs at upstream applications without adapting their APIs.
      const response = await fetch(target, {
        method: "POST",
        headers: { "content-type": "application/json", "accept": "application/json" },
        body: JSON.stringify({ task: body.task, input: body.input ?? {} }),
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!response.ok) return error(res, 502, "adapter_returned_error");
      const data = await response.text();
      if (data.length > 1_000_000) return error(res, 502, "adapter_response_too_large");
      let output;
      try { output = JSON.parse(data); } catch { return error(res, 502, "adapter_invalid_json"); }
      return json(res, 200, { ok: true, provider: body.provider, result: output });
    } catch {
      return error(res, 502, "adapter_unreachable_or_timed_out");
    }
  });
}
const current = process.argv[1] ? resolve(process.argv[1]) : "";
if (current === fileURLToPath(import.meta.url)) {
  const gateway = createGateway();
  const port = Number(process.env.PORT || 8787);
  gateway.listen(port, "127.0.0.1", () => {
    console.log("Adapter gateway listening on loopback port " + port);
  });
}

