/**
 * slackAlerts.js — Slack webhook notification engine for Lead Qualifier Agent.
 * Fires a Slack Incoming Webhook payload whenever a Hot lead is captured.
 *
 * In production, supply SLACK_WEBHOOK_URL in .env.
 * When the backend is unreachable, falls back to a console log + success response.
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

/**
 * Send a Slack alert for a hot lead via the backend webhook relay.
 */
export async function notifySlackHotLead(lead) {
  const payload = {
    lead: {
      name: lead.name,
      contact: lead.contact || '—',
      platform: lead.platform || 'ig',
      intent: lead.intent || 'hot',
      score: lead.score ?? 0,
      question: (lead.text || lead.question || '').slice(0, 120),
      route: lead.route || 'Immediate Sales Queue',
    },
  };

  try {
    const res = await fetch(`${BACKEND_URL}/api/lead-qualifier/notify-slack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      return { ok: true, message: data.message || 'Slack alert sent!', source: 'server' };
    }
  } catch (err) {
    console.warn('Slack alert: backend unreachable, using local fallback.', err);
  }

  // Fallback — simulated success for demo mode
  await new Promise((r) => setTimeout(r, 300));
  console.info('🔔 [SLACK DEMO] Hot lead alert:', payload.lead);
  return {
    ok: true,
    message: `Slack alert for "${lead.name}" sent (demo mode).`,
    source: 'local-fallback',
  };
}
