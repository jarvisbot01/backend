import * as dotenv from 'dotenv';
dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  jwtAccessSecret: string;
  jwtRefreshHmacSecret: string;
  jwtSecretOauth: string;
  openapiApiKey: string;
  baseUrl: string;
  frontendUrl: string;
  corsAllowedOrigins: string[];
  mcpAllowedHosts: string[];
}

export function parseCsvList(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

const defaultCorsOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
];

const defaultMcpHosts = ['localhost', '127.0.0.1', '[::1]'];

export const appConfig: AppConfig = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgrespassword@localhost:5432/ecommerce_ventas',
  jwtAccessSecret:
    process.env.JWT_ACCESS_SECRET ||
    'nexus_super_access_secret_key_7634xyz',
  jwtRefreshHmacSecret:
    process.env.JWT_REFRESH_HMAC_SECRET ||
    'nexus_refresh_hmac_secret_key_9988_abc',
  jwtSecretOauth:
    process.env.JWT_SECRET_OAUTH ||
    'nexus_super_secret_jwt_key_2798',
  openapiApiKey:
    process.env.OPENAPI_API_KEY || 'test_openapi_sandbox_key',
  baseUrl: process.env.BASE_URL || 'http://localhost:4000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
  corsAllowedOrigins: Array.from(
    new Set([
      ...defaultCorsOrigins,
      ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
      ...parseCsvList(process.env.CORS_ALLOWED_ORIGINS),
    ]),
  ),
  mcpAllowedHosts: Array.from(
    new Set([
      ...defaultMcpHosts,
      ...parseCsvList(process.env.MCP_ALLOWED_HOSTS).map((h) =>
        h.replace(/^https?:\/\//, '').split('/')[0].split(':')[0],
      ),
      ...(process.env.BASE_URL
        ? (() => {
            try {
              return [new URL(process.env.BASE_URL).hostname];
            } catch {
              return [];
            }
          })()
        : []),
    ]),
  ).filter(Boolean),
};
