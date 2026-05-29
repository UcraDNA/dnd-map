import { useRef } from 'react';

export default function MapUpload({ onUploaded }) {
  const inputRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    const form = new FormData();
    form.append('map', file);
    const res = await fetch('/api/maps/upload', { method: 'POST', body: form });
    const data = await res.json();
    onUploaded(data);
  };

  return (
    <div>
      <div
        className="upload-zone"
        onClick={() => inputRef.current.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
      >
        🗺 Arrastrá o hacé clic para subir el mapa
        <br />
        <span style={{ fontSize: 11 }}>PNG, JPG, WEBP</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files[0])}
      />
    </div>
  );
}
