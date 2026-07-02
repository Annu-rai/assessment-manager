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
  const [aiEnabled, setAiEnabled] = useState(false);
  const [insights, setInsights] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    api
      .get('/dashboard')
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    api.get('/ai/status').then((r) => setAiEnabled(r.data.enabled)).catch(() => setAiEnabled(false));
  }, []);

  const generateInsights = async () => {
    setAiError('');
    setAiBusy(true);
    try {
      const { data: res } = await api.get('/ai/insights');
      setInsights(res);
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiBusy(false);
    }
  };

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

      {aiEnabled && (
        <section className="card ai-insights-card">
          <div className="ai-insights-head">
            <h2>✨ AI Insights</h2>
            <button className="btn btn-ai btn-sm" onClick={generateInsights} disabled={aiBusy}>
              {aiBusy ? 'Analyzing…' : insights ? 'Refresh' : 'Generate insights'}
            </button>
          </div>
          {aiError && <div className="alert alert-error">{aiError}</div>}
          {!insights && !aiBusy && (
            <p className="muted">Let Claude analyze your results and surface weak topics + recommendations.</p>
          )}
          {insights && (
            <div className="ai-insights-body">
              <p className="ai-summary">{insights.summary}</p>
              <div className="insight-list">
                {insights.insights.map((it, i) => (
                  <div className={`insight-item sev-${it.severity}`} key={i}>
                    <div className="insight-title">{it.title}</div>
                    <div className="insight-detail muted">{it.detail}</div>
                  </div>
                ))}
              </div>
              {insights.recommendations?.length > 0 && (
                <div className="recommendations">
                  <h3>Recommendations</h3>
                  <ul>
                    {insights.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
