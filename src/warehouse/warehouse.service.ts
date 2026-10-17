import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DrizzleService } from '../db/drizzle.service.js';
import * as schema from '../db/schema.js';
import { eq, desc, sql, lte } from 'drizzle-orm';
import { CreateStockAdjustmentDto } from './dto.js';

@Injectable()
export class WarehouseService {
  constructor(private readonly drizzle: DrizzleService) {}

  async getMovements(limit = 50) {
    const list = await this.drizzle.db
      .select({
        id: schema.inventoryMovements.id,
        productId: schema.inventoryMovements.productId,
        type: schema.inventoryMovements.type,
        quantity: schema.inventoryMovements.quantity,
        previousStock: schema.inventoryMovements.previousStock,
        newStock: schema.inventoryMovements.newStock,
        reason: schema.inventoryMovements.reason,
        reference: schema.inventoryMovements.reference,
        createdAt: schema.inventoryMovements.createdAt,
        productName: schema.products.name,
        productSku: schema.products.sku,
      })
      .from(schema.inventoryMovements)
      .innerJoin(
        schema.products,
        eq(schema.inventoryMovements.productId, schema.products.id),
      )
      .orderBy(desc(schema.inventoryMovements.createdAt))
      .limit(limit);

    return list;
  }

  async getLowStockAlerts() {
    return this.drizzle.db
      .select()
      .from(schema.products)
      .where(lte(schema.products.stock, schema.products.minStock))
      .orderBy(schema.products.stock);
  }

  async getWarehouseOverview() {
    const [stats] = await this.drizzle.db
      .select({
        totalProducts: sql<number>`count(${schema.products.id})::int`,
        totalStock: sql<number>`coalesce(sum(${schema.products.stock}), 0)::int`,
        totalCostValuation: sql<string>`coalesce(sum(${schema.products.cost} * ${schema.products.stock}), 0)::text`,
        totalSaleValuation: sql<string>`coalesce(sum(${schema.products.price} * ${schema.products.stock}), 0)::text`,
      })
      .from(schema.products);

    const lowStock = await this.getLowStockAlerts();

    return {
      ...stats,
      lowStockCount: lowStock.length,
      lowStockItems: lowStock,
    };
  }

  async adjustStock(dto: CreateStockAdjustmentDto) {
    if (dto.quantity <= 0) {
      throw new BadRequestException('La cantidad debe ser mayor a 0');
    }

    const [product] = await this.drizzle.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, dto.productId));

    if (!product) {
      throw new NotFoundException(
        `Producto con ID ${dto.productId} no encontrado`,
      );
    }

    let calculatedStock = product.stock;

    if (dto.type === 'IN' || dto.type === 'RETURN') {
      calculatedStock += dto.quantity;
    } else if (dto.type === 'OUT') {
      if (product.stock < dto.quantity) {
        throw new BadRequestException(
          `Stock insuficiente. Stock actual: ${product.stock}, intento de salida: ${dto.quantity}`,
        );
      }
      calculatedStock -= dto.quantity;
    }

    const [updatedProduct] = await this.drizzle.db
      .update(schema.products)
      .set({
        stock: calculatedStock,
        status: calculatedStock === 0 ? 'out_of_stock' : product.status,
        updatedAt: new Date(),
      })
      .where(eq(schema.products.id, dto.productId))
      .returning();

    const [movement] = await this.drizzle.db
      .insert(schema.inventoryMovements)
      .values({
        productId: dto.productId,
        type: dto.type,
        quantity: dto.quantity,
        previousStock: product.stock,
        newStock: calculatedStock,
        reason: dto.reason,
        reference: dto.reference || null,
      })
      .returning();

    return {
      movement,
      product: updatedProduct,
    };
  }
}
