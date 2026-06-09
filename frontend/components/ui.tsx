"use client";
import { useState } from "react";

// ── Button ────────────────────────────────────────────────────────────────────
type BtnVariant = "primary" | "outline" | "danger" | "ghost";
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  loading?: boolean;
}
const variantCls: Record<BtnVariant, string> = {
  primary: "bg-indigo-600 hover:bg-indigo-500 text-white",
  outline: "border border-indigo-500 text-indigo-400 hover:bg-indigo-500/10",
  danger:  "bg-red-600/80 hover:bg-red-500 text-white",
  ghost:   "text-gray-400 hover:text-white hover:bg-gray-800",
};
export function Btn({ variant = "primary", loading, className = "", children, disabled, ...p }: BtnProps) {
  return (
    <button
      {...p}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${variantCls[variant]} ${className}`}
    >
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border border-gray-800 bg-gray-900 ${className}`}>
      {children}
    </div>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────
export function Input(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...p}
      className={`w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:outline-none ${p.className ?? ""}`}
    />
  );
}

// ── Textarea ──────────────────────────────────────────────────────────────────
export function Textarea(p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...p}
      className={`w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:outline-none ${p.className ?? ""}`}
    />
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Progress bar ─────────────────────────────────────────────────────────────
export function Progress({ pct }: { pct: number }) {
  return (
    <div className="h-2 w-full rounded-full bg-gray-700">
      <div
        className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
export function useToast() {
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const show = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };
  const Toast = toast ? (
    <div className={`fixed bottom-6 right-6 z-50 rounded-xl px-5 py-3 text-sm font-medium shadow-lg ${toast.type === "ok" ? "bg-green-600" : "bg-red-600"} text-white`}>
      {toast.msg}
    </div>
  ) : null;
  return { show, Toast };
}

// ── Label ─────────────────────────────────────────────────────────────────────
export function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-gray-400 mb-1">{children}</label>;
}
