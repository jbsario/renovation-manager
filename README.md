# Renovation Manager

A client-side React + Vite app for tracking house-renovation projects — scope of
works, daily updates, progress by area, timeline, budget, materials, punch list
and photos.

- **Login:** Google SSO (Sign in with Google). Login is required to use the app.
- **Database:** the signed-in user's own **Google Sheets**. On first sign-in the
  app creates a private spreadsheet (`Renovation Manager — <email>`) in the
  user's Google Drive and uses it as a key/value store, so data syncs across any
  device where they sign in. No separate backend/server is required.

## Quick start

```bash
npm install
cp .env.example .env      # then paste your Google client ID into .env
npm run dev
```

## Google setup (one time)

You need a Google OAuth **Web application** client ID.

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) → create
   (or pick) a project.
2. **APIs & Services → Library** → enable the **Google Sheets API** and the
   **Google Drive API**.
3. **APIs & Services → OAuth consent screen** → configure it (External is fine),
   and add these scopes:
   - `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/spreadsheets`
   While the app is in "Testing", add your Google account under **Test users**.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID** →
   **Web application**. Under **Authorized JavaScript origins** add the URLs the
   app runs on, e.g.:
   - `http://localhost:5173` (Vite dev server)
   - your production URL (e.g. `https://your-app.vercel.app`)
5. Copy the generated **Client ID** into `.env`:
   ```
   VITE_GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
   ```

## How storage works

`window.storage` (used throughout `src/App.jsx`) is backed by a single `kv`
sheet. Each stored value is JSON and, because a Sheets cell holds at most 50,000
characters, large values (e.g. base64 photos) are split into ~40k-char chunks
across rows keyed by `key` + `idx`. See `src/sheetsStorage.js` and
`src/google.js`.

### Photos

Photos are **not** stored in the spreadsheet. They are uploaded (downscaled +
JPEG-compressed) to a private `Renovation Manager Photos` folder in the user's
Google Drive; only the Drive file id is kept in project data. Because the files
are private, they're fetched with the access token and rendered via blob object
URLs (see `src/drive.js` and the `DrivePhoto` component in `src/App.jsx`). Any
photos saved before this change (inline base64) still render via a fallback.

## Deployment (Vercel)

Whichever option you pick, you must do these two things once:

1. In the Vercel project → **Settings → Environment Variables**, add
   `VITE_GOOGLE_CLIENT_ID` (Production + Preview). Vite bakes it in at build
   time, so redeploy after changing it.
2. In Google Cloud Console → OAuth client → **Authorized JavaScript origins**,
   add your Vercel URL (e.g. `https://renovation-manager-app.vercel.app`).

### Option A — Vercel Git integration (simplest, recommended)

In the Vercel dashboard, connect the project to the GitHub repo
(**Settings → Git**). After that, every push to `main` deploys automatically.
No secrets or workflow needed — if you use this, ignore Option B.

### Option B — GitHub Actions (`.github/workflows/deploy.yml`)

Included in this repo. It deploys on every push to `main` using the Vercel CLI.
Add these **repository secrets** (GitHub → Settings → Secrets and variables →
Actions):

| Secret | Where to get it |
| --- | --- |
| `VERCEL_TOKEN` | https://vercel.com/account/tokens |
| `VERCEL_ORG_ID` | run `vercel link` locally → `.vercel/project.json`, or Vercel project settings |
| `VERCEL_PROJECT_ID` | same as above |

> Use **either** Option A **or** Option B — enabling both causes duplicate
> deploys. If you rely on Git integration, delete `.github/workflows/deploy.yml`.
