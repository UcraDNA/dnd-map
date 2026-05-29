import { useState, useEffect } from 'react';

function dangerColor(d) {
  if (d <= 1.5) return '#2ecc71';
  if (d <= 2.5) return '#f1c40f';
  if (d <= 3.5) return '#e67e22';
  if (d <= 4.5) return '#e74c3c';
  return '#8e44ad';
}

export default function GridConfig({ config, onUpdate }) {
  const [cols, setCols] = useState(config.cols);
  const [rows, setRows] = useState(config.rows);
  const [hexSize, setHexSize] = useState(config.hexSize ?? 0);
  const [dangerCenter, setDangerCenter] = useState(config.dangerCenter ?? 3.0);
  const [dangerEdge, setDangerEdge] = useState(config.dangerEdge ?? 5.0);
  const [boundsPadding, setBoundsPadding] = useState(config.boundsPadding ?? 0.15);

  // Sincronizar cuando config carga desde la API
  useEffect(() => {
    setCols(config.cols);
    setRows(config.rows);
    setHexSize(config.hexSize ?? 0);
    setDangerCenter(config.dangerCenter ?? 3.0);
    setDangerEdge(config.dangerEdge ?? 5.0);
    setBoundsPadding(config.boundsPadding ?? 0.15);
  }, [config]);

  const handleApply = () => {
    onUpdate({
      cols: parseInt(cols) || 10,
      rows: parseInt(rows) || 8,
      hexSize: parseInt(hexSize) || 60,
      dangerCenter: parseFloat(dangerCenter),
      dangerEdge: parseFloat(dangerEdge),
      boundsPadding: parseFloat(boundsPadding),
    });
  };

  const paddingPercent = Math.round(parseFloat(boundsPadding) * 100);

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>Grilla</div>

      <div className="grid-row">
        <label>Columnas</label>
        <input type="number" value={cols} min={1} max={50} onChange={e => setCols(e.target.value)} />
      </div>
      <div className="grid-row">
        <label>Filas</label>
        <input type="number" value={rows} min={1} max={50} onChange={e => setRows(e.target.value)} />
      </div>
      <div className="grid-row">
        <label>Tam. hex</label>
        <input type="number" value={hexSize} min={0} max={500} onChange={e => setHexSize(e.target.value)} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, marginTop: -4 }}>
        0 = automatico (se ajusta a la imagen)
      </div>

      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', margin: '14px 0 8px' }}>
        Dificultad por defecto
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <label style={{ fontSize: 12, color: 'var(--muted)' }}>Centro del mapa</label>
          <span style={{ fontSize: 12, fontWeight: 700, color: dangerColor(dangerCenter) }}>
            {parseFloat(dangerCenter).toFixed(1)}
          </span>
        </div>
        <input type="range" min="1" max="5" step="0.1" value={dangerCenter}
          onChange={e => setDangerCenter(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: dangerColor(dangerCenter) }} />
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <label style={{ fontSize: 12, color: 'var(--muted)' }}>Bordes del mapa</label>
          <span style={{ fontSize: 12, fontWeight: 700, color: dangerColor(dangerEdge) }}>
            {parseFloat(dangerEdge).toFixed(1)}
          </span>
        </div>
        <input type="range" min="1" max="5" step="0.1" value={dangerEdge}
          onChange={e => setDangerEdge(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: dangerColor(dangerEdge) }} />
      </div>

      {/* Preview gradiente */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Preview gradiente</div>
        <div style={{ display: 'flex', height: 14, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
          {Array.from({ length: 9 }, (_, i) => {
            const t = Math.abs((i / 8) - 0.5) * 2;
            const d = parseFloat(dangerCenter) + (parseFloat(dangerEdge) - parseFloat(dangerCenter)) * t;
            return <div key={i} style={{ flex: 1, background: dangerColor(Math.min(5, Math.max(1, d))), opacity: 0.85 }} />;
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
          <span style={{ fontSize: 9, color: 'var(--muted)' }}>borde</span>
          <span style={{ fontSize: 9, color: 'var(--muted)' }}>centro</span>
          <span style={{ fontSize: 9, color: 'var(--muted)' }}>borde</span>
        </div>
      </div>

      {/* Limites del mapa */}
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', margin: '14px 0 8px' }}>
        Limites del mapa
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.5 }}>
        Cuanto se puede panear mas alla del borde de la imagen. 0% = sin margen, 50% = medio mapa de margen.
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <label style={{ fontSize: 12, color: 'var(--muted)' }}>Margen exterior</label>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#e94560' }}>{paddingPercent}%</span>
        </div>
        <input type="range" min="0" max="1" step="0.05" value={boundsPadding}
          onChange={e => setBoundsPadding(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: '#e94560' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
          <span style={{ fontSize: 9, color: 'var(--muted)' }}>Sin margen (0%)</span>
          <span style={{ fontSize: 9, color: 'var(--muted)' }}>Maximo (100%)</span>
        </div>

        {/* Preview visual del limite */}
        <div style={{ marginTop: 8, position: 'relative', height: 48, background: '#0d0d1a', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            position: 'absolute',
            top: paddingPercent / 2 + '%',
            left: paddingPercent / 2 + '%',
            right: paddingPercent / 2 + '%',
            bottom: paddingPercent / 2 + '%',
            background: '#1a3a1a',
            border: '1px solid #2ecc71',
            borderRadius: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 9, color: '#2ecc71' }}>imagen</span>
          </div>
        </div>
        <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 3, textAlign: 'center' }}>
          Area navegable (zona oscura = margen permitido)
        </div>
      </div>

      <button className="btn-secondary" style={{ width: '100%' }} onClick={handleApply}>
        Aplicar
      </button>
    </div>
  );
}
