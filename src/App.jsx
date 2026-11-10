// App.jsx
import React, { useState } from "react";
import SimuladorOT from "./SimuladorOT";
import SimuladorOT_RTVE from "./SimuladorOT_RTVE";

import MusicControl from "./components/MusicControl";

export default function App() {
  const [judgeNames, setJudgeNames] = useState(['', '', '', '']);
  const [repechageOption,setRepechageOption] = useState('off');
  const [mode, setMode] = useState("telecinco");

  const [roster, setRoster] = useState([]);
  const [manual, setManual] = useState(false);
  const [popularityEnabled, setPopularityEnabled] = useState(true);
  const [relationshipsEnabled, setRelationshipsEnabled] = useState(true);
  const [loadedSeason, setLoadedSeason] = useState(null);
  const onLoadSeason = (payload) => {
    if (!payload || payload.v !== 1) throw new Error("Versión de guardado incompatible");
    if (payload.mode && !["telecinco", "rtve"].includes(payload.mode)) throw new Error("Formato de temporada desconocido");
    setLoadedSeason(payload);
    setMode(payload.mode || mode);
  };
  const shared = { repechageOption, setRepechageOption, judgeNames, setJudgeNames, mode, onModeChange: setMode, roster, setRoster, manual, setManual, popularityEnabled, setPopularityEnabled, relationshipsEnabled, setRelationshipsEnabled, loadedSeason, onLoadSeason, onLoadedSeason: () => setLoadedSeason(null) };

  return (
    <div className="min-h-screen bg-white/60">
      <MusicControl />
      <div className="w-full min-w-0 px-1 sm:px-6 lg:px-12">
        {mode === "telecinco" ? (
          <SimuladorOT {...shared} />
        ) : (
          <SimuladorOT_RTVE {...shared} />
        )}
      </div>
    </div>
  );
}
