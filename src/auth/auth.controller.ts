import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto, RegisterDto, LoginSchema } from './dto.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { appConfig } from '../config/env.config.js';

const COOKIE_NAME = 'nexus_refresh_token';
const isProduction = appConfig.nodeEnv === 'production';

@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Inicio de sesión con JWT y Refresh Token HttpOnly' })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateUserCredentials(
      dto.email,
      dto.password,
    );

    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const { accessToken, refreshToken, user: userData } =
      await this.authService.generateTokens(user, ipAddress, userAgent);

    res.cookie(COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      accessToken,
      user: userData,
    };
  }

  @Post('register')
  @ApiOperation({ summary: 'Registro de nuevo usuario administrativo' })
  async register(@Body() dto: RegisterDto) {
    const user = await this.authService.register(
      dto.email,
      dto.password,
      dto.name,
      dto.role,
    );

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Rotación y renovación de Access Token' })
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawRefreshToken = req.cookies?.[COOKIE_NAME];
    if (!rawRefreshToken) {
      throw new UnauthorizedException('No hay sesión activa para refrescar');
    }

    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const { accessToken, refreshToken, user } =
      await this.authService.refreshSession(
        rawRefreshToken,
        ipAddress,
        userAgent,
      );

    res.cookie(COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      accessToken,
      user,
    };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Cierre de sesión y revocación de Refresh Token' })
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawRefreshToken = req.cookies?.[COOKIE_NAME];
    if (rawRefreshToken) {
      await this.authService.logout(rawRefreshToken);
    }

    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/api/auth',
    });

    return { success: true, message: 'Sesión cerrada exitosamente' };
  }

  @Get('me')
  @ApiOperation({ summary: 'Obtener datos del usuario autenticado' })
  async me(@Req() req: Request) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autorización no encontrado');
    }

    const token = authHeader.split(' ')[1];
    const payload = this.authService.verifyAccessToken(token);
    return payload;
  }
}
