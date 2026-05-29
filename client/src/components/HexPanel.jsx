import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

export default function HexPanel({ hexId, hexData, onUpdate }) {
  const [danger, setDanger] = useState('');
  const [karma, setKarma] = useState('');
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [noteTab, setNoteTab] = useState('edit'); // 'edit' | 'preview'
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hexId) return;
    setDanger(String(hexData?.danger ?? 3.0));
    setKarma(String(hexData?.karma ?? 1.0));
    setLabel(hexData?.label ?? '');
    // Load note
    fetch(`/api/notes/${hexId}`)
      .then(r => r.text())
      .then(setNote);
  }, [hexId, hexData]);

  if (!hexId) {
    return (
      <div style={{ color: 'var(--muted)', fontSize: 13, padding: 8 }}>
        Haz clic en un hexágono para editarlo.
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(hexId, {
      danger: parseFloat(danger) || 3.0,
      karma: parseFloat(karma) || 1.0,
      label,
    });
    await fetch(`/api/notes/${hexId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: note }),
    });
    setSaving(false);
  };

  return (
    <div className="hex-panel">
      <div className="hex-id">Hexágono: <strong>{hexId}</strong></div>

      <div className="grid-row">
        <label>Etiqueta</label>
        <input
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Nombre del lugar..."
        />
      </div>

      <div className="grid-row">
        <label>⚔ Peligro</label>
        <input
          type="number"
          value={danger}
          min={1} max={5} step={0.1}
          onChange={e => setDanger(e.target.value)}
        />
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, marginTop: -4 }}>
        1 = seguro &nbsp; 3 = normal &nbsp; 5 = mortal
      </div>

      <div className="grid-row">
        <label>✦ Karma</label>
        <input
          type="number"
          value={karma}
          step={0.1}
          onChange={e => setKarma(e.target.value)}
        />
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12, marginTop: -4 }}>
        Puede ser positivo o negativo (ej: -2.5, 0, 3.7)
      </div>

      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Notas (Markdown)</div>
      <div className="tabs">
        <div className={`tab ${noteTab === 'edit' ? 'active' : ''}`} onClick={() => setNoteTab('edit')}>✏ Editar</div>
        <div className={`tab ${noteTab === 'preview' ? 'active' : ''}`} onClick={() => setNoteTab('preview')}>👁 Vista previa</div>
      </div>

      {noteTab === 'edit' ? (
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder={`# ${hexId}\n\nDescripción del área, encuentros, PNJs...`}
        />
      ) : (
        <div className="md-preview" style={{ border: '1px solid var(--border)', borderRadius: 4, padding: 10, minHeight: 200, background: 'var(--bg)' }}>
          {note ? <ReactMarkdown>{note}</ReactMarkdown> : <span style={{ color: 'var(--muted)' }}>Sin notas aún.</span>}
        </div>
      )}

      <button className="btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={handleSave} disabled={saving}>
        {saving ? 'Guardando...' : '💾 Guardar'}
      </button>
    </div>
  );
}
