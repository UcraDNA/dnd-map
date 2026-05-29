# ⚔ DnD Map

Herramienta web para Dungeons & Dragons: mapa con grilla hexagonal interactiva, peligro, karma y notas por hexágono.

## Stack

- **Frontend**: React + Vite + Leaflet.js
- **Backend**: Node.js + Express
- **Datos**: JSON + Markdown (sin base de datos)

---

## Inicio rápido (desarrollo local)

### Requisitos
- Node.js 18+

### 1. Instalar dependencias
```bash
cd server && npm install
cd ../client && npm install
```

### 2. Iniciar ambos servidores
```bash
# Desde la raíz del proyecto
npm install        # instala concurrently
npm run dev        # inicia server (3001) + client (5173)
```

Abrir: **http://localhost:5173**

---

## Con Docker

```bash
docker-compose up --build
```

Abrir: **http://localhost:3001**

---

## Uso

### Subir mapa
1. Pestaña **"Mapa"** en el sidebar
2. Arrastrá o seleccioná una imagen (PNG/JPG/WEBP)
3. El mapa aparece como base en Leaflet

### Configurar grilla hexagonal
1. Pestaña **"Grilla"**
2. Ajustá columnas, filas y tamaño de hexágono
3. Clic en **"Aplicar grilla"**

### Editar un hexágono
1. Clic sobre cualquier hexágono del mapa
2. En el sidebar aparece el panel de edición:
   - **Etiqueta**: nombre del lugar
   - **⚔ Peligro**: valor double 1.0–5.0 (default según posición)
   - **✦ Karma**: valor double positivo o negativo (default 1.0)
   - **Notas**: editor Markdown con vista previa
3. Clic en **"Guardar"**

### Colores de peligro
| Color | Rango | Nivel |
|-------|-------|-------|
| 🟢 Verde | 1.0–1.5 | Seguro |
| 🟡 Amarillo | 1.6–2.5 | Bajo |
| 🟠 Naranja | 2.6–3.5 | Moderado |
| 🔴 Rojo | 3.6–4.5 | Alto |
| 🟣 Púrpura | 4.6–5.0 | Mortal |

---

## Estructura de archivos

```
dnd-map/
├── client/               # React + Vite
│   └── src/
│       ├── App.jsx
│       ├── components/
│       │   ├── HexGrid.jsx    # SVG overlay sobre Leaflet
│       │   ├── HexPanel.jsx   # Editor de hexágono + notas MD
│       │   ├── GridConfig.jsx # Config de grilla
│       │   └── MapUpload.jsx  # Upload de imagen
│       └── hooks/
│           └── useHexagons.js
├── server/               # Node.js + Express
│   ├── index.js
│   ├── routes/
│   │   ├── hexagons.js   # CRUD de hexágonos
│   │   ├── maps.js       # Upload de imagen de mapa
│   │   └── notes.js      # CRUD de notas Markdown
│   └── data/             # Persistencia JSON/MD
│       ├── hexagons/     # Un .json por hexágono
│       ├── maps/         # Imagen subida + meta.json
│       └── notes/        # Un .md por hexágono
├── docker-compose.yml
├── Dockerfile
└── package.json
```

---

## API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/hexagons` | Todos los hexágonos |
| GET | `/api/hexagons/:id` | Hexágono por ID |
| PUT | `/api/hexagons/:id` | Crear/actualizar hexágono |
| GET | `/api/hexagons/config` | Config de grilla |
| PUT | `/api/hexagons/config` | Actualizar config |
| POST | `/api/maps/upload` | Subir imagen |
| GET | `/api/maps/current` | Meta del mapa actual |
| GET | `/api/notes/:hexId` | Nota MD de hexágono |
| PUT | `/api/notes/:hexId` | Guardar nota |
