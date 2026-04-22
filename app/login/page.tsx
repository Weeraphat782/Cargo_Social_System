"use client";

import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const search = useSearchParams();
  const cb = search.get("callbackUrl") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl: cb,
      redirect: false,
    });
    if (result?.error) {
      setError("Invalid email or password.");
      setPending(false);
    } else if (result?.url) {
      window.location.href = result.url;
    }
  }

  return (
    <div style={{ width: "100%", maxWidth: 400 }}>
      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{
          width: 52, height: 52,
          background: "var(--accent)",
          borderRadius: 14,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px",
          boxShadow: "0 0 24px var(--accent-glow)",
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>OMG Social Agent</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>AI-powered social media management</p>
      </div>

      {/* Card */}
      <div className="omg-card" style={{ padding: "32px 28px" }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 20, marginTop: 0 }}>Sign in to your account</h2>

        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
              Email address
            </label>
            <input
              type="email"
              required
              className="omg-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              required
              className="omg-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div style={{
              background: "var(--danger-dim)",
              border: "1px solid rgba(255,77,106,0.3)",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              color: "var(--danger)",
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="omg-btn-primary"
            style={{ width: "100%", justifyContent: "center", padding: "12px 20px", fontSize: 15 }}
          >
            {pending ? (
              <>
                <span className="spinner" />
                Signing in…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                Sign in
              </>
            )}
          </button>
        </form>
      </div>

      {/* Powered by */}
      <p style={{ textAlign: "center", fontSize: 11, color: "var(--text-muted)", marginTop: 20 }}>
        Powered by Gemini · OMG Experience
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-base)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background glow */}
      <div style={{
        position: "absolute",
        top: "20%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 600,
        height: 600,
        background: "radial-gradient(circle, rgba(26,140,255,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <Suspense fallback={<div className="spinner" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
