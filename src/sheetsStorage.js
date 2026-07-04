// ---------------------------------------------------------------------------
// Google Sheets as a key/value database.
//
// The app (App.jsx) talks to `window.storage` with get/set/delete/list — the
// same shape as the original localStorage shim. Here we back that interface
// with a single "kv" sheet:
//
//     key            | idx | value
//     project_index  | 0   | [{"id":...}]
//     project:abc123 | 0   | (first 40k chars of JSON)
//     project:abc123 | 1   | (next 40k chars)  ...
//
// Values are chunked because a Sheets cell holds at most 50,000 characters and
// base64 photos easily exceed that. Reads are served from an in-memory cache
// loaded once at startup; writes rewrite the sheet (debounced by the app and
// serialized here).
// ---------------------------------------------------------------------------

import { sheetsFetch } from "./google";

const CHUNK = 40000;
let spreadsheetId = null;
let cache = new Map(); // key -> full string value
let flushChain = Promise.resolve();

function valuesUrl(range, suffix = "") {
  return `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}${suffix}`;
}

export async function initSheetsStorage(id) {
  spreadsheetId = id;
  cache = new Map();

  const res = await sheetsFetch(valuesUrl("kv!A2:C"));
  const data = await res.json();
  const rows = data.values || [];

  // group chunk rows by key, then reassemble in idx order
  const groups = new Map();
  for (const row of rows) {
    const key = row[0];
    if (!key) continue;
    const idx = Number(row[1]) || 0;
    const val = row[2] || "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ idx, val });
  }
  for (const [key, parts] of groups) {
    parts.sort((a, b) => a.idx - b.idx);
    cache.set(key, parts.map((p) => p.val).join(""));
  }

  installWindowStorage();
}

function installWindowStorage() {
  window.storage = {
    async get(key) {
      if (!cache.has(key)) return null;
      return { key, value: cache.get(key), shared: false };
    },
    async set(key, value) {
      cache.set(key, String(value));
      scheduleFlush();
      return { key, value, shared: false };
    },
    async delete(key) {
      cache.delete(key);
      scheduleFlush();
      return { key, deleted: true, shared: false };
    },
    async list(prefix = "") {
      const keys = [...cache.keys()].filter((k) => k.startsWith(prefix));
      return { keys, prefix, shared: false };
    },
  };
}

function scheduleFlush() {
  flushChain = flushChain.then(flush).catch((e) => console.error("Sheets sync failed:", e));
}

// Rewrite the whole kv sheet from the current cache. Idempotent, so overlapping
// queued flushes simply persist the latest state.
async function flush() {
  const rows = [];
  for (const [key, value] of cache) {
    if (value.length === 0) {
      rows.push([key, 0, ""]);
      continue;
    }
    for (let i = 0, idx = 0; i < value.length; i += CHUNK, idx++) {
      rows.push([key, idx, value.slice(i, i + CHUNK)]);
    }
  }

  await sheetsFetch(valuesUrl("kv!A2:C", ":clear"), { method: "POST" });
  if (rows.length > 0) {
    await sheetsFetch(valuesUrl("kv!A2", "?valueInputOption=RAW"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: rows }),
    });
  }
}
