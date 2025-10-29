// App.jsx
import React, { useState } from "react";
import SimuladorOT from "./SimuladorOT";
import SimuladorOT_RTVE from "./SimuladorOT_RTVE";

export default function App() {
  const [mode, setMode] = useState("telecinco");

  return (
    <div className="min-h-screen bg-white/60">
      <div className="w-full px-6 lg:px-12">
        {mode === "telecinco" ? (
          <SimuladorOT mode={mode} onModeChange={setMode} />
        ) : (
          <SimuladorOT_RTVE mode={mode} onModeChange={setMode} />
        )}
      </div>
    </div>
  );
}