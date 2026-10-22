#!/usr/bin/env node
/**
 * Applies the Oukcion schema to an isolated Supabase project and verifies it.
 *
 * The script never touches production. It refuses to run unless the target
 * project ref is passed explicitly and is different from the production ref.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=<pat> PREVIEW_PROJECT_REF=<ref> \
 *   node scripts/preview-db-setup.mjs [--apply]
 *
 * Without --apply the script only reports the current state.
 */

import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTION_REF = "ekxqnzhylckbdptrooms";
const MANAGEMENT_API = "https://api.supabase.com";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.PREVIEW_PROJECT_REF;
const shouldApply = process.argv.includes("--apply");

if (!token) {
  console.error("SUPABASE_ACCESS_TOKEN is not set.");
  process.exit(2);
}

if (!projectRef) {
  console.error("PREVIEW_PROJECT_REF is not set.");
  process.exit(2);
}

if (projectRef === PRODUCTION_REF) {
  console.error(`Refusing to touch the production project ${PRODUCTION_REF}.`);
  process.exit(2);
}

const SCHEMA_FILES = [
  "supabase/artists.sql",
  "supabase/physical-products.sql",
  "supabase/media-storage.sql",
  "supabase/cabinet-login-attempts.sql"
];

const NEVER_APPLY = ["supabase/remove-demo-artists.sql"];

async function runSql(query) {
  const response = await fetch(
    `${MANAGEMENT_API}/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query })
    }
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`SQL failed (${response.status}): ${text.slice(0, 600)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function applySchema() {
  for (const file of SCHEMA_FILES) {
    const sql = await readFile(path.join(ROOT, file), "utf8");
    await runSql(sql);
    console.log(`applied ${file}`);
  }

  // Re-run the whole schema to prove it is idempotent.
  for (const file of SCHEMA_FILES) {
    const sql = await readFile(path.join(ROOT, file), "utf8");
    await runSql(sql);
    console.log(`re-applied ${file} (idempotency ok)`);
  }
}

function check(label, ok, detail = "") {
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark}  ${label}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

async function verify() {
  let ok = true;

  const tables = await runSql(`
    select table_name, row_security
    from pg_tables
    where schemaname = 'public'
      and table_name in ('artists', 'physical_products', 'cabinet_login_attempts')
    order by table_name;
  `);
  const tableMap = new Map(
    (Array.isArray(tables) ? tables : []).map((row) => [row.table_name, row.row_security])
  );

  for (const name of ["artists", "physical_products", "cabinet_login_attempts"]) {
    ok = check(`table ${name} exists`, tableMap.has(name)) && ok;
    ok =
      check(`table ${name} has RLS enabled`, tableMap.get(name) === true) && ok;
  }

  const policies = await runSql(`
    select tablename, policyname, roles, cmd
    from pg_policies
    where schemaname = 'public'
    order by tablename, policyname;
  `);
  console.log("  policies:", JSON.stringify(policies));

  const tableGrants = await runSql(`
    select table_name, grantee, privilege_type
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('artists', 'physical_products', 'cabinet_login_attempts')
      and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
    order by table_name, grantee, privilege_type;
  `);
  console.log("  table grants:", JSON.stringify(tableGrants));

  for (const name of ["artists", "physical_products"]) {
    const rows = (tableGrants || []).filter((row) => row.table_name === name);
    const clientGrants = rows.filter(
      (row) => row.grantee === "anon" || row.grantee === "authenticated"
    );
    const writable = clientGrants.filter(
      (row) => row.privilege_type !== "SELECT"
    );
    ok =
      check(
        `${name}: anon/authenticated have only SELECT`,
        writable.length === 0,
        JSON.stringify(writable)
      ) && ok;
  }

  const limiterGrants = (tableGrants || []).filter(
    (row) => row.table_name === "cabinet_login_attempts"
  );
  ok =
    check(
      "cabinet_login_attempts: no client grant",
      limiterGrants.length === 0,
      JSON.stringify(limiterGrants)
    ) && ok;

  const functions = await runSql(`
    select p.proname,
           p.prosecdef as security_definer,
           p.proconfig,
           pg_catalog.pg_get_functiondef(p.oid) as definition,
           has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
           has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('check_cabinet_login_rate_limit', 'reset_cabinet_login_rate_limit')
    order by p.proname;
  `);

  for (const fn of functions || []) {
    ok =
      check(
        `${fn.proname}: SECURITY DEFINER`,
        fn.security_definer === true
      ) && ok;
    ok =
      check(
        `${fn.proname}: empty search_path`,
        Array.isArray(fn.proconfig) &&
          fn.proconfig.some((entry) => entry === "search_path="),
        JSON.stringify(fn.proconfig)
      ) && ok;
    ok =
      check(
        `${fn.proname}: anon cannot EXECUTE`,
        fn.anon_execute === false
      ) && ok;
    ok =
      check(
        `${fn.proname}: authenticated cannot EXECUTE`,
        fn.authenticated_execute === false
      ) && ok;
    ok =
      check(
        `${fn.proname}: service_role can EXECUTE`,
        fn.service_role_execute === true
      ) && ok;
    ok =
      check(
        `${fn.proname}: all objects qualified`,
        !/\n\s*(select|insert|update|delete)\s+[a-z_]+/i.test(fn.definition || "") ||
          !/(from|into|update)\s+(?!public\.)[a-z_]+/i.test(fn.definition || ""),
        "statement targets must be schema qualified"
      ) && ok;
  }

  ok = check("both rate limit functions exist", (functions || []).length === 2) && ok;

  const buckets = await runSql(`
    select id, name, public, file_size_limit, allowed_mime_types
    from storage.buckets
    where id = 'oukcion-media';
  `);
  ok =
    check(
      "storage bucket oukcion-media exists and is public",
      (buckets || []).length === 1 && buckets[0].public === true,
      JSON.stringify(buckets)
    ) && ok;

  const storagePolicies = await runSql(`
    select policyname, cmd, roles
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
    order by policyname;
  `);
  console.log("  storage policies:", JSON.stringify(storagePolicies));

  const fingerprint = createHash("sha256")
    .update(JSON.stringify(functions || []))
    .digest("hex")
    .slice(0, 12);
  console.log(`  function fingerprint: ${fingerprint}`);

  console.log(ok ? "\nALL SCHEMA CHECKS PASSED" : "\nSOME SCHEMA CHECKS FAILED");
  return ok;
}

console.log(`target project: ${projectRef}`);
console.log(`apply mode: ${shouldApply}`);

if (shouldApply) {
  for (const file of NEVER_APPLY) {
    console.log(`never applied: ${file}`);
  }
  await applySchema();
}

const passed = await verify();
process.exit(passed ? 0 : 1);
