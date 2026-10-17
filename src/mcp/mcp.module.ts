import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller.js';
import { McpServerService } from './mcp-server.service.js';
import { OAuth2Controller } from './oauth.controller.js';
import { OAuth2Service } from './oauth.service.js';
import { ProductsModule } from '../products/products.module.js';
import { SalesModule } from '../sales/sales.module.js';
import { WarehouseModule } from '../warehouse/warehouse.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    ProductsModule,
    SalesModule,
    WarehouseModule,
    AuthModule,
  ],
  controllers: [
    McpController,
    OAuth2Controller,
  ],
  providers: [
    McpServerService,
    OAuth2Service,
  ],
  exports: [
    McpServerService,
    OAuth2Service,
  ],
})
export class McpModule {}
