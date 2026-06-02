import React, { useState, useEffect } from 'react';
import { Github, Bot, GitPullRequest, Activity, ShieldCheck } from 'lucide-react';

function App() {
  const [status, setStatus] = useState('Checking...');

  useEffect(() => {
    fetch('http://localhost:5000/health')
      .then(res => res.json())
      .then(data => setStatus('Online - ' + data.status))
      .catch(err => setStatus('Offline'));
  }, []);

  return (
    <div className="container">
      <div className="background-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
      </div>
      
      <main className="glass-panel">
        <header className="header">
          <div className="logo-container">
            <Bot size={48} className="logo-icon" />
            <h1 className="title">AI Code Reviewer</h1>
          </div>
          <div className="status-badge">
            <Activity size={18} className="status-icon" />
            <span>Backend Status: <strong className={status.includes('Online') ? 'text-green' : 'text-red'}>{status}</strong></span>
          </div>
        </header>

        <section className="features">
          <div className="feature-card">
            <Github size={32} className="feature-icon" />
            <h3>GitHub Webhooks</h3>
            <p>Seamlessly integrates with your GitHub repositories to automatically detect new pull requests.</p>
          </div>
          <div className="feature-card">
            <Bot size={32} className="feature-icon" />
            <h3>Gemini AI Analysis</h3>
            <p>Powered by Google's Gemini AI, analyzing your code diffs with state-of-the-art accuracy.</p>
          </div>
          <div className="feature-card">
            <ShieldCheck size={32} className="feature-icon" />
            <h3>Smart Feedback</h3>
            <p>Provides actionable insights, finding bugs, vulnerabilities, and suggesting performance improvements.</p>
          </div>
        </section>

        <div className="action-section">
          <button className="primary-btn">
            <GitPullRequest size={20} />
            View Active Reviews
          </button>
        </div>
      </main>
    </div>
  );
}

export default App;
