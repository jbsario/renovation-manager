import React, { useEffect, useState } from "react";
import { Loader2, HardHat, ShieldAlert } from "lucide-react";
import App from "./App.jsx";
import {
  isConfigured, loadGoogle, initTokenClient, requestToken,
  getProfile, ensureSpreadsheet, signOut,
} from "./google";
import { initSheetsStorage } from "./sheetsStorage";
import { setDriveUser } from "./drive";

// phases: loading | signin | connecting | ready | error
export default function AuthGate() {
  const [phase, setPhase] = useState("loading");
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isConfigured()) {
      setError("Missing VITE_GOOGLE_CLIENT_ID — see README.md for setup.");
      setPhase("error");
      return;
    }
    let cancelled = false;
    loadGoogle()
      .then(() => {
        if (cancelled) return;
        initTokenClient();
        setPhase("signin");
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message);
        setPhase("error");
      });
    return () => { cancelled = true; };
  }, []);

  async function handleSignIn() {
    setError("");
    setPhase("connecting");
    try {
      const r = await requestToken(); // interactive
      if (r.error) throw new Error("Authorization was cancelled or denied.");
      const profile = await getProfile();
      setDriveUser(profile.email);
      const id = await ensureSpreadsheet(profile.email);
      await initSheetsStorage(id);
      setUser(profile);
      setPhase("ready");
    } catch (e) {
      setError(e.message || "Sign-in failed. Please try again.");
      setPhase("signin");
    }
  }

  function handleSignOut() {
    signOut();
    window.location.reload();
  }

  if (phase === "ready" && user) {
    return <App user={user} onSignOut={handleSignOut} />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F5F8] text-[#171A21] px-5">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
        .font-display { font-family: 'Space Grotesk', sans-serif; font-weight: 700; letter-spacing: -0.015em; }
        .font-cond { font-family: 'Inter', sans-serif; letter-spacing: 0.01em; }
        .font-body { font-family: 'Inter', sans-serif; }
        .font-mono { font-family: 'IBM Plex Mono', monospace; }
        .glogin { transition: box-shadow .15s ease, transform .1s ease; }
        .glogin:hover { box-shadow: 0 6px 18px -8px rgba(23,26,33,0.35); }
        .glogin:active { transform: translateY(1px); }
      `}</style>

      <div className="w-full max-w-sm bg-white border border-[#E9EBF0] rounded-2xl p-8 shadow-[0_10px_40px_-20px_rgba(23,26,33,0.35)]">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-[#FF6B4A] mb-3">
          <HardHat className="w-4 h-4" /> Renovation Management
        </div>
        <h1 className="font-display text-3xl mb-2">Sign in</h1>
        <p className="font-body text-sm text-[#64748B] mb-7">
          Your projects are stored privately in your own Google account via Google Sheets.
        </p>

        {phase === "error" ? (
          <div className="flex items-start gap-2 border border-[#F43F5E] bg-[#FEF0F1] text-[#B91C1C] text-sm font-body p-3 rounded-lg">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : (
          <>
            <button
              onClick={handleSignIn}
              disabled={phase !== "signin"}
              className="glogin w-full flex items-center justify-center gap-3 border border-[#DADCE0] bg-white rounded-lg py-2.5 font-cond font-semibold text-sm text-[#3C4043] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {phase === "connecting" ? (
                <><Loader2 className="w-4 h-4 animate-spin text-[#FF6B4A]" /> Connecting…</>
              ) : (
                <><GoogleG /> Continue with Google</>
              )}
            </button>
            {error && <p className="mt-3 font-body text-xs text-[#F43F5E]">{error}</p>}
            {phase === "loading" && (
              <p className="mt-3 font-mono text-[10px] text-[#94A3B8]">loading Google sign-in…</p>
            )}
          </>
        )}
      </div>

      <p className="mt-5 font-mono text-[10px] text-[#94A3B8]">
        Requests access to a single spreadsheet it creates for you.
      </p>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
