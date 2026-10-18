import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createGateway } from "../server.mjs";

function listen(server) {
  return new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
}
function close(server) {
  return new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
}

test("gateway authenticates requests, reports missing adapters and relays a mock adapter", async () => {
  const adapter = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ received: JSON.parse(Buffer.concat(chunks).toString("utf8")) }));
  });
  const adapterPort = await listen(adapter);
  const gateway = createGateway({
    apiKey: "an-example-secret-123456",
    endpoints: { taste: "http://127.0.0.1:" + adapterPort }
  });
  const gatewayPort = await listen(gateway);
  const root = "http://127.0.0.1:" + gatewayPort;
  try {
    const health = await (await fetch(root + "/health")).json();
    assert.equal(health.providers.taste.configured, true);
    assert.equal(health.providers.mirofish.configured, false);

    const unauthorized = await fetch(root + "/v1/execute", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: "taste", task: "audit" })
    });
    assert.equal(unauthorized.status, 401);

    const missing = await fetch(root + "/v1/execute", {
      method: "POST",
      headers: { "content-type": "application/json", "x-integration-key": "an-example-secret-123456" },
      body: JSON.stringify({ provider: "mirofish", task: "simulate" })
    });
    assert.equal(missing.status, 503);

    const success = await fetch(root + "/v1/execute", {
      method: "POST",
      headers: { "content-type": "application/json", "x-integration-key": "an-example-secret-123456" },
      body: JSON.stringify({ provider: "taste", task: "audit", input: { device: "mobile" } })
    });
    assert.equal(success.status, 200);
    const result = await success.json();
    assert.deepEqual(result.result.received, { task: "audit", input: { device: "mobile" } });

    const invalid = await fetch(root + "/v1/execute", {
      method: "POST",
      headers: { "content-type": "application/json", "x-integration-key": "an-example-secret-123456" },
      body: JSON.stringify({ provider: "unknown", task: "audit" })
    });
    assert.equal(invalid.status, 400);
  } finally {
    await close(gateway);
    await close(adapter);
  }
});

