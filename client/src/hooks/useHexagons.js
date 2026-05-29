import { useState, useEffect, useCallback } from 'react';

const API = '/api/hexagons';

export function useHexagons() {
  const [hexagons, setHexagons] = useState({});  // keyed by id
  const [config, setConfig] = useState({ cols: 10, rows: 8, hexSize: 60 });
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const [hexRes, cfgRes] = await Promise.all([
      fetch(API).then(r => r.json()),
      fetch(`${API}/config`).then(r => r.json()),
    ]);
    const map = {};
    hexRes.forEach(h => { map[h.id] = h; });
    setHexagons(map);
    setConfig(cfgRes);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const updateHex = useCallback(async (id, data) => {
    const res = await fetch(`${API}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const updated = await res.json();
    setHexagons(prev => ({ ...prev, [id]: updated }));
    return updated;
  }, []);

  const updateConfig = useCallback(async (newConfig) => {
    const res = await fetch(`${API}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig),
    });
    const updated = await res.json();
    setConfig(updated);
    return updated;
  }, []);

  // Get hex data with defaults based on position
  const getHex = useCallback((id, col, row, cols, rows) => {
    if (hexagons[id]) return hexagons[id];
    // Default danger: 3 in center, 5 at top/bottom extremes
    const rowNorm = rows > 1 ? row / (rows - 1) : 0.5;
    const danger = 3.0 + 2.0 * Math.abs(rowNorm - 0.5) * 2;
    return {
      id,
      danger: parseFloat(Math.min(5, Math.max(1, danger)).toFixed(1)),
      karma: 1.0,
      label: '',
      noteFile: null,
    };
  }, [hexagons]);

  return { hexagons, config, loading, updateHex, updateConfig, getHex, refetch: fetchAll };
}
