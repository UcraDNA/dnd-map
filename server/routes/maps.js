import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAPS_DIR = path.join(__dirname, '../data/maps');
const META_FILE = path.join(MAPS_DIR, 'meta.json');

const router = express.Router();

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await fs.mkdir(MAPS_DIR, { recursive: true });
    cb(null, MAPS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `map${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// GET /api/maps/current - metadata of current map
router.get('/current', async (req, res) => {
  try {
    const raw = await fs.readFile(META_FILE, 'utf8');
    res.json(JSON.parse(raw));
  } catch {
    res.json({ filename: null, width: 0, height: 0 });
  }
});

// POST /api/maps/upload - upload a new map image
router.post('/upload', upload.single('map'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image provided' });

  const meta = {
    filename: req.file.filename,
    originalName: req.file.originalname,
    url: `/maps/${req.file.filename}`,
    uploadedAt: new Date().toISOString(),
  };
  await fs.mkdir(MAPS_DIR, { recursive: true });
  await fs.writeFile(META_FILE, JSON.stringify(meta, null, 2));
  res.json(meta);
});

export default router;
