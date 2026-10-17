import { Router } from 'express';
import * as inventoryController from './inventory.controller';
import { authenticate, authorize } from '../../middleware/authenticate';
import { USER_TYPE_CODES } from '../../shared/types/auth.types';

const router = Router();

// Protected routes - Only Staff/Admin can view internal inventory details
router.get('/', authenticate, authorize(USER_TYPE_CODES.SYSTEM_ADMIN, USER_TYPE_CODES.MANAGER, USER_TYPE_CODES.SALES_STAFF, USER_TYPE_CODES.CASHIER), inventoryController.getInventorySummary);
router.get('/low-stock', authenticate, authorize(USER_TYPE_CODES.SYSTEM_ADMIN, USER_TYPE_CODES.MANAGER, USER_TYPE_CODES.SALES_STAFF, USER_TYPE_CODES.CASHIER), inventoryController.getLowStockItems);
router.get('/reports', authenticate, authorize(USER_TYPE_CODES.SYSTEM_ADMIN, USER_TYPE_CODES.MANAGER, USER_TYPE_CODES.SALES_STAFF, USER_TYPE_CODES.CASHIER), inventoryController.getInventoryReports);
router.get('/ledger', authenticate, authorize(USER_TYPE_CODES.SYSTEM_ADMIN, USER_TYPE_CODES.MANAGER, USER_TYPE_CODES.SALES_STAFF, USER_TYPE_CODES.CASHIER), inventoryController.getInventoryLedger);
router.get('/:productId', authenticate, authorize(USER_TYPE_CODES.SYSTEM_ADMIN, USER_TYPE_CODES.MANAGER, USER_TYPE_CODES.SALES_STAFF, USER_TYPE_CODES.CASHIER), inventoryController.getProductStockDetails);
router.get('/:productId/history', authenticate, authorize(USER_TYPE_CODES.SYSTEM_ADMIN, USER_TYPE_CODES.MANAGER, USER_TYPE_CODES.SALES_STAFF, USER_TYPE_CODES.CASHIER), inventoryController.getInventoryHistory);

// Protected routes - ADMIN/STAFF
router.post('/adjust', authenticate, authorize(USER_TYPE_CODES.SYSTEM_ADMIN, USER_TYPE_CODES.MANAGER, USER_TYPE_CODES.SALES_STAFF, USER_TYPE_CODES.CASHIER), inventoryController.adjustStock);
router.post('/transfer', authenticate, authorize(USER_TYPE_CODES.SYSTEM_ADMIN, USER_TYPE_CODES.MANAGER, USER_TYPE_CODES.SALES_STAFF, USER_TYPE_CODES.CASHIER), inventoryController.transferStock);
router.post('/reconcile', authenticate, authorize(USER_TYPE_CODES.SYSTEM_ADMIN), inventoryController.reconcileStock);

export default router;
