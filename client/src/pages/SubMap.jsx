import { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import HexGrid from '../components/HexGrid.jsx';
import GridConfig from '../components/GridConfig.jsx';
import CombatPopup from '../components/CombatPopup.jsx';
import { useSubmapHexagons } from '../hooks/useSubmapHexagons.js';
import SubHexPanel from '../components/SubHexPanel.jsx';

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

export default function SubMap({ hexId: hexIdProp, mapId: mapIdProp, onOpenSubmap, onClose }) {
  const hexId = hexIdProp;
  const mapId = mapIdProp;

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const imageOverlayRef = useRef(null);

  const [sideTab, setSideTab] = useState(0);
  const [selectedHex, setSelectedHex] = useState(null);
  const [mapMeta, setMapMeta] = useState(null);
  const [mapName, setMapName] = useState('');
  const [mapBounds, setMapBounds] = useState(null);
  const [notedHexIds, setNotedHexIds] = useState(new Set());
  const [uploading, setUploading] = useState(false);
  const [combatOpen, setCombatOpen] = useState(false);
  const [hexVisible, setHexVisible] = useState(true);

  const [brushActive, setBrushActive] = useState(false);
  const [brushDanger, setBrushDanger] = useState(3.0);
  const [brushCount, setBrushCount] = useState(0);
  const [brushMode, setBrushMode] = useState('hex');

  const { hexagons, config, loading, updateHex, updateMany, deleteHex, updateConfig, getHex } = useSubmapHexagons(hexId, mapId);

  const BASE = '/api/submaps/' + hexId + '/' + mapId;

  const refreshNotes = useCallback(() => {
    fetch(BASE + '/notes').then(r => r.json()).then(ids => setNotedHexIds(new Set(ids)));
  }, [hexId, mapId]);

  useEffect(() => { refreshNotes(); }, [refreshNotes]);

  // Init mapa Leaflet — one per mount
  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstanceRef.current) return;
    const map = L.map(mapRef.current, {
      crs: L.CRS.Simple, minZoom: -3, maxZoom: 3, zoomSnap: 0.25, maxBoundsViscosity: 1.0,
    });
    mapInstanceRef.current = map;
    map.setView([0, 0], 0);
    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Cargar meta del mapa
  useEffect(() => {
    fetch(BASE + '/current').then(r => r.json()).then(meta => {
      if (meta?.filename) setMapMeta(meta);
      if (meta?.name) setMapName(meta.name);
    });
    fetch('/api/submaps/' + hexId).then(r => r.json()).then(maps => {
      const m = maps.find(m => m.mapId === mapId);
      if (m?.name) setMapName(m.name);
    }).catch(() => {});
  }, [hexId, mapId]);

  // Overlay imagen
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapMeta) return;
    if (imageOverlayRef.current) map.removeLayer(imageOverlayRef.current);
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth, h = img.naturalHeight;
      const imgBounds = [[0, 0], [h, w]];
      imageOverlayRef.current = L.imageOverlay(mapMeta.url, imgBounds).addTo(map);
      map.fitBounds(imgBounds);
      setMapBounds(imgBounds);
      const pad = config.boundsPadding ?? BOUNDS_PADDING;
      map.setMaxBounds([[-h*pad, -w*pad], [h+h*pad, w+w*pad]]);
    };
    img.src = mapMeta.url;
  }, [mapMeta]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapBounds) return;
    const pad = config.boundsPadding ?? BOUNDS_PADDING;
    const h = mapBounds[1][0], w = mapBounds[1][1];
    map.setMaxBounds([[-h*pad, -w*pad], [h+h*pad, w+w*pad]]);
  }, [config.boundsPadding, mapBounds]);

  useEffect(() => {
    if (mapRef.current) mapRef.current.style.cursor = brushActive ? 'crosshair' : '';
  }, [brushActive]);

  const handleUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('map', file);
      const res = await fetch(BASE + '/upload', { method: 'POST', body: formData });
      const meta = await res.json();
      setMapMeta(meta);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }, [hexId, mapId]);

  const handleHexClick = useCallback((hId) => {
    if (brushActive) {
      const [col, row] = hId.split('-').map(Number);
      let ids = [];
      if (brushMode === 'row') for (let c = 0; c < config.cols; c++) ids.push(c + '-' + row);
      else if (brushMode === 'col') for (let r = 0; r < config.rows; r++) ids.push(col + '-' + r);
      else ids = [hId];
      updateMany(ids, { danger: brushDanger }).then(results => setBrushCount(c => c + results.length));
      return;
    }
    setSelectedHex(hId);
    setSideTab(0);
  }, [brushActive, brushDanger, brushMode, config.cols, config.rows, updateMany]);

  const handleUpdate = useCallback(async (hId, data) => {
    await updateHex(hId, data);
    refreshNotes();
  }, [updateHex, refreshNotes]);

  const handleDelete = useCallback(async (hId) => {
    await deleteHex(hId);
    setSelectedHex(null);
    refreshNotes();
  }, [deleteHex, refreshNotes]);

  const accentColor = dangerColor(brushDanger);

  return (
    <div className="app" style={{ width: '100%', height: '100%' }}>
      <div className="sidebar">
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Hex {hexId}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {mapName || mapId}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
            <button onClick={() => setCombatOpen(v => !v)} style={{
              padding: '3px 9px', fontSize: 11, fontWeight: 700,
              border: combatOpen ? '1px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: 4, cursor: 'pointer',
              background: combatOpen ? 'rgba(233,69,96,0.2)' : 'rgba(15,52,96,0.4)',
              color: combatOpen ? 'var(--accent)' : 'var(--muted)',
            }}>&#9876;</button>
            <button onClick={() => setHexVisible(v => !v)} style={{
              padding: '3px 9px', fontSize: 11, fontWeight: 700,
              border: hexVisible ? '1px solid var(--border)' : '1px solid var(--accent)',
              borderRadius: 4, cursor: 'pointer',
              background: hexVisible ? 'rgba(15,52,96,0.4)' : 'rgba(233,69,96,0.15)',
              color: hexVisible ? 'var(--muted)' : 'var(--accent)',
            }}>{hexVisible ? '⬡ ON' : '⬡ OFF'}</button>
          </div>
        </div>

        {/* Upload */}
        <div style={{ margin: '8px 10px 0' }}>
          <label style={{
            display: 'block', padding: '6px 10px', fontSize: 11, fontWeight: 600,
            background: 'var(--border)', border: 'none', borderRadius: 4, cursor: 'pointer',
            color: 'white', textAlign: 'center',
          }}>
            {uploading ? 'Subiendo...' : mapMeta ? 'Cambiar imagen' : 'Subir imagen'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} />
          </label>
          {mapMeta && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>{mapMeta.originalName}</div>}
        </div>

        <div className="tabs" style={{ padding: '8px 8px 0' }}>
          {TABS.map((t, i) => (
            <div key={t} className={`tab ${sideTab === i ? 'active' : ''}`} onClick={() => setSideTab(i)}>{t}</div>
          ))}
        </div>

        {/* Pincel */}
        <div style={{
          margin: '10px 10px 0', border: brushActive ? '1px solid var(--accent)' : '1px solid var(--border)',
          borderRadius: 6, padding: 10, background: brushActive ? 'rgba(233,69,96,0.08)' : 'transparent', transition: 'all 0.2s',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: brushActive ? 'var(--accent)' : 'var(--muted)', fontWeight: 600 }}>
              {brushActive ? 'Pincel activo' : 'Pincel de dificultad'}
            </span>
            <button onClick={() => { setBrushActive(a => !a); setBrushCount(0); }} style={{
              padding: '4px 10px', fontSize: 11, fontWeight: 700, border: 'none', borderRadius: 4, cursor: 'pointer',
              background: brushActive ? 'var(--accent)' : 'var(--border)', color: 'white',
            }}>{brushActive ? 'Desactivar' : 'Activar'}</button>
          </div>
          <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
            {DANGER_PRESETS.map(p => (
              <button key={p.value} onClick={() => { setBrushDanger(p.value); if (!brushActive) setBrushActive(true); }} style={{
                flex: 1, padding: '5px 2px', fontSize: 10, fontWeight: 700,
                border: brushDanger === p.value && brushActive ? '2px solid white' : '2px solid transparent',
                borderRadius: 4, cursor: 'pointer', background: p.color, color: '#000',
                opacity: brushActive && brushDanger === p.value ? 1 : 0.6,
              }}>{p.value.toFixed(1)}</button>
            ))}
          </div>
          {brushActive && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <input type="range" min="1" max="5" step="0.1" value={brushDanger}
                  onChange={e => setBrushDanger(parseFloat(e.target.value))}
                  style={{ flex: 1, accentColor }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: accentColor, minWidth: 28 }}>{brushDanger.toFixed(1)}</span>
              </div>
              <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
                {[{ key: 'hex', label: 'Hex' }, { key: 'row', label: 'Fila' }, { key: 'col', label: 'Columna' }].map(m => (
                  <button key={m.key} onClick={() => setBrushMode(m.key)} style={{
                    flex: 1, padding: '5px 2px', fontSize: 10, fontWeight: 600,
                    border: brushMode === m.key ? '1px solid var(--accent)' : '1px solid var(--border)',
                    borderRadius: 4, cursor: 'pointer',
                    background: brushMode === m.key ? 'rgba(233,69,96,0.2)' : 'var(--bg)',
                    color: brushMode === m.key ? 'var(--accent)' : 'var(--muted)',
                  }}>{m.label}</button>
                ))}
              </div>
              {brushCount > 0 && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{brushCount} hex{brushCount !== 1 ? 'agonos' : 'agono'} pintado{brushCount !== 1 ? 's' : ''}</div>}
            </>
          )}
        </div>

        <div className="sidebar-body">
          {sideTab === 0 && (
            <SubHexPanel
              hexId={selectedHex}
              hexData={selectedHex ? (hexagons[selectedHex] || getHex(selectedHex, ...selectedHex.split('-').map(Number), config.cols, config.rows)) : null}
              parentHexId={hexId}
              mapId={mapId}
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
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
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
            hexVisible={hexVisible}
          />
        )}
        {!mapMeta && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            color: 'var(--muted)', textAlign: 'center', pointerEvents: 'none',
          }}>
            <div style={{ fontSize: 40 }}>[ sub-mapa ]</div>
            <div style={{ fontSize: 13 }}>Subi una imagen desde el panel izquierdo</div>
          </div>
        )}
      </div>

      {combatOpen && <CombatPopup onClose={() => setCombatOpen(false)} />}
    </div>
  );
}
