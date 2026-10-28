# ✳ FotoClub · Tu Cabina de Fotos Web

> **Cuatro poses. Un recuerdo.**  
> Una cabina de fotos interactiva en la web que te permite capturar momentos inolvidables, personalizarlos con filtros y stickers, y descargar tu tira fotográfica en alta calidad. Cuenta con sistema de usuarios y almacenamiento en la nube con **PostgreSQL** alojado en **Render**.

---

## 📸 Características Principales

* **◎ Cabina de Fotos con Cámara Web:** Toma una secuencia de 4 fotos con un temporizador automático de 3 segundos entre cada pose.
* **📁 Subida desde Dispositivo:** ¿Ya tienes tus fotos favoritas? Puedes seleccionarlas desde tu teléfono o computadora.
* **🎨 Filtros en Tiempo Real:** Original, Escala de Grises, Sepia, Invertir, Contraste alto y Desenfoque.
* **✨ Stickers Interactivos:** Añade emojis y stickers, selecciónalos, cambia su tamaño y arrástralos libremente sobre la tira fotográfica.
* **↓ Exportación en PNG:** Descarga tu tira de fotos lista para imprimir o compartir en redes sociales.
* **🔐 Autenticación Completa:** Inicio de sesión y registro de usuarios con validaciones en tiempo real y persistencia de sesión con JWT.
* **☁️ Base de Datos en Render:** Integración directa con PostgreSQL en la nube para persistencia segura de datos.

---

## 🛠️ Stack Tecnológico

### Frontend
* **HTML5 Semántico** & **CSS3 Nativo** (Variables CSS, Flexbox, CSS Grid, animaciones y diseño responsivo).
* **JavaScript Vanilla (ES6+)**:
  * **Canvas 2D API:** Renderizado y composición de la tira fotográfica y procesamiento de filtros de píxeles.
  * **MediaDevices API (`getUserMedia`):** Conexión y captura en vivo de la cámara web.
  * **HTML5 `<dialog>` API:** Modales accesibles y ligeros.

### Backend & Seguridad
* **Node.js** & **Express:** Servidor API REST y servidor de archivos estáticos.
* **PostgreSQL (Render):** Base de datos relacional para usuarios y tiras.
* **bcryptjs:** Hasheo y salting de contraseñas (máxima seguridad, cero texto plano).
* **jsonwebtoken (JWT):** Gestión y verificación de tokens de sesión digital.
* **pg (node-postgres):** Conexión segura con soporte SSL para bases de datos en la nube.

---

## 📁 Estructura del Proyecto

```text
CabinaDeFotosWeb/
├── index.html          # Estructura principal, cabina, editor y modales
├── styles.css          # Sistema de diseño, variables de color y estilos responsivos
├── app.js              # Lógica de la cabina (cámara, canvas, filtros y stickers)
├── auth.js             # Lógica de cliente para login, registro y validaciones
├── server.js           # Servidor API Express y conexión a PostgreSQL
├── schema.sql          # Definición de tablas y esquemas en PostgreSQL
├── init-db.js          # Script para migrar/crear tablas en Render
├── check-db.js         # Script para inspeccionar conexiones y estado de la BD
├── package.json        # Dependencias y scripts de Node.js
└── .env.example        # Plantilla de variables de entorno
```

---

## 🚀 Instalación y Puesta en Marcha Local

### Prerrequisitos
* [Node.js](https://nodejs.org/) (versión 18 o superior).
* [Git](https://git-scm.com/).

### Pasos

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/tu-usuario/CabinaDeFotosWeb.git
   cd CabinaDeFotosWeb
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno:**
   Copia el archivo `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```
   Configura tu URL de conexión de PostgreSQL y una clave secreta para los tokens:
   ```env
   PORT=3000
   JWT_SECRET=tu_clave_secreta_jwt
   DATABASE_URL=postgresql://usuario:password@host/database
   ```

4. **Inicializar las tablas en la Base de Datos:**
   ```bash
   npm run init-db
   ```

5. **Iniciar la aplicación:**
   ```bash
   npm start
   ```
   Abre tu navegador en [http://localhost:3000](http://localhost:3000).

---

## ⚙️ Comandos Útiles (`npm scripts`)

| Comando | Descripción |
| :--- | :--- |
| `npm start` | Inicia el servidor backend y sirve la aplicación en el puerto configurado. |
| `npm run check-db` | Consulta en vivo el estado de PostgreSQL en Render: conexiones activas, tamaño usado y usuarios registrados. |
| `npm run init-db` | Ejecuta el script `schema.sql` para crear las tablas necesarias en la base de datos. |

---

## 🌐 Despliegue en Producción (Render)

### 1. Base de Datos (PostgreSQL)
1. En el panel de Render, crea una **PostgreSQL Database**.
2. Copia la **Internal Database URL** (para servicios dentro de Render) o la **External Database URL** (para acceso externo).

### 2. Aplicación Web (Web Service)
1. En Render, crea un nuevo **Web Service** conectado a tu repositorio de GitHub.
2. Configura los parámetros de despliegue:
   * **Runtime:** `Node`
   * **Build Command:** `npm install`
   * **Start Command:** `npm start`
3. En la sección **Environment Variables**, añade:
   * `DATABASE_URL`: Tu *Internal Database URL* de Render.
   * `JWT_SECRET`: Una cadena de texto secreta para firmar los tokens.
   * `NODE_ENV`: `production`

---

## 🔒 Privacidad y Seguridad

* **Fotos Locales:** El procesamiento y renderizado de la tira fotográfica se realiza enteramente en el cliente a través de Canvas 2D. Tus fotos temporales no se suben a ningún servidor a menos que decidas guardarlas.
* **Contraseñas Cifradas:** Ninguna contraseña se almacena en texto plano; todas son procesadas con algoritmos de hashing seguro (`bcrypt`).
* **Conexiones Seguras:** Todas las consultas a la base de datos en producción utilizan cifrado SSL forzado.

---

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia [MIT](LICENSE).
