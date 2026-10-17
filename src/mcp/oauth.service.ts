import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import {
  DynamicClientRegistrationDto,
  OAuthClient,
  AuthorizationCodeGrant,
} from './oauth.types.js';
import { appConfig } from '../config/env.config.js';

@Injectable()
export class OAuth2Service {
  private readonly jwtSecret = appConfig.jwtSecretOauth;
  private readonly clients = new Map<string, OAuthClient>();
  private readonly authCodes = new Map<string, AuthorizationCodeGrant>();

  constructor() {
    this.registerClient(
      {
        client_name: 'Nexus Admin MCP Client',
        redirect_uris: [
          'http://localhost:3000/oauth/callback',
          'http://127.0.0.1:3000/oauth/callback',
          'http://localhost:3001/oauth/callback',
          'http://127.0.0.1:3001/oauth/callback',
          'https://oauth.pstmn.io/v1/callback',
        ],
        grant_types: ['authorization_code'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        scope: 'mcp:read mcp:write',
      },
      'nexus-default-mcp-client',
    );
  }

  registerClient(
    dto: DynamicClientRegistrationDto,
    customId?: string,
  ): OAuthClient {
    if (
      !dto.redirect_uris ||
      !Array.isArray(dto.redirect_uris) ||
      dto.redirect_uris.length === 0
    ) {
      throw new BadRequestException('redirect_uris array is required');
    }

    const clientId = customId || `client_${crypto.randomUUID()}`;
    const tokenAuthMethod = dto.token_endpoint_auth_method || 'none';
    const clientSecret =
      tokenAuthMethod !== 'none'
        ? crypto.randomBytes(32).toString('hex')
        : undefined;

    const client: OAuthClient = {
      clientId,
      clientSecret,
      clientName: dto.client_name || 'Dynamic MCP Client',
      redirectUris: dto.redirect_uris,
      grantTypes: dto.grant_types || ['authorization_code'],
      responseTypes: dto.response_types || ['code'],
      tokenEndpointAuthMethod: tokenAuthMethod,
      scope: dto.scope || 'mcp:read mcp:write',
      createdAt: Date.now(),
    };

    this.clients.set(clientId, client);
    return client;
  }

  getClient(clientId: string): OAuthClient | undefined {
    return this.clients.get(clientId);
  }

  createAuthorizationCode(params: {
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    codeChallengeMethod?: 'S256' | 'plain';
    userId: number;
    userEmail: string;
    userRole: string;
    scope?: string;
    resource?: string;
  }): string {
    const client = this.getClient(params.clientId);
    if (!client) {
      throw new BadRequestException(`Unknown client_id: ${params.clientId}`);
    }

    const isLocalhostUri = (uri: string): boolean => {
      try {
        const parsed = new URL(uri);
        return (
          (parsed.hostname === 'localhost' ||
            parsed.hostname === '127.0.0.1') &&
          parsed.pathname === '/oauth/callback'
        );
      } catch {
        return false;
      }
    };

    const isAllowedRedirect =
      client.redirectUris.includes(params.redirectUri) ||
      isLocalhostUri(params.redirectUri);

    if (!isAllowedRedirect) {
      throw new BadRequestException(
        `redirect_uri not registered: ${params.redirectUri}`,
      );
    }

    if (!params.codeChallenge) {
      throw new BadRequestException('code_challenge is required in OAuth 2.1');
    }

    const code = `code_${crypto.randomBytes(24).toString('hex')}`;
    const grant: AuthorizationCodeGrant = {
      code,
      clientId: params.clientId,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      codeChallengeMethod: params.codeChallengeMethod || 'S256',
      userId: params.userId,
      userEmail: params.userEmail,
      userRole: params.userRole,
      scope: params.scope || 'mcp:read',
      resource: params.resource,
      expiresAt: Date.now() + 10 * 60 * 1000,
    };

    this.authCodes.set(code, grant);
    return code;
  }

  private verifyPKCE(
    codeVerifier: string,
    codeChallenge: string,
    method: 'S256' | 'plain',
  ): boolean {
    if (method === 'plain') {
      const vBuf = Buffer.from(codeVerifier);
      const cBuf = Buffer.from(codeChallenge);
      return vBuf.length === cBuf.length && crypto.timingSafeEqual(vBuf, cBuf);
    }

    const hash = crypto
      .createHash('sha256')
      .update(codeVerifier, 'ascii')
      .digest('base64url');
    const hBuf = Buffer.from(hash);
    const cBuf = Buffer.from(codeChallenge);
    return hBuf.length === cBuf.length && crypto.timingSafeEqual(hBuf, cBuf);
  }

  exchangeAuthorizationCode(params: {
    clientId: string;
    clientSecret?: string;
    code: string;
    redirectUri: string;
    codeVerifier: string;
    resource?: string;
  }) {
    const grant = this.authCodes.get(params.code);
    if (!grant) {
      throw new BadRequestException('Invalid or expired authorization code');
    }

    this.authCodes.delete(params.code);

    if (Date.now() > grant.expiresAt) {
      throw new BadRequestException('Authorization code has expired');
    }

    if (grant.clientId !== params.clientId) {
      throw new BadRequestException('Client ID mismatch');
    }

    if (grant.redirectUri !== params.redirectUri) {
      throw new BadRequestException('Redirect URI mismatch');
    }

    const client = this.getClient(params.clientId);
    if (!client) {
      throw new BadRequestException('Client not found');
    }

    if (client.tokenEndpointAuthMethod !== 'none') {
      if (!params.clientSecret || !client.clientSecret) {
        throw new UnauthorizedException('Invalid client credentials');
      }
      const paramBuf = Buffer.from(params.clientSecret, 'utf-8');
      const clientBuf = Buffer.from(client.clientSecret, 'utf-8');
      if (
        paramBuf.length !== clientBuf.length ||
        !crypto.timingSafeEqual(paramBuf, clientBuf)
      ) {
        throw new UnauthorizedException('Invalid client credentials');
      }
    }

    if (!params.codeVerifier) {
      throw new BadRequestException('code_verifier is required in OAuth 2.1');
    }

    const isPkceValid = this.verifyPKCE(
      params.codeVerifier,
      grant.codeChallenge,
      grant.codeChallengeMethod,
    );
    if (!isPkceValid) {
      throw new BadRequestException('Invalid PKCE code_verifier');
    }

    const payload = {
      sub: String(grant.userId),
      email: grant.userEmail,
      role: grant.userRole,
      client_id: grant.clientId,
      scope: grant.scope,
      aud: grant.resource || 'nexus-mcp-server',
      iss: process.env.BASE_URL || 'http://localhost:4000',
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, { expiresIn: '2h' });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 7200,
      scope: grant.scope,
    };
  }

  verifyAccessToken(token: string): jwt.JwtPayload {
    try {
      return jwt.verify(token, this.jwtSecret) as jwt.JwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired Bearer token');
    }
  }

  getServerMetadata(issuerBaseUrl: string) {
    return {
      issuer: issuerBaseUrl,
      authorization_endpoint: `${issuerBaseUrl}/oauth/authorize`,
      token_endpoint: `${issuerBaseUrl}/oauth/token`,
      registration_endpoint: `${issuerBaseUrl}/oauth/register`,
      token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256', 'plain'],
      scopes_supported: ['mcp:read', 'mcp:write', 'openid', 'profile'],
      resource_indicators_supported: true,
      service_documentation: `${issuerBaseUrl}/docs`,
    };
  }

  getResourceMetadata(issuerBaseUrl: string) {
    return {
      resource: `${issuerBaseUrl}/mcp`,
      authorization_servers: [issuerBaseUrl],
      scopes_supported: ['mcp:read', 'mcp:write'],
      bearer_methods_supported: ['header'],
      resource_documentation: `${issuerBaseUrl}/docs`,
    };
  }
}
