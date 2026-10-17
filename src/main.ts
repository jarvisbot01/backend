import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { appConfig } from './config/env.config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.enableCors({
    origin: appConfig.corsAllowedOrigins,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  const config = new DocumentBuilder()
    .setTitle('NexusSales Ecommerce API')
    .setDescription(
      'Documentación interactiva de la API y de los microservicios de OpenAPI (Invoicing SDI, Trust Antifraude, Messaging SMS, Utilities PDF, Catálogo, Ventas y Almacén)',
    )
    .setVersion('1.0')
    .addTag('OpenAPI Integrations', 'Servicios de Facturación SDI, Trust y Mensajería')
    .addTag('Auth', 'Autenticación con JWT y Refresh Token HttpOnly')
    .addTag('Products', 'Gestión de productos y categorías')
    .addTag('Sales', 'Ventas, órdenes y métricas de negocio')
    .addTag('Warehouse', 'Control de stock, movimientos de almacén y kardex')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = appConfig.port;
  await app.listen(port);
  console.log(`🚀 Backend NestJS escuchando en http://localhost:${port}`);
  console.log(
    `📖 Documentación Swagger UI disponible en http://localhost:${port}/docs`,
  );
}

await bootstrap();
