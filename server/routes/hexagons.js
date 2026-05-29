import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data/hexagons');
const CONFIG_FILE = path.join(DATA_DIR, '_config.json');

const router = express.Router();

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

// Default config for the hexagon grid
const DEFAULT_CONFIG = {
  cols: 10,
  rows: 8,
  hexSize: 60,
};

// GET /api/hexagons/config - grid configuration
router.get('/config', async (req, res) => {
  await ensureDir();
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf8');
    res.json(JSON.parse(raw));
  } catch {
    res.json(DEFAULT_CONFIG);
  }
});

// PUT /api/hexagons/config - update grid configuration
router.put('/config', async (req, res) => {
  await ensureDir();
  const config = { ...DEFAULT_CONFIG, ...req.body };
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
  res.json(config);
});

// GET /api/hexagons - all hexagon data
router.get('/', async (req, res) => {
  await ensureDir();
  try {
    const files = await fs.readdir(DATA_DIR);
    const hexFiles = files.filter(f => f.endsWith('.json') && f !== '_config.json');
    const hexagons = await Promise.all(
      hexFiles.map(async (f) => {
        const raw = await fs.readFile(path.join(DATA_DIR, f), 'utf8');
        return JSON.parse(raw);
      })
    );
    res.json(hexagons);
  } catch {
    res.json([]);
  }
});

// GET /api/hexagons/:id - single hexagon
router.get('/:id', async (req, res) => {
  await ensureDir();
  const filePath = path.join(DATA_DIR, `${req.params.id}.json`);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    res.json(JSON.parse(raw));
  } catch {
    res.status(404).json({ error: 'Hexagon not found' });
  }
});

// PUT /api/hexagons/:id - create or update hexagon
router.put('/:id', async (req, res) => {
  await ensureDir();
  const id = req.params.id;
  const filePath = path.join(DATA_DIR, `${id}.json`);

  // Load existing or create default
  let existing = { id, danger: 3.0, karma: 1.0, label: '', noteFile: null };
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    existing = JSON.parse(raw);
  } catch {}

  const updated = {
    ...existing,
    ...req.body,
    id,
    // Ensure doubles
    danger: parseFloat(req.body.danger ?? existing.danger),
    karma: parseFloat(req.body.karma ?? existing.karma),
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(filePath, JSON.stringify(updated, null, 2));
  res.json(updated);
});

// DELETE /api/hexagons/:id
router.delete('/:id', async (req, res) => {
  const filePath = path.join(DATA_DIR, `${req.params.id}.json`);
  try {
    await fs.unlink(filePath);
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});

export default router;
