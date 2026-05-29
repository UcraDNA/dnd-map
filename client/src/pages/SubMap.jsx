import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import HexGrid from '../components/HexGrid.jsx';
import HexPanel from '../components/HexPanel.jsx';
import GridConfig from '../components/GridConfig.jsx';
import { useSubmapHexagons } from '../hooks/useSubmapHexagons.js';

const TABS = ['Hexagono', 'Grilla'];
const BOUNDS_PADDING = 0.15;

function dangerColor(d) {
  if (d <= 1.5) return '#2ecc71';
  if (d <= 2.5) return '#f1c40f';
  if (d <= 3.5) return '#e67e22';
  if (d <= 4.5) return '#e74c3c';
  return '#8e44ad';
}

const DANGER_PRESETS = [
  { value: 1.0, color: '#2ecc71' },
  { value: 2.0, color: '#f1c40f' },
  { value: 3.0, color: '#e67e22' },
  { value: 4.0, color: '#e74c3c' },
  { value: 5.0, color: '#8e44ad' },
];

export default function SubMap() {
  const { hexId } = useParams();
  const navigate = useNavigate();

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const imageOverlayRef = useRef(null);

  const [sideTab, setSideTab] = useState(0);
  const [selectedHex, setSelectedHex] = useState(null);
  const [mapMeta, setMapMeta] = useState(null);
  const [mapBounds, setMapBounds] = useState(null);
  const [notedHexIds, setNotedHexIds] = useState(new Set());
  const [uploading, setUploading] = useState(false);

  const [brushActive, setBrushActive] = useState(false);
  const [brushDanger, setBrushDanger] = useState(3.0);
  const [brushCount, setBrushCount] = useState(0);
  const [brushMode, setBrushMode] = useState('hex');

  const { hexagons, config, loading, updateHex, updateMany, deleteHex, updateConfig, getHex } = useSubmapHexagons(hexId);

  const BASE = '/api/submaps/' + hexId;

  const refreshNotes = useCallback(() => {
    fetch(BASE + '/notes')
      .then(r => r.json())
      .then(ids => setNotedHexIds(new Set(ids)));
  }, [hexId]);

  useEffect(() => { refreshNotes(); }, [refreshNotes]);

  useEffect(() => {
    if (mapInstanceRef.current) return;
    const map = L.map(mapRef.current, {
      crs: L.CRS.Simple,
      minZoom: -3,
      maxZoom: 3,
      zoomSnap: 0.25,
      maxBoundsViscosity: 1.0,
    });
    mapInstanceRef.current = map;
    map.setView([0, 0], 0);
  }, []);

  useEffect(() => {
    fetch(BASE + '/current')
      .then(r => r.json())
      .then(meta => { if (meta?.filename) setMapMeta(meta); });
  }, [hexId]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapMeta) return;
    if (imageOverlayRef.current) map.removeLayer(imageOverlayRef.current);
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const imgBounds = [[0, 0], [h, w]];
      const overlay = L.imageOverlay(mapMeta.url, imgBounds).addTo(map);
      imageOverlayRef.current = overlay;
      map.fitBounds(imgBounds);
      setMapBounds(imgBounds);
      const pad = config.boundsPadding != null ? config.boundsPadding : BOUNDS_PADDING;
      const padH = h * pad, padW = w * pad;
      map.setMaxBounds([[-padH, -padW], [h + padH, w + padW]]);
    };
    img.src = mapMeta.url;
  }, [mapMeta]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapBounds) return;
    const pad = config.boundsPadding != null ? config.boundsPadding : BOUNDS_PADDING;
    const h = mapBounds[1][0], w = mapBounds[1][1];
    const padH = h * pad, padW = w * pad;
    map.setMaxBounds([[-padH, -padW], [h + padH, w + padW]]);
  }, [config.boundsPadding, mapBounds]);

  useEffect(() => {
    const container = mapRef.current;
    if (!container) return;
    container.style.cursor = brushActive ? 'crosshair' : '';
  }, [brushActive]);

  const handleUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('map', file);
    const res = await fetch(BASE + '/upload', { method: 'POST', body: formData });
    const meta = await res.json();
    setMapMeta(meta);
    setUploading(false);
    e.target.value = '';
  }, [hexId]);

  const handleHexClick = useCallback((hId) => {
    if (brushActive) {
      const [col, row] = hId.split('-').map(Number);
      let ids = [];
      if (brushMode === 'row') {
        for (let c = 0; c < config.cols; c++) ids.push(c + '-' + row);
      } else if (brushMode === 'col') {
        for (let r = 0; r < config.rows; r++) ids.push(col + '-' + r);
      } else {
        ids = [hId];
      }
      updateMany(ids, { danger: brushDanger }).then(results => {
        setBrushCount(c => c + results.length);
      });
      return;
    }
    setSelectedHex(hId);
    setSideTab(0);
  }, [brushActive, brushDanger, brushMode, config.cols, config.rows, updateMany]);

  const handleUpdate = useCallback(async (hId, data) => {
    await updateHex(hId, data);
    // Save note separately (HexPanel calls /api/notes/:id but we need /api/submaps/:hexId/notes/:subId)
    refreshNotes();
  }, [updateHex, refreshNotes]);

  const handleDelete = useCallback(async (hId) => {
    await deleteHex(hId);
    setSelectedHex(null);
    refreshNotes();
  }, [deleteHex, refreshNotes]);

  const accentColor = dangerColor(brushDanger);

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => navigate('/')} style={{
            background: 'none', border: '1px solid #0f3460', borderRadius: 4,
            color: 'var(--muted)', cursor: 'pointer', padding: '2px 7px', fontSize: 14,
          }} title="Volver al mapa principal">&#8592;</button>
          <span>Sub-mapa: <strong style={{ color: 'var(--accent)' }}>{hexId}</strong></span>
        </div>

        {/* Upload zona */}
        <div style={{ margin: '8px 10px 0', display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={{
            flex: 1, padding: '6px 10px', fontSize: 11, fontWeight: 600,
            background: '#0f3460', border: 'none', borderRadius: 4, cursor: 'pointer',
            color: 'white', textAlign: 'center', display: 'block',
          }}>
            {uploading ? 'Subiendo...' : mapMeta ? 'Cambiar imagen' : 'Subir imagen'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
        {mapMeta && (
          <div style={{ margin: '4px 10px 0', fontSize: 10, color: 'var(--muted)' }}>
            {mapMeta.originalName}
          </div>
        )}

        <div className="tabs" style={{ padding: '8px 8px 0' }}>
          {TABS.map((t, i) => (
            <div key={t} className={`tab ${sideTab === i ? 'active' : ''}`} onClick={() => setSideTab(i)}>{t}</div>
          ))}
        </div>

        {/* Pincel */}
        <div style={{
          margin: '10px 10px 0',
          border: brushActive ? '1px solid #e94560' : '1px solid #0f3460',
          borderRadius: 6, padding: 10,
          background: brushActive ? 'rgba(233,69,96,0.08)' : 'transparent',
          transition: 'all 0.2s',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: brushActive ? '#e94560' : 'var(--muted)', fontWeight: 600 }}>
              {brushActive ? 'Pincel activo' : 'Pincel de dificultad'}
            </span>
            <button onClick={() => { setBrushActive(a => !a); setBrushCount(0); }} style={{
              padding: '4px 10px', fontSize: 11, fontWeight: 700,
              border: 'none', borderRadius: 4, cursor: 'pointer',
              background: brushActive ? '#e94560' : '#0f3460', color: 'white',
            }}>
              {brushActive ? 'Desactivar' : 'Activar'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
            {DANGER_PRESETS.map(p => (
              <button key={p.value}
                onClick={() => { setBrushDanger(p.value); if (!brushActive) setBrushActive(true); }}
                style={{
                  flex: 1, padding: '5px 2px', fontSize: 10, fontWeight: 700,
                  border: brushDanger === p.value && brushActive ? '2px solid white' : '2px solid transparent',
                  borderRadius: 4, cursor: 'pointer', background: p.color, color: '#000',
                  opacity: brushActive && brushDanger === p.value ? 1 : 0.6,
                  transition: 'all 0.15s',
                }}
              >
                {p.value.toFixed(1)}
              </button>
            ))}
          </div>
          {brushActive && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <input type="range" min="1" max="5" step="0.1" value={brushDanger}
                onChange={e => setBrushDanger(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: accentColor, minWidth: 28 }}>
                {brushDanger.toFixed(1)}
              </span>
            </div>
          )}
          {brushActive && (
            <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
              {[
                { key: 'hex', label: 'Hex' },
                { key: 'row', label: 'Fila' },
                { key: 'col', label: 'Columna' },
              ].map(m => (
                <button key={m.key} onClick={() => setBrushMode(m.key)} style={{
                  flex: 1, padding: '5px 2px', fontSize: 10, fontWeight: 600,
                  border: brushMode === m.key ? '1px solid #e94560' : '1px solid #0f3460',
                  borderRadius: 4, cursor: 'pointer',
                  background: brushMode === m.key ? 'rgba(233,69,96,0.2)' : '#1a1a2e',
                  color: brushMode === m.key ? '#e94560' : 'var(--muted)',
                  transition: 'all 0.15s',
                }}>
                  {m.label}
                </button>
              ))}
            </div>
          )}
          {brushActive && brushCount > 0 && (
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              {brushCount} hex{brushCount !== 1 ? 'agonos' : 'agono'} pintado{brushCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        <div className="sidebar-body">
          {sideTab === 0 && (
            <SubHexPanel
              hexId={selectedHex}
              hexData={selectedHex ? (hexagons[selectedHex] || getHex(selectedHex, ...selectedHex.split('-').map(Number), config.cols, config.rows)) : null}
              parentHexId={hexId}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          )}
          {sideTab === 1 && (
            <>
              <h3>Configuracion de grilla</h3>
              {!loading && <GridConfig config={config} onUpdate={updateConfig} />}
            </>
          )}
        </div>
      </div>

      <div className="map-container">
        <div id="submap" ref={mapRef} style={{ width: '100%', height: '100%' }} />
        {!loading && mapInstanceRef.current && mapBounds && (
          <HexGrid
            map={mapInstanceRef.current}
            mapBounds={mapBounds}
            config={config}
            hexagons={hexagons}
            notedHexIds={notedHexIds}
            getHex={(id, col, row) => getHex(id, col, row, config.cols, config.rows)}
            onHexClick={handleHexClick}
            noteApiBase={BASE + '/notes'}
          />
        )}
        {!mapMeta && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            color: 'var(--muted)', textAlign: 'center', pointerEvents: 'none',
          }}>
            <div style={{ fontSize: 48 }}>[ sub-mapa ]</div>
            <div>Sub-mapa del hexagono <strong style={{ color: 'var(--accent)' }}>{hexId}</strong></div>
            <div style={{ marginTop: 8, fontSize: 12 }}>Subi una imagen desde el panel izquierdo</div>
          </div>
        )}
      </div>
    </div>
  );
}

// HexPanel adaptado para sub-mapas (usa /api/submaps/:parentId/notes/:subId)
function SubHexPanel({ hexId, hexData, parentHexId, onUpdate, onDelete }) {
  const [danger, setDanger] = useState('');
  const [karma, setKarma] = useState('');
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [noteTab, setNoteTab] = useState('edit');
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [ReactMarkdown, setReactMarkdown] = useState(null);

  useEffect(() => {
    import('react-markdown').then(m => setReactMarkdown(() => m.default));
  }, []);

  const BASE_NOTES = '/api/submaps/' + parentHexId + '/notes';

  useEffect(() => {
    if (!hexId) return;
    setDanger(String(hexData?.danger ?? 3.0));
    setKarma(String(hexData?.karma ?? 1.0));
    setLabel(hexData?.label ?? '');
    setConfirming(false);
    fetch(BASE_NOTES + '/' + hexId).then(r => r.text()).then(setNote);
  }, [hexId, hexData, parentHexId]);

  if (!hexId) {
    return <div style={{ color: 'var(--muted)', fontSize: 13, padding: 8 }}>Hace clic en un hexagono para editarlo.</div>;
  }

  const isSaved = !!hexData?.updatedAt;

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(hexId, { danger: parseFloat(danger) || 3.0, karma: parseFloat(karma) || 1.0, label });
    await fetch(BASE_NOTES + '/' + hexId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: note }),
    });
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirming) { setConfirming(true); return; }
    await onDelete(hexId);
    setConfirming(false);
  };

  return (
    <div className="hex-panel">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="hex-id" style={{ margin: 0 }}>
          Hex: <strong>{hexId}</strong>
          {isSaved && <span style={{ marginLeft: 6, fontSize: 10, color: '#2ecc71' }}>guardado</span>}
        </div>
        {isSaved && (
          <button onClick={handleDelete} style={{
            padding: '3px 8px', fontSize: 10, fontWeight: 700,
            border: confirming ? '1px solid #e74c3c' : '1px solid #444',
            borderRadius: 4, cursor: 'pointer',
            background: confirming ? 'rgba(231,76,60,0.2)' : 'transparent',
            color: confirming ? '#e74c3c' : 'var(--muted)',
          }}>
            {confirming ? 'Confirmar reset' : 'Resetear'}
          </button>
        )}
      </div>
      {confirming && (
        <div style={{ fontSize: 11, color: '#e74c3c', marginBottom: 8, background: 'rgba(231,76,60,0.08)', padding: '4px 8px', borderRadius: 4 }}>
          Esto borrara la config y notas de este hex. Click de nuevo para confirmar.
          <span style={{ marginLeft: 8, cursor: 'pointer', color: 'var(--muted)' }} onClick={() => setConfirming(false)}>cancelar</span>
        </div>
      )}
      <div className="grid-row">
        <label>Etiqueta</label>
        <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="Nombre..." />
      </div>
      <div className="grid-row">
        <label>Peligro</label>
        <input type="number" value={danger} min={1} max={5} step={0.1} onChange={e => setDanger(e.target.value)} />
      </div>
      <div className="grid-row">
        <label>Karma</label>
        <input type="number" value={karma} step={0.1} onChange={e => setKarma(e.target.value)} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4, marginTop: 8 }}>Notas (Markdown)</div>
      <div className="tabs">
        <div className={`tab ${noteTab === 'edit' ? 'active' : ''}`} onClick={() => setNoteTab('edit')}>Editar</div>
        <div className={`tab ${noteTab === 'preview' ? 'active' : ''}`} onClick={() => setNoteTab('preview')}>Preview</div>
      </div>
      {noteTab === 'edit' ? (
        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder={'# ' + hexId + '\n\nDescripcion...'} />
      ) : (
        <div className="md-preview" style={{ border: '1px solid var(--border)', borderRadius: 4, padding: 10, minHeight: 200, background: 'var(--bg)' }}>
          {note && ReactMarkdown ? <ReactMarkdown>{note}</ReactMarkdown> : <span style={{ color: 'var(--muted)' }}>Sin notas aun.</span>}
        </div>
      )}
      <button className="btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={handleSave} disabled={saving}>
        {saving ? 'Guardando...' : 'Guardar'}
      </button>
    </div>
  );
}
