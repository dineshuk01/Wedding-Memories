import React from "react";
import { motion } from "framer-motion";

export default function CategoryCard({ category, count, mode, selected, onClick, disabled }) {
  const Icon = category.icon;

  return (
    <motion.button
      type="button"
      whileHover={{ y: -6, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className={`group relative overflow-hidden rounded-3xl border p-5 text-left transition duration-300 ${
        selected
          ? "border-white/35 bg-white/20 shadow-glow"
          : "border-white/10 bg-white/[0.08] hover:border-white/25 hover:bg-white/[0.13]"
      } disabled:cursor-wait disabled:opacity-70`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${category.gradient}`} />
      <div className={`absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${category.gradient} opacity-20 blur-2xl transition group-hover:opacity-40`} />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className={`mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${category.gradient} text-slate-950 shadow-lg`}>
            <Icon className="text-xl" />
          </div>
          <p className="text-lg font-semibold text-white">{category.label}</p>
          <p className="mt-1 text-sm text-slate-400">{mode === "upload" ? "Drop or select an image" : "Browse collection"}</p>
        </div>
        <div className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-sm text-slate-200">
          {count || 0}
        </div>
      </div>
    </motion.button>
  );
}
