import { useState, useEffect, useRef, useCallback } from 'react';

function roll(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function hpColor(current, max) {
  const pct = max > 0 ? current / max : 0;
  if (pct <= 0) return '#555';
  if (pct <= 0.25) return '#e74c3c';
  if (pct <= 0.5) return '#e67e22';
  if (pct <= 0.75) return '#f1c40f';
  return '#2ecc71';
}

let zTop = 20000;

export default function CombatPopup({ onClose }) {
  const elRef = useRef(null);
  const [combatants, setCombatants] = useState([]);
  const [addingEnemy, setAddingEnemy] = useState(false);
  const [enemyForm, setEnemyForm] = useState({ name: '', ac: 10, hpMax: 10, hpCurrent: 10, initiativeBonus: 0 });
  const [dmgInputs, setDmgInputs] = useState({});
  const [deathSaves, setDeathSaves] = useState({}); // { [id]: { success: [f,f,f], fail: [f,f,f] } }
  const [round, setRound] = useState(1);
  const [activeIdx, setActiveIdx] = useState(0);

  // Drag del popup
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    let dragging = false, ox = 0, oy = 0;
    const header = el.querySelector('.combat-header');
    const onDown = (e) => {
      dragging = true;
      ox = e.clientX - el.offsetLeft;
      oy = e.clientY - el.offsetTop;
      el.style.zIndex = ++zTop;
      e.preventDefault();
    };
    const onMove = (e) => {
      if (!dragging) return;
      el.style.left = (e.clientX - ox) + 'px';
      el.style.top = (e.clientY - oy) + 'px';
    };
    const onUp = () => { dragging = false; };
    header.addEventListener('mousedown', onDown);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      header.removeEventListener('mousedown', onDown);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  // Drag-to-reorder
  const dragState = useRef({ draggingId: null });

  const onRowDragStart = useCallback((e, id) => {
    dragState.current.draggingId = id;
    e.dataTransfer.effectAllowed = 'move';
    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:fixed;top:-999px;left:-999px;width:1px;height:1px;';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  }, []);

  const onRowDragOver = useCallback((e) => { e.preventDefault(); }, []);

  const onRowDrop = useCallback((e, targetId) => {
    e.preventDefault();
    const { draggingId } = dragState.current;
    if (!draggingId || draggingId === targetId) return;
    setCombatants(prev => {
      const next = [...prev];
      const fromIdx = next.findIndex(c => c.id === draggingId);
      const toIdx = next.findIndex(c => c.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [item] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, item);
      return next;
    });
    dragState.current.draggingId = null;
  }, []);

  const onRowDragEnd = useCallback(() => { dragState.current.draggingId = null; }, []);

  // Cargar party
  useEffect(() => {
    fetch('/api/party')
      .then(r => r.json())
      .then(party => {
        setCombatants(party.map(p => ({
          ...p,
          initiative: null,
          isEnemy: false,
          hpCurrent: p.hpCurrent ?? p.hpMax,
        })));
      });
  }, []);

  const rollInitiative = useCallback((id) => {
    setCombatants(prev => prev.map(c =>
      c.id === id ? { ...c, initiative: roll(20) + (c.initiativeBonus || 0) } : c
    ));
  }, []);

  const rollAllInitiative = useCallback(() => {
    setCombatants(prev => {
      const rolled = prev.map(c => ({ ...c, initiative: roll(20) + (c.initiativeBonus || 0) }));
      return [...rolled].sort((a, b) => b.initiative - a.initiative);
    });
    setActiveIdx(0);
    setRound(1);
  }, []);

  const setInitiative = useCallback((id, val) => {
    setCombatants(prev => prev.map(c =>
      c.id === id ? { ...c, initiative: val === '' ? null : parseInt(val) || 0 } : c
    ));
  }, []);

  const sortByInitiative = useCallback(() => {
    setCombatants(prev => [...prev].sort((a, b) => (b.initiative || 0) - (a.initiative || 0)));
    setActiveIdx(0);
    setRound(1);
  }, []);

  const nextTurn = useCallback(() => {
    setCombatants(prev => {
      const newIdx = (activeIdx + 1) % prev.length;
      if (newIdx === 0) setRound(r => r + 1);
      setActiveIdx(newIdx);
      return prev;
    });
  }, [activeIdx]);

  const toggleType = useCallback((id) => {
    setCombatants(prev => prev.map(c =>
      c.id === id ? { ...c, isEnemy: !c.isEnemy } : c
    ));
  }, []);

  const applyDmg = useCallback((id, amount) => {
    setCombatants(prev => prev.map(c =>
      c.id === id ? { ...c, hpCurrent: Math.max(0, Math.min(c.hpMax, c.hpCurrent - amount)) } : c
    ));
    setDmgInputs(prev => ({ ...prev, [id]: '' }));
  }, []);

  const setHp = useCallback((id, val) => {
    setCombatants(prev => prev.map(c =>
      c.id === id ? { ...c, hpCurrent: Math.max(0, Math.min(c.hpMax, parseInt(val) || 0)) } : c
    ));
  }, []);

  const removeCombatant = useCallback((id) => {
    setCombatants(prev => {
      const next = prev.filter(c => c.id !== id);
      setActiveIdx(i => Math.min(i, Math.max(0, next.length - 1)));
      return next;
    });
  }, []);

  const addEnemy = useCallback((forceEnemy = true) => {
    const enemy = {
      ...enemyForm,
      id: 'enemy-' + Date.now(),
      isEnemy: forceEnemy,
      initiative: null,
      hpCurrent: parseFloat(enemyForm.hpMax) || 10,
    };
    setCombatants(prev => [...prev, enemy]);
    setEnemyForm({ name: '', ac: 10, hpMax: 10, hpCurrent: 10, initiativeBonus: 0 });
    setAddingEnemy(false);
  }, [enemyForm]);

  const resetCombat = useCallback(() => {
    setCombatants(prev => prev.map(c => ({ ...c, initiative: null, hpCurrent: c.hpMax })));
    setDeathSaves({});
    setActiveIdx(0);
    setRound(1);
  }, []);

  const toggleDeathSave = useCallback((id, type, idx) => {
    setDeathSaves(prev => {
      const cur = prev[id] || { success: [false, false, false], fail: [false, false, false] };
      const arr = [...cur[type]];
      arr[idx] = !arr[idx];
      return { ...prev, [id]: { ...cur, [type]: arr } };
    });
  }, []);

  return (
    <div ref={elRef} style={{
      position: 'fixed', top: 80, right: 20,
      width: 420, maxHeight: '85vh',
      background: '#16213e',
      border: '1px solid #e94560',
      borderRadius: 8,
      boxShadow: '0 4px 32px rgba(0,0,0,0.7)',
      zIndex: zTop,
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Segoe UI, sans-serif',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div className="combat-header" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', background: '#0f3460',
        cursor: 'move', userSelect: 'none', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#eee' }}>&#9876; Combate</span>
          <span style={{ fontSize: 12, color: '#a29bfe' }}>Ronda {round}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={nextTurn} disabled={combatants.length === 0} style={{
            padding: '5px 12px', fontSize: 12, fontWeight: 700,
            background: '#e94560', border: 'none', borderRadius: 4, cursor: 'pointer', color: 'white',
            opacity: combatants.length === 0 ? 0.4 : 1,
          }}>Siguiente &#8594;</button>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#e94560', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 0,
          }}>x</button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 6, padding: '8px 10px', borderBottom: '1px solid #0f3460', flexShrink: 0, flexWrap: 'wrap' }}>
        <button onClick={rollAllInitiative} style={tbBtn('#2ecc71', '#000')}>&#127922; Tirar todos</button>
        <button onClick={sortByInitiative} style={tbBtn('#a29bfe', '#000')}>&#8597; Ordenar init</button>
        <button onClick={() => setAddingEnemy(v => !v)} style={tbBtn(addingEnemy ? '#555' : '#e67e22', addingEnemy ? '#eee' : '#000')}>
          {addingEnemy ? 'Cancelar' : '+ Combatiente'}
        </button>
        <button onClick={resetCombat} style={tbBtn('#444', '#eee')}>Reset</button>
      </div>

      {/* Formulario */}
      {addingEnemy && (
        <div style={{ padding: '8px 10px', borderBottom: '1px solid #0f3460', flexShrink: 0, background: 'rgba(231,76,60,0.07)' }}>
          <div style={{ fontSize: 11, color: '#e74c3c', fontWeight: 700, marginBottom: 6 }}>Nuevo combatiente</div>
          <input
            type="text" placeholder="Nombre..." value={enemyForm.name}
            onChange={e => setEnemyForm(f => ({ ...f, name: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && addEnemy(true)}
            style={inputStyle({ marginBottom: 6, width: '100%', boxSizing: 'border-box' })}
            autoFocus
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, marginBottom: 6 }}>
            {[['AC', 'ac'], ['HP Max', 'hpMax'], ['HP Act', 'hpCurrent'], ['Init+', 'initiativeBonus']].map(([label, key]) => (
              <div key={key}>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
                <input type="number" value={enemyForm[key]}
                  onChange={e => setEnemyForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))}
                  style={inputStyle({ width: '100%', boxSizing: 'border-box' })} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => addEnemy(false)} style={{ ...tbBtn('#74b9ff', '#000'), flex: 1, padding: '6px 0', fontSize: 11 }}>+ Party</button>
            <button onClick={() => addEnemy(true)} style={{ ...tbBtn('#e74c3c', 'white'), flex: 1, padding: '6px 0', fontSize: 11 }}>+ Enemigo</button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '6px 8px' }}>
        {combatants.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: 12, padding: 8, textAlign: 'center' }}>
            No hay combatientes. Carga la party o agrega combatientes.
          </div>
        )}
        {combatants.map((c, idx) => {
          const isActive = idx === activeIdx;
          const isDead = c.hpCurrent <= 0;
          const hpPct = c.hpMax > 0 ? Math.max(0, c.hpCurrent / c.hpMax) : 0;
          const dmgVal = dmgInputs[c.id] ?? '';
          const ds = deathSaves[c.id] || { success: [false, false, false], fail: [false, false, false] };

          return (
            <div
              key={c.id}
              draggable
              onDragStart={e => onRowDragStart(e, c.id)}
              onDragOver={onRowDragOver}
              onDrop={e => onRowDrop(e, c.id)}
              onDragEnd={onRowDragEnd}
              style={{
                borderRadius: 6, padding: '8px 10px', marginBottom: 6,
                border: isActive ? '2px solid #e94560' : '1px solid #0f3460',
                background: isActive ? 'rgba(233,69,96,0.1)' : isDead ? 'rgba(60,0,0,0.4)' : '#0d1b33',
                opacity: isDead ? 0.75 : 1,
                transition: 'border 0.15s, background 0.15s',
              }}
            >
              {/* Fila 1: handle + turno + nombre + init */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                <span
                  draggable={false}
                  style={{ color: '#3a4a6a', fontSize: 18, cursor: 'grab', flexShrink: 0, lineHeight: 1, userSelect: 'none' }}
                  onMouseDown={e => e.stopPropagation()}
                >&#8942;</span>

                {isActive && <span style={{ color: '#e94560', fontSize: 16, lineHeight: 1, flexShrink: 0 }}>&#9654;</span>}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: c.isEnemy ? '#ff7675' : '#74b9ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.name}
                    {isDead && <span style={{ fontSize: 10, color: '#e74c3c', marginLeft: 6, fontWeight: 400 }}>[KO]</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>AC {c.ac}</span>
                    <button
                      onClick={() => toggleType(c.id)}
                      onMouseDown={e => e.stopPropagation()}
                      style={{
                        fontSize: 9, padding: '1px 6px', borderRadius: 3, cursor: 'pointer', border: 'none', fontWeight: 700,
                        background: c.isEnemy ? 'rgba(231,76,60,0.2)' : 'rgba(116,185,255,0.2)',
                        color: c.isEnemy ? '#ff7675' : '#74b9ff',
                      }}
                    >{c.isEnemy ? 'Enemigo' : 'Party'}</button>
                  </div>
                </div>

                {/* INIT grande */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, letterSpacing: 1 }}>INIT</div>
                  <input
                    type="number"
                    value={c.initiative ?? ''}
                    onChange={e => setInitiative(c.id, e.target.value)}
                    onMouseDown={e => e.stopPropagation()}
                    placeholder="—"
                    style={{
                      width: 54, height: 38, textAlign: 'center',
                      fontSize: 22, fontWeight: 900, color: '#f1c40f',
                      background: '#0d0d1a', border: '1px solid #1a3a6a',
                      borderRadius: 6, padding: 0,
                      MozAppearance: 'textfield',
                      appearance: 'textfield',
                    }}
                  />
                  <button
                    onClick={() => rollInitiative(c.id)}
                    onMouseDown={e => e.stopPropagation()}
                    style={{ fontSize: 10, padding: '2px 6px', background: '#0f3460', border: 'none', borderRadius: 3, cursor: 'pointer', color: '#f1c40f', fontWeight: 700 }}
                  >&#127922; d20</button>
                </div>

                <button
                  onClick={() => removeCombatant(c.id)}
                  onMouseDown={e => e.stopPropagation()}
                  style={{ background: 'none', border: 'none', color: '#444', fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
                >x</button>
              </div>

              {/* Barra HP */}
              <div style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>HP</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: hpColor(c.hpCurrent, c.hpMax) }}>
                    {c.hpCurrent} / {c.hpMax}
                  </span>
                </div>
                <div style={{ height: 8, background: '#0d0d1a', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: (hpPct * 100) + '%',
                    background: hpColor(c.hpCurrent, c.hpMax),
                    transition: 'width 0.3s, background 0.3s',
                    borderRadius: 4,
                  }} />
                </div>
              </div>

              {/* Fila de daño — todo en línea, altura fija */}
              <div style={{ display: 'flex', gap: 5, height: 38 }}>
                <input
                  type="number" min={0} placeholder="0"
                  value={dmgVal}
                  onChange={e => setDmgInputs(prev => ({ ...prev, [c.id]: e.target.value }))}
                  onMouseDown={e => e.stopPropagation()}
                  style={{
                    width: 58, height: '100%', boxSizing: 'border-box',
                    textAlign: 'center', fontSize: 16, fontWeight: 700,
                    background: '#0d0d1a', border: '2px solid #1a3a6a', borderRadius: 6,
                    color: '#eee', padding: 0,
                  }}
                />
                <button onClick={() => applyDmg(c.id, parseInt(dmgVal) || 0)} onMouseDown={e => e.stopPropagation()}
                  style={{ ...tbBtn('#e74c3c', 'white'), flex: 1, height: '100%', fontSize: 13 }}>&#8209;DMG</button>
                <button onClick={() => applyDmg(c.id, -(parseInt(dmgVal) || 0))} onMouseDown={e => e.stopPropagation()}
                  style={{ ...tbBtn('#2ecc71', '#000'), flex: 1, height: '100%', fontSize: 13 }}>+HEAL</button>
                <button onClick={() => setHp(c.id, c.hpMax)} onMouseDown={e => e.stopPropagation()}
                  style={{ ...tbBtn('#0f3460', '#8ab'), height: '100%', fontSize: 13, padding: '0 12px' }}>Full</button>
              </div>

              {/* Death saves — solo si KO */}
              {isDead && (
                <div style={{
                  marginTop: 8, padding: '7px 10px',
                  background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.25)',
                  borderRadius: 5,
                }}>
                  <div style={{ fontSize: 10, color: '#e74c3c', fontWeight: 700, marginBottom: 6, letterSpacing: 1 }}>DEATH SAVES</div>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    {/* Successes */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: '#2ecc71', fontWeight: 600, minWidth: 32 }}>Save</span>
                      {ds.success.map((checked, i) => (
                        <DeathCheckbox key={i} checked={checked} color="#2ecc71"
                          onClick={() => toggleDeathSave(c.id, 'success', i)} />
                      ))}
                    </div>
                    {/* Fails */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: '#e74c3c', fontWeight: 600, minWidth: 32 }}>Fail</span>
                      {ds.fail.map((checked, i) => (
                        <DeathCheckbox key={i} checked={checked} color="#e74c3c"
                          onClick={() => toggleDeathSave(c.id, 'fail', i)} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DeathCheckbox({ checked, color, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 22, height: 22, borderRadius: 4,
        border: `2px solid ${color}`,
        background: checked ? color : 'transparent',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s',
        flexShrink: 0,
      }}
    >
      {checked && <span style={{ color: '#000', fontSize: 13, fontWeight: 900, lineHeight: 1 }}>&#10003;</span>}
    </div>
  );
}

function tbBtn(bg, color) {
  return {
    padding: '4px 8px', fontSize: 10, fontWeight: 700,
    background: bg, border: 'none', borderRadius: 4, cursor: 'pointer', color,
  };
}

function inputStyle(extra = {}) {
  return {
    padding: '4px 6px',
    background: '#0d0d1a',
    border: '1px solid #0f3460',
    borderRadius: 4,
    color: '#eee',
    fontSize: 12,
    ...extra,
  };
}
