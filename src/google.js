// ---------------------------------------------------------------------------
// Google Identity Services (OAuth 2.0 token flow) + Google Sheets REST helpers.
//
// A single sign-in grants BOTH:
//   * identity  (openid / email / profile  -> used for SSO login)
//   * data      (drive.file / spreadsheets  -> used for the Sheets database)
//
// Everything runs in the browser; there is no backend. The app creates one
// private spreadsheet per user (in their own Drive) and uses it as storage.
// ---------------------------------------------------------------------------

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const SCOPES = [
  "openid",
  "email",
  "profile",
  // create + access ONLY the spreadsheet this app makes (least privilege)
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
].join(" ");

let tokenClient = null;
let accessToken = null;
let pendingResolve = null;

export function isConfigured() {
  return Boolean(CLIENT_ID);
}

// Wait for the GIS script (loaded in index.html) to be ready.
export function loadGoogle() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const started = Date.now();
    const timer = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - started > 10000) {
        clearInterval(timer);
        reject(new Error("Google sign-in script failed to load. Check your connection or ad blocker."));
      }
    }, 50);
  });
}

export function initTokenClient() {
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (resp) => {
      const done = pendingResolve;
      pendingResolve = null;
      if (resp.error) {
        done && done({ error: resp.error });
        return;
      }
      accessToken = resp.access_token;
      done && done({ token: resp.access_token });
    },
  });
}

// prompt: pass "" for a silent refresh, or omit for the interactive sign-in.
export function requestToken(prompt) {
  return new Promise((resolve) => {
    pendingResolve = resolve;
    if (prompt === undefined) tokenClient.requestAccessToken();
    else tokenClient.requestAccessToken({ prompt });
  });
}

export function getAccessToken() {
  return accessToken;
}

export async function getProfile() {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch Google profile");
  return res.json(); // { sub, email, name, given_name, picture, ... }
}

// fetch wrapper that attaches the token and transparently refreshes on 401.
export async function sheetsFetch(url, opts = {}, retry = true) {
  const res = await fetch(url, {
    ...opts,
    headers: { ...(opts.headers || {}), Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401 && retry) {
    const r = await requestToken(""); // silent refresh
    if (r.token) return sheetsFetch(url, opts, false);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Sheets API ${res.status}: ${text}`);
  }
  return res;
}

const dbIdKey = (email) => `renovation_sheets_db_id:${email}`;

// Find (or create) this user's private spreadsheet; returns its id.
export async function ensureSpreadsheet(email) {
  const saved = localStorage.getItem(dbIdKey(email));
  if (saved) {
    try {
      const r = await sheetsFetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${saved}?fields=spreadsheetId`
      );
      if (r.ok) return saved;
    } catch {
      // spreadsheet was deleted / no access -> fall through and recreate
    }
  }

  const res = await sheetsFetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: { title: `Renovation Manager — ${email}` },
      sheets: [{ properties: { title: "kv" } }],
    }),
  });
  const data = await res.json();
  const id = data.spreadsheetId;

  // header row
  await sheetsFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent("kv!A1")}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: [["key", "idx", "value"]] }),
    }
  );

  localStorage.setItem(dbIdKey(email), id);
  return id;
}

export function signOut() {
  if (accessToken && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(accessToken, () => {});
    } catch {
      /* ignore */
    }
  }
  accessToken = null;
}
