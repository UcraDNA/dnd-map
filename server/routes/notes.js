import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NOTES_DIR = path.join(__dirname, '../data/notes');

const router = express.Router();

async function ensureDir() {
  await fs.mkdir(NOTES_DIR, { recursive: true });
}

// GET /api/notes/:hexId - get markdown note for a hexagon
router.get('/:hexId', async (req, res) => {
  await ensureDir();
  const filePath = path.join(NOTES_DIR, `${req.params.hexId}.md`);
  try {
    const content = await fs.readFile(filePath, 'utf8');
    res.type('text/plain').send(content);
  } catch {
    res.type('text/plain').send('');
  }
});

// PUT /api/notes/:hexId - save markdown note
router.put('/:hexId', async (req, res) => {
  await ensureDir();
  const filePath = path.join(NOTES_DIR, `${req.params.hexId}.md`);
  const content = req.body.content ?? '';
  await fs.writeFile(filePath, content, 'utf8');
  res.json({ ok: true, hexId: req.params.hexId });
});

// DELETE /api/notes/:hexId
router.delete('/:hexId', async (req, res) => {
  const filePath = path.join(NOTES_DIR, `${req.params.hexId}.md`);
  try {
    await fs.unlink(filePath);
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});

// GET /api/notes - list all note files
router.get('/', async (req, res) => {
  await ensureDir();
  const files = await fs.readdir(NOTES_DIR);
  res.json(files.filter(f => f.endsWith('.md')).map(f => f.replace('.md', '')));
});

export default router;
