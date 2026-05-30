import { useState, useEffect, useCallback } from 'react';

export function useSubmapHexagons(hexId, mapId) {
  const [hexagons, setHexagons] = useState({});
  const [config, setConfig] = useState({ cols: 8, rows: 8, hexSize: 0, dangerCenter: 3.0, dangerEdge: 5.0, boundsPadding: 0.15, gridShape: 'hex' });
  const [loading, setLoading] = useState(true);

  const BASE = '/api/submaps/' + hexId + '/' + mapId;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [hexRes, cfgRes] = await Promise.all([
      fetch(BASE + '/hexagons').then(r => r.json()),
      fetch(BASE + '/config').then(r => r.json()),
    ]);
    setHexagons(hexRes || {});
    setConfig(prev => ({ dangerCenter: 3.0, dangerEdge: 5.0, boundsPadding: 0.15, gridShape: 'hex', ...cfgRes }));
    setLoading(false);
  }, [hexId, mapId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const updateHex = useCallback(async (id, data) => {
    const res = await fetch(BASE + '/hexagons/' + id, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    const updated = await res.json();
    setHexagons(prev => ({ ...prev, [id]: updated }));
    return updated;
  }, [hexId, mapId]);

  const updateMany = useCallback(async (ids, data) => {
    const results = await Promise.all(ids.map(id =>
      fetch(BASE + '/hexagons/' + id, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      }).then(r => r.json())
    ));
    setHexagons(prev => {
      const next = { ...prev };
      results.forEach(h => { next[h.id] = h; });
      return next;
    });
    return results;
  }, [hexId, mapId]);

  const deleteHex = useCallback(async (id) => {
    await fetch(BASE + '/hexagons/' + id, { method: 'DELETE' });
    await fetch(BASE + '/notes/' + id, { method: 'DELETE' });
    setHexagons(prev => { const next = { ...prev }; delete next[id]; return next; });
  }, [hexId, mapId]);

  const updateConfig = useCallback(async (newConfig) => {
    const res = await fetch(BASE + '/config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newConfig),
    });
    const updated = await res.json();
    setConfig(prev => ({ dangerCenter: 3.0, dangerEdge: 5.0, boundsPadding: 0.15, gridShape: 'hex', ...updated }));
    return updated;
  }, [hexId, mapId]);

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
