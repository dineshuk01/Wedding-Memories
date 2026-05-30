import React from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowRight } from "react-icons/fa6";

import CategoryCard from "./CategoryCard";

export default function GallerySection({ categories, counts, uploadedCategory }) {
  const navigate = useNavigate();

  return (
    <section className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-5 shadow-2xl sm:p-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-fuchsia-200">View Images</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Open a category gallery</h2>
        </div>
        <p className="text-sm text-slate-400">Uniform grid pages</p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {categories.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            count={counts[category.id]}
            mode="view"
            selected={uploadedCategory === category.id}
            onClick={() => navigate(`/gallery/${category.id}`)}
          />
        ))}
      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-950/25 p-5 text-slate-300">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm leading-6">Each category opens on its own page with equal-size image tiles, hover zoom, lazy loading, and full-screen preview.</p>
          <FaArrowRight className="shrink-0 text-cyan-200" />
        </div>
      </div>
    </section>
  );
}
