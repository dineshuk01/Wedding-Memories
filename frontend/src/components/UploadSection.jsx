import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { FaCheck, FaCloudArrowUp } from "react-icons/fa6";

import { uploadImage } from "../api/galleryApi";
import CategoryCard from "./CategoryCard";

export default function UploadSection({ categories, counts, onUploaded }) {
  const inputRef = useRef(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  const openPicker = (categoryId) => {
    setActiveCategory(categoryId);
    inputRef.current?.click();
  };

  const handleFiles = async (files, categoryId = activeCategory) => {
    const file = files?.[0];
    if (!file || !categoryId) return;

    setUploading(true);
    setProgress(0);
    setPreview(URL.createObjectURL(file));

    try {
      const uploaded = await uploadImage(categoryId, file, (event) => {
        if (!event.total) return;
        setProgress(Math.round((event.loaded * 100) / event.total));
      });
      toast.success("Image uploaded");
      onUploaded(categoryId, uploaded);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <section className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-5 shadow-2xl sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-cyan-200">Upload Images</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Save a new memory</h2>
        </div>
        <div className="hidden h-12 w-12 place-items-center rounded-2xl bg-cyan-300 text-slate-950 sm:grid">
          {uploading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" /> : <FaCloudArrowUp />}
        </div>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (!activeCategory) {
            toast.error("Choose a category before dropping an image");
            return;
          }
          handleFiles(event.dataTransfer.files);
        }}
        className={`mb-5 rounded-3xl border border-dashed p-5 transition ${
          isDragging ? "border-cyan-300 bg-cyan-300/10" : "border-white/15 bg-slate-950/20"
        }`}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              count={counts[category.id]}
              mode="upload"
              selected={activeCategory === category.id}
              disabled={uploading}
              onClick={() => openPicker(category.id)}
            />
          ))}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
      />

      {(uploading || preview) && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/35"
        >
          {preview && <img src={preview} alt="Uploaded preview" className="h-56 w-full object-cover" />}
          <div className="p-4">
            <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
              <span>{uploading ? "Uploading" : "Upload complete"}</span>
              <span className="flex items-center gap-2">{!uploading && <FaCheck className="text-emerald-300" />}{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-300"
              />
            </div>
          </div>
        </motion.div>
      )}
    </section>
  );
}
