'use strict';

/**
 * ====================================================================
 * FotoClub - Módulo de Autenticación (Login y Registro) con Render
 * ====================================================================
 * Gestiona el inicio de sesión y registro de usuarios, validaciones de
 * cliente, ciclo de vida de peticiones HTTP hacia la API en Render y
 * persistencia de sesión local.
 */

// Configuración de la API en Render
// Soporta variables globales, detección de GitHub Pages o servidor propio
const getApiBaseUrl = () => {
  // 1. Prioridad: URL explícita configurada en window.API_URL_RENDER o window.__ENV__
  if (window.API_URL_RENDER) return window.API_URL_RENDER.replace(/\/+$/, '');
  if (window.__ENV__?.API_URL_RENDER) return window.__ENV__.API_URL_RENDER.replace(/\/+$/, '');

  // 2. Si se ejecuta en local (localhost) o servido desde el propio backend en Render
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return ''; // Usa rutas relativas al mismo servidor local
  }

  // 3. Si la página está alojada en Render (Web Service único que sirve el frontend y la API)
  if (window.location.hostname.endsWith('onrender.com')) {
    return ''; // Mismo origen en Render
  }

  // 4. Si está en GitHub Pages (*.github.io) u otro hosting estático externo,
  // debe conectarse a tu Web Service en Render.
  return window.API_URL_RENDER || 'https://cabina-backend.onrender.com';
};
const API_URL_RENDER = getApiBaseUrl();

const AUTH_STORAGE_KEY = 'fotoclub_auth_token';
const USER_STORAGE_KEY = 'fotoclub_user';

// Estado reactivo de autenticación
const authState = {
  mode: 'login', // 'login' | 'register'
  loading: false,
  user: null,
  token: null,
  login: {
    email: '',
    password: '',
    errors: { email: '', password: '' }
  },
  register: {
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    errors: { name: '', email: '', password: '', confirmPassword: '' }
  }
};

// Referencias de elementos del DOM
const authDOM = {
  dialog: document.getElementById('loginDialog'),
  openBtn: document.getElementById('openLogin'),
  closeBtn: document.getElementById('closeLogin'),
  authTitle: document.getElementById('authTitle'),
  authSubtitle: document.getElementById('authSubtitle'),
  formAlert: document.getElementById('loginAlert'),
  tabLogin: document.getElementById('tabLogin'),
  tabRegister: document.getElementById('tabRegister'),
  switchToRegister: document.getElementById('switchToRegister'),
  switchToLogin: document.getElementById('switchToLogin'),

  // Formulario Login
  loginForm: document.getElementById('loginForm'),
  loginEmail: document.getElementById('loginEmail'),
  loginPassword: document.getElementById('loginPassword'),
  emailError: document.getElementById('emailError'),
  passwordError: document.getElementById('passwordError'),
  loginSubmit: document.getElementById('loginSubmit'),
  loginSpinner: document.getElementById('loginSpinner'),
  loginBtnText: document.getElementById('loginBtnText'),

  // Formulario Registro
  registerForm: document.getElementById('registerForm'),
  registerName: document.getElementById('registerName'),
  registerEmail: document.getElementById('registerEmail'),
  registerPassword: document.getElementById('registerPassword'),
  registerConfirmPassword: document.getElementById('registerConfirmPassword'),
  registerNameError: document.getElementById('registerNameError'),
  registerEmailError: document.getElementById('registerEmailError'),
  registerPasswordError: document.getElementById('registerPasswordError'),
  registerConfirmPasswordError: document.getElementById('registerConfirmPasswordError'),
  registerSubmit: document.getElementById('registerSubmit'),
  registerSpinner: document.getElementById('registerSpinner'),
  registerBtnText: document.getElementById('registerBtnText'),

  // Barra de navegación de usuario
  userProfile: document.getElementById('userProfile'),
  userEmailBadge: document.getElementById('userEmailBadge'),
  logoutBtn: document.getElementById('logoutBtn')
};

// Expresión regular estándar para validación de correo electrónico
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Validadores
 */
function validateName(name) {
  const trimmed = name.trim();
  if (!trimmed) return 'Por favor ingresa tu nombre o alias.';
  if (trimmed.length < 2) return 'El nombre debe tener al menos 2 caracteres.';
  return '';
}

function validateEmail(email) {
  const trimmed = email.trim();
  if (!trimmed) return 'Por favor ingresa tu correo electrónico.';
  if (!EMAIL_REGEX.test(trimmed)) return 'Ingresa un formato de correo válido (ej. usuario@dominio.com).';
  return '';
}

function validatePassword(password) {
  if (!password) return 'Por favor ingresa tu contraseña.';
  if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
  return '';
}

function validateConfirmPassword(password, confirmPassword) {
  if (!confirmPassword) return 'Por favor confirma tu contraseña.';
  if (password !== confirmPassword) return 'Las contraseñas no coinciden.';
  return '';
}

/**
 * Control del mensaje de alerta del modal
 * @param {string} message 
 * @param {boolean} isSuccess 
 */
function setFormAlert(message, isSuccess = false) {
  if (!authDOM.formAlert) return;
  if (message) {
    authDOM.formAlert.textContent = message;
    authDOM.formAlert.hidden = false;
    authDOM.formAlert.classList.toggle('success', isSuccess);
  } else {
    authDOM.formAlert.textContent = '';
    authDOM.formAlert.hidden = true;
    authDOM.formAlert.classList.remove('success');
  }
}

/**
 * Alterna entre modo 'login' y 'register'
 * @param {'login' | 'register'} mode 
 */
function setAuthMode(mode) {
  authState.mode = mode;
  setFormAlert('');

  const isLogin = mode === 'login';

  // Actualizar pestañas
  authDOM.tabLogin?.classList.toggle('active', isLogin);
  authDOM.tabLogin?.setAttribute('aria-selected', String(isLogin));
  authDOM.tabRegister?.classList.toggle('active', !isLogin);
  authDOM.tabRegister?.setAttribute('aria-selected', String(!isLogin));

  // Títulos descriptivos
  if (authDOM.authTitle) {
    authDOM.authTitle.textContent = isLogin ? 'Iniciar Sesión' : 'Crear Cuenta';
  }
  if (authDOM.authSubtitle) {
    authDOM.authSubtitle.textContent = isLogin
      ? 'Conecta con tu cuenta para guardar y sincronizar tus recuerdos.'
      : 'Crea tu cuenta gratis para guardar y compartir tus tiras de fotos.';
  }

  // Visibilidad de formularios
  if (authDOM.loginForm) authDOM.loginForm.hidden = !isLogin;
  if (authDOM.registerForm) authDOM.registerForm.hidden = isLogin;

  // Foco accesible
  setTimeout(() => {
    if (isLogin) {
      authDOM.loginEmail?.focus();
    } else {
      authDOM.registerName?.focus();
    }
  }, 40);
}

/**
 * Actualiza la visualización de errores del Login
 */
function updateLoginValidationUI() {
  if (authDOM.emailError && authDOM.loginEmail) {
    authDOM.emailError.textContent = authState.login.errors.email;
    authDOM.loginEmail.setAttribute('aria-invalid', String(Boolean(authState.login.errors.email)));
  }
  if (authDOM.passwordError && authDOM.loginPassword) {
    authDOM.passwordError.textContent = authState.login.errors.password;
    authDOM.loginPassword.setAttribute('aria-invalid', String(Boolean(authState.login.errors.password)));
  }
}

/**
 * Actualiza la visualización de errores del Registro
 */
function updateRegisterValidationUI() {
  const fields = [
    { input: authDOM.registerName, errorEl: authDOM.registerNameError, err: authState.register.errors.name },
    { input: authDOM.registerEmail, errorEl: authDOM.registerEmailError, err: authState.register.errors.email },
    { input: authDOM.registerPassword, errorEl: authDOM.registerPasswordError, err: authState.register.errors.password },
    { input: authDOM.registerConfirmPassword, errorEl: authDOM.registerConfirmPasswordError, err: authState.register.errors.confirmPassword }
  ];

  fields.forEach(({ input, errorEl, err }) => {
    if (input && errorEl) {
      errorEl.textContent = err;
      input.setAttribute('aria-invalid', String(Boolean(err)));
    }
  });
}

/**
 * Control del estado de carga (Loading)
 * @param {boolean} isLoading 
 */
function setLoading(isLoading) {
  authState.loading = isLoading;

  // Controles de Login
  if (authDOM.loginSubmit) authDOM.loginSubmit.disabled = isLoading;
  if (authDOM.loginEmail) authDOM.loginEmail.disabled = isLoading;
  if (authDOM.loginPassword) authDOM.loginPassword.disabled = isLoading;
  if (authDOM.loginSpinner) authDOM.loginSpinner.hidden = !isLoading;
  if (authDOM.loginBtnText) authDOM.loginBtnText.textContent = isLoading ? 'Iniciando sesión…' : 'Iniciar sesión';

  // Controles de Registro
  if (authDOM.registerSubmit) authDOM.registerSubmit.disabled = isLoading;
  if (authDOM.registerName) authDOM.registerName.disabled = isLoading;
  if (authDOM.registerEmail) authDOM.registerEmail.disabled = isLoading;
  if (authDOM.registerPassword) authDOM.registerPassword.disabled = isLoading;
  if (authDOM.registerConfirmPassword) authDOM.registerConfirmPassword.disabled = isLoading;
  if (authDOM.registerSpinner) authDOM.registerSpinner.hidden = !isLoading;
  if (authDOM.registerBtnText) authDOM.registerBtnText.textContent = isLoading ? 'Creando cuenta…' : 'Crear mi cuenta';
}

/**
 * Limpia formularios y errores
 */
function resetForms() {
  authState.login.errors = { email: '', password: '' };
  authState.register.errors = { name: '', email: '', password: '', confirmPassword: '' };
  setFormAlert('');

  authDOM.loginForm?.reset();
  authDOM.registerForm?.reset();
  updateLoginValidationUI();
  updateRegisterValidationUI();
  setLoading(false);
}

function openModal(mode = 'login') {
  if (!authDOM.dialog) return;
  resetForms();
  setAuthMode(mode);
  authDOM.dialog.showModal();
}

function closeModal() {
  if (!authDOM.dialog) return;
  authDOM.dialog.close();
  resetForms();
}

/**
 * Refleja el estado de la sesión en la barra de navegación
 */
function updateAuthNavigation() {
  const isAuthenticated = Boolean(authState.token);

  if (authDOM.openBtn) authDOM.openBtn.hidden = isAuthenticated;

  if (authDOM.userProfile) {
    authDOM.userProfile.hidden = !isAuthenticated;
    if (isAuthenticated && authDOM.userEmailBadge) {
      const display = authState.user?.name || authState.user?.email || 'Usuario';
      authDOM.userEmailBadge.textContent = display;
    }
  }
}

/**
 * Restaura la sesión persistente desde localStorage
 */
function checkAuthSession() {
  try {
    const token = localStorage.getItem(AUTH_STORAGE_KEY);
    const userJson = localStorage.getItem(USER_STORAGE_KEY);
    if (token) {
      authState.token = token;
      authState.user = userJson ? JSON.parse(userJson) : { email: 'Usuario' };
      updateAuthNavigation();
    }
  } catch (error) {
    console.warn('No se pudo restaurar la sesión:', error);
  }
}

/**
 * Cierra la sesión activa
 */
function logout() {
  authState.token = null;
  authState.user = null;
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch (error) {
    console.warn('Error al limpiar sesión:', error);
  }
  updateAuthNavigation();

  if (typeof window.announce === 'function') {
    window.announce('Sesión cerrada correctamente.');
  }
}

/**
 * Envío del formulario de Inicio de Sesión
 * @param {Event} event 
 */
async function handleLoginSubmit(event) {
  event.preventDefault();
  if (authState.loading) return;

  const email = authDOM.loginEmail?.value || '';
  const password = authDOM.loginPassword?.value || '';

  authState.login.errors.email = validateEmail(email);
  authState.login.errors.password = validatePassword(password);
  setFormAlert('');
  updateLoginValidationUI();

  if (authState.login.errors.email || authState.login.errors.password) {
    const firstInvalid = authState.login.errors.email ? authDOM.loginEmail : authDOM.loginPassword;
    firstInvalid?.focus();
    return;
  }

  setLoading(true);

  try {
    const endpoint = `${API_URL_RENDER.replace(/\/+$/, '')}/api/auth/login`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ email: email.trim(), password })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error(data.message || data.error || 'Credenciales inválidas. Revisa tu correo y contraseña.');
      } else if (response.status === 404) {
        throw new Error('Servicio de autenticación no encontrado en el servidor.');
      } else if (response.status >= 500) {
        throw new Error('Error en el servidor de Render. Por favor intenta más tarde.');
      } else {
        throw new Error(data.message || data.error || data.detail || `Error al iniciar sesión (${response.status})`);
      }
    }

    const token = data.token || data.access_token || data.jwt || 'session_active';
    const user = data.user || { email: email.trim() };

    authState.token = token;
    authState.user = user;

    localStorage.setItem(AUTH_STORAGE_KEY, token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));

    updateAuthNavigation();
    closeModal();

    if (typeof window.announce === 'function') {
      window.announce(`¡Bienvenido/a, ${user.name || user.email}! Has iniciado sesión.`);
    }

  } catch (error) {
    console.error('Error durante el login:', error);
    let userMessage = error.message;
    if (error.name === 'TypeError' || error.message.includes('Failed to fetch')) {
      userMessage = 'No se pudo conectar con el servidor en Render. Si el servicio gratuito estaba inactivo, puede demorar hasta 50 segundos en reactivarse.';
    }
    setFormAlert(userMessage);
  } finally {
    setLoading(false);
  }
}

/**
 * Envío del formulario de Registro de Usuario
 * @param {Event} event 
 */
async function handleRegisterSubmit(event) {
  event.preventDefault();
  if (authState.loading) return;

  const name = authDOM.registerName?.value || '';
  const email = authDOM.registerEmail?.value || '';
  const password = authDOM.registerPassword?.value || '';
  const confirmPassword = authDOM.registerConfirmPassword?.value || '';

  // Validaciones de cliente
  authState.register.errors.name = validateName(name);
  authState.register.errors.email = validateEmail(email);
  authState.register.errors.password = validatePassword(password);
  authState.register.errors.confirmPassword = validateConfirmPassword(password, confirmPassword);

  setFormAlert('');
  updateRegisterValidationUI();

  // Detener si hay errores
  if (
    authState.register.errors.name ||
    authState.register.errors.email ||
    authState.register.errors.password ||
    authState.register.errors.confirmPassword
  ) {
    const firstInvalid = authState.register.errors.name ? authDOM.registerName
      : authState.register.errors.email ? authDOM.registerEmail
      : authState.register.errors.password ? authDOM.registerPassword
      : authDOM.registerConfirmPassword;
    firstInvalid?.focus();
    return;
  }

  setLoading(true);

  try {
    const endpoint = `${API_URL_RENDER.replace(/\/+$/, '')}/api/auth/register`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        password
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 409) {
        throw new Error(data.message || 'Este correo electrónico ya está registrado.');
      } else if (response.status === 400) {
        throw new Error(data.message || data.error || 'Datos de registro incompletos o inválidos.');
      } else if (response.status === 404) {
        throw new Error('Servicio de backend no encontrado (Error 404). Si estás en GitHub Pages, asegúrate de haber desplegado el Web Service en Render y configurar su URL.');
      } else if (response.status >= 500) {
        throw new Error('Error en el servidor de Render al registrar el usuario.');
      } else {
        throw new Error(data.message || data.error || `Error al crear cuenta (${response.status})`);
      }
    }

    // Si la API retorna directamente un token, iniciamos sesión automáticamente
    const token = data.token || data.access_token || data.jwt;
    const user = data.user || { name: name.trim(), email: email.trim() };

    if (token) {
      authState.token = token;
      authState.user = user;
      localStorage.setItem(AUTH_STORAGE_KEY, token);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      updateAuthNavigation();
      closeModal();
      if (typeof window.announce === 'function') {
        window.announce(`¡Cuenta creada con éxito! Bienvenido/a, ${user.name || user.email}.`);
      }
    } else {
      // Si el backend requiere que el usuario inicie sesión manualmente:
      setAuthMode('login');
      if (authDOM.loginEmail) authDOM.loginEmail.value = email.trim();
      if (authDOM.loginPassword) authDOM.loginPassword.value = '';
      setFormAlert('¡Cuenta creada con éxito! Ingresa tu contraseña para iniciar sesión.', true);
      authDOM.loginPassword?.focus();
    }

  } catch (error) {
    console.error('Error durante el registro:', error);
    let userMessage = error.message;
    if (error.name === 'TypeError' || error.message.includes('Failed to fetch')) {
      userMessage = 'No se pudo conectar con el servidor en Render. Revisa tu conexión o espera a que el servidor despierte.';
    }
    setFormAlert(userMessage);
  } finally {
    setLoading(false);
  }
}

/**
 * Inicialización de escuchadores de eventos
 */
function initAuth() {
  // Apertura y cierre del modal
  authDOM.openBtn?.addEventListener('click', () => openModal('login'));
  authDOM.closeBtn?.addEventListener('click', closeModal);

  if (authDOM.dialog) {
    authDOM.dialog.addEventListener('cancel', event => {
      event.preventDefault();
      closeModal();
    });
    authDOM.dialog.addEventListener('click', event => {
      if (event.target === authDOM.dialog) closeModal();
    });
  }

  // Cambio de pestañas y enlaces de alternancia
  authDOM.tabLogin?.addEventListener('click', () => setAuthMode('login'));
  authDOM.tabRegister?.addEventListener('click', () => setAuthMode('register'));
  authDOM.switchToRegister?.addEventListener('click', () => setAuthMode('register'));
  authDOM.switchToLogin?.addEventListener('click', () => setAuthMode('login'));

  // Envíos de formulario
  authDOM.loginForm?.addEventListener('submit', handleLoginSubmit);
  authDOM.registerForm?.addEventListener('submit', handleRegisterSubmit);

  // Validación reactiva en tiempo real al escribir
  authDOM.loginEmail?.addEventListener('input', () => {
    if (authState.login.errors.email) {
      authState.login.errors.email = validateEmail(authDOM.loginEmail.value);
      updateLoginValidationUI();
    }
  });

  authDOM.loginPassword?.addEventListener('input', () => {
    if (authState.login.errors.password) {
      authState.login.errors.password = validatePassword(authDOM.loginPassword.value);
      updateLoginValidationUI();
    }
  });

  authDOM.registerName?.addEventListener('input', () => {
    if (authState.register.errors.name) {
      authState.register.errors.name = validateName(authDOM.registerName.value);
      updateRegisterValidationUI();
    }
  });

  authDOM.registerEmail?.addEventListener('input', () => {
    if (authState.register.errors.email) {
      authState.register.errors.email = validateEmail(authDOM.registerEmail.value);
      updateRegisterValidationUI();
    }
  });

  authDOM.registerPassword?.addEventListener('input', () => {
    if (authState.register.errors.password) {
      authState.register.errors.password = validatePassword(authDOM.registerPassword.value);
      updateRegisterValidationUI();
    }
    if (authState.register.errors.confirmPassword && authDOM.registerConfirmPassword?.value) {
      authState.register.errors.confirmPassword = validateConfirmPassword(
        authDOM.registerPassword.value,
        authDOM.registerConfirmPassword.value
      );
      updateRegisterValidationUI();
    }
  });

  authDOM.registerConfirmPassword?.addEventListener('input', () => {
    if (authState.register.errors.confirmPassword) {
      authState.register.errors.confirmPassword = validateConfirmPassword(
        authDOM.registerPassword?.value || '',
        authDOM.registerConfirmPassword.value
      );
      updateRegisterValidationUI();
    }
  });

  // Cierre de sesión
  authDOM.logoutBtn?.addEventListener('click', logout);

  // Restaurar sesión activa
  checkAuthSession();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuth);
} else {
  initAuth();
}

// API pública
window.FotoClubAuth = {
  open: openModal,
  close: closeModal,
  setMode: setAuthMode,
  logout,
  getState: () => ({ ...authState })
};
