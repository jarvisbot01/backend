import {
  Controller,
  All,
  Req,
  Res,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { hostHeaderValidation } from '@modelcontextprotocol/express';
import { McpServerService } from './mcp-server.service.js';
import { OAuth2Service } from './oauth.service.js';
import { appConfig } from '../config/env.config.js';

interface AuthenticatedRequest extends Request {
  user?: unknown;
}

@Controller('mcp')
export class McpController {
  private readonly logger = new Logger(McpController.name);
  private readonly validateHost = hostHeaderValidation(appConfig.mcpAllowedHosts);

  constructor(
    private readonly mcpServerService: McpServerService,
    private readonly oauth2Service: OAuth2Service,
  ) {}

  @All()
  async handleMcpStream(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    this.validateHost(req, res, () => {});
    if (res.headersSent) {
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const issuer = `${req.protocol}://${req.get('host') || 'localhost:4000'}`;
      res.setHeader(
        'WWW-Authenticate',
        `Bearer realm="Nexus MCP", error="invalid_token", error_description="The access token is required", resource_metadata="${issuer}/.well-known/oauth-protected-resource"`,
      );
      throw new UnauthorizedException(
        'Bearer token required to access MCP endpoint',
      );
    }

    const token = authHeader.substring(7);
    const tokenPayload = this.oauth2Service.verifyAccessToken(token);
    req.user = tokenPayload;

    this.logger.log(
      `MCP Stream request [${req.method}] from client=${tokenPayload.client_id} user=${tokenPayload.email}`,
    );

    try {
      await this.mcpServerService.handleRequest(req, res, req.body);
    } catch (err: unknown) {
      this.logger.error(
        `Error procesando MCP request: ${(err as Error).message}`,
        (err as Error).stack,
      );
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: (err as Error).message || 'Internal MCP error',
          },
          id: req.body?.id || null,
        });
      }
    }
  }
}
