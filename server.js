'use strict';

/**
 * ====================================================================
 * FotoClub - Servidor API Backend en Express + PostgreSQL (Render)
 * ====================================================================
 */

require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fotoclub_jwt_secret_render_key_2026';

// Configuración de la conexión a PostgreSQL en Render
// En Render se usa DATABASE_URL (usualmente la Internal Database URL si están en la misma red)
const connectionString = process.env.DATABASE_URL ||
  'postgresql://cabinadefotos_user:6QQBItlWjfLXdfJwOF7yKnbsWnWvpjs0@dpg-dbfoh9gae00c73cpj9b0-a.virginia-postgres.render.com/cabinadefotos';

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('render.com') || process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false
});

// Middlewares
app.use(cors());
app.use(express.json());

// Servir archivos estáticos del Frontend (HTML, CSS, JS)
app.use(express.static(path.join(__dirname)));

/**
 * Health check y verificación de conexión a la Base de Datos
 */
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS now, current_database() AS db');
    res.json({
      status: 'ok',
      service: 'FotoClub API',
      database: 'connected',
      connectedDb: result.rows[0].db,
      serverTime: result.rows[0].now
    });
  } catch (error) {
    console.error('Error de conexión a la base de datos:', error.message);
    res.status(500).json({
      status: 'error',
      service: 'FotoClub API',
      database: 'disconnected',
      error: error.message
    });
  }
});

/**
 * Endpoint de Registro de Usuario
 * POST /api/auth/register
 */
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;

  // 1. Validaciones básicas en servidor
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Todos los campos (nombre, correo y contraseña) son requeridos.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (password.length < 6) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  try {
    // 2. Verificar si el usuario ya existe
    const existingUser = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: 'Este correo electrónico ya está registrado.' });
    }

    // 3. Hashear la contraseña con bcrypt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 4. Insertar el nuevo usuario en PostgreSQL
    const insertQuery = `
      INSERT INTO users (name, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, name, email, created_at
    `;
    const newUserResult = await pool.query(insertQuery, [name.trim(), normalizedEmail, passwordHash]);
    const user = newUserResult.rows[0];

    // 5. Generar token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'Usuario registrado exitosamente',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Error en /api/auth/register:', error);
    return res.status(500).json({ message: 'Error interno del servidor al crear la cuenta.' });
  }
});

/**
 * Endpoint de Inicio de Sesión
 * POST /api/auth/login
 */
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Por favor ingresa tu correo y contraseña.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // 1. Buscar usuario por correo electrónico
    const userResult = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1', [normalizedEmail]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Credenciales inválidas. Revisa tu correo y contraseña.' });
    }

    const user = userResult.rows[0];

    // 2. Comparar el hash de la contraseña
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Credenciales inválidas. Revisa tu correo y contraseña.' });
    }

    // 3. Generar token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      message: 'Inicio de sesión exitoso',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Error en /api/auth/login:', error);
    return res.status(500).json({ message: 'Error interno del servidor al iniciar sesión.' });
  }
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor FotoClub ejecutándose en el puerto ${PORT}`);
  console.log(`🔗 Verificando conexión a Render PostgreSQL...`);
});
