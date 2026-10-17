import { describe, it, expect } from 'vitest';
import { ZodValidationPipe } from './zod-validation.pipe.js';
import { z } from 'zod';
import { BadRequestException } from '@nestjs/common';

describe('ZodValidationPipe', () => {
  const schema = z.object({
    email: z.string().email(),
    age: z.number().min(18),
  });

  const pipe = new ZodValidationPipe(schema);

  it('should pass valid data through', () => {
    const valid = { email: 'test@example.com', age: 25 };
    const result = pipe.transform(valid, { type: 'body' });
    expect(result).toEqual(valid);
  });

  it('should throw BadRequestException on invalid data', () => {
    const invalid = { email: 'not-an-email', age: 10 };
    expect(() => pipe.transform(invalid, { type: 'body' })).toThrow(
      BadRequestException,
    );
  });

  it('should ignore non-body metadata', () => {
    const value = 'query-param';
    const result = pipe.transform(value, { type: 'query' });
    expect(result).toBe(value);
  });
});
