-- ====================================================================
-- Script de Creación de Tablas para FotoClub (PostgreSQL en Render)
-- ====================================================================

-- 1. Habilitar extensión criptográfica
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tabla de Usuarios para Login y Registro
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índice para búsquedas rápidas por correo
CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));

-- 3. Tabla para guardar las tiras de fotos de los usuarios (para futuras funciones)
CREATE TABLE IF NOT EXISTS user_strips (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) DEFAULT 'Mi Tira FotoClub',
    filter_applied VARCHAR(50) DEFAULT 'none',
    image_data TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índice de tiras por usuario
CREATE INDEX IF NOT EXISTS idx_strips_user_id ON user_strips(user_id);