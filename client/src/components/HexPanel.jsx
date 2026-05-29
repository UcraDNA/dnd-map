import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

export default function HexPanel({ hexId, hexData, onUpdate, onDelete, hasSubmap, onOpenSubmap, onUploadSubmap }) {
  const [danger, setDanger] = useState('');
  const [karma, setKarma] = useState('');
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [noteTab, setNoteTab] = useState('edit');
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [uploadingSubmap, setUploadingSubmap] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!hexId) return;
    setDanger(String(hexData?.danger ?? 3.0));
    setKarma(String(hexData?.karma ?? 1.0));
    setLabel(hexData?.label ?? '');
    setConfirming(false);
    fetch('/api/notes/' + hexId).then(r => r.text()).then(setNote);
  }, [hexId, hexData]);

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

  const handleSubmapFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onUploadSubmap) return;
    setUploadingSubmap(true);
    await onUploadSubmap(hexId, file);
    setUploadingSubmap(false);
  };

  return (
    <div className="hex-panel">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="hex-id" style={{ margin: 0 }}>
          Hex: <strong>{hexId}</strong>
          {isSaved && <span style={{ marginLeft: 6, fontSize: 10, color: '#2ecc71' }}>guardado</span>}
        </div>
        {isSaved && (
          <button
            onClick={handleDelete}
            style={{
              padding: '3px 8px', fontSize: 10, fontWeight: 700,
              border: confirming ? '1px solid #e74c3c' : '1px solid #444',
              borderRadius: 4, cursor: 'pointer',
              background: confirming ? 'rgba(231,76,60,0.2)' : 'transparent',
              color: confirming ? '#e74c3c' : 'var(--muted)',
              transition: 'all 0.15s',
            }}
            title="Resetear a valores por defecto"
          >
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

      {/* Sub-mapa */}
      <div style={{
        marginBottom: 12, padding: '8px 10px',
        border: '1px solid #0f3460', borderRadius: 6,
        background: 'rgba(162,155,254,0.05)',
      }}>
        <div style={{ fontSize: 11, color: '#a29bfe', fontWeight: 600, marginBottom: 6 }}>
          Sub-mapa {hasSubmap && <span style={{ color: '#2ecc71', marginLeft: 6 }}>&#10003; cargado</span>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <label style={{
            flex: 1, padding: '5px 8px', fontSize: 10, fontWeight: 600,
            background: '#0f3460', border: 'none', borderRadius: 4, cursor: 'pointer',
            color: 'white', textAlign: 'center', display: 'block',
          }}>
            {uploadingSubmap ? 'Subiendo...' : hasSubmap ? 'Cambiar imagen' : 'Subir imagen'}
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleSubmapFileChange} disabled={uploadingSubmap} />
          </label>
          {hasSubmap && onOpenSubmap && (
            <button onClick={() => onOpenSubmap(hexId)} style={{
              flex: 1, padding: '5px 8px', fontSize: 10, fontWeight: 600,
              background: '#a29bfe', border: 'none', borderRadius: 4, cursor: 'pointer',
              color: '#1a1a2e',
            }}>
              Abrir &#8594;
            </button>
          )}
        </div>
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
