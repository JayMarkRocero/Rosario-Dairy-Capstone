// src/app/Login.tsx
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { isAxiosError } from "axios";
import {
  X,
  Eye,
  EyeOff,
  Lock,
  User,
  ArrowLeft,
  ArrowRight,
  Milk,
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
import { authService } from "@/features/auth/api/auth.service";
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

const TERMS_SECTIONS = [
  {
    title: "Acceptance of Terms",
    paragraph: 'By accessing or using the Rosario Dairy Management System ("System"), you agree to comply with and be bound by these Terms and Conditions. This System is strictly reserved for authorized staff, management, and administrators of Rosario Dairy.',
  },
  {
    title: "Authorized Business Use",
    items: [
      "System access is granted exclusively for legitimate business operations, including inventory tracking, point-of-sale transactions, sales reporting, and stock management.",
      "Any personal, unauthorized, or third-party commercial use of this system is strictly prohibited.",
    ],
  },
  {
    title: "Account Security & Credential Protection",
    items: [
      "User credentials are personal and non-transferable. You are responsible for maintaining the confidentiality of your login details.",
      "Account sharing or performing transactions under another team member's identity is strictly forbidden.",
      "Immediately report any suspected credential compromise or unauthorized access to system administrators.",
    ],
  },
  {
    title: "Data Privacy & Confidentiality",
    items: [
      "All data within the System—including customer details, sales records, pricing rules, and inventory levels—is proprietary and confidential to Rosario Dairy.",
      "Users may not export, duplicate, or disclose confidential system data to external parties without explicit authorization.",
    ],
  },
  {
    title: "Data Integrity & Stock Protocols",
    items: [
      "Users must record transactions, stock adjustments, batch details, and expiration dates accurately to maintain data integrity (e.g., First-Expiry-First-Out stock rules).",
      "Intentional falsification of records or misrepresentation of stock levels will result in immediate termination of access and administrative review.",
    ],
  },
  {
    title: "System Availability & Audit Logging",
    items: [
      "All actions (logins, sales, inventory adjustments, and data exports) are automatically logged for security and operational auditing.",
      "Features and interfaces are subject to scheduled updates and operational improvements without prior notice.",
    ],
  },
];

function TermsModal({ onClose, onAgree }: { onClose: () => void; onAgree: () => void }) {
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <header className="sticky top-0 flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 bg-white px-6 py-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Terms & Conditions
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs font-normal leading-relaxed text-slate-500 dark:text-slate-400">
                Rosario Dairy Management System — Internal Usage Guidelines
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" aria-label="Close terms and conditions" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100">
                <X size={18} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </header>

          <div tabIndex={0} role="region" aria-label="Internal usage terms" className="min-h-0 max-h-[55vh] overflow-y-auto overscroll-contain px-6 py-4 text-left text-sm leading-relaxed text-slate-600 [scrollbar-width:thin] [scrollbar-color:var(--color-slate-300)_transparent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400 dark:text-slate-300 dark:[scrollbar-color:var(--color-slate-600)_transparent]">
            {TERMS_SECTIONS.map((section, index) => (
              <section key={section.title} className="mt-4 first:mt-0">
                <h3 className="mb-1.5 text-xs font-semibold uppercase leading-relaxed tracking-wider text-slate-800 dark:text-slate-200">
                  {index + 1}. {section.title}
                </h3>
                {section.paragraph && <p>{section.paragraph}</p>}
                {section.items && (
                  <ul className="list-disc space-y-2 pl-4 marker:text-slate-400 dark:marker:text-slate-500">
                    {section.items.map((item) => <li key={item} className="pl-1">{item}</li>)}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <footer className="flex shrink-0 flex-col items-stretch justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-3.5 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900/50">
            <p className="text-xs text-slate-500 dark:text-slate-400">Last updated: September 2026</p>
            <button type="button" onClick={onAgree} className="shrink-0 rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 dark:focus-visible:ring-offset-slate-900">
              I Understand & Agree
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<"request" | "reset" | "done">("request");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const identity = { username: username.trim(), email: email.trim() };
      if (step === "request") {
        await authService.requestPasswordOTP(identity);
        setStep("reset");
      } else {
        await authService.resetPassword({ ...identity, otp, new_password: password });
        setPassword("");
        setOtp("");
        setStep("done");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to connect. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const inputClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400";

  return (
    <Modal open onClose={onClose} title="Reset your password" size="sm">
      {step === "done" ? (
        <div className="space-y-4">
          <p role="status" className="text-sm text-slate-600">Your password has been reset. Sign in with your new password.</p>
          <button type="button" onClick={onClose} className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Back to sign in</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p role="status" className="text-sm leading-relaxed text-slate-600">
            {step === "request" ? "Enter your username and account email to request a password reset code." : "If an account matches those details, a reset code will be sent to its email address. Enter the code below to continue."}
          </p>
          <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
            <label className="block text-sm text-slate-700">Username
              <input required autoComplete="username" value={username} readOnly={step === "reset"} onChange={e => setUsername(e.target.value)} className={inputClass} />
            </label>
            <label className="block text-sm text-slate-700">Account email
              <input required type="email" autoComplete="email" value={email} readOnly={step === "reset"} onChange={e => setEmail(e.target.value)} className={inputClass} />
            </label>
            {step === "reset" && <>
              <label className="block text-sm text-slate-700">6-digit code
                <input required type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ""))} className={inputClass} />
              </label>
              <label className="block text-sm text-slate-700">New password
                <input required type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className={inputClass} />
              </label>
            </>}
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <button type="submit" className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">{busy ? "Please wait..." : step === "request" ? "Send reset code" : "Reset password"}</button>
            {step === "reset" && <button type="button" onClick={() => { setStep("request"); setOtp(""); setPassword(""); setError(""); }} className="text-sm text-slate-600 underline">Change details or request another code</button>}
          </fieldset>
        </form>
      )}
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
        const isNetworkError = isAxiosError(err) && !err.response;

        if (isNetworkError) {
          setError("Unable to connect to the server. Please try again.");
          toast.error("Unable to connect to the server.");
        } else if (err instanceof ApiError) {
          setError(err.message);
          toast.error(err.message);
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

      {termsOpen && (
        <TermsModal
          onClose={() => setTermsOpen(false)}
          onAgree={() => {
            setAgreedToTerms(true);
            setTermsOpen(false);
          }}
        />
      )}
      {forgotOpen && <ForgotPasswordModal onClose={() => setForgotOpen(false)} />}
    </div>
  );
}
