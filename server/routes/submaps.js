import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_DIR = path.join(__dirname, '../data/submaps');
const router = express.Router();

function mapDir(hexId, mapId) {
  return path.join(BASE_DIR, hexId, mapId);
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

// Multer — guarda en data/submaps/:hexId/:mapId/map.{ext}
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const dir = mapDir(req.params.hexId, req.params.mapId);
    await ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, 'map' + ext);
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// ─── Índice de hexIds con submapas ───────────────────────────────────────────

// GET /api/submaps — lista hexIds que tienen al menos un mapa
router.get('/', async (req, res) => {
  try {
    let hexDirs = [];
    try { hexDirs = await fs.readdir(BASE_DIR); } catch {}
    const ids = [];
    for (const hexId of hexDirs) {
      const hexPath = path.join(BASE_DIR, hexId);
      try {
        const stat = await fs.stat(hexPath);
        if (!stat.isDirectory()) continue;
        const maps = await fs.readdir(hexPath);
        if (maps.length > 0) ids.push(hexId);
      } catch {}
    }
    res.json(ids);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Listado de mapas de un hex ───────────────────────────────────────────────

// GET /api/submaps/:hexId — lista los mapas de ese hex
router.get('/:hexId', async (req, res) => {
  try {
    const hexPath = path.join(BASE_DIR, req.params.hexId);
    let mapDirs = [];
    try { mapDirs = await fs.readdir(hexPath); } catch {}
    const maps = [];
    for (const mapId of mapDirs) {
      const metaPath = path.join(hexPath, mapId, 'meta.json');
      try {
        const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
        maps.push({ mapId, ...meta });
      } catch {
        // dir existe pero sin meta (creado sin imagen aún)
        const infoPath = path.join(hexPath, mapId, 'info.json');
        try {
          const info = JSON.parse(await fs.readFile(infoPath, 'utf8'));
          maps.push({ mapId, ...info });
        } catch {
          maps.push({ mapId, name: mapId });
        }
      }
    }
    res.json(maps);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/submaps/:hexId — crear nuevo mapa (sin imagen todavía)
router.post('/:hexId', async (req, res) => {
  try {
    const mapId = Date.now().toString();
    const dir = mapDir(req.params.hexId, mapId);
    await ensureDir(dir);
    const info = { mapId, name: req.body.name || 'Mapa ' + mapId, createdAt: new Date().toISOString() };
    await fs.writeFile(path.join(dir, 'info.json'), JSON.stringify(info, null, 2));
    res.json(info);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/submaps/:hexId/:mapId — borrar un mapa completo
router.delete('/:hexId/:mapId', async (req, res) => {
  try {
    const dir = mapDir(req.params.hexId, req.params.mapId);
    await fs.rm(dir, { recursive: true, force: true });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Operaciones sobre un mapa específico ────────────────────────────────────

// POST /api/submaps/:hexId/:mapId/upload
router.post('/:hexId/:mapId/upload', upload.single('map'), async (req, res) => {
  try {
    const { hexId, mapId } = req.params;
    const dir = mapDir(hexId, mapId);
    // leer nombre guardado en info.json
    let name = mapId;
    try { name = JSON.parse(await fs.readFile(path.join(dir, 'info.json'), 'utf8')).name; } catch {}
    const meta = {
      mapId, name,
      filename: req.file.filename,
      originalName: req.file.originalname,
      url: '/submaps/' + hexId + '/' + mapId + '/' + req.file.filename,
      uploadedAt: new Date().toISOString(),
    };
    await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
    res.json(meta);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/submaps/:hexId/:mapId/current
router.get('/:hexId/:mapId/current', async (req, res) => {
  try {
    const data = await fs.readFile(path.join(mapDir(req.params.hexId, req.params.mapId), 'meta.json'), 'utf8');
    res.json(JSON.parse(data));
  } catch { res.json(null); }
});

// GET /api/submaps/:hexId/:mapId/config
router.get('/:hexId/:mapId/config', async (req, res) => {
  try {
    const data = await fs.readFile(path.join(mapDir(req.params.hexId, req.params.mapId), '_config.json'), 'utf8');
    res.json(JSON.parse(data));
  } catch {
    res.json({ cols: 8, rows: 8, hexSize: 0, dangerCenter: 3.0, dangerEdge: 5.0, boundsPadding: 0.15, gridShape: 'hex' });
  }
});

// PUT /api/submaps/:hexId/:mapId/config
router.put('/:hexId/:mapId/config', async (req, res) => {
  try {
    const dir = mapDir(req.params.hexId, req.params.mapId);
    await ensureDir(dir);
    const cfgPath = path.join(dir, '_config.json');
    let existing = {};
    try { existing = JSON.parse(await fs.readFile(cfgPath, 'utf8')); } catch {}
    const merged = { ...existing, ...req.body };
    await fs.writeFile(cfgPath, JSON.stringify(merged, null, 2));
    res.json(merged);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/submaps/:hexId/:mapId/hexagons
router.get('/:hexId/:mapId/hexagons', async (req, res) => {
  try {
    const dir = mapDir(req.params.hexId, req.params.mapId);
    let files = [];
    try { files = await fs.readdir(dir); } catch {}
    const hexagons = {};
    for (const f of files.filter(f => /^\d+-\d+\.json$/.test(f))) {
      const data = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
      hexagons[data.id] = data;
    }
    res.json(hexagons);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/submaps/:hexId/:mapId/hexagons/:subId
router.put('/:hexId/:mapId/hexagons/:subId', async (req, res) => {
  try {
    const dir = mapDir(req.params.hexId, req.params.mapId);
    await ensureDir(dir);
    const data = {
      id: req.params.subId,
      danger: parseFloat(req.body.danger) || 3.0,
      karma: parseFloat(req.body.karma) || 1.0,
      label: req.body.label || '',
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(path.join(dir, req.params.subId + '.json'), JSON.stringify(data, null, 2));
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/submaps/:hexId/:mapId/hexagons/:subId
router.delete('/:hexId/:mapId/hexagons/:subId', async (req, res) => {
  try {
    const dir = mapDir(req.params.hexId, req.params.mapId);
    await fs.unlink(path.join(dir, req.params.subId + '.json')).catch(() => {});
    await fs.unlink(path.join(dir, 'notes', req.params.subId + '.md')).catch(() => {});
    res.json({ ok: true });
  } catch { res.json({ ok: true }); }
});

// GET /api/submaps/:hexId/:mapId/notes
router.get('/:hexId/:mapId/notes', async (req, res) => {
  try {
    const notesDir = path.join(mapDir(req.params.hexId, req.params.mapId), 'notes');
    let files = [];
    try { files = await fs.readdir(notesDir); } catch {}
    res.json(files.filter(f => f.endsWith('.md')).map(f => f.replace('.md', '')));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/submaps/:hexId/:mapId/notes/:subId
router.get('/:hexId/:mapId/notes/:subId', async (req, res) => {
  try {
    const data = await fs.readFile(path.join(mapDir(req.params.hexId, req.params.mapId), 'notes', req.params.subId + '.md'), 'utf8');
    res.send(data);
  } catch { res.send(''); }
});

// PUT /api/submaps/:hexId/:mapId/notes/:subId
router.put('/:hexId/:mapId/notes/:subId', async (req, res) => {
  try {
    const notesDir = path.join(mapDir(req.params.hexId, req.params.mapId), 'notes');
    await ensureDir(notesDir);
    await fs.writeFile(path.join(notesDir, req.params.subId + '.md'), req.body.content || '');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/submaps/:hexId/:mapId/notes/:subId
router.delete('/:hexId/:mapId/notes/:subId', async (req, res) => {
  try {
    await fs.unlink(path.join(mapDir(req.params.hexId, req.params.mapId), 'notes', req.params.subId + '.md'));
    res.json({ ok: true });
  } catch { res.json({ ok: true }); }
});

export default router;
