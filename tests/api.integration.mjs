// Manual integration test against the running portable preview only.
// Usage: node tests/api.integration.mjs
// The disposable Sites mock user's state is restored even when an assertion fails.
import assert from "node:assert/strict";

const base = new URL(process.env.SOSO_API_BASE_URL || "http://127.0.0.1:5173");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(base.hostname), "Integration tests only run against a loopback preview.");
const output = (check, status, details = {}) => console.log(JSON.stringify({ check, status, ...details }));
const read = async (path, init = {}) => {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(30000), ...init });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { message: text }; }
  return { response, body };
};

const independent = await Promise.allSettled([
  read("/api/state"),
  read("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json", Origin: base.origin }, body: JSON.stringify({ question: "O que revisar?", context: "Teste de estudo." }) }),
  read("/api/assistant"),
  read("/api/news"),
]);
for (const result of independent) assert.equal(result.status, "fulfilled", "All read-only API requests should complete.");
const [anonymous, anonymousAssistant, assistantConfig, news] = independent.map((result) => result.value);
assert.equal(anonymous.response.status, 401); output("GET state anonymous", anonymous.response.status);
assert.equal(anonymousAssistant.response.status, 401); output("POST assistant anonymous", anonymousAssistant.response.status);
assert.equal(assistantConfig.response.status, 200); output("GET assistant configuration", assistantConfig.response.status, { configured: assistantConfig.body.configured });
assert.equal(news.response.status, 200);
assert.ok(["curated", "live"].includes(news.body.mode));
assert.ok(Array.isArray(news.body.items) && news.body.items.length > 0);
assert.ok(Number.isFinite(Date.parse(news.body.checkedAt)));
for (const item of news.body.items) {
  for (const key of ["tribunal", "title", "summary", "date", "category", "url"]) assert.equal(typeof item[key], "string");
  assert.ok(new URL(item.url).hostname.endsWith(".jus.br"), "News links should point to official judiciary sources.");
}
output("GET news shape and official links", news.response.status, { mode: news.body.mode, items: news.body.items.length });

const signin = await fetch(new URL("/signin-with-chatgpt?return_to=%2F", base), { redirect: "manual", signal: AbortSignal.timeout(30000) });
assert.ok([302, 303, 307].includes(signin.status));
const cookies = signin.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
assert.ok(cookies, "Portable preview should issue the mock cookie.");
const signedHeaders = { Cookie: cookies };
const writeHeaders = { ...signedHeaders, "Content-Type": "application/json", Origin: base.origin };
const initial = await read("/api/state", { headers: signedHeaders });
assert.equal(initial.response.status, 200);
assert.equal(initial.body.user?.email, "seedy@sites.test", "Only the disposable local mock profile may be mutated.");
assert.ok(Number.isInteger(initial.body.version));
const originalState = structuredClone(initial.body.state);
if (initial.body.version === 0) {
  for (const key of ["sessions", "tasks", "notes", "errors", "reviews", "completedTopics"]) assert.equal(originalState[key].length, 0);
}
output("GET signed state", initial.response.status, { version: initial.body.version, sessions: originalState.sessions.length, tasks: originalState.tasks.length });

let changed = false;
try {
  if (!assistantConfig.body.configured) {
    const unavailable = await read("/api/assistant", { method: "POST", headers: writeHeaders, body: JSON.stringify({ question: "O que revisar?", context: "Teste de estudo." }) });
    assert.equal(unavailable.response.status, 503);
    output("POST assistant signed without provider", unavailable.response.status);
  } else output("POST assistant provider call", "skipped", { reason: "A configured paid provider is never invoked by this test." });

  const testState = structuredClone(originalState);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Recife", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  testState.sessions.push({ id: `integration-${crypto.randomUUID()}`, subjectId: testState.subjects[0].id, topic: "Teste descartável de integração", minutes: 1, questions: 1, correct: 1, date: day });
  const saved = await read("/api/state", { method: "PUT", headers: writeHeaders, body: JSON.stringify({ state: testState, version: initial.body.version }) });
  changed = saved.response.ok;
  assert.equal(saved.response.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.version, initial.body.version + 1);
  output("PUT valid state", saved.response.status, { version: saved.body.version });

  const persisted = await read("/api/state", { headers: signedHeaders });
  assert.equal(persisted.response.status, 200);
  assert.deepEqual(persisted.body.state, testState);
  assert.equal(persisted.body.version, saved.body.version);
  output("GET persisted state", persisted.response.status, { version: persisted.body.version });

  const stale = await read("/api/state", { method: "PUT", headers: writeHeaders, body: JSON.stringify({ state: originalState, version: initial.body.version }) });
  assert.equal(stale.response.status, 409, JSON.stringify(stale.body)); output("PUT stale version", stale.response.status);

  const invalidState = structuredClone(testState);
  invalidState.sessions.at(-1).correct = 2;
  const invalid = await read("/api/state", { method: "PUT", headers: writeHeaders, body: JSON.stringify({ state: invalidState, version: saved.body.version }) });
  assert.equal(invalid.response.status, 400, JSON.stringify(invalid.body)); output("PUT invalid score", invalid.response.status);

  const badOrigin = await read("/api/state", { method: "PUT", headers: { ...writeHeaders, Origin: "https://untrusted.invalid" }, body: JSON.stringify({ state: originalState, version: saved.body.version }) });
  assert.equal(badOrigin.response.status, 403, JSON.stringify(badOrigin.body)); output("PUT wrong origin", badOrigin.response.status);

  const missingOriginHeaders = { ...writeHeaders }; delete missingOriginHeaders.Origin;
  const missingOrigin = await read("/api/state", { method: "PUT", headers: missingOriginHeaders, body: JSON.stringify({ state: originalState, version: saved.body.version }) });
  assert.equal(missingOrigin.response.status, 403); output("PUT missing origin", missingOrigin.response.status);
} finally {
  if (changed) {
    const current = await read("/api/state", { headers: signedHeaders });
    assert.equal(current.response.status, 200);
    const restored = await read("/api/state", { method: "PUT", headers: writeHeaders, body: JSON.stringify({ state: originalState, version: current.body.version }) });
    assert.equal(restored.response.status, 200, "Failed to restore the disposable mock profile.");
    const verified = await read("/api/state", { headers: signedHeaders });
    assert.deepEqual(verified.body.state, originalState);
    output("Restored original mock profile", restored.response.status, { version: restored.body.version });
  }
}
