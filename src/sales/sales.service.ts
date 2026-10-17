import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DrizzleService } from '../db/drizzle.service.js';
import * as schema from '../db/schema.js';
import { eq, desc, sql, inArray } from 'drizzle-orm';
import { CreateOrderDto } from './dto.js';

@Injectable()
export class SalesService {
  constructor(private readonly drizzle: DrizzleService) {}

  async findAll(limit = 100) {
    const ordersList = await this.drizzle.db
      .select()
      .from(schema.orders)
      .orderBy(desc(schema.orders.createdAt))
      .limit(limit);

    const ordersWithItems = await Promise.all(
      ordersList.map(async (order) => {
        const items = await this.drizzle.db
          .select()
          .from(schema.orderItems)
          .where(eq(schema.orderItems.orderId, order.id));
        return {
          ...order,
          items,
        };
      }),
    );

    return ordersWithItems;
  }

  async findOne(id: number) {
    const [order] = await this.drizzle.db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, id));

    if (!order) {
      throw new NotFoundException(`Venta / Pedido ${id} no encontrado`);
    }

    const items = await this.drizzle.db
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, order.id));

    return {
      ...order,
      items,
    };
  }

  async create(dto: CreateOrderDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('La venta debe tener al menos un producto');
    }

    const productIds = dto.items.map((i) => i.productId);
    const existingProducts = await this.drizzle.db
      .select()
      .from(schema.products)
      .where(inArray(schema.products.id, productIds));

    if (existingProducts.length !== productIds.length) {
      throw new BadRequestException('Uno o más productos seleccionados no existen');
    }

    for (const item of dto.items) {
      const prod = existingProducts.find((p) => p.id === item.productId);
      if (!prod || prod.stock < item.quantity) {
        throw new BadRequestException(
          `Stock insuficiente para '${prod?.name || item.productId}'. Disponible: ${prod?.stock ?? 0}, Solicitado: ${item.quantity}`,
        );
      }
    }

    let grandTotal = 0;
    const itemsData = dto.items.map((item) => {
      const prod = existingProducts.find((p) => p.id === item.productId)!;
      const unitPrice = parseFloat(prod.price);
      const subtotal = unitPrice * item.quantity;
      grandTotal += subtotal;
      return {
        productId: prod.id,
        productSku: prod.sku,
        productName: prod.name,
        quantity: item.quantity,
        unitPrice: unitPrice.toFixed(2),
        subtotal: subtotal.toFixed(2),
        prodInstance: prod,
      };
    });

    const orderNumber = `VNT-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;

    const [order] = await this.drizzle.db
      .insert(schema.orders)
      .values({
        orderNumber,
        customerId: dto.customerId || null,
        customerName: dto.customerName,
        customerEmail: dto.customerEmail,
        customerPhone: dto.customerPhone || null,
        customerTaxId: dto.customerTaxId || null,
        total: grandTotal.toFixed(2),
        status: dto.status || 'completed',
        paymentMethod: dto.paymentMethod || 'card',
        notes: dto.notes || null,
      })
      .returning();

    for (const item of itemsData) {
      await this.drizzle.db.insert(schema.orderItems).values({
        orderId: order.id,
        productId: item.productId,
        productSku: item.productSku,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
      });

      const previousStock = item.prodInstance.stock;
      const newStock = previousStock - item.quantity;

      await this.drizzle.db
        .update(schema.products)
        .set({
          stock: newStock,
          status: newStock === 0 ? 'out_of_stock' : item.prodInstance.status,
          updatedAt: new Date(),
        })
        .where(eq(schema.products.id, item.productId));

      await this.drizzle.db.insert(schema.inventoryMovements).values({
        productId: item.productId,
        type: 'SALE',
        quantity: item.quantity,
        previousStock,
        newStock,
        reason: `Venta ecommerce ref ${order.orderNumber}`,
        reference: order.orderNumber,
      });
    }

    return this.findOne(order.id);
  }

  async updateStatus(id: number, status: string) {
    if (!['completed', 'processing', 'pending', 'cancelled'].includes(status)) {
      throw new BadRequestException(`Estado inválido: ${status}`);
    }

    const [order] = await this.drizzle.db
      .update(schema.orders)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.orders.id, id))
      .returning();

    if (!order) {
      throw new NotFoundException(`Orden ${id} no encontrada`);
    }

    return order;
  }

  async getMetrics() {
    const [totalSales] = await this.drizzle.db
      .select({
        totalAmount: sql<string>`coalesce(sum(${schema.orders.total}), 0)::text`,
        count: sql<number>`count(${schema.orders.id})::int`,
      })
      .from(schema.orders)
      .where(eq(schema.orders.status, 'completed'));

    const [totalProducts] = await this.drizzle.db
      .select({
        count: sql<number>`count(${schema.products.id})::int`,
        totalStock: sql<number>`coalesce(sum(${schema.products.stock}), 0)::int`,
      })
      .from(schema.products);

    const [recentCustomers] = await this.drizzle.db
      .select({
        count: sql<number>`count(${schema.customers.id})::int`,
      })
      .from(schema.customers);

    const recentOrders = await this.drizzle.db
      .select()
      .from(schema.orders)
      .orderBy(desc(schema.orders.createdAt))
      .limit(5);

    return {
      revenue: parseFloat(totalSales?.totalAmount || '0'),
      salesCount: totalSales?.count || 0,
      productsCount: totalProducts?.count || 0,
      totalStock: totalProducts?.totalStock || 0,
      customersCount: recentCustomers?.count || 0,
      recentOrders,
    };
  }
}
