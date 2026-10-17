import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgrespassword@localhost:5432/ecommerce_ventas',
});

const db = drizzle(pool, { schema });

async function seed() {
  console.log('🌱 Seeding database...');

  const insertedCats = await db
    .insert(schema.categories)
    .values([
      { name: 'Electrónica', description: 'Gadgets, computadoras y componentes' },
      { name: 'Ropa & Moda', description: 'Prendas de vestir y calzado de temporada' },
      { name: 'Hogar & Cocina', description: 'Accesorios, muebles y electrodomésticos' },
      { name: 'Accesorios', description: 'Mochilas, relojes y complementos' },
    ])
    .returning();

  const [catElectro, catModa, catHogar, catAcc] = insertedCats;

  const insertedProducts = await db
    .insert(schema.products)
    .values([
      {
        sku: 'ELEC-LAP-001',
        name: 'Laptop Ultra Pro 16"',
        description: '32GB RAM, 1TB SSD, Procesador M3 Max / Intel i9',
        price: '1499.99',
        cost: '1100.00',
        stock: 18,
        minStock: 5,
        categoryId: catElectro.id,
        status: 'active',
      },
      {
        sku: 'ELEC-AUR-002',
        name: 'Auriculares Noise-Cancelling Wireless',
        description: 'Cancelación activa de ruido, 40h de batería, audio Hi-Res',
        price: '189.50',
        cost: '115.00',
        stock: 45,
        minStock: 10,
        categoryId: catElectro.id,
        status: 'active',
      },
      {
        sku: 'ELEC-TEC-003',
        name: 'Teclado Mecánico Custom RGB',
        description: 'Switches lubricados, keycaps PBT, conectividad Bluetooth 5.2 y 2.4G',
        price: '129.00',
        cost: '75.00',
        stock: 3,
        minStock: 8,
        categoryId: catElectro.id,
        status: 'active',
      },
      {
        sku: 'MODA-CHA-001',
        name: 'Chaqueta Bomber Impermeable',
        description: 'Material reciclado, corte moderno slim, resistencia al viento',
        price: '89.90',
        cost: '42.00',
        stock: 25,
        minStock: 5,
        categoryId: catModa.id,
        status: 'active',
      },
      {
        sku: 'MODA-ZAP-002',
        name: 'Zapatillas Urban Runner Pro',
        description: 'Suela ergonómica amortiguada, tejido transpirable',
        price: '115.00',
        cost: '60.00',
        stock: 12,
        minStock: 6,
        categoryId: catModa.id,
        status: 'active',
      },
      {
        sku: 'HOG-CAF-001',
        name: 'Cafetera Espresso Barista Touch',
        description: '15 bares de presión, molinillo integrado y vaporizador de leche',
        price: '349.00',
        cost: '230.00',
        stock: 8,
        minStock: 4,
        categoryId: catHogar.id,
        status: 'active',
      },
      {
        sku: 'ACC-MOC-001',
        name: 'Mochila Antirrobo Tech 25L',
        description: 'Puerto USB de carga, compartimento acolchado para laptop 16"',
        price: '59.99',
        cost: '28.00',
        stock: 50,
        minStock: 15,
        categoryId: catAcc.id,
        status: 'active',
      },
    ])
    .returning();

  for (const prod of insertedProducts) {
    await db.insert(schema.inventoryMovements).values({
      productId: prod.id,
      type: 'IN',
      quantity: prod.stock,
      previousStock: 0,
      newStock: prod.stock,
      reason: 'Carga inicial de inventario',
      reference: 'INV-INIT-001',
    });
  }

  const insertedCustomers = await db
    .insert(schema.customers)
    .values([
      {
        name: 'Carlos Mendoza',
        email: 'carlos.mendoza@email.com',
        phone: '+51 987654321',
        address: 'Av. Las Palmeras 450, Lima',
      },
      {
        name: 'Lucía Fernández',
        email: 'lucia.fernandez@email.com',
        phone: '+51 912345678',
        address: 'Calle Los Pinos 120, Miraflores',
      },
      {
        name: 'Rodrigo Silva',
        email: 'rodrigo.silva@email.com',
        phone: '+51 998877665',
        address: 'Jr. San Martín 880, San Isidro',
      },
    ])
    .returning();

  const [p1, p2, p3, p4] = insertedProducts;
  const [c1, c2, c3] = insertedCustomers;

  const [order1] = await db
    .insert(schema.orders)
    .values({
      orderNumber: 'ORD-2026-001',
      customerId: c1.id,
      customerName: c1.name,
      customerEmail: c1.email,
      total: '1689.49',
      status: 'completed',
      paymentMethod: 'card',
      notes: 'Entrega prioritaria',
    })
    .returning();

  await db.insert(schema.orderItems).values([
    {
      orderId: order1.id,
      productId: p1.id,
      productSku: p1.sku,
      productName: p1.name,
      quantity: 1,
      unitPrice: p1.price,
      subtotal: p1.price,
    },
    {
      orderId: order1.id,
      productId: p2.id,
      productSku: p2.sku,
      productName: p2.name,
      quantity: 1,
      unitPrice: p2.price,
      subtotal: p2.price,
    },
  ]);

  const [order2] = await db
    .insert(schema.orders)
    .values({
      orderNumber: 'ORD-2026-002',
      customerId: c2.id,
      customerName: c2.name,
      customerEmail: c2.email,
      total: '204.90',
      status: 'completed',
      paymentMethod: 'transfer',
      notes: 'Confirmación de pago validada',
    })
    .returning();

  await db.insert(schema.orderItems).values([
    {
      orderId: order2.id,
      productId: p4.id,
      productSku: p4.sku,
      productName: p4.name,
      quantity: 1,
      unitPrice: p4.price,
      subtotal: p4.price,
    },
    {
      orderId: order2.id,
      productId: p3.id,
      productSku: p3.sku,
      productName: p3.name,
      quantity: 1,
      unitPrice: '115.00',
      subtotal: '115.00',
    },
  ]);

  const [order3] = await db
    .insert(schema.orders)
    .values({
      orderNumber: 'ORD-2026-003',
      customerId: c3.id,
      customerName: c3.name,
      customerEmail: c3.email,
      total: '349.00',
      status: 'processing',
      paymentMethod: 'card',
      notes: 'En proceso de preparación en almacén',
    })
    .returning();

  await db.insert(schema.orderItems).values([
    {
      orderId: order3.id,
      productId: insertedProducts[5].id,
      productSku: insertedProducts[5].sku,
      productName: insertedProducts[5].name,
      quantity: 1,
      unitPrice: insertedProducts[5].price,
      subtotal: insertedProducts[5].price,
    },
  ]);

  console.log('✅ Base de datos poblada exitosamente con datos de prueba!');
  await pool.end();
}

seed().catch((err) => {
  console.error('Error seeding database:', err);
  process.exit(1);
});
