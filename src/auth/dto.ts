import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

export const RegisterSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  role: z.enum(['admin', 'manager', 'cashier']).optional(),
});

export class LoginDto {
  email!: string;
  password!: string;
}

export class RegisterDto {
  email!: string;
  password!: string;
  name!: string;
  role?: string;
}
