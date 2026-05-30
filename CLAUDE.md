# DnD Map — Contexto del proyecto

## ¿Qué es?

Herramienta web self-hosted para Dungeons & Dragons. Permite al dungeon master (Lord, dantebubb@gmail.com) cargar una imagen de mapa del mundo y superponer una grilla hexagonal interactiva. Cada hexágono tiene atributos de peligro y karma, y puede tener notas en formato Markdown asociadas. Soporta sub-mapas por hexágono y navegación por pestañas.

## Stack

- **Frontend**: React 18 + Vite, Leaflet.js para el mapa, sin estado global (solo hooks locales)
- **Backend**: Node.js + Express (ESModules, `"type": "module"`), sin base de datos
- **Persistencia**: archivos JSON y `.md` en `server/data/`
- **Dev**: `node server/index.js` en una terminal, `cd client && npx vite` en otra (proxy a :3001)
- **Prod**: `cd client && npm run build`, luego `node server/index.js` → http://localhost:3001

## Estructura de archivos

```
dnd/
├── client/
│   └── src/
│       ├── main.jsx              # Entry point — monta AppShell (sin React Router)
│       ├── AppShell.jsx          # Gestor de pestañas: main + submapas abiertos
│       ├── App.jsx               # Mapa principal: Leaflet + HexGrid + sidebar
│       ├── index.css             # Tema oscuro con variables CSS
│       ├── components/
│       │   ├── HexGrid.jsx       # Grilla hex/cuadrada como L.polygon sobre Leaflet
│       │   ├── HexPanel.jsx      # Panel lateral: edita hex principal + gestiona sub-mapas
│       │   ├── SubHexPanel.jsx   # Panel lateral para hexágonos dentro de un sub-mapa
│       │   ├── GridConfig.jsx    # Configura cols/rows/gridShape del grid
│       │   ├── MapUpload.jsx     # Sube imagen de mapa (drag & drop o file picker)
│       │   ├── PartyPanel.jsx    # Gestión de party (personajes del grupo)
│       │   ├── CombatPopup.jsx   # Popup flotante de iniciativa/combate
│       │   └── ThemePanel.jsx    # Editor de colores CSS en tiempo real
│       ├── hooks/
│       │   ├── useHexagons.js        # Fetch/PUT hexágonos y config del mapa principal
│       │   └── useSubmapHexagons.js  # Igual pero para sub-mapas
│       └── pages/
│           └── SubMap.jsx        # Vista de un sub-mapa (acepta props hexId/mapId)
├── server/
│   ├── index.js                  # Express app, sirve API + static
│   ├── routes/
│   │   ├── hexagons.js           # CRUD hexágonos + config
│   │   ├── maps.js               # Upload/GET/DELETE imagen de mapa principal
│   │   ├── notes.js              # CRUD notas MD del mapa principal
│   │   ├── submaps.js            # CRUD completo de sub-mapas (hexágonos, notas, config, imagen)
│   │   └── party.js              # CRUD party global
│   └── data/                     # Todos los datos del usuario — NO commitear
│       ├── hexagons/             # {col}-{row}.json + _config.json
│       ├── maps/                 # map.{ext} + meta.json
│       ├── notes/                # {col}-{row}.md
│       ├── submaps/              # {hexId}/{mapId}/ con su propia estructura
│       └── party.json
├── CLAUDE.md
├── README.md
├── Dockerfile
└── docker-compose.yml
```

## Arquitectura de navegación (AppShell)

`main.jsx` monta `AppShell` directamente — **no hay React Router**. AppShell mantiene un array de tabs:

```js
// Cada tab:
{ id: string, type: 'main'|'submap', hexId?, mapId?, name? }
```

- El tab `main` siempre existe y muestra `App.jsx`
- Al abrir un sub-mapa se agrega un tab `submap` y se activa
- Todos los tabs están montados simultáneamente, solo el activo tiene `display: flex` (los demás `display: none`) — esto evita remount/desmount y es más rápido
- La barra de tabs solo aparece cuando hay más de 1 tab abierto

## Modelo de datos

### Hexágono principal (`server/data/hexagons/{col}-{row}.json`)
```json
{
  "id": "5-3",
  "danger": 2.5,
  "karma": -1.0,
  "label": "Bosque",
  "updatedAt": "..."
}
```
Los hexágonos sin archivo usan defaults: danger calculado por posición (3.0 centro, 5.0 extremos), karma 1.0.

### Config de grilla (`server/data/hexagons/_config.json`)
```json
{
  "cols": 10,
  "rows": 16,
  "hexSize": 0,
  "dangerCenter": 3.0,
  "dangerEdge": 5.0,
  "boundsPadding": 0.15,
  "gridShape": "hex"
}
```
`hexSize: 0` significa auto (calculado desde dimensiones de imagen). `gridShape` puede ser `"hex"` o `"square"`.

### Mapa principal (`server/data/maps/meta.json`)
```json
{
  "filename": "map.png",
  "originalName": "...",
  "url": "/maps/map.png",
  "uploadedAt": "..."
}
```
La URL siempre es `/maps/map.{ext}`. En el frontend se agrega `?t=<timestamp>` para evitar caché del browser.

### Sub-mapas (`server/data/submaps/{hexId}/{mapId}/`)
Cada sub-mapa tiene su propia carpeta con:
- `info.json` — `{ mapId, name, hexId, createdAt }`
- `meta.json` — igual que el mapa principal pero para la imagen del sub-mapa
- `_config.json` — config de grilla del sub-mapa
- `{col}-{row}.json` — hexágonos del sub-mapa
- `notes/{col}-{row}.md` — notas del sub-mapa
- `map.{ext}` — imagen del sub-mapa

### Party (`server/data/party.json`)
Array de personajes con nombre, clase, HP, iniciativa, etc.

## Lógica clave del HexGrid

`HexGrid.jsx` soporta dos modos:

**Modo hex (pointy-top):**
```js
const sizeByW = imgW / (cols * sqrt(3) + sqrt(3) * 0.5);
const sizeByH = imgH / (rows * 1.5 + 0.5);
const size = Math.min(sizeByW, sizeByH);
// offX = colW/2, offY = size
// filas impares desplazadas colW/2 a la derecha
```

**Modo cuadrado:**
```js
colW = imgW / cols;
rowH = imgH / rows;
// esquinas como rectángulo de 4 puntos
```

CRS.Simple: `lat = imgHeight - imgY`, `lng = imgX`.

### Optimización de performance (importante)
HexGrid usa refs para callbacks y serialización de keys para evitar re-renders innecesarios:
- `onHexClickRef`, `onOpenSubmapRef`, etc. — refs actualizados en cada render pero sin estar en deps del useEffect
- `configKey` = `[cols, rows, hexSize, gridShape, dangerCenter, dangerEdge].join('|')`
- `hexagonsKey` = entries de hexágonos serializados como string ordenado
- `notedKey`, `submapKey` = sets serializados como string
- El `useEffect` solo redibuja cuando cambia alguno de estos keys, no en cada render de React

## Colores de peligro

| Rango | Color |
|-------|-------|
| 1.0–1.5 | Verde `#2ecc71` |
| 1.6–2.5 | Amarillo `#f1c40f` |
| 2.6–3.5 | Naranja `#e67e22` |
| 3.6–4.5 | Rojo `#e74c3c` |
| 4.6–5.0 | Púrpura `#8e44ad` |

## Variables CSS del tema

Todas en `:root` en `index.css`, editables desde ThemePanel en tiempo real y guardadas en `localStorage`:

| Variable | Default | Uso |
|----------|---------|-----|
| `--bg` | `#1a1a2e` | Fondo principal |
| `--surface` | `#16213e` | Paneles / sidebar |
| `--border` | `#0f3460` | Bordes |
| `--accent` | `#e94560` | Acento (rojo) |
| `--text` | `#eeeeee` | Texto |
| `--muted` | `#888888` | Texto secundario |
| `--map-bg` | `#0d0d1a` | Fondo del mapa (Leaflet) |

## API endpoints completa

### Mapa principal
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/hexagons` | Lista hexágonos guardados |
| GET/PUT | `/api/hexagons/:id` | Hexágono por id |
| GET/PUT | `/api/hexagons/config` | Config de grilla |
| POST | `/api/maps/upload` | Subir imagen (multipart, campo `map`) |
| GET | `/api/maps/current` | Metadata del mapa actual |
| DELETE | `/api/maps/current` | Borrar mapa actual |
| GET/PUT/DELETE | `/api/notes/:hexId` | Notas Markdown |
| GET | `/api/notes` | Lista de hexIds con notas |

### Sub-mapas
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/submaps` | Lista hexIds con al menos un sub-mapa |
| GET | `/api/submaps/:hexId` | Lista sub-mapas de un hex |
| POST | `/api/submaps/:hexId` | Crear sub-mapa (`{ name }`) → devuelve `{ mapId }` |
| DELETE | `/api/submaps/:hexId/:mapId` | Borrar sub-mapa |
| GET | `/api/submaps/:hexId/:mapId/current` | Metadata imagen del sub-mapa |
| POST | `/api/submaps/:hexId/:mapId/upload` | Subir imagen del sub-mapa |
| GET/PUT | `/api/submaps/:hexId/:mapId/config` | Config de grilla del sub-mapa |
| GET/PUT | `/api/submaps/:hexId/:mapId/hexagons/:id` | Hexágono del sub-mapa |
| GET | `/api/submaps/:hexId/:mapId/notes` | Lista hexIds con notas en sub-mapa |
| GET/PUT/DELETE | `/api/submaps/:hexId/:mapId/notes/:hexId` | Notas del sub-mapa |

### Party
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET/PUT | `/api/party` | Party global (array de personajes) |

## Notas críticas para desarrollo

### Problema de archivos en Windows
- **NUNCA usar el tool `Edit` para archivos grandes** — el sandbox Linux escribe via mount CIFS y a veces corrompe con null bytes
- Para archivos grandes siempre usar: `cat > /path/file << 'ENDOFFILE' ... ENDOFFILE` via bash
- Para edits pequeños (1-2 líneas) se puede usar `sed -i` via bash
- Los archivos en `server/data/` son bloqueados por Windows y **no se pueden borrar desde el sandbox** — hacerlo desde el Explorador o PowerShell de Windows

### Build en producción
- El servidor bloquea `client/dist/` en Windows → **parar el servidor antes de buildear**
- Secuencia: `Ctrl+C` en servidor → `cd client && npm run build` → `node server/index.js`

### Caché de imágenes
- El mapa siempre se guarda como `map.{ext}` (misma URL)
- Para evitar caché del browser, el frontend agrega `?t=<uploadedAt timestamp>` a la URL al crear el overlay de Leaflet

### Sub-mapa con nombre "meta.json"
- Hay un sub-mapa creado con nombre "meta.json" en hex 6-8 — fue un bug al crear. Para renombrarlo editar `server/data/submaps/6-8/<mapId>/info.json` manualmente

### Vite temp files
- `client/vite.config.js.timestamp-*.mjs` es generado automáticamente por Vite, está en `.gitignore`, se puede ignorar

## Estado actual
- Data del usuario borrada (limpio para nueva campaña)
- Grid default: 10 columnas × 16 filas, modo hex
- Todas las features implementadas y funcionando
