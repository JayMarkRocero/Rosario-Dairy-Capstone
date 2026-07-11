import { useState } from "react";
import { Toaster } from "sonner";
import LandingPage from "./LandingPage";
import { RoleSelector } from "./RoleSelector";
import { AdminLayout }  from "../layouts/AdminLayout";
import { StaffLayout }  from "../layouts/StaffLayout";

type Role = "admin" | "staff" | null;
type View = "landing" | "roleSelect";

export default function App() {
  const [role, setRole] = useState<Role>(null);
  const [view, setView] = useState<View>("landing");

  const handleLogout = () => {
    setRole(null);
    setView("landing");
  };

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
      {!role && view === "landing"    && <LandingPage onLogin={() => setView("roleSelect")} />}
      {!role && view === "roleSelect" && <RoleSelector onSelect={setRole} />}
      {role === "admin" && <AdminLayout onLogout={handleLogout} />}
      {role === "staff" && <StaffLayout onLogout={handleLogout} />}
    </>
  );
}