import { RequestHandler } from 'express';
import orderService from './order.service';
import { ok, paginate } from '../../shared/utils/apiResponse';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { ValidationError } from '../../shared/utils/AppError';
import { createCodOrderSchema, createOrderSchema } from './order.schema';
import { AuditLogger } from '../../shared/utils/auditLogger';
import { prisma } from '../../config/database';

export const listOrders: RequestHandler = asyncHandler(async (req, res) => {
  const { page, limit, status, channel, customerId, startDate, endDate, search } = req.query;

  const result = await orderService.listOrders({
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 10,
    status: status as string,
    channel: channel as string,
    customerId: customerId ? Number(customerId) : undefined,
    startDate: startDate as string,
    endDate: endDate as string,
    search: search as string,
  });

  res.json(paginate(result.data, result.total, result.page, result.limit));
});

export const getOrderDetails: RequestHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const order = await orderService.getOrderDetails(Number(id));
  res.json(ok(order));
});

export const createOrder: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid order payload');
  }

  const order = await orderService.createOrder(parsed.data);

  await AuditLogger.log({
    req,
    action: 'CREATE',
    entity: 'Order',
    entityId: String(order.id),
    entityLabel: order.orderNumber,
    before: null,
    after: order,
  });

  res.status(201).json(ok(order, 'Order created successfully'));
});

export const createCodOrder: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = createCodOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid COD order payload');
  }

  if (!req.user?.id) {
    throw new ValidationError('Authentication is required to place COD order');
  }

  const order = await orderService.createCodOrder(parsed.data, req.user.id);

  await AuditLogger.log({
    req,
    action: 'CREATE',
    entity: 'Order',
    entityId: String(order.id),
    entityLabel: order.orderNumber,
    before: null,
    after: order,
  });

  res.status(201).json(ok(order, 'Cash on delivery order placed successfully'));
});

export const updateOrder: RequestHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const oldOrder = await prisma.order.findUnique({
    where: { id: Number(id) },
  });

  const order = await orderService.updateOrder(Number(id), req.body);

  if (oldOrder) {
    await AuditLogger.log({
      req,
      action: 'UPDATE',
      entity: 'Order',
      entityId: String(order.id),
      entityLabel: order.orderNumber,
      before: oldOrder,
      after: order,
    });
  }

  res.json(ok(order, 'Order updated successfully'));
});

export const updateOrderStatus: RequestHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const oldOrder = await prisma.order.findUnique({
    where: { id: Number(id) },
  });

  const order = await orderService.updateOrderStatus(Number(id), req.body);

  if (oldOrder) {
    await AuditLogger.log({
      req,
      action: 'UPDATE',
      entity: 'Order',
      entityId: String(order.id),
      entityLabel: order.orderNumber,
      before: oldOrder,
      after: order,
    });
  }

  res.json(ok(order, 'Order status updated'));
});

export const addOrderNotes: RequestHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;
  if (!notes) {
    return res.status(400).json({ success: false, error: 'Notes are required' });
  }
  const order = await orderService.addOrderNotes(Number(id), notes);
  res.json(ok(order, 'Notes added successfully'));
});

export const createReturn: RequestHandler = asyncHandler(async (req, res) => {
  const returnRecord = await orderService.createReturn(req.body);
  res.status(201).json(ok(returnRecord, 'Return created successfully'));
});

export const processRefund: RequestHandler = asyncHandler(async (req, res) => {
  const refund = await orderService.processRefund(req.body);
  res.status(201).json(ok(refund, 'Refund processed successfully'));
});

export const markAsShipped: RequestHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const oldOrder = await prisma.order.findUnique({
    where: { id: Number(id) },
  });

  const order = await orderService.markAsShipped(Number(id));

  if (oldOrder) {
    await AuditLogger.log({
      req,
      action: 'UPDATE',
      entity: 'Order',
      entityId: String(order.id),
      entityLabel: order.orderNumber,
      before: oldOrder,
      after: order,
    });
  }

  res.json(ok(order, 'Order marked as shipped'));
});

export const generateInvoice: RequestHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const invoice = await orderService.generateInvoice(Number(id));
  res.json(ok(invoice));
});

export const getOrderTracking: RequestHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tracking = await orderService.getOrderTracking(Number(id));
  res.json(ok(tracking));
});

export const cancelOrder: RequestHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const oldOrder = await prisma.order.findUnique({
    where: { id: Number(id) },
  });

  const order = await orderService.cancelOrder(Number(id));

  if (oldOrder) {
    await AuditLogger.log({
      req,
      action: 'UPDATE',
      entity: 'Order',
      entityId: String(id),
      entityLabel: oldOrder.orderNumber,
      before: oldOrder,
      after: order,
    });
  }

  res.status(204).json(ok(order, 'Order cancelled'));
});

export const entrySteadfast: RequestHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const order = await orderService.bookSteadfastParcel(Number(id));
  res.json(ok(order, 'Steadfast booking successful'));
});

export const getSteadfastStatus: RequestHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await orderService.getSteadfastStatus(Number(id));
  res.json(ok(result, 'Steadfast status retrieved'));
});

export const handleSteadfastWebhook: RequestHandler = asyncHandler(async (req, res) => {
  await orderService.handleSteadfastWebhook(req.body);
  res.status(200).json({ status: 'success' });
});

export default {
  listOrders,
  getOrderDetails,
  createOrder,
  createCodOrder,
  updateOrder,
  updateOrderStatus,
  addOrderNotes,
  createReturn,
  processRefund,
  markAsShipped,
  generateInvoice,
  getOrderTracking,
  cancelOrder,
  entrySteadfast,
  getSteadfastStatus,
  handleSteadfastWebhook,
};
