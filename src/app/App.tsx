// src/app/App.tsx
import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import LandingPage from "./LandingPage";
import { Login } from "./Login";
import { AdminLayout } from "@/app/layouts/AdminLayout";
import { StaffLayout } from "@/app/layouts/StaffLayout";
import { AuthProvider, useAuth } from "@/features/auth/context/AuthContext";
import { ThemeProvider, useTheme } from "@/styles/ThemeProvider";
import { Skeleton } from "@/components/EmptyState";

type View = "landing" | "Login";

function AppShell() {
  const { theme } = useTheme();
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
      <div role="status" aria-label="Opening Rosario Dairy" aria-busy="true" className="min-h-dvh p-4 sm:p-8" style={{ backgroundColor: "var(--background)" }}>
        <span className="sr-only">Opening Rosario Dairy</span>
        <div className="mx-auto max-w-6xl space-y-6">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-7 w-44" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28 rounded-2xl" />)}
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster
        theme={theme}
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
    <ThemeProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ThemeProvider>
  );
}
