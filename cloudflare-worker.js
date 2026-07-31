const ALLOWED_ORIGINS = new Set([
  "https://www.zepoulayiti.com",
  "https://zepoulayiti.com"
]);

const ALLOWED_HOSTNAMES = new Set([
  "www.zepoulayiti.com",
  "zepoulayiti.com"
]);

const APPS_SCRIPT_FALLBACK_URL =
  "https://script.google.com/macros/s/AKfycbwTGCG7iqD8zXXNBtBrCu4EC0HoeLpM2MYhJ5zibxo96FNi25J2NFBbbV6R6D4oiPlv/exec";
const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_BODY_BYTES = 32 * 1024;
const VALID_FREQUENCIES = new Set([
  "Demande ponctuelle",
  "Approvisionnement hebdomadaire",
  "Approvisionnement régulier"
]);
const VALID_STATUSES = new Set([
  "Nouvelle",
  "En cours",
  "Cotation envoyée",
  "Confirmée",
  "Clôturée"
]);

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function allowedOrigin(request) {
  const origin = request.headers.get("Origin") || "";
  return ALLOWED_ORIGINS.has(origin) ? origin : "";
}

function responseHeaders(origin, requestId, cacheControl = "no-store") {
  const headers = {
    "Content-Type": "application/json; charset=UTF-8",
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
    "X-Request-Id": requestId,
    "Vary": "Origin"
  };

  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
  }

  return headers;
}

function jsonResponse(payload, status, origin, requestId, cacheControl) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: responseHeaders(origin, requestId, cacheControl)
  });
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function readJsonBody(request) {
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw Object.assign(new Error("invalid_content_type"), { status: 415 });
  }

  const statedLength = Number(request.headers.get("Content-Length") || 0);
  if (statedLength > MAX_BODY_BYTES) {
    throw Object.assign(new Error("request_too_large"), { status: 413 });
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    throw Object.assign(new Error("request_too_large"), { status: 413 });
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw Object.assign(new Error("invalid_json"), { status: 400 });
  }
}

async function verifyTurnstile(token, remoteIp, env, requestId) {
  if (!env.TURNSTILE_SECRET_KEY) {
    throw Object.assign(new Error("server_not_configured"), { status: 503 });
  }

  const body = new FormData();
  body.append("secret", env.TURNSTILE_SECRET_KEY);
  body.append("response", token);
  body.append("idempotency_key", requestId);
  if (remoteIp) body.append("remoteip", remoteIp);

  const response = await fetchWithTimeout(
    TURNSTILE_VERIFY_URL,
    { method: "POST", body },
    8000
  );

  if (!response.ok) {
    throw Object.assign(new Error("verification_unavailable"), { status: 503 });
  }

  const result = await response.json();
  if (
    !result.success ||
    result.action !== "quote" ||
    !ALLOWED_HOSTNAMES.has(result.hostname)
  ) {
    throw Object.assign(new Error("turnstile_failed"), { status: 403 });
  }
}

async function callAppsScript(env, body) {
  const endpoint = env.APPS_SCRIPT_URL || APPS_SCRIPT_FALLBACK_URL;
  if (!env.WORKER_SHARED_SECRET) {
    throw Object.assign(new Error("server_not_configured"), { status: 503 });
  }

  const response = await fetchWithTimeout(
    endpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "Accept": "application/json"
      },
      body: JSON.stringify({ ...body, secret: env.WORKER_SHARED_SECRET }),
      redirect: "follow"
    },
    12000
  );

  if (!response.ok) {
    throw Object.assign(new Error("storage_unavailable"), { status: 502 });
  }

  const result = await response.json().catch(() => null);
  if (!result || result.success === false) {
    const errorCode = result && result.error ? result.error : "storage_failed";
    throw Object.assign(new Error(errorCode), { status: 502 });
  }

  return result;
}

function requirePublicOrigin(request) {
  const origin = allowedOrigin(request);
  if (!origin) {
    throw Object.assign(new Error("origin_not_allowed"), { status: 403 });
  }
  return origin;
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function decodeJwtJson(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

async function verifyAccessJwt(request, env) {
  const teamDomain = String(env.TEAM_DOMAIN || "").replace(/\/$/, "");
  const audience = cleanText(env.POLICY_AUD, 200);
  const token = cleanText(
    request.headers.get("Cf-Access-Jwt-Assertion"),
    12000
  );

  if (
    !/^https:\/\/[a-z0-9.-]+\.cloudflareaccess\.com$/i.test(teamDomain) ||
    !audience ||
    !token
  ) {
    throw Object.assign(new Error("access_not_configured"), { status: 403 });
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    throw Object.assign(new Error("invalid_access_token"), { status: 403 });
  }

  let header;
  let payload;
  try {
    header = decodeJwtJson(parts[0]);
    payload = decodeJwtJson(parts[1]);
  } catch {
    throw Object.assign(new Error("invalid_access_token"), { status: 403 });
  }

  if (header.alg !== "RS256" || !header.kid) {
    throw Object.assign(new Error("invalid_access_token"), { status: 403 });
  }

  const certResponse = await fetchWithTimeout(
    teamDomain + "/cdn-cgi/access/certs",
    {
      headers: { "Accept": "application/json" },
      cf: { cacheEverything: true, cacheTtl: 3600 }
    },
    6000
  );
  if (!certResponse.ok) {
    throw Object.assign(new Error("access_validation_unavailable"), { status: 503 });
  }

  const certs = await certResponse.json();
  const jwk = Array.isArray(certs.keys)
    ? certs.keys.find((key) => key.kid === header.kid)
    : null;
  if (!jwk) {
    throw Object.assign(new Error("invalid_access_token"), { status: 403 });
  }

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    decodeBase64Url(parts[2]),
    new TextEncoder().encode(parts[0] + "." + parts[1])
  );

  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const issuer = String(payload.iss || "").replace(/\/$/, "");
  if (
    !verified ||
    issuer !== teamDomain ||
    !audiences.includes(audience) ||
    !Number.isFinite(Number(payload.exp)) ||
    Number(payload.exp) < now - 30 ||
    (payload.nbf && Number(payload.nbf) > now + 30)
  ) {
    throw Object.assign(new Error("invalid_access_token"), { status: 403 });
  }

  return cleanText(payload.email, 254).toLowerCase();
}

async function requireAdmin(request, env) {
  if (String(env.ADMIN_ENABLED || "").toLowerCase() !== "true") {
    throw Object.assign(new Error("admin_disabled"), { status: 403 });
  }

  if (!ALLOWED_HOSTNAMES.has(new URL(request.url).hostname)) {
    throw Object.assign(new Error("admin_host_not_allowed"), { status: 403 });
  }

  const email = await verifyAccessJwt(request, env);
  const accessHeaderEmail = cleanText(
    request.headers.get("Cf-Access-Authenticated-User-Email"), 254
  ).toLowerCase();
  const allowedEmails = new Set(
    String(env.ADMIN_EMAILS || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );

  if (
    !email ||
    !accessHeaderEmail ||
    email !== accessHeaderEmail ||
    !allowedEmails.size ||
    !allowedEmails.has(email)
  ) {
    throw Object.assign(new Error("admin_access_required"), { status: 403 });
  }

  return email;
}

async function handleQuote(request, env, requestId) {
  const origin = requirePublicOrigin(request);
  const data = await readJsonBody(request);

  if (cleanText(data._honey, 160)) {
    throw Object.assign(new Error("invalid_fields"), { status: 400 });
  }

  const institution = cleanText(data.institution, 160);
  const email = cleanText(data.email, 254);
  const phone = cleanText(data.phone || data.whatsapp, 40);
  const zone = cleanText(data.zone, 120);
  const frequency = cleanText(data.frequency, 80);
  const details = cleanText(data.details, 2000);
  const submissionId = cleanText(data.submissionId, 80).toLowerCase();
  const turnstileToken = cleanText(data["cf-turnstile-response"], 4096);
  const volume = Number(data.volume);
  const phoneDigits = phone.replace(/\D/g, "");

  if (
    institution.length < 2 ||
    !Number.isInteger(volume) ||
    volume < 1 ||
    volume > 1000000 ||
    zone.length < 2 ||
    !VALID_FREQUENCIES.has(frequency) ||
    !isValidEmail(email) ||
    phoneDigits.length < 8 ||
    phoneDigits.length > 15 ||
    !/^[a-z0-9-]{16,80}$/.test(submissionId) ||
    !turnstileToken
  ) {
    throw Object.assign(new Error("invalid_fields"), { status: 400 });
  }

  await verifyTurnstile(
    turnstileToken,
    request.headers.get("CF-Connecting-IP") || "",
    env,
    requestId
  );

  const result = await callAppsScript(env, {
    action: "create_quote",
    requestId,
    submittedAt: new Date().toISOString(),
    payload: {
      institution,
      volume,
      zone,
      frequency,
      email,
      phone,
      details,
      submissionId,
      source: "Site web"
    }
  });

  return jsonResponse(
    { success: true, requestId, quoteId: result.quoteId || "" },
    200,
    origin,
    requestId
  );
}

async function handleInventory(request, env, requestId) {
  const result = await callAppsScript(env, {
    action: "inventory",
    requestId
  });

  return jsonResponse(
    {
      success: true,
      published: result.published === true,
      cartons: Number.isFinite(Number(result.cartons)) ? Number(result.cartons) : null,
      status: cleanText(result.status, 60),
      updatedAt: cleanText(result.updatedAt, 80),
      message: cleanText(result.message, 240)
    },
    200,
    allowedOrigin(request),
    requestId,
    "no-store"
  );
}

async function handleHealth(request, env, requestId) {
  let storage = "unavailable";
  try {
    const result = await callAppsScript(env, { action: "health", requestId });
    storage = result.success ? "operational" : "unavailable";
  } catch {
    storage = "unavailable";
  }

  const ok = storage === "operational";
  return jsonResponse(
    { success: ok, service: "zepoul-operations", storage },
    ok ? 200 : 503,
    allowedOrigin(request),
    requestId,
    "no-store"
  );
}

async function handleAdminList(request, env, requestId) {
  await requireAdmin(request, env);
  const url = new URL(request.url);
  const result = await callAppsScript(env, {
    action: "list_quotes",
    requestId,
    payload: {
      status: cleanText(url.searchParams.get("status"), 40),
      search: cleanText(url.searchParams.get("search"), 120),
      limit: Math.min(Math.max(Number(url.searchParams.get("limit")) || 200, 1), 500)
    }
  });

  return jsonResponse(
    { success: true, quotes: Array.isArray(result.quotes) ? result.quotes : [] },
    200,
    allowedOrigin(request),
    requestId
  );
}

async function handleAdminUpdate(request, env, requestId) {
  const adminEmail = await requireAdmin(request, env);
  const data = await readJsonBody(request);
  const rowNumber = Number(data.rowNumber);
  const status = cleanText(data.status, 40);

  if (!Number.isInteger(rowNumber) || rowNumber < 2 || !VALID_STATUSES.has(status)) {
    throw Object.assign(new Error("invalid_fields"), { status: 400 });
  }

  const result = await callAppsScript(env, {
    action: "update_quote_status",
    requestId,
    payload: {
      rowNumber,
      quoteId: cleanText(data.quoteId, 80),
      status,
      responsible: cleanText(data.responsible || adminEmail, 160),
      notes: cleanText(data.notes, 2000)
    }
  });

  return jsonResponse(
    { success: true, quote: result.quote || null },
    200,
    allowedOrigin(request),
    requestId
  );
}

async function sendAlert(env, error) {
  if (!env.ALERT_WEBHOOK_URL) return;
  await fetchWithTimeout(
    env.ALERT_WEBHOOK_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service: "zepoul-operations",
        status: "unavailable",
        checkedAt: new Date().toISOString(),
        message: cleanText(error && error.message, 160)
      })
    },
    8000
  );
}

async function checkSystems(env) {
  try {
    await callAppsScript(env, {
      action: "health",
      requestId: crypto.randomUUID()
    });
  } catch (error) {
    console.error("Zepoul health check failed", error);
    await sendAlert(env, error).catch((alertError) => {
      console.error("Zepoul alert delivery failed", alertError);
    });
    throw error;
  }
}

export default {
  async fetch(request, env) {
    const requestId = crypto.randomUUID();
    const url = new URL(request.url);
    const origin = allowedOrigin(request);

    if (request.method === "OPTIONS") {
      if (!origin) {
        return jsonResponse(
          { success: false, error: "origin_not_allowed" },
          403,
          "",
          requestId
        );
      }
      return new Response(null, {
        status: 204,
        headers: responseHeaders(origin, requestId)
      });
    }

    try {
      if (url.pathname === "/api/quote" && request.method === "POST") {
        return await handleQuote(request, env, requestId);
      }
      if (url.pathname === "/api/inventory" && request.method === "GET") {
        return await handleInventory(request, env, requestId);
      }
      if (url.pathname === "/api/health" && request.method === "GET") {
        return await handleHealth(request, env, requestId);
      }
      if (url.pathname === "/api/admin/quotes" && request.method === "GET") {
        return await handleAdminList(request, env, requestId);
      }
      if (
        url.pathname === "/api/admin/quotes/status" &&
        request.method === "POST"
      ) {
        return await handleAdminUpdate(request, env, requestId);
      }

      const knownPath = [
        "/api/quote",
        "/api/inventory",
        "/api/health",
        "/api/admin/quotes",
        "/api/admin/quotes/status"
      ].includes(url.pathname);

      return jsonResponse(
        { success: false, error: knownPath ? "method_not_allowed" : "not_found" },
        knownPath ? 405 : 404,
        origin,
        requestId
      );
    } catch (error) {
      const status = Number(error && error.status) || 500;
      const publicError = status >= 500 ? "service_unavailable" : cleanText(error.message, 80);
      console.error("Zepoul API error", { requestId, path: url.pathname, status, error });
      return jsonResponse(
        { success: false, error: publicError, requestId },
        status,
        origin,
        requestId
      );
    }
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(checkSystems(env));
  }
};
