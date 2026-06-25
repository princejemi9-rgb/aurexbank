"use client";

import { useTheme } from "../../context/ThemeContext";

export default function ThemeToggle() {

  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="w-full bg-white/10 border border-white/10 rounded-2xl py-4 font-black mt-6"
    >

      {theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}

    </button>
  );
}