import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgrespassword@localhost:5432/ecommerce_ventas',
});

const db = drizzle(pool, { schema });

async function seedAdmin() {
  console.log('🌱 Creando usuario administrador inicial...');
  const passwordHash = await bcrypt.hash('admin123', 10);

  await db
    .insert(schema.users)
    .values({
      email: 'admin@ecommerce.com',
      passwordHash,
      name: 'Admin Ventas',
      role: 'admin',
    })
    .onConflictDoNothing();

  console.log('✅ Admin creado: admin@ecommerce.com / admin123');
  await pool.end();
}

seedAdmin().catch((e) => {
  console.error(e);
  process.exit(1);
});
