import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { loginUser } from "../api/galleryApi";
import loginBg from "../login-bg.jpg";

const HeartIcon = () => (
  <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
  </svg>
);

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shaking, setShaking] = useState(false);

  const triggerShake = (message) => {
    setError(message);
    setShaking(true);
    setTimeout(() => setShaking(false), 600);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      triggerShake("Please enter both username and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await loginUser(username.trim(), password);
      onLogin();
    } catch (err) {
      triggerShake(err?.response?.data?.detail || "Incorrect username or password.");
    } finally {
      setLoading(false);
    }
  };

  /* ─────────────────────────────────────────────
     Shared form fields (used in both layouts)
  ───────────────────────────────────────────── */
  const FormFields = (
    <>
      {/* Username */}
      <div className="mb-4">
        <label htmlFor="login-username" className="mb-1.5 block text-sm font-medium text-slate-300">
          Username
        </label>
        <input
          id="login-username"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => { setUsername(e.target.value); setError(""); }}
          placeholder="Your username"
          className="w-full rounded-xl border border-white/10 bg-white/[0.08] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-rose-400/60 focus:bg-white/[0.12] focus:ring-2 focus:ring-rose-400/20"
        />
      </div>

      {/* Password */}
      <div className="mb-5">
        <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-slate-300">
          Password
        </label>
        <div className="relative">
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            placeholder="Your password"
            className="w-full rounded-xl border border-white/10 bg-white/[0.08] px-4 py-3 pr-12 text-sm text-white placeholder-slate-500 outline-none transition focus:border-rose-400/60 focus:bg-white/[0.12] focus:ring-2 focus:ring-rose-400/20"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 transition hover:text-slate-300"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.p
            key="error"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-center text-sm text-rose-300"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Submit */}
      <motion.button
        type="submit"
        disabled={loading}
        whileHover={!loading ? { scale: 1.02 } : {}}
        whileTap={!loading ? { scale: 0.97 } : {}}
        className="w-full rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-600/25 transition hover:from-rose-400 hover:to-pink-500 disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3V4a10 10 0 00-10 10h4z" />
            </svg>
            Signing in…
          </span>
        ) : "Enter the Gallery ✨"}
      </motion.button>

      <p className="mt-4 text-center text-xs text-slate-500">Private &amp; invite-only gallery 💍</p>
    </>
  );

  return (
    <>
      {/* ═══════════════════════════════════════════
          MOBILE LAYOUT  (hidden on lg+)
          Photo top-half, card slides up from bottom
      ═══════════════════════════════════════════ */}
      <div className="flex min-h-screen flex-col bg-slate-950 lg:hidden">

        {/* ── Top: photo peek area ── */}
        <div className="relative h-[46vh] flex-shrink-0 overflow-hidden">
          {/* Photo — positioned so the couple faces are centred */}
          <div
            className="absolute inset-0 bg-cover bg-top"
            style={{ backgroundImage: `url(${loginBg})` }}
          />
          {/* Very light top overlay only for status-bar readability */}
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-slate-950/60 to-transparent" />
          {/* Bottom fade so photo melts smoothly into the card */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-900 to-transparent" />

          {/* Branding badge over photo */}
          <div className="absolute left-4 top-5 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-400 to-pink-600 shadow-lg">
              <HeartIcon />
            </div>
            <span className="text-sm font-semibold text-white drop-shadow">Wedding Memories</span>
          </div>
        </div>

        {/* ── Bottom: login card sheet ── */}
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 -mt-6 flex-1 rounded-t-[2rem] border-t border-white/10 bg-slate-900/95 px-6 pt-7 pb-8 shadow-2xl backdrop-blur-2xl"
        >
          {/* Pull handle */}
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />

          <h2 className="mb-1 text-xl font-bold text-white">Welcome back 👋</h2>
          <p className="mb-6 text-sm text-slate-400">Sign in to view your memories</p>

          <motion.form
            onSubmit={handleSubmit}
            animate={shaking ? { x: [-10, 10, -8, 8, -4, 4, 0] } : { x: 0 }}
            transition={{ duration: 0.5 }}
          >
            {FormFields}
          </motion.form>
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════════
          DESKTOP LAYOUT  (hidden below lg)
          Full-screen photo, side-by-side split
      ═══════════════════════════════════════════ */}
      <div className="relative hidden min-h-screen overflow-hidden bg-slate-950 lg:flex">

        {/* Full-screen background photo */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${loginBg})` }}
        />
        {/* Rose-purple gradient overlay tuned to photo colours */}
        <div className="absolute inset-0 bg-gradient-to-tr from-rose-950/90 via-purple-950/60 to-slate-950/80" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/50 via-transparent to-slate-950/70" />
        {/* Ambient glow blobs */}
        <div className="absolute bottom-0 right-0 h-[55vw] w-[55vw] max-h-[600px] max-w-[600px] rounded-full bg-pink-600/15 blur-[100px] pointer-events-none" />
        <div className="absolute top-0 left-0 h-[40vw] w-[40vw] max-h-[400px] max-w-[400px] rounded-full bg-rose-700/20 blur-[90px] pointer-events-none" />

        {/* Left branding panel */}
        <div className="relative z-10 flex flex-1 flex-col justify-end pb-16 pl-16">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-400 to-pink-600 shadow-xl shadow-rose-600/30">
              <HeartIcon />
            </div>
            <h1 className="text-5xl font-bold leading-tight text-white drop-shadow-lg xl:text-6xl">
              Wedding<br />
              <span className="bg-gradient-to-r from-rose-300 via-pink-300 to-fuchsia-300 bg-clip-text text-transparent">
                Memories
              </span>
            </h1>
            <p className="mt-4 max-w-sm text-base font-light text-rose-100/70 leading-relaxed">
              Every smile, every tear of joy, every beautiful moment — captured forever.
            </p>
            <div className="mt-6 h-0.5 w-20 rounded-full bg-gradient-to-r from-rose-400 to-transparent" />
          </motion.div>
        </div>

        {/* Right login card panel */}
        <div className="relative z-10 flex max-w-[480px] flex-1 items-center justify-center px-12">
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="w-full"
          >
            <motion.form
              onSubmit={handleSubmit}
              animate={shaking ? { x: [-10, 10, -8, 8, -4, 4, 0] } : { x: 0 }}
              transition={{ duration: 0.5 }}
              className="rounded-3xl border border-white/10 bg-white/[0.07] p-9 shadow-2xl backdrop-blur-2xl"
            >
              <div className="mb-7">
                <h2 className="text-2xl font-semibold text-white">Welcome back 👋</h2>
                <p className="mt-1 text-sm text-slate-400">Sign in to access your gallery</p>
              </div>
              {FormFields}
            </motion.form>
          </motion.div>
        </div>
      </div>
    </>
  );
}
