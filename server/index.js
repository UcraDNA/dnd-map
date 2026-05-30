import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import hexagonRoutes from './routes/hexagons.js';
import mapRoutes from './routes/maps.js';
import notesRoutes from './routes/notes.js';
import submapRoutes from './routes/submaps.js';
import partyRoutes from './routes/party.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve uploaded map images statically
app.use('/maps', express.static(path.join(__dirname, 'data/maps')));
app.use('/submaps', express.static(path.join(__dirname, 'data/submaps')));

// API routes
app.use('/api/hexagons', hexagonRoutes);
app.use('/api/maps', mapRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/submaps', submapRoutes);
app.use('/api/party', partyRoutes);

// Serve React build in production
app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`DnD Map server running at http://localhost:${PORT}`);
});
