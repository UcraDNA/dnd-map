# DnD Map — Contexto del proyecto

## ¿Qué es?

Herramienta web self-hosted para Dungeons & Dragons. Permite al dungeon master (Lord, dantebubb@gmail.com) cargar una imagen de mapa del mundo y superponer una grilla hexagonal interactiva. Cada hexágono tiene atributos de peligro y karma, y puede tener notas en formato Markdown asociadas.

## Stack

- **Frontend**: React 18 + Vite, Leaflet.js para el mapa, sin estado global (solo hooks locales)
- **Backend**: Node.js + Express (ESModules, `"type": "module"`), sin base de datos
- **Persistencia**: archivos JSON y `.md` en `server/data/`
- **Dev**: `node --watch` para el server, `vite` para el client con proxy a :3001

## Estructura de archivos

```
dnd-map/
├── client/
│   └── src/
│       ├── App.jsx               # Raíz: inicializa Leaflet, carga mapa, pasa bounds a HexGrid
│       ├── index.css             # Tema oscuro con variables CSS (--bg, --surface, --accent, etc.)
│       ├── components/
│       │   ├── HexGrid.jsx       # Dibuja la grilla hexagonal como L.polygon sobre Leaflet
│       │   ├── HexPanel.jsx      # Panel lateral: edita danger/karma/label/notas de un hex
│       │   ├── GridConfig.jsx    # Panel lateral: configura cols/rows del grid
│       │   └── MapUpload.jsx     # Sube imagen de mapa vía drag & drop o file picker
│       └── hooks/
│           └── useHexagons.js    # Fetch/PUT hexágonos y config desde la API
├── server/
│   ├── index.js                  # Express app, sirve API + static (client/dist en prod)
│   ├── routes/
│   │   ├── hexagons.js           # CRUD hexágonos: GET/PUT /api/hexagons/:id, GET/PUT /config
│   │   ├── maps.js               # Upload imagen: POST /api/maps/upload, GET /api/maps/current
│   │   └── notes.js              # CRUD notas MD: GET/PUT/DELETE /api/notes/:hexId
│   └── data/
│       ├── hexagons/             # Un .json por hexágono modificado + _config.json
│       ├── maps/                 # map.png (imagen subida) + meta.json
│       └── notes/                # Un .md por hexágono con notas
├── CLAUDE.md                     # Este archivo
├── README.md                     # Instrucciones de uso para el usuario
├── Dockerfile
└── docker-compose.yml
```

## Modelo de datos

### Hexágono (`server/data/hexagons/{col}-{row}.json`)
```json
{
  "id": "5-3",
  "danger": 2.5,       // double 1.0–5.0, default calculado por posición
  "karma": -1.0,       // double positivo o negativo, default 1.0
  "label": "Bosque",   // string libre
  "noteFile": null,    // reservado
  "updatedAt": "..."
}
```

Los hexágonos **sin archivo JSON** usan valores default: danger calculado por posición (3.0 en el centro, 5.0 en extremos de filas), karma 1.0.

### Config de grilla (`server/data/hexagons/_config.json`)
```json
{ "cols": 10, "rows": 16, "hexSize": 120 }
```
`hexSize` es ignorado en el frontend actual — el tamaño se calcula automáticamente para cubrir la imagen.

### Mapa (`server/data/maps/meta.json`)
```json
{
  "filename": "map.png",
  "originalName": "...",
  "url": "/maps/map.png",
  "uploadedAt": "..."
}
```

### Notas (`server/data/notes/{col}-{row}.md`)
Markdown libre asociado a cada hexágono. Se edita desde el HexPanel con vista previa.

## Lógica clave del HexGrid

El componente `HexGrid.jsx` dibuja hexágonos **pointy-top** usando `L.polygon` con coordenadas Leaflet (`CRS.Simple`). El mapa usa `CRS.Simple` donde `lat = imgHeight - imgY` y `lng = imgX`.

El tamaño del hex se calcula para cubrir exactamente la imagen:
```js
const sizeByW = imgW / (cols * sqrt(3) + sqrt(3) * 0.5);
const sizeByH = imgH / (rows * 1.5 + 0.5);
const size = Math.min(sizeByW, sizeByH);
```

La grilla empieza en `offX = colW/2, offY = size` (esquina superior izquierda de la imagen). Las filas impares se desplazan `colW/2` a la derecha.

## Colores de peligro

| Rango | Color |
|-------|-------|
| 1.0–1.5 | Verde `#2ecc71` |
| 1.6–2.5 | Amarillo `#f1c40f` |
| 2.6–3.5 | Naranja `#e67e22` |
| 3.6–4.5 | Rojo `#e74c3c` |
| 4.6–5.0 | Púrpura `#8e44ad` |

## API endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/hexagons` | Lista todos los hexágonos con datos guardados |
| GET | `/api/hexagons/:id` | Hexágono por id (`col-row`) |
| PUT | `/api/hexagons/:id` | Crear o actualizar hexágono |
| GET | `/api/hexagons/config` | Config de grilla |
| PUT | `/api/hexagons/config` | Actualizar config de grilla |
| POST | `/api/maps/upload` | Subir imagen de mapa (multipart) |
| GET | `/api/maps/current` | Metadata del mapa actual |
| GET | `/api/notes/:hexId` | Nota Markdown del hexágono |
| PUT | `/api/notes/:hexId` | Guardar nota (`{ content: "..." }`) |
| DELETE | `/api/notes/:hexId` | Borrar nota |

## Cómo correr

```powershell
# Dev (desde raíz)
cd server
npm install
cd ..\client
npm install
cd ..
# En una terminal: node server\index.js
# En otra: cd client && npx vite
# O juntos: npm run dev (usa concurrently)

# Prod
cd client
npm run build
cd ..
node server\index.js
# → http://localhost:3001
```

## Estado actual del mapa

- Grid configurado: 10 columnas × 16 filas
- Hexágonos con datos guardados: 3-9, 4-4, 6-8, 6-9
- Imagen de mapa: map.png (subida por el usuario)

## Notas para futuras sesiones

- El usuario es Lord (DM), el proyecto es para gestionar su campaña de DnD
- Cuando se pide rebuild, hay que parar el servidor primero (Ctrl+C) porque bloquea los archivos de `client/dist/` en Windows
- Los archivos Write desde el sandbox a veces corrompen con null bytes — usar bash `cat >` para archivos grandes
- `hexSize` en `_config.json` está guardado pero el frontend lo ignora y calcula el tamaño automáticamente desde las dimensiones reales de la imagen
