import { useEffect, useRef } from 'react';
import L from 'leaflet';

function dangerColor(danger) {
  if (danger <= 1.5) return '#2ecc71';
  if (danger <= 2.5) return '#f1c40f';
  if (danger <= 3.5) return '#e67e22';
  if (danger <= 4.5) return '#e74c3c';
  return '#8e44ad';
}

let popupZCounter = 10000;

function makeMdPopup(hexId, label, noteApiBase) {
  const base = noteApiBase || '/api/notes';
  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed',
    'top:' + (80 + Math.random() * 60) + 'px',
    'left:' + (360 + Math.random() * 80) + 'px',
    'width:320px',
    'max-height:480px',
    'background:#16213e',
    'border:1px solid #e94560',
    'border-radius:8px',
    'box-shadow:0 4px 24px rgba(0,0,0,0.6)',
    'z-index:' + (++popupZCounter),
    'display:flex',
    'flex-direction:column',
    'overflow:hidden',
    'font-family:Segoe UI,sans-serif',
  ].join(';');

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#0f3460;cursor:move;user-select:none;flex-shrink:0';
  const title = document.createElement('span');
  title.style.cssText = 'font-size:13px;font-weight:700;color:#eee;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px';
  title.textContent = label || hexId;
  const closeBtn = document.createElement('button');
  closeBtn.style.cssText = 'background:none;border:none;color:#e94560;font-size:18px;cursor:pointer;line-height:1;padding:0;margin-left:8px;flex-shrink:0';
  closeBtn.textContent = 'x';
  closeBtn.addEventListener('click', () => el.remove());
  header.appendChild(title);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.style.cssText = 'padding:14px;overflow-y:auto;flex:1;color:#eee;font-size:13px;line-height:1.7';
  body.innerHTML = '<span style="color:#888;font-size:12px">Cargando...</span>';

  el.appendChild(header);
  el.appendChild(body);
  document.body.appendChild(el);

  let dragging = false, ox = 0, oy = 0;
  header.addEventListener('mousedown', e => {
    dragging = true;
    ox = e.clientX - el.offsetLeft;
    oy = e.clientY - el.offsetTop;
    el.style.zIndex = ++popupZCounter;
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    el.style.left = (e.clientX - ox) + 'px';
    el.style.top = (e.clientY - oy) + 'px';
  });
  document.addEventListener('mouseup', () => { dragging = false; });
  el.addEventListener('mousedown', () => { el.style.zIndex = ++popupZCounter; });

  fetch(base + '/' + hexId)
    .then(r => r.text())
    .then(md => {
      if (!md.trim()) {
        body.innerHTML = '<span style="color:#888;font-size:12px">Sin notas para este hexagono.</span>';
        return;
      }
      body.innerHTML = renderMd(md);
    });

  return el;
}

// Menú contextual (click derecho) — singleton
let ctxMenuEl = null;
function removeCtxMenu() {
  if (ctxMenuEl) { ctxMenuEl.remove(); ctxMenuEl = null; }
}

function showCtxMenu(x, y, items) {
  removeCtxMenu();
  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed',
    'top:' + y + 'px',
    'left:' + x + 'px',
    'background:#16213e',
    'border:1px solid #0f3460',
    'border-radius:6px',
    'box-shadow:0 4px 16px rgba(0,0,0,0.6)',
    'z-index:99999',
    'min-width:160px',
    'padding:4px 0',
    'font-family:Segoe UI,sans-serif',
  ].join(';');

  items.forEach(item => {
    const row = document.createElement('div');
    row.style.cssText = 'padding:8px 14px;font-size:12px;cursor:pointer;color:#eee;display:flex;align-items:center;gap:8px';
    if (item.disabled) {
      row.style.opacity = '0.4';
      row.style.cursor = 'default';
    } else {
      row.addEventListener('mouseenter', () => { row.style.background = '#0f3460'; });
      row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        removeCtxMenu();
        item.action();
      });
    }
    row.innerHTML = '<span>' + (item.icon || '') + '</span><span>' + item.label + '</span>';
    el.appendChild(row);
  });

  document.body.appendChild(el);
  ctxMenuEl = el;

  // Cerrar al click fuera
  setTimeout(() => {
    document.addEventListener('click', removeCtxMenu, { once: true });
  }, 0);
}

function renderMd(md) {
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3 style="color:#e94560;margin:10px 0 4px;font-size:13px">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="color:#e94560;margin:12px 0 6px;font-size:15px">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="color:#e94560;margin:0 0 10px;font-size:17px">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li style="margin:2px 0;padding-left:8px">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, s => '<ul style="padding-left:16px;margin:6px 0">' + s + '</ul>')
    .replace(/\n\n/g, '</p><p style="margin:6px 0">')
    .replace(/^(?!<[hul])(.+)$/gm, (m) => m.startsWith('<') ? m : '<p style="margin:4px 0">' + m + '</p>');
}

// hexId: el id del hex en el mapa PRINCIPAL (para upload de sub-mapa)
// noteApiBase: base URL para notas (default '/api/notes')
// onOpenSubmap / onUploadSubmap: callbacks opcionales para el menú contextual
export default function HexGrid({ map, mapBounds, config, hexagons, notedHexIds, getHex, onHexClick, noteApiBase, submapHexIds, onOpenSubmap, onUploadSubmap, hexVisible = true }) {
  const layerGroupRef = useRef(null);

  useEffect(() => {
    if (!map || !mapBounds) return;

    if (layerGroupRef.current) {
      map.removeLayer(layerGroupRef.current);
      layerGroupRef.current = null;
    }

    if (!hexVisible) return;

    const { cols, rows } = config;
    const imgH = mapBounds[1][0];
    const imgW = mapBounds[1][1];

    const sizeByW = imgW / (cols * Math.sqrt(3) + Math.sqrt(3) * 0.5);
    const sizeByH = imgH / (rows * 1.5 + 0.5);
    const autoSize = Math.min(sizeByW, sizeByH);
    const size = (config.hexSize && config.hexSize > 0) ? config.hexSize : autoSize;

    const colW = Math.sqrt(3) * size;
    const rowH = 1.5 * size;
    const offX = colW / 2;
    const offY = size;

    const group = L.layerGroup();

    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        var id = col + '-' + row;
        var hex = getHex(id, col, row);

        var imgX = offX + col * colW + (row % 2 === 1 ? colW / 2 : 0);
        var imgY = offY + row * rowH;

        var latLngCorners = [];
        for (var i = 0; i < 6; i++) {
          var angle = (Math.PI / 180) * (60 * i - 30);
          var ex = imgX + size * Math.cos(angle);
          var ey = imgY + size * Math.sin(angle);
          latLngCorners.push(L.latLng(imgH - ey, ex));
        }

        var centerLatLng = L.latLng(imgH - imgY, imgX);
        var color = dangerColor(hex.danger);
        var k = parseFloat(hex.karma);
        var danger = parseFloat(hex.danger);
        var label = hex.label || id;
        var hasNote = notedHexIds && notedHexIds.has(id);
        var hasSubmap = submapHexIds && submapHexIds.has(id);

        var poly = L.polygon(latLngCorners, {
          color: color,
          weight: 2.5,
          opacity: 1.0,
          fillColor: color,
          fillOpacity: 0.18,
          interactive: true,
        });

        (function(p, hexId, hexLabel, hexHasSubmap) {
          p.on('mouseover', function() { p.setStyle({ fillOpacity: 0.45, weight: 3 }); });
          p.on('mouseout', function() { p.setStyle({ fillOpacity: 0.18, weight: 2.5 }); });
          p.on('click', function(e) { onHexClick(hexId); });
          p.on('contextmenu', function(e) {
            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e);
            var items = [];
            if (onUploadSubmap) {
              items.push({
                icon: '&#128444;',
                label: hexHasSubmap ? 'Reemplazar sub-mapa' : 'Subir sub-mapa',
                action: () => onUploadSubmap(hexId),
              });
            }
            if (onOpenSubmap) {
              items.push({
                icon: '&#128269;',
                label: 'Abrir sub-mapa',
                disabled: !hexHasSubmap,
                action: () => { if (hexHasSubmap) onOpenSubmap(hexId); },
              });
            }
            if (items.length > 0) {
              showCtxMenu(e.originalEvent.clientX, e.originalEvent.clientY, items);
            }
          });
        })(poly, id, label, hasSubmap);

        poly.bindTooltip(
          '<div style="font-size:12px;line-height:1.6"><strong>' + label + '</strong><br/>' +
          'Peligro: ' + danger.toFixed(1) + '<br/>' +
          'Karma: ' + (k >= 0 ? '+' : '') + k.toFixed(1) + '</div>',
          { sticky: true, opacity: 0.95 }
        );
        group.addLayer(poly);

        // Labels
        var karmaColor = k >= 0 ? '#7dffb3' : '#ff7d7d';
        var noteIcon = hasNote ? '<div style="font-size:' + Math.max(8, size * 0.2) + 'px;color:#f1c40f;opacity:0.95">&#9998;</div>' : '';
        var submapIcon = hasSubmap ? '<div style="font-size:' + Math.max(7, size * 0.16) + 'px;color:#a29bfe;opacity:0.9">&#9783;</div>' : '';

        var labelIcon = L.divIcon({
          className: '',
          html: '<div style="text-align:center;pointer-events:none;text-shadow:0 0 3px #000,0 0 5px #000;line-height:1.4;transform:translate(-50%,-50%);white-space:nowrap;">' +
            noteIcon + submapIcon +
            '<div style="font-size:10px;color:white;opacity:0.95">D: ' + danger.toFixed(1) + '</div>' +
            '<div style="font-size:9px;color:' + karmaColor + '">K: ' + (k >= 0 ? '+' : '') + k.toFixed(1) + '</div>' +
            '<div style="font-size:8px;color:rgba(255,255,255,0.5)">' + id + '</div>' +
            '</div>',
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        group.addLayer(L.marker(centerLatLng, { icon: labelIcon, interactive: false }));

        // Icono de nota clicable
        if (hasNote) {
          var noteMarkerIcon = L.divIcon({
            className: '',
            html: '<div title="Ver nota" style="' +
              'width:18px;height:18px;background:#f1c40f;border-radius:50%;' +
              'display:flex;align-items:center;justify-content:center;' +
              'font-size:11px;cursor:pointer;border:2px solid #fff;' +
              'box-shadow:0 1px 4px rgba(0,0,0,0.5);transform:translate(-9px,-9px);' +
              '">&#9998;</div>',
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          });

          var notePos = L.latLng(imgH - (imgY - size * 0.5), imgX + size * 0.5);
          var noteMarker = L.marker(notePos, { icon: noteMarkerIcon, interactive: true, zIndexOffset: 1000 });

          (function(hexId, hexLabel) {
            noteMarker.on('click', function(e) {
              L.DomEvent.stopPropagation(e);
              makeMdPopup(hexId, hexLabel, noteApiBase);
            });
          })(id, label);

          group.addLayer(noteMarker);
        }

        // Icono de sub-mapa clicable
        if (hasSubmap && onOpenSubmap) {
          var submapMarkerIcon = L.divIcon({
            className: '',
            html: '<div title="Abrir sub-mapa" style="' +
              'width:18px;height:18px;background:#a29bfe;border-radius:50%;' +
              'display:flex;align-items:center;justify-content:center;' +
              'font-size:11px;cursor:pointer;border:2px solid #fff;' +
              'box-shadow:0 1px 4px rgba(0,0,0,0.5);transform:translate(-9px,-9px);' +
              '">&#9783;</div>',
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          });

          var submapPos = L.latLng(imgH - (imgY - size * 0.5), imgX - size * 0.5);
          var submapMarker = L.marker(submapPos, { icon: submapMarkerIcon, interactive: true, zIndexOffset: 1000 });

          (function(hexId) {
            submapMarker.on('click', function(e) {
              L.DomEvent.stopPropagation(e);
              onOpenSubmap(hexId);
            });
          })(id);

          group.addLayer(submapMarker);
        }
      }
    }

    group.addTo(map);
    layerGroupRef.current = group;

    return function() {
      if (layerGroupRef.current) map.removeLayer(layerGroupRef.current);
    };
  }, [map, mapBounds, config, hexagons, notedHexIds, submapHexIds, getHex, onHexClick, noteApiBase, onOpenSubmap, onUploadSubmap, hexVisible]);

  return null;
}
