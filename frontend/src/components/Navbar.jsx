import React from "react";
import { FaHeart, FaMagnifyingGlass } from "react-icons/fa6";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/55 backdrop-blur-2xl">
      <nav className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 shadow-glow ring-1 ring-white/20">
            <FaHeart className="text-xl text-rose-300" />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.32em] text-rose-300/80">Our Memories</p>
            <h1 className="text-xl font-semibold text-white sm:text-2xl">Our Story</h1>
          </div>
        </div>
      </nav>
    </header>
  );
}
