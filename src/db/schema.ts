import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  numeric,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull().default('admin'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    revokedAt: timestamp('revoked_at'),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('refresh_tokens_user_id_idx').on(table.userId),
    index('refresh_tokens_hash_idx').on(table.tokenHash),
  ],
);

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    sku: text('sku').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    price: numeric('price', { precision: 10, scale: 2 }).notNull(),
    cost: numeric('cost', { precision: 10, scale: 2 }).notNull().default('0.00'),
    stock: integer('stock').notNull().default(0),
    minStock: integer('min_stock').notNull().default(5),
    categoryId: integer('category_id').references(() => categories.id),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('products_sku_idx').on(table.sku),
    index('products_category_idx').on(table.categoryId),
  ],
);

export const inventoryMovements = pgTable(
  'inventory_movements',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    quantity: integer('quantity').notNull(),
    previousStock: integer('previous_stock').notNull(),
    newStock: integer('new_stock').notNull(),
    reason: text('reason').notNull(),
    reference: text('reference'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('inventory_movements_product_idx').on(table.productId),
    index('inventory_movements_created_idx').on(table.createdAt),
  ],
);

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  address: text('address'),
  taxId: text('tax_id'),
  isTrustVerified: boolean('is_trust_verified').default(false),
  trustScore: text('trust_score'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const electronicInvoices = pgTable('electronic_invoices', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull(),
  invoiceNumber: text('invoice_number').notNull().unique(),
  sdiIdentifier: text('sdi_identifier'),
  status: text('status').notNull().default('issued'),
  recipientVat: text('recipient_vat').notNull(),
  recipientPec: text('recipient_pec'),
  xmlUrl: text('xml_url'),
  pdfUrl: text('pdf_url'),
  totalAmount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
  taxAmount: numeric('tax_amount', { precision: 10, scale: 2 }).notNull(),
  issuedAt: timestamp('issued_at').defaultNow().notNull(),
});

export const notificationLogs = pgTable('notification_logs', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id'),
  recipientPhone: text('recipient_phone').notNull(),
  channel: text('channel').notNull().default('sms'),
  messageText: text('message_text').notNull(),
  status: text('status').notNull().default('sent'),
  externalMessageId: text('external_message_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const orders = pgTable(
  'orders',
  {
    id: serial('id').primaryKey(),
    orderNumber: text('order_number').notNull().unique(),
    customerId: integer('customer_id').references(() => customers.id),
    customerName: text('customer_name').notNull(),
    customerEmail: text('customer_email').notNull(),
    customerPhone: text('customer_phone'),
    customerTaxId: text('customer_tax_id'),
    total: numeric('total', { precision: 10, scale: 2 }).notNull(),
    status: text('status').notNull().default('completed'),
    paymentMethod: text('payment_method').notNull().default('card'),
    invoiceIssued: boolean('invoice_issued').default(false),
    smsNotified: boolean('sms_notified').default(false),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('orders_number_idx').on(table.orderNumber),
    index('orders_created_idx').on(table.createdAt),
  ],
);

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  productId: integer('product_id').notNull().references(() => products.id),
  productSku: text('product_sku').notNull(),
  productName: text('product_name').notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  refreshTokens: many(refreshTokens),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  movements: many(inventoryMovements),
  orderItems: many(orderItems),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const inventoryMovementsRelations = relations(
  inventoryMovements,
  ({ one }) => ({
    product: one(products, {
      fields: [inventoryMovements.productId],
      references: [products.id],
    }),
  }),
);
