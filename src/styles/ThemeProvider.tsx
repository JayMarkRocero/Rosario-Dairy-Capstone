import { createContext, useContext, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
const STORAGE_KEY = "rosario-dairy-theme";

const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void } | null>(null);

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch { /* Use the system preference when storage is unavailable. */ }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* The current session still switches themes. */ }
    setTheme(next);
  };

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
