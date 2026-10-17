import { z } from 'zod';

export const CreateOrderItemSchema = z.object({
  productId: z.number().int().positive('ID de producto inválido'),
  quantity: z.number().int().min(1, 'La cantidad debe ser al menos 1'),
});

export const CreateOrderSchema = z.object({
  customerName: z.string().min(2, 'Nombre del cliente requerido'),
  customerEmail: z.string().email('Correo de cliente inválido'),
  customerPhone: z.string().optional(),
  customerTaxId: z.string().optional(),
  customerId: z.number().int().positive().optional(),
  status: z.enum(['completed', 'processing', 'pending', 'cancelled']).optional().default('completed'),
  paymentMethod: z.enum(['card', 'cash', 'transfer', 'paypal']).default('card'),
  notes: z.string().optional(),
  items: z
    .array(CreateOrderItemSchema)
    .min(1, 'Debe incluir al menos un producto'),
});

export class CreateOrderItemDto {
  productId!: number;
  quantity!: number;
}

export class CreateOrderDto {
  customerName!: string;
  customerEmail!: string;
  customerPhone?: string;
  customerTaxId?: string;
  customerId?: number;
  status?: 'completed' | 'processing' | 'pending' | 'cancelled';
  paymentMethod?: 'card' | 'cash' | 'transfer' | 'paypal';
  notes?: string;
  items!: CreateOrderItemDto[];
}

