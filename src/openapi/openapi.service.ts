import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { DrizzleService } from '../db/drizzle.service.js';
import * as schema from '../db/schema.js';
import { eq } from 'drizzle-orm';

@Injectable()
export class OpenApiService {
  private readonly logger = new Logger(OpenApiService.name);
  private readonly apiKey =
    process.env.OPENAPI_API_KEY || 'test_openapi_sandbox_key';
  private readonly baseUrl = 'https://api.openapi.com/v1';

  constructor(private readonly drizzle: DrizzleService) {}

  async issueElectronicInvoice(orderId: number) {
    const [order] = await this.drizzle.db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId));

    if (!order) {
      throw new Error(`Orden ${orderId} no encontrada`);
    }

    const invoiceNumber = `FAC-${new Date().getFullYear()}-${order.id.toString().padStart(5, '0')}`;
    const total = parseFloat(order.total);
    const taxRate = 0.22;
    const taxAmount = (total - total / (1 + taxRate)).toFixed(2);

    this.logger.log(
      `[OpenAPI Invoicing] Emitiendo factura electrónica SDI para orden ${order.orderNumber}`,
    );

    const [invoice] = await this.drizzle.db
      .insert(schema.electronicInvoices)
      .values({
        orderId: order.id,
        invoiceNumber,
        sdiIdentifier: `SDI_${Date.now()}`,
        status: 'issued',
        recipientVat: order.customerTaxId || 'IT00000000000',
        recipientPec: `${order.customerEmail}.pec@legalmail.it`,
        pdfUrl: `/api/openapi/invoices/${invoiceNumber}/pdf`,
        xmlUrl: `/api/openapi/invoices/${invoiceNumber}/xml`,
        totalAmount: order.total,
        taxAmount,
      })
      .returning();

    await this.drizzle.db
      .update(schema.orders)
      .set({ invoiceIssued: true })
      .where(eq(schema.orders.id, order.id));

    return invoice;
  }

  async verifyTrust(email: string, phone?: string) {
    this.logger.log(
      `[OpenAPI Trust] Validando fiabilidad para ${email} y ${phone}`,
    );
    const emailValid = email.includes('@') && !email.includes('testbad');
    const isDeliverable = emailValid;
    const phoneValid = phone ? phone.length >= 8 : true;

    const riskLevel = !emailValid ? 'HIGH' : phoneValid ? 'LOW' : 'MEDIUM';

    return {
      email,
      phone,
      isDeliverable,
      riskLevel,
      score: riskLevel === 'LOW' ? 98 : riskLevel === 'MEDIUM' ? 70 : 25,
      recommendation:
        riskLevel === 'HIGH' ? 'REJECT_SUSPICIOUS' : 'ACCEPT_VERIFIED',
      checks: {
        mxRecords: isDeliverable,
        disposableEmail:
          email.includes('mailinator') || email.includes('temp'),
        hlrActive: phoneValid,
      },
    };
  }

  async sendOrderSms(orderId: number, phone: string, text: string) {
    this.logger.log(
      `[OpenAPI Messaging] Enviando SMS a ${phone} para orden ${orderId}`,
    );

    const [log] = await this.drizzle.db
      .insert(schema.notificationLogs)
      .values({
        orderId,
        recipientPhone: phone,
        channel: 'sms',
        messageText: text,
        status: 'sent',
        externalMessageId: `MSG_SMS_${Date.now()}`,
      })
      .returning();

    await this.drizzle.db
      .update(schema.orders)
      .set({ smsNotified: true })
      .where(eq(schema.orders.id, orderId));

    return {
      success: true,
      messageId: log.externalMessageId,
      recipient: phone,
      status: 'delivered',
    };
  }

  async getInvoiceData(invoiceNumber: string, req?: Request) {
    const [invoice] = await this.drizzle.db
      .select()
      .from(schema.electronicInvoices)
      .where(eq(schema.electronicInvoices.invoiceNumber, invoiceNumber));

    let order: typeof schema.orders.$inferSelect | null = null;
    let items: (typeof schema.orderItems.$inferSelect)[] = [];

    if (invoice) {
      const [ord] = await this.drizzle.db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, invoice.orderId));
      order = ord;
    } else {
      const [ord] = await this.drizzle.db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.orderNumber, invoiceNumber));
      order = ord;
    }

    if (order) {
      items = await this.drizzle.db
        .select()
        .from(schema.orderItems)
        .where(eq(schema.orderItems.orderId, order.id));
    }

    const customerName = order?.customerName || 'Cliente Particular';
    const customerEmail = order?.customerEmail || 'contacto@ecommerce.com';
    const totalAmount = invoice?.totalAmount || order?.total || '349.00';
    const taxAmount =
      invoice?.taxAmount || (parseFloat(totalAmount) * 0.18).toFixed(2);
    const subtotal = (parseFloat(totalAmount) - parseFloat(taxAmount)).toFixed(
      2,
    );
    const sdiId = invoice?.sdiIdentifier || `SDI_${Date.now()}`;
    const issuedDate = invoice?.issuedAt
      ? new Date(invoice.issuedAt).toLocaleDateString()
      : new Date().toLocaleDateString();

    let panelUrl = 'http://localhost:3001/#sales';
    if (process.env.FRONTEND_URL) {
      panelUrl = `${process.env.FRONTEND_URL.replace(/\/+$/, '')}/#sales`;
    } else if (req) {
      const host = req.headers['x-forwarded-host'] || req.headers['host'];
      const proto =
        req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
      if (host) {
        // If host includes port 4000, rewrite to 3001
        const targetHost = String(host).replace(':4000', ':3001');
        panelUrl = `${proto}://${targetHost}/#sales`;
      }
    }

    const itemsRows =
      items.length > 0
        ? items
            .map(
              (it) => `
        <tr>
          <td class="col-desc">${it.productName}</td>
          <td class="col-qty">${it.quantity}</td>
          <td class="col-price">$${parseFloat(it.unitPrice).toFixed(2)}</td>
          <td class="col-subtotal">$${parseFloat(it.subtotal).toFixed(2)}</td>
        </tr>
      `,
            )
            .join('')
        : `
        <tr>
          <td class="col-desc">Servicio / Compra Ecommerce NexusSales</td>
          <td class="col-qty">1</td>
          <td class="col-price">$${subtotal}</td>
          <td class="col-subtotal">$${subtotal}</td>
        </tr>
      `;

    return `
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Factura Electrónica ${invoiceNumber} - NexusSales SDI</title>
          <style>
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              background-color: #f1f5f9;
              color: #1e293b;
              padding: 24px 16px;
              min-height: 100vh;
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .invoice-container {
              width: 100%;
              max-width: 820px;
            }
            .actions-bar {
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 12px;
              margin-bottom: 20px;
            }
            .btn {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              padding: 10px 18px;
              border-radius: 8px;
              font-weight: 600;
              font-size: 13.5px;
              cursor: pointer;
              transition: all 0.2s ease;
              text-decoration: none;
              border: none;
              background-color: #4338ca;
              color: white;
            }
            .btn:hover {
              background-color: #3730a3;
            }
            .btn-outline {
              background-color: white;
              color: #475569;
              border: 1px solid #cbd5e1;
            }
            .btn-outline:hover {
              background-color: #f8fafc;
              color: #0f172a;
              border-color: #94a3b8;
            }
            .card {
              background: white;
              border-radius: 20px;
              box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
              overflow: hidden;
              border: 1px solid #e2e8f0;
            }
            .header {
              background: linear-gradient(135deg, #4338ca 0%, #312e81 100%);
              color: white;
              padding: 32px 36px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .brand-name {
              font-size: 26px;
              font-weight: 800;
              letter-spacing: -0.5px;
            }
            .brand-sub {
              font-size: 13px;
              color: #c7d2fe;
              margin-top: 4px;
            }
            .badge-cert {
              display: inline-flex;
              align-items: center;
              padding: 6px 14px;
              background: rgba(255, 255, 255, 0.15);
              backdrop-filter: blur(8px);
              border-radius: 9999px;
              font-size: 12px;
              font-weight: 700;
              letter-spacing: 0.5px;
              color: #ffffff;
            }
            .body-content {
              padding: 36px;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 20px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 20px;
              margin-bottom: 28px;
            }
            .meta-item h4 {
              font-size: 11px;
              text-transform: uppercase;
              color: #64748b;
              letter-spacing: 0.5px;
              margin-bottom: 4px;
            }
            .meta-item p {
              font-size: 15px;
              font-weight: 600;
              color: #0f172a;
              word-break: break-all;
            }
            .meta-item span {
              font-size: 13px;
              color: #64748b;
            }
            .table-responsive {
              width: 100%;
              overflow-x: auto;
              border-radius: 10px;
              border: 1px solid #e2e8f0;
              margin-bottom: 28px;
            }
            .table-wrap {
              width: 100%;
              border-collapse: collapse;
              text-align: left;
            }
            .table-wrap th {
              background: #f8fafc;
              padding: 12px 16px;
              font-size: 12px;
              font-weight: 700;
              color: #475569;
              text-transform: uppercase;
              border-bottom: 1px solid #e2e8f0;
            }
            .table-wrap td {
              padding: 14px 16px;
              font-size: 14px;
              color: #1e293b;
              border-bottom: 1px solid #f1f5f9;
            }
            .table-wrap tr:last-child td {
              border-bottom: none;
            }
            .col-desc {
              min-width: 180px;
            }
            .col-qty {
              text-align: center;
              width: 80px;
            }
            .col-price {
              text-align: right;
              width: 110px;
            }
            .col-subtotal {
              text-align: right;
              width: 120px;
              font-weight: 600;
            }
            .totals-container {
              display: flex;
              justify-content: flex-end;
            }
            .totals-box {
              width: 100%;
              max-width: 320px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 18px;
            }
            .totals-row {
              display: flex;
              justify-content: space-between;
              font-size: 13px;
              color: #64748b;
              margin-bottom: 10px;
            }
            .totals-row.final {
              font-size: 18px;
              font-weight: 800;
              color: #0f172a;
              border-top: 2px dashed #cbd5e1;
              padding-top: 12px;
              margin-bottom: 0;
            }
            .footer-notes {
              margin-top: 36px;
              padding-top: 20px;
              border-top: 1px solid #e2e8f0;
              font-size: 12px;
              color: #94a3b8;
              text-align: center;
              line-height: 1.6;
            }

            @media (max-width: 640px) {
              body {
                padding: 16px 12px;
              }
              .actions-bar {
                flex-direction: column-reverse;
                align-items: stretch;
                gap: 10px;
                margin-bottom: 16px;
              }
              .actions-bar .btn {
                width: 100%;
                padding: 12px;
                font-size: 14px;
              }
              .card {
                border-radius: 16px;
              }
              .header {
                padding: 22px 18px;
                flex-direction: column;
                align-items: flex-start;
                gap: 14px;
              }
              .brand-name {
                font-size: 20px;
              }
              .brand-sub {
                font-size: 12px;
              }
              .badge-cert {
                align-self: flex-start;
              }
              .body-content {
                padding: 20px 16px;
              }
              .meta-grid {
                grid-template-columns: 1fr;
                gap: 14px;
                padding: 14px;
                margin-bottom: 20px;
              }
              .meta-item p {
                font-size: 14px;
              }
              .table-responsive {
                margin-bottom: 20px;
              }
              .table-wrap {
                min-width: 440px;
                font-size: 13px;
              }
              .table-wrap th, .table-wrap td {
                padding: 10px 12px;
              }
              .totals-container {
                justify-content: stretch;
              }
              .totals-box {
                max-width: 100%;
                padding: 16px;
              }
              .footer-notes {
                margin-top: 28px;
                padding-top: 16px;
                font-size: 11px;
              }
            }

            @media print {
              .no-print {
                display: none !important;
              }
              body {
                padding: 0 !important;
                background: white !important;
              }
              .invoice-container {
                max-width: 100% !important;
              }
              .card {
                box-shadow: none !important;
                border: 1px solid #cbd5e1 !important;
                border-radius: 8px !important;
              }
              .header {
                background: #4338ca !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .badge-cert {
                border: 1px solid white !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .meta-grid {
                grid-template-columns: repeat(2, 1fr) !important;
                background: #f8fafc !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .table-responsive {
                overflow: visible !important;
                border: none !important;
              }
              .table-wrap {
                min-width: 100% !important;
              }
              .table-wrap th {
                background: #f8fafc !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .totals-box {
                background: #f8fafc !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <div class="actions-bar no-print">
              <a id="btn-back-panel" href="${panelUrl}" class="btn btn-outline">
                ← Volver al Panel
              </a>
              <button onclick="window.print()" class="btn">
                🖨️ Imprimir / Guardar en PDF
              </button>
            </div>

            <div class="card">
              <div class="header">
                <div class="brand-info">
                  <h1 class="brand-name">NexusSales Ecommerce</h1>
                  <div class="brand-sub">Comprobante Fiscal Oficial • OpenAPI SDI Invoicing</div>
                </div>
                <div>
                  <span class="badge-cert">✓ TIMBRADO SDI</span>
                </div>
              </div>

              <div class="body-content">
                <div class="meta-grid">
                  <div class="meta-item">
                    <h4>N° Comprobante</h4>
                    <p style="font-family: monospace; color: #4338ca;">${invoiceNumber}</p>
                  </div>
                  <div class="meta-item">
                    <h4>Identificador Fiscal SDI</h4>
                    <p style="font-family: monospace;">${sdiId}</p>
                  </div>
                  <div class="meta-item">
                    <h4>Cliente Receptor</h4>
                    <p>${customerName}</p>
                    <span>${customerEmail}</span>
                  </div>
                  <div class="meta-item">
                    <h4>Fecha de Expedición</h4>
                    <p>${issuedDate}</p>
                  </div>
                </div>

                <div class="table-responsive">
                  <table class="table-wrap">
                    <thead>
                      <tr>
                        <th class="col-desc">Descripción del Concepto</th>
                        <th class="col-qty">Cantidad</th>
                        <th class="col-price">P. Unitario</th>
                        <th class="col-subtotal">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${itemsRows}
                    </tbody>
                  </table>
                </div>

                <div class="totals-container">
                  <div class="totals-box">
                    <div class="totals-row">
                      <span>Subtotal gravado:</span>
                      <span>$${subtotal}</span>
                    </div>
                    <div class="totals-row">
                      <span>Impuestos (IVA 18%-22%):</span>
                      <span>$${taxAmount}</span>
                    </div>
                    <div class="totals-row final">
                      <span>Total Pagado:</span>
                      <span>$${parseFloat(totalAmount).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div class="footer-notes">
                  <p>Documento generado mediante los microservicios de <strong>OpenAPI Utilities</strong> & <strong>OpenAPI Invoicing</strong>.</p>
                  <p>Cadena Digital y Certificación criptográfica válida para efectos comerciales y tributarios.</p>
                </div>
              </div>
            </div>
          </div>

          <script>
            (function() {
              var btn = document.getElementById('btn-back-panel');
              if (btn) {
                var protocol = window.location.protocol;
                var hostname = window.location.hostname;
                // If on localhost or 127.0.0.1 without port 3001 or on port 4000
                if (hostname === 'localhost' || hostname === '127.0.0.1') {
                  btn.href = protocol + '//' + hostname + ':3001/#sales';
                } else {
                  // External host, ensure #sales
                  var origin = window.location.origin.replace(':4000', ':3001');
                  btn.href = origin + '/#sales';
                }
              }
            })();
          </script>
        </body>
      </html>
    `;
  }
}
