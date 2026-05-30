import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { FaArrowLeft, FaRegImage } from "react-icons/fa6";

import { fetchImages } from "../api/galleryApi";
import Lightbox from "../components/Lightbox";
import { categories } from "../data/categories";

function GalleryImage({ src, alt, fitMode }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const imgClass = fitMode === "contain"
    ? "h-full w-full object-contain bg-slate-950/40 transition-all duration-700 group-hover:scale-105"
    : "h-full w-full object-cover transition-all duration-700 group-hover:scale-110";

  return (
    <div className="relative h-full w-full bg-slate-950/20 flex items-center justify-center overflow-hidden">
      {!loaded && !error && (
        <div className="absolute inset-0 animate-shimmer z-10" />
      )}
      {error ? (
        <div className="flex flex-col items-center gap-2 p-4 text-center z-20">
          <FaRegImage className="text-slate-600 text-3xl animate-pulse" />
          <span className="text-xs text-slate-500 font-medium">Failed to load</span>
        </div>
      ) : (
        <img
          ref={(el) => {
            if (el && el.complete) {
              setLoaded(true);
            }
          }}
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={imgClass}
        />
      )}
    </div>
  );
}

export default function CategoryGalleryPage({ search }) {
  const { categoryId } = useParams();
  const category = categories.find((item) => item.id === categoryId);
  const activeCategory = category || categories[0];
  const [images, setImages] = useState([]);
  const [nextToken, setNextToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [fitMode, setFitMode] = useState(() => {
    return localStorage.getItem("wedding_gallery_fit_mode") || "cover";
  });
  const sentinelRef = useRef(null);

  const toggleFitMode = () => {
    const nextMode = fitMode === "cover" ? "contain" : "cover";
    setFitMode(nextMode);
    localStorage.setItem("wedding_gallery_fit_mode", nextMode);
  };

  const Icon = activeCategory.icon;

  const loadImages = async (token, append = false) => {
    append ? setLoadingMore(true) : setLoading(true);
    try {
      const data = await fetchImages(activeCategory.id, token);
      setImages((current) => (append ? [...current, ...data.images] : data.images));
      setNextToken(data.next_token);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Could not load images");
    } finally {
      append ? setLoadingMore(false) : setLoading(false);
    }
  };

  useEffect(() => {
    loadImages();
  }, [activeCategory.id]);

  useEffect(() => {
    if (!sentinelRef.current || !nextToken || loadingMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        loadImages(nextToken, true);
      }
    });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [nextToken, loadingMore, activeCategory.id]);

  // Auto-fetch next page when the user is 5 photos from the end while inside the lightbox
  useEffect(() => {
    if (lightboxIndex === null || !nextToken || loadingMore) return;
    const threshold = filteredImages.length - 5;
    if (lightboxIndex >= threshold) {
      loadImages(nextToken, true);
    }
  }, [lightboxIndex]);

  const filteredImages = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return images;
    return images.filter((image) => image.key.toLowerCase().includes(query) || activeCategory.id.includes(query));
  }, [images, search, activeCategory.id]);

  return (
    !category ? <Navigate to="/" replace /> :
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            to="/"
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/25 hover:bg-white/15"
          >
            <FaArrowLeft />
            Back
          </Link>
          <div className="flex items-center gap-4">
            <div className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br ${activeCategory.gradient} text-slate-950 shadow-glow`}>
              <Icon className="text-2xl" />
            </div>
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.28em] text-slate-400">Category Gallery</p>
              <h2 className="mt-1 text-4xl font-semibold text-white sm:text-5xl">{activeCategory.label}</h2>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleFitMode}
            title={fitMode === "cover" ? "Switch to Fit (Show Full Images)" : "Switch to Crop (Fill Grid)"}
            className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 text-sm font-medium text-slate-300 backdrop-blur-xl transition hover:border-white/25 hover:bg-white/15"
          >
            {fitMode === "cover" ? (
              <>
                <svg className="h-4.5 w-4.5 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                </svg>
                <span className="hidden xs:inline">Show Full</span>
              </>
            ) : (
              <>
                <svg className="h-4.5 w-4.5 text-fuchsia-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h16v16H4V4zM9 9h6v6H9V9z" />
                </svg>
                <span className="hidden xs:inline">Crop to Square</span>
              </>
            )}
          </button>
          <div className="rounded-2xl border border-white/10 bg-white/[0.08] px-5 py-3 text-sm text-slate-300 backdrop-blur-xl">
            {filteredImages.length} images visible
          </div>
        </div>
      </div>

      <section className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-4 shadow-2xl sm:p-6">
        {loading ? (
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8">
            {Array.from({ length: 24 }).map((_, index) => (
              <div key={index} className="w-full aspect-square animate-pulse rounded-2xl bg-white/10" />
            ))}
          </div>
        ) : filteredImages.length ? (
          <>
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8">
              {filteredImages.map((image, index) => (
                <motion.button
                  type="button"
                  key={image.key}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.025, 0.25) }}
                  onClick={() => setLightboxIndex(index)}
                  onMouseEnter={() => {
                    // Preload the original high-resolution image when the user hovers over the thumbnail
                    if (image.original_url && image.original_url !== image.url) {
                      const img = new Image();
                      img.src = image.original_url;
                    }
                  }}
                  className="w-full group relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40 shadow-2xl"
                >
                  <GalleryImage
                    src={image.url}
                    alt={image.key}
                    fitMode={fitMode}
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 to-transparent p-3 opacity-0 transition group-hover:opacity-100">
                    <p className="truncate text-left text-xs font-medium text-white">{image.key.split("/").pop()}</p>
                  </div>
                </motion.button>
              ))}
            </div>
            <div ref={sentinelRef} className="h-8" />
            {loadingMore && <p className="text-center text-sm text-slate-400">Loading more images...</p>}
          </>
        ) : (
          <div className="grid min-h-96 place-items-center rounded-3xl border border-dashed border-white/15 bg-slate-950/20 p-8 text-center">
            <div>
              <FaRegImage className="mx-auto mb-4 text-5xl text-slate-500" />
              <h3 className="text-xl font-semibold text-white">No images found</h3>
              <p className="mt-2 max-w-sm text-sm text-slate-400">Upload an image to {activeCategory.label} or clear the search field.</p>
            </div>
          </div>
        )}
      </section>

      <Lightbox
        images={filteredImages}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onPrev={() => setLightboxIndex((i) => Math.max(0, i - 1))}
        onNext={() => setLightboxIndex((i) => Math.min(filteredImages.length - 1, i + 1))}
      />
    </main>
  );
}
