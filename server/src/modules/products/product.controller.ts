import { RequestHandler } from 'express';
import productService from './product.service';
import { ok, paginate } from '../../shared/utils/apiResponse';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { AuditLogger } from '../../shared/utils/auditLogger';
import { prisma } from '../../config/database';

export const listProducts: RequestHandler = asyncHandler(async (req, res) => {
  const { category, search, featured, minPrice, maxPrice, page, limit, branchId, includeInactive, sortBy } = req.query;

  const products = await productService.listProducts({
    category: category as string,
    search: search as string,
    featured: featured === undefined ? undefined : featured === 'true',
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 10,
    branchId: branchId ? Number(branchId) : undefined,
    includeInactive: includeInactive === 'true',
    sortBy: sortBy as 'newest' | 'top_selling' | 'top_rated' | undefined,
  });

  res.json(
    paginate(
      products.products,
      products.total,
      products.page,
      products.limit
    )
  );
});

export const getProductBySlug: RequestHandler = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const product = await productService.getProductBySlug(slug);
  res.json(ok(product));
});

export const createProduct: RequestHandler = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(req.body);

  await AuditLogger.log({
    req,
    action: 'CREATE',
    entity: 'Product',
    entityId: String(product.id),
    entityLabel: product.name,
    before: null,
    after: product,
  });

  res.status(201).json(ok(product, 'Product created successfully'));
});

export const updateProduct: RequestHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const oldProduct = await prisma.product.findUnique({
    where: { id: Number(id) },
    include: { sizes: true, colors: true },
  });

  const product = await productService.updateProduct(Number(id), req.body);

  if (oldProduct) {
    await AuditLogger.log({
      req,
      action: 'UPDATE',
      entity: 'Product',
      entityId: String(product.id),
      entityLabel: product.name,
      before: oldProduct,
      after: product,
    });
  }

  res.json(ok(product, 'Product updated successfully'));
});

export const deleteProduct: RequestHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const oldProduct = await prisma.product.findUnique({
    where: { id: Number(id) },
  });

  await productService.deleteProduct(Number(id));

  if (oldProduct) {
    await AuditLogger.log({
      req,
      action: 'DELETE',
      entity: 'Product',
      entityId: String(id),
      entityLabel: oldProduct.name,
      before: oldProduct,
      after: null,
    });
  }

  res.status(204).json(ok(null, 'Product deleted successfully'));
});

export const bulkImportProducts: RequestHandler = asyncHandler(async (req, res) => {
  const { products } = req.body;
  if (!Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ success: false, error: 'Products array is required' });
  }

  const result = await productService.bulkImportProducts(products);

  await AuditLogger.log({
    req,
    action: 'CREATE',
    entity: 'Product',
    entityId: 'BULK',
    entityLabel: `Bulk imported ${result.imported} products`,
    before: null,
    after: result,
  });

  res.json(ok(result, 'Bulk import completed'));
});

export const updateProductStatus: RequestHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive, isFeatured } = req.body;

  const oldProduct = await prisma.product.findUnique({
    where: { id: Number(id) },
  });

  const product = await productService.updateProductStatus(Number(id), { isActive, isFeatured });

  if (oldProduct) {
    await AuditLogger.log({
      req,
      action: 'UPDATE',
      entity: 'Product',
      entityId: String(product.id),
      entityLabel: product.name,
      before: oldProduct,
      after: product,
    });
  }

  res.json(ok(product, 'Product status updated successfully'));
});

export default {
  listProducts,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkImportProducts,
  updateProductStatus,
};
