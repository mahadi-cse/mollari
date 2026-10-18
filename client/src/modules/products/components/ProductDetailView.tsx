'use client';

import { useProductBySlug, useListProducts } from '../queries';
import { useProductPromotion } from '@/modules/promotions/queries';
import { SkeletonCard, SkeletonProductDetail, ErrorMessage, EmptyState } from '@/shared/components';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Heart, Star, ShoppingCart, Tag } from 'lucide-react';
import { useWishlist } from '@/shared/contexts/WishlistContext';
import { useProductReviews, useReviewEligibility, useCreateReview, useUpdateReview, useDeleteReview } from '@/modules/reviews/queries';
import { getProductMainImage, getProductThumbnail, getProductCardImage } from '@/shared/utils/imageOptimizer';

function formatMoney(value?: number | string | null) {
  return `৳${Number(value || 0).toLocaleString('en-BD', { maximumFractionDigits: 2 })}`;
}

type TabType = 'description' | 'specifications' | 'reviews' | 'faqs';

const PINK = 'var(--primary)';
const PINK_DARK = 'var(--primary-dark)';
const PINK_LIGHT = 'var(--primary-light)';
const PINK_PALE = 'var(--primary-pale)';
const DARK = '#1f2937';
const GRAY = '#4b5563';
const GRAY_LIGHT = '#9ca3af';

export default function ProductDetailView({ slug: propSlug }: { slug?: string }) {
  const params = useParams();
  const router = useRouter();
  const { status } = useSession();
  const slugParam = params?.slug;
  const slug = propSlug || (Array.isArray(slugParam) ? slugParam[0] : slugParam || '');

  // Product State  
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedSizeIndex, setSelectedSizeIndex] = useState(0);
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const [activeTab, setActiveTab] = useState<TabType>('description');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [tabExpanded, setTabExpanded] = useState<Record<TabType, boolean>>({
    description: false,
    specifications: false,
    reviews: false,
    faqs: false,
  });

  const { data: product, isLoading, isError, error, refetch } = useProductBySlug(slug);
  const { data: reviewSummary } = useProductReviews(product?.id || 0);
  const { data: activePromotion } = useProductPromotion(slug);

  // Fetch similar products from the same category
  const categorySlug = product?.category?.slug;
  const { data: categoryProducts = [] } = useListProducts(
    { category: categorySlug, limit: 8 },
    {
      enabled: !!categorySlug,
      staleTime: 10 * 60 * 1000,
    }
  );
  const relatedProducts = useMemo(
    () => categoryProducts.filter((p: any) => p.slug !== slug).slice(0, 4),
    [categoryProducts, slug]
  );

  const images = useMemo(() => {
    if (!product?.images?.length) {
      return ['/placeholder.png'];
    }
    return product.images;
  }, [product]);

  // Color support
  const colors = useMemo(() => (product?.colors || []).filter((c: any) => c.isActive !== false), [product]);
  const hasColors = colors.length > 0;
  const selectedColor = hasColors ? colors[selectedColorIndex] || colors[0] : null;

  // Size & Unit support (if product has colors, sizes belong to the selected color)
  const sizes = useMemo(() => {
    if (hasColors && selectedColor) {
      if (selectedColor.sizes && selectedColor.sizes.length > 0) {
        return selectedColor.sizes.filter((s: any) => s.isActive !== false);
      }
      return [];
    }
    return (product?.sizes || []).filter((s: any) => s.isActive !== false);
  }, [hasColors, selectedColor, product]);

  const hasSizes = sizes.length > 0;
  const selectedSize = hasSizes ? sizes[selectedSizeIndex] || sizes[0] : null;
  const unitType = product?.unitType || 'PIECE';
  const unitLabel = product?.unitLabel || 'pc';

  useEffect(() => {
    setSelectedSizeIndex(0);
  }, [selectedColorIndex]);

  const displayImages = useMemo(() => {
    let list = [...images];
    if (selectedColor?.imageUrl && !list.includes(selectedColor.imageUrl)) {
      list = [selectedColor.imageUrl, ...list];
    }
    return list;
  }, [images, selectedColor]);

  // Unused mock arrays removed

  useEffect(() => {
    setActiveImageIndex(0);
    // Ensure we start at the top when navigating to a new product page
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [slug]);

  const availableStock = useMemo(() => {
    if (!product) return 0;
    if (hasColors && selectedColor) {
      if (hasSizes && selectedSize) {
        return Number(selectedSize.quantity) || 0;
      }
      if (selectedColor.quantity !== undefined && selectedColor.quantity !== null) {
        return Number(selectedColor.quantity) || 0;
      }
    } else if (hasSizes && selectedSize) {
      return Number(selectedSize.quantity) || 0;
    }

    return (product?.inventories || []).reduce((total: number, inventory: any) => {
      const available = Math.max(0, (inventory.quantity || 0) - (inventory.reservedQty || 0));
      return total + available;
    }, 0);
  }, [product, hasColors, selectedColor, hasSizes, selectedSize]);

  const maxAllowedQuantity = useMemo(() => {
    if (availableStock <= 0) return 0;
    return Math.min(availableStock, 10);
  }, [availableStock]);

  useEffect(() => {
    if (maxAllowedQuantity > 0 && quantity > maxAllowedQuantity) {
      setQuantity(maxAllowedQuantity);
    }
  }, [maxAllowedQuantity, quantity]);

  const inStock = availableStock > 0;
  const safeQuantity = inStock ? Math.min(Math.max(1, quantity), maxAllowedQuantity || 1) : 1;

  const basePrice = Number(product?.price || 0);
  const price = useMemo(() => {
    if (hasSizes && selectedSize?.priceOverride) {
      return Number(selectedSize.priceOverride);
    }
    if (hasColors && selectedColor?.priceOverride) {
      return Number(selectedColor.priceOverride);
    }
    return basePrice;
  }, [basePrice, hasSizes, selectedSize, hasColors, selectedColor]);

  const compareAtPrice = Number(product?.compareAtPrice || 0);
  const hasDiscount = compareAtPrice > price;
  const savings = hasDiscount ? compareAtPrice - price : 0;
  const discountPercent = hasDiscount ? Math.round((savings / compareAtPrice) * 100) : 0;

  // Promotion discount
  const promoDiscountPct = activePromotion?.pct || 0;
  const promoSavings = promoDiscountPct > 0 ? Math.round(price * promoDiscountPct / 100) : 0;
  const promoPrice = promoDiscountPct > 0 ? Math.max(0, price - promoSavings) : 0;

  // Effective discount: whichever is better for the customer
  const bestDiscountPct = Math.max(discountPercent, promoDiscountPct);
  const bestPrice = promoDiscountPct > discountPercent ? promoPrice : price;
  const bestSavings = promoDiscountPct > discountPercent ? promoSavings : savings;
  const hasAnyDiscount = bestDiscountPct > 0;

  const subtotal = price * safeQuantity;
  const highlights = (product?.tags || []).slice(0, 5);
  const descriptionContent =
    product?.description ||
    'This premium product is formulated with the finest ingredients to deliver exceptional results. Crafted with care and backed by scientific research, it offers powerful benefits for daily use.';


  const updateQuantity = (next: number) => {
    if (!inStock) {
      setQuantity(1);
      return;
    }
    setQuantity(Math.min(maxAllowedQuantity || 1, Math.max(1, next)));
  };

  const handleBuyNowClick = () => {
    if (!inStock) {
      toast.error('This product is currently out of stock.');
      return;
    }
    const sizeParam = selectedSize ? `&size=${encodeURIComponent(selectedSize.name)}` : '';
    const colorParam = selectedColor ? `&color=${encodeURIComponent(selectedColor.name)}` : '';
    const targetCheckoutUrl = `/checkout?slug=${product!.slug}&qty=${safeQuantity}${sizeParam}${colorParam}`;

    if (status === 'unauthenticated') {
      toast.error('Please login to place an order');
      router.push(`/login?callbackUrl=${encodeURIComponent(targetCheckoutUrl)}`);
      return;
    }
    router.push(targetCheckoutUrl);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 min-h-[80vh]">
        <SkeletonProductDetail />
      </div>
    );
  }

  if (isError) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: string }).message || 'Failed to load product')
        : 'Failed to load product';

    return (
      <div className="container mx-auto px-4 py-8 min-h-[80vh]">
        <ErrorMessage message={message} onRetry={() => refetch()} />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-8 min-h-[80vh] flex items-center justify-center">
        <EmptyState
          title="Product Not Found"
          description="The product you're looking for doesn't exist or has been removed"
          action={{ label: 'Back to Shop', onClick: () => window.history.back() }}
        />
      </div>
    );
  }



  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: '#fff', color: DARK }}>
      <style>{`
        .similar-product-card {
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
          box-shadow: 0 4px 15px rgba(0,0,0,0.03) !important;
        }
        .similar-product-card:hover {
          transform: translateY(-8px) !important;
          box-shadow: 0 15px 35px color-mix(in srgb, var(--primary) 10%, transparent) !important;
        }
        
        .pd-breadcrumb {
          padding: 16px 24px;
        }
        @media (max-width: 767px) {
          .pd-breadcrumb {
            padding: 12px 16px;
          }
        }
        
        .pd-main-container {
          padding: 20px 24px 24px;
        }
        @media (max-width: 767px) {
          .pd-main-container {
            padding: 16px;
          }
        }
        
        .pd-main-grid {
          display: grid;
          grid-template-columns: 0.92fr 1.08fr;
          gap: 20px;
          align-items: flex-start;
        }
        @media (max-width: 1023px) {
          .pd-main-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
        }
        
        .pd-gallery-sticky {
          position: sticky;
          top: 90px;
        }
        @media (max-width: 1023px) {
          .pd-gallery-sticky {
            position: relative;
            top: 0;
          }
        }
        
        .pd-main-image-container {
          height: 320px;
        }
        @media (max-width: 767px) {
          .pd-main-image-container {
            height: 260px;
          }
        }

        .pd-thumb-container {
          height: 72px;
        }
        @media (max-width: 767px) {
          .pd-thumb-container {
            height: 60px;
          }
        }

        .pd-title {
          font-size: 28px;
        }
        @media (max-width: 767px) {
          .pd-title {
            font-size: 24px;
          }
        }

        .pd-action-row {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 10px;
          margin-top: 2px;
          background: #fff;
          border: 1.5px solid var(--primary-light);
          border-radius: 16px;
          padding: 10px;
        }
        @media (max-width: 767px) {
          .pd-action-row {
            flex-direction: column;
            align-items: stretch;
          }
        }

        .pd-buy-button {
          flex: 1;
          min-width: 180px;
        }
        @media (max-width: 767px) {
          .pd-buy-button {
            width: 100%;
            min-width: 100%;
          }
        }

        .pd-related-container {
          margin-top: 80px;
          padding: 40px 32px;
          background: #fcfcfc;
          border-radius: 32px;
          border: 1px solid var(--primary-light);
        }
        @media (max-width: 767px) {
          .pd-related-container {
            margin-top: 48px;
            padding: 24px 16px;
            border-radius: 20px;
          }
        }

        .pd-related-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-direction: row;
          margin-bottom: 32px;
        }
        @media (max-width: 767px) {
          .pd-related-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
        }

        .pd-related-title {
          font-size: 24px;
        }
        @media (max-width: 767px) {
          .pd-related-title {
            font-size: 20px;
          }
        }

        .pd-related-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
        }
        @media (max-width: 1023px) {
          .pd-related-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media (max-width: 767px) {
          .pd-related-grid {
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }
        }

        .pd-related-card {
          background: #fff;
          border: 1px solid var(--primary-light);
          border-radius: 24px;
          overflow: hidden;
          cursor: pointer;
        }
        @media (max-width: 767px) {
          .pd-related-card {
            border-radius: 16px;
          }
        }

        .pd-related-image-container {
          position: relative;
          height: 180px;
          background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 3%, white), var(--primary-pale));
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        @media (max-width: 767px) {
          .pd-related-image-container {
            height: 120px;
          }
        }

        .pd-related-content {
          padding: 20px;
        }
        @media (max-width: 767px) {
          .pd-related-content {
            padding: 12px;
          }
        }
      `}</style>

      {/* Breadcrumb */}
      <div className="pd-breadcrumb" style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: GRAY_LIGHT, flexWrap: 'wrap' }}>
        <Link href="/" style={{ color: GRAY, fontWeight: 500, cursor: 'pointer', textDecoration: 'none' }}>Home</Link>
        <span style={{ color: GRAY_LIGHT }}>›</span>
        <Link href="/shop" style={{ color: GRAY, fontWeight: 500, cursor: 'pointer', textDecoration: 'none' }}>Shop</Link>
        <span style={{ color: GRAY_LIGHT }}>›</span>
        {product.category?.name && <span style={{ color: GRAY, fontWeight: 500 }}>{product.category.name}</span>}
        {product.category?.name && <span style={{ color: GRAY_LIGHT }}>›</span>}
        <span style={{ color: PINK, fontWeight: 700 }}>{product.name}</span>
      </div>

      {/* Main Content */}
      <div className="pd-main-container" style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div className="pd-main-grid">
          {/* LEFT: Gallery */}
          <div className="pd-gallery-sticky">
            {/* Main Image */}
            <div className="pd-main-image-container" style={{ borderRadius: 24, overflow: 'hidden', border: `1.5px solid ${PINK_LIGHT}`, background: PINK_PALE, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', transition: 'all 0.3s' }}>
              <Image 
                src={getProductMainImage(displayImages[activeImageIndex])} 
                alt={product.name} 
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
              {hasAnyDiscount && (
                <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', background: PINK, color: '#fff', border: `1.5px solid ${PINK}` }}>
                    BEST SELLER
                  </span>
                  <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', background: 'transparent', color: PINK, border: `1.5px solid ${PINK}` }}>
                    {promoDiscountPct > discountPercent ? '🎉 PROMO' : 'Save'} {bestDiscountPct}%
                  </span>
                </div>
              )}
              <button style={{ position: 'absolute', top: 16, right: 16, width: 38, height: 38, borderRadius: '50%', background: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => {
                if (isInWishlist(String(product.id))) {
                  removeFromWishlist(String(product.id));
                } else {
                  addToWishlist({ id: String(product.id), name: product.name, price: Number(product.price || 0), image: images[0] || undefined, slug: product.slug });
                }
              }}>
                <Heart size={18} fill={isInWishlist(String(product.id)) ? PINK : 'none'} color={isInWishlist(String(product.id)) ? PINK : GRAY_LIGHT} />
              </button>
              {/* Dot indicators */}
              <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
                {displayImages.map((_: string, i: number) => (
                  <div key={i} onClick={() => setActiveImageIndex(i)} style={{ width: i === activeImageIndex ? 20 : 6, height: 6, borderRadius: 999, background: i === activeImageIndex ? PINK : PINK_LIGHT, transition: 'all 0.3s', cursor: 'pointer' }} />
                ))}
              </div>
            </div>

            {/* Thumbnails */}
            {displayImages.length > 1 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 12 }}>
                {displayImages.map((img: string, i: number) => (
                  <div key={i} onClick={() => setActiveImageIndex(i)} className="pd-thumb-container" style={{ borderRadius: 14, border: `1.5px solid ${i === activeImageIndex ? PINK : PINK_LIGHT}`, background: PINK_PALE, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', fontSize: 10, color: GRAY, fontWeight: 600, overflow: 'hidden' }}>
                    <img src={getProductThumbnail(img)} alt={`thumb ${i}`} loading="lazy" style={{ width: '40%', height: '40%', objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
            )}

            {/* Share Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: GRAY_LIGHT, fontWeight: 500 }}>Share:</span>
              {['Facebook', 'Instagram', 'WhatsApp', 'Copy link'].map((s) => (
                <button key={s} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: `1px solid ${PINK_LIGHT}`, color: GRAY, fontWeight: 500, transition: 'all 0.2s', background: '#fff', cursor: 'pointer' }}>{s}</button>
              ))}
            </div>
          </div>

          {/* RIGHT: Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Category & Badges */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ background: PINK_PALE, color: PINK, borderRadius: 999, padding: '3px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {product.category?.name || 'Beauty'}
              </span>
              <span style={{ background: PINK_PALE, color: PINK, borderRadius: 999, padding: '3px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', border: `1.5px solid ${PINK}` }}>
                Premium Quality
              </span>
              <span style={{ background: '#ecfdf5', color: '#059669', borderRadius: 999, padding: '3px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                🌿 Verified
              </span>
            </div>

            {/* Title */}
            <div>
              <h1 className="pd-title" style={{ fontWeight: 800, color: DARK, lineHeight: 1.25, letterSpacing: '-0.02em' }}>
                {product.name}
              </h1>
              <p style={{ fontSize: 13, color: GRAY_LIGHT, marginTop: 4 }}>SKU: {product.id}</p>
            </div>

            {/* Rating */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', gap: 2 }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={16} fill={s <= Math.round(reviewSummary?.avgRating ?? 0) ? '#f59e0b' : 'none'} color={s <= Math.round(reviewSummary?.avgRating ?? 0) ? '#f59e0b' : GRAY_LIGHT} />
                ))}
              </span>
              <span style={{ fontSize: 15, fontWeight: 700, color: DARK }}>{reviewSummary?.avgRating ?? '0.0'}</span>
              <span style={{ fontSize: 13, color: GRAY_LIGHT }}>({reviewSummary?.total ?? 0} reviews)</span>
              <span style={{ width: 1, height: 14, background: PINK_LIGHT }} />
              <span style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>✓ Verified purchases</span>
            </div>

            {/* Price */}
            <div style={{ background: PINK_PALE, borderRadius: 16, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: PINK }}>{formatMoney(bestPrice)}</span>
              {hasAnyDiscount && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {bestPrice < price && (
                    <span style={{ fontSize: 16, color: GRAY_LIGHT, textDecoration: 'line-through' }}>{formatMoney(price)}</span>
                  )}
                  {hasDiscount && compareAtPrice > price && (
                    <span style={{ fontSize: 16, color: GRAY_LIGHT, textDecoration: 'line-through' }}>{formatMoney(compareAtPrice)}</span>
                  )}
                  <span style={{ background: PINK, color: '#fff', borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>Save {bestDiscountPct}%</span>
                </div>
              )}
            </div>
            {hasAnyDiscount && bestSavings > 0 && (
              <div style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>
                🎉 You save {formatMoney(bestSavings)} on this order!
              </div>
            )}

            {/* Stock Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: inStock ? '#059669' : '#ef4444', display: 'inline-block' }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: inStock ? '#059669' : '#ef4444' }}>
                {inStock ? 'In Stock' : 'Out of Stock'}
              </span>
              {inStock && <span style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600 }}>Only {availableStock} left!</span>}
            </div>

            {/* Unit Type */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: GRAY }}>
                {unitType === 'WEIGHT' ? '⚖️ Sold by weight' : '📦 Sold by piece'}
              </span>
              <span style={{ fontSize: 12, color: GRAY_LIGHT }}>({unitLabel})</span>
            </div>

            {/* Color Selector */}
            {hasColors && (
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 8 }}>
                  Select Color: <span style={{ fontWeight: 800, color: PINK }}>{selectedColor?.name}</span>
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {colors.map((color: any, i: number) => {
                    const isSelected = selectedColorIndex === i;
                    return (
                      <button
                        key={color.id || color.name}
                        type="button"
                        onClick={() => {
                          setSelectedColorIndex(i);
                          setActiveImageIndex(0);
                        }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 12,
                          border: `1.5px solid ${isSelected ? PINK : PINK_LIGHT}`,
                          background: isSelected ? PINK_PALE : '#fff',
                          color: isSelected ? PINK : DARK,
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          boxShadow: isSelected ? '0 2px 8px rgba(240, 17, 114, 0.15)' : 'none',
                        }}
                      >
                        {color.imageUrl ? (
                          <img
                            src={color.imageUrl}
                            alt={color.name}
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 6,
                              objectFit: 'cover',
                              border: `1px solid ${isSelected ? PINK : '#e5e7eb'}`,
                            }}
                          />
                        ) : color.hexCode ? (
                          <span
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: '50%',
                              backgroundColor: color.hexCode,
                              border: '1.5px solid rgba(0,0,0,0.15)',
                              display: 'inline-block',
                            }}
                          />
                        ) : null}
                        <span>{color.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size Selector */}
            {hasSizes && (
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 8 }}>Select Size</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {sizes.map((size: any, i: number) => (
                    <button
                      key={size.name}
                      onClick={() => {
                        setSelectedSizeIndex(i);
                      }}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 12,
                        border: `1.5px solid ${selectedSizeIndex === i ? PINK : PINK_LIGHT}`,
                        background: selectedSizeIndex === i ? PINK_PALE : '#fff',
                        color: selectedSizeIndex === i ? PINK : DARK,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {size.name}
                      {size.priceOverride && (
                        <span style={{ fontSize: 11, color: GRAY_LIGHT }}>
                          {formatMoney(size.priceOverride)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="pd-action-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: GRAY }}>Qty ({unitLabel})</p>
                <div style={{ display: 'flex', alignItems: 'center', border: `1.5px solid ${PINK_LIGHT}`, borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
                  <button onClick={() => updateQuantity(safeQuantity - 1)} style={{ width: 36, height: 36, fontSize: 17, fontWeight: 700, color: GRAY, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s', background: 'none', border: 'none', cursor: 'pointer' }}>−</button>
                  <span style={{ width: 34, textAlign: 'center', fontSize: 14, fontWeight: 700, color: DARK }}>{safeQuantity}</span>
                  <button onClick={() => updateQuantity(safeQuantity + 1)} style={{ width: 36, height: 36, fontSize: 17, fontWeight: 700, color: GRAY, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s', background: 'none', border: 'none', cursor: 'pointer' }}>+</button>
                </div>
              </div>
              <button onClick={handleBuyNowClick} disabled={!inStock} className="pd-buy-button" style={{ padding: '14px 18px', borderRadius: 14, background: inStock ? PINK : '#d1d5db', color: '#fff', fontSize: 15, fontWeight: 800, border: 'none', cursor: inStock ? 'pointer' : 'not-allowed', transition: 'all 0.3s', boxShadow: inStock ? '0 10px 25px color-mix(in srgb, var(--primary) 27%, transparent)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <ShoppingCart size={18} />
                {inStock ? 'Checkout Now' : 'Out of Stock'}
              </button>
            </div>

            {/* Product Description (always visible) */}
            <div style={{ border: `1.5px solid ${PINK_LIGHT}`, borderRadius: 16, overflow: 'hidden', background: '#fff', marginTop: 16 }}>
              <div style={{ padding: '16px 20px', background: PINK_PALE }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: DARK }}>Product Description</span>
              </div>
              <div style={{ padding: '16px 20px 20px', borderTop: `1px solid ${PINK_LIGHT}`, background: '#fff' }}>
                <p style={{ fontSize: 14, color: GRAY, lineHeight: 1.7 }}>{descriptionContent}</p>
              </div>
            </div>

            {/* Customer Reviews Section */}
            <ReviewSection productId={product.id} status={status} />
          </div>
        </div>


        {/* Related Products from same category */}
        {relatedProducts.length > 0 && (
        <div className="pd-related-container">
          <div className="pd-related-header">
            <h2 className="pd-related-title" style={{ fontWeight: 800, color: DARK, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 6, height: 28, background: PINK, borderRadius: 3, display: 'inline-block' }} />
              Similar in {product.category?.name || 'This Category'}
            </h2>
            <Link href={`/categories/${product.category?.slug || ''}`} style={{ color: PINK, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>View All →</Link>
          </div>
          <div className="pd-related-grid">
            {relatedProducts.map((rp: any) => (
              <Link key={rp.id} href={`/product/${rp.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="pd-related-card similar-product-card">
                  <div className="pd-related-image-container">
                    {rp.images?.[0] ? (
                      <Image src={getProductCardImage(rp.images[0])} alt={rp.name} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover" />
                    ) : (
                      <svg width="60" height="100" viewBox="0 0 50 90" fill="none">
                        <rect x="18" y="0" width="14" height="6" rx="2" fill={PINK} opacity="0.6" />
                        <rect x="10" y="10" width="30" height="70" rx="10" fill="white" fillOpacity="0.8" stroke={PINK} strokeWidth="1" />
                      </svg>
                    )}
                  </div>
                  <div className="pd-related-content">
                    <span style={{ fontSize: 10, color: PINK, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{rp.category?.name || product.category?.name || 'Beauty'}</span>
                    <p style={{ fontSize: 14, fontWeight: 700, color: DARK, marginTop: 6, marginBottom: 12, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rp.name}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: DARK }}>{formatMoney(rp.price)}</span>
                      <span style={{ width: 32, height: 32, borderRadius: 10, background: PINK, color: '#fff', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px color-mix(in srgb, var(--primary) 27%, transparent)' }}>+</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STAR PICKER
// ─────────────────────────────────────────────────────────────

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
        >
          <Star
            size={22}
            fill={(hover || value) >= s ? '#f59e0b' : 'none'}
            color={(hover || value) >= s ? '#f59e0b' : GRAY_LIGHT}
          />
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// REVIEW SECTION
// ─────────────────────────────────────────────────────────────

function ReviewSection({ productId, status }: { productId: number; status: string }) {
  const { data: summary, isLoading: loadingReviews } = useProductReviews(productId);
  const { data: eligibility } = useReviewEligibility(productId);
  const createReview = useCreateReview(productId);
  const updateReview = useUpdateReview(productId);
  const deleteReview = useDeleteReview(productId);

  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const isEditing = !!eligibility?.hasReviewed;

  useEffect(() => {
    if (eligibility?.existingReview && showForm) {
      setRating(eligibility.existingReview.rating);
      setTitle(eligibility.existingReview.title ?? '');
      setBody(eligibility.existingReview.body ?? '');
    }
  }, [eligibility, showForm]);

  const handleOpenForm = () => {
    if (status === 'unauthenticated') { toast.error('Please login to write a review'); return; }
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (rating === 0) { toast.error('Please select a star rating'); return; }
    try {
      if (isEditing) {
        await updateReview.mutateAsync({ rating, title, body });
        toast.success('Review updated!');
      } else {
        await createReview.mutateAsync({ rating, title, body });
        toast.success('Review submitted!');
      }
      setShowForm(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e.message || 'Failed to submit review');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete your review?')) return;
    try { await deleteReview.mutateAsync(); toast.success('Review deleted'); }
    catch { toast.error('Failed to delete review'); }
  };

  const reviews = summary?.reviews ?? [];
  const avg = summary?.avgRating ?? 0;
  const total = summary?.total ?? 0;

  return (
    <div style={{ border: `1.5px solid ${PINK_LIGHT}`, borderRadius: 16, overflow: 'hidden', background: '#fff', marginTop: 24 }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', background: PINK_PALE, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: DARK }}>Customer Reviews</span>
          {total > 0 && (
            <span style={{ fontSize: 13, color: GRAY, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Star size={13} fill="#f59e0b" color="#f59e0b" /> {avg} ({total})
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {eligibility?.hasReviewed && (
            <button onClick={handleDelete} disabled={deleteReview.isPending}
              style={{ background: '#fff1f2', color: '#e11d48', padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, border: '1px solid #ffe4e6', cursor: 'pointer' }}>
              Delete My Review
            </button>
          )}
          {(eligibility?.canReview || eligibility?.hasReviewed) && (
            <button onClick={() => { if (!showForm) { if (isEditing && eligibility?.existingReview) { setRating(eligibility.existingReview.rating); setTitle(eligibility.existingReview.title ?? ''); setBody(eligibility.existingReview.body ?? ''); } } setShowForm((v) => !v); }}
              style={{ background: PINK, color: '#fff', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
              {showForm ? 'Cancel' : isEditing ? 'Edit My Review' : 'Write a Review'}
            </button>
          )}
          {status === 'authenticated' && eligibility && !eligibility.canReview && (
            <span style={{ fontSize: 12, color: GRAY_LIGHT }}>Purchase to leave a review</span>
          )}
          {status === 'unauthenticated' && (
            <button onClick={handleOpenForm} style={{ background: PINK, color: '#fff', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
              Write a Review
            </button>
          )}
        </div>
      </div>

      {/* Review Form */}
      {showForm && (
        <div style={{ padding: '20px', borderBottom: `1px solid ${PINK_LIGHT}`, background: PINK_PALE }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: DARK, marginBottom: 12 }}>{isEditing ? 'Update Your Review' : 'Your Review'}</p>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: GRAY, display: 'block', marginBottom: 6 }}>Rating *</label>
            <StarPicker value={rating} onChange={setRating} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: GRAY, display: 'block', marginBottom: 6 }}>Title (optional)</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Summarise your experience..." maxLength={200}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${PINK_LIGHT}`, fontSize: 14, color: DARK, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: GRAY, display: 'block', marginBottom: 6 }}>Review (optional)</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Tell others what you think..." rows={4}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${PINK_LIGHT}`, fontSize: 14, color: DARK, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
          <button onClick={handleSubmit} disabled={createReview.isPending || updateReview.isPending}
            style={{ background: PINK, color: '#fff', padding: '10px 24px', borderRadius: 10, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', opacity: (createReview.isPending || updateReview.isPending) ? 0.7 : 1 }}>
            {(createReview.isPending || updateReview.isPending) ? 'Submitting...' : isEditing ? 'Update Review' : 'Submit Review'}
          </button>
        </div>
      )}

      {/* Review List */}
      <div style={{ padding: '24px 20px', background: '#fff' }}>
        {loadingReviews ? (
          <p style={{ fontSize: 14, color: GRAY_LIGHT, textAlign: 'center' }}>Loading reviews...</p>
        ) : reviews.length === 0 ? (
          <p style={{ fontSize: 14, color: GRAY_LIGHT, textAlign: 'center' }}>No reviews yet. Be the first to share your experience!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {reviews.map((review: any, i: number) => {
              const name = [review.customer.firstName, review.customer.lastName].filter(Boolean).join(' ') || 'Customer';
              const date = new Date(review.createdAt).toLocaleDateString('en-BD', { year: 'numeric', month: 'long' });
              return (
                <div key={review.id} style={{ borderBottom: i === reviews.length - 1 ? 'none' : `1px solid ${PINK_LIGHT}`, paddingBottom: i === reviews.length - 1 ? 0 : 24 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: `linear-gradient(135deg, ${PINK}, ${PINK_DARK})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16 }}>
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: DARK }}>{name}</span>
                          {review.isVerified && <span style={{ fontSize: 10, color: '#059669', background: '#ecfdf5', padding: '2px 7px', borderRadius: 6, fontWeight: 700, textTransform: 'uppercase' }}>✓ Verified</span>}
                        </div>
                        <span style={{ fontSize: 12, color: GRAY_LIGHT }}>{date}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} size={14} fill={s <= review.rating ? '#f59e0b' : 'none'} color={s <= review.rating ? '#f59e0b' : GRAY_LIGHT} />
                      ))}
                    </div>
                  </div>
                  {review.title && <p style={{ fontSize: 14, fontWeight: 700, color: DARK, marginBottom: 4 }}>{review.title}</p>}
                  {review.body && <p style={{ fontSize: 14, color: GRAY, lineHeight: 1.7, margin: 0 }}>{review.body}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
