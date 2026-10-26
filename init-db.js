'use strict';

/**
 * ====================================================================
 * Script de Inicialización de Tablas en Render PostgreSQL
 * ====================================================================
 * Ejecuta el archivo schema.sql sobre la base de datos de Render.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL ||
  'postgresql://cabinadefotos_user:6QQBItlWjfLXdfJwOF7yKnbsWnWvpjs0@dpg-dbfoh9gae00c73cpj9b0-a.virginia-postgres.render.com/cabinadefotos';

console.log('📡 Conectando a PostgreSQL en Render...');
console.log('🔗 Host objetivo:', connectionString.split('@')[1]?.split('/')[0] || 'Render');

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log('📄 Leyendo schema.sql...');
    await pool.query(sql);

    console.log('✅ ¡Tablas creadas exitosamente en la base de datos de Render!');

    // Verificar las tablas creadas
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('📋 Tablas existentes en la base de datos:');
    tables.rows.forEach(row => console.log(`   - ${row.table_name}`));

  } catch (error) {
    console.error('❌ Error al inicializar las tablas en Render:', error.message);
  } finally {
    await pool.end();
  }
}

runMigration();
