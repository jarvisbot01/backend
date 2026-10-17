import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseIntPipe,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { OpenApiService } from './openapi.service.js';

@ApiTags('OpenAPI Integrations')
@Controller('api/openapi')
export class OpenApiController {
  constructor(private readonly openApiService: OpenApiService) {}

  @ApiOperation({
    summary: 'Emisión de Factura Electrónica SDI (OpenAPI Invoicing)',
  })
  @ApiParam({ name: 'orderId', description: 'ID de la orden de venta' })
  @Post('invoices/issue/:orderId')
  async issueInvoice(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.openApiService.issueElectronicInvoice(orderId);
  }

  @ApiOperation({
    summary: 'Validación de Reputación y Antifraude (OpenAPI Trust)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        phone: { type: 'string' },
      },
    },
  })
  @Post('trust/verify')
  async verifyTrust(@Body() body: { email: string; phone?: string }) {
    return this.openApiService.verifyTrust(body.email, body.phone);
  }

  @ApiOperation({
    summary: 'Despacho de Alerta o SMS Transaccional (OpenAPI Messaging)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        orderId: { type: 'number' },
        phone: { type: 'string' },
        message: { type: 'string' },
      },
    },
  })
  @Post('messaging/send-sms')
  async sendSms(
    @Body() body: { orderId: number; phone: string; message: string },
  ) {
    return this.openApiService.sendOrderSms(
      body.orderId,
      body.phone,
      body.message,
    );
  }

  @ApiOperation({
    summary: 'Renderizado y Generación de Comprobante PDF (OpenAPI Utilities)',
  })
  @ApiParam({
    name: 'invoiceNumber',
    description: 'Número de factura (ej. FAC-2026-00001)',
  })
  @Get('invoices/:invoiceNumber/pdf')
  async getInvoicePdf(
    @Param('invoiceNumber') invoiceNumber: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const html = await this.openApiService.getInvoiceData(invoiceNumber, req);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
}
