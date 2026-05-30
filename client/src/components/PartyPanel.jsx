import { useState, useEffect, useCallback } from 'react';

function emptyMember() {
  return { name: '', ac: 10, hpMax: 10, hpCurrent: 10, initiativeBonus: 0 };
}

export default function PartyPanel() {
  const [party, setParty] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyMember());
  const [saving, setSaving] = useState(false);

  const fetchParty = useCallback(() => {
    fetch('/api/party').then(r => r.json()).then(setParty);
  }, []);

  useEffect(() => { fetchParty(); }, [fetchParty]);

  const startNew = () => { setForm(emptyMember()); setEditing('new'); };
  const startEdit = (member) => { setForm({ ...member }); setEditing(member.id); };
  const cancelEdit = () => { setEditing(null); setForm(emptyMember()); };

  const handleSave = async () => {
    setSaving(true);
    if (editing === 'new') {
      await fetch('/api/party', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
    } else {
      await fetch('/api/party/' + editing, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
    }
    fetchParty();
    cancelEdit();
    setSaving(false);
  };

  const handleDelete = async (id) => {
    await fetch('/api/party/' + id, { method: 'DELETE' });
    fetchParty();
  };

  const f = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <div>
      {party.length === 0 && editing !== 'new' && (
        <div style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>
          No hay personajes en la party todavia.
        </div>
      )}

      {party.map(member => (
        <div key={member.id} style={{
          border: '1px solid #0f3460', borderRadius: 6, padding: '8px 10px',
          marginBottom: 6, background: editing === member.id ? 'rgba(233,69,96,0.05)' : 'transparent',
        }}>
          {editing === member.id ? (
            <MemberForm form={form} onChange={f} onSave={handleSave} onCancel={cancelEdit} saving={saving} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{member.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  AC {member.ac} &nbsp;|&nbsp; HP {member.hpCurrent}/{member.hpMax} &nbsp;|&nbsp; Init +{member.initiativeBonus}
                </div>
              </div>
              <button
                onClick={async () => {
                  await fetch('/api/party/' + member.id, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...member, hpCurrent: member.hpMax }),
                  });
                  fetchParty();
                }}
                title="Heal al maximo"
                style={{ ...btnStyle('#1a5c2a', '#2ecc71', '1px solid #2ecc71'), fontSize: 14, padding: '2px 7px', lineHeight: 1 }}
              >+</button>
              <button onClick={() => startEdit(member)} style={btnStyle('#0f3460', 'var(--muted)')}>Editar</button>
              <button onClick={() => handleDelete(member.id)} style={btnStyle('transparent', '#e74c3c', '1px solid #e74c3c')}>x</button>
            </div>
          )}
        </div>
      ))}

      {editing === 'new' && (
        <div style={{ border: '1px solid #e94560', borderRadius: 6, padding: '10px', marginBottom: 6, background: 'rgba(233,69,96,0.05)' }}>
          <div style={{ fontSize: 11, color: '#e94560', fontWeight: 700, marginBottom: 8 }}>Nuevo personaje</div>
          <MemberForm form={form} onChange={f} onSave={handleSave} onCancel={cancelEdit} saving={saving} />
        </div>
      )}

      {editing === null && (
        <button onClick={startNew} className="btn-primary" style={{ width: '100%', marginTop: 4 }}>
          + Agregar personaje
        </button>
      )}
    </div>
  );
}

function MemberForm({ form, onChange, onSave, onCancel, saving }) {
  return (
    <div>
      <div className="grid-row">
        <label>Nombre</label>
        <input type="text" value={form.name} onChange={e => onChange('name', e.target.value)} placeholder="Nombre..." autoFocus />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>AC</div>
          <input type="number" value={form.ac} min={0} onChange={e => onChange('ac', parseFloat(e.target.value) || 0)}
            style={{ width: '100%', padding: '4px 6px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', fontSize: 13 }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>HP Max</div>
          <input type="number" value={form.hpMax} min={1} onChange={e => onChange('hpMax', parseFloat(e.target.value) || 1)}
            style={{ width: '100%', padding: '4px 6px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', fontSize: 13 }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>HP Actual</div>
          <input type="number" value={form.hpCurrent} onChange={e => onChange('hpCurrent', parseFloat(e.target.value) || 0)}
            style={{ width: '100%', padding: '4px 6px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', fontSize: 13 }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>Bonus Init</div>
          <input type="number" value={form.initiativeBonus} onChange={e => onChange('initiativeBonus', parseFloat(e.target.value) || 0)}
            style={{ width: '100%', padding: '4px 6px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', fontSize: 13 }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onSave} disabled={saving} className="btn-primary" style={{ flex: 1, padding: '5px 0' }}>
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
        <button onClick={onCancel} style={{ ...btnStyle('#0f3460', 'var(--muted)'), flex: 1, padding: '5px 0' }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function btnStyle(bg, color, border = 'none') {
  return {
    padding: '3px 8px', fontSize: 10, fontWeight: 700,
    background: bg, border, borderRadius: 4, cursor: 'pointer', color,
  };
}
