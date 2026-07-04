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

> Note: photos are stored inline as compressed base64 in the spreadsheet. This
> keeps everything in one place but is not ideal for very large photo sets — a
> future improvement would be to store images in Drive/Cloud Storage and keep
> only references in the sheet.

## Deployment

Any static host works (the app is fully client-side). On Vercel/Netlify, set the
`VITE_GOOGLE_CLIENT_ID` environment variable and add the deployed URL to the
OAuth client's **Authorized JavaScript origins**.
