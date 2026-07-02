import { useEffect, useRef, useState } from 'react';
import api from '../api/client.js';

const SUGGESTIONS = [
  'Who scored above 80%?',
  'Show me the candidates who failed',
  'What is our overall pass rate?',
  'Generate 5 React interview questions',
];

export default function Assistant() {
  const [messages, setMessages] = useState([]); // { role, content }
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    api.get('/ai/status').then((r) => setAiEnabled(r.data.enabled)).catch(() => setAiEnabled(false));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setError('');
    const next = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const { data } = await api.post('/ai/chat', { messages: next });
      setMessages((m) => [...m, { role: 'assistant', content: data.reply }]);
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
          <h1>✨ AI Assistant</h1>
          <p className="muted">Ask about candidates, submissions, and assessments — in plain English.</p>
        </div>
      </div>

      {!aiEnabled && (
        <div className="alert alert-error">
          AI is not configured. Set <code>ANTHROPIC_API_KEY</code> on the server to enable the assistant.
        </div>
      )}

      <div className="chat-window card">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p className="muted">Try asking:</p>
            <div className="chat-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="type-chip" onClick={() => send(s)} disabled={!aiEnabled}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`chat-msg chat-${m.role}`}>
            <div className="chat-bubble">{m.content}</div>
          </div>
        ))}
        {busy && (
          <div className="chat-msg chat-assistant">
            <div className="chat-bubble muted">Thinking…</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the assistant…"
          disabled={!aiEnabled || busy}
        />
        <button className="btn btn-primary" disabled={!aiEnabled || busy || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
