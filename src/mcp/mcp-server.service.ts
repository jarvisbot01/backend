import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Server as LegacyServer } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  Server as ModernServer,
  createMcpHandler,
  isLegacyRequest,
} from '@modelcontextprotocol/server';
import { toNodeHandler, toWebRequest } from '@modelcontextprotocol/node';
import { ProductsService } from '../products/products.service.js';
import { SalesService } from '../sales/sales.service.js';
import { WarehouseService } from '../warehouse/warehouse.service.js';
import crypto from 'node:crypto';

@Injectable()
export class McpServerService implements OnModuleInit {
  private readonly logger = new Logger(McpServerService.name);
  private readonly sessions = new Map<
    string,
    {
      server: LegacyServer;
      transport: StreamableHTTPServerTransport;
      createdAt: number;
    }
  >();
  private modernNodeHandler!: (
    req: Request,
    res: Response,
    parsedBody?: unknown,
  ) => Promise<void>;

  constructor(
    private readonly productsService: ProductsService,
    private readonly salesService: SalesService,
    private readonly warehouseService: WarehouseService,
  ) {}

  onModuleInit() {
    const modernHandler = createMcpHandler(
      () => this.createConfiguredModernServer(),
      {
        legacy: 'reject',
        onerror: (err: Error) =>
          this.logger.error(`Error en MCP Modern Handler: ${err.message}`, err.stack),
      },
    );

    this.modernNodeHandler = toNodeHandler(modernHandler);

    setInterval(() => {
      const now = Date.now();
      for (const [id, session] of this.sessions.entries()) {
        if (now - session.createdAt > 2 * 60 * 60 * 1000) {
          session.transport.close().catch(() => {});
          this.sessions.delete(id);
        }
      }
    }, 15 * 60 * 1000);
  }

  private createConfiguredLegacyServer(): LegacyServer {
    const server = new LegacyServer(
      {
        name: 'nexus-ecommerce-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      },
    );

    this.setupLegacyTools(server);
    this.setupLegacyResources(server);
    return server;
  }

  private createConfiguredModernServer(): ModernServer {
    const server = new ModernServer(
      {
        name: 'nexus-ecommerce-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      },
    );

    this.setupModernTools(server);
    this.setupModernResources(server);
    return server;
  }

  async handleRequest(req: Request, res: Response, parsedBody?: unknown) {
    try {
      const webReq = await toWebRequest(req, parsedBody);
      const legacy = await isLegacyRequest(webReq, parsedBody);

      if (!legacy) {
        this.logger.debug(
          'Procesando solicitud bajo MCP Era Moderna (2026-07-28)',
        );
        await this.modernNodeHandler(req, res, parsedBody);
        return;
      }
    } catch (err: unknown) {
      this.logger.warn(
        `Error al clasificar era de la solicitud: ${(err as Error).message}. Derivando a transporte legacy.`,
      );
    }

    await this.handleLegacyRequest(req, res, parsedBody);
  }

  private async handleLegacyRequest(
    req: Request,
    res: Response,
    parsedBody?: unknown,
  ) {
    const sessionIdHeader = req.headers['mcp-session-id'] as string;
    if (sessionIdHeader && this.sessions.has(sessionIdHeader)) {
      const session = this.sessions.get(sessionIdHeader)!;
      await session.transport.handleRequest(req, res, parsedBody);
      return;
    }

    let generatedSessionId: string;
    const transport = new StreamableHTTPServerTransport({
      enableJsonResponse: true,
      sessionIdGenerator: () => {
        generatedSessionId = `mcp_sess_${crypto.randomUUID()}`;
        return generatedSessionId;
      },
      onsessioninitialized: (id: string) => {
        this.sessions.set(id, {
          server,
          transport,
          createdAt: Date.now(),
        });
      },
      onsessionclosed: (id: string) => {
        this.sessions.delete(id);
      },
    });

    const server = this.createConfiguredLegacyServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, parsedBody);
  }

  getToolDefinitions() {
    return [
      {
        name: 'list_products',
        description:
          'Lista los productos del catálogo con soporte opcional de búsqueda por nombre o SKU.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            search: {
              type: 'string',
              description:
                'Término de búsqueda opcional por nombre o código SKU',
            },
            categoryId: {
              type: 'number',
              description: 'ID de la categoría opcional',
            },
          },
        },
      },
      {
        name: 'get_product_detail',
        description:
          'Obtiene el detalle completo de un producto por su ID incluyendo precio, stock y categoría.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            productId: {
              type: 'number',
              description: 'ID único del producto',
            },
          },
          required: ['productId'],
        },
      },
      {
        name: 'get_low_stock_alerts',
        description:
          'Lista los productos cuyo stock actual es menor o igual al umbral de stock mínimo.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
        },
      },
      {
        name: 'get_sales_orders',
        description:
          'Obtiene las órdenes y ventas más recientes del ecommerce con detalle de ítems y totales.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            limit: {
              type: 'number',
              description:
                'Número máximo de órdenes a retornar (por defecto 20)',
            },
          },
        },
      },
      {
        name: 'get_warehouse_movements',
        description:
          'Obtiene el historial de movimientos de inventario y kardex de almacén.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            limit: {
              type: 'number',
              description:
                'Número de movimientos a retornar (por defecto 25)',
            },
          },
        },
      },
    ];
  }

  async executeToolCall(name: string, args: Record<string, unknown> | undefined) {
    try {
      switch (name) {
        case 'list_products': {
          const search = args?.search as string | undefined;
          const categoryId = args?.categoryId as number | undefined;
          const products = await this.productsService.findAll(
            search,
            categoryId,
          );
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(products, null, 2),
              },
            ],
          };
        }
        case 'get_product_detail': {
          const productId = Number(args?.productId);
          const product = await this.productsService.findOne(productId);
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(product, null, 2),
              },
            ],
          };
        }
        case 'get_low_stock_alerts': {
          const alerts = await this.warehouseService.getLowStockAlerts();
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(alerts, null, 2),
              },
            ],
          };
        }
        case 'get_sales_orders': {
          const limit =
            typeof args?.limit === 'number' ? args.limit : 20;
          const orders = await this.salesService.findAll(limit);
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(orders, null, 2),
              },
            ],
          };
        }
        case 'get_warehouse_movements': {
          const limit =
            typeof args?.limit === 'number' ? args.limit : 25;
          const movements = await this.warehouseService.getMovements(limit);
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(movements, null, 2),
              },
            ],
          };
        }
        default:
          throw new Error(`Tool no reconocida: ${name}`);
      }
    } catch (err: unknown) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: `Error ejecutando tool ${name}: ${(err as Error)?.message || err}`,
          },
        ],
      };
    }
  }

  getResourceDefinitions() {
    return [
      {
        uri: 'nexus://inventory/summary',
        name: 'Resumen de Inventario y Alertas',
        description:
          'Muestra alertas de stock bajo y estado global del almacén',
        mimeType: 'application/json',
      },
      {
        uri: 'nexus://sales/recent',
        name: 'Ventas Recientes',
        description: 'Últimas 10 órdenes procesadas en el ecommerce',
        mimeType: 'application/json',
      },
    ];
  }

  getResourceTemplateDefinitions() {
    return [
      {
        uriTemplate: 'nexus://products/{id}',
        name: 'Detalle de Producto por ID',
        description:
          'Obtiene la información técnica y de inventario de un producto por su ID',
        mimeType: 'application/json',
      },
      {
        uriTemplate: 'nexus://sales/{id}',
        name: 'Detalle de Venta / Orden por ID',
        description:
          'Obtiene el detalle de una orden y sus líneas de pedido por su ID',
        mimeType: 'application/json',
      },
    ];
  }

  async executeReadResource(uri: string) {
    if (uri === 'nexus://inventory/summary') {
      const alerts = await this.warehouseService.getLowStockAlerts();
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                timestamp: new Date().toISOString(),
                lowStockItemsCount: alerts.length,
                alerts,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    if (uri === 'nexus://sales/recent') {
      const orders = await this.salesService.findAll(10);
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                timestamp: new Date().toISOString(),
                ordersCount: orders.length,
                orders,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    const productMatch = uri.match(/^nexus:\/\/products\/(\d+)$/);
    if (productMatch) {
      const productId = parseInt(productMatch[1], 10);
      const product = await this.productsService.findOne(productId);
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(product, null, 2),
          },
        ],
      };
    }

    const salesMatch = uri.match(/^nexus:\/\/sales\/(\d+)$/);
    if (salesMatch) {
      const saleId = parseInt(salesMatch[1], 10);
      const order = await this.salesService.findOne(saleId);
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(order, null, 2),
          },
        ],
      };
    }

    throw new Error(`Recurso no encontrado: ${uri}`);
  }

  private setupLegacyTools(server: LegacyServer) {
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: this.getToolDefinitions() };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      return this.executeToolCall(
        name,
        args as Record<string, unknown> | undefined,
      );
    });
  }

  private setupLegacyResources(server: LegacyServer) {
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return { resources: this.getResourceDefinitions() };
    });

    server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
      return { resourceTemplates: this.getResourceTemplateDefinitions() };
    });

    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      return this.executeReadResource(request.params.uri);
    });
  }

  private setupModernTools(server: ModernServer) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (server as any).setRequestHandler('tools/list', async () => {
      return { tools: this.getToolDefinitions() };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (server as any).setRequestHandler('tools/call', async (request: any) => {
      const { name, arguments: args } = request.params;
      return this.executeToolCall(name, args);
    });
  }

  private setupModernResources(server: ModernServer) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (server as any).setRequestHandler('resources/list', async () => {
      return { resources: this.getResourceDefinitions() };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (server as any).setRequestHandler('resources/templates/list', async () => {
      return { resourceTemplates: this.getResourceTemplateDefinitions() };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (server as any).setRequestHandler('resources/read', async (request: any) => {
      return this.executeReadResource(request.params.uri);
    });
  }
}
