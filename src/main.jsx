import React from "react";
import ReactDOM from "react-dom/client";
import AuthGate from "./AuthGate.jsx";
import "./index.css";

// Authentication + data storage are handled by AuthGate:
//   * Google SSO gates the whole app (sign in required).
//   * After sign-in, `window.storage` is backed by a private Google Sheet in
//     the user's Drive, so data syncs across devices (see src/sheetsStorage.js).

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthGate />
  </React.StrictMode>
);
