import React from "react";

const variants = {
  default: "bg-black text-white hover:opacity-90",
  outline: "border border-gray-300 bg-white text-black hover:bg-gray-50",
  secondary: "bg-gray-200 text-black hover:bg-gray-300",
  destructive: "bg-red-600 text-white hover:bg-red-700",
};

export function Button({ variant = "default", size = "md", className = "", ...props }) {
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2",
    lg: "px-5 py-2.5 text-lg",
  };
  return (
    <button
      className={`rounded-xl ${variants[variant] ?? variants.default} ${sizes[size] ?? sizes.md} ${className}`}
      {...props}
    />
  );
}
