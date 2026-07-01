import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';

// KPI cards (Module 3). Each card shows a headline number and a label.
const KPI_CARDS = [
  { key: 'totalAssessments', label: 'Assessments', icon: '📝' },
  { key: 'todaysAssessments', label: 'Created Today', icon: '📅' },
  { key: 'completed', label: 'Completed', icon: '✅' },
  { key: 'pending', label: 'Pending', icon: '⏳' },
  { key: 'passRate', label: 'Pass %', icon: '🎯', suffix: '%' },
  { key: 'averageScore', label: 'Avg Score', icon: '📊', suffix: '%' },
  { key: 'candidates', label: 'Candidates', icon: '👥' },
  { key: 'certificates', label: 'Certificates', icon: '🏅' },
];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/dashboard')
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page"><p className="muted">Loading dashboard…</p></div>;
  if (error) return <div className="page"><div className="alert alert-error">{error}</div></div>;

  const { kpis, topCategories, recentAssessments } = data;
  const maxCat = Math.max(1, ...topCategories.map((c) => c.count));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Your organization at a glance.</p>
        </div>
        <Link className="btn btn-primary" to="/builder">+ New Assessment</Link>
      </div>

      <div className="kpi-grid">
        {KPI_CARDS.map((c) => (
          <div className="kpi-card card" key={c.key}>
            <div className="kpi-icon">{c.icon}</div>
            <div className="kpi-value">
              {kpis[c.key] ?? 0}
              {c.suffix || ''}
            </div>
            <div className="kpi-label">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="dashboard-columns">
        <section className="card">
          <h2>Top Categories</h2>
          {topCategories.length === 0 && <p className="muted">No data yet.</p>}
          <ul className="bar-list">
            {topCategories.map((c) => (
              <li key={c.name}>
                <span className="bar-label">{c.name}</span>
                <span className="bar-track">
                  <span className="bar-fill" style={{ width: `${(c.count / maxCat) * 100}%` }} />
                </span>
                <span className="bar-count">{c.count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2>Recent Assessments</h2>
          {recentAssessments.length === 0 && <p className="muted">Nothing here yet.</p>}
          <ul className="recent-list">
            {recentAssessments.map((a) => (
              <li key={a._id}>
                <span className="recent-title">{a.title}</span>
                <span className={`status-badge status-${a.status}`}>{a.status}</span>
                <span className="muted">{a.assigned} assigned</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
