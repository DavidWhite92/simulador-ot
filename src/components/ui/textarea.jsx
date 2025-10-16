import React from "react";

export function Textarea({ className = "", ...props }) {
  return (
    <textarea
      className={`w-full rounded-xl border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-black ${className}`}
      {...props}
    />
  );
}
