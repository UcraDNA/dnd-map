import { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import HexGrid from './components/HexGrid.jsx';
import HexPanel from './components/HexPanel.jsx';
import GridConfig from './components/GridConfig.jsx';
import MapUpload from './components/MapUpload.jsx';
import { useHexagons } from './hooks/useHexagons.js';

const SIDEBAR_TABS = ['Hexagono', 'Grilla', 'Mapa'];

const DANGER_PRESETS = [
  { value: 1.0, color: '#2ecc71' },
  { value: 2.0, color: '#f1c40f' },
  { value: 3.0, color: '#e67e22' },
  { value: 4.0, color: '#e74c3c' },
  { value: 5.0, color: '#8e44ad' },
];

function dangerColor(d) {
  if (d <= 1.5) return '#2ecc71';
  if (d <= 2.5) return '#f1c40f';
  if (d <= 3.5) return '#e67e22';
  if (d <= 4.5) return '#e74c3c';
  return '#8e44ad';
}

const BOUNDS_PADDING = 0.15;

// File input oculto para upload de sub-mapa desde el mapa
let submapUploadResolve = null;
function pickSubmapFile() {
  return new Promise(resolve => {
    submapUploadResolve = resolve;
    const input = document.getElementById('submap-file-input');
    if (input) input.click();
  });
}

export default function App() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const imageOverlayRef = useRef(null);

  const [sideTab, setSideTab] = useState(0);
  const [selectedHex, setSelectedHex] = useState(null);
  const [mapMeta, setMapMeta] = useState(null);
  const [mapBounds, setMapBounds] = useState(null);
  const [notedHexIds, setNotedHexIds] = useState(new Set());
  const [submapHexIds, setSubmapHexIds] = useState(new Set());
  const [hexVisible, setHexVisible] = useState(true);

  const [brushActive, setBrushActive] = useState(false);
  const [brushDanger, setBrushDanger] = useState(3.0);
  const [brushCount, setBrushCount] = useState(0);
  const [brushMode, setBrushMode] = useState('hex');

  const { hexagons, config, loading, updateHex, updateMany, deleteHex, updateConfig, getHex } = useHexagons();

  const refreshNotes = useCallback(() => {
    fetch('/api/notes')
      .then(r => r.json())
      .then(ids => setNotedHexIds(new Set(ids)));
  }, []);

  const refreshSubmaps = useCallback(() => {
    fetch('/api/submaps')
      .then(r => r.json())
      .then(ids => setSubmapHexIds(new Set(ids)))
      .catch(() => {});
  }, []);

  useEffect(() => { refreshNotes(); refreshSubmaps(); }, [refreshNotes, refreshSubmaps]);

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
    fetch('/api/maps/current')
      .then(r => r.json())
      .then(meta => { if (meta?.filename) setMapMeta(meta); });
  }, []);

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
      applyMaxBounds(map, h, w, config.boundsPadding != null ? config.boundsPadding : BOUNDS_PADDING);
    };
    img.src = mapMeta.url;
  }, [mapMeta]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapBounds) return;
    applyMaxBounds(map, mapBounds[1][0], mapBounds[1][1], config.boundsPadding != null ? config.boundsPadding : BOUNDS_PADDING);
  }, [config.boundsPadding, mapBounds]);

  useEffect(() => {
    const container = mapRef.current;
    if (!container) return;
    container.style.cursor = brushActive ? 'crosshair' : '';
  }, [brushActive]);

  const handleHexClick = useCallback((hexId) => {
    if (brushActive) {
      const [col, row] = hexId.split('-').map(Number);
      let ids = [];
      if (brushMode === 'row') {
        for (let c = 0; c < config.cols; c++) ids.push(c + '-' + row);
      } else if (brushMode === 'col') {
        for (let r = 0; r < config.rows; r++) ids.push(col + '-' + r);
      } else {
        ids = [hexId];
      }
      updateMany(ids, { danger: brushDanger }).then(results => {
        setBrushCount(c => c + results.length);
      });
      return;
    }
    setSelectedHex(hexId);
    setSideTab(0);
  }, [brushActive, brushDanger, brushMode, config.cols, config.rows, updateMany]);

  const handleUpdate = useCallback(async (hexId, data) => {
    await updateHex(hexId, data);
    refreshNotes();
  }, [updateHex, refreshNotes]);

  const handleDelete = useCallback(async (hexId) => {
    await deleteHex(hexId);
    setSelectedHex(null);
    refreshNotes();
  }, [deleteHex, refreshNotes]);

  const handleMapUploaded = useCallback((meta) => { setMapMeta(meta); }, []);

  // Sub-mapa: abrir en nueva pestaña
  const handleOpenSubmap = useCallback((hexId) => {
    window.open('/submap/' + hexId, '_blank');
  }, []);

  // Sub-mapa: subir imagen desde menú contextual
  const handleUploadSubmap = useCallback((hexId) => {
    pickSubmapFile().then(async (file) => {
      if (!file) return;
      const formData = new FormData();
      formData.append('map', file);
      await fetch('/api/submaps/' + hexId + '/upload', { method: 'POST', body: formData });
      refreshSubmaps();
    });
  }, [refreshSubmaps]);

  // Sub-mapa: subir desde HexPanel
  const handleHexPanelSubmapUpload = useCallback(async (hexId, file) => {
    const formData = new FormData();
    formData.append('map', file);
    await fetch('/api/submaps/' + hexId + '/upload', { method: 'POST', body: formData });
    refreshSubmaps();
  }, [refreshSubmaps]);

  const accentColor = dangerColor(brushDanger);

  return (
    <div className="app">
      {/* Input oculto para upload de sub-mapa desde menú contextual */}
      <input
        id="submap-file-input"
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (submapUploadResolve) { submapUploadResolve(file || null); submapUploadResolve = null; }
        }}
      />

      <div className="sidebar">
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>DnD Map</span>
          <button
            onClick={() => setHexVisible(v => !v)}
            title={hexVisible ? 'Ocultar grilla' : 'Mostrar grilla'}
            style={{
              padding: '3px 9px', fontSize: 11, fontWeight: 700,
              border: hexVisible ? '1px solid #0f3460' : '1px solid #e94560',
              borderRadius: 4, cursor: 'pointer',
              background: hexVisible ? 'rgba(15,52,96,0.4)' : 'rgba(233,69,96,0.15)',
              color: hexVisible ? 'var(--muted)' : '#e94560',
              transition: 'all 0.2s',
            }}
          >
            {hexVisible ? '⬡ ON' : '⬡ OFF'}
          </button>
        </div>
        <div className="tabs" style={{ padding: '8px 8px 0' }}>
          {SIDEBAR_TABS.map((t, i) => (
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
            <>
              <HexPanel
                hexId={selectedHex}
                hexData={selectedHex ? (hexagons[selectedHex] || getHex(selectedHex, ...selectedHex.split('-').map(Number), config.cols, config.rows)) : null}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                hasSubmap={selectedHex ? submapHexIds.has(selectedHex) : false}
                onOpenSubmap={handleOpenSubmap}
                onUploadSubmap={handleHexPanelSubmapUpload}
              />
              <h3>Leyenda de peligro</h3>
              {[
                { range: '1.0 - 1.5', color: '#2ecc71', label: 'Seguro' },
                { range: '1.6 - 2.5', color: '#f1c40f', label: 'Bajo' },
                { range: '2.6 - 3.5', color: '#e67e22', label: 'Moderado' },
                { range: '3.6 - 4.5', color: '#e74c3c', label: 'Alto' },
                { range: '4.6 - 5.0', color: '#8e44ad', label: 'Mortal' },
              ].map(d => (
                <div key={d.range} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 14, height: 14, background: d.color, borderRadius: 2 }} />
                  <span style={{ fontSize: 12 }}>{d.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>{d.range}</span>
                </div>
              ))}
            </>
          )}

          {sideTab === 1 && (
            <>
              <h3>Configuracion de grilla</h3>
              {!loading && <GridConfig config={config} onUpdate={updateConfig} />}
            </>
          )}

          {sideTab === 2 && (
            <>
              <h3>Subir mapa</h3>
              <MapUpload onUploaded={handleMapUploaded} />
              {mapMeta && (
                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
                  Mapa actual: <strong style={{ color: 'var(--text)' }}>{mapMeta.originalName}</strong>
                  <br />Subido: {new Date(mapMeta.uploadedAt).toLocaleString('es')}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="map-container">
        <div id="map" ref={mapRef} style={{ width: '100%', height: '100%' }} />
        {!loading && mapInstanceRef.current && mapBounds && (
          <HexGrid
            map={mapInstanceRef.current}
            mapBounds={mapBounds}
            config={config}
            hexagons={hexagons}
            notedHexIds={notedHexIds}
            submapHexIds={submapHexIds}
            getHex={(id, col, row) => getHex(id, col, row, config.cols, config.rows)}
            onHexClick={handleHexClick}
            onOpenSubmap={handleOpenSubmap}
            onUploadSubmap={handleUploadSubmap}
            hexVisible={hexVisible}
          />
        )}
        {!mapMeta && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            color: 'var(--muted)', textAlign: 'center', pointerEvents: 'none',
          }}>
            <div style={{ fontSize: 48 }}>[ mapa ]</div>
            <div>Subi un mapa desde la pestana Mapa</div>
          </div>
        )}
      </div>
    </div>
  );
}

function applyMaxBounds(map, imgH, imgW, paddingFraction) {
  const padH = imgH * paddingFraction;
  const padW = imgW * paddingFraction;
  map.setMaxBounds([[-padH, -padW], [imgH + padH, imgW + padW]]);
}
