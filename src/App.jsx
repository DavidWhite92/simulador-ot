import React from "react";
import SimuladorOT from "./SimuladorOT";

export default function App() {
  return (
    // 🌅 Fondo oscuro semitransparente sobre la imagen
    <div className="min-h-screen bg-white/60">
      <SimuladorOT />
    </div>
  );
}
