// k6 load test for the SPECKULA AI backend.
//
// Usage:
//   k6 run load-test.js
//   k6 run --vus 20 --duration 2m load-test.js
//   BASE_URL=https://api.speckula.io k6 run load-test.js
//
// Environment variables:
//   BASE_URL       Backend base URL (default http://localhost:3001)
//   BEARER_TOKEN   Firebase ID token for authenticated routes (required for AI routes)
//
// SLOs (fail the test if violated):
//   p95 response time  < 2 000 ms  for AI endpoints
//   p95 response time  < 200  ms   for health check
//   error rate         < 1%        across all requests
//   p99 response time  < 5 000 ms  (absolute ceiling)

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// ── Custom metrics ────────────────────────────────────────────────────────────
const errorRate    = new Rate("error_rate");
const aiLatency    = new Trend("ai_latency_ms",     true);
const healthLatency = new Trend("health_latency_ms", true);

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL     = __ENV.BASE_URL     || "http://localhost:3001";
const BEARER_TOKEN = __ENV.BEARER_TOKEN || "";

export const options = {
  // Ramp up → sustain → ramp down
  stages: [
    { duration: "30s", target: 5  },   // warm up: 0 → 5 VUs
    { duration: "1m",  target: 10 },   // sustain
    { duration: "30s", target: 20 },   // spike
    { duration: "30s", target: 0  },   // ramp down
  ],
  thresholds: {
    // Health check must stay fast.
    "health_latency_ms":          ["p(95)<200"],
    // AI endpoints: p95 under 2 s; p99 under 5 s.
    "ai_latency_ms":              ["p(95)<2000", "p(99)<5000"],
    // Less than 1% of all requests may error.
    "error_rate":                 ["rate<0.01"],
    // k6 built-in: overall http error rate.
    "http_req_failed":            ["rate<0.01"],
    // Overall p95 across all routes.
    "http_req_duration":          ["p(95)<3000"],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const authHeaders = () => ({
  "Content-Type":  "application/json",
  "Authorization": `Bearer ${BEARER_TOKEN}`,
});

const noAuthHeaders = () => ({
  "Content-Type": "application/json",
});

function recordAi(res) {
  aiLatency.add(res.timings.duration);
  errorRate.add(res.status >= 400 && res.status !== 429 ? 1 : 0);
}

// ── Scenarios ─────────────────────────────────────────────────────────────────

// 1. Health check — unauthenticated, very fast.
function checkHealth() {
  const res = http.get(`${BASE_URL}/health`, { headers: noAuthHeaders() });
  healthLatency.add(res.timings.duration);
  errorRate.add(res.status !== 200 ? 1 : 0);
  check(res, {
    "health: status 200":     (r) => r.status === 200,
    "health: body ok":        (r) => r.json("ok") === true,
    "health: under 200ms":    (r) => r.timings.duration < 200,
  });
}

// 2. Signal analysis — fast model, representative payload.
function analyzeSignals() {
  if (!BEARER_TOKEN) return;
  const payload = JSON.stringify({
    projectId: "load-test-project",
    content:
      "Users keep mentioning that the onboarding flow is confusing. " +
      "They say they don't know what to do after signing up. " +
      "Three interviewees mentioned they expected a guided tour.",
  });
  const res = http.post(`${BASE_URL}/ai/signals/analyze`, payload, {
    headers: authHeaders(),
    timeout: "30s",
  });
  recordAi(res);
  check(res, {
    "signals: status 200 or 429": (r) => r.status === 200 || r.status === 429,
  });
}

// 3. Pattern analysis — fast model.
function analyzePatterns() {
  if (!BEARER_TOKEN) return;
  const payload = JSON.stringify({
    projectId: "load-test-project",
    noteId:    "note-load-test-001",
    content:
      "Interview notes: User A (22, student) struggled with expense tracking. " +
      "Uses spreadsheet. User B (34, freelancer) uses Notion for budgeting but " +
      "says it's overkill. Both mentioned 'manual entry' as a pain point.",
  });
  const res = http.post(`${BASE_URL}/ai/patterns/analyze`, payload, {
    headers: authHeaders(),
    timeout: "30s",
  });
  recordAi(res);
  check(res, {
    "patterns: status 200 or 429": (r) => r.status === 200 || r.status === 429,
  });
}

// 4. Usage endpoint — authenticated read path, should be very fast.
function getUsage() {
  if (!BEARER_TOKEN) return;
  const today = new Date().toISOString().slice(0, 10);
  const res = http.get(`${BASE_URL}/ai/usage/${today}`, {
    headers: authHeaders(),
  });
  errorRate.add(res.status >= 500 ? 1 : 0);
  check(res, {
    "usage: status 200": (r) => r.status === 200,
  });
}

// 5. Metrics endpoint — checks X-Response-Time header is present.
function checkResponseTimeHeader() {
  const res = http.get(`${BASE_URL}/health`, { headers: noAuthHeaders() });
  check(res, {
    "X-Response-Time header present": (r) => r.headers["X-Response-Time"] !== undefined,
  });
}

// ── Default function (called per VU iteration) ────────────────────────────────
export default function () {
  checkHealth();
  sleep(0.5);

  checkResponseTimeHeader();
  sleep(0.3);

  // Rotate through AI scenarios so each VU exercises a mix of endpoints.
  const scenario = Math.random();
  if (scenario < 0.4) {
    analyzeSignals();
  } else if (scenario < 0.8) {
    analyzePatterns();
  } else {
    getUsage();
  }

  // Jitter: 1–3 s between iterations to simulate realistic think time.
  sleep(1 + Math.random() * 2);
}
