import { z } from 'zod';

export const CreateStockAdjustmentSchema = z.object({
  productId: z.number().int().positive('ID de producto inválido'),
  type: z.enum(['IN', 'OUT', 'RETURN'], {
    message: 'Tipo debe ser IN, OUT o RETURN',
  }),
  quantity: z.number().int().min(1, 'La cantidad debe ser mayor a 0'),
  reason: z.string().min(3, 'El motivo debe tener al menos 3 caracteres'),
  reference: z.string().optional(),
});

export class CreateStockAdjustmentDto {
  productId!: number;
  type!: 'IN' | 'OUT' | 'RETURN';
  quantity!: number;
  reason!: string;
  reference?: string;
}
