import { StaffContext } from "./lib/StaffContext";
import {defaultStaff} from "./lib/staff";
// App.jsx
import React, { useState } from "react";
import SimuladorOT from "./SimuladorOT";
import SimuladorOT_RTVE from "./SimuladorOT_RTVE";

import MusicControl from "./components/MusicControl";

export default function App() {
  const [staff,setStaff] = useState(defaultStaff);
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
    if (payload.mode && !["tve2001", "ot2003", "telecinco", "rtve"].includes(payload.mode)) throw new Error("Formato de temporada desconocido");
    setLoadedSeason(payload);
    setStaff(payload.academy?.staff || defaultStaff);
    if(payload.academy?.judges) setJudgeNames(payload.academy.judges);
    setMode(payload.mode || mode);
  };
  const shared = { staff, setStaff, repechageOption, setRepechageOption, judgeNames, setJudgeNames, mode, onModeChange: setMode, roster, setRoster, manual, setManual, popularityEnabled, setPopularityEnabled, relationshipsEnabled, setRelationshipsEnabled, loadedSeason, onLoadSeason, onLoadedSeason: () => setLoadedSeason(null) };

  return (
    <div className="ot-shell min-h-screen">
      <MusicControl />
      <StaffContext.Provider value={{...staff,judges:staff.judges.map((person,i)=>({...person,name:judgeNames[i]?.trim() || `Juez ${i+1}`}))}}>
      <div className="w-full min-w-0 px-1 sm:px-6 lg:px-12">
        {mode !== "rtve" ? (
          <SimuladorOT key={mode} {...shared} />
        ) : (
          <SimuladorOT_RTVE {...shared} />
        )}
      </div>
      </StaffContext.Provider>
      <footer className="max-w-7xl mx-auto px-4 py-4 sm:px-6 text-xs text-muted-foreground text-center space-y-2">
        <p>© 2026 Simulador OT — Proyecto fan no oficial, gratuito y sin ánimo de lucro. No afiliado ni respaldado por Operación Triunfo ni por sus titulares de derechos. Todas las marcas, imágenes, logotipos y músicas de terceros pertenecen a sus respectivos titulares de derechos.</p>
        <p>Contacto y sugerencias: <a className="underline" href="mailto:otsimulador@gmail.com">otsimulador@gmail.com</a></p>
      </footer>
    </div>
  );
}
