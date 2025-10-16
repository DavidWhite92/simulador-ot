import React, { createContext, useContext, useState } from "react";

const TabsCtx = createContext();

export function Tabs({ defaultValue, children }) {
  const [value, setValue] = useState(defaultValue);
  return <TabsCtx.Provider value={{ value, setValue }}>{children}</TabsCtx.Provider>;
}

export function TabsList({ className = "", children }) {
  return <div className={`inline-flex gap-2 rounded-xl border p-1 ${className}`}>{children}</div>;
}

export function TabsTrigger({ value, className = "", children }) {
  const { value: current, setValue } = useContext(TabsCtx);
  const active = current === value;
  return (
    <button
      onClick={() => setValue(value)}
      className={`rounded-lg px-3 py-1 text-sm ${active ? "bg-black text-white" : "bg-white text-black"} ${className}`}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, className = "", children }) {
  const { value: current } = useContext(TabsCtx);
  if (current !== value) return null;
  return <div className={className}>{children}</div>;
}
