import { useState, useEffect } from "react";
import { Toaster } from "sonner";
import LandingPage from "./LandingPage";
import { Login } from "./Login";
import { AdminLayout }  from "../layouts/AdminLayout";
import { StaffLayout }  from "../layouts/StaffLayout";
import { api, getAccessToken, setAccessToken } from "../lib/api";

type Role = "admin" | "staff" | null;
type View = "landing" | "Login";

export default function App() {
  const [role, setRole] = useState<Role>(null);
  const [view, setView] = useState<View>("landing");
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setCheckingSession(false);
      return;
    }
    api.getCurrentUser()
      .then(user => {
        setRole(user.role);
      })
      .catch(() => {
        // Token invalid or expired — clear it and fall back to login.
        setAccessToken(null);
        setView("Login");
      })
      .finally(() => setCheckingSession(false));
  }, []);

  const handleLogout = () => {
    setAccessToken(null);
    setRole(null);
    setView("Login");
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { fontFamily: "Inter, sans-serif", fontSize: 13, borderRadius: 12 },
          duration: 3500,
        }}
        richColors
      />
      {!role && view === "landing"    && <LandingPage onLogin={() => setView("Login")} />}
      {!role && view === "Login" && <Login onSelect={setRole} onBack={() => setView("landing")} />}
      {role === "admin" && <AdminLayout onLogout={handleLogout} />}
      {role === "staff" && <StaffLayout onLogout={handleLogout} />}
    </>
  );
}