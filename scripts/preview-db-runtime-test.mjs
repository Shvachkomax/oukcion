#!/usr/bin/env node
/**
 * Runtime checks of the isolated Preview database through PostgREST.
 *
 * Verifies what the SQL-level check cannot: that the roles really are
 * separated over HTTP, that drafts stay hidden, and that the rate limiter
 * counts parallel attempts exactly.
 *
 * Usage:
 *   PREVIEW_SUPABASE_URL=<url> \
 *   PREVIEW_PUBLISHABLE_KEY=<anon key> \
 *   PREVIEW_SERVICE_ROLE_KEY=<service role key> \
 *   node scripts/preview-db-runtime-test.mjs
 */

const url = process.env.PREVIEW_SUPABASE_URL;
const publishableKey = process.env.PREVIEW_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.PREVIEW_SERVICE_ROLE_KEY;

if (!url || !publishableKey || !serviceRoleKey) {
  console.error(
    "PREVIEW_SUPABASE_URL, PREVIEW_PUBLISHABLE_KEY and PREVIEW_SERVICE_ROLE_KEY are required."
  );
  process.exit(2);
}

const base = `${url.replace(/\/$/, "")}/rest/v1`;
const results = [];

function check(label, ok, detail = "") {
  results.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

async function rest(pathname, { method = "GET", key = publishableKey, body, headers = {} } = {}) {
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: response.status, json, text };
}

async function main() {
  console.log(`target: ${url}\n`);

  // --- anon reads -------------------------------------------------------
  const published = await rest(
    "/physical_products?select=slug,status&status=eq.published"
  );
  check(
    "anon can read published products",
    published.status === 200 && Array.isArray(published.json),
    `status=${published.status} count=${Array.isArray(published.json) ? published.json.length : "n/a"}`
  );

  const drafts = await rest(
    "/physical_products?select=slug,status&status=eq.draft"
  );
  check(
    "anon cannot read drafts",
    drafts.status === 200 && Array.isArray(drafts.json) && drafts.json.length === 0,
    `status=${drafts.status} visible=${Array.isArray(drafts.json) ? drafts.json.length : "n/a"}`
  );

  const moderation = await rest(
    "/physical_products?select=slug,status&status=eq.moderation"
  );
  check(
    "anon cannot read moderation rows",
    moderation.status === 200 &&
      Array.isArray(moderation.json) &&
      moderation.json.length === 0,
    `status=${moderation.status} visible=${Array.isArray(moderation.json) ? moderation.json.length : "n/a"}`
  );

  // --- anon writes ------------------------------------------------------
  const insert = await rest("/artists", {
    method: "POST",
    body: {
      slug: "anon-should-not-write",
      name: "anon",
      category: "x",
      bio: "x"
    }
  });
  check(
    "anon cannot insert artists",
    insert.status >= 400,
    `status=${insert.status}`
  );

  const update = await rest("/physical_products?slug=eq.test-sketch-42", {
    method: "PATCH",
    body: { price_rub: 1 }
  });
  check(
    "anon cannot update products",
    update.status >= 400,
    `status=${update.status}`
  );

  const del = await rest("/physical_products?slug=eq.test-sketch-42", {
    method: "DELETE"
  });
  check("anon cannot delete products", del.status >= 400, `status=${del.status}`);

  // --- limiter access ---------------------------------------------------
  const limiterTable = await rest("/cabinet_login_attempts?select=client_key");
  check(
    "anon cannot read the limiter table",
    limiterTable.status >= 400,
    `status=${limiterTable.status}`
  );

  const anonRpc = await rest("/rpc/check_cabinet_login_rate_limit", {
    method: "POST",
    body: { p_client_key: "anon-probe" }
  });
  check(
    "anon cannot call the limiter RPC",
    anonRpc.status >= 400,
    `status=${anonRpc.status}`
  );

  const anonReset = await rest("/rpc/reset_cabinet_login_rate_limit", {
    method: "POST",
    body: { p_client_key: "anon-probe" }
  });
  check(
    "anon cannot call the limiter reset RPC",
    anonReset.status >= 400,
    `status=${anonReset.status}`
  );

  // --- service role can read the limiter --------------------------------
  const serviceTable = await rest("/cabinet_login_attempts?select=client_key", {
    key: serviceRoleKey
  });
  check(
    "service_role can read the limiter table",
    serviceTable.status === 200,
    `status=${serviceTable.status}`
  );

  // --- concurrent first attempt -----------------------------------------
  const raceKey = `race-${Date.now()}`;
  await rest("/rpc/reset_cabinet_login_rate_limit", {
    method: "POST",
    key: serviceRoleKey,
    body: { p_client_key: raceKey }
  });

  const parallel = 8;
  const results2 = await Promise.all(
    Array.from({ length: parallel }, () =>
      rest("/rpc/check_cabinet_login_rate_limit", {
        method: "POST",
        key: serviceRoleKey,
        body: { p_client_key: raceKey }
      })
    )
  );

  const rpcErrors = results2.filter((r) => r.status !== 200);
  check(
    "all parallel limiter calls succeed",
    rpcErrors.length === 0,
    `errors=${rpcErrors.length} statuses=${[...new Set(results2.map((r) => r.status))].join(",")}`
  );

  const stored = await rest(
    `/cabinet_login_attempts?select=attempt_count,locked_until&client_key=eq.${raceKey}`,
    { key: serviceRoleKey }
  );
  const row = Array.isArray(stored.json) ? stored.json[0] : null;
  check(
    "parallel first attempts are counted exactly",
    row && row.attempt_count === parallel,
    `stored=${row ? row.attempt_count : "none"} expected=${parallel}`
  );

  const rows = await rest(
    `/cabinet_login_attempts?select=client_key&client_key=eq.${raceKey}`,
    { key: serviceRoleKey }
  );
  check(
    "parallel first attempts create exactly one row",
    Array.isArray(rows.json) && rows.json.length === 1,
    `rows=${Array.isArray(rows.json) ? rows.json.length : "n/a"}`
  );

  // --- limit is enforced ------------------------------------------------
  const limitKey = `limit-${Date.now()}`;
  await rest("/rpc/reset_cabinet_login_rate_limit", {
    method: "POST",
    key: serviceRoleKey,
    body: { p_client_key: limitKey }
  });

  let lastAllowed = null;
  for (let i = 0; i < 12; i += 1) {
    const response = await rest("/rpc/check_cabinet_login_rate_limit", {
      method: "POST",
      key: serviceRoleKey,
      body: { p_client_key: limitKey }
    });
    lastAllowed = response.json?.[0] ?? null;
  }
  check(
    "limiter blocks the request that reaches the limit",
    lastAllowed && lastAllowed.allowed === false && lastAllowed.locked === true,
    `last=${JSON.stringify(lastAllowed)}`
  );

  const lockedRow = await rest(
    `/cabinet_login_attempts?select=attempt_count,locked_until&client_key=eq.${limitKey}`,
    { key: serviceRoleKey }
  );
  const locked = Array.isArray(lockedRow.json) ? lockedRow.json[0] : null;
  check(
    "locked row keeps the exact counter",
    locked && locked.attempt_count === 10 && Boolean(locked.locked_until),
    `row=${JSON.stringify(locked)}`
  );

  // --- reset clears the counter -----------------------------------------
  await rest("/rpc/reset_cabinet_login_rate_limit", {
    method: "POST",
    key: serviceRoleKey,
    body: { p_client_key: limitKey }
  });
  const afterReset = await rest(
    `/cabinet_login_attempts?select=client_key&client_key=eq.${limitKey}`,
    { key: serviceRoleKey }
  );
  check(
    "reset removes the limiter row",
    Array.isArray(afterReset.json) && afterReset.json.length === 0,
    `rows=${Array.isArray(afterReset.json) ? afterReset.json.length : "n/a"}`
  );

  // --- cleanup ----------------------------------------------------------
  for (const key of [raceKey, limitKey]) {
    await rest(`/cabinet_login_attempts?client_key=eq.${key}`, {
      method: "DELETE",
      key: serviceRoleKey
    });
  }

  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${failed.length === 0 ? "ALL RUNTIME CHECKS PASSED" : `${failed.length} RUNTIME CHECKS FAILED`}`
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

await main();
