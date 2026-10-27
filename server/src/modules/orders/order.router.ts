import { Router } from 'express';
import * as orderController from './order.controller';
import { authenticate, authorize } from '../../middleware/authenticate';
import { USER_TYPE_CODES } from '../../shared/types/auth.types';

const router = Router();

// COD checkout requires authenticated customer account
router.post('/cod', authenticate, authorize(USER_TYPE_CODES.CUSTOMER), orderController.createCodOrder);

// Protected routes - All require auth
router.get('/', authenticate, orderController.listOrders);
router.post('/', authenticate, authorize(USER_TYPE_CODES.SYSTEM_ADMIN, USER_TYPE_CODES.MANAGER, USER_TYPE_CODES.SALES_STAFF, USER_TYPE_CODES.CASHIER), orderController.createOrder);
router.get('/:id', authenticate, orderController.getOrderDetails);
router.get('/:id/tracking', authenticate, orderController.getOrderTracking);
router.put('/:id', authenticate, orderController.updateOrder);
router.put('/:id/status', authenticate, authorize(USER_TYPE_CODES.SYSTEM_ADMIN, USER_TYPE_CODES.MANAGER, USER_TYPE_CODES.SALES_STAFF, USER_TYPE_CODES.CASHIER), orderController.updateOrderStatus);
router.post('/:id/notes', authenticate, authorize(USER_TYPE_CODES.SYSTEM_ADMIN, USER_TYPE_CODES.MANAGER, USER_TYPE_CODES.SALES_STAFF, USER_TYPE_CODES.CASHIER), orderController.addOrderNotes);
router.post('/:id/return', authenticate, orderController.createReturn);
router.put('/:id/refund', authenticate, authorize(USER_TYPE_CODES.SYSTEM_ADMIN), orderController.processRefund);
router.post('/:id/ship', authenticate, authorize(USER_TYPE_CODES.SYSTEM_ADMIN, USER_TYPE_CODES.MANAGER, USER_TYPE_CODES.SALES_STAFF, USER_TYPE_CODES.CASHIER), orderController.markAsShipped);
router.post('/:id/steadfast', authenticate, authorize(USER_TYPE_CODES.SYSTEM_ADMIN, USER_TYPE_CODES.MANAGER, USER_TYPE_CODES.SALES_STAFF, USER_TYPE_CODES.CASHIER), orderController.entrySteadfast);
router.get('/:id/steadfast-status', authenticate, authorize(USER_TYPE_CODES.SYSTEM_ADMIN, USER_TYPE_CODES.MANAGER, USER_TYPE_CODES.SALES_STAFF, USER_TYPE_CODES.CASHIER), orderController.getSteadfastStatus);
router.post('/steadfast/webhook', orderController.handleSteadfastWebhook);
router.get('/:id/invoice', authenticate, orderController.generateInvoice);
router.delete('/:id', authenticate, authorize(USER_TYPE_CODES.SYSTEM_ADMIN, USER_TYPE_CODES.MANAGER, USER_TYPE_CODES.SALES_STAFF, USER_TYPE_CODES.CASHIER), orderController.cancelOrder);

export default router;
