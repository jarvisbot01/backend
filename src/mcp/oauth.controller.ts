import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  Res,
  HttpStatus,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { OAuth2Service } from './oauth.service.js';
import { AuthService } from '../auth/auth.service.js';
import { DynamicClientRegistrationDto } from './oauth.types.js';

@Controller()
export class OAuth2Controller {
  constructor(
    private readonly oauth2Service: OAuth2Service,
    private readonly authService: AuthService,
  ) {}

  @Get('.well-known/oauth-authorization-server')
  getOAuthServerMetadata(@Req() req: Request) {
    const proto =
      req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:4000';
    const baseUrl = `${proto}://${host}`;
    return this.oauth2Service.getServerMetadata(baseUrl);
  }

  @Get('.well-known/openid-configuration')
  getOpenIdConfiguration(@Req() req: Request) {
    const proto =
      req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:4000';
    const baseUrl = `${proto}://${host}`;
    return this.oauth2Service.getServerMetadata(baseUrl);
  }

  @Get('.well-known/oauth-protected-resource')
  getOAuthProtectedResourceMetadata(@Req() req: Request) {
    const proto =
      req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:4000';
    const baseUrl = `${proto}://${host}`;
    return this.oauth2Service.getResourceMetadata(baseUrl);
  }

  @Post('oauth/register')
  @HttpCode(HttpStatus.CREATED)
  registerDynamicClient(@Body() dto: DynamicClientRegistrationDto) {
    return this.oauth2Service.registerClient(dto);
  }

  @Get('oauth/authorize')
  async authorize(
    @Query('response_type') responseType: string,
    @Query('client_id') clientId: string,
    @Query('redirect_uri') redirectUri: string,
    @Query('scope') scope: string,
    @Query('state') state: string,
    @Query('code_challenge') codeChallenge: string,
    @Query('code_challenge_method') codeChallengeMethod: string,
    @Query('resource') resource: string,
    @Res() res: Response,
  ) {
    if (responseType !== 'code') {
      throw new BadRequestException(
        'OAuth 2.1 only supports response_type=code',
      );
    }
    if (!clientId || !redirectUri) {
      throw new BadRequestException('client_id and redirect_uri are required');
    }
    if (!codeChallenge) {
      throw new BadRequestException('code_challenge is required in OAuth 2.1');
    }

    const client = this.oauth2Service.getClient(clientId);
    if (!client) {
      throw new BadRequestException(`Client not found: ${clientId}`);
    }

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Autorizar MCP - Nexus Ecommerce</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
          .card { background: #1e293b; padding: 2rem; border-radius: 1rem; width: 100%; max-width: 440px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155; }
          h2 { margin-top: 0; color: #38bdf8; font-size: 1.5rem; text-align: center; }
          p { color: #94a3b8; font-size: 0.9rem; line-height: 1.4; }
          .badge { display: inline-block; background: #0369a1; color: #e0f2fe; padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; margin-bottom: 1rem; }
          .scope-box { background: #0f172a; padding: 0.75rem; border-radius: 0.5rem; font-family: monospace; font-size: 0.85rem; color: #38bdf8; margin-bottom: 1.25rem; }
          .form-group { margin-bottom: 1rem; }
          label { display: block; font-size: 0.85rem; margin-bottom: 0.4rem; color: #cbd5e1; }
          input { width: 100%; box-sizing: border-box; padding: 0.65rem; border-radius: 0.5rem; background: #0f172a; border: 1px solid #475569; color: #f8fafc; font-size: 0.9rem; }
          input:focus { outline: none; border-color: #38bdf8; }
          .btn { width: 100%; padding: 0.75rem; border: none; border-radius: 0.5rem; background: #0284c7; color: white; font-weight: 600; cursor: pointer; font-size: 0.95rem; margin-top: 0.5rem; transition: background 0.2s; }
          .btn:hover { background: #0369a1; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Nexus MCP OAuth 2.1</h2>
          <div style="text-align: center;"><span class="badge">RFC 8414 / RFC 9728 + PKCE</span></div>
          <p>La aplicación <strong>${client.clientName}</strong> (<code>${client.clientId}</code>) solicita acceso al servidor MCP Streamable HTTP.</p>
          
          <div class="scope-box">
            Permisos requeridos:<br/>
            <strong>${scope || 'mcp:read mcp:write'}</strong>
          </div>

          <form action="/oauth/authorize/decision" method="POST">
            <input type="hidden" name="client_id" value="${clientId}" />
            <input type="hidden" name="redirect_uri" value="${redirectUri}" />
            <input type="hidden" name="scope" value="${scope || 'mcp:read mcp:write'}" />
            <input type="hidden" name="state" value="${state || ''}" />
            <input type="hidden" name="code_challenge" value="${codeChallenge}" />
            <input type="hidden" name="code_challenge_method" value="${codeChallengeMethod || 'S256'}" />
            <input type="hidden" name="resource" value="${resource || ''}" />

            <div class="form-group">
              <label>Correo Electrónico:</label>
              <input type="email" name="email" value="admin@ecommerce.com" required />
            </div>

            <div class="form-group">
              <label>Contraseña:</label>
              <input type="password" name="password" value="admin123" required />
            </div>

            <button type="submit" class="btn">Autorizar y Vincular MCP</button>
          </form>
        </div>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }

  @Post('oauth/authorize/decision')
  async authorizeDecision(
    @Body() body: Record<string, string>,
    @Res() res: Response,
  ) {
    const {
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      resource,
      email,
      password,
    } = body;

    const user = await this.authService.validateUserCredentials(
      email,
      password,
    );

    const code = this.oauth2Service.createAuthorizationCode({
      clientId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod: (codeChallengeMethod as 'S256' | 'plain') || 'S256',
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      scope: scope || 'mcp:read mcp:write',
      resource,
    });

    const targetUrl = new URL(redirectUri);
    targetUrl.searchParams.set('code', code);
    if (state) {
      targetUrl.searchParams.set('state', state);
    }

    return res.redirect(HttpStatus.FOUND, targetUrl.toString());
  }

  @Post('oauth/token')
  @HttpCode(HttpStatus.OK)
  async token(
    @Body() body: Record<string, string>,
    @Req() req: Request,
  ) {
    let clientId = body.client_id;
    let clientSecret = body.client_secret;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Basic ')) {
      const credentials = Buffer.from(
        authHeader.split(' ')[1],
        'base64',
      ).toString('ascii');
      const [id, secret] = credentials.split(':');
      clientId = id;
      clientSecret = secret;
    }

    const {
      grant_type: grantType,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
      resource,
    } = body;

    if (grantType !== 'authorization_code') {
      throw new BadRequestException(
        `Unsupported grant_type: ${grantType}. OAuth 2.1 requires authorization_code`,
      );
    }

    if (!code || !redirectUri || !codeVerifier) {
      throw new BadRequestException(
        'code, redirect_uri, and code_verifier are required',
      );
    }

    return this.oauth2Service.exchangeAuthorizationCode({
      clientId,
      clientSecret,
      code,
      redirectUri,
      codeVerifier,
      resource,
    });
  }
}
