'use client';

import React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Lock, ArrowRight } from 'lucide-react';

export default function InventoryPortalView() {
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col justify-between bg-[#fafafa] text-zinc-900 selection:bg-pink-100 relative">
      {/* Subtle brand ambient accents */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-pink-100/60 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-zinc-200/50 blur-3xl" />
      </div>

      {/* Top minimal header */}
      <header className="relative z-10 px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#f01172] flex items-center justify-center text-white font-black text-sm tracking-tighter shadow-sm shadow-[#f01172]/30">
            M
          </div>
          <span className="font-extrabold tracking-[0.25em] text-sm text-zinc-900">MOLLARI</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-medium tracking-wide uppercase text-zinc-400">Portal Ready</span>
        </div>
      </header>

      {/* Center discreet card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md p-8 sm:p-10 rounded-3xl bg-white border border-zinc-200/80 shadow-xl shadow-zinc-200/40 text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-zinc-50 border border-zinc-200/60 flex items-center justify-center text-zinc-700 mb-6">
            <Lock className="w-5 h-5 text-zinc-700" />
          </div>

          <p className="text-[11px] uppercase tracking-[0.35em] font-semibold text-zinc-400">Private System</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
            Internal Operations Portal
          </h1>
          <p className="mt-3 text-xs sm:text-sm text-zinc-500 max-w-xs mx-auto leading-relaxed">
            Authorized personnel login required. Unauthorized access strictly prohibited.
          </p>

          <div className="mt-8">
            <Link
              href={isAuthenticated ? '/dashboard' : '/login'}
              className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-sm bg-zinc-900 hover:bg-zinc-800 text-white shadow-md transition hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>{isAuthenticated ? 'Open Dashboard' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>

      {/* Discreet bottom footer */}
      <footer className="relative z-10 px-8 py-5 text-center text-[11px] text-zinc-400">
        <span>© {new Date().getFullYear()} Mollari. All rights reserved.</span>
      </footer>
    </div>
  );
}
