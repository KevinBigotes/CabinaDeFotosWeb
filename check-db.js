'use strict';

/**
 * Script de Inspección de la Base de Datos FotoClub en Render
 */
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL ||
  'postgresql://cabinadefotos_user:6QQBItlWjfLXdfJwOF7yKnbsWnWvpjs0@dpg-dbfoh9gae00c73cpj9b0-a.virginia-postgres.render.com/cabinadefotos';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function inspectDatabase() {
  try {
    console.log('\n======================================================');
    console.log('🔍 ESTADO DE LA BASE DE DATOS EN RENDER');
    console.log('======================================================');

    // 1. Información general
    const dbInfo = await pool.query(`
      SELECT 
        current_database() AS database_name,
        current_user AS user_name,
        pg_size_pretty(pg_database_size(current_database())) AS database_size,
        version() AS pg_version
    `);
    const info = dbInfo.rows[0];
    console.log(`📁 Base de datos : ${info.database_name}`);
    console.log(`👤 Usuario       : ${info.user_name}`);
    console.log(`💾 Tamaño usado  : ${info.database_size}`);
    console.log(`⚙️  Versión       : ${info.pg_version.split(',')[0]}`);

    // 2. Conexiones activas
    console.log('\n------------------------------------------------------');
    console.log('🔌 CONEXIONES ACTIVAS (pg_stat_activity)');
    console.log('------------------------------------------------------');
    const connections = await pool.query(`
      SELECT 
        pid,
        usename,
        client_addr,
        application_name,
        state,
        to_char(backend_start, 'YYYY-MM-DD HH24:MI:SS') AS connected_since,
        COALESCE(query, 'Ninguna') AS current_query
      FROM pg_stat_activity
      WHERE datname = current_database()
      ORDER BY backend_start DESC;
    `);

    console.table(connections.rows.map(c => ({
      PID: c.pid,
      Usuario: c.usename,
      IP_Cliente: c.client_addr || 'Local/Render',
      App: c.application_name || 'Node/Client',
      Estado: c.state,
      Conectado_Desde: c.connected_since
    })));

    // 3. Tablas y cantidad de registros
    console.log('------------------------------------------------------');
    console.log('📋 TABLAS Y REGISTROS ACTUALES');
    console.log('------------------------------------------------------');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    for (const t of tables.rows) {
      const countRes = await pool.query(`SELECT COUNT(*) AS total FROM ${t.table_name}`);
      console.log(` • Tabla: "${t.table_name}" -> ${countRes.rows[0].total} registros`);
    }

    // 4. Últimos usuarios registrados
    const users = await pool.query(`
      SELECT id, name, email, to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as fecha_registro
      FROM users
      ORDER BY created_at DESC
      LIMIT 10;
    `);

    if (users.rows.length > 0) {
      console.log('\n👥 Últimos usuarios registrados:');
      console.table(users.rows);
    } else {
      console.log('\nℹ️ Aún no hay usuarios registrados en la tabla "users".');
    }

    console.log('======================================================\n');

  } catch (error) {
    console.error('❌ Error al inspeccionar la base de datos:', error.message);
  } finally {
    await pool.end();
  }
}

inspectDatabase();
