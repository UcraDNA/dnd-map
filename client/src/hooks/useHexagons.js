import { useState, useEffect, useCallback } from 'react';

const API = '/api/hexagons';

export function useHexagons() {
  const [hexagons, setHexagons] = useState({});
  const [config, setConfig] = useState({ cols: 10, rows: 8, hexSize: 60, dangerCenter: 3.0, dangerEdge: 5.0, boundsPadding: 0.15, gridShape: 'hex' });
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const [hexRes, cfgRes] = await Promise.all([
      fetch(API).then(r => r.json()),
      fetch(API + '/config').then(r => r.json()),
    ]);
    const map = {};
    hexRes.forEach(h => { map[h.id] = h; });
    setHexagons(map);
    setConfig(prev => ({ dangerCenter: 3.0, dangerEdge: 5.0, boundsPadding: 0.15, gridShape: 'hex', ...cfgRes }));
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const updateHex = useCallback(async (id, data) => {
    const res = await fetch(API + '/' + id, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    const updated = await res.json();
    setHexagons(prev => ({ ...prev, [id]: updated }));
    return updated;
  }, []);

  const updateMany = useCallback(async (ids, data) => {
    const results = await Promise.all(ids.map(id =>
      fetch(API + '/' + id, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      }).then(r => r.json())
    ));
    setHexagons(prev => {
      const next = { ...prev };
      results.forEach(h => { next[h.id] = h; });
      return next;
    });
    return results;
  }, []);

  const deleteHex = useCallback(async (id) => {
    await fetch(API + '/' + id, { method: 'DELETE' });
    await fetch('/api/notes/' + id, { method: 'DELETE' });
    setHexagons(prev => { const next = { ...prev }; delete next[id]; return next; });
  }, []);

  const updateConfig = useCallback(async (newConfig) => {
    const res = await fetch(API + '/config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newConfig),
    });
    const updated = await res.json();
    setConfig(prev => ({ dangerCenter: 3.0, dangerEdge: 5.0, boundsPadding: 0.15, gridShape: 'hex', ...updated }));
    return updated;
  }, []);

  const getHex = useCallback((id, col, row, cols, rows) => {
    if (hexagons[id]) return hexagons[id];
    const center = config.dangerCenter ?? 3.0;
    const edge = config.dangerEdge ?? 5.0;
    const rowNorm = rows > 1 ? row / (rows - 1) : 0.5;
    const t = Math.abs(rowNorm - 0.5) * 2;
    const danger = center + (edge - center) * t;
    return { id, danger: parseFloat(Math.min(5, Math.max(1, danger)).toFixed(1)), karma: 1.0, label: '', noteFile: null };
  }, [hexagons, config.dangerCenter, config.dangerEdge]);

  return { hexagons, config, loading, updateHex, updateMany, deleteHex, updateConfig, getHex };
}
