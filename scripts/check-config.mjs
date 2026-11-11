// Verifies environment configuration, database schema, and the Meta/WhatsApp
// setup with read-only API calls. Never prints secret values.
//
//   npm run check:config                 # checks only
//   npm run check:config -- --subscribe  # also subscribes the app to the WABA webhooks

import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";

const env = process.env;
const version = env.META_GRAPH_API_VERSION || "v23.0";
const subscribe = process.argv.includes("--subscribe");
let failures = 0;
let warnings = 0;

const ok = (message) => console.log(`  ✓ ${message}`);
const warn = (message) => { warnings += 1; console.log(`  ! ${message}`); };
const fail = (message) => { failures += 1; console.log(`  ✗ ${message}`); };
const section = (title) => console.log(`\n${title}`);
const isSet = (key) => Boolean(env[key] && !/replace/i.test(env[key]));

async function graph(pathname, { token, method = "GET" } = {}) {
  const response = await fetch(`https://graph.facebook.com/${version}${pathname}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    const error = new Error(data.error?.message || `HTTP ${response.status}`);
    error.code = data.error?.code;
    throw error;
  }
  return data;
}

section("Secrets");
for (const key of ["SESSION_SECRET", "TOKEN_ENCRYPTION_KEY"]) {
  if (!isSet(key)) fail(`${key} is missing or still a placeholder. Generate one with: openssl rand -hex 32`);
  else if (env[key].length < 32) warn(`${key} is shorter than 32 characters.`);
  else ok(`${key} is set`);
}

section("Database");
if (!isSet("DB_HOST") || !isSet("DB_USER") || !isSet("DB_NAME")) {
  fail("DB_HOST, DB_USER and DB_NAME are required.");
} else {
  try {
    const connection = await mysql.createConnection({
      host: env.DB_HOST,
      port: Number(env.DB_PORT || 3306),
      user: env.DB_USER,
      password: env.DB_PASSWORD || "",
      database: env.DB_NAME,
      connectTimeout: 10000,
    });
    const [[{ version: mysqlVersion }]] = await connection.query("SELECT VERSION() AS version");
    ok(`Connected to MySQL ${mysqlVersion}`);
    if (Number.parseInt(mysqlVersion, 10) < 8) fail("MySQL 8.0+ is required (SKIP LOCKED, JSON, CHECK constraints).");

    const files = fs.readdirSync(path.join(process.cwd(), "database", "migrations")).filter((f) => f.endsWith(".sql")).sort();
    let applied = [];
    try {
      const [rows] = await connection.query("SELECT name FROM schema_migrations");
      applied = rows.map((row) => row.name);
    } catch {
      // table missing: nothing tracked yet
    }
    const pending = files.filter((file) => !applied.includes(file));
    if (pending.length) fail(`Pending migrations: ${pending.join(", ")}. Run: npm run db:migrate`);
    else ok("All migrations applied");
    await connection.end();
  } catch (error) {
    fail(`Could not connect: ${error.message}`);
  }
}

section("Meta app");
const appReady = isSet("META_APP_ID") && isSet("META_APP_SECRET");
if (!isSet("META_APP_ID")) fail("META_APP_ID is missing (needed for media template uploads).");
else ok("META_APP_ID is set");
if (!isSet("META_APP_SECRET")) fail("META_APP_SECRET is missing (needed to verify webhook signatures).");
else ok("META_APP_SECRET is set");
if (!isSet("META_WEBHOOK_VERIFY_TOKEN")) fail("META_WEBHOOK_VERIFY_TOKEN is missing (needed to register the webhook URL).");
else ok("META_WEBHOOK_VERIFY_TOKEN is set");
if (env.META_GRAPH_API_VERSION) ok(`Graph API version ${version}`);

if (appReady) {
  const appToken = `${env.META_APP_ID}|${env.META_APP_SECRET}`;
  try {
    const subs = await graph(`/${env.META_APP_ID}/subscriptions?access_token=${encodeURIComponent(appToken)}`);
    const waba = (subs.data || []).find((item) => item.object === "whatsapp_business_account");
    if (!waba) {
      fail("No webhook configured for the whatsapp_business_account object in the Meta app dashboard.");
    } else {
      ok(`Webhook callback URL: ${waba.callback_url}`);
      if (!waba.active) warn("Webhook subscription is not active.");
      const fields = (waba.fields || []).map((field) => field.name || field);
      for (const needed of ["messages", "message_template_status_update"]) {
        if (fields.includes(needed)) ok(`Webhook field subscribed: ${needed}`);
        else fail(`Webhook field not subscribed: ${needed}`);
      }
      if (!/^https:\/\//.test(waba.callback_url || "")) fail("Webhook callback URL must use HTTPS.");
      if (!/\/api\/whatsapp\/webhook\/?$/.test(waba.callback_url || "")) {
        warn("Callback URL does not end with /api/whatsapp/webhook.");
      }
    }
  } catch (error) {
    fail(`Could not read app webhook subscriptions: ${error.message}`);
  }
}

section("Embedded Signup");
if (!isSet("NEXT_PUBLIC_META_APP_ID") || !isSet("NEXT_PUBLIC_META_CONFIG_ID")) {
  warn("NEXT_PUBLIC_META_APP_ID or NEXT_PUBLIC_META_CONFIG_ID is missing, so workspaces can't connect their own number.");
} else {
  if (env.NEXT_PUBLIC_META_APP_ID !== env.META_APP_ID) fail("NEXT_PUBLIC_META_APP_ID must equal META_APP_ID.");
  else ok("NEXT_PUBLIC_META_APP_ID matches META_APP_ID");
  if (!/^\d+$/.test(env.NEXT_PUBLIC_META_CONFIG_ID)) fail("NEXT_PUBLIC_META_CONFIG_ID should be the numeric Facebook Login for Business configuration ID.");
  else ok("NEXT_PUBLIC_META_CONFIG_ID is set (Facebook Login for Business configuration)");
}

section("WhatsApp connection");
const platformKeys = ["PLATFORM_WHATSAPP_ACCESS_TOKEN", "PLATFORM_WHATSAPP_WABA_ID", "PLATFORM_WHATSAPP_PHONE_NUMBER_ID"];
const platformSet = platformKeys.filter(isSet);
if (platformSet.length === 0) {
  warn("Platform connection not configured. Workspaces need their own connection via Embedded Signup (NEXT_PUBLIC_META_CONFIG_ID).");
} else if (platformSet.length < platformKeys.length) {
  fail(`Incomplete platform connection. Missing: ${platformKeys.filter((key) => !isSet(key)).join(", ")}`);
} else {
  const token = env.PLATFORM_WHATSAPP_ACCESS_TOKEN;
  const wabaId = env.PLATFORM_WHATSAPP_WABA_ID;
  const phoneId = env.PLATFORM_WHATSAPP_PHONE_NUMBER_ID;

  if (appReady) {
    try {
      const debug = await graph(
        `/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(`${env.META_APP_ID}|${env.META_APP_SECRET}`)}`
      );
      const info = debug.data || {};
      if (!info.is_valid) fail("Access token is invalid or expired.");
      else ok(`Access token valid (${info.type || "token"}${info.expires_at ? `, expires ${new Date(info.expires_at * 1000).toISOString()}` : ", never expires"})`);
      if (info.app_id && info.app_id !== env.META_APP_ID) warn("Access token belongs to a different Meta app than META_APP_ID.");
      for (const scope of ["whatsapp_business_messaging", "whatsapp_business_management"]) {
        if ((info.scopes || []).includes(scope)) ok(`Permission granted: ${scope}`);
        else fail(`Permission missing: ${scope}`);
      }
      if (info.expires_at && info.expires_at * 1000 - Date.now() < 7 * 86400000) {
        warn("Access token expires within 7 days. Use a System User token that never expires.");
      }
    } catch (error) {
      warn(`Could not inspect the token: ${error.message}`);
    }
  }

  try {
    const phone = await graph(
      `/${phoneId}?fields=display_phone_number,verified_name,quality_rating,name_status,code_verification_status,messaging_limit_tier`,
      { token }
    );
    ok(`Phone number ${phone.display_phone_number} (${phone.verified_name})`);
    ok(`Quality ${phone.quality_rating || "unknown"}, limit tier ${phone.messaging_limit_tier || "unknown"}, name ${phone.name_status || "unknown"}`);
    if (phone.quality_rating === "RED") warn("Phone quality is LOW.");
  } catch (error) {
    fail(`Phone number ${phoneId} not readable with this token: ${error.message}`);
  }

  try {
    const templates = await graph(`/${wabaId}/message_templates?limit=1&fields=name,status`, { token });
    ok(`WABA ${wabaId} reachable (template access OK${templates.data?.length ? "" : ", no templates yet"})`);
  } catch (error) {
    fail(`WABA ${wabaId} not readable with this token: ${error.message}`);
  }

  try {
    const apps = await graph(`/${wabaId}/subscribed_apps`, { token });
    if ((apps.data || []).length) {
      ok(`WABA webhooks subscribed by: ${apps.data.map((app) => app.whatsapp_business_api_data?.name || app.id).join(", ")}`);
    } else if (subscribe) {
      await graph(`/${wabaId}/subscribed_apps`, { token, method: "POST" });
      ok("Subscribed the app to WABA webhooks");
    } else {
      fail("No app subscribed to this WABA's webhooks. Re-run with --subscribe to fix.");
    }
  } catch (error) {
    fail(`Could not check WABA webhook subscription: ${error.message}`);
  }
}

section("Background sending");
if (env.DISABLE_QUEUE_WORKER === "1") {
  if (isSet("CRON_SECRET")) ok("In-process worker disabled; call GET /api/cron/send-queue with Authorization: Bearer $CRON_SECRET every minute.");
  else fail("DISABLE_QUEUE_WORKER=1 but CRON_SECRET is not set, so queued messages will never send.");
} else {
  ok("In-process queue worker enabled (starts with `npm start` / `npm run dev`).");
}

console.log(`\n${failures ? `${failures} problem(s)` : "No problems"}${warnings ? `, ${warnings} warning(s)` : ""}.`);
process.exit(failures ? 1 : 0);
