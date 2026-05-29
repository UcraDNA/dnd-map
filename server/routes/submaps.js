import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

function submapDir(hexId) {
  return path.join(__dirname, '../data/submaps', hexId);
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

// Multer storage — guarda en data/submaps/:hexId/map.{ext}
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const dir = submapDir(req.params.hexId);
    await ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, 'map' + ext);
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// GET /api/submaps — lista los hexIds que tienen sub-mapa
router.get('/', async (req, res) => {
  try {
    const base = path.join(__dirname, '../data/submaps');
    let dirs = [];
    try { dirs = await fs.readdir(base); } catch {}
    const ids = [];
    for (const d of dirs) {
      try {
        await fs.access(path.join(base, d, 'meta.json'));
        ids.push(d);
      } catch {}
    }
    res.json(ids);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/submaps/:hexId/upload
router.post('/:hexId/upload', upload.single('map'), async (req, res) => {
  try {
    const { hexId } = req.params;
    const dir = submapDir(hexId);
    const meta = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      url: '/submaps/' + hexId + '/' + req.file.filename,
      uploadedAt: new Date().toISOString(),
    };
    await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
    res.json(meta);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/submaps/:hexId/current
router.get('/:hexId/current', async (req, res) => {
  try {
    const metaPath = path.join(submapDir(req.params.hexId), 'meta.json');
    const data = await fs.readFile(metaPath, 'utf8');
    res.json(JSON.parse(data));
  } catch {
    res.json(null);
  }
});

// GET /api/submaps/:hexId/config
router.get('/:hexId/config', async (req, res) => {
  try {
    const cfgPath = path.join(submapDir(req.params.hexId), '_config.json');
    const data = await fs.readFile(cfgPath, 'utf8');
    res.json(JSON.parse(data));
  } catch {
    res.json({ cols: 8, rows: 8, hexSize: 60, dangerCenter: 3.0, dangerEdge: 5.0, boundsPadding: 0.15 });
  }
});

// PUT /api/submaps/:hexId/config
router.put('/:hexId/config', async (req, res) => {
  try {
    const dir = submapDir(req.params.hexId);
    await ensureDir(dir);
    const cfgPath = path.join(dir, '_config.json');
    let existing = {};
    try { existing = JSON.parse(await fs.readFile(cfgPath, 'utf8')); } catch {}
    const merged = { ...existing, ...req.body };
    await fs.writeFile(cfgPath, JSON.stringify(merged, null, 2));
    res.json(merged);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/submaps/:hexId/hexagons
router.get('/:hexId/hexagons', async (req, res) => {
  try {
    const dir = submapDir(req.params.hexId);
    let files = [];
    try { files = await fs.readdir(dir); } catch {}
    const hexFiles = files.filter(f => /^\d+-\d+\.json$/.test(f));
    const hexagons = {};
    for (const f of hexFiles) {
      const data = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
      hexagons[data.id] = data;
    }
    res.json(hexagons);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/submaps/:hexId/hexagons/:subId
router.get('/:hexId/hexagons/:subId', async (req, res) => {
  try {
    const filePath = path.join(submapDir(req.params.hexId), req.params.subId + '.json');
    const data = await fs.readFile(filePath, 'utf8');
    res.json(JSON.parse(data));
  } catch {
    res.status(404).json(null);
  }
});

// PUT /api/submaps/:hexId/hexagons/:subId
router.put('/:hexId/hexagons/:subId', async (req, res) => {
  try {
    const dir = submapDir(req.params.hexId);
    await ensureDir(dir);
    const filePath = path.join(dir, req.params.subId + '.json');
    const data = {
      id: req.params.subId,
      danger: parseFloat(req.body.danger) || 3.0,
      karma: parseFloat(req.body.karma) || 1.0,
      label: req.body.label || '',
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/submaps/:hexId/hexagons/:subId
router.delete('/:hexId/hexagons/:subId', async (req, res) => {
  try {
    const filePath = path.join(submapDir(req.params.hexId), req.params.subId + '.json');
    await fs.unlink(filePath);
    // Also delete note
    const notePath = path.join(submapDir(req.params.hexId), 'notes', req.params.subId + '.md');
    try { await fs.unlink(notePath); } catch {}
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});

// GET /api/submaps/:hexId/notes
router.get('/:hexId/notes', async (req, res) => {
  try {
    const notesDir = path.join(submapDir(req.params.hexId), 'notes');
    let files = [];
    try { files = await fs.readdir(notesDir); } catch {}
    const ids = files.filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''));
    res.json(ids);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/submaps/:hexId/notes/:subId
router.get('/:hexId/notes/:subId', async (req, res) => {
  try {
    const notePath = path.join(submapDir(req.params.hexId), 'notes', req.params.subId + '.md');
    const data = await fs.readFile(notePath, 'utf8');
    res.send(data);
  } catch {
    res.send('');
  }
});

// PUT /api/submaps/:hexId/notes/:subId
router.put('/:hexId/notes/:subId', async (req, res) => {
  try {
    const notesDir = path.join(submapDir(req.params.hexId), 'notes');
    await ensureDir(notesDir);
    const notePath = path.join(notesDir, req.params.subId + '.md');
    await fs.writeFile(notePath, req.body.content || '');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/submaps/:hexId/notes/:subId
router.delete('/:hexId/notes/:subId', async (req, res) => {
  try {
    const notePath = path.join(submapDir(req.params.hexId), 'notes', req.params.subId + '.md');
    await fs.unlink(notePath);
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});

export default router;
