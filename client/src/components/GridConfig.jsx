import { useState } from 'react';

export default function GridConfig({ config, onUpdate }) {
  const [cols, setCols] = useState(config.cols);
  const [rows, setRows] = useState(config.rows);
  const [hexSize, setHexSize] = useState(config.hexSize);

  const handleApply = () => {
    onUpdate({
      cols: parseInt(cols) || 10,
      rows: parseInt(rows) || 8,
      hexSize: parseInt(hexSize) || 60,
    });
  };

  return (
    <div>
      <div className="grid-row">
        <label>Columnas</label>
        <input type="number" value={cols} min={1} max={50} onChange={e => setCols(e.target.value)} />
      </div>
      <div className="grid-row">
        <label>Filas</label>
        <input type="number" value={rows} min={1} max={50} onChange={e => setRows(e.target.value)} />
      </div>
      <div className="grid-row">
        <label>Tamaño hex</label>
        <input type="number" value={hexSize} min={20} max={200} onChange={e => setHexSize(e.target.value)} />
      </div>
      <button className="btn-secondary" style={{ width: '100%' }} onClick={handleApply}>
        ↺ Aplicar grilla
      </button>
    </div>
  );
}
