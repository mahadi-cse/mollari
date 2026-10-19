'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCategoryBySlug, useListCategories } from '@/modules/categories';
import { useListProducts } from '@/modules/products';
import type { Category, Product } from '@/modules/products/types';
import { EmptyState, ErrorMessage, SkeletonCard } from '@/shared/components';

const formatPrice = (value?: number | null) => {
  const amount = Number(value || 0);
  return amount.toLocaleString('en-BD', { maximumFractionDigits: 2 });
};

export default function CategoryProductsPage() {
  const router = useRouter();
  const params = useParams();
  const slugParam = params?.slug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam || '';

  const {
    data: category,
    isLoading: isCategoryLoading,
    isError: isCategoryError,
    error: categoryError,
    refetch: refetchCategory,
  } = useCategoryBySlug(slug, { enabled: !!slug });

  const {
    data: products,
    isLoading: isProductsLoading,
    isError: isProductsError,
    error: productsError,
    refetch: refetchProducts,
  } = useListProducts(
    { page: 1, limit: 60, category: slug },
    { enabled: !!slug }
  );

  const { data: allCategories = [] } = useListCategories(undefined, {
    staleTime: 15 * 60 * 1000,
  });

  const activeCategories = (allCategories as Category[])
    .filter((item: Category) => item.isActive)
    .sort((a: Category, b: Category) => a.name.localeCompare(b.name));

  if (isCategoryLoading || isProductsLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <p className="text-sm text-gray-500">Loading category...</p>
          <div className="mt-2 h-8 w-64 animate-pulse rounded bg-gray-200" />
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      </div>
    );
  }

  if (isCategoryError || isProductsError) {
    const message =
      (categoryError as { message?: string })?.message ||
      (productsError as { message?: string })?.message ||
      'Failed to load category products';

    return (
      <div className="container mx-auto px-4 py-8 space-y-3">
        <ErrorMessage
          message={message}
          onRetry={() => {
            void refetchCategory();
            void refetchProducts();
          }}
        />
      </div>
    );
  }

  if (!category) {
    return (
      <EmptyState
        title="Category Not Found"
        description="The requested category does not exist."
        action={{ label: 'See All Categories', onClick: () => router.push('/categories') }}
      />
    );
  }

  const list: Product[] = (products as Product[]) || [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-500">
        <Link href="/" className="hover:text-gray-700">Home</Link>
        <span>/</span>
        <Link href="/categories" className="hover:text-gray-700">Categories</Link>
        <span>/</span>
        <span className="font-medium text-gray-700">{category.name}</span>
      </div>

      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6">
        <h1 className="text-3xl font-bold text-gray-900">{category.name}</h1>
        <p className="mt-2 text-sm text-gray-600">
          {category.description || 'Browse all products available in this category.'}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/products"
            className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            All Products
          </Link>
          <Link
            href="/categories"
            className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            All Categories
          </Link>
        </div>
      </div>

      {activeCategories.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {activeCategories.map((item: Category) => {
            const active = item.slug === category.slug;
            return (
              <Link
                key={item.id}
                href={`/categories/${item.slug}`}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState
          title="No Products in This Category"
          description="Try another category or browse all products."
          action={{ label: 'View All Products', onClick: () => router.push('/products') }}
        />
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Products</h2>
            <span className="text-sm text-gray-500">{list.length} items</span>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {list.map((product: Product) => (
              <Link
                key={product.id}
                href={`/product/${product.slug}`}
                className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="aspect-square overflow-hidden bg-gray-100">
                  <img
                    src={product.images?.[0] || '/placeholder.png'}
                    alt={product.name}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                </div>

                <div className="p-4">
                  <h3 className="truncate text-base font-semibold text-gray-900">{product.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-gray-600">{product.shortDescription}</p>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-lg font-bold text-blue-600">৳{formatPrice(product.price)}</span>
                    <span className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white">
                      View
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
