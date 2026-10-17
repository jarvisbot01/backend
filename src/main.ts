import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'https://frontend.josedaniel.online',
  ];

  if (
    process.env.FRONTEND_URL &&
    !allowedOrigins.includes(process.env.FRONTEND_URL)
  ) {
    allowedOrigins.push(process.env.FRONTEND_URL);
  }

  app.enableCors({
    origin: allowedOrigins,
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

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
  await app.listen(port);
  console.log(`🚀 Backend NestJS escuchando en http://localhost:${port}`);
  console.log(
    `📖 Documentación Swagger UI disponible en http://localhost:${port}/docs`,
  );
}

await bootstrap();
