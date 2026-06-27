"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// CSS variables for light theme
const lightThemeStyles = `
  :root {
    --background: #f5f5f5;
    --foreground: #171717;
  }
  .bank-shell {
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.02), transparent 260px), #f5f5f5 !important;
  }
  .bank-surface {
    border: 1px solid rgba(0, 0, 0, 0.08) !important;
    background: rgba(255, 255, 255, 0.8) !important;
  }
  .bank-panel {
    border: 1px solid rgba(0, 0, 0, 0.06) !important;
    background: rgba(255, 255, 255, 0.9) !important;
  }
  .bank-button {
    border: 1px solid rgba(0, 0, 0, 0.08) !important;
    background: rgba(0, 0, 0, 0.03) !important;
  }
  .bank-button:hover {
    border-color: rgba(0, 0, 0, 0.12) !important;
    background: rgba(0, 0, 0, 0.06) !important;
  }
  body {
    background: #f5f5f5 !important;
    color: #171717 !important;
  }
  .text-white {
    color: #171717 !important;
  }
  .text-zinc-400 {
    color: #525252 !important;
  }
  .text-zinc-500 {
    color: #737373 !important;
  }
  .text-zinc-600 {
    color: #a3a3a3 !important;
  }
  .bg-black\/25, .bg-black\/20, .bg-black\/30, .bg-black\/40 {
    background: rgba(0, 0, 0, 0.05) !important;
  }
  .bg-white\/\[0\.035\], .bg-white\/\[0\.04\], .bg-white\/\[0\.045\], .bg-white\/\[0\.05\], .bg-white\/\[0\.06\], .bg-white\/\[0\.08\], .bg-white\/\[0\.1\] {
    background: rgba(0, 0, 0, 0.05) !important;
  }
  .border-white\/10, .border-white\/\[0\.1\] {
    border-color: rgba(0, 0, 0, 0.1) !important;
  }
  .border-white\/5 {
    border-color: rgba(0, 0, 0, 0.05) !important;
  }
  .placeholder\:text-zinc-600::placeholder {
    color: #a3a3a3 !important;
  }
`;

// CSS variables for dark theme (default)
const darkThemeStyles = `
  :root {
    --background: var(--brand-background, #050606);
    --foreground: #ededed;
  }
  body {
    background: var(--brand-background, #050606) !important;
    color: #ededed !important;
  }
`;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "dark";

    const savedTheme = localStorage.getItem("aurexbank-theme");
    return savedTheme === "light" || savedTheme === "dark" ? savedTheme : "dark";
  });

  const applyTheme = useCallback((newTheme: Theme) => {
    // Remove existing style elements
    const existingStyle = document.getElementById('theme-styles');
    if (existingStyle) {
      existingStyle.remove();
    }

    // Create and apply new styles
    const style = document.createElement('style');
    style.id = 'theme-styles';
    style.textContent = newTheme === 'light' ? lightThemeStyles : darkThemeStyles;
    document.head.appendChild(style);

    // Update document class
    if (newTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("aurexbank-theme", theme);
      applyTheme(theme);
    }
  }, [theme, applyTheme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
