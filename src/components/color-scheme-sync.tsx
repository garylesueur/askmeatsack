"use client";

import { useEffect } from "react";

function syncSystemDark(): void {
  const root = document.documentElement;
  if (root.dataset.colorMode === "light" || root.dataset.colorMode === "dark") {
    return;
  }
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  root.classList.toggle("dark", systemDark);
  root.classList.remove("light");
}

export function ColorSchemeSync() {
  useEffect(() => {
    syncSystemDark();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      syncSystemDark();
    };
    mq.addEventListener("change", onChange);
    return () => {
      mq.removeEventListener("change", onChange);
    };
  }, []);
  return null;
}
