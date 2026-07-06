import { useState } from 'react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

// White-label branding settings (Module 23) — org admin only.
export default function Branding() {
  const { organization, setOrganization } = useAuth();
  const [form, setForm] = useState({
    name: organization?.name || '',
    logoUrl: organization?.logoUrl || '',
    primaryColor: organization?.primaryColor || '#4f46e5',
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onLogoFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/uploads', fd);
      const url = `${import.meta.env.VITE_API_URL || ''}${data.url}`;
      setForm((f) => ({ ...f, logoUrl: url }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const { data } = await api.put('/organizations/me', form);
      setOrganization(data); // updates navbar + theme immediately
      setNotice('Branding saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Branding</h1>
          <p className="muted">White-label your organization's look.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <div className="branding-grid">
        <section className="card">
          <label>
            Organization name
            <input name="name" value={form.name} onChange={onChange} placeholder="Acme Inc." />
          </label>

          <label>
            Logo URL
            <input name="logoUrl" value={form.logoUrl} onChange={onChange} placeholder="https://…/logo.png" />
          </label>
          <div className="inline-field">
            <span className="muted small">…or upload:</span>
            <input type="file" accept="image/*" onChange={onLogoFile} disabled={uploading} />
            {uploading && <span className="muted small">Uploading…</span>}
          </div>

          <label className="inline-field">
            Primary color
            <input type="color" name="primaryColor" value={form.primaryColor} onChange={onChange} />
            <span className="muted small">{form.primaryColor}</span>
          </label>

          <div className="card-actions">
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save branding'}
            </button>
          </div>
        </section>

        {/* Live preview */}
        <section className="card brand-preview" style={{ '--preview': form.primaryColor }}>
          <h2>Preview</h2>
          <div className="brand-navbar">
            {form.logoUrl ? (
              <img src={form.logoUrl} alt="logo" className="brand-logo" />
            ) : (
              <span className="brand-emoji">📋</span>
            )}
            <span className="brand-name">{form.name || 'Your Organization'}</span>
          </div>
          <button className="brand-btn">Primary button</button>
          <p className="muted small">This is how your logo, name, and accent color will appear.</p>
        </section>
      </div>
    </div>
  );
}
