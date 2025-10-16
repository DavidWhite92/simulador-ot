import React from "react";

export function Card({ className = "", children }) {
  return <div className={`rounded-2xl border bg-white shadow ${className}`}>{children}</div>;
}

export function CardContent({ className = "", children }) {
  return <div className={className}>{children}</div>;
}
