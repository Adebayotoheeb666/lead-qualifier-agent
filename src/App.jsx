import { useState, useEffect, useRef, useCallback } from 'react';
import {
  SEED_DMS, DEMO_DMS, SHEET_COLS, AVATAR_COLORS,
  avatarColor, initials, scoreIntent, highlightKeywords,
  buildAutoReply, extractLead, leadToRow, conversionRate, qualifyLead, nowTime,
} from './data.js';
import { exportLeadToCSV, pushLeadToCRM } from './utils/exportCsv.js';
import { syncLeadToSheet } from './utils/sheetsClient.js';
import { notifySlackHotLead } from './utils/slackAlerts.js';

/* ─── Toasts ─── */
function useToasts() {
  const [list, setList] = useState([]);
  const add = useCallback((msg, type = 's') => {
    const id = Date.now();
    setList(l => [...l, { id, msg, type }]);
    setTimeout(() => setList(l => l.filter(x => x.id !== id)), 4000);
  }, []);
  return { list, add };
}

function Toasts({ list }) {
  return (
    <div className="toast-wrap">
      {list.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span style={{ color: t.type === 's' ? 'var(--green)' : 'var(--red)' }}>
            {t.type === 's' ? '✓' : '✕'}
          </span>
          <span className="toast-msg">{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Animated Counter ─── */
function Counter({ target }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let cur = 0;
    const step = Math.ceil(target / 60);
    const t = setInterval(() => {
      cur = Math.min(cur + step, target);
      setVal(cur);
      if (cur >= target) clearInterval(t);
    }, 24);
    return () => clearInterval(t);
  }, [target]);
  return <>{val}</>;
}

/* ─── Stat Card ─── */
function StatCard({ color, label, value, change, mono }) {
  return (
    <div className={`stat-card ${color}`}>
      <div className="stat-label">{label}</div>
      <div className={`stat-value${mono ? ' mono' : ''}`}>{value}</div>
      {change && <div className="stat-change">{change}</div>}
    </div>
  );
}

/* ─── DM Avatar ─── */
function Avatar({ name, size = 38 }) {
  const bg = avatarColor(name);
  return (
    <div className="dm-avatar" style={{ background: bg, width: size, height: size, fontSize: size * 0.34 }}>
      {initials(name)}
    </div>
  );
}

/* ─── DM Feed item ─── */
function DmItem({ dm, isNew }) {
  const highlighted = highlightKeywords(dm.text);
  return (
    <div className="dm-item">
      <Avatar name={dm.name} />
      <div className="dm-body">
        <div className="dm-row1">
          <span className="dm-name">{dm.name}</span>
          <span className={`dm-platform ${dm.platform}`}>{dm.platform === 'ig' ? 'Instagram' : 'Twitter/X'}</span>
          {isNew && <span className="dm-new-badge">NEW</span>}
          <span className="dm-time">{dm.time}</span>
        </div>
        <div className="dm-text" dangerouslySetInnerHTML={{ __html: highlighted }} />
      </div>
    </div>
  );
}

/* ─── Intent Badge ─── */
function IntentBadge({ intent }) {
  const map = { hot: '🔥 Hot', warm: '🌡 Warm', cold: '❄ Cold' };
  return <span className={`intent-badge intent-${intent}`}>{map[intent] || intent}</span>;
}

/* ─── Google Sheets Mock ─── */
function SheetsMock({ rows }) {
  const COL_WIDTHS = ['18%','10%','22%','9%','8%','33%'];
  return (
    <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div className="sheets-header">
        <span className="sheets-icon">📊</span>
        <span className="sheets-title">LeadBot — Live Leads</span>
        <span className="sheets-sub">Auto-synced · Google Sheets</span>
      </div>
      <div className="sheets-body">
        <div className="sheets-row head" style={{ display: 'grid', gridTemplateColumns: COL_WIDTHS.join(' ') }}>
          {SHEET_COLS.map(c => <div key={c} className="sheets-cell">{c}</div>)}
        </div>
        {rows.map((row, i) => (
          <div
            key={i}
            className={`sheets-row${i === 0 && rows.length > SEED_DMS.length ? ' new-sheet-row' : ''}`}
            style={{ display: 'grid', gridTemplateColumns: COL_WIDTHS.join(' ') }}
          >
            {row.map((cell, j) => <div key={j} className="sheets-cell">{cell}</div>)}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Leads Table ─── */
function LeadsTable({ leads, selectedLeadId, onSelect }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="leads-table">
        <thead>
          <tr>
            <th>Lead</th>
            <th>Platform</th>
            <th>Intent</th>
            <th>Contact</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l, i) => {
            const isSelected = l.id === selectedLeadId;
            return (
              <tr
                key={l.id}
                className={`${i === 0 && leads.length > SEED_DMS.length ? 'new-row' : ''}${isSelected ? ' selected-row' : ''}`}
                onClick={() => onSelect(l.id)}
              >
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={l.name} size={32} />
                    <div>
                      <div className="lead-name-cell">{l.name}</div>
                      {l.contact && <div className="lead-contact">{l.contact}</div>}
                    </div>
                  </div>
                </td>
                <td><span className={`dm-platform ${l.platform}`}>{l.platform === 'ig' ? 'Instagram' : 'Twitter/X'}</span></td>
                <td><IntentBadge intent={l.intent} /></td>
                <td className="text-muted mono" style={{ fontSize: '.78rem' }}>{l.contact || '—'}</td>
                <td className="text-muted mono" style={{ fontSize: '.78rem' }}>{l.time}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function QualificationPanel({ lead }) {
  if (!lead) {
    return (
      <div className="qualification-placeholder">
        <div className="section-title">🧠 Qualification engine</div>
        <p className="text-muted">Run a demo DM to see how the agent scores intent, routes the lead, and suggests the next action.</p>
      </div>
    );
  }

  return (
    <div className="qualification-panel">
      <div className="qualification-grid">
        <div className="qualification-card">
          <div className="mini-label">Qualification Score</div>
          <div className="score-value">{lead.score}/100</div>
          <div className="mini-text">{lead.qualificationReason}</div>
        </div>
        <div className="qualification-card">
          <div className="mini-label">Route</div>
          <div className="route-value">{lead.route}</div>
          <div className="mini-text">{lead.nextAction}</div>
        </div>
      </div>
      <div className="automation-list">
        {lead.followUp.map((item, idx) => (
          <div key={idx} className="automation-item">▶ {item}</div>
        ))}
      </div>
    </div>
  );
}

const QUAL_QUESTIONS = [
  { key: 'name', label: 'Lead name', prompt: 'What is the prospect’s name?' },
  { key: 'need', label: 'Need / challenge', prompt: 'What problem are they asking you to solve?' },
  { key: 'budget', label: 'Budget or price range', prompt: 'What budget or pricing expectation did they mention?' },
  { key: 'timeline', label: 'Timeline', prompt: 'When do they need this resolved?' },
];

function QualificationWizard({
  step,
  answers,
  input,
  onChange,
  onSubmit,
  onReset,
  processing,
}) {
  const question = QUAL_QUESTIONS[step];
  if (!question) return null;

  return (
    <div className="qualification-wizard card mt-8">
      <div className="section-head">
        <div className="section-title">🧠 Lead Intake Wizard</div>
        <span className="section-badge badge-amber">Multi-step</span>
      </div>
      <p className="text-muted" style={{ marginBottom: 14 }}>
        Capture missing qualification details in a guided sequence, then review the lead summary before pushing to CRM.
      </p>
      <div className="wizard-step">
        <div className="wizard-label">Step {step + 1} of {QUAL_QUESTIONS.length}</div>
        <div className="wizard-prompt">{question.prompt}</div>
        <input
          className="sim-input"
          placeholder={question.label}
          value={input}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSubmit()}
        />
        <div className="wizard-actions" style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-cyan" onClick={onSubmit} disabled={processing || !input.trim()}>
            {processing ? 'Processing…' : step === QUAL_QUESTIONS.length - 1 ? 'Finish Intake' : 'Next'}
          </button>
          <button className="btn btn-outline" onClick={onReset} disabled={processing}>
            Reset Wizard
          </button>
        </div>
      </div>
      <div className="wizard-summary" style={{ marginTop: 18, color: 'var(--text-2)' }}>
        <strong>Current answers:</strong>
        <ul style={{ marginTop: 8, paddingLeft: 18 }}>
          {QUAL_QUESTIONS.map((q) => (
            <li key={q.key}>
              <strong>{q.label}:</strong> {answers[q.key] || '—'}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ─── Main App ─── */
const INIT_LEADS = SEED_DMS.map(d => ({
  ...d, intent: scoreIntent(d.text), isNew: false,
}));

export default function App() {
  const [dms, setDms]               = useState(SEED_DMS);
  const [leads, setLeads]           = useState(INIT_LEADS);
  const [sheetRows, setSheetRows]   = useState(INIT_LEADS.map(leadToRow));
  const [selectedLeadId, setSelectedLeadId] = useState(INIT_LEADS[0]?.id || null);
  const [processing, setProcessing] = useState(false);
  const [lastReply, setLastReply]   = useState(null);
  const [simText, setSimText]       = useState('');
  const [platform, setPlatform]     = useState('ig');
  const [apiKey, setApiKey]         = useState('');
  const [showKey, setShowKey]       = useState(false);
  const [demoIdx, setDemoIdx]       = useState(0);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardAnswers, setWizardAnswers] = useState({ name: '', need: '', budget: '', timeline: '' });
  const [wizardInput, setWizardInput] = useState('');
  const [wizardResult, setWizardResult] = useState(null);
  const feedRef = useRef(null);
  const { list: toasts, add: toast } = useToasts();

  const counterTarget = leads.length + 9; // offset to look "busy"

  useEffect(() => {
    const savedKey = localStorage.getItem('leadqualifier_key');
    if (savedKey) setApiKey(savedKey);

    const savedState = localStorage.getItem('leadqualifier_state');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        if (parsed.dms?.length) setDms(parsed.dms);
        if (parsed.leads?.length) {
          setLeads(parsed.leads);
          setSheetRows(parsed.leads.map(leadToRow));
          setSelectedLeadId(parsed.selectedLeadId || parsed.leads[0]?.id);
        }
        if (typeof parsed.demoIdx === 'number') setDemoIdx(parsed.demoIdx);
      } catch (err) {
        console.warn('Failed to load saved lead qualifier state', err);
      }
    }
  }, []);

  useEffect(() => {
    setSheetRows(leads.map(leadToRow));
    localStorage.setItem('leadqualifier_state', JSON.stringify({
      dms,
      leads,
      selectedLeadId,
      demoIdx,
    }));
  }, [dms, leads, selectedLeadId, demoIdx]);

  const saveKey = (k) => { setApiKey(k); k ? localStorage.setItem('leadqualifier_key', k) : localStorage.removeItem('leadqualifier_key'); };

  const resetWizard = () => {
    setWizardStep(0);
    setWizardAnswers({ name: '', need: '', budget: '', timeline: '' });
    setWizardInput('');
    setWizardResult(null);
  };

  const submitWizardStep = () => {
    if (!wizardInput.trim()) return;
    const currentKey = QUAL_QUESTIONS[wizardStep]?.key;
    if (!currentKey) return;
    const updatedAnswers = { ...wizardAnswers, [currentKey]: wizardInput.trim() };
    setWizardAnswers(updatedAnswers);
    setWizardInput('');
    if (wizardStep === QUAL_QUESTIONS.length - 1) {
      const summary = `Captured lead: ${updatedAnswers.name || 'Unknown'} — need: ${updatedAnswers.need || 'Unspecified'}; budget: ${updatedAnswers.budget || 'Unspecified'}; timeline: ${updatedAnswers.timeline || 'Unspecified'}.`;
      setWizardResult({ summary, status: 'Ready for CRM push', data: updatedAnswers });
      setWizardStep(wizardStep + 1);
      return;
    }
    setWizardStep(step => step + 1);
  };

  /* scroll DM feed to bottom */
  const scrollFeed = () => {
    setTimeout(() => { if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight; }, 50);
  };

  /* ── process a new DM (real or custom) ── */
  const processDm = async (text, name, plt) => {
    setProcessing(true);

    const newDm = { id: Date.now(), name, platform: plt, text, time: nowTime(), contact: '', isNew: true };
    setDms(prev => [newDm, ...prev]);
    scrollFeed();

    await new Promise(r => setTimeout(r, 800)); // simulate network latency

    const extracted = await extractLead(text, name, apiKey);
    const intent = extracted.intent || scoreIntent(text);
    const qualification = qualifyLead(text, intent);
    const lead = {
      ...newDm,
      ...extracted,
      intent,
      score: qualification.score,
      qualificationReason: qualification.reason,
      route: qualification.route,
      nextAction: qualification.nextAction,
      followUp: qualification.followUp,
      isNew: true,
    };

    setLeads(prev => [lead, ...prev]);
    setSelectedLeadId(lead.id);
    setLastReply({ text: buildAutoReply(name, intent), intent, name, route: qualification.route, nextAction: qualification.nextAction });

    toast(`✓ Lead captured — ${name} tagged as ${intent.toUpperCase()}`, 's');

    // Sync to Google Sheets (non-blocking)
    syncLeadToSheet(lead).then(result => {
      if (result.ok) toast(`📊 ${result.message}`, 's');
    });

    // Alert Slack if hot lead (non-blocking)
    if (intent === 'hot') {
      notifySlackHotLead(lead).then(result => {
        if (result.ok) toast(`🔔 ${result.message}`, 's');
      });
    }

    setProcessing(false);
  };

  /* ── "Try Demo" button ── */
  const handleTryDemo = () => {
    if (processing) return;
    const scenario = DEMO_DMS[demoIdx % DEMO_DMS.length];
    setDemoIdx(i => i + 1);
    processDm(scenario.text, scenario.name, scenario.platform);
  };

  /* ── Custom sim ── */
  const handleCustomSim = () => {
    if (!simText.trim() || processing) return;
    const fakeName = 'Demo User';
    processDm(simText.trim(), fakeName, platform);
    setSimText('');
  };

  const convRate = conversionRate(leads);

  return (
    <>
      <div className="app">
        {/* ── Nav ── */}
        <nav className="nav">
          <div className="nav-logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth="2.5">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 014.82 11.6a19.79 19.79 0 01-3.07-8.67A2 2 0 013.73 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.91 8.67a16 16 0 006.49 6.49l1.04-1.04a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
            </svg>
            Lead<span className="dot">Qual</span>ifier
          </div>
          <div className="nav-pill">
            <span className="status-dot" />
            Listening for DMs
          </div>
        </nav>

        {/* ── Hero ── */}
        <div className="hero">
          <div className="hero-eyebrow">
            <span>●</span> AI-Powered Lead Qualification
          </div>
          <h1>Every DM Gets<br /><span>Qualified Instantly.</span></h1>
          <p>
            Our AI monitors your Instagram &amp; Twitter DMs 24/7, extracts contact details and buying intent,
            tags each lead as Hot, Warm, or Cold, and routes it into a live lead board for follow-up.
          </p>

          {/* Counter */}
          <div className="counter-hero">
            <div className="counter-number"><Counter target={counterTarget} /></div>
            <div className="counter-label">Leads captured today</div>
            <div className="counter-sub">Last updated: {nowTime()}</div>
          </div>

          <div className="btn-group">
            <button id="try-demo-btn" className="btn btn-cyan btn-lg" onClick={handleTryDemo} disabled={processing}>
              {processing
                ? <><div className="btn-spinner" /> Processing DM…</>
                : <>⚡ Try Demo — Simulate a DM</>}
            </button>
            <button id="show-api-btn" className="btn btn-outline btn-lg" onClick={() => setShowKey(s => !s)}>
              🔑 API Key
            </button>
          </div>
          <p className="text-muted mt-4" style={{ fontSize: '.78rem' }}>
            No API key needed — demo works offline with built-in AI simulation
          </p>
        </div>

        {/* ── API Key panel ── */}
        {showKey && (
          <div className="card mt-6" style={{ borderColor: 'var(--border-cyan)', marginBottom: 32 }}>
            <div style={{ fontWeight: 700, marginBottom: 10, color: 'var(--cyan)' }}>OpenAI API Key (Optional)</div>
            <input
              id="api-key-input"
              type="password"
              className="sim-input"
              placeholder="sk-…"
              value={apiKey}
              onChange={e => saveKey(e.target.value)}
            />
            <p className="text-muted mt-4" style={{ fontSize: '.78rem' }}>
              Stored only in localStorage. Without a key, the demo uses intent-scoring heuristics — still impressive for prospects.
            </p>
          </div>
        )}

        {/* ── Stat row ── */}
        <div className="stat-row">
          <StatCard color="cyan"  label="Leads Today"      value={<Counter target={counterTarget} />} change={`+${leads.length - SEED_DMS.length} from demo`} />
          <StatCard color="green" label="Hot Leads"        value={leads.filter(l => l.intent === 'hot').length} change="Ready to convert" />
          <StatCard color="amber" label="Conversion Rate"  value={`${convRate}%`} change="Hot leads / total" />
          <StatCard color="red"   label="Avg Response"     value="< 2s" change="Auto-reply speed" mono />
        </div>

        {/* ── Custom DM Simulator ── */}
        <div className="card mt-8">
          <div className="section-head">
            <div className="section-title">🎮 Custom DM Simulator</div>
            <span className="section-badge badge-cyan">Interactive</span>
          </div>
          <p className="text-muted" style={{ marginBottom: 14 }}>
            Type any message below — watch the AI detect intent and log it as a lead instantly.
          </p>
          <div className="platform-tabs">
            <button className={`ptab${platform === 'ig' ? ' active-ig' : ''}`} onClick={() => setPlatform('ig')}>📸 Instagram</button>
            <button className={`ptab${platform === 'tw' ? ' active-tw' : ''}`} onClick={() => setPlatform('tw')}>𝕏 Twitter/X</button>
          </div>
          <div className="sim-input-row">
            <input
              id="custom-dm-input"
              className="sim-input"
              placeholder="E.g. 'Hi! How much for the starter package? I'm ready to book.'"
              value={simText}
              onChange={e => setSimText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCustomSim()}
            />
            <button id="send-dm-btn" className="btn btn-cyan" onClick={handleCustomSim} disabled={!simText.trim() || processing}>
              Send
            </button>
          </div>
        </div>

        {/* ── Qualification Wizard ── */}
        {wizardStep < QUAL_QUESTIONS.length && (
          <QualificationWizard
            step={wizardStep}
            answers={wizardAnswers}
            input={wizardInput}
            onChange={setWizardInput}
            onSubmit={submitWizardStep}
            onReset={resetWizard}
            processing={processing}
          />
        )}

        {wizardResult && wizardStep >= QUAL_QUESTIONS.length && (
          <div className="card mt-6">
            <div className="section-head">
              <div className="section-title">✅ Qualification Summary</div>
              <span className="section-badge badge-green">Complete</span>
            </div>
            <p>{wizardResult.summary}</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                className="btn btn-cyan"
                onClick={() => {
                  const lead = {
                    id: Date.now(),
                    name: wizardAnswers.name || 'Qualified Lead',
                    platform: 'dm',
                    text: wizardResult.summary,
                    time: nowTime(),
                    contact: '—',
                    intent: 'warm',
                    score: 72,
                    qualificationReason: 'Qualified through guided intake',
                    route: 'Sales nurture',
                    nextAction: 'Follow up with tailored proposal',
                    followUp: ['Send proposal', 'Book discovery call', 'Add to nurture sequence'],
                  };
                  setDms(prev => [lead, ...prev]);
                  setLeads(prev => [lead, ...prev]);
                  setSelectedLeadId(lead.id);
                  syncLeadToSheet(lead).then(result => {
                    if (result.ok) toast(`📊 ${result.message}`, 's');
                  });
                  if (lead.intent === 'hot') {
                    notifySlackHotLead(lead).then(result => {
                      if (result.ok) toast(`🔔 ${result.message}`, 's');
                    });
                  }
                  setWizardResult(null);
                  resetWizard();
                }}
              >
                Add to Lead Board
              </button>
              <button className="btn btn-outline" onClick={resetWizard}>
                Start New Intake
              </button>
            </div>
          </div>
        )}

        {/* ── Two-col: DM Feed + Leads Table ── */}
        <div className="two-col mt-8">
          {/* DM Feed */}
          <div className="card">
            <div className="section-head">
              <div className="section-title">📥 Live DM Feed</div>
              <span className="section-badge badge-cyan">{dms.length} messages</span>
            </div>
            <div className="dm-feed" ref={feedRef}>
              {dms.map((dm, i) => <DmItem key={dm.id} dm={dm} isNew={i === 0 && dms.length > SEED_DMS.length} />)}
            </div>
          </div>

          {/* Leads Table */}
          <div className="card">
            <div className="section-head">
              <div className="section-title">🎯 Captured Leads</div>
              <span className="section-badge badge-green">{leads.length} total</span>
            </div>
            <LeadsTable leads={leads} selectedLeadId={selectedLeadId} onSelect={setSelectedLeadId} />
          </div>
        </div>

        {/* ── Qualification panel ── */}
        <div className="lead-detail-grid mt-8">
          <div className="card" style={{ flex: 2 }}>
            <div className="section-head">
              <div className="section-title">🎯 Captured Leads</div>
              <span className="section-badge badge-green">Select a lead</span>
            </div>
            <LeadsTable leads={leads} selectedLeadId={selectedLeadId} onSelect={setSelectedLeadId} />
          </div>
          <div className="card" style={{ flex: 1, minWidth: 320 }}>
            <div className="section-head">
              <div className="section-title">🧠 Lead Profile</div>
              <span className="section-badge badge-cyan">Details</span>
            </div>
            <QualificationPanel lead={leads.find(l => l.id === selectedLeadId) || leads[0]} />
            <div className="lead-action-panel">
              <button
                className="btn btn-cyan btn-block"
                onClick={() => {
                  const lead = leads.find(l => l.id === selectedLeadId) || leads[0];
                  exportLeadToCSV(lead, `lead-${lead.name.replace(/\s+/g, '_').toLowerCase()}.csv`);
                  toast('Exported selected lead to CSV', 's');
                }}
                disabled={!selectedLeadId}
              >
                Export lead CSV
              </button>
              <button
                className="btn btn-outline btn-block"
                onClick={() => {
                  const lead = leads.find(l => l.id === selectedLeadId) || leads[0];
                  pushLeadToCRM(lead);
                  toast('Pushed selected lead to CRM stub', 's');
                }}
                disabled={!selectedLeadId}
              >
                Push to CRM
              </button>
            </div>
          </div>
        </div>

        {/* ── Auto-reply preview ── */}
        {lastReply && (
          <div className="card mt-8">
            <div className="section-head">
              <div className="section-title">✉️ Auto-Reply Sent to {lastReply.name}</div>
              <IntentBadge intent={lastReply.intent} />
            </div>
            <div className="reply-preview" style={{ whiteSpace: 'pre-wrap' }}>{lastReply.text}</div>
            <div className="mini-text mt-4">Route: {lastReply.route} · Next step: {lastReply.nextAction}</div>
            <p className="text-muted mt-4" style={{ fontSize: '.78rem' }}>
              This holding reply was sent instantly so the lead doesn't go cold while you're busy. The message is fully customisable per client.
            </p>
          </div>
        )}

        {/* ── Google Sheets Mock ── */}
        <div className="mt-8">
          <div className="section-head">
            <div className="section-title">📊 Google Sheets — Real-Time Log</div>
            <span className="section-badge badge-green">Live sync</span>
          </div>
          <SheetsMock rows={sheetRows} />
          <p className="text-muted mt-4" style={{ textAlign: 'center', fontSize: '.8rem' }}>
            Every lead appears here automatically — no database, no dev work. Your client already knows how to use Sheets.
          </p>
        </div>

        {/* ── CTA ── */}
        <div className="cta-section">
          <h2>Ready to Stop Losing Leads?</h2>
          <p>
            I can deploy a version of this bot pointed at your actual Instagram or Twitter DMs in under 24 hours.
            All leads go straight to a Google Sheet you own.
          </p>
          <div className="btn-group">
            <button id="cta-deploy-btn" className="btn btn-cyan btn-lg">Get It Set Up →</button>
            <button id="cta-replay-btn" className="btn btn-outline btn-lg" onClick={handleTryDemo} disabled={processing}>
              {processing ? 'Processing…' : 'Run Demo Again'}
            </button>
          </div>
          <p className="text-muted mt-4" style={{ fontSize: '.78rem' }}>
            "Every one of these would've been a DM you had to read, remember, and reply to manually."
          </p>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="footer">
        <p>Lead Qualifier Agent — Demo Template · Built with ⚡ vibe-coding · &copy; {new Date().getFullYear()}</p>
      </footer>

      <Toasts list={toasts} />
    </>
  );
}
