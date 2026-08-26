// src/app/Login.tsx
import { useState } from "react";
import {
  Eye,
  EyeOff,
  Lock,
  User,
  ArrowLeft,
  ArrowRight,
  Milk,
  HelpCircle,
  PackageCheck,
  ShoppingCart,
  TrendingUp,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/overlays/Modal";
import { C } from "@/styles/tokens/colors";
import { useAuth } from "@/features/auth/context/AuthContext";
import { ApiError } from "@/lib/api";

interface Props {
  onBack?: () => void;
}

const LOGO_SRC = "assets/images/logo.jpg";
const BG_SRC = "assets/images/bg.jpg";

/* ------------------------------------------------------------------ */
/*  Entrance animation styles — scoped, reduced-motion safe            */
/* ------------------------------------------------------------------ */

function LoginAnimationStyles() {
  return (
    <style>{`
      @keyframes rd-fade-in { from { opacity: 0; } to { opacity: 1; } }
      @keyframes rd-slide-up {
        from { opacity: 0; transform: translateY(18px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes rd-slide-left {
        from { opacity: 0; transform: translateX(-14px); }
        to { opacity: 1; transform: translateX(0); }
      }
      @media (prefers-reduced-motion: no-preference) {
        .rd-anim-bg { animation: rd-fade-in 700ms ease-out both; }
        .rd-anim-brand { animation: rd-slide-left 500ms ease-out 150ms both; }
        .rd-anim-marketing { animation: rd-slide-up 550ms ease-out 300ms both; }
        .rd-anim-card { animation: rd-slide-up 500ms ease-out 200ms both; }
        .rd-anim-field-1 { animation: rd-fade-in 400ms ease-out 350ms both; }
        .rd-anim-field-2 { animation: rd-fade-in 400ms ease-out 420ms both; }
        .rd-anim-field-3 { animation: rd-fade-in 400ms ease-out 490ms both; }
        .rd-anim-field-4 { animation: rd-fade-in 400ms ease-out 560ms both; }
      }
      @media (prefers-reduced-motion: reduce) {
        .rd-anim-bg, .rd-anim-brand, .rd-anim-marketing, .rd-anim-card,
        .rd-anim-field-1, .rd-anim-field-2, .rd-anim-field-3, .rd-anim-field-4 {
          animation: none !important;
          opacity: 1 !important;
          transform: none !important;
        }
      }
      .rd-arrow { transition: transform 200ms ease; display: inline-flex; }
      .rd-signin-btn:hover .rd-arrow { transform: translateX(3px); }
      @media (prefers-reduced-motion: reduce) {
        .rd-arrow { transition: none; }
      }
    `}</style>
  );
}

/* ------------------------------------------------------------------ */
/*  Brand mark — real logo with icon fallback                          */
/* ------------------------------------------------------------------ */

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
          alt="Rosario Dairy logo"
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
      <Milk size={size * 0.5} className="text-white" aria-hidden="true" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Modals                                                              */
/* ------------------------------------------------------------------ */

function TermsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      open
      onClose={onClose}
      title="Terms & Conditions"
      subtitle="Rosario Dairy Management System"
      size="md"
      footer={
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90"
          style={{ backgroundColor: C.navy }}
        >
          Close
        </button>
      }
    >
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
    <Modal
      open
      onClose={onClose}
      title="Forgot Password"
      size="sm"
      footer={
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90"
          style={{ backgroundColor: C.navy }}
        >
          Got it
        </button>
      }
    >
      <div className="space-y-4 text-sm" style={{ color: C.muted }}>
        <div className="flex items-center gap-2 mb-1">
          <HelpCircle size={16} style={{ color: C.blue }} aria-hidden="true" />
          <span className="font-semibold" style={{ color: C.text }}>
            Password resets require another user
          </span>
        </div>

        <div>
          <p className="font-semibold text-xs mb-1" style={{ color: C.text }}>
            If you're a Staff account:
          </p>
          <p>
            Ask any Administrator to reset your password for you. They can do this from the
            User Management panel — no need to remember your old password.
          </p>
        </div>

        <div>
          <p className="font-semibold text-xs mb-1" style={{ color: C.text }}>
            If you're an Administrator:
          </p>
          <p>
            Ask another Administrator to reset your password the same way, through User
            Management.
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

/* ------------------------------------------------------------------ */
/*  Login                                                                */
/* ------------------------------------------------------------------ */

export function Login({ onBack }: Props) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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

    login(username.trim(), password)
      .then((user) => {
        toast.success(`Welcome back, ${user.username}!`);
        // No manual navigation needed — App.tsx re-renders AdminLayout/StaffLayout
        // automatically once AuthContext's `user` state updates.
      })
      .catch((err) => {
        const isNetworkError =
          err instanceof TypeError || err?.message === "Failed to fetch";

        if (isNetworkError) {
          setError("Unable to connect to the server. Please try again.");
          toast.error("Unable to connect to the server.");
        } else if (err instanceof ApiError) {
          setError("Unable to sign in. Please check your username and password.");
          toast.error("Login failed. Please check your credentials.");
        } else {
          setError("Unable to sign in. Please check your username and password.");
          toast.error("Login failed. Please check your credentials.");
        }
      })
      .finally(() => setLoading(false));
  };

  const features = [
    { icon: <PackageCheck size={13} aria-hidden="true" />, label: "FEFO Inventory" },
    { icon: <ShoppingCart size={13} aria-hidden="true" />, label: "POS Management" },
    { icon: <TrendingUp size={13} aria-hidden="true" />, label: "Predictive Analytics" },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-x-hidden" style={{ backgroundColor: "#EEF2F6" }}>
      <LoginAnimationStyles />

      {/* Left branding panel — hidden on mobile, visible from md up */}
      <div
        className="hidden md:flex md:w-1/2 lg:w-3/5 flex-col justify-between p-10 lg:p-14 relative rd-anim-bg"
        style={{
          backgroundColor: C.navy,
          backgroundImage: bgFailed
            ? undefined
            : `radial-gradient(ellipse at center, rgba(15,42,74,0.45) 0%, rgba(15,42,74,0.55) 45%, rgba(15,42,74,0.88) 100%), url(${BG_SRC})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          borderRight: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <img src={BG_SRC} alt="" className="hidden" onError={() => setBgFailed(true)} />

        <div className="relative z-10 flex items-center gap-3 rd-anim-brand">
          <BrandMark size={52} />
          <div>
            <p
              className="text-base font-semibold text-white leading-tight"
              style={{ fontFamily: "Poppins, sans-serif" }}
            >
              Rosario Dairy
            </p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
              Integrated Management System
            </p>
            <p className="text-[10px] mt-0.5 tracking-wide" style={{ color: "rgba(255,255,255,0.4)" }}>
              Inventory &middot; POS &middot; Analytics
            </p>
          </div>
        </div>

        <div className="relative z-10 max-w-sm rd-anim-marketing">
          <h2
            className="text-2xl lg:text-[1.7rem] font-bold text-white leading-tight mb-3 tracking-tight"
            style={{ fontFamily: "Poppins, sans-serif" }}
          >
            Smarter dairy management
          </h2>
          <p className="text-sm leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.7)" }}>
            Manage inventory, sales, expiration tracking, and business analytics in one place.
          </p>

          <div className="flex flex-col gap-2.5">
            {features.map((f) => (
              <div
                key={f.label}
                className="flex items-center gap-2.5 text-[13px] font-medium"
                style={{ color: "rgba(255,255,255,0.85)" }}
              >
                <span style={{ color: "#93C5FD" }}>{f.icon}</span>
                {f.label}
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs" style={{ color: "rgba(255,255,255,0.45)" }}></p>
      </div>

      {/* Right / mobile-only login panel */}
      <div
        className="flex-1 flex flex-col relative min-w-0"
        style={{
          backgroundImage: `radial-gradient(circle at 82% 28%, ${C.blue}14, transparent 55%)`,
        }}
      >
        <div className="p-6 sm:p-10 pb-0">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-sm font-medium hover:opacity-70 transition-opacity flex-shrink-0"
              style={{ color: C.muted }}
            >
              <ArrowLeft size={15} aria-hidden="true" />
              Back
            </button>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-10 py-8">
          <div className="flex md:hidden items-center gap-3 mb-8">
            <BrandMark size={44} />
            <div>
              <h1 className="text-xl font-bold" style={{ color: C.navy, fontFamily: "Poppins, sans-serif" }}>
                Rosario Dairy
              </h1>
              <p className="text-xs" style={{ color: C.muted }}>
                Integrated Management System
              </p>
            </div>
          </div>

          <div
            className="w-full max-w-sm rounded-2xl overflow-hidden rd-anim-card"
            style={{
              backgroundColor: C.white,
              border: `1px solid ${C.border}`,
              boxShadow: "0 24px 60px -28px rgba(15,42,74,0.32)",
            }}
          >
            <div style={{ height: 4, background: `linear-gradient(90deg, ${C.navy}, ${C.blue})` }} />

            <div className="p-7 sm:p-9">
              <h2
                className="text-[1.65rem] font-bold tracking-tight leading-none"
                style={{ color: C.text, fontFamily: "Poppins, sans-serif" }}
              >
                Welcome back
              </h2>
              <p className="text-sm mt-2 mb-8" style={{ color: C.muted }}>
                Sign in to access your dashboard
              </p>

              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                {/* Username */}
                <div className="rd-anim-field-1">
                  <label htmlFor="rd-username" className="text-xs font-semibold block mb-1.5" style={{ color: C.muted }}>
                    Username
                  </label>
                  <div
                    className="flex items-center gap-2.5 rounded-xl px-4 py-3 border transition-all focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.15)]"
                    style={{ borderColor: error ? C.red : C.border, backgroundColor: "#F8FAFC" }}
                  >
                    <User size={16} style={{ color: C.muted }} aria-hidden="true" />
                    <input
                      id="rd-username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="your username"
                      className="bg-transparent outline-none text-sm flex-1 min-w-0"
                      style={{ color: C.text }}
                      aria-invalid={!!error}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="rd-anim-field-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="rd-password" className="text-xs font-semibold" style={{ color: C.muted }}>
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setForgotOpen(true)}
                      className="text-xs font-medium transition-opacity hover:opacity-70"
                      style={{ color: C.blue }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div
                    className="flex items-center gap-2.5 rounded-xl px-4 py-3 border transition-all focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.15)]"
                    style={{ borderColor: error ? C.red : C.border, backgroundColor: "#F8FAFC" }}
                  >
                    <Lock size={16} style={{ color: C.muted }} aria-hidden="true" />
                    <input
                      id="rd-password"
                      name="password"
                      type={showPass ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="bg-transparent outline-none text-sm flex-1 min-w-0"
                      style={{ color: C.text }}
                      aria-invalid={!!error}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="flex-shrink-0"
                      style={{ color: C.muted }}
                      aria-label={showPass ? "Hide password" : "Show password"}
                      aria-pressed={showPass}
                    >
                      {showPass ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                    </button>
                  </div>
                </div>

                {/* Terms & Conditions */}
                <label className="flex items-start gap-2.5 cursor-pointer select-none rd-anim-field-3">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded flex-shrink-0 cursor-pointer"
                    style={{ accentColor: C.navy }}
                    aria-describedby="rd-terms-label"
                  />
                  <span id="rd-terms-label" className="text-xs" style={{ color: C.muted }}>
                    I agree to the{" "}
                    <button
                      type="button"
                      onClick={() => setTermsOpen(true)}
                      className="font-semibold underline transition-opacity hover:opacity-70"
                      style={{ color: C.blue }}
                    >
                      Terms & Conditions
                    </button>
                  </span>
                </label>

                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 text-xs px-3.5 py-2.5 rounded-xl"
                    style={{ backgroundColor: C.red + "10", color: C.red }}
                  >
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="rd-signin-btn rd-anim-field-4 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5"
                  style={{ backgroundColor: C.navy }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                      Signing in&hellip;
                    </>
                  ) : (
                    <>
                      Sign In
                      <span className="rd-arrow">
                        <ArrowRight size={16} aria-hidden="true" />
                      </span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="px-6 sm:px-10 pb-6 sm:pb-8">
          <p
            className="text-xs text-center flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5"
            style={{ color: C.muted }}
          >
            <span>Rosario Dairy Management System &copy; {new Date().getFullYear()}</span>
            <span className="hidden sm:inline" aria-hidden="true">
              &middot;
            </span>
          </p>
        </div>
      </div>

      {termsOpen && <TermsModal onClose={() => setTermsOpen(false)} />}
      {forgotOpen && <ForgotPasswordModal onClose={() => setForgotOpen(false)} />}
    </div>
  );
}
