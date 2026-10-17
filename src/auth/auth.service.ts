import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { DrizzleService } from '../db/drizzle.service.js';
import * as schema from '../db/schema.js';
import { eq, and, gt } from 'drizzle-orm';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || 'nexus_super_access_secret_key_2026_xyz';
const JWT_REFRESH_HMAC_SECRET =
  process.env.JWT_REFRESH_HMAC_SECRET || 'nexus_refresh_hmac_secret_key_9988_abc';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_DAYS = 7;

@Injectable()
export class AuthService {
  constructor(private readonly drizzle: DrizzleService) {}

  private hashRefreshToken(token: string): string {
    return crypto
      .createHmac('sha256', JWT_REFRESH_HMAC_SECRET)
      .update(token)
      .digest('hex');
  }

  async generateTokens(
    user: typeof schema.users.$inferSelect,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const accessToken = jwt.sign(payload, JWT_ACCESS_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    const rawRefreshToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = this.hashRefreshToken(rawRefreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);

    await this.drizzle.db.insert(schema.refreshTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async refreshSession(
    rawRefreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('No se proporcionó refresh token');
    }

    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    const now = new Date();

    const [tokenRecord] = await this.drizzle.db
      .select()
      .from(schema.refreshTokens)
      .where(
        and(
          eq(schema.refreshTokens.tokenHash, tokenHash),
          gt(schema.refreshTokens.expiresAt, now),
        ),
      );

    if (!tokenRecord || tokenRecord.revokedAt) {
      throw new UnauthorizedException('Refresh token inválido o revocado');
    }

    await this.drizzle.db
      .update(schema.refreshTokens)
      .set({ revokedAt: now })
      .where(eq(schema.refreshTokens.id, tokenRecord.id));

    const [user] = await this.drizzle.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, tokenRecord.userId));

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no válido o inactivo');
    }

    return this.generateTokens(user, ipAddress, userAgent);
  }

  async logout(rawRefreshToken: string) {
    if (!rawRefreshToken) return;
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    await this.drizzle.db
      .update(schema.refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(schema.refreshTokens.tokenHash, tokenHash));
  }

  verifyAccessToken(token: string) {
    try {
      return jwt.verify(token, JWT_ACCESS_SECRET);
    } catch {
      throw new UnauthorizedException('Token de acceso inválido o expirado');
    }
  }

  async register(
    email: string,
    password: string,
    name: string,
    role: string = 'admin',
  ) {
    const existing = await this.drizzle.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase()));

    if (existing.length > 0) {
      throw new BadRequestException('El correo electrónico ya está registrado');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await this.drizzle.db
      .insert(schema.users)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        name,
        role,
      })
      .returning();

    return user;
  }

  async validateUserCredentials(email: string, pass: string) {
    const [user] = await this.drizzle.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase()));

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return user;
  }
}
