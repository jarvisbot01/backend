import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DbModule } from './db/db.module.js';
import { ProductsModule } from './products/products.module.js';
import { WarehouseModule } from './warehouse/warehouse.module.js';
import { SalesModule } from './sales/sales.module.js';
import { AuthModule } from './auth/auth.module.js';
import { OpenApiModule } from './openapi/openapi.module.js';
import { McpModule } from './mcp/mcp.module.js';

@Module({
  imports: [
    DbModule,
    ProductsModule,
    WarehouseModule,
    SalesModule,
    AuthModule,
    OpenApiModule,
    McpModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
