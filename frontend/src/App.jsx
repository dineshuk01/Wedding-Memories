import React, { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { motion } from "framer-motion";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import backgroundImage from "./background.jpg";
import GallerySection from "./components/GallerySection";
import Navbar from "./components/Navbar";
import UploadSection from "./components/UploadSection";
import { fetchCategoryCounts } from "./api/galleryApi";
import { categories } from "./data/categories";
import CategoryGalleryPage from "./pages/CategoryGalleryPage";
import LoginPage from "./pages/LoginPage";

const initialCounts = Object.fromEntries(categories.map((category) => [category.id, 0]));
const SESSION_KEY = "wedding_gallery_auth_v1";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return sessionStorage.getItem(SESSION_KEY) === "true";
  });

  const [counts, setCounts] = useState(initialCounts);
  const [search, setSearch] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [uploadedCategory, setUploadedCategory] = useState(null);

  const handleLogin = () => {
    sessionStorage.setItem(SESSION_KEY, "true");
    setIsLoggedIn(true);
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    fetchCategoryCounts()
      .then((nextCounts) => setCounts((current) => ({ ...current, ...nextCounts })))
      .catch(() => toast.error("Could not load category counts"));
  }, [isLoggedIn]);

  const handleUploaded = (categoryId) => {
    setCounts((current) => ({ ...current, [categoryId]: (current[categoryId] || 0) + 1 }));
    setUploadedCategory(categoryId);
    setRefreshToken((value) => value + 1);
  };

  const handleCountChange = (categoryId, count) => {
    setCounts((current) => ({ ...current, [categoryId]: count }));
  };

  // Show login gate until authenticated
  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const HomePage = (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 flex flex-col items-center justify-center text-center"
      >
        <p className="font-serif text-3xl font-extralight italic tracking-wide text-slate-100 sm:text-4xl lg:text-5xl md:leading-relaxed">
          "From this day forward, every picture tells our story."
        </p>
        <div className="mt-6 h-1 w-24 rounded-full bg-gradient-to-r from-rose-400 via-pink-400 to-amber-300 opacity-80 shadow-glow" />
      </motion.div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <UploadSection categories={categories} counts={counts} onUploaded={handleUploaded} />
        <GallerySection categories={categories} counts={counts} uploadedCategory={uploadedCategory} />
      </div>
    </main>
  );

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950 text-white">
        <div
          className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat opacity-30 mix-blend-lighten"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
        <div className="fixed inset-0 -z-10 bg-gradient-to-b from-slate-950/65 via-slate-950/85 to-slate-950" />
        <Navbar search={search} onSearchChange={setSearch} />

        <Routes>
          <Route path="/" element={HomePage} />
          <Route path="/gallery/:categoryId" element={<CategoryGalleryPage search={search} />} />
        </Routes>

        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "rgba(15, 23, 42, 0.92)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.12)",
              backdropFilter: "blur(18px)",
            },
          }}
        />
      </div>
    </BrowserRouter>
  );
}
