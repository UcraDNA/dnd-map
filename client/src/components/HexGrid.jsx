import { useEffect, useRef } from 'react';
import L from 'leaflet';

function dangerColor(danger) {
  if (danger <= 1.5) return '#2ecc71';
  if (danger <= 2.5) return '#f1c40f';
  if (danger <= 3.5) return '#e67e22';
  if (danger <= 4.5) return '#e74c3c';
  return '#8e44ad';
}

export default function HexGrid({ map, mapBounds, config, hexagons, getHex, onHexClick }) {
  const layerGroupRef = useRef(null);

  useEffect(() => {
    if (!map || !mapBounds) return;

    if (layerGroupRef.current) {
      map.removeLayer(layerGroupRef.current);
    }

    const { cols, rows } = config;
    const imgH = mapBounds[1][0];
    const imgW = mapBounds[1][1];

    // Tamano del hex para que la grilla cubra EXACTAMENTE la imagen
    // pointy-top: ancho total = cols * sqrt(3)*size + sqrt(3)*size*0.5 (offset de filas impares)
    //             alto total  = rows * 1.5*size + 0.5*size
    const sizeByW = imgW / (cols * Math.sqrt(3) + Math.sqrt(3) * 0.5);
    const sizeByH = imgH / (rows * 1.5 + 0.5);
    const size = Math.min(sizeByW, sizeByH);

    const colW = Math.sqrt(3) * size;
    const rowH = 1.5 * size;

    // Sin centering: la grilla empieza en (0,0) de la imagen y llena todo
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

        var poly = L.polygon(latLngCorners, {
          color: color,
          weight: 2.5,       // borde mas grueso
          opacity: 1.0,      // borde completamente visible
          fillColor: color,
          fillOpacity: 0.18, // relleno sutil para no tapar el mapa
          interactive: true,
        });

        (function(p, hexId) {
          p.on('mouseover', function() { p.setStyle({ fillOpacity: 0.45, weight: 3 }); });
          p.on('mouseout', function() { p.setStyle({ fillOpacity: 0.18, weight: 2.5 }); });
          p.on('click', function() { onHexClick(hexId); });
        })(poly, id);

        poly.bindTooltip(
          '<div style="font-size:12px;line-height:1.6"><strong>' + label + '</strong><br/>' +
          'Peligro: ' + danger.toFixed(1) + '<br/>' +
          'Karma: ' + (k >= 0 ? '+' : '') + k.toFixed(1) + '</div>',
          { sticky: true, opacity: 0.95 }
        );
        group.addLayer(poly);

        var karmaColor = k >= 0 ? '#7dffb3' : '#ff7d7d';
        var labelIcon = L.divIcon({
          className: '',
          html: '<div style="text-align:center;pointer-events:none;text-shadow:0 0 3px #000,0 0 5px #000;line-height:1.4;transform:translate(-50%,-50%);white-space:nowrap;">' +
            '<div style="font-size:10px;color:white;opacity:0.95">D: ' + danger.toFixed(1) + '</div>' +
            '<div style="font-size:9px;color:' + karmaColor + '">K: ' + (k >= 0 ? '+' : '') + k.toFixed(1) + '</div>' +
            '<div style="font-size:8px;color:rgba(255,255,255,0.5)">' + id + '</div>' +
            '</div>',
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        group.addLayer(L.marker(centerLatLng, { icon: labelIcon, interactive: false }));
      }
    }

    group.addTo(map);
    layerGroupRef.current = group;

    return function() {
      if (layerGroupRef.current) map.removeLayer(layerGroupRef.current);
    };
  }, [map, mapBounds, config, hexagons, getHex, onHexClick]);

  return null;
}
