import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from './schema.js';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://usuario:postgrespassword@localhost:5432/ecommerce_ventas',
});

const db = drizzle(pool, { schema });

async function seedExpanded() {
  console.log('🚀 Iniciando población extendida de la base de datos (10+ registros por tabla)...');

  // 1. Obtener o insertar categorías
  console.log('📦 Verificando categorías...');
  let allCats = await db.select().from(schema.categories);
  const requiredCatNames = [
    { name: 'Audio Profesional', description: 'Monitores de estudio, micrófonos e interfaces' },
    { name: 'Oficina & Ergonomía', description: 'Sillas ergonómicas, escritorios elevables y soportes' },
    { name: 'Gaming & Periféricos', description: 'Mandos, ratones ultraligeros y pads gaming' },
    { name: 'Smart Home & Domótica', description: 'Aspiradores robot, purificadores y luces IoT' },
  ];

  for (const rc of requiredCatNames) {
    if (!allCats.some((c) => c.name.toLowerCase() === rc.name.toLowerCase())) {
      await db.insert(schema.categories).values(rc);
    }
  }
  allCats = await db.select().from(schema.categories);

  const getCatId = (keyword: string) => {
    const found = allCats.find((c) => c.name.toLowerCase().includes(keyword.toLowerCase()));
    return found ? found.id : allCats[0].id;
  };

  const catAudioId = getCatId('Audio');
  const catErgoId = getCatId('Ergonomía');
  const catGamingId = getCatId('Gaming');
  const catSmartId = getCatId('Smart');
  const catModaId = getCatId('Moda');
  const catElectroId = getCatId('Electrónica');

  // 2. Nuevos Productos (12 productos: incluyendo 3 con bajo stock intencional)
  const existingMon = await db.select().from(schema.products).where(eq(schema.products.sku, 'ELEC-MON-005'));
  if (existingMon.length > 0) {
    console.log('ℹ️ El seed expandido ya ha sido aplicado previamente en esta base de datos.');
    await pool.end();
    return;
  }

  console.log('📦 Insertando 12 productos nuevos con control de inventario...');
  const newProducts = await db
    .insert(schema.products)
    .values([
      // Ítems con BAJO STOCK (Alertas críticas inmediatas para almacén)
      {
        sku: 'ELEC-MON-005',
        name: 'Monitor Curvo UltraWide 34" QHD 165Hz',
        description: 'Panel IPS HDR400, 1ms MPRT, USB-C 90W PD, sRGB 120%',
        price: '489.00',
        cost: '310.00',
        stock: 2,
        minStock: 8,
        categoryId: catGamingId,
        status: 'active',
      },
      {
        sku: 'AUD-MIC-001',
        name: 'Micrófono Condensador Broadcast USB-C',
        description: 'Cápsula cardioide 24-bit/96kHz, filtro pop magnético y brazo articulado',
        price: '139.50',
        cost: '72.00',
        stock: 3,
        minStock: 10,
        categoryId: catAudioId,
        status: 'active',
      },
      {
        sku: 'ELEC-CAM-006',
        name: 'Cámara Web Profesional 4K 60FPS AI',
        description: 'Sensor Sony Starvis, autoenfoque láser, micrófono estéreo beamforming',
        price: '199.90',
        cost: '115.00',
        stock: 4,
        minStock: 12,
        categoryId: catAudioId,
        status: 'active',
      },
      // Ítems con stock regular / balanceado
      {
        sku: 'ERG-SIL-001',
        name: 'Silla Ergonómica Nexus Ergoflex Pro',
        description: 'Malla transpirable 3D, soporte lumbar dinámico autoajustable, reposabrazos 4D',
        price: '299.00',
        cost: '175.00',
        stock: 16,
        minStock: 5,
        categoryId: catErgoId,
        status: 'active',
      },
      {
        sku: 'ERG-ESC-002',
        name: 'Escritorio Elevable Eléctrico Standing Desk 140x70',
        description: 'Doble motor ultrasilencioso, memoria digital 4 alturas, tablero nogal macizo',
        price: '429.00',
        cost: '260.00',
        stock: 9,
        minStock: 4,
        categoryId: catErgoId,
        status: 'active',
      },
      {
        sku: 'GAM-MAN-001',
        name: 'Mando Inalámbrico Pro Wireless Hall Effect',
        description: 'Joysticks de efecto Hall antidesgaste, gatillos analógicos con parada corta',
        price: '79.90',
        cost: '39.00',
        stock: 32,
        minStock: 10,
        categoryId: catGamingId,
        status: 'active',
      },
      {
        sku: 'AUD-BAR-002',
        name: 'Barra de Sonido Dolby Atmos Spatial 5.1',
        description: 'Subwoofer inalámbrico 200W, HDMI eARC, Bluetooth 5.3 y AirPlay 2',
        price: '349.00',
        cost: '210.00',
        stock: 14,
        minStock: 5,
        categoryId: catAudioId,
        status: 'active',
      },
      {
        sku: 'HOG-ASP-002',
        name: 'Robot Aspirador Láser LiDAR LaserSweep X9',
        description: 'Succión 6000Pa, fregado sónico vibratorio, estación de autovaciado 60 días',
        price: '579.00',
        cost: '380.00',
        stock: 8,
        minStock: 4,
        categoryId: catSmartId,
        status: 'active',
      },
      {
        sku: 'HOG-PUR-003',
        name: 'Purificador de Aire Inteligente PureAir HEPA H13',
        description: 'Filtración de 4 capas, sensor láser PM2.5, cobertura 65m², control por app',
        price: '189.00',
        cost: '110.00',
        stock: 22,
        minStock: 8,
        categoryId: catSmartId,
        status: 'active',
      },
      {
        sku: 'ACC-CAR-002',
        name: 'Cargador Rápido GaN 140W Quad-Port USB-C',
        description: 'Tecnología Nitruro de Galio, soporta PD 3.1, carga simultánea laptop + tablet + 2 móviles',
        price: '69.50',
        cost: '32.00',
        stock: 58,
        minStock: 15,
        categoryId: catSmartId,
        status: 'active',
      },
      {
        sku: 'MODA-PAR-003',
        name: 'Parka Térmica Impermeable Arctic Shield',
        description: 'Aislamiento térmico Primaloft, costuras selladas, reflectores nocturnos',
        price: '159.00',
        cost: '78.00',
        stock: 24,
        minStock: 6,
        categoryId: catModaId,
        status: 'active',
      },
      {
        sku: 'ELEC-SSD-007',
        name: 'Unidad SSD NVMe PCIe 4.0 2TB 7400MB/s',
        description: 'Disipador térmico de grafeno, ideal para PS5 y workstations de edición',
        price: '149.90',
        cost: '89.00',
        stock: 42,
        minStock: 12,
        categoryId: catElectroId,
        status: 'active',
      },
    ])
    .returning();

  // 3. Nuevos Clientes (10 clientes verificados)
  console.log('👤 Insertando 10 clientes nuevos...');
  const newCustomers = await db
    .insert(schema.customers)
    .values([
      {
        name: 'Mateo Rossi',
        email: 'mateo.rossi@nexuscorp.it',
        phone: '+39 02 8945 1201',
        address: 'Via Montenapoleone 18, 20121 Milano, MI, Italia',
        taxId: 'IT08923450961',
        isTrustVerified: true,
        trustScore: '0.98',
      },
      {
        name: 'Valentina Morales',
        email: 'valentina.morales@designstudio.pe',
        phone: '+51 981 234 567',
        address: 'Calle Los Robles 340, San Isidro, Lima, Perú',
        taxId: 'PE20601234567',
        isTrustVerified: true,
        trustScore: '0.95',
      },
      {
        name: 'Alessandro Bianchi',
        email: 'alessandro.bianchi@techconsult.it',
        phone: '+39 06 6789 3322',
        address: 'Corso Vittorio Emanuele II 84, 00186 Roma, RM, Italia',
        taxId: 'IT01234560588',
        isTrustVerified: true,
        trustScore: '0.92',
      },
      {
        name: 'Gabriela Silva',
        email: 'gabriela.silva@innovacion.es',
        phone: '+34 91 555 4321',
        address: 'Paseo de la Castellana 110, 28046 Madrid, España',
        taxId: 'ESB87654321',
        isTrustVerified: true,
        trustScore: '0.96',
      },
      {
        name: 'Marco Bellini',
        email: 'marco.bellini@logistica-norte.it',
        phone: '+39 011 234 7788',
        address: 'Via Garibaldi 42, 10122 Torino, TO, Italia',
        taxId: 'IT04567890012',
        isTrustVerified: true,
        trustScore: '0.91',
      },
      {
        name: 'Camila Benítez',
        email: 'camila.benitez@agenciadigital.com',
        phone: '+51 945 678 123',
        address: 'Av. Larco 880 Of. 502, Miraflores, Lima, Perú',
        taxId: 'PE10456789012',
        isTrustVerified: true,
        trustScore: '0.89',
      },
      {
        name: 'Davide Colombo',
        email: 'davide.colombo@fintechgroup.eu',
        phone: '+39 051 445 9900',
        address: 'Via dell Indipendenza 25, 40121 Bologna, BO, Italia',
        taxId: 'IT09876540371',
        isTrustVerified: true,
        trustScore: '0.97',
      },
      {
        name: 'Sofia Alarcón',
        email: 'sofia.alarcon@ecoretail.cl',
        phone: '+56 9 8765 4321',
        address: 'Av. Providencia 1760, Santiago, Chile',
        taxId: 'CL76543210-K',
        isTrustVerified: true,
        trustScore: '0.93',
      },
      {
        name: 'Luca Ferrari',
        email: 'luca.ferrari@automotive-labs.it',
        phone: '+39 059 887 6655',
        address: 'Via Emilia Est 450, 41122 Modena, MO, Italia',
        taxId: 'IT06543210368',
        isTrustVerified: true,
        trustScore: '0.99',
      },
      {
        name: 'Esteban Navarro',
        email: 'esteban.navarro@cloudservices.co',
        phone: '+57 310 987 6543',
        address: 'Carrera 7 # 71-21 Torre B, Bogotá, Colombia',
        taxId: 'CO901234567-1',
        isTrustVerified: true,
        trustScore: '0.94',
      },
    ])
    .returning();

  // 4. Nuevos Pedidos y Órdenes de Venta (11 órdenes distribuidas en el último mes)
  console.log('🛒 Insertando 11 órdenes de venta con ítems asociados...');
  const now = new Date();
  const pastDays = (days: number, hours = 0) => {
    return new Date(now.getTime() - (days * 24 + hours) * 60 * 60 * 1000);
  };

  const orderTemplates = [
    {
      num: 'ORD-2026-004',
      cust: newCustomers[0],
      daysAgo: 25,
      status: 'completed',
      method: 'card',
      items: [
        { prod: newProducts[3], qty: 2 }, // Silla Ergonómica ($299.00 x 2 = $598.00)
        { prod: newProducts[9], qty: 1 }, // Cargador GaN ($69.50)
      ],
      notes: 'Envío express corporativo a oficina Milán',
    },
    {
      num: 'ORD-2026-005',
      cust: newCustomers[1],
      daysAgo: 21,
      status: 'completed',
      method: 'transfer',
      items: [
        { prod: newProducts[4], qty: 1 }, // Standing Desk ($429.00)
        { prod: newProducts[5], qty: 2 }, // Mando Wireless ($79.90 x 2 = $159.80)
      ],
      notes: 'Transferencia bancaria internacional confirmada',
    },
    {
      num: 'ORD-2026-006',
      cust: newCustomers[2],
      daysAgo: 18,
      status: 'completed',
      method: 'card',
      items: [
        { prod: newProducts[0], qty: 1 }, // Monitor Curvo ($489.00)
        { prod: newProducts[1], qty: 1 }, // Micrófono ($139.50)
        { prod: newProducts[2], qty: 1 }, // Cámara 4K ($199.90)
      ],
      notes: 'Pack streamer profesional completo',
    },
    {
      num: 'ORD-2026-007',
      cust: newCustomers[3],
      daysAgo: 14,
      status: 'completed',
      method: 'paypal',
      items: [
        { prod: newProducts[6], qty: 1 }, // Soundbar Atmos ($349.00)
        { prod: newProducts[11], qty: 2 }, // SSD 2TB ($149.90 x 2 = $299.80)
      ],
      notes: 'Pago verificado vía PayPal Express',
    },
    {
      num: 'ORD-2026-008',
      cust: newCustomers[4],
      daysAgo: 11,
      status: 'completed',
      method: 'card',
      items: [
        { prod: newProducts[7], qty: 1 }, // Robot Aspirador ($579.00)
        { prod: newProducts[8], qty: 1 }, // Purificador ($189.00)
      ],
      notes: 'Promoción Hogar Inteligente aplicada',
    },
    {
      num: 'ORD-2026-009',
      cust: newCustomers[5],
      daysAgo: 8,
      status: 'completed',
      method: 'transfer',
      items: [
        { prod: newProducts[10], qty: 2 }, // Parka Térmica ($159.00 x 2 = $318.00)
        { prod: newProducts[9], qty: 2 }, // Cargador GaN ($69.50 x 2 = $139.00)
      ],
      notes: 'Factura B2B requerida con retención',
    },
    {
      num: 'ORD-2026-010',
      cust: newCustomers[6],
      daysAgo: 6,
      status: 'completed',
      method: 'card',
      items: [
        { prod: newProducts[3], qty: 1 }, // Silla ($299.00)
        { prod: newProducts[4], qty: 1 }, // Desk ($429.00)
      ],
      notes: 'Armado en destino programado para viernes',
    },
    {
      num: 'ORD-2026-011',
      cust: newCustomers[7],
      daysAgo: 4,
      status: 'completed',
      method: 'card',
      items: [
        { prod: newProducts[5], qty: 3 }, // Mando Gaming ($79.90 x 3 = $239.70)
        { prod: newProducts[11], qty: 1 }, // SSD 2TB ($149.90)
      ],
      notes: 'Cliente VIP Club Nexus Gaming',
    },
    {
      num: 'ORD-2026-012',
      cust: newCustomers[8],
      daysAgo: 2,
      status: 'processing',
      method: 'transfer',
      items: [
        { prod: newProducts[0], qty: 1 }, // Monitor ($489.00)
        { prod: newProducts[2], qty: 1 }, // Cámara ($199.90)
      ],
      notes: 'En preparación en muelle de expedición 2',
    },
    {
      num: 'ORD-2026-013',
      cust: newCustomers[9],
      daysAgo: 1,
      status: 'completed',
      method: 'card',
      items: [
        { prod: newProducts[7], qty: 1 }, // Robot ($579.00)
      ],
      notes: 'Entrega prioritaria courier Same-Day',
    },
    {
      num: 'ORD-2026-014',
      cust: newCustomers[0],
      daysAgo: 0,
      status: 'processing',
      method: 'card',
      items: [
        { prod: newProducts[1], qty: 2 }, // Micrófono ($139.50 x 2 = $279.00)
        { prod: newProducts[9], qty: 1 }, // Cargador GaN ($69.50)
      ],
      notes: 'Pedido reciente en validación de empaque',
    },
  ];

  const createdOrders: any[] = [];

  for (const tpl of orderTemplates) {
    let orderTotal = 0;
    const itemsData = tpl.items.map((i) => {
      const unit = parseFloat(i.prod.price);
      const sub = unit * i.qty;
      orderTotal += sub;
      return {
        productId: i.prod.id,
        productSku: i.prod.sku,
        productName: i.prod.name,
        quantity: i.qty,
        unitPrice: unit.toFixed(2),
        subtotal: sub.toFixed(2),
      };
    });

    const orderDate = pastDays(tpl.daysAgo, Math.floor(Math.random() * 12));

    const [order] = await db
      .insert(schema.orders)
      .values({
        orderNumber: tpl.num,
        customerId: tpl.cust.id,
        customerName: tpl.cust.name,
        customerEmail: tpl.cust.email,
        customerPhone: tpl.cust.phone,
        customerTaxId: tpl.cust.taxId,
        total: orderTotal.toFixed(2),
        status: tpl.status,
        paymentMethod: tpl.method,
        invoiceIssued: tpl.status === 'completed',
        smsNotified: true,
        notes: tpl.notes,
        createdAt: orderDate,
        updatedAt: orderDate,
      })
      .returning();

    for (const item of itemsData) {
      await db.insert(schema.orderItems).values({
        orderId: order.id,
        productId: item.productId,
        productSku: item.productSku,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        createdAt: orderDate,
      });
    }

    createdOrders.push({ order, itemsData, orderDate, cust: tpl.cust, total: orderTotal });
  }

  // 5. Movimientos de Inventario (IN, OUT, RETURN, SALE)
  console.log('🔄 Insertando 16 movimientos de inventario en Kardex (IN, OUT, RETURN, SALE)...');
  const existingProds = await db.select().from(schema.products);
  const findProd = (sku: string) => existingProds.find((p) => p.sku === sku) || newProducts[0];

  const pTeclado = findProd('ELEC-TEC-003');
  const pChaqueta = findProd('MODA-CHA-001');
  const pZapatillas = findProd('MODA-ZAP-002');

  const inventoryMovementsData = [
    // ENTRADAS (IN)
    {
      productId: newProducts[0].id,
      type: 'IN',
      quantity: 10,
      previousStock: 0,
      newStock: 10,
      reason: 'Recepción lote inicial importación Asia L-902',
      reference: 'INV-LOT-902',
      createdAt: pastDays(28),
    },
    {
      productId: newProducts[3].id,
      type: 'IN',
      quantity: 25,
      previousStock: 0,
      newStock: 25,
      reason: 'Ingreso pallet sillas fábrica europea',
      reference: 'INV-PAL-441',
      createdAt: pastDays(27),
    },
    {
      productId: newProducts[5].id,
      type: 'IN',
      quantity: 40,
      previousStock: 0,
      newStock: 40,
      reason: 'Reposición programada distribuidor GamingTech',
      reference: 'INV-REP-778',
      createdAt: pastDays(24),
    },
    {
      productId: newProducts[7].id,
      type: 'IN',
      quantity: 12,
      previousStock: 0,
      newStock: 12,
      reason: 'Carga lote robot aspirador SmartClean',
      reference: 'INV-LOT-303',
      createdAt: pastDays(20),
    },
    {
      productId: newProducts[9].id,
      type: 'IN',
      quantity: 70,
      previousStock: 0,
      newStock: 70,
      reason: 'Recepción masiva cargadores GaN alta rotación',
      reference: 'INV-LOT-889',
      createdAt: pastDays(15),
    },

    // SALIDAS (OUT)
    {
      productId: newProducts[0].id,
      type: 'OUT',
      quantity: 2,
      previousStock: 10,
      newStock: 8,
      reason: 'Asignación de unidades a Showroom tecnológico principal',
      reference: 'MOV-SHOW-01',
      createdAt: pastDays(22),
    },
    {
      productId: newProducts[4].id,
      type: 'OUT',
      quantity: 1,
      previousStock: 12,
      newStock: 11,
      reason: 'Baja técnica por daño estético en embalaje de transporte',
      reference: 'MOV-DAM-08',
      createdAt: pastDays(16),
    },
    {
      productId: newProducts[8].id,
      type: 'OUT',
      quantity: 2,
      previousStock: 25,
      newStock: 23,
      reason: 'Pruebas de laboratorio y certificación ambiental HEPA',
      reference: 'MOV-QA-104',
      createdAt: pastDays(12),
    },
    {
      productId: pTeclado.id,
      type: 'OUT',
      quantity: 1,
      previousStock: 13,
      newStock: 12,
      reason: 'Demostración en evento gamer presencial',
      reference: 'MOV-EVT-03',
      createdAt: pastDays(7),
    },

    // DEVOLUCIONES (RETURN)
    {
      productId: pChaqueta.id,
      type: 'RETURN',
      quantity: 1,
      previousStock: 24,
      newStock: 25,
      reason: 'Devolución conforme de cliente por cambio de talla (M -> L)',
      reference: 'RMA-RET-201',
      createdAt: pastDays(13),
    },
    {
      productId: pZapatillas.id,
      type: 'RETURN',
      quantity: 1,
      previousStock: 11,
      newStock: 12,
      reason: 'Retorno por garantía comercial revisada y aprobada',
      reference: 'RMA-RET-202',
      createdAt: pastDays(9),
    },
    {
      productId: newProducts[6].id,
      type: 'RETURN',
      quantity: 1,
      previousStock: 15,
      newStock: 16,
      reason: 'Reingreso a inventario: cliente desistió antes de entrega',
      reference: 'RMA-RET-203',
      createdAt: pastDays(5),
    },

    // SALIDAS POR VENTAS (SALE)
    {
      productId: newProducts[3].id,
      type: 'SALE',
      quantity: 2,
      previousStock: 20,
      newStock: 18,
      reason: 'Despacho orden ecommerce ref ORD-2026-004',
      reference: 'ORD-2026-004',
      createdAt: pastDays(25),
    },
    {
      productId: newProducts[0].id,
      type: 'SALE',
      quantity: 1,
      previousStock: 6,
      newStock: 5,
      reason: 'Despacho orden ecommerce ref ORD-2026-006',
      reference: 'ORD-2026-006',
      createdAt: pastDays(18),
    },
    {
      productId: newProducts[7].id,
      type: 'SALE',
      quantity: 1,
      previousStock: 10,
      newStock: 9,
      reason: 'Despacho orden ecommerce ref ORD-2026-008',
      reference: 'ORD-2026-008',
      createdAt: pastDays(11),
    },
    {
      productId: newProducts[5].id,
      type: 'SALE',
      quantity: 3,
      previousStock: 35,
      newStock: 32,
      reason: 'Despacho orden ecommerce ref ORD-2026-011',
      reference: 'ORD-2026-011',
      createdAt: pastDays(4),
    },
  ];

  for (const m of inventoryMovementsData) {
    await db.insert(schema.inventoryMovements).values(m);
  }

  // 6. Facturas Electrónicas (10 facturas vinculadas)
  console.log('🧾 Insertando 10 facturas electrónicas con SDI...');
  const invoiceRecords = createdOrders.slice(0, 10).map((co, idx) => {
    const totalNum = parseFloat(co.order.total);
    const taxNum = totalNum * 0.22; // 22% IVA
    const invSeq = String(idx + 4).padStart(4, '0');
    return {
      orderId: co.order.id,
      invoiceNumber: `INV-2026-${invSeq}`,
      sdiIdentifier: `SDI-IT-884${invSeq}${Math.floor(100 + Math.random() * 900)}`,
      status: 'issued',
      recipientVat: co.cust.taxId || 'IT09876543210',
      recipientPec: `pec.${co.cust.email.split('@')[0]}@legalmail.it`,
      xmlUrl: `https://nexus-sdi.storage.googleapis.com/xml/2026/INV-2026-${invSeq}.xml`,
      pdfUrl: `https://nexus-sdi.storage.googleapis.com/pdf/2026/INV-2026-${invSeq}.pdf`,
      totalAmount: totalNum.toFixed(2),
      taxAmount: taxNum.toFixed(2),
      issuedAt: co.orderDate,
    };
  });

  for (const inv of invoiceRecords) {
    await db.insert(schema.electronicInvoices).values(inv);
  }

  // 7. Notificaciones SMS / WhatsApp (10 registros)
  console.log('📱 Insertando 10 notificaciones electrónicas con confirmación...');
  const notificationRecords = createdOrders.slice(0, 10).map((co, idx) => {
    return {
      orderId: co.order.id,
      recipientPhone: co.cust.phone || '+39 02 8945 1201',
      channel: idx % 2 === 0 ? 'sms' : 'whatsapp',
      messageText: `NexusSales: Su pedido ${co.order.orderNumber} por $${co.order.total} fue confirmado con éxito. Guía de seguimiento: TRK-${co.order.orderNumber}.`,
      status: 'delivered',
      externalMessageId: `TEL-MSG-884${idx}${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: co.orderDate,
    };
  });

  for (const notif of notificationRecords) {
    await db.insert(schema.notificationLogs).values(notif);
  }

  console.log('✅ ¡Población extendida completada con éxito!');
  console.log(`- Categorías sincronizadas`);
  console.log(`- 12 nuevos productos insertados (3 críticos con bajo stock)`);
  console.log(`- 10 nuevos clientes verificados insertados`);
  console.log(`- 11 nuevas órdenes de venta con ítems asociadas`);
  console.log(`- 16 nuevos movimientos Kardex (IN, OUT, RETURN, SALE) insertados`);
  console.log(`- 10 nuevas facturas electrónicas con SDI insertadas`);
  console.log(`- 10 nuevos logs de notificación insertados`);

  await pool.end();
}

seedExpanded().catch((err) => {
  console.error('Error en seed extendido:', err);
  process.exit(1);
});
