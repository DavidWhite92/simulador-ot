import React from "react";

const variants = {
  default: "bg-black text-white",
  outline: "border border-gray-300 text-gray-800 bg-white",
  secondary: "bg-gray-200 text-gray-900",
  destructive: "bg-red-600 text-white",
};

export function Badge({ variant = "default", className = "", children }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
