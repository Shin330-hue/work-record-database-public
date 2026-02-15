"use client";
import { useEffect } from "react";

export default function Particles() {
  useEffect(() => {
    const container = document.getElementById("particles");
    if (!container) return;
    for (let i = 0; i < 50; i++) {
      const dot = document.createElement("div");
      dot.className = "particle";
      dot.style.left = `${Math.random()*100}%`;
      dot.style.animationDelay = `${Math.random()*20}s`;
      dot.style.animationDuration = `${15+Math.random()*10}s`;
      container.appendChild(dot);
    }
  }, []);
  return null;
}
