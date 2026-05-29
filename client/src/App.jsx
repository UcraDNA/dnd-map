import { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import HexGrid from './components/HexGrid.jsx';
import HexPanel from './components/HexPanel.jsx';
import GridConfig from './components/GridConfig.jsx';
import MapUpload from './components/MapUpload.jsx';
import { useHexagons } from './hooks/useHexagons.js';

const SIDEBAR_TABS = ['Hexagono', 'Grilla', 'Mapa'];

export default function App() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const imageOverlayRef = useRef(null);

  const [sideTab, setSideTab] = useState(0);
  const [selectedHex, setSelectedHex] = useState(null);
  const [mapMeta, setMapMeta] = useState(null);
  const [mapBounds, setMapBounds] = useState(null);

  const { hexagons, config, loading, updateHex, updateConfig, getHex } = useHexagons();

  useEffect(() => {
    if (mapInstanceRef.current) return;
    const map = L.map(mapRef.current, {
      crs: L.CRS.Simple,
      minZoom: -3,
      maxZoom: 3,
      zoomSnap: 0.25,
    });
    mapInstanceRef.current = map;
    map.setView([0, 0], 0);
  }, []);

  useEffect(() => {
    fetch('/api/maps/current')
      .then(r => r.json())
      .then(meta => {
        if (meta?.filename) setMapMeta(meta);
      });
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapMeta) return;

    if (imageOverlayRef.current) {
      map.removeLayer(imageOverlayRef.current);
    }

    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const bounds = [[0, 0], [h, w]];
      const overlay = L.imageOverlay(mapMeta.url, bounds).addTo(map);
      imageOverlayRef.current = overlay;
      map.fitBounds(bounds);
      setMapBounds(bounds);
    };
    img.src = mapMeta.url;
  }, [mapMeta]);

  const handleHexClick = useCallback((hexId) => {
    setSelectedHex(hexId);
    setSideTab(0);
  }, []);

  const handleMapUploaded = useCallback((meta) => {
    setMapMeta(meta);
  }, []);

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-header">DnD Map</div>
        <div className="tabs" style={{ padding: '8px 8px 0' }}>
          {SIDEBAR_TABS.map((t, i) => (
            <div key={t} className={`tab ${sideTab === i ? 'active' : ''}`} onClick={() => setSideTab(i)}>
              {t}
            </div>
          ))}
        </div>
        <div className="sidebar-body">
          {sideTab === 0 && (
            <>
              <HexPanel
                hexId={selectedHex}
                hexData={selectedHex ? (hexagons[selectedHex] || getHex(selectedHex, ...selectedHex.split('-').map(Number), config.cols, config.rows)) : null}
                onUpdate={updateHex}
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
              {!loading && (
                <GridConfig config={config} onUpdate={updateConfig} />
              )}
            </>
          )}

          {sideTab === 2 && (
            <>
              <h3>Subir mapa</h3>
              <MapUpload onUploaded={handleMapUploaded} />
              {mapMeta && (
                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
                  Mapa actual: <strong style={{ color: 'var(--text)' }}>{mapMeta.originalName}</strong>
                  <br />
                  Subido: {new Date(mapMeta.uploadedAt).toLocaleString('es')}
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
            getHex={(id, col, row) => getHex(id, col, row, config.cols, config.rows)}
            onHexClick={handleHexClick}
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
