import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { HomepageLocaleProvider } from '@/modules/homepage/locales/HomepageLocaleContext';
import ProductDetailView from '@/modules/products/components/ProductDetailView';
import { productAPI } from '@/modules/products/api';
import { PRODUCTS_QUERY_KEYS } from '@/modules/products/queries';
import { promotionsAPI } from '@/modules/promotions/api';
import { PROMOTION_KEYS } from '@/modules/promotions/queries';
import type { Metadata } from 'next';
import { cache } from 'react';

export const revalidate = 60; 
type ProductDetailPageProps = {
  params: Promise<{ slug: string }>;
};

// Cache the product API request so that generateMetadata and the page component share the same request promise.
const getCachedProduct = cache(async (slug: string) => {
  return productAPI.getProductBySlug(slug);
});

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await getCachedProduct(slug);
    if (!product) {
      return {
        title: 'Product Not Found | Mollari',
      };
    }
    
    return {
      title: `${product.name} | Mollari`,
      description: product.description 
        ? product.description.slice(0, 160) 
        : `Buy ${product.name} online at Mollari. Premium quality skincare and beauty product.`,
      openGraph: {
        title: `${product.name} | Mollari`,
        description: product.description ? product.description.slice(0, 160) : `Buy ${product.name} online at Mollari.`,
        images: product.images?.[0] ? [{ url: product.images[0] }] : [],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${product.name} | Mollari`,
        description: product.description ? product.description.slice(0, 160) : `Buy ${product.name} online at Mollari.`,
        images: product.images?.[0] ? [product.images[0]] : [],
      },
    };
  } catch (error) {
    return {
      title: 'Product | Mollari',
      description: 'Premium cosmetics and beauty products.',
    };
  }
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Match homepage SSR behavior — hydrated data stays fresh on first paint.
        staleTime: Infinity,
      },
    },
  });
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: PRODUCTS_QUERY_KEYS.detail(slug),
      queryFn: () => getCachedProduct(slug),
    }),
    queryClient.prefetchQuery({
      queryKey: PROMOTION_KEYS.product(slug),
      queryFn: () => promotionsAPI.getForProduct(slug),
    }),
  ]);

  const dehydratedState = dehydrate(queryClient);

  return (
    <HomepageLocaleProvider defaultLocale="en">
      <HydrationBoundary state={dehydratedState}>
        <ProductDetailView slug={slug} />
      </HydrationBoundary>
    </HomepageLocaleProvider>
  );
}

