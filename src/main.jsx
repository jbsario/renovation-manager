import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

/**
 * Drop-in replacement for the Claude-artifact `window.storage` API,
 * backed by the browser's own localStorage. Same method signatures,
 * so App.jsx (lifted straight from the Claude artifact) needs no changes.
 *
 * Note: this means data lives only in the current browser/device.
 * There is no cross-device sync without adding a real backend
 * (e.g. Supabase, Firebase) later.
 */
window.storage = {
  async get(key /*, shared */) {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    return { key, value: raw, shared: false };
  },
  async set(key, value /*, shared */) {
    window.localStorage.setItem(key, value);
    return { key, value, shared: false };
  },
  async delete(key /*, shared */) {
    window.localStorage.removeItem(key);
    return { key, deleted: true, shared: false };
  },
  async list(prefix = "" /*, shared */) {
    const keys = Object.keys(window.localStorage).filter((k) => k.startsWith(prefix));
    return { keys, prefix, shared: false };
  },
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
