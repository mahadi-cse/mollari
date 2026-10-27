import { Suspense } from 'react';
import { LoginView } from '@/modules/auth';

export const metadata = {
  title: 'Mollari | Sign In',
  description: 'Mollari Internal Operations Portal Login',
};

interface HomePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = searchParams ? await searchParams : {};
  const callbackParam = params.callbackUrl;
  const callbackUrl = Array.isArray(callbackParam) ? callbackParam[0] : callbackParam;

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-zinc-400">Loading portal...</div>}>
      <LoginView callbackUrl={callbackUrl || '/dashboard'} />
    </Suspense>
  );
}
