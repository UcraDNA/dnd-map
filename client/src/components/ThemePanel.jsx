import { useState } from 'react';

const DEFAULTS = {
  '--bg':      '#1a1a2e',
  '--surface': '#16213e',
  '--border':  '#0f3460',
  '--accent':  '#e94560',
  '--text':    '#eeeeee',
  '--muted':   '#888888',
  '--map-bg':  '#0d0d1a',
};

const LABELS = {
  '--bg':      'Fondo principal',
  '--surface': 'Paneles / sidebar',
  '--border':  'Bordes',
  '--accent':  'Acento (rojo)',
  '--text':    'Texto',
  '--muted':   'Texto secundario',
  '--map-bg':  'Fondo del mapa',
};

const STORAGE_KEY = 'dnd-theme';

function applyTheme(vars) {
  const root = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
}

export function loadSavedTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) applyTheme(JSON.parse(saved));
  } catch {}
}

export default function ThemePanel() {
  const [colors, setColors] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : { ...DEFAULTS };
    } catch {
      return { ...DEFAULTS };
    }
  });

  const handleChange = (key, val) => {
    const next = { ...colors, [key]: val };
    setColors(next);
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const handleReset = () => {
    setColors({ ...DEFAULTS });
    applyTheme(DEFAULTS);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Colores de la interfaz</h3>
        <button onClick={handleReset} style={{
          fontSize: 10, padding: '3px 8px', fontWeight: 700,
          background: 'transparent', border: '1px solid var(--border)',
          borderRadius: 4, cursor: 'pointer', color: 'var(--muted)',
        }}>Resetear</button>
      </div>

      {Object.entries(LABELS).map(([key, label]) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'monospace' }}>{colors[key]}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 6,
              background: colors[key], border: '2px solid var(--border)', flexShrink: 0,
            }} />
            <input
              type="color"
              value={colors[key]}
              onChange={e => handleChange(key, e.target.value)}
              style={{
                width: 36, height: 36, padding: 2, cursor: 'pointer',
                background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
              }}
            />
          </div>
        </div>
      ))}

      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
        Los cambios se aplican en tiempo real y se guardan automaticamente.
      </div>
    </div>
  );
}
