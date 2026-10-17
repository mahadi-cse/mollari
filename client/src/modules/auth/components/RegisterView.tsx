'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';

interface RegisterViewProps {
  callbackUrl?: string;
}

export default function RegisterView({ callbackUrl = '/dashboard' }: RegisterViewProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isGoogleEnabled = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
  const normalizedCallbackUrl =
    callbackUrl && callbackUrl !== '/redirect' && callbackUrl !== '/auth/redirect'
      ? callbackUrl
      : '/dashboard';
  const redirectTarget = `/redirect?callbackUrl=${encodeURIComponent(normalizedCallbackUrl)}`;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  useEffect(() => {
    // Guard: don't redirect if session has an error (e.g. expired token needing refresh).
    // AuthSessionWatcher will signOut in that case; redirecting here causes a loop.
    if (status === 'authenticated' && !(session as any)?.error) {
      router.replace(redirectTarget);
    }
  }, [status, session, router, redirectTarget]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await signIn('register', {
        firstName,
        lastName,
        email,
        phone,
        password,
        redirect: false,
        callbackUrl: redirectTarget,
      });

      if (!result || result.error) {
        setError('Registration failed. Please check your details and try again.');
        return;
      }

      if (result.url) {
        router.push(result.url);
      } else {
        router.push(redirectTarget);
      }
    } catch {
      setError('Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!isGoogleEnabled) {
      setError('Google sign-in is not configured yet.');
      return;
    }

    setError(null);
    setIsGoogleSubmitting(true);

    try {
      await signIn('google', {
        callbackUrl: redirectTarget,
      });
    } catch {
      setError('Google sign-in failed. Please try again.');
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-white px-4 py-12">
      <div className="mx-auto flex w-full max-w-5xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-lg shadow-zinc-100">
        <section className="hidden w-1/2 bg-zinc-50 p-10 text-zinc-900 lg:flex lg:flex-col lg:justify-start lg:gap-10 relative overflow-hidden border-r border-zinc-200">
          <div className="absolute top-20 right-10 w-40 h-40 bg-zinc-100/30 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-5 w-32 h-32 bg-zinc-100/30 rounded-full blur-2xl" />

          <div className="relative z-10">
            <p className="text-xs uppercase tracking-[0.4em] text-zinc-500">Mollari</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight text-zinc-900">
              Join
              <span className="block text-zinc-700">Mollari</span>
            </h1>
            <p className="mt-4 max-w-sm text-sm text-zinc-600">
              Create your free account and start shopping the best in beauty, skincare &amp; haircare.
            </p>
          </div>

          <div className="relative z-10 space-y-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl flex-shrink-0">🎁</div>
              <div>
                <p className="font-semibold text-sm text-zinc-900">Exclusive Deals</p>
                <p className="text-xs text-zinc-600">Members get early access to sales, offers &amp; new arrivals</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="text-2xl flex-shrink-0">📦</div>
              <div>
                <p className="font-semibold text-sm text-zinc-900">Easy Order Tracking</p>
                <p className="text-xs text-zinc-600">Know exactly where your order is at every step</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="text-2xl flex-shrink-0">💅</div>
              <div>
                <p className="font-semibold text-sm text-zinc-900">Personalised for You</p>
                <p className="text-xs text-zinc-600">Get recommendations based on your skin type and preferences</p>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full p-6 sm:p-10 lg:w-1/2 flex flex-col justify-center">
          <div className="mb-8">
            <h2 className="text-3xl font-semibold text-zinc-900">Create Account</h2>
            <p className="mt-2 text-sm text-zinc-600">Register as a customer and continue to your dashboard.</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleSubmitting || isSubmitting || !isGoogleEnabled}
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGoogleSubmitting
                ? 'Redirecting to Google...'
                : isGoogleEnabled
                  ? 'Continue with Google'
                  : 'Google sign-in unavailable'}
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-zinc-200" />
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">or</span>
              <div className="h-px flex-1 bg-zinc-200" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-zinc-800">First Name</span>
                <input
                  type="text"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-100"
                  placeholder="First name"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-zinc-800">Last Name</span>
                <input
                  type="text"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-100"
                  placeholder="Last name"
                  required
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-zinc-800">Email Address</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-100"
                placeholder="your@email.com"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-zinc-800">Phone (optional)</span>
              <input
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-100"
                placeholder="01XXXXXXXXX"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-zinc-800">Password</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-zinc-300 pl-4 pr-10 py-3 text-sm outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-100"
                  placeholder="Minimum 8 characters"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-zinc-800">Confirm Password</span>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-xl border border-zinc-300 pl-4 pr-10 py-3 text-sm outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-100"
                  placeholder="Re-enter password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  {showConfirmPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </label>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || isGoogleSubmitting}
              className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-600">
            Already have an account?{' '}
            <Link
              href={`/login?callbackUrl=${encodeURIComponent(normalizedCallbackUrl)}`}
              className="font-semibold text-zinc-900 hover:text-zinc-700 transition"
            >
              Sign in
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
