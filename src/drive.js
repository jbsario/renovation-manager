// ---------------------------------------------------------------------------
// Google Drive photo storage.
//
// Photos are uploaded to a private "Renovation Manager Photos" folder in the
// user's own Drive (drive.file scope). Only the returned Drive file id is kept
// in project data (and therefore in the Sheets database) — not the image bytes.
// This keeps the spreadsheet small and supports larger, higher-quality photos.
//
// Because the files are private, they can't be used directly as an <img src>.
// getPhotoUrl() fetches the bytes with the access token and returns a cached
// blob object-URL for rendering.
// ---------------------------------------------------------------------------

import { authFetch } from "./google";

const FOLDER_NAME = "Renovation Manager Photos";
let userEmail = "default";
const urlCache = new Map(); // fileId -> object URL

export function setDriveUser(email) {
  userEmail = email || "default";
}

const folderKey = () => `renovation_drive_folder_id:${userEmail}`;

// Downscale + JPEG-compress in the browser before upload. Drive isn't cell-size
// limited, so we can afford better quality than the old inline-base64 approach.
export function fileToCompressedBlob(file, maxDim = 1400, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
        else if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))),
          "image/jpeg",
          quality
        );
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function ensureFolder() {
  const saved = localStorage.getItem(folderKey());
  if (saved) {
    try {
      const r = await authFetch(`https://www.googleapis.com/drive/v3/files/${saved}?fields=id,trashed`);
      const d = await r.json();
      if (d && d.id && !d.trashed) return saved;
    } catch {
      // folder deleted / no access -> recreate
    }
  }
  const res = await authFetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
  });
  const data = await res.json();
  localStorage.setItem(folderKey(), data.id);
  return data.id;
}

// Upload a photo file; returns the Drive file id.
export async function uploadPhoto(file) {
  const blob = await fileToCompressedBlob(file);
  const folderId = await ensureFolder();
  const metadata = {
    name: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`,
    parents: [folderId],
  };
  const boundary = "rmboundary" + Math.random().toString(36).slice(2);
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify(metadata),
    `\r\n--${boundary}\r\nContent-Type: image/jpeg\r\n\r\n`,
    blob,
    `\r\n--${boundary}--`,
  ]);
  const res = await authFetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    }
  );
  const data = await res.json();
  return data.id;
}

// Resolve a Drive file id to a renderable object URL (cached).
export async function getPhotoUrl(fileId) {
  if (urlCache.has(fileId)) return urlCache.get(fileId);
  const res = await authFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  urlCache.set(fileId, url);
  return url;
}

// Best-effort delete (also frees the cached object URL).
export async function deletePhoto(fileId) {
  if (!fileId) return;
  try {
    await authFetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, { method: "DELETE" });
  } catch {
    // ignore — the reference is already gone from project data
  }
  const cached = urlCache.get(fileId);
  if (cached) {
    URL.revokeObjectURL(cached);
    urlCache.delete(fileId);
  }
}
