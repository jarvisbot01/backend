import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { WarehouseService } from './warehouse.service.js';
import {
  CreateStockAdjustmentDto,
  CreateStockAdjustmentSchema,
} from './dto.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@ApiTags('Warehouse')
@Controller('api/warehouse')
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Métricas generales del almacén, valorización y alertas' })
  async getOverview() {
    return this.warehouseService.getWarehouseOverview();
  }

  @Get('movements')
  @ApiOperation({ summary: 'Historial de movimientos de kardex e inventario' })
  @ApiQuery({ name: 'limit', required: false, description: 'Número de movimientos' })
  async getMovements(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.warehouseService.getMovements(limitNum);
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Alertas de stock bajo por debajo del umbral mínimo' })
  async getAlerts() {
    return this.warehouseService.getLowStockAlerts();
  }

  @Post('adjust')
  @ApiOperation({ summary: 'Registrar ajuste manual de inventario (IN/OUT/RETURN)' })
  async adjustStock(
    @Body(new ZodValidationPipe(CreateStockAdjustmentSchema))
    dto: CreateStockAdjustmentDto,
  ) {
    return this.warehouseService.adjustStock(dto);
  }
}
