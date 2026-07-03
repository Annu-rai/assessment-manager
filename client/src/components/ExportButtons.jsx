import { useState } from 'react';
import api from '../api/client.js';

const LABELS = { csv: 'CSV', xlsx: 'Excel', pdf: 'PDF' };

/**
 * Export buttons (Module 26). Downloads a protected export as a file via the
 * JWT-authenticated API (fetch as blob, then trigger a browser download).
 */
export default function ExportButtons({ path, name, formats = ['csv', 'xlsx', 'pdf'] }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const download = async (format) => {
    setBusy(format);
    setError('');
    try {
      const res = await api.get(`${path}?format=${format}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      setError(err.message || 'Export failed');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="export-buttons">
      <span className="muted small">Export:</span>
      {formats.map((f) => (
        <button
          key={f}
          className="btn btn-ghost btn-sm"
          onClick={() => download(f)}
          disabled={!!busy}
          title={`Download as ${LABELS[f]}`}
        >
          {busy === f ? '…' : LABELS[f]}
        </button>
      ))}
      {error && <span className="alert alert-error">{error}</span>}
    </div>
  );
}
