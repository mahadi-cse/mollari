// Storefront header & footer temporarily disabled for inventory control portal
// import { Header } from '@/modules/homepage/components/Header';
// import { Footer } from '@/modules/homepage/components/Footer';

export default function PublicLayout({ children }: { children: React.ReactNode }) { 
  return (
    <div className="flex flex-col min-h-screen overflow-x-clip bg-[#fafafa]">
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}

