import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { getEnv } from './config/env';
import requestLogger from './middleware/requestLogger';
import errorHandler from './middleware/errorHandler';
import notFound from './middleware/notFound';
import { generalLimiter } from './middleware/rateLimiter';

import productRouter from './modules/products/product.router';
import categoryRouter from './modules/categories/category.router';
import inventoryRouter from './modules/inventory/inventory.router';
import orderRouter from './modules/orders/order.router';
import customerRouter from './modules/customers/customer.router';
import analyticsRouter from './modules/analytics/analytics.router';
import homepageRouter from './modules/homepage/routes';
import auditLogRouter from './modules/audit-logs/auditLog.router';
import manualSaleRouter from './modules/manual-sales/manualSale.router';
import manualReturnRouter from './modules/manual-returns/manualReturn.router';
import supplierRouter from './modules/suppliers/supplier.router';
import branchRouter from './modules/branches/branch.router';
import authRouter from './modules/auth/auth.router';
import customerDashboardRouter from './modules/customer-dashboard/customerDashboard.router';
import promotionRouter from './modules/promotions/promotion.router';
import uploadRouter from './modules/uploads/upload.router';
import reviewRouter from './modules/reviews/review.router';
import couponRouter from './modules/coupons/coupon.router';

export function createApp(): Express {
  const app = express();
  const env = getEnv();

  app.set('trust proxy', true);

  // Middleware stack
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        callback(null, true);
      },
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);
  app.use(generalLimiter);

  // Root and Health check endpoints
  app.get('/', (req, res) => {
    res.json({ status: 'OK', message: 'Mollari Backend API is running', timestamp: new Date().toISOString() });
  });
  app.get('/api', (req, res) => {
    res.json({ status: 'OK', message: 'Mollari Backend API is running', timestamp: new Date().toISOString() });
  });
  app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
  });
  app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  // API Routes - Public & Protected
  app.use('/api/auth', authRouter);
  app.use('/api/products', productRouter);
  app.use('/api/categories', categoryRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/orders', orderRouter);
  app.use('/api/customers', customerRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/homepage', homepageRouter);
  app.use('/api/audit-logs', auditLogRouter);
  app.use('/api/manual-sales', manualSaleRouter);
  app.use('/api/manual-returns', manualReturnRouter);
  app.use('/api/suppliers', supplierRouter);
  app.use('/api/branches', branchRouter);
  app.use('/api/customer-dashboard', customerDashboardRouter);
  app.use('/api/promotions', promotionRouter);
  app.use('/api/coupons', couponRouter);
  app.use('/api/uploads', uploadRouter);
  app.use('/api/reviews', reviewRouter);

  // 404 handler
  app.use(notFound);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}

export default createApp;
