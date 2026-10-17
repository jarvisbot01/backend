import { Injectable, Global, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import fs from 'node:fs';
import path from 'node:path';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from './schema.js';
import { appConfig } from '../config/env.config.js';

export const DRIZZLE = 'DRIZZLE_DATABASE';

@Global()
@Injectable()
export class DrizzleService implements OnModuleInit, OnModuleDestroy {
  public readonly db: NodePgDatabase<typeof schema>;
  private readonly pool: pkg.Pool;

  constructor() {
    const connectionString = appConfig.databaseUrl;

    this.pool = new Pool({
      connectionString,
    });

    this.db = drizzle(this.pool, { schema });
  }

  async onModuleInit() {
    try {
      await this.pool.query('SELECT 1');
      console.log('✅ PostgreSQL connected successfully via Drizzle ORM');

      const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
      if (fs.existsSync(migrationsFolder)) {
        console.log('📦 Aplicando migraciones de base de datos pendientes...');
        await migrate(this.db, { migrationsFolder });
        console.log('✅ Migraciones de Drizzle ORM sincronizadas y aplicadas.');
      }
    } catch (error) {
      console.error('❌ Database connection / migration error:', error);
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
