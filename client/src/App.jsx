import { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import HexGrid from './components/HexGrid.jsx';
import HexPanel from './components/HexPanel.jsx';
import GridConfig from './components/GridConfig.jsx';
import MapUpload from './components/MapUpload.jsx';
import PartyPanel from './components/PartyPanel.jsx';
import CombatPopup from './components/CombatPopup.jsx';
import ThemePanel, { loadSavedTheme } from './components/ThemePanel.jsx';
import { useHexagons } from './hooks/useHexagons.js';

loadSavedTheme();

const SIDEBAR_TABS = ['Hexagono', 'Grilla', 'Mapa', 'Party', 'Tema'];

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

export default function App({ onOpenSubmap: onOpenSubmapProp }) {
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
  const [combatOpen, setCombatOpen] = useState(false);
  const [confirmDeleteMap, setConfirmDeleteMap] = useState(false);

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
      crs: L.CRS.Simple, minZoom: -3, maxZoom: 3, zoomSnap: 0.25, maxBoundsViscosity: 1.0,
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
      const w = img.naturalWidth, h = img.naturalHeight;
      const imgBounds = [[0, 0], [h, w]];
      const overlay = L.imageOverlay(mapMeta.url + '?t=' + new Date(mapMeta.uploadedAt).getTime(), imgBounds).addTo(map);
      imageOverlayRef.current = overlay;
      map.fitBounds(imgBounds);
      setMapBounds(imgBounds);
      applyMaxBounds(map, h, w, config.boundsPadding != null ? config.boundsPadding : BOUNDS_PADDING);
    };
    img.src = mapMeta.url + '?t=' + (mapMeta.uploadedAt || Date.now());
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

  const handleMapUploaded = useCallback((meta) => {
    setMapMeta(meta);
    setConfirmDeleteMap(false);
  }, []);

  const handleDeleteMap = useCallback(async () => {
    if (!confirmDeleteMap) { setConfirmDeleteMap(true); return; }
    await fetch('/api/maps/current', { method: 'DELETE' });
    const map = mapInstanceRef.current;
    if (map) {
      if (imageOverlayRef.current) {
        map.removeLayer(imageOverlayRef.current);
        imageOverlayRef.current = null;
      }
      map.eachLayer(layer => {
        if (layer instanceof L.ImageOverlay) map.removeLayer(layer);
      });
    }
    setMapMeta(null);
    setMapBounds(null);
    setConfirmDeleteMap(false);
  }, [confirmDeleteMap]);

  const handleOpenSubmap = useCallback((hexId, mapId) => {
    const open = (hId, mId, name) => {
      if (onOpenSubmapProp) {
        onOpenSubmapProp(hId, mId, name);
      } else {
        window.open('/submap/' + hId + '/' + mId, '_blank');
      }
    };
    if (mapId) {
      fetch('/api/submaps/' + hexId)
        .then(r => r.json())
        .then(maps => {
          const m = maps.find(m => m.mapId === mapId);
          open(hexId, mapId, m?.name || hexId + ' / ' + mapId);
        })
        .catch(() => open(hexId, mapId, hexId + ' / ' + mapId));
    } else {
      fetch('/api/submaps/' + hexId)
        .then(r => r.json())
        .then(maps => {
          if (maps && maps.length > 0) {
            open(hexId, maps[0].mapId, maps[0].name || hexId);
          }
        });
    }
  }, [onOpenSubmapProp]);

  const handleUploadSubmap = useCallback((hexId) => {
    setSelectedHex(hexId);
    setSideTab(0);
  }, []);

  const accentColor = dangerColor(brushDanger);

  return (
    <div className="app" style={{ width: '100%', height: '100%' }}>
      <div className="sidebar">
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>DnD Map</span>
          <div style={{ display: 'flex', gap: 5 }}>
            <button onClick={() => setCombatOpen(v => !v)} title="Abrir combate" style={{
              padding: '3px 9px', fontSize: 11, fontWeight: 700,
              border: combatOpen ? '1px solid #e94560' : '1px solid #0f3460',
              borderRadius: 4, cursor: 'pointer',
              background: combatOpen ? 'rgba(233,69,96,0.2)' : 'rgba(15,52,96,0.4)',
              color: combatOpen ? '#e94560' : 'var(--muted)', transition: 'all 0.2s',
            }}>&#9876;</button>
            <button onClick={() => setHexVisible(v => !v)} title={hexVisible ? 'Ocultar grilla' : 'Mostrar grilla'} style={{
              padding: '3px 9px', fontSize: 11, fontWeight: 700,
              border: hexVisible ? '1px solid #0f3460' : '1px solid #e94560',
              borderRadius: 4, cursor: 'pointer',
              background: hexVisible ? 'rgba(15,52,96,0.4)' : 'rgba(233,69,96,0.15)',
              color: hexVisible ? 'var(--muted)' : '#e94560', transition: 'all 0.2s',
            }}>{hexVisible ? '⬡ ON' : '⬡ OFF'}</button>
          </div>
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
          background: brushActive ? 'rgba(233,69,96,0.08)' : 'transparent', transition: 'all 0.2s',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: brushActive ? '#e94560' : 'var(--muted)', fontWeight: 600 }}>
              {brushActive ? 'Pincel activo' : 'Pincel de dificultad'}
            </span>
            <button onClick={() => { setBrushActive(a => !a); setBrushCount(0); }} style={{
              padding: '4px 10px', fontSize: 11, fontWeight: 700,
              border: 'none', borderRadius: 4, cursor: 'pointer',
              background: brushActive ? '#e94560' : '#0f3460', color: 'white',
            }}>{brushActive ? 'Desactivar' : 'Activar'}</button>
          </div>
          <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
            {DANGER_PRESETS.map(p => (
              <button key={p.value} onClick={() => { setBrushDanger(p.value); if (!brushActive) setBrushActive(true); }} style={{
                flex: 1, padding: '5px 2px', fontSize: 10, fontWeight: 700,
                border: brushDanger === p.value && brushActive ? '2px solid white' : '2px solid transparent',
                borderRadius: 4, cursor: 'pointer', background: p.color, color: '#000',
                opacity: brushActive && brushDanger === p.value ? 1 : 0.6, transition: 'all 0.15s',
              }}>{p.value.toFixed(1)}</button>
            ))}
          </div>
          {brushActive && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <input type="range" min="1" max="5" step="0.1" value={brushDanger}
                onChange={e => setBrushDanger(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: accentColor, minWidth: 28 }}>{brushDanger.toFixed(1)}</span>
            </div>
          )}
          {brushActive && (
            <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
              {[{ key: 'hex', label: 'Hex' }, { key: 'row', label: 'Fila' }, { key: 'col', label: 'Columna' }].map(m => (
                <button key={m.key} onClick={() => setBrushMode(m.key)} style={{
                  flex: 1, padding: '5px 2px', fontSize: 10, fontWeight: 600,
                  border: brushMode === m.key ? '1px solid #e94560' : '1px solid #0f3460',
                  borderRadius: 4, cursor: 'pointer',
                  background: brushMode === m.key ? 'rgba(233,69,96,0.2)' : '#1a1a2e',
                  color: brushMode === m.key ? '#e94560' : 'var(--muted)', transition: 'all 0.15s',
                }}>{m.label}</button>
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
                onOpenSubmap={handleOpenSubmap}
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
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                    Mapa actual: <strong style={{ color: 'var(--text)' }}>{mapMeta.originalName}</strong>
                    <br />Subido: {new Date(mapMeta.uploadedAt).toLocaleString('es')}
                  </div>
                  {confirmDeleteMap && (
                    <div style={{ fontSize: 11, color: '#e74c3c', marginBottom: 6, background: 'rgba(231,76,60,0.08)', padding: '4px 8px', borderRadius: 4 }}>
                      Esto borrara el mapa actual. Click de nuevo para confirmar.
                      <span style={{ marginLeft: 8, cursor: 'pointer', color: 'var(--muted)' }} onClick={() => setConfirmDeleteMap(false)}>cancelar</span>
                    </div>
                  )}
                  <button onClick={handleDeleteMap} style={{
                    padding: '5px 12px', fontSize: 11, fontWeight: 700,
                    border: confirmDeleteMap ? '1px solid #e74c3c' : '1px solid #444',
                    borderRadius: 4, cursor: 'pointer',
                    background: confirmDeleteMap ? 'rgba(231,76,60,0.2)' : 'transparent',
                    color: confirmDeleteMap ? '#e74c3c' : 'var(--muted)', transition: 'all 0.15s',
                  }}>
                    {confirmDeleteMap ? 'Confirmar borrado' : 'Borrar mapa'}
                  </button>
                </div>
              )}
            </>
          )}
          {sideTab === 3 && (
            <>
              <h3>Party</h3>
              <PartyPanel />
            </>
          )}
          {sideTab === 4 && <ThemePanel />}
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

      {combatOpen && <CombatPopup onClose={() => setCombatOpen(false)} />}
    </div>
  );
}

function applyMaxBounds(map, imgH, imgW, paddingFraction) {
  const padH = imgH * paddingFraction;
  const padW = imgW * paddingFraction;
  map.setMaxBounds([[-padH, -padW], [imgH + padH, imgW + padW]]);
}
