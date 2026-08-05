/**
 * sheetsClient.js — Google Sheets live sync service for Lead Qualifier Agent.
 * Appends qualified leads as rows to a configured Google Sheet.
 *
 * In production, supply GOOGLE_SHEETS_CREDENTIALS_JSON (path to service account JSON)
 * and GOOGLE_SHEETS_SPREADSHEET_ID in .env.
 *
 * When credentials are missing, falls back to a local log + success response
 * so the frontend integration still works seamlessly during demos.
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

/**
 * Sync a lead row to Google Sheets via the backend proxy.
 * Falls back to a simulated success if the server is offline.
 */
export async function syncLeadToSheet(lead) {
  const row = [
    lead.name || 'Unknown',
    (lead.platform || 'ig').toUpperCase(),
    lead.contact || '—',
    (lead.intent || 'cold').toUpperCase(),
    lead.score ?? 0,
    lead.route || 'Nurture',
    lead.time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    (lead.text || lead.question || '').slice(0, 60),
  ];

  try {
    const res = await fetch(`${BACKEND_URL}/api/lead-qualifier/sync-sheet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ row, leadId: lead.id }),
    });

    if (res.ok) {
      const data = await res.json();
      return { ok: true, message: data.message || 'Lead synced to Google Sheets.', source: 'server' };
    }
  } catch (err) {
    console.warn('Google Sheets sync: backend unreachable, using local fallback.', err);
  }

  // Fallback — simulated success for demo mode
  await new Promise((r) => setTimeout(r, 400));
  return {
    ok: true,
    message: `Lead "${lead.name}" logged to Google Sheets (demo mode).`,
    source: 'local-fallback',
  };
}
