# 🍽️ Nuestros Lugares

Una web para registrar y calificar restaurantes y actividades que visitamos juntas.

---

## 📋 Cómo configurar todo (paso a paso)

### Paso 1: Crear la Google Sheet

1. Andá a [Google Sheets](https://sheets.google.com) y creá una hoja nueva
2. Renombrá las 3 pestañas de abajo así (clic derecho > Cambiar nombre):
   - `Restaurantes`
   - `Actividades`
   - `Config`
3. En la hoja **Config**:
   - Celda `A1` → escribí: `clave`
   - Celda `B1` → escribí la **contraseña que quieran usar** (ej: `amigasfoodtour2026`)
4. En la hoja **Restaurantes**, fila 1:
   - `A1`: id
   - `B1`: nombre
   - `C1`: ubicacion
   - `D1`: estado
   - `E1`: descripcion
   - `F1`: calificacion
   - `G1`: fecha
5. En la hoja **Actividades**, fila 1:
   - `A1`: id
   - `B1`: nombre
   - `C1`: tipo
   - `D1`: ubicacion
   - `E1`: estado
   - `F1`: descripcion
   - `G1`: calificacion
   - `H1`: fecha

### Paso 2: Crear el Google Apps Script

1. Estando en la Google Sheet, andá a **Extensiones → Apps Script**
2. Se abre una nueva pestaña con el editor de código
3. **Borrá todo** el código que aparece
4. Abrí el archivo `google-apps-script.js` de esta carpeta y **copiá todo el contenido**
5. Pegalo en el editor de Apps Script
6. Hacé clic en **💾 Guardar** (o Ctrl+S)

### Paso 3: Publicar el Apps Script como API

1. En Apps Script, hacé clic en **Implementar → Nueva implementación**
2. En "Tipo", seleccioná: **Aplicación web**
3. Configurá:
   - **Descripción**: `API Nuestros Lugares`
   - **Ejecutar como**: `Yo (tu email)`
   - **Quién tiene acceso**: `Cualquier persona`
4. Hacé clic en **Implementar**
5. Te va a pedir permisos → Aceptá todo (es tu propia cuenta)
6. **¡Copiá la URL que te da!** Se ve algo así:
   ```
   https://script.google.com/macros/s/AKfycbx.../exec
   ```

### Paso 4: Conectar el frontend con la API

1. Abrí el archivo `script.js`
2. En la **línea 6**, reemplazá:
   ```js
   const API_URL = 'ACÁ_VA_TU_URL_DE_GOOGLE_APPS_SCRIPT';
   ```
   con la URL que copiaste:
   ```js
   const API_URL = 'https://script.google.com/macros/s/AKfycbx.../exec';
   ```

### Paso 5: Subir a GitHub Pages

1. Creá un repositorio nuevo en GitHub (puede ser privado)
2. Subí estos archivos:
   - `index.html`
   - `style.css`
   - `script.js`
   - ⚠️ **NO subas** `google-apps-script.js` (ese queda solo en tu Google)
3. En el repo, andá a **Settings → Pages**
4. En "Source", seleccioná **Deploy from a branch**
5. Branch: `main`, carpeta: `/ (root)`
6. Hacé clic en **Save**
7. En unos minutos tu web va a estar en: `https://tu-usuario.github.io/tu-repo/`

---

## 🔐 ¿Es segura la contraseña?

**Sí.** La contraseña:
- Se guarda en **Google Sheets** (en la hoja Config), no en el código
- Se valida del lado del **servidor** (Google Apps Script)
- **NO aparece** en el código del frontend que se sube a GitHub
- La sesión se guarda temporalmente en el navegador (se borra al cerrar pestaña)

---

## 🛠️ Si necesitás cambiar la contraseña

Simplemente andá a la Google Sheet → hoja `Config` → celda `B1` → cambiá el valor.

---

## ⚠️ Si actualizás el Apps Script

Cada vez que cambies el código del Apps Script, tenés que hacer una **nueva implementación**:
1. Implementar → Administrar implementaciones
2. Editá la implementación existente → Nueva versión
3. O creá una nueva implementación (y actualizá la URL en `script.js`)

---

## 📁 Archivos

| Archivo | Dónde va | Qué hace |
|---------|----------|----------|
| `index.html` | GitHub | Estructura de la página |
| `style.css` | GitHub | Estilos visuales |
| `script.js` | GitHub | Lógica del frontend |
| `google-apps-script.js` | Google Apps Script | API backend (NO subir a GitHub) |

---

Hecho con ❤️ para dos amigas exploradoras 🗺️
