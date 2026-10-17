"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Search, ShoppingCart, User, MapPin, Mail, Phone } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useState, useEffect, useRef, type FormEvent, type MouseEvent as ReactMouseEvent } from "react";

import { useHomepageCategories, useHomepageStats, useSiteSettings, useSearchProducts } from "@/modules/homepage";
import { useCart } from "@/shared/contexts/CartContext";
import { useWishlist } from "@/shared/contexts/WishlistContext";
import { useActivePromotion } from "@/modules/promotions";
import { useHomepageLocale } from "../locales/HomepageLocaleContext";
import { LanguageToggle } from "./LanguageToggle";
import Image from "next/image";

export function Header() {
  const router = useRouter();
  const { data: categories = [] } = useHomepageCategories();
  const { data: settings } = useSiteSettings();
  const { data: stats } = useHomepageStats();
  const { data: activePromotion } = useActivePromotion();
  const { status } = useSession();
  const { totalItems: cartCount, setIsOpen: setCartOpen } = useCart();
  const { count: wishlistCount, setIsOpen: setWishlistOpen } = useWishlist();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: searchResults, isLoading: isSearching } = useSearchProducts(debouncedSearchTerm, 5);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  // Close menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
    setIsMobileSearchOpen(false);
  }, [router]);

  // Prevent scrolling when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMenuOpen]);

  const { t } = useHomepageLocale();
  const storeName = settings?.storeName || "Mollari";
  const [storeNameFirst, ...storeNameRest] = storeName.split(/\s+/).filter(Boolean);
  const storeNameRestText = storeNameRest.join(" ");
  const tagline = settings?.tagline || t.header.taglineFallback;

  const navCategories = categories.length
    ? categories.slice(0, 4).map((c) => ({
      key: c.slug,
      label: c.name,
      href: `/categories/${c.slug}`,
    }))
    : t.header.productCategories.map((name) => ({
      key: name,
      label: name,
      href: "#",
    }));

  const isAuthenticated = status === "authenticated";
  const canAccessDashboard = isAuthenticated;

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" });
  };

  const handleSearchSubmit = (event?: FormEvent | ReactMouseEvent) => {
    event?.preventDefault();
    const trimmed = searchTerm.trim();

    if (!trimmed) {
      router.push('/shop');
      return;
    }

    router.push(`/shop?search=${encodeURIComponent(trimmed)}`);
    setIsMobileSearchOpen(false);
  };

  return (
    <header className="bg-white sticky top-0 z-50 shadow-sm">
      {/* Top Bar - Dark background info strip */}
      <div className="hidden md:block bg-zinc-900 text-zinc-400 text-xs tracking-widest border-b border-zinc-800">
        <div className="mx-auto max-w-[1600px] px-6 sm:px-10 py-2 flex gap-6">
          <span className="flex items-center gap-2">
            <MapPin size={12} /> {t.header.deliveryBanner}
          </span>
          <span className="flex items-center gap-2">
            <Mail size={12} /> support@mollari.com
          </span>
          <span className="flex items-center gap-2">
            <Phone size={12} /> 01700-000000
          </span>
          <div className="ml-auto flex gap-4">
            {activePromotion && (
              <span className="bg-primary text-white px-3 py-1 rounded-full text-[10px] font-semibold">
                ✦ {activePromotion.pct}% {t.header.off} · {activePromotion.banner}{activePromotion.endsAt ? ` · ${t.header.ends} ${activePromotion.endsAt}` : ''}
              </span>
            )}
            <a href="#" className="hover:text-white transition">{t.header.trackOrder}</a>
            <a href="#" className="hover:text-white transition">{t.header.storeLocator}</a>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="border-b border-zinc-200">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-10 py-2.5 lg:py-3 flex items-center justify-between gap-4">
          {/* Brand Logo - Serif font */}
          <Link href="/" className="min-w-0 no-underline text-inherit hover:opacity-90 transition-opacity">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold tracking-tight leading-tight">
              {storeNameFirst || "Mollari"}{" "}
              <span className="text-primary italic">{storeNameRestText}</span>
            </h1>
            <p className="hidden sm:block text-[10px] tracking-widest text-zinc-500 uppercase">{tagline}</p>
          </Link>

          {/* Search Bar - Center (Desktop) */}
          <div className="hidden lg:flex flex-1 justify-center px-8 relative" ref={searchContainerRef}>
            <div className="w-full max-w-sm relative">
              <form
                onSubmit={handleSearchSubmit}
                className="flex w-full overflow-hidden rounded-full border border-zinc-300 bg-zinc-50 transition focus-within:border-primary"
              >
                <input
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setIsSearchOpen(true);
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                  placeholder={t.header.searchPlaceholder}
                  className="w-full bg-transparent px-5 py-2.5 text-sm outline-none placeholder-zinc-500"
                />
                <button type="submit" className="px-4 text-zinc-600 transition hover:text-primary" aria-label={t.header.ariaSearch}>
                  <Search size={16} />
                </button>
              </form>

              {/* Search Results Dropdown */}
              {isSearchOpen && searchTerm && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden z-50">
                  {isSearching ? (
                    <div className="p-4 text-center text-sm text-zinc-500">{t.header.searching}</div>
                  ) : searchResults && searchResults.length > 0 ? (
                    <div className="flex flex-col">
                      {searchResults.map((product) => (
                        <Link
                          key={product.id}
                          href={`/product/${product.slug}`}
                          onClick={() => setIsSearchOpen(false)}
                          className="flex items-center gap-3 p-3 hover:bg-zinc-50 transition border-b border-zinc-100 last:border-0"
                        >
                          <div className="h-10 w-10 flex-shrink-0 bg-zinc-100 rounded-md overflow-hidden relative">
                            {product.images && product.images.length > 0 && product.images[0] ? (
                              <Image src={typeof product.images[0] === 'string' ? product.images[0] : (product.images[0] as any).url} alt={product.name} fill className="object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-400">
                                <Search size={14} />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-zinc-900 truncate">{product.name}</p>
                            <p className="text-xs text-zinc-500">৳{product.price}</p>
                          </div>
                        </Link>
                      ))}
                      <Link
                        href={`/shop?search=${encodeURIComponent(searchTerm)}`}
                        onClick={() => setIsSearchOpen(false)}
                        className="p-3 text-center text-sm text-primary font-medium bg-rose-50 hover:bg-rose-100 transition"
                      >
                        {t.header.viewAllResults}
                      </Link>
                    </div>
                  ) : (
                    <div className="p-4 text-center text-sm text-zinc-500">{t.header.noResults} &quot;{searchTerm}&quot;</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1 lg:gap-3">
            {/* Search Icon (Mobile Only) */}
            <button
              className="lg:hidden p-2 text-zinc-700"
              onClick={() => setIsMobileSearchOpen(true)}
              aria-label="Search"
            >
              <Search size={20} />
            </button>

            {/* Language Toggle */}
            <div className="hidden sm:block">
              <LanguageToggle />
            </div>

            {/* Wishlist */}
            <button
              onClick={() => setWishlistOpen(true)}
              className="relative p-2 rounded-lg transition hover:bg-rose-50 text-zinc-700 hover:text-primary"
              aria-label={t.header.ariaWishlist}
            >
              <Heart size={20} className="lg:w-[18px] lg:h-[18px]" />
              {wishlistCount > 0 && (
                <span className="absolute top-0.5 right-0.5 bg-primary text-white text-[10px] font-bold w-4 h-4 lg:w-5 lg:h-5 rounded-full flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </button>

            {/* Cart */}
            <button
              onClick={() => setCartOpen(true)}
              className="relative p-2 rounded-lg transition hover:bg-rose-50 text-zinc-700 hover:text-primary"
              aria-label={t.header.ariaCart}
            >
              <ShoppingCart size={20} className="lg:w-[18px] lg:h-[18px]" />
              {cartCount > 0 && (
                <span className="absolute top-0.5 right-0.5 bg-primary text-white text-[10px] font-bold w-4 h-4 lg:w-5 lg:h-5 rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Hamburger (Mobile Only) - Moved to Right */}
            <button
              className="lg:hidden p-2 text-zinc-700"
              onClick={() => setIsMenuOpen(true)}
              aria-label="Open Menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>

            {/* Desktop Account Buttons */}
            <div className="hidden lg:flex items-center gap-3">
              {isAuthenticated ? (
                <>
                  {canAccessDashboard && (
                    <Link
                      href="/dashboard"
                      className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-primary hover:text-primary"
                    >
                      {t.header.dashboard}
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex items-center gap-2 bg-zinc-900 text-white px-5 py-2.5 rounded-full font-medium text-sm transition hover:bg-zinc-800"
                  >
                    <User size={16} />
                    {t.header.signOut}
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-full font-medium text-sm transition hover:bg-primary/90 shadow-md shadow-primary/10"
                >
                  <User size={16} />
                  {t.header.signIn}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Search Overlay */}
      <div
        className={`lg:hidden fixed inset-0 bg-white z-[100] transition-transform duration-300 ${isMobileSearchOpen ? 'translate-y-0' : '-translate-y-full'}`}
      >
        <div className="p-4 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setIsMobileSearchOpen(false)}
              className="p-2 text-zinc-500"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
            {isMobileSearchOpen && (
              <form onSubmit={handleSearchSubmit} className="flex-1">
                <input
                  autoFocus
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t.header.searchPlaceholder}
                  className="w-full text-lg font-medium outline-none border-b-2 border-primary py-2"
                />
              </form>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {searchTerm && (
              <div className="space-y-4">
                {isSearching ? (
                  <p className="text-center text-zinc-500 py-10">{t.header.searching}</p>
                ) : searchResults && searchResults.length > 0 ? (
                  <div className="grid gap-4">
                    {searchResults.map((product) => (
                      <Link
                        key={product.id}
                        href={`/product/${product.id}`}
                        className="flex items-center gap-4 p-2"
                      >
                        <div className="w-16 h-16 bg-zinc-100 rounded-xl overflow-hidden relative">
                          {product.images?.[0] && (
                            <Image src={typeof product.images[0] === 'string' ? product.images[0] : (product.images[0] as any).url} alt={product.name} fill className="object-cover" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-zinc-900">{product.name}</p>
                          <p className="text-primary font-bold">৳{product.price}</p>
                        </div>
                      </Link>
                    ))}
                    <button
                      onClick={handleSearchSubmit}
                      className="w-full py-4 text-primary font-bold text-center border-t border-zinc-100 mt-4"
                    >
                      {t.header.viewAllResults}
                    </button>
                  </div>
                ) : (
                  <p className="text-center text-zinc-500 py-10">{t.header.noResults}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>



      {/* Category Navigation (Desktop Only) */}
      <nav className="hidden lg:block border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-[1600px] px-6 sm:px-10 flex items-center gap-1 py-0">
          <div className="flex items-center gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden">
            {navCategories.map((cat) => (
              <Link
                key={cat.key}
                href={cat.href}
                className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-600 whitespace-nowrap transition hover:text-primary"
              >
                <span className="w-1 h-1 rounded-full bg-current opacity-40"></span>
                {cat.label}
              </Link>
            ))}
            {/* Sale Link */}
            <Link href="/shop?filter=sale" className="flex items-center gap-2 px-4 py-3 text-sm text-primary font-medium whitespace-nowrap">
              <span className="w-1 h-1 rounded-full bg-current"></span>
              {t.header.sale}
            </Link>
          </div>

          {/* Free Delivery Badge */}
          <div className="flex items-center gap-1 ml-auto">
            {(stats?.isFreeDeliveryActive ?? true) && (
              <>
                <span className="bg-rose-100 text-primary px-2 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap">{t.header.freeDelivery}</span>
                <span className="hidden xl:inline text-[10px] text-zinc-600 whitespace-nowrap ml-1">
                  {t.header.ordersOver} ৳{stats?.minFreeDeliveryAmount ?? 999}
                </span>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Drawer Overlay */}
      <div
        className={`fixed inset-0 bg-black/50 transition-opacity duration-300 z-[60] lg:hidden ${isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsMenuOpen(false)}
      />

      {/* Mobile Drawer Content */}
      <div className={`fixed inset-y-0 right-0 w-[80%] max-w-[320px] bg-white z-[70] transition-transform duration-300 lg:hidden flex flex-col ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Drawer Header */}
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold italic text-primary">Mollari</h2>
            <div className="mt-1">
              <LanguageToggle />
            </div>
          </div>
          <button onClick={() => setIsMenuOpen(false)} className="p-2 -mr-2 text-zinc-500 hover:bg-zinc-100 rounded-full transition">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Drawer Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Account - Moved to Top for Quick Access */}
          <div className="space-y-4">
            {isAuthenticated ? (
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/dashboard"
                  className="flex items-center justify-center gap-2 bg-primary/10 text-primary p-3 rounded-xl font-bold text-sm transition active:scale-95"
                >
                  <User size={18} />
                  {t.header.dashboard}
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex items-center justify-center gap-2 bg-zinc-100 text-zinc-600 p-3 rounded-xl font-bold text-sm transition active:scale-95"
                >
                  {t.header.signOut}
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-3 bg-primary text-white p-4 rounded-xl font-bold justify-center shadow-lg shadow-primary/20 transition active:scale-95"
              >
                <User size={18} />
                {t.header.signIn}
              </Link>
            )}
          </div>

          {/* Navigation */}
          <div className="space-y-4 pt-4 border-t border-zinc-100">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{t.footer.sections.links}</p>
            <div className="flex flex-col gap-4">
              <Link href="/" className="text-lg font-medium text-zinc-900">Home</Link>
              <Link href="/shop" className="text-lg font-medium text-zinc-900">Shop All</Link>
              <Link href="/categories" className="text-lg font-medium text-zinc-900">Categories</Link>
              <Link href="/shop?filter=sale" className="text-lg font-medium text-primary">{t.header.sale}</Link>
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-4">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Our Categories</p>
            <div className="flex flex-col gap-4">
              {navCategories.map((cat) => (
                <Link key={cat.key} href={cat.href} className="text-sm text-zinc-600">{cat.label}</Link>
              ))}
            </div>
          </div>


        </div>

        {/* Drawer Footer */}
        <div className="p-6 bg-zinc-50 border-t border-zinc-100 space-y-4">
          <div className="flex items-center gap-3 text-zinc-500 text-sm">
            <Phone size={14} />
            <span>01700-000000</span>
          </div>
          <div className="flex items-center gap-3 text-zinc-500 text-sm">
            <Mail size={14} />
            <span>support@mollari.com</span>
          </div>
        </div>
      </div>
    </header>
  );
}
