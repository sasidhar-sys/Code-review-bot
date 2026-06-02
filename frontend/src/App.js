import React, { useState, useRef } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Play, Sparkles, CheckCircle2, AlertTriangle, Shield, Zap, Palette, Github } from "lucide-react";
import "./App.css";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

const LANGUAGES = [
  "auto","python","javascript","typescript","java","c","cpp",
  "csharp","go","rust","php","ruby","swift","kotlin","sql","bash"
];

const SAMPLE_CODE = `def get_user(user_id):
    query = "SELECT * FROM users WHERE id = " + user_id
    result = db.execute(query)
    password = result['password']
    print("User password:", password)
    return result

def process_items(items):
    result = []
    for i in range(len(items)):
        for j in range(len(items)):
            if items[i] == items[j]:
                result.append(items[i])
    return result
`;

function ScoreRing({ score }) {
  const color = score >= 80 ? "var(--green)" : score >= 50 ? "var(--yellow)" : "var(--red)";
  const r = 36, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="score-ring-wrap">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 50 50)" style={{ transition: "stroke-dasharray 1s cubic-bezier(0.4, 0, 0.2, 1)" }} />
      </svg>
      <div className="score-ring-text">
        <span className="score-num" style={{ color }}>{score}</span>
        <span className="score-label">/100</span>
      </div>
    </div>
  );
}

function SeverityBadge({ severity }) {
  const map = { critical: "sev-critical", high: "sev-high", medium: "sev-medium", low: "sev-low" };
  return <span className={`sev-badge ${map[severity] || "sev-low"}`}>{severity?.toUpperCase() || "LOW"}</span>;
}

function IssueCard({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="issue-card">
      <div className="issue-header" onClick={() => setOpen(p => !p)}>
        <SeverityBadge severity={item.severity} />
        <span className="issue-line">Line {item.line}</span>
        <span className="issue-title">{item.title}</span>
        <span className="issue-chevron" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>▼</span>
      </div>
      {open && (
        <div className="issue-body">
          <p className="issue-desc">{item.description}</p>
          {item.fix && (
            <>
              <div className="fix-label"><Sparkles size={14} /> Suggested Fix</div>
              <SyntaxHighlighter style={vscDarkPlus} customStyle={{ borderRadius: "8px", fontSize: "12px", margin: 0 }}>
                {item.fix}
              </SyntaxHighlighter>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CategorySection({ icon, title, items, color }) {
  if (!items?.length) return null;
  return (
    <div className="category-section">
      <div className="category-header" style={{ borderLeftColor: color }}>
        <span className="category-icon" style={{ color }}>{icon}</span>
        <span className="category-title">{title}</span>
        <span className="category-count" style={{ background: color + "22", color }}>{items.length}</span>
      </div>
      <div className="issue-list">
        {items.map((item, i) => <IssueCard key={i} item={item} />)}
      </div>
    </div>
  );
}

export default function App() {
  const [code, setCode] = useState(SAMPLE_CODE);
  const [language, setLanguage] = useState("auto");
  const [context, setContext] = useState("");
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("issues");
  const [webhookInfo, setWebhookInfo] = useState(false);
  const textRef = useRef(null);

  const totalIssues = review
    ? (review.bugs?.length || 0) + (review.security?.length || 0) +
      (review.performance?.length || 0) + (review.style?.length || 0)
    : 0;

  const runReview = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    setReview(null);
    try {
      const res = await fetch(`${API}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language, context }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setReview(data);
      setTab("issues");
    } catch (e) {
      setError(e.message || "Review failed. Is the backend running?");
    }
    setLoading(false);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <div className="brand-icon"><Sparkles size={24} /></div>
          <span className="brand">Code<span className="brand-accent">Review</span> AI</span>
        </div>
        <div className="topbar-right">
          <button className="webhook-btn" onClick={() => setWebhookInfo(p => !p)}>
            <Github size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '6px' }}/> GitHub Webhook Setup
          </button>
          <div className="status-dot-wrap">
            <span className="live-dot" />
            <span className="live-label">Gemini Online</span>
          </div>
        </div>
      </header>

      {webhookInfo && (
        <div className="webhook-banner">
          <strong>GitHub PR Auto-Review Setup:</strong>
          <ol>
            <li>Deploy this backend to Render.com (free)</li>
            <li>Go to your GitHub repo → Settings → Webhooks → Add webhook</li>
            <li>Payload URL: <code>https://your-backend.onrender.com/webhook/github</code></li>
            <li>Content type: <code>application/json</code></li>
            <li>Secret: same value as <code>GITHUB_WEBHOOK_SECRET</code> in your .env</li>
            <li>Events: select <strong>Pull requests</strong> only</li>
            <li>Every new PR will now get an automatic AI review comment!</li>
          </ol>
          <button className="close-banner" onClick={() => setWebhookInfo(false)}>✕</button>
        </div>
      )}

      <div className="body">
        <div className="editor-panel">
          <div className="panel-header">
            <span className="panel-title">📝 Code Input</span>
            <div className="editor-controls">
              <select value={language} onChange={e => setLanguage(e.target.value)} className="lang-select">
                {LANGUAGES.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
              </select>
              <button className="clear-btn" onClick={() => { setCode(""); setReview(null); }}>Clear</button>
            </div>
          </div>

          <textarea
            ref={textRef}
            className="code-input"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="Paste your code here..."
            spellCheck={false}
          />

          <div className="context-row">
            <input
              className="context-input"
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="Optional context: e.g. 'This is a login handler for a banking app'"
            />
          </div>

          <div className="editor-footer">
            <span className="char-count">{code.length.toLocaleString()} chars</span>
            <button className="review-btn" onClick={runReview} disabled={loading || !code.trim()}>
              {loading ? <><span className="btn-spinner" /> Analyzing…</> : <><Play size={16} fill="white" /> Run AI Review</>}
            </button>
          </div>

          {error && <div className="error-bar">⚠️ {error}</div>}
        </div>

        <div className="results-panel">
          {!review && !loading && (
            <div className="empty-results">
              <Shield className="empty-icon" size={64} />
              <div className="empty-title">Code Quality Intelligence</div>
              <div className="empty-sub">Paste your code on the left to receive a comprehensive AI-driven review detecting bugs, security vulnerabilities, and performance bottlenecks.</div>
              <div className="feature-chips">
                <span className="fchip"><AlertTriangle size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }}/> Bug Detection</span>
                <span className="fchip"><Shield size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }}/> Security Scan</span>
                <span className="fchip"><Zap size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }}/> Performance</span>
                <span className="fchip"><Palette size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }}/> Style Check</span>
                <span className="fchip"><Sparkles size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }}/> Auto Refactor</span>
              </div>
            </div>
          )}

          {loading && (
            <div className="loading-results">
              <div className="analyze-spinner" />
              <div className="analyze-text">Analyzing Architecture...</div>
              <div className="analyze-sub">Running deep static analysis & pattern matching</div>
            </div>
          )}

          {review && !loading && (
            <div className="review-content">
              <div className="score-bar">
                <ScoreRing score={review.score || 0} />
                <div className="score-info">
                  <div className="score-summary">{review.summary}</div>
                  <div className="score-meta">
                    <span className="meta-chip">🌐 Language: {review.language || "Detected"}</span>
                    <span className="meta-chip">🔍 {totalIssues} Issues Found</span>
                  </div>
                </div>
              </div>

              <div className="quick-stats">
                {[
                  { label: "Bugs", count: review.bugs?.length || 0, color: "var(--red)", icon: <AlertTriangle size={24}/> },
                  { label: "Security", count: review.security?.length || 0, color: "var(--orange)", icon: <Shield size={24}/> },
                  { label: "Performance", count: review.performance?.length || 0, color: "var(--yellow)", icon: <Zap size={24}/> },
                  { label: "Style", count: review.style?.length || 0, color: "var(--purple)", icon: <Palette size={24}/> },
                ].map(s => (
                  <div key={s.label} className="qstat" style={{ borderColor: s.color + "44" }}>
                    <span className="qstat-icon" style={{ color: s.color }}>{s.icon}</span>
                    <span className="qstat-num" style={{ color: s.color }}>{s.count}</span>
                    <span className="qstat-label">{s.label}</span>
                  </div>
                ))}
              </div>

              <div className="tabs">
                {["issues", "refactored", "positives"].map(t => (
                  <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
                    {t === "issues" ? `Issues (${totalIssues})` : t === "refactored" ? "✨ Refactored" : "✅ Positives"}
                  </button>
                ))}
              </div>

              {tab === "issues" && (
                <div className="issues-content">
                  <CategorySection icon={<AlertTriangle size={18}/>} title="Bug Reports" items={review.bugs} color="var(--red)" />
                  <CategorySection icon={<Shield size={18}/>} title="Security Vulnerabilities" items={review.security} color="var(--orange)" />
                  <CategorySection icon={<Zap size={18}/>} title="Performance Bottlenecks" items={review.performance} color="var(--yellow)" />
                  <CategorySection icon={<Palette size={18}/>} title="Style Improvements" items={review.style} color="var(--purple)" />
                  {totalIssues === 0 && (
                    <div className="no-issues"><CheckCircle2 size={32} style={{ display: 'block', margin: '0 auto 10px' }}/> No critical issues found! Excellent architecture.</div>
                  )}
                </div>
              )}

              {tab === "refactored" && (
                <div className="refactored-content">
                  <div className="category-header" style={{ borderLeftColor: "var(--purple)", marginBottom: "8px" }}>
                    <span className="category-icon" style={{ color: "var(--purple)" }}><Sparkles size={18}/></span>
                    <span className="category-title">Fully Refactored Version</span>
                  </div>
                  <SyntaxHighlighter
                    language={review.language || "python"}
                    style={vscDarkPlus}
                    customStyle={{ borderRadius: "10px", fontSize: "13px", margin: 0, padding: "20px" }}
                    showLineNumbers
                  >
                    {review.refactored || "// No refactored version available"}
                  </SyntaxHighlighter>
                </div>
              )}

              {tab === "positives" && (
                <div className="positives-content">
                  {review.positives?.length > 0 ? (
                    review.positives.map((p, i) => (
                      <div key={i} className="positive-item">
                        <span className="positive-icon"><CheckCircle2 color="var(--green)" size={18} /></span>
                        <span>{p}</span>
                      </div>
                    ))
                  ) : (
                    <div className="no-issues" style={{ color: "var(--text-muted)" }}>No specific positives noted.</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
