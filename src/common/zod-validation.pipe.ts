import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { z } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: z.ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.type !== 'body') {
      return value;
    }

    const result = this.schema.safeParse(value);
    if (!result.success) {
      const errorMessages = result.error.issues.map(
        (e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`,
      );
      throw new BadRequestException({
        message: 'Error de validación de datos',
        errors: errorMessages,
      });
    }

    return result.data;
  }
}
