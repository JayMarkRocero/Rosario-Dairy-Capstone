// components/Login.tsx
import { useState } from "react";
import { Eye, EyeOff, Lock, User, LogIn, ShieldCheck, ArrowLeft, Milk } from "lucide-react";
import { toast } from "sonner";
import { C } from "../constants/colors";
import { api, setAccessToken } from "../lib/api";

type Role = "admin" | "staff";

interface Props {
  onSelect: (role: Role) => void;
  onBack?: () => void;
}

export function Login({ onSelect, onBack }: Props) {
  const [username,  setUsername]  = useState("");
  const [password,  setPassword]  = useState("");
  const [showPass,  setShowPass]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Please enter both username and password.");
      return;
    }

    setLoading(true);

    api.login({ username: username.trim(), password })
      .then(tokens => {
        setAccessToken(tokens.access);
        return api.getCurrentUser();
      })
      .then(user => {
        toast.success(`Welcome back, ${user.username}!`);
        onSelect(user.role);
      })
      .catch(() => {
        setError("Invalid username or password.");
        toast.error("Login failed. Please check your credentials.");
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: C.bg }}>
      {/* Left branding panel — hidden on mobile, visible from md up */}
      <div
        className="hidden md:flex md:w-1/2 lg:w-3/5 flex-col items-center justify-center p-10 relative overflow-hidden"
        style={{
          background: `linear-gradient(160deg, ${C.navy} 0%, #0F2A4A 100%)`,
        }}
      >
        {/* Decorative soft blobs */}
        <div
          className="absolute rounded-full opacity-20 blur-3xl"
          style={{ width: 380, height: 380, top: -80, right: -80, backgroundColor: C.blue }}
        />
        <div
          className="absolute rounded-full opacity-10 blur-3xl"
          style={{ width: 300, height: 300, bottom: -60, left: -60, backgroundColor: "#fff" }}
        />

        <div className="relative z-10 flex flex-col items-center text-center max-w-md">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl mb-6"
            style={{ backgroundColor: C.blue }}
          >
            <Milk size={28} className="text-white" />
          </div>
          <h1
            className="text-3xl font-bold text-white mb-2 tracking-tight"
            style={{ fontFamily: "Poppins, sans-serif" }}
          >
            Rosario Dairy
          </h1>
          <p className="text-sm mb-10" style={{ color: "rgba(255,255,255,0.55)" }}>
            Management System
          </p>

          <div className="grid grid-cols-1 gap-3 w-full max-w-xs">
            {[
              "Real-time inventory & FEFO tracking",
              "Sales forecasting with SARIMA analytics",
              "Role-based access for admin & staff",
            ].map(f => (
              <div
                key={f}
                className="flex items-center gap-3 text-left text-xs px-4 py-3 rounded-xl"
                style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.75)" }}
              >
                <ShieldCheck size={14} className="flex-shrink-0" style={{ color: C.blue }} />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right / mobile-only login panel */}
      <div className="flex-1 flex flex-col p-6 sm:p-10">
        {/* Back button */}
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-medium mb-6 hover:opacity-70 transition-opacity flex-shrink-0 self-start"
            style={{ color: C.muted }}
          >
            <ArrowLeft size={15} />
            Back
          </button>
        )}

        <div className="flex-1 flex flex-col items-center justify-center">
          {/* Mobile-only logo */}
          <div className="flex md:hidden items-center gap-3 mb-8">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ backgroundColor: C.navy }}
            >
              <Milk size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: C.navy, fontFamily: "Poppins, sans-serif" }}>
                Rosario Dairy
              </h1>
              <p className="text-xs" style={{ color: C.muted }}>Management System</p>
            </div>
          </div>

          <div className="w-full max-w-sm">
            <div className="mb-7">
              <h2 className="text-2xl font-bold tracking-tight" style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}>
                Welcome back
              </h2>
              <p className="text-sm mt-1.5" style={{ color: C.muted }}>
                Sign in to access your dashboard
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username */}
              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: C.muted }}>
                  Username
                </label>
                <div
                  className="flex items-center gap-2.5 rounded-xl px-4 py-3 border transition-colors focus-within:border-blue-400 focus-within:ring-2"
                  style={{ borderColor: C.border, backgroundColor: "#F8FAFC" }}
                >
                  <User size={16} style={{ color: C.muted }} />
                  <input
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="your username"
                    className="bg-transparent outline-none text-sm flex-1 min-w-0"
                    style={{ color: C.text }}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold" style={{ color: C.muted }}>
                    Password
                  </label>
                </div>
                <div
                  className="flex items-center gap-2.5 rounded-xl px-4 py-3 border transition-colors focus-within:border-blue-400"
                  style={{ borderColor: C.border, backgroundColor: "#F8FAFC" }}
                >
                  <Lock size={16} style={{ color: C.muted }} />
                  <input
                    type={showPass ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-transparent outline-none text-sm flex-1 min-w-0"
                    style={{ color: C.text }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="flex-shrink-0"
                    style={{ color: C.muted }}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  className="text-xs px-3.5 py-2.5 rounded-xl"
                  style={{ backgroundColor: C.red + "10", color: C.red }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 hover:opacity-90 shadow-sm"
                style={{ backgroundColor: C.navy }}
              >
                {loading ? "Signing in…" : (
                  <>
                    <LogIn size={16} />
                    Sign In
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        <p className="text-xs text-center mt-8 flex-shrink-0" style={{ color: C.muted }}>
          Rosario Dairy Management System &copy; {new Date().getFullYear()} — FEFO + SARIMA Analytics
        </p>
      </div>
    </div>
  );
}