import { describe, it, expect, beforeEach } from 'vitest';
import { OAuth2Service } from './oauth.service.js';
import crypto from 'node:crypto';

describe('OAuth2Service (OAuth 2.1 with PKCE S256)', () => {
  let oauth2Service: OAuth2Service;

  beforeEach(() => {
    oauth2Service = new OAuth2Service();
  });

  it('should initialize with default MCP client and allow dynamic registration', () => {
    const defaultClient = oauth2Service.getClient('nexus-default-mcp-client');
    expect(defaultClient).toBeDefined();
    expect(defaultClient?.clientName).toBe('Nexus Admin MCP Client');
    expect(defaultClient?.tokenEndpointAuthMethod).toBe('none');

    const dynamicClient = oauth2Service.registerClient({
      client_name: 'Custom Agent Client',
      redirect_uris: ['http://localhost:3000/oauth/callback'],
      token_endpoint_auth_method: 'none',
      scope: 'mcp:read',
    });

    expect(dynamicClient.clientId).toBeDefined();
    expect(oauth2Service.getClient(dynamicClient.clientId)).toBeDefined();
  });

  it('should provide RFC 8414 and RFC 9728 discovery metadata', () => {
    const serverMeta = oauth2Service.getServerMetadata('http://localhost:4000');
    expect(serverMeta.issuer).toBe('http://localhost:4000');
    expect(serverMeta.authorization_endpoint).toBe(
      'http://localhost:4000/oauth/authorize',
    );
    expect(serverMeta.token_endpoint).toBe('http://localhost:4000/oauth/token');
    expect(serverMeta.code_challenge_methods_supported).toContain('S256');

    const resourceMeta = oauth2Service.getResourceMetadata(
      'http://localhost:4000',
    );
    expect(resourceMeta.resource).toBe('http://localhost:4000/mcp');
    expect(resourceMeta.authorization_servers).toContain(
      'http://localhost:4000',
    );
  });

  it('should generate an authorization code and exchange with PKCE S256', () => {
    const codeVerifier = 'a_very_long_secure_code_verifier_12345678901234567890';
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier, 'ascii')
      .digest('base64url');

    const code = oauth2Service.createAuthorizationCode({
      clientId: 'nexus-default-mcp-client',
      redirectUri: 'http://localhost:3000/oauth/callback',
      codeChallenge,
      codeChallengeMethod: 'S256',
      userId: 1,
      userEmail: 'admin@ecommerce.com',
      userRole: 'admin',
      scope: 'mcp:read mcp:write',
      resource: 'http://localhost:4000/mcp',
    });

    expect(code).toBeDefined();
    expect(code.startsWith('code_')).toBe(true);

    const tokenResponse = oauth2Service.exchangeAuthorizationCode({
      clientId: 'nexus-default-mcp-client',
      code,
      redirectUri: 'http://localhost:3000/oauth/callback',
      codeVerifier,
      resource: 'http://localhost:4000/mcp',
    });

    expect(tokenResponse.access_token).toBeDefined();
    expect(tokenResponse.token_type).toBe('Bearer');
    expect(tokenResponse.expires_in).toBe(7200);

    const verified = oauth2Service.verifyAccessToken(
      tokenResponse.access_token,
    );
    expect(verified.email).toBe('admin@ecommerce.com');
    expect(verified.role).toBe('admin');
  });

  it('should reject invalid PKCE code_verifier', () => {
    const codeVerifier = 'valid_verifier_123456789012345678901234567890';
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier, 'ascii')
      .digest('base64url');

    const code = oauth2Service.createAuthorizationCode({
      clientId: 'nexus-default-mcp-client',
      redirectUri: 'http://localhost:3000/oauth/callback',
      codeChallenge,
      codeChallengeMethod: 'S256',
      userId: 1,
      userEmail: 'admin@ecommerce.com',
      userRole: 'admin',
    });

    expect(() =>
      oauth2Service.exchangeAuthorizationCode({
        clientId: 'nexus-default-mcp-client',
        code,
        redirectUri: 'http://localhost:3000/oauth/callback',
        codeVerifier: 'wrong_verifier_999999999999999999999999999999',
      }),
    ).toThrow('Invalid PKCE code_verifier');
  });
});
