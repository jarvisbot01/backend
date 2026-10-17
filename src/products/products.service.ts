import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DrizzleService } from '../db/drizzle.service.js';
import * as schema from '../db/schema.js';
import { eq, desc, ilike, or } from 'drizzle-orm';
import { CreateProductDto, UpdateProductDto } from './dto.js';

@Injectable()
export class ProductsService {
  constructor(private readonly drizzle: DrizzleService) {}

  async findAll(search?: string, categoryId?: number) {
    if (search) {
      return this.drizzle.db
        .select()
        .from(schema.products)
        .where(
          or(
            ilike(schema.products.name, `%${search}%`),
            ilike(schema.products.sku, `%${search}%`),
          ),
        )
        .orderBy(desc(schema.products.createdAt));
    }

    if (categoryId) {
      return this.drizzle.db
        .select()
        .from(schema.products)
        .where(eq(schema.products.categoryId, categoryId))
        .orderBy(desc(schema.products.createdAt));
    }

    return this.drizzle.db
      .select()
      .from(schema.products)
      .orderBy(desc(schema.products.createdAt));
  }

  async findOne(id: number) {
    const [product] = await this.drizzle.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, id));

    if (!product) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }

    return product;
  }

  async create(dto: CreateProductDto) {
    try {
      const [product] = await this.drizzle.db
        .insert(schema.products)
        .values({
          sku: dto.sku,
          name: dto.name,
          description: dto.description || null,
          price: dto.price,
          cost: dto.cost || '0.00',
          stock: dto.stock ?? 0,
          minStock: dto.minStock ?? 5,
          categoryId: dto.categoryId || null,
          status: dto.status || 'active',
        })
        .returning();

      if (product.stock > 0) {
        await this.drizzle.db.insert(schema.inventoryMovements).values({
          productId: product.id,
          type: 'IN',
          quantity: product.stock,
          previousStock: 0,
          newStock: product.stock,
          reason: 'Inventario inicial al crear producto',
          reference: `PROD-NEW-${product.id}`,
        });
      }

      return product;
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === '23505'
      ) {
        throw new BadRequestException(
          `El SKU '${dto.sku}' ya está registrado.`,
        );
      }
      throw err;
    }
  }

  async update(id: number, dto: UpdateProductDto) {
    await this.findOne(id);

    const updateData: Partial<typeof schema.products.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.sku !== undefined) updateData.sku = dto.sku;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.price !== undefined) updateData.price = dto.price;
    if (dto.cost !== undefined) updateData.cost = dto.cost;
    if (dto.stock !== undefined) updateData.stock = dto.stock;
    if (dto.minStock !== undefined) updateData.minStock = dto.minStock;
    if (dto.categoryId !== undefined) updateData.categoryId = dto.categoryId;
    if (dto.status !== undefined) updateData.status = dto.status;

    const [updated] = await this.drizzle.db
      .update(schema.products)
      .set(updateData)
      .where(eq(schema.products.id, id))
      .returning();

    return updated;
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.drizzle.db.delete(schema.products).where(eq(schema.products.id, id));
    return { success: true, message: `Producto ${id} eliminado` };
  }

  async getCategories() {
    return this.drizzle.db
      .select()
      .from(schema.categories)
      .orderBy(schema.categories.name);
  }

  async createCategory(name: string, description?: string) {
    const [cat] = await this.drizzle.db
      .insert(schema.categories)
      .values({ name, description })
      .returning();
    return cat;
  }
}
