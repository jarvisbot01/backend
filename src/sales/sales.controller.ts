import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { SalesService } from './sales.service.js';
import { CreateOrderDto, CreateOrderSchema } from './dto.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@ApiTags('Sales')
@Controller('api/sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar órdenes y ventas del ecommerce' })
  @ApiQuery({ name: 'limit', required: false, description: 'Límite de órdenes' })
  async findAll(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    return this.salesService.findAll(limitNum);
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Obtener métricas y KPIs globales de ventas' })
  async getMetrics() {
    return this.salesService.getMetrics();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una orden por ID' })
  @ApiParam({ name: 'id', description: 'ID de la orden' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.salesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar una nueva venta u orden con descuento de stock' })
  async create(
    @Body(new ZodValidationPipe(CreateOrderSchema)) dto: CreateOrderDto,
  ) {
    return this.salesService.create(dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Actualizar estado de una orden' })
  @ApiParam({ name: 'id', description: 'ID de la orden' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: string,
  ) {
    return this.salesService.updateStatus(id, status);
  }
}
