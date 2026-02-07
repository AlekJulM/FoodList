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
  initRatings('rest-rating');
  initRatings('act-rating');

  // Confirmar eliminar
  $('#btn-confirm-delete').addEventListener('click', handleConfirmDelete);

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
  // Asegurar calificacion como número
  item.calificacion = parseInt(item.calificacion) || 0;
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
  const estrellas = renderStars(item.calificacion);
  const badge = item.estado === 'visitado'
    ? '<span class="card-badge badge-visitado">Visitado</span>'
    : '<span class="card-badge badge-pendiente">Por visitar</span>';

  return `
    <div class="item-card ${item.estado}">
      <div class="card-top">
        <span class="card-name">${escapeHtml(item.nombre)}</span>
        ${badge}
      </div>
      ${item.ubicacion ? `<div class="card-location"><span class="loc-icon"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg></span>${escapeHtml(item.ubicacion)}</div>` : ''}
      ${item.estado === 'visitado' ? `
        <div class="card-rating">${estrellas}</div>
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
  const estrellas = renderStars(item.calificacion);
  const badge = item.estado === 'visitado'
    ? '<span class="card-badge badge-visitado">Realizada</span>'
    : '<span class="card-badge badge-pendiente">Pendiente</span>';

  return `
    <div class="item-card ${item.estado}">
      <div class="card-top">
        <span class="card-name">${escapeHtml(item.nombre)}</span>
        ${badge}
      </div>
      ${item.tipo ? `<span class="card-type">${escapeHtml(item.tipo)}</span>` : ''}
      ${item.ubicacion ? `<div class="card-location"><span class="loc-icon"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg></span>${escapeHtml(item.ubicacion)}</div>` : ''}
      ${item.estado === 'visitado' ? `
        <div class="card-rating">${estrellas}</div>
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

// ============ MODALES ============

function abrirModalNuevo() {
  if (state.tabActual === 'restaurantes') {
    $('#modal-rest-title').textContent = 'Nuevo Restaurante';
    $('#form-restaurante').reset();
    $('#rest-id').value = '';
    setRating('rest-rating', 0);
    toggleDetalles('rest', 'pendiente');
    $('#modal-restaurante').hidden = false;
  } else {
    $('#modal-act-title').textContent = 'Nueva Actividad';
    $('#form-actividad').reset();
    $('#act-id').value = '';
    setRating('act-rating', 0);
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
    $('#rest-estado').value = item.estado || 'pendiente';
    $('#rest-descripcion').value = item.descripcion || '';
    setRating('rest-rating', item.calificacion || 0);
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
    $('#act-estado').value = item.estado || 'pendiente';
    $('#act-descripcion').value = item.descripcion || '';
    setRating('act-rating', item.calificacion || 0);
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
    estado: $('#rest-estado').value,
    descripcion: $('#rest-descripcion').value.trim(),
    calificacion: getRating('rest-rating')
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
    estado: $('#act-estado').value,
    descripcion: $('#act-descripcion').value.trim(),
    calificacion: getRating('act-rating')
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
