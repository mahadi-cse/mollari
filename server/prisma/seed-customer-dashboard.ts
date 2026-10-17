import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, CustomerSegment, OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_CUSTOMER_EMAIL = process.env.SEED_CUSTOMER_EMAIL || 'customer@mollari.local';
const DEFAULT_CUSTOMER_PASSWORD = process.env.SEED_CUSTOMER_PASSWORD || 'Customer@12345';
const CUSTOMER_ROLE_CODE = '9x909';

type SeedOrderItem = {
  productId: number;
  quantity: number;
  unitPrice: number;
};

type SeedOrder = {
  orderNumber: string;
  status: OrderStatus;
  createdAt: Date;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingPostal: string;
  shippingCountry: string;
  notes: string;
  items: SeedOrderItem[];
  tracking: Array<{
    status: OrderStatus;
    title: string;
    description?: string;
    createdAt: Date;
  }>;
};

const makeOrderItems = (
  products: Array<{ id: number; price: number }>,
  row: Array<{ productIndex: number; quantity: number }>
): SeedOrderItem[] => {
  return row.map((item) => {
    const product = products[item.productIndex];

    return {
      productId: product.id,
      quantity: item.quantity,
      unitPrice: product.price,
    };
  });
};

const sumOrderItems = (items: SeedOrderItem[]) => {
  return items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
};

async function main() {
  console.log('🌱 Seeding customer dashboard data...');

  const customerType = await prisma.userType.upsert({
    where: { code: CUSTOMER_ROLE_CODE },
    update: { name: 'CUSTOMER' },
    create: {
      code: CUSTOMER_ROLE_CODE,
      name: 'CUSTOMER',
    },
  });

  const passwordHash = await bcrypt.hash(DEFAULT_CUSTOMER_PASSWORD, Number(process.env.BCRYPT_ROUNDS || 12));

  const user = await prisma.user.upsert({
    where: { email: DEFAULT_CUSTOMER_EMAIL.toLowerCase() },
    update: {
      firstName: 'Nusrat',
      lastName: 'Jahan',
      phone: '+8801711001100',
      address: 'Road 11, Dhanmondi',
      userTypeId: customerType.id,
      password: passwordHash,
      isActive: true,
    },
    create: {
      email: DEFAULT_CUSTOMER_EMAIL.toLowerCase(),
      password: passwordHash,
      userTypeId: customerType.id,
      firstName: 'Nusrat',
      lastName: 'Jahan',
      phone: '+8801711001100',
      address: 'Road 11, Dhanmondi',
      isActive: true,
    },
  });

  const customer = await prisma.customer.upsert({
    where: { userId: user.id },
    update: {
      firstName: 'Nusrat',
      lastName: 'Jahan',
      phone: '+8801711001100',
      dateOfBirth: new Date('1997-09-12'),
      gender: 'Female',
      defaultAddress: 'Road 11, Dhanmondi, Dhaka',
      city: 'Dhaka',
      postalCode: '1209',
      country: 'Bangladesh',
      segment: CustomerSegment.REGULAR,
      isActive: true,
    },
    create: {
      userId: user.id,
      firstName: 'Nusrat',
      lastName: 'Jahan',
      phone: '+8801711001100',
      dateOfBirth: new Date('1997-09-12'),
      gender: 'Female',
      defaultAddress: 'Road 11, Dhanmondi, Dhaka',
      city: 'Dhaka',
      postalCode: '1209',
      country: 'Bangladesh',
      segment: CustomerSegment.REGULAR,
      isActive: true,
    },
  });

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      sku: true,
      price: true,
    },
    orderBy: { id: 'asc' },
    take: 6,
  });

  if (products.length < 4) {
    throw new Error('At least 4 active products are required to seed customer dashboard data.');
  }

  const productPriceRows = products.map((item) => ({
    id: item.id,
    price: Number(item.price),
  }));

  const now = new Date();
  const day = 24 * 60 * 60 * 1000;

  const deliveredCreatedAt = new Date(now.getTime() - 18 * day);
  const processingCreatedAt = new Date(now.getTime() - 7 * day);
  const shippedCreatedAt = new Date(now.getTime() - 3 * day);
  const pendingCreatedAt = new Date(now.getTime() - 1 * day);

  const seedOrders: SeedOrder[] = [
    {
      orderNumber: 'ORD-CUST-1001',
      status: OrderStatus.DELIVERED,
      createdAt: deliveredCreatedAt,
      shippedAt: new Date(deliveredCreatedAt.getTime() + 2 * day),
      deliveredAt: new Date(deliveredCreatedAt.getTime() + 4 * day),
      shippingName: 'Nusrat Jahan',
      shippingPhone: '+8801711001100',
      shippingAddress: 'House 27, Road 11, Dhanmondi',
      shippingCity: 'Dhaka',
      shippingPostal: '1209',
      shippingCountry: 'Bangladesh',
      notes: 'Please call before delivery.',
      items: makeOrderItems(productPriceRows, [
        { productIndex: 0, quantity: 1 },
        { productIndex: 1, quantity: 2 },
      ]),
      tracking: [
        {
          status: OrderStatus.PENDING,
          title: 'Order placed',
          description: 'Your order has been placed successfully.',
          createdAt: deliveredCreatedAt,
        },
        {
          status: OrderStatus.CONFIRMED,
          title: 'Order confirmed',
          description: 'Payment method confirmed as cash on delivery.',
          createdAt: new Date(deliveredCreatedAt.getTime() + 3 * 60 * 60 * 1000),
        },
        {
          status: OrderStatus.PROCESSING,
          title: 'Order processing',
          description: 'Items are being packed at the warehouse.',
          createdAt: new Date(deliveredCreatedAt.getTime() + day),
        },
        {
          status: OrderStatus.SHIPPED,
          title: 'Order shipped',
          description: 'Courier has picked up your parcel.',
          createdAt: new Date(deliveredCreatedAt.getTime() + 2 * day),
        },
        {
          status: OrderStatus.DELIVERED,
          title: 'Order delivered',
          description: 'Delivered successfully to your address.',
          createdAt: new Date(deliveredCreatedAt.getTime() + 4 * day),
        },
      ],
    },
    {
      orderNumber: 'ORD-CUST-1002',
      status: OrderStatus.PROCESSING,
      createdAt: processingCreatedAt,
      shippedAt: null,
      deliveredAt: null,
      shippingName: 'Nusrat Jahan',
      shippingPhone: '+8801711001100',
      shippingAddress: 'House 27, Road 11, Dhanmondi',
      shippingCity: 'Dhaka',
      shippingPostal: '1209',
      shippingCountry: 'Bangladesh',
      notes: 'Gift wrap this order.',
      items: makeOrderItems(productPriceRows, [
        { productIndex: 2, quantity: 1 },
        { productIndex: 3, quantity: 1 },
      ]),
      tracking: [
        {
          status: OrderStatus.PENDING,
          title: 'Order placed',
          createdAt: processingCreatedAt,
        },
        {
          status: OrderStatus.CONFIRMED,
          title: 'Order confirmed',
          createdAt: new Date(processingCreatedAt.getTime() + 2 * 60 * 60 * 1000),
        },
        {
          status: OrderStatus.PROCESSING,
          title: 'Order processing',
          createdAt: new Date(processingCreatedAt.getTime() + day),
        },
      ],
    },
    {
      orderNumber: 'ORD-CUST-1003',
      status: OrderStatus.SHIPPED,
      createdAt: shippedCreatedAt,
      shippedAt: new Date(shippedCreatedAt.getTime() + day),
      deliveredAt: null,
      shippingName: 'Nusrat Jahan',
      shippingPhone: '+8801711001100',
      shippingAddress: 'House 27, Road 11, Dhanmondi',
      shippingCity: 'Dhaka',
      shippingPostal: '1209',
      shippingCountry: 'Bangladesh',
      notes: 'Leave at building reception if unavailable.',
      items: makeOrderItems(productPriceRows, [
        { productIndex: 4, quantity: 1 },
      ]),
      tracking: [
        {
          status: OrderStatus.PENDING,
          title: 'Order placed',
          createdAt: shippedCreatedAt,
        },
        {
          status: OrderStatus.CONFIRMED,
          title: 'Order confirmed',
          createdAt: new Date(shippedCreatedAt.getTime() + 2 * 60 * 60 * 1000),
        },
        {
          status: OrderStatus.PROCESSING,
          title: 'Order processing',
          createdAt: new Date(shippedCreatedAt.getTime() + 12 * 60 * 60 * 1000),
        },
        {
          status: OrderStatus.SHIPPED,
          title: 'Order shipped',
          createdAt: new Date(shippedCreatedAt.getTime() + day),
        },
      ],
    },
    {
      orderNumber: 'ORD-CUST-1004',
      status: OrderStatus.PENDING,
      createdAt: pendingCreatedAt,
      shippedAt: null,
      deliveredAt: null,
      shippingName: 'Nusrat Jahan',
      shippingPhone: '+8801711001100',
      shippingAddress: 'House 27, Road 11, Dhanmondi',
      shippingCity: 'Dhaka',
      shippingPostal: '1209',
      shippingCountry: 'Bangladesh',
      notes: 'No rush delivery required.',
      items: makeOrderItems(productPriceRows, [
        { productIndex: 5, quantity: 2 },
      ]),
      tracking: [
        {
          status: OrderStatus.PENDING,
          title: 'Order placed',
          createdAt: pendingCreatedAt,
        },
      ],
    },
  ];

  for (const orderSeed of seedOrders) {
    const subtotal = sumOrderItems(orderSeed.items);
    const shippingCharge = subtotal >= 2000 ? 0 : 80;
    const total = subtotal + shippingCharge;

    const order = await prisma.order.upsert({
      where: { orderNumber: orderSeed.orderNumber },
      update: {
        customerId: customer.id,
        status: orderSeed.status,
        shippingName: orderSeed.shippingName,
        shippingPhone: orderSeed.shippingPhone,
        shippingAddress: orderSeed.shippingAddress,
        shippingCity: orderSeed.shippingCity,
        shippingPostal: orderSeed.shippingPostal,
        shippingCountry: orderSeed.shippingCountry,
        notes: orderSeed.notes,
        subtotal,
        discountAmount: 0,
        shippingCharge,
        taxAmount: 0,
        total,
        shippedAt: orderSeed.shippedAt,
        deliveredAt: orderSeed.deliveredAt,
        items: {
          deleteMany: {},
          create: orderSeed.items.map((item) => {
            const product = products.find((p) => p.id === item.productId);
            return {
              productId: item.productId,
              productName: product?.name || 'Product',
              productSku: product?.sku || 'N/A',
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.unitPrice * item.quantity,
            };
          }),
        },
      },
      create: {
        orderNumber: orderSeed.orderNumber,
        customerId: customer.id,
        channel: 'ONLINE',
        status: orderSeed.status,
        shippingName: orderSeed.shippingName,
        shippingPhone: orderSeed.shippingPhone,
        shippingAddress: orderSeed.shippingAddress,
        shippingCity: orderSeed.shippingCity,
        shippingPostal: orderSeed.shippingPostal,
        shippingCountry: orderSeed.shippingCountry,
        notes: orderSeed.notes,
        subtotal,
        discountAmount: 0,
        shippingCharge,
        taxAmount: 0,
        total,
        shippedAt: orderSeed.shippedAt,
        deliveredAt: orderSeed.deliveredAt,
        createdAt: orderSeed.createdAt,
        items: {
          create: orderSeed.items.map((item) => {
            const product = products.find((p) => p.id === item.productId);
            return {
              productId: item.productId,
              productName: product?.name || 'Product',
              productSku: product?.sku || 'N/A',
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.unitPrice * item.quantity,
            };
          }),
        },
        payment: {
          create: {
            method: PaymentMethod.CASH,
            status: orderSeed.status === OrderStatus.DELIVERED ? PaymentStatus.SUCCESS : PaymentStatus.PENDING,
            amount: total,
          },
        },
      },
      include: {
        payment: true,
      },
    });

    if (order.payment) {
      await prisma.payment.update({
        where: { id: order.payment.id },
        data: {
          method: PaymentMethod.CASH,
          status: orderSeed.status === OrderStatus.DELIVERED ? PaymentStatus.SUCCESS : PaymentStatus.PENDING,
          amount: total,
          paidAt: orderSeed.status === OrderStatus.DELIVERED ? orderSeed.deliveredAt : null,
        },
      });
    } else {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          method: PaymentMethod.CASH,
          status: orderSeed.status === OrderStatus.DELIVERED ? PaymentStatus.SUCCESS : PaymentStatus.PENDING,
          amount: total,
          paidAt: orderSeed.status === OrderStatus.DELIVERED ? orderSeed.deliveredAt : null,
        },
      });
    }

    await prisma.orderTrackingEvent.deleteMany({ where: { orderId: order.id } });
    await prisma.orderTrackingEvent.createMany({
      data: orderSeed.tracking.map((event) => ({
        orderId: order.id,
        status: event.status,
        title: event.title,
        description: event.description,
        createdAt: event.createdAt,
      })),
    });
  }

  const allOrders = await prisma.order.findMany({
    where: { customerId: customer.id },
    select: {
      status: true,
      total: true,
      createdAt: true,
    },
  });

  const totalOrders = allOrders.length;
  const totalSpent = allOrders
    .filter((order) => !['CANCELLED', 'REFUNDED'].includes(order.status))
    .reduce((sum, order) => sum + Number(order.total), 0);

  const lastOrderAt = allOrders.length > 0
    ? new Date(Math.max(...allOrders.map((order) => order.createdAt.getTime())))
    : null;

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      totalOrders,
      totalSpent,
      lastOrderAt,
      loyaltyPoints: Math.floor(totalSpent / 150),
      segment: totalSpent >= 10000 ? CustomerSegment.VIP : CustomerSegment.REGULAR,
      isActive: true,
    },
  });

  const wishlistProductIds = products.slice(0, 3).map((item) => item.id);

  for (const productId of wishlistProductIds) {
    await prisma.wishlist.upsert({
      where: {
        customerId_productId: {
          customerId: customer.id,
          productId,
        },
      },
      update: {},
      create: {
        customerId: customer.id,
        productId,
      },
    });
  }

  console.log('✅ Customer dashboard seed completed');
  console.log(`   Customer email: ${user.email}`);
  console.log(`   Customer password: ${DEFAULT_CUSTOMER_PASSWORD}`);
  console.log(`   Orders seeded: ${seedOrders.length}`);
  console.log(`   Wishlist items: ${wishlistProductIds.length}`);
}

main()
  .catch((error) => {
    console.error('❌ Customer dashboard seed failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
