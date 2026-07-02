import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client.js';
import { useTheme } from '../context/ThemeContext.jsx';

// Public certificate verification page (Module 17). No login required.
export default function VerifyCertificate() {
  const { certificateId } = useParams();
  const { theme, toggleTheme } = useTheme();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/public/verify/${certificateId}`)
      .then((res) => setResult(res.data))
      .catch(() => setResult({ valid: false }))
      .finally(() => setLoading(false));
  }, [certificateId]);

  return (
    <div className="public-shell">
      <div className="public-topbar">
        <span className="navbar-brand">📋 Certificate Verification</span>
        <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      {loading ? (
        <div className="card"><p className="muted">Verifying…</p></div>
      ) : result?.valid ? (
        <div className="card empty-state success">
          <h2>✓ Valid Certificate</h2>
          <div className="score-ring pass">{result.percentage}%</div>
          <p>
            <strong>{result.candidateName}</strong> passed
            <br />
            <strong>{result.assessmentTitle}</strong>
          </p>
          <p className="muted small">Issued {new Date(result.issuedAt).toDateString()}</p>
          <p className="muted small">Certificate ID: {certificateId}</p>
        </div>
      ) : (
        <div className="card empty-state">
          <h2>✗ Not Found</h2>
          <p className="muted">No certificate matches this ID. It may be invalid or revoked.</p>
        </div>
      )}
    </div>
  );
}
