// ============================================
//  🍽️ NUESTROS LUGARES - Frontend
// ============================================

// ⚠️ IMPORTANTE: Reemplazá esta URL con la de tu Google Apps Script
const API_URL = 'https://script.google.com/macros/s/AKfycbwP9k8-u6DoWMhRjHtyIrwTpyGtgn_513YQLzJqA2l_jYc4Mo4SqzXU3SF6Krm1yp2t/exec';

// ============ ESTADO ============

let state = {
  clave: '',
  tabActual: 'restaurantes',
  filtroActual: 'todos',
  restaurantes: [],
  actividades: [],
  deleteTarget: null
};

// ============ ELEMENTOS DOM ============

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const loginScreen = $('#login-screen');
const app = $('#app');
const loginForm = $('#login-form');
const passwordInput = $('#password-input');
const loginError = $('#login-error');
const itemsList = $('#items-list');
const emptyState = $('#empty-state');
const loading = $('#loading');

// ============ INICIALIZACIÓN ============

document.addEventListener('DOMContentLoaded', () => {
  // Verificar si hay sesión guardada
  const savedKey = sessionStorage.getItem('nuestros_lugares_key');
  if (savedKey) {
    state.clave = savedKey;
    mostrarApp();
    cargarDatos();
  }

  initEventListeners();
});

function initEventListeners() {
  // Login
  loginForm.addEventListener('submit', handleLogin);

  // Logout
  $('#btn-logout').addEventListener('click', handleLogout);

  // Tabs
  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => cambiarTab(tab.dataset.tab));
  });

  // Filtros
  $$('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => cambiarFiltro(btn.dataset.filter));
  });

  // FAB
  $('#btn-add').addEventListener('click', abrirModalNuevo);

  // Empty state add button
  const btnEmptyAdd = $('#btn-empty-add');
  if (btnEmptyAdd) btnEmptyAdd.addEventListener('click', abrirModalNuevo);

  // Cerrar modales
  $$('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => cerrarModal(btn.dataset.close));
  });

  // Forms
  $('#form-restaurante').addEventListener('submit', handleGuardarRestaurante);
  $('#form-actividad').addEventListener('submit', handleGuardarActividad);

  // Toggle detalles visitado
  $('#rest-estado').addEventListener('change', (e) => {
    toggleDetalles('rest', e.target.value);
  });
  $('#act-estado').addEventListener('change', (e) => {
    toggleDetalles('act', e.target.value);
  });

  // Ratings
  initRatings('rest-rating-alex');
  initRatings('rest-rating-vane');
  initRatings('act-rating-alex');
  initRatings('act-rating-vane');

  // Confirmar eliminar
  $('#btn-confirm-delete').addEventListener('click', handleConfirmDelete);

  // Ruleta
  $('#btn-ruleta').addEventListener('click', abrirRuleta);
  $('#btn-girar').addEventListener('click', girarRuleta);

  // Cerrar modal al hacer clic fuera
  $$('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.hidden = true;
    });
  });
}

// ============ AUTENTICACIÓN ============

async function handleLogin(e) {
  e.preventDefault();
  const clave = passwordInput.value.trim();
  if (!clave) return;

  const submitBtn = loginForm.querySelector('button[type="submit"]');
  submitBtn.innerHTML = '<span>Verificando...</span>';
  submitBtn.disabled = true;

  try {
    const result = await apiCall('login', { clave });
    if (result.success) {
      state.clave = clave;
      sessionStorage.setItem('nuestros_lugares_key', clave);
      loginError.hidden = true;
      mostrarApp();
      cargarDatos();
    } else {
      loginError.hidden = false;
      passwordInput.value = '';
      passwordInput.focus();
    }
  } catch (err) {
    loginError.textContent = 'Error de conexión';
    loginError.hidden = false;
  }

  submitBtn.innerHTML = '<span>Descubrir</span><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
  submitBtn.disabled = false;
}

function handleLogout() {
  state.clave = '';
  sessionStorage.removeItem('nuestros_lugares_key');
  app.hidden = true;
  loginScreen.hidden = false;
  passwordInput.value = '';
}

function mostrarApp() {
  loginScreen.hidden = true;
  app.hidden = false;
}

// ============ API ============

async function apiCall(action, data = {}) {
  const payload = {
    action,
    clave: data.clave || state.clave,
    ...data
  };

  // Google Apps Script redirige a googleusercontent.com
  // Usamos un <script> JSONP para evitar problemas de CORS
  return new Promise((resolve) => {
    const callbackName = 'cb_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const params = encodeURIComponent(JSON.stringify(payload));
    const url = `${API_URL}?data=${params}&callback=${callbackName}`;

    // Timeout por si falla
    const timeout = setTimeout(() => {
      cleanup();
      console.error('API timeout');
      resolve({ success: false, error: 'Timeout - intentá de nuevo' });
    }, 15000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      const s = document.getElementById(callbackName);
      if (s) s.remove();
    }

    // Callback global que Google Apps Script va a llamar
    window[callbackName] = function(result) {
      cleanup();
      resolve(result);
    };

    const script = document.createElement('script');
    script.id = callbackName;
    script.src = url;
    script.onerror = function() {
      cleanup();
      resolve({ success: false, error: 'Error de conexión' });
    };
    document.body.appendChild(script);
  });
}

// ============ DATOS ============

async function cargarDatos() {
  mostrarLoading(true);

  try {
    const [restResult, actResult] = await Promise.all([
      apiCall('obtener', { tipo: 'restaurantes' }),
      apiCall('obtener', { tipo: 'actividades' })
    ]);

    if (restResult.success) state.restaurantes = (restResult.items || []).map(normalizeItem);
    if (actResult.success) state.actividades = (actResult.items || []).map(normalizeItem);

    renderItems();
  } catch (err) {
    toast('Error al cargar datos 😵');
  }

  mostrarLoading(false);
}

// ============ NORMALIZAR DATOS ============

function normalizeItem(item) {
  // Normalizar estado: aceptar variaciones como 'Pendiente', 'PENDIENTE', 'por visitar', etc.
  if (item.estado) {
    const est = item.estado.toLowerCase().trim();
    if (est === 'visitado' || est === 'realizada' || est === 'realizado' || est === 'hecho') {
      item.estado = 'visitado';
    } else {
      item.estado = 'pendiente';
    }
  } else {
    item.estado = 'pendiente';
  }
  // Asegurar calificaciones como número
  item.calificacionAlex = parseInt(item.calificacionAlex || item.calificacion_alex) || 0;
  item.calificacionVane = parseInt(item.calificacionVane || item.calificacion_vane) || 0;
  // Compatibilidad: si solo hay calificacion antigua, usarla para ambos
  if (!item.calificacionAlex && !item.calificacionVane && item.calificacion) {
    item.calificacionAlex = parseInt(item.calificacion) || 0;
    item.calificacionVane = parseInt(item.calificacion) || 0;
  }
  return item;
}

// ============ TABS Y FILTROS ============

function cambiarTab(tab) {
  state.tabActual = tab;
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  renderItems();
}

function cambiarFiltro(filtro) {
  state.filtroActual = filtro;
  $$('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === filtro));
  renderItems();
}

// ============ RENDERIZADO ============

function renderItems() {
  const items = state.tabActual === 'restaurantes' ? state.restaurantes : state.actividades;
  
  // Filtrar
  let filtered = items;
  if (state.filtroActual !== 'todos') {
    filtered = items.filter(i => i.estado === state.filtroActual);
  }

  // Update counter
  updateCounter(items, filtered);

  if (filtered.length === 0) {
    itemsList.innerHTML = '';
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  // Ordenar: visitados al final, pendientes primero
  filtered.sort((a, b) => {
    if (a.estado === 'pendiente' && b.estado === 'visitado') return -1;
    if (a.estado === 'visitado' && b.estado === 'pendiente') return 1;
    return 0;
  });

  if (state.tabActual === 'restaurantes') {
    itemsList.innerHTML = filtered.map(renderRestauranteCard).join('');
  } else {
    itemsList.innerHTML = filtered.map(renderActividadCard).join('');
  }

  // Event listeners para botones de cada card
  $$('.card-btn-edit').forEach(btn => {
    btn.addEventListener('click', () => editarItem(btn.dataset.id, btn.dataset.type));
  });
  $$('.card-btn-delete').forEach(btn => {
    btn.addEventListener('click', () => confirmarEliminar(btn.dataset.id));
  });
}

function renderRestauranteCard(item) {
  const estrellasAlex = renderStars(item.calificacionAlex);
  const estrellasVane = renderStars(item.calificacionVane);
  const badge = item.estado === 'visitado'
    ? '<span class="card-badge badge-visitado">Visitado</span>'
    : '<span class="card-badge badge-pendiente">Por visitar</span>';

  const claseBadge = renderClaseBadge(item.clase);

  return `
    <div class="item-card ${item.estado}">
      <div class="card-top">
        <span class="card-name">${escapeHtml(item.nombre)}</span>
        <div class="card-badges">
          ${claseBadge}
          ${badge}
        </div>
      </div>
      ${item.ubicacion ? `<div class="card-location"><span class="loc-icon"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg></span>${escapeHtml(item.ubicacion)}</div>` : ''}
      ${item.estado === 'visitado' ? `
        <div class="card-dual-rating">
          <div class="card-rating-person">
            <span class="rating-label">Alex</span>
            <div class="card-rating">${estrellasAlex}</div>
          </div>
          <div class="card-rating-person">
            <span class="rating-label">Vane</span>
            <div class="card-rating">${estrellasVane}</div>
          </div>
        </div>
        ${item.descripcion ? `<div class="card-description">${escapeHtml(item.descripcion)}</div>` : ''}
      ` : ''}
      <div class="card-actions">
        <button class="card-btn card-btn-edit" data-id="${item.id}" data-type="restaurantes">
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Editar
        </button>
        <button class="card-btn card-btn-delete" data-id="${item.id}">
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          Eliminar
        </button>
      </div>
    </div>
  `;
}

function renderActividadCard(item) {
  const estrellasAlex = renderStars(item.calificacionAlex);
  const estrellasVane = renderStars(item.calificacionVane);
  const badge = item.estado === 'visitado'
    ? '<span class="card-badge badge-visitado">Realizada</span>'
    : '<span class="card-badge badge-pendiente">Pendiente</span>';

  const claseBadge = renderClaseBadge(item.clase);

  return `
    <div class="item-card ${item.estado}">
      <div class="card-top">
        <span class="card-name">${escapeHtml(item.nombre)}</span>
        <div class="card-badges">
          ${claseBadge}
          ${badge}
        </div>
      </div>
      ${item.tipo ? `<span class="card-type">${escapeHtml(item.tipo)}</span>` : ''}
      ${item.ubicacion ? `<div class="card-location"><span class="loc-icon"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg></span>${escapeHtml(item.ubicacion)}</div>` : ''}
      ${item.estado === 'visitado' ? `
        <div class="card-dual-rating">
          <div class="card-rating-person">
            <span class="rating-label">Alex</span>
            <div class="card-rating">${estrellasAlex}</div>
          </div>
          <div class="card-rating-person">
            <span class="rating-label">Vane</span>
            <div class="card-rating">${estrellasVane}</div>
          </div>
        </div>
        ${item.descripcion ? `<div class="card-description">${escapeHtml(item.descripcion)}</div>` : ''}
      ` : ''}
      <div class="card-actions">
        <button class="card-btn card-btn-edit" data-id="${item.id}" data-type="actividades">
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Editar
        </button>
        <button class="card-btn card-btn-delete" data-id="${item.id}">
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          Eliminar
        </button>
      </div>
    </div>
  `;
}

function renderStars(rating) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `<span class="star ${i <= rating ? 'filled' : ''}">★</span>`;
  }
  return html;
}

function renderClaseBadge(clase) {
  if (!clase) return '';
  const info = {
    'C': { label: 'Clase C', range: 'S/50–150', icon: '💰' },
    'B': { label: 'Clase B', range: 'S/150–300', icon: '💰💰' },
    'A': { label: 'Clase A', range: 'S/300–600', icon: '💰💰💰' },
    'S': { label: 'Clase S', range: 'S/600+', icon: '👑' }
  };
  const c = info[clase] || info['C'];
  return `<span class="card-badge badge-clase badge-clase-${clase.toLowerCase()}" title="${c.range}">${c.icon} ${c.label}</span>`;
}

// ============ MODALES ============

function abrirModalNuevo() {
  if (state.tabActual === 'restaurantes') {
    $('#modal-rest-title').textContent = 'Nuevo Restaurante';
    $('#form-restaurante').reset();
    $('#rest-id').value = '';
    setRating('rest-rating-alex', 0);
    setRating('rest-rating-vane', 0);
    toggleDetalles('rest', 'pendiente');
    $('#modal-restaurante').hidden = false;
  } else {
    $('#modal-act-title').textContent = 'Nueva Actividad';
    $('#form-actividad').reset();
    $('#act-id').value = '';
    setRating('act-rating-alex', 0);
    setRating('act-rating-vane', 0);
    toggleDetalles('act', 'pendiente');
    $('#modal-actividad').hidden = false;
  }
}

function editarItem(id, type) {
  const tab = type || state.tabActual;
  // Comparar como string para evitar problemas number vs string
  const idStr = String(id);

  if (tab === 'restaurantes') {
    const item = state.restaurantes.find(r => String(r.id) === idStr);
    if (!item) return;

    $('#modal-rest-title').textContent = 'Editar Restaurante';
    $('#rest-id').value = item.id;
    $('#rest-nombre').value = item.nombre || '';
    $('#rest-ubicacion').value = item.ubicacion || '';
    $('#rest-clase').value = item.clase || '';
    $('#rest-estado').value = item.estado || 'pendiente';
    $('#rest-descripcion').value = item.descripcion || '';
    setRating('rest-rating-alex', item.calificacionAlex || 0);
    setRating('rest-rating-vane', item.calificacionVane || 0);
    toggleDetalles('rest', item.estado);
    $('#modal-restaurante').hidden = false;
  } else {
    const item = state.actividades.find(a => String(a.id) === idStr);
    if (!item) return;

    $('#modal-act-title').textContent = 'Editar Actividad';
    $('#act-id').value = item.id;
    $('#act-nombre').value = item.nombre || '';
    $('#act-tipo').value = item.tipo || '🎬 Cine';
    $('#act-ubicacion').value = item.ubicacion || '';
    $('#act-clase').value = item.clase || '';
    $('#act-estado').value = item.estado || 'pendiente';
    $('#act-descripcion').value = item.descripcion || '';
    setRating('act-rating-alex', item.calificacionAlex || 0);
    setRating('act-rating-vane', item.calificacionVane || 0);
    toggleDetalles('act', item.estado);
    $('#modal-actividad').hidden = false;
  }
}

function cerrarModal(modalId) {
  $(`#${modalId}`).hidden = true;
}

function toggleDetalles(prefix, estado) {
  const detalles = $(`#${prefix}-detalles-visitado`);
  if (estado === 'visitado') {
    detalles.style.display = 'block';
  } else {
    detalles.style.display = 'none';
  }
}

// ============ RATINGS ============

function initRatings(containerId) {
  const container = $(`#${containerId}`);
  const stars = container.querySelectorAll('.star');

  stars.forEach(star => {
    star.addEventListener('click', () => {
      setRating(containerId, parseInt(star.dataset.value));
    });

    star.addEventListener('mouseenter', () => {
      const val = parseInt(star.dataset.value);
      stars.forEach(s => {
        s.classList.toggle('active', parseInt(s.dataset.value) <= val);
      });
    });
  });

  container.addEventListener('mouseleave', () => {
    const current = container.dataset.rating || 0;
    stars.forEach(s => {
      s.classList.toggle('active', parseInt(s.dataset.value) <= current);
    });
  });
}

function setRating(containerId, value) {
  const container = $(`#${containerId}`);
  container.dataset.rating = value;
  container.querySelectorAll('.star').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.value) <= value);
  });
}

function getRating(containerId) {
  return parseInt($(`#${containerId}`).dataset.rating) || 0;
}

// ============ GUARDAR ============

async function handleGuardarRestaurante(e) {
  e.preventDefault();

  const id = $('#rest-id').value;
  const item = {
    nombre: $('#rest-nombre').value.trim(),
    ubicacion: $('#rest-ubicacion').value.trim(),
    clase: $('#rest-clase').value,
    estado: $('#rest-estado').value,
    descripcion: $('#rest-descripcion').value.trim(),
    calificacionAlex: getRating('rest-rating-alex'),
    calificacionVane: getRating('rest-rating-vane')
  };

  if (!item.nombre) return;

  const btn = e.target.querySelector('button[type="submit"]');
  btn.textContent = 'Guardando...';
  btn.disabled = true;

  try {
    let result;
    if (id) {
      item.id = id;
      result = await apiCall('actualizar', { tipo: 'restaurantes', item });
    } else {
      result = await apiCall('agregar', { tipo: 'restaurantes', item });
    }

    if (result.success) {
      toast(id ? 'Restaurante actualizado ✅' : 'Restaurante agregado 🎉');
      cerrarModal('modal-restaurante');
      await cargarDatos();
    } else {
      toast('Error: ' + (result.error || 'Algo falló'));
    }
  } catch (err) {
    toast('Error de conexión 😵');
  }

  btn.textContent = 'Guardar 💾';
  btn.disabled = false;
}

async function handleGuardarActividad(e) {
  e.preventDefault();

  const id = $('#act-id').value;
  const item = {
    nombre: $('#act-nombre').value.trim(),
    tipo: $('#act-tipo').value,
    ubicacion: $('#act-ubicacion').value.trim(),
    clase: $('#act-clase').value,
    estado: $('#act-estado').value,
    descripcion: $('#act-descripcion').value.trim(),
    calificacionAlex: getRating('act-rating-alex'),
    calificacionVane: getRating('act-rating-vane')
  };

  if (!item.nombre) return;

  const btn = e.target.querySelector('button[type="submit"]');
  btn.textContent = 'Guardando...';
  btn.disabled = true;

  try {
    let result;
    if (id) {
      item.id = id;
      result = await apiCall('actualizar', { tipo: 'actividades', item });
    } else {
      result = await apiCall('agregar', { tipo: 'actividades', item });
    }

    if (result.success) {
      toast(id ? 'Actividad actualizada ✅' : 'Actividad agregada 🎉');
      cerrarModal('modal-actividad');
      await cargarDatos();
    } else {
      toast('Error: ' + (result.error || 'Algo falló'));
    }
  } catch (err) {
    toast('Error de conexión 😵');
  }

  btn.textContent = 'Guardar 💾';
  btn.disabled = false;
}

// ============ ELIMINAR ============

function confirmarEliminar(id) {
  state.deleteTarget = id;
  $('#modal-delete').hidden = false;
}

async function handleConfirmDelete() {
  const id = state.deleteTarget;
  if (!id) return;

  const btn = $('#btn-confirm-delete');
  btn.textContent = 'Eliminando...';
  btn.disabled = true;

  try {
    const tipo = state.tabActual;
    const result = await apiCall('eliminar', { tipo, id });

    if (result.success) {
      toast('Eliminado 🗑️');
      cerrarModal('modal-delete');
      await cargarDatos();
    } else {
      toast('Error: ' + (result.error || 'No se pudo eliminar'));
    }
  } catch (err) {
    toast('Error de conexión 😵');
  }

  btn.textContent = 'Sí, eliminar 🗑️';
  btn.disabled = false;
  state.deleteTarget = null;
}

// ============ UTILIDADES ============

function mostrarLoading(show) {
  loading.hidden = !show;
  if (show) {
    itemsList.innerHTML = '';
    emptyState.hidden = true;
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function toast(message) {
  // Eliminar toast existente
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);

  setTimeout(() => el.remove(), 3000);
}

function updateCounter(allItems, filteredItems) {
  const el = $('#counter-text');
  if (!el) return;
  const total = allItems.length;
  const visitados = allItems.filter(i => i.estado === 'visitado').length;
  const pendientes = total - visitados;
  const tab = state.tabActual === 'restaurantes' ? 'lugares' : 'actividades';
  
  if (total === 0) {
    el.textContent = '';
    return;
  }

  const showing = filteredItems.length;
  el.textContent = `${showing} ${tab} \u00b7 ${visitados} completados \u00b7 ${pendientes} pendientes`;
}

// ============ RULETA ============

let ruletaGirando = false;
let ruletaAnimId = null;

function abrirRuleta() {
  const pendientes = getPendientesForRuleta();
  const track = $('#ruleta-track');
  const result = $('#ruleta-result');
  const empty = $('#ruleta-empty');
  const btn = $('#btn-girar');
  const selector = document.querySelector('.ruleta-selector');

  // Cancelar animación previa
  if (ruletaAnimId) { cancelAnimationFrame(ruletaAnimId); ruletaAnimId = null; }
  ruletaGirando = false;

  result.hidden = true;
  empty.hidden = true;
  btn.disabled = false;
  btn.querySelector('span').textContent = '\u00a1Girar!';
  if (selector) selector.classList.remove('winner');

  if (pendientes.length === 0) {
    empty.hidden = false;
    btn.disabled = true;
    track.innerHTML = '';
  } else {
    buildRuletaTrack(pendientes, track);
  }

  $('#modal-ruleta').hidden = false;
}

function getPendientesForRuleta() {
  if (state.tabActual === 'restaurantes') {
    return state.restaurantes.filter(r => r.estado === 'pendiente');
  }
  return state.actividades.filter(a => a.estado === 'pendiente');
}

function buildRuletaTrack(pendientes, track) {
  // Crear suficientes copias para llenar la ventana + buffer
  // Ventana = 210px, item = 70px → 3 visibles + 2 buffer = 5 mínimo
  const copies = Math.max(8, Math.ceil(10 / pendientes.length) * pendientes.length);
  let html = '';
  for (let i = 0; i < copies; i++) {
    const r = pendientes[i % pendientes.length];
    html += `<div class="ruleta-item">${escapeHtml(r.nombre)}</div>`;
  }
  track.innerHTML = html;
  // Centrar el primer item
  track.style.transform = `translateY(70px)`;
}

function girarRuleta() {
  if (ruletaGirando) return;

  const pendientes = getPendientesForRuleta();
  if (pendientes.length === 0) return;

  ruletaGirando = true;
  const btn = $('#btn-girar');
  const track = $('#ruleta-track');
  const result = $('#ruleta-result');
  const selector = document.querySelector('.ruleta-selector');

  btn.disabled = true;
  btn.querySelector('span').textContent = 'Girando...';
  result.hidden = true;
  if (selector) selector.classList.remove('winner');

  const ITEM_H = 70;
  const WINDOW_H = 210;
  const centerOffset = (WINDOW_H - ITEM_H) / 2; // 70px

  // Elegir ganador
  const winnerIdx = Math.floor(Math.random() * pendientes.length);
  const winner = pendientes[winnerIdx];

  // Crear un pool circular grande de items
  const poolSize = pendientes.length;
  // Necesitamos suficientes items visibles en el DOM
  const domItems = Math.max(12, poolSize * 3);
  let html = '';
  for (let i = 0; i < domItems; i++) {
    html += `<div class="ruleta-item">${escapeHtml(pendientes[i % poolSize].nombre)}</div>`;
  }
  track.innerHTML = html;

  // Animación con requestAnimationFrame
  // Posición = offset en px (posición lógica, puede crecer infinitamente)
  let pos = 0;
  const cycleH = poolSize * ITEM_H; // Una vuelta completa
  
  // Velocidad: empieza rápida, desacelera
  const totalDuration = 4000 + Math.random() * 1500; // 4-5.5 segundos
  // Distancia total que recorrer: varias vueltas + parar en el ganador
  const fullRotations = 5 + Math.floor(Math.random() * 3); // 5-7 vueltas
  const targetPos = fullRotations * cycleH + winnerIdx * ITEM_H;
  
  const startTime = performance.now();

  function animate(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / totalDuration, 1);
    
    // Easing: rápido al inicio, desacelera gradualmente
    // Usando easeOutQuart para una desaceleración suave
    const eased = 1 - Math.pow(1 - progress, 4);
    
    pos = targetPos * eased;

    // Calcular la posición visual con wrapping circular
    const visualPos = pos % cycleH;
    
    // Actualizar los items del DOM para el scroll circular
    const firstVisibleIdx = Math.floor(visualPos / ITEM_H);
    const offsetInItem = visualPos % ITEM_H;
    
    // Re-llenar el track basado en la posición actual
    const items = track.children;
    for (let i = 0; i < items.length; i++) {
      const dataIdx = (firstVisibleIdx + i) % poolSize;
      items[i].textContent = pendientes[dataIdx].nombre;
      items[i].classList.remove('winner-item');
    }

    // Posicionar el track
    track.style.transform = `translateY(${centerOffset - offsetInItem}px)`;

    if (progress < 1) {
      ruletaAnimId = requestAnimationFrame(animate);
    } else {
      // Terminó — asegurar que el ganador queda centrado
      const finalItems = track.children;
      for (let i = 0; i < finalItems.length; i++) {
        const dataIdx = (firstVisibleIdx + i) % poolSize;
        finalItems[i].textContent = pendientes[dataIdx].nombre;
        if (dataIdx === winnerIdx && i < 3) {
          finalItems[i].classList.add('winner-item');
        }
      }

      ruletaGirando = false;
      ruletaAnimId = null;
      btn.disabled = false;
      btn.querySelector('span').textContent = '\u00a1Girar de nuevo!';

      if (selector) selector.classList.add('winner');

      // Resultado
      $('#ruleta-winner').textContent = winner.nombre;
      $('#ruleta-winner-loc').textContent = winner.ubicacion ? '\ud83d\udccd ' + winner.ubicacion : '';
      const claseInfo = { 'C': 'Clase C \u2022 S/50\u2013150', 'B': 'Clase B \u2022 S/150\u2013300', 'A': 'Clase A \u2022 S/300\u2013600', 'S': 'Clase S \u2022 S/600+' };
      const claseEl = $('#ruleta-winner-clase');
      claseEl.textContent = (winner.clase && claseInfo[winner.clase]) ? '\ud83d\udcb0 ' + claseInfo[winner.clase] : '';
      result.hidden = false;

      lanzarConfetti();
    }
  }

  ruletaAnimId = requestAnimationFrame(animate);
}

function lanzarConfetti() {
  const colors = ['#f0c27f', '#d4587a', '#8db580', '#b478dc', '#e8956a', '#a0d490', '#ff6b9d'];
  const shapes = ['\u2605', '\u2726', '\u2764', '\u2728', '\u25cf', '\u2736', '\u2662'];
  
  for (let i = 0; i < 45; i++) {
    const el = document.createElement('div');
    el.className = 'ruleta-confetti';
    el.textContent = shapes[Math.floor(Math.random() * shapes.length)];
    
    const startX = 40 + Math.random() * 20;
    const startY = 30 + Math.random() * 20;
    el.style.left = startX + 'vw';
    el.style.top = startY + 'vh';
    el.style.fontSize = (8 + Math.random() * 18) + 'px';
    el.style.color = colors[Math.floor(Math.random() * colors.length)];
    
    const angle = Math.random() * Math.PI * 2;
    const distance = 30 + Math.random() * 60;
    const driftX = Math.cos(angle) * distance;
    const driftY = Math.sin(angle) * distance - 20;
    const spinDeg = (Math.random() - 0.5) * 1440;
    
    el.style.setProperty('--drift-x', driftX + 'vw');
    el.style.setProperty('--drift-y', driftY + 'vh');
    el.style.setProperty('--spin', spinDeg + 'deg');
    el.style.animation = `confettiFly ${1.5 + Math.random() * 1.5}s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${Math.random() * 0.3}s forwards`;
    
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }
}
