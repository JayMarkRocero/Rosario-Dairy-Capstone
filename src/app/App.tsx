// src/app/App.tsx
import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import LandingPage from "./LandingPage";
import { Login } from "./Login";
import { AdminLayout } from "../layouts/AdminLayout";
import { StaffLayout } from "../layouts/StaffLayout";
import { AuthProvider, useAuth } from "../contexts/AuthContext";

type View = "landing" | "Login";

function AppShell() {
  const { user, loading, sessionExpired, logout, clearSessionExpiredFlag } = useAuth();
  const [view, setView] = useState<View>("landing");

  useEffect(() => {
    if (sessionExpired) {
      toast.error("Your session has expired. Please log in again.");
      setView("Login");
      clearSessionExpiredFlag();
    }
  }, [sessionExpired, clearSessionExpiredFlag]);

  const handleLogout = () => {
    logout();
    setView("Login");
  };

  // Never render admin/staff/login simultaneously with an unresolved session check.
  if (loading) {
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
      {!user && view === "landing" && <LandingPage onLogin={() => setView("Login")} />}
      {!user && view === "Login" && <Login onBack={() => setView("landing")} />}
      {user?.role === "admin" && <AdminLayout onLogout={handleLogout} />}
      {user?.role === "staff" && <StaffLayout onLogout={handleLogout} />}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}