import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';

export default function HexPanel({ hexId, hexData, onUpdate, onDelete, onOpenSubmap }) {
  const [danger, setDanger] = useState('');
  const [karma, setKarma] = useState('');
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [noteTab, setNoteTab] = useState('edit');
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submaps, setSubmaps] = useState([]);
  const [newMapName, setNewMapName] = useState('');
  const [creatingMap, setCreatingMap] = useState(false);
  const [showNewMapForm, setShowNewMapForm] = useState(false);

  const refreshSubmaps = useCallback(() => {
    if (!hexId) return;
    fetch('/api/submaps/' + hexId)
      .then(r => r.json())
      .then(data => setSubmaps(Array.isArray(data) ? data : []))
      .catch(() => setSubmaps([]));
  }, [hexId]);

  useEffect(() => {
    if (!hexId) return;
    setDanger(String(hexData?.danger ?? 3.0));
    setKarma(String(hexData?.karma ?? 1.0));
    setLabel(hexData?.label ?? '');
    setConfirming(false);
    setShowNewMapForm(false);
    setNewMapName('');
    fetch('/api/notes/' + hexId).then(r => r.text()).then(setNote);
    refreshSubmaps();
  }, [hexId, hexData, refreshSubmaps]);

  if (!hexId) {
    return (
      <div style={{ color: 'var(--muted)', fontSize: 13, padding: 8 }}>
        Hace clic en un hexagono para editarlo.
      </div>
    );
  }

  const isSaved = !!hexData?.updatedAt;

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(hexId, {
      danger: parseFloat(danger) || 3.0,
      karma: parseFloat(karma) || 1.0,
      label,
    });
    await fetch('/api/notes/' + hexId, {
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

  const handleCreateMap = async () => {
    if (!newMapName.trim()) return;
    setCreatingMap(true);
    const name = newMapName.trim();
    const res = await fetch('/api/submaps/' + hexId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setNewMapName('');
    setShowNewMapForm(false);
    setCreatingMap(false);
    refreshSubmaps();
    if (data.mapId && onOpenSubmap) {
      onOpenSubmap(hexId, data.mapId, name);
    }
  };

  const handleDeleteMap = async (mapId) => {
    await fetch('/api/submaps/' + hexId + '/' + mapId, { method: 'DELETE' });
    refreshSubmaps();
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
            color: confirming ? '#e74c3c' : 'var(--muted)', transition: 'all 0.15s',
          }} title="Resetear a valores por defecto">
            {confirming ? 'Confirmar reset' : 'Resetear'}
          </button>
        )}
      </div>
      {confirming && (
        <div style={{ fontSize: 11, color: '#e74c3c', marginBottom: 8, background: 'rgba(231,76,60,0.08)', padding: '4px 8px', borderRadius: 4 }}>
          Esto borrara la config y notas de este hexagono. Click de nuevo para confirmar.
          <span style={{ marginLeft: 8, cursor: 'pointer', color: 'var(--muted)' }} onClick={() => setConfirming(false)}>cancelar</span>
        </div>
      )}

      <div className="grid-row">
        <label>Etiqueta</label>
        <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="Nombre del lugar..." />
      </div>
      <div className="grid-row">
        <label>Peligro</label>
        <input type="number" value={danger} min={1} max={5} step={0.1} onChange={e => setDanger(e.target.value)} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, marginTop: -4 }}>
        1 = seguro &nbsp; 3 = normal &nbsp; 5 = mortal
      </div>
      <div className="grid-row">
        <label>Karma</label>
        <input type="number" value={karma} step={0.1} onChange={e => setKarma(e.target.value)} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12, marginTop: -4 }}>
        Positivo o negativo (ej: -2.5, 0, 3.7)
      </div>

      {/* Sub-mapas */}
      <div style={{
        marginBottom: 12, padding: '8px 10px',
        border: '1px solid #0f3460', borderRadius: 6,
        background: 'rgba(162,155,254,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: '#a29bfe', fontWeight: 600 }}>
            Sub-mapas {submaps.length > 0 && <span style={{ color: 'var(--muted)' }}>({submaps.length})</span>}
          </span>
          <button onClick={() => setShowNewMapForm(v => !v)} style={{
            padding: '2px 8px', fontSize: 10, fontWeight: 700,
            border: '1px solid #a29bfe', borderRadius: 4, cursor: 'pointer',
            background: showNewMapForm ? 'rgba(162,155,254,0.2)' : 'transparent',
            color: '#a29bfe',
          }}>+ Nuevo</button>
        </div>

        {showNewMapForm && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <input
              type="text" value={newMapName}
              onChange={e => setNewMapName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateMap()}
              placeholder="Nombre del mapa..." autoFocus
              style={{ flex: 1, padding: '4px 6px', background: 'var(--bg)', border: '1px solid #a29bfe', borderRadius: 4, color: 'var(--text)', fontSize: 12 }}
            />
            <button onClick={handleCreateMap} disabled={creatingMap || !newMapName.trim()} style={{
              padding: '4px 10px', fontSize: 10, fontWeight: 700,
              border: 'none', borderRadius: 4, cursor: 'pointer',
              background: '#a29bfe', color: '#1a1a2e',
            }}>{creatingMap ? '...' : 'Crear'}</button>
          </div>
        )}

        {submaps.length === 0 && !showNewMapForm && (
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Sin sub-mapas. Crea uno con "+ Nuevo".</div>
        )}

        {submaps.map(m => (
          <div key={m.mapId} style={{
            display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4,
            padding: '4px 6px', background: 'rgba(15,52,96,0.4)', borderRadius: 4,
          }}>
            <span style={{ flex: 1, fontSize: 11, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.name || m.mapId}
            </span>
            <button onClick={() => onOpenSubmap && onOpenSubmap(hexId, m.mapId, m.name)} style={{
              padding: '2px 7px', fontSize: 10, fontWeight: 600,
              border: 'none', borderRadius: 3, cursor: 'pointer',
              background: '#a29bfe', color: '#1a1a2e',
            }}>Abrir</button>
            <button onClick={() => handleDeleteMap(m.mapId)} style={{
              padding: '2px 6px', fontSize: 10, fontWeight: 700,
              border: '1px solid #e74c3c', borderRadius: 3, cursor: 'pointer',
              background: 'transparent', color: '#e74c3c',
            }}>x</button>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Notas (Markdown)</div>
      <div className="tabs">
        <div className={`tab ${noteTab === 'edit' ? 'active' : ''}`} onClick={() => setNoteTab('edit')}>Editar</div>
        <div className={`tab ${noteTab === 'preview' ? 'active' : ''}`} onClick={() => setNoteTab('preview')}>Preview</div>
      </div>
      {noteTab === 'edit' ? (
        <textarea value={note} onChange={e => setNote(e.target.value)}
          placeholder={'# ' + hexId + '\n\nDescripcion, encuentros, PNJs...'} />
      ) : (
        <div className="md-preview" style={{ border: '1px solid var(--border)', borderRadius: 4, padding: 10, minHeight: 200, background: 'var(--bg)' }}>
          {note ? <ReactMarkdown>{note}</ReactMarkdown> : <span style={{ color: 'var(--muted)' }}>Sin notas aun.</span>}
        </div>
      )}

      <button className="btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={handleSave} disabled={saving}>
        {saving ? 'Guardando...' : 'Guardar'}
      </button>
    </div>
  );
}
