/**
 * Diagnostic mock of the Supabase PostgREST + Storage surface that
 * "Оукцион" (lib/artists.ts, lib/supabase-admin.ts, app/cabinet/artists/actions.ts)
 * actually talks to. Used to verify the *data path* end-to-end without
 * touching the production database.
 *
 * Implements:
 *   GET    /rest/v1/artists?select=..&featured=eq.true&order=..&limit=N
 *   GET    /rest/v1/physical_products?select=..&status=eq.published&artist_slug=in.(..)
 *   HEAD   /rest/v1/physical_products?select=id  (Prefer: count=exact)
 *   POST   /rest/v1/<table>?on_conflict=slug       (upsert)
 *   PATCH  /rest/v1/<table>?slug=eq.X
 *   DELETE /rest/v1/<table>?slug=eq.X
 *   POST   /storage/v1/object/<bucket>/<path>
 *   GET    /storage/v1/object/public/<bucket>/<path>
 */
import http from "node:http";

const PORT = Number(process.env.MOCK_PORT || 54321);
const state = {
  artists: [],
  physical_products: [],
  cabinet_login_attempts: [],
  hiddenTables: [],
  storage: new Map(),
  log: [],
};

function parseFilters(q) {
  const f = {};
  for (const [k, v] of Object.entries(q)) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(k)) continue;
    if (v.startsWith("eq.")) f[k] = ["eq", v.slice(3)];
    else if (v.startsWith("in.")) f[k] = ["in", v.slice(3).replace(/^\(|\)$/g, "").split(",")];
    else f[k] = ["raw", v];
  }
  return f;
}

function applyFilters(rows, filters) {
  return rows.filter((row) =>
    Object.entries(filters).every(([k, [op, val]]) => {
      const v = row[k];
      if (op === "eq") return String(v) === String(val);
      if (op === "in") return val.map(String).includes(String(v));
      return true;
    })
  );
}

function applyOrder(rows, order) {
  if (!order) return rows;
  const specs = order.split(",").map((s) => {
    const [col, dir] = s.split(".");
    return { col, desc: dir === "desc" };
  });
  return [...rows].sort((a, b) => {
    for (const s of specs) {
      const av = a[s.col], bv = b[s.col];
      if (av === bv) continue;
      const cmp = av > bv ? 1 : -1;
      return s.desc ? -cmp : cmp;
    }
    return 0;
  });
}

function project(row, select) {
  if (!select || select === "*") return { ...row };
  const cols = select.split(",").map((s) => s.trim());
  const out = {};
  for (const c of cols) {
    if (c === "*") { Object.assign(out, row); continue; }
    if (c.includes("->")) continue;
    out[c] = row[c] ?? null;
  }
  return out;
}

function body(req) {
  return new Promise((resolve) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => resolve(d));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const q = Object.fromEntries(url.searchParams.entries());
  const raw = await body(req);
  state.log.push(`${req.method} ${url.pathname} ${url.search}`);

  const json = (code, obj, headers = {}) => {
    const s = JSON.stringify(obj);
    res.writeHead(code, { "Content-Type": "application/json", ...headers });
    res.end(s);
  };

  // ---- storage ----------------------------------------------------------
  if (url.pathname.startsWith("/storage/v1/object/public/")) {
    const p = url.pathname.replace("/storage/v1/object/public/", "");
    const data = state.storage.get(p);
    if (!data) return json(404, { message: "not found" });
    res.writeHead(200, { "Content-Type": data.contentType, "Content-Length": data.body.length });
    return res.end(data.body);
  }
  if (url.pathname.startsWith("/storage/v1/object/") && req.method === "POST") {
    const p = url.pathname.replace("/storage/v1/object/", "");
    state.storage.set(p, {
      body: Buffer.from(raw, "binary"),
      contentType: req.headers["content-type"] || "application/octet-stream",
    });
    return json(200, { Key: p, path: p });
  }

  // ---- postgrest --------------------------------------------------------
  const m = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/);
  if (!m) return json(404, { message: `no route ${url.pathname}` });
  const table = m[1];
  if (state.hiddenTables && state.hiddenTables.includes(table)) {
    return json(404, { message: `relation "${table}" does not exist` });
  }
  if (!state[table]) return json(404, { message: `relation "${table}" does not exist` });

  const filters = parseFilters(q);
  let rows = applyFilters(state[table], filters);

  if (req.method === "GET" || req.method === "HEAD") {
    if (state.errorTables && state.errorTables.includes(table)) {
      return json(500, { message: "internal error", code: "PGRST301" });
    }
    rows = applyOrder(rows, q.order);
    if (q.limit) rows = rows.slice(0, Number(q.limit));
    const count = applyFilters(state[table], filters).length;
    const headers = { "Content-Range": `0-${Math.max(rows.length - 1, 0)}/${count}` };
    if (req.method === "HEAD") {
      res.writeHead(200, headers);
      return res.end();
    }
    return json(200, rows.map((r) => project(r, q.select)), headers);
  }

  if (req.method === "POST") {
    const payload = raw ? JSON.parse(raw) : {};
    const arr = Array.isArray(payload) ? payload : [payload];
    for (const row of arr) {
      const conflictKey = q.on_conflict ? row[q.on_conflict] : undefined;
      if (conflictKey) {
        const idx = state[table].findIndex((x) => x[q.on_conflict] === conflictKey);
        const full = {
          id: state[table][idx]?.id || `id-${state[table].length + 1}`,
          created_at: state[table][idx]?.created_at || new Date().toISOString(),
          ...row
        };
        if (idx >= 0) state[table][idx] = full;
        else state[table].push(full);
      } else {
        state[table].push({
          id: row.id || `id-${state[table].length + 1}`,
          created_at: new Date().toISOString(),
          ...row
        });
      }
    }
    return json(201, arr.map((r) => project(r, q.select)));
  }

  if (req.method === "PATCH" || req.method === "DELETE") {
    if (req.method === "PATCH") {
      const payload = raw ? JSON.parse(raw) : {};
      for (const r of state[table]) {
        if (Object.entries(filters).every(([k, [op, val]]) => (op === "eq" ? String(r[k]) === String(val) : true))) {
          Object.assign(r, payload);
        }
      }
      return json(200, []);
    }
    const before = state[table].length;
    state[table] = state[table].filter((r) =>
      !Object.entries(filters).every(([k, [op, val]]) => (op === "eq" ? String(r[k]) === String(val) : true))
    );
    return json(200, []);
  }

  return json(405, { message: "method not allowed" });
});

server.listen(PORT, () => {
  console.log(`mock postgrest on http://localhost:${PORT}`);
  console.log(`SEED=${process.env.MOCK_SEED || "none"}`);
});

// Add control endpoints
const control2 = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:3002");
  if (url.pathname === "/error") {
    const data = JSON.parse(await body(req));
    state.errorTables = data.tables || [];
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }
  if (url.pathname === "/clear") {
    state.errorTables = [];
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }
  res.writeHead(404);
  res.end();
});
control2.listen(3003);

// control endpoints for the harness
const control = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:3002");
  if (url.pathname === "/seed") {
    const data = JSON.parse(await body(req));
    state.artists = data.artists || [];
    state.physical_products = data.products || [];
    state.cabinet_login_attempts = data.cabinet_login_attempts || [];
    state.hiddenTables = data.hiddenTables || [];
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }
  if (url.pathname === "/state") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ artists: state.artists, products: state.physical_products, attempts: state.cabinet_login_attempts, hiddenTables: state.hiddenTables, storage: [...state.storage.keys()], log: state.log }));
  }
  if (url.pathname === "/reset") {
    state.artists = []; state.physical_products = []; state.cabinet_login_attempts = []; state.hiddenTables = []; state.storage.clear(); state.log = [];
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }
  res.writeHead(404); res.end();
});
control.listen(3002, () => console.log("control on http://localhost:3002"));

// Add control endpoints
const origListen = server.listen;
