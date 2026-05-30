import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PARTY_FILE = path.join(__dirname, '../data/party.json');
const router = express.Router();

async function readParty() {
  try {
    return JSON.parse(await fs.readFile(PARTY_FILE, 'utf8'));
  } catch {
    return [];
  }
}

async function writeParty(data) {
  await fs.mkdir(path.dirname(PARTY_FILE), { recursive: true });
  await fs.writeFile(PARTY_FILE, JSON.stringify(data, null, 2));
}

// GET /api/party
router.get('/', async (req, res) => {
  res.json(await readParty());
});

// POST /api/party
router.post('/', async (req, res) => {
  const party = await readParty();
  const member = {
    id: Date.now().toString(),
    name: req.body.name || 'Personaje',
    ac: parseFloat(req.body.ac) || 10,
    hpMax: parseFloat(req.body.hpMax) || 10,
    hpCurrent: parseFloat(req.body.hpCurrent) ?? parseFloat(req.body.hpMax) ?? 10,
    initiativeBonus: parseFloat(req.body.initiativeBonus) || 0,
  };
  party.push(member);
  await writeParty(party);
  res.json(member);
});

// PUT /api/party/:id
router.put('/:id', async (req, res) => {
  const party = await readParty();
  const idx = party.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  party[idx] = {
    ...party[idx],
    name: req.body.name ?? party[idx].name,
    ac: parseFloat(req.body.ac) ?? party[idx].ac,
    hpMax: parseFloat(req.body.hpMax) ?? party[idx].hpMax,
    hpCurrent: parseFloat(req.body.hpCurrent) ?? party[idx].hpCurrent,
    initiativeBonus: parseFloat(req.body.initiativeBonus) ?? party[idx].initiativeBonus,
  };
  await writeParty(party);
  res.json(party[idx]);
});

// DELETE /api/party/:id
router.delete('/:id', async (req, res) => {
  const party = await readParty();
  await writeParty(party.filter(p => p.id !== req.params.id));
  res.json({ ok: true });
});

export default router;
