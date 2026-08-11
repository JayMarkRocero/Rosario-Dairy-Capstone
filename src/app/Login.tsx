// components/Login.tsx
import { useState } from "react";
import { Eye, EyeOff, Lock, User, LogIn, ArrowLeft, Milk, HelpCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "../components";
import { C } from "../constants/colors";
import { api, setAccessToken } from "../lib/api";

type Role = "admin" | "staff";

interface Props {
  onSelect: (role: Role) => void;
  onBack?: () => void;
}

/**
 * Save your two uploaded files into /public with these exact names
 * (or update the paths below to wherever you keep them):
 *   - /assets/images/logo.jpg   → the Rosario Dairy cooperative badge
 *   - /assets/images/bg.jpg     → the storefront photo
 * If either file is missing, everything falls back gracefully.
 */
const LOGO_SRC = "assets/images/logo.jpg";
const BG_SRC = "assets/images/bg.jpg";

function BrandMark({ size = 64 }: { size?: number }) {
  const [imgFailed, setImgFailed] = useState(false);

  if (!imgFailed) {
    return (
      <div
        className="rounded-full bg-white flex items-center justify-center flex-shrink-0 overflow-hidden"
        style={{ width: size, height: size }}
      >
        <img
          src={LOGO_SRC}
          alt="Rosario Dairy"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center rounded-full flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: C.blue }}
    >
      <Milk size={size * 0.5} className="text-white" />
    </div>
  );
}

function TermsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Terms & Conditions" subtitle="Rosario Dairy Management System" size="md"
      footer={<button onClick={onClose} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90"
        style={{ backgroundColor: C.navy }}>Close</button>}>
      <div className="space-y-4 text-sm" style={{ color: C.muted }}>
        <p>
          By using this system, you agree to access it only for authorized business purposes
          related to Rosario Dairy's inventory, sales, and customer operations.
        </p>
        <p>
          Your account credentials are personal and must not be shared. Any activity performed
          under your account is your responsibility. Report any suspected unauthorized access
          to an administrator immediately.
        </p>
        <p>
          Data entered into this system including customer information, transactions, and
          inventory records is confidential and must not be disclosed outside of authorized
          business use.
        </p>
        <p>
          This system is provided for internal use. Features and data are subject to change as
          the system continues to be developed.
        </p>
      </div>
    </Modal>
  );
}

function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Forgot Password" size="sm"
      footer={<button onClick={onClose} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90"
        style={{ backgroundColor: C.navy }}>Got it</button>}>
      <div className="space-y-4 text-sm" style={{ color: C.muted }}>
        <div className="flex items-center gap-2 mb-1">
          <HelpCircle size={16} style={{ color: C.blue }} />
          <span className="font-semibold" style={{ color: C.text }}>Password resets require another user</span>
        </div>

        <div>
          <p className="font-semibold text-xs mb-1" style={{ color: C.text }}>If you're a Staff account:</p>
          <p>
            Ask any Administrator to reset your password for you. They can do this from the
            User Management panel — no need to remember your old password.
          </p>
        </div>

        <div>
          <p className="font-semibold text-xs mb-1" style={{ color: C.text }}>If you're an Administrator:</p>
          <p>
            Ask another Administrator to reset your password the same way, through User Management.
          </p>
          <p className="mt-1.5">
            If you're the only Administrator account, this system currently has no self-service
            recovery option. You'll need to contact your development team to reset it directly.
          </p>
        </div>
      </div>
    </Modal>
  );
}

export function Login({ onSelect, onBack }: Props) {
  const [username,  setUsername]  = useState("");
  const [password,  setPassword]  = useState("");
  const [showPass,  setShowPass]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [bgFailed, setBgFailed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Please enter both username and password.");
      return;
    }
    if (!agreedToTerms) {
      setError("Please agree to the Terms & Conditions to continue.");
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
    <div className="min-h-screen flex" style={{ backgroundColor: "#EEF2F6" }}>
      {/* Left branding panel — hidden on mobile, visible from md up */}
      <div
        className="hidden md:flex md:w-1/2 lg:w-3/5 flex-col justify-between p-10 lg:p-14 relative"
        style={{
          backgroundColor: C.navy,
          backgroundImage: bgFailed
            ? undefined
            : `linear-gradient(160deg, rgba(15,42,74,0.85) 0%, rgba(15,42,74,0.55) 45%, rgba(15,42,74,0.9) 100%), url(${BG_SRC})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          clipPath: "url(#loginCurveClip)",
        }}
      >
        {/* S-curve: two mirrored bezier segments meeting at the midpoint,
            so the boundary bends one way, then the other, top to bottom. */}
        <svg width="0" height="0" className="absolute">
          <defs>
            <clipPath id="loginCurveClip" clipPathUnits="objectBoundingBox">
              <path d="M0,0 L0.84,0 C0.60,0.18 1.00,0.32 0.84,0.5 C0.68,0.68 1.04,0.82 0.84,1 L0,1 Z" />
            </clipPath>
          </defs>
        </svg>

        {/* hidden probe image so we know if BG_SRC actually exists */}
        <img src={BG_SRC} alt="" className="hidden" onError={() => setBgFailed(true)} />

        <div className="relative z-10 flex items-center gap-3">
          <BrandMark size={56} />
          <div>
            <p className="text-base font-semibold text-white leading-tight" style={{ fontFamily: "Poppins, sans-serif" }}>
              Rosario Dairy
            </p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
              Management System
            </p>
          </div>
        </div>

        <p className="relative z-10 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
          &copy; {new Date().getFullYear()} Rosario Dairy
        </p>
      </div>

      {/* Right / mobile-only login panel */}
      <div
        className="flex-1 flex flex-col relative"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 15%, rgba(23,55,94,0.05), transparent 45%), radial-gradient(circle at 85% 85%, rgba(23,55,94,0.04), transparent 50%)",
        }}
      >
        <div className="p-6 sm:p-10 pb-0">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-sm font-medium hover:opacity-70 transition-opacity flex-shrink-0"
              style={{ color: C.muted }}
            >
              <ArrowLeft size={15} />
              Back
            </button>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-10">
          {/* Mobile-only logo */}
          <div className="flex md:hidden items-center gap-3 mb-8">
            <BrandMark size={48} />
            <div>
              <h1 className="text-xl font-bold" style={{ color: C.navy, fontFamily: "Poppins, sans-serif" }}>
                Rosario Dairy
              </h1>
              <p className="text-xs" style={{ color: C.muted }}>Management System</p>
            </div>
          </div>

          <div
            className="w-full max-w-sm rounded-2xl p-7 sm:p-8"
            style={{
              backgroundColor: C.white,
              border: `1px solid ${C.border}`,
              boxShadow: "0 24px 60px -30px rgba(15,42,74,0.28)",
            }}
          >
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold mb-4"
              style={{ backgroundColor: "#DBEAFE", color: C.blue }}
            >
              <ShieldCheck size={12} />
              Secure sign in
            </div>

            <h2 className="text-2xl font-bold tracking-tight" style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}>
              Welcome back
            </h2>
            <p className="text-sm mt-1.5 mb-6" style={{ color: C.muted }}>
              Sign in to access your dashboard
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username */}
              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: C.muted }}>
                  Username
                </label>
                <div
                  className="flex items-center gap-2.5 rounded-xl px-4 py-3 border transition-all focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.15)]"
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
                  <button
                    type="button"
                    onClick={() => setForgotOpen(true)}
                    className="text-xs font-medium hover:opacity-70"
                    style={{ color: C.blue }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div
                  className="flex items-center gap-2.5 rounded-xl px-4 py-3 border transition-all focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.15)]"
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

              {/* Terms & Conditions */}
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={e => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded flex-shrink-0 cursor-pointer"
                  style={{ accentColor: C.navy }}
                />
                <span className="text-xs" style={{ color: C.muted }}>
                  I agree to the{" "}
                  <button
                    type="button"
                    onClick={() => setTermsOpen(true)}
                    className="font-semibold underline hover:opacity-70"
                    style={{ color: C.blue }}
                  >
                    Terms & Conditions
                  </button>
                </span>
              </label>

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
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5"
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

        <div className="px-6 sm:px-10 pb-6 sm:pb-8">
          <p className="text-xs text-center flex items-center justify-center gap-1.5" style={{ color: C.muted }}>
            Rosario Dairy Management System &copy; {new Date().getFullYear()}
            <span aria-hidden="true">·</span>
            FEFO + SARIMA Analytics
          </p>
        </div>
      </div>

      {termsOpen && <TermsModal onClose={() => setTermsOpen(false)} />}
      {forgotOpen && <ForgotPasswordModal onClose={() => setForgotOpen(false)} />}
    </div>
  );
}