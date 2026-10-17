import { z } from 'zod';

export const CreateProductSchema = z.object({
  sku: z.string().min(3, 'El SKU debe tener al menos 3 caracteres'),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  description: z.string().optional(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Precio inválido (ej: 19.99)'),
  cost: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Costo inválido').optional(),
  stock: z.number().int().min(0, 'El stock no puede ser negativo'),
  minStock: z.number().int().min(0).optional(),
  categoryId: z.number().int().positive().optional(),
  status: z.enum(['active', 'inactive', 'out_of_stock']).optional(),
});

export const UpdateProductSchema = CreateProductSchema.partial();

export class CreateProductDto {
  sku!: string;
  name!: string;
  description?: string;
  price!: string;
  cost?: string;
  stock!: number;
  minStock?: number;
  categoryId?: number;
  status?: string;
}

export class UpdateProductDto {
  sku?: string;
  name?: string;
  description?: string;
  price?: string;
  cost?: string;
  stock?: number;
  minStock?: number;
  categoryId?: number;
  status?: string;
}
