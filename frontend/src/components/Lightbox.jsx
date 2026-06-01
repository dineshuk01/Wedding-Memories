import React, { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaXmark, FaDownload, FaChevronLeft, FaChevronRight } from "react-icons/fa6";
import { downloadImageByKey } from "../api/galleryApi";

export default function Lightbox({ images = [], index, onClose, onPrev, onNext }) {
  const image = index !== null && index !== undefined ? images[index] : null;
  const [highResLoaded, setHighResLoaded] = useState(false);
  const total = images.length;
  const isFirst = index === 0;
  const isLast = index === total - 1;

  // Touch swipe tracking
  const touchStartX = useRef(null);

  useEffect(() => {
    if (!image) return;
    if (!image.original_url || image.original_url === image.url) {
      setHighResLoaded(true);
    } else {
      setHighResLoaded(false);
    }
  }, [image]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e) => {
      if (!image) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); onPrev(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); onNext(); }
      else if (e.key === "Escape") { onClose(); }
    },
    [image, onPrev, onNext, onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleDownload = (event) => {
    event.stopPropagation();
    // Use the S3 key to route through the backend proxy — avoids CORS issues
    const key = image.key;
    downloadImageByKey(key);
  };

  const handleTouchStart = (e) => {
    // If multiple fingers are on screen, user is probably zooming. Cancel swipe tracking.
    if (e.touches.length > 1) {
      touchStartX.current = null;
      return;
    }
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e) => {
    // If a second finger touches down mid-swipe, cancel tracking
    if (e.touches.length > 1) {
      touchStartX.current = null;
    }
  };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 50) {
      if (delta > 0 && !isLast) onNext();           // swipe left → next
      else if (delta < 0 && !isFirst) onPrev();       // swipe right → prev
    }
    touchStartX.current = null;
  };

  return (
    <AnimatePresence>
      {image && (
        <motion.div
          key="lightbox-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 lg:p-0 backdrop-blur-xl"
          onClick={onClose}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* ── Top-right toolbar ── */}
          <div
            className="absolute right-5 top-5 flex items-center gap-2 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image counter */}
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-slate-300 backdrop-blur-md">
              {index + 1} / {total}
            </span>

            {/* Download */}
            <motion.button
              type="button"
              aria-label="Download photo"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/20"
            >
              <FaDownload className="h-3.5 w-3.5" />
              <span>Download</span>
            </motion.button>

            {/* Close */}
            <button
              type="button"
              aria-label="Close preview"
              className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              onClick={onClose}
            >
              <FaXmark />
            </button>
          </div>

          {/* ── Left arrow — hidden on first photo ── */}
          {!isFirst && (
            <motion.button
              type="button"
              aria-label="Previous photo"
              whileHover={{ scale: 1.12, x: -2 }}
              whileTap={{ scale: 0.92 }}
              onClick={(e) => { e.stopPropagation(); onPrev(); }}
              className="hidden sm:grid absolute left-5 z-10 h-12 w-12 place-items-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-md transition hover:bg-white/25 shadow-xl"
            >
              <FaChevronLeft className="h-5 w-5" />
            </motion.button>
          )}

          {/* ── Right arrow — dimmed on last photo ── */}
          <motion.button
            type="button"
            aria-label="Next photo"
            whileHover={!isLast ? { scale: 1.12, x: 2 } : {}}
            whileTap={!isLast ? { scale: 0.92 } : {}}
            onClick={(e) => { e.stopPropagation(); if (!isLast) onNext(); }}
            className={`hidden sm:grid absolute right-5 z-10 h-12 w-12 place-items-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-md transition shadow-xl ${
              isLast ? "opacity-25 cursor-not-allowed" : "hover:bg-white/25"
            }`}
          >
            <FaChevronRight className="h-5 w-5" />
          </motion.button>

          {/* ── Photo ── */}
          <AnimatePresence mode="wait">
            <motion.div
              key={image.key}
              initial={{ opacity: 0, scale: 0.96, x: 30 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.96, x: -30 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="relative flex items-center justify-center max-h-[82vh] max-w-[84vw] lg:h-full lg:w-full rounded-3xl lg:max-h-[100vh] lg:max-w-[100vw] lg:rounded-none shadow-glow lg:shadow-none overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Low-res thumbnail shown instantly */}
              <img
                src={image.url}
                alt={image.key}
                className={`max-h-[82vh] max-w-[84vw] lg:h-full lg:w-full rounded-3xl lg:max-h-[100vh] lg:max-w-[100vw] lg:rounded-none object-contain transition-all duration-500 ${
                  highResLoaded ? "blur-none" : "blur-lg scale-105"
                }`}
              />

              {/* High-res fades in on top once loaded */}
              {image.original_url && image.original_url !== image.url && (
                <img
                  src={image.original_url}
                  alt={image.key}
                  onLoad={() => setHighResLoaded(true)}
                  className={`absolute inset-0 h-full w-full rounded-3xl lg:rounded-none object-contain transition-opacity duration-500 ${
                    highResLoaded ? "opacity-100" : "opacity-0"
                  }`}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* ── Dot indicator ── */}
          {total <= 20 && (
            <div
              className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              {images.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Go to photo ${i + 1}`}
                  onClick={() => {
                    const diff = i - index;
                    if (diff > 0) for (let j = 0; j < diff; j++) onNext();
                    else if (diff < 0) for (let j = 0; j < -diff; j++) onPrev();
                  }}
                  className={`rounded-full transition-all duration-300 ${
                    i === index
                      ? "h-2.5 w-6 bg-white"
                      : "h-2 w-2 bg-white/30 hover:bg-white/60"
                  }`}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
