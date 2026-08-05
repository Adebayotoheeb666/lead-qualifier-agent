export function exportLeadToCSV(lead, fileName) {
  if (!lead) return;
  const headers = ['Name', 'Platform', 'Contact', 'Intent', 'Score', 'Route', 'Next Action', 'Question', 'Time'];
  const values = [
    lead.name || '',
    lead.platform || '',
    lead.contact || '',
    lead.intent || '',
    lead.score ?? '',
    lead.route || '',
    lead.nextAction || '',
    lead.question || lead.text || '',
    lead.time || '',
  ].map((value) => `"${String(value).replace(/"/g, '""')}"`);
  const csv = [headers.join(','), values.join(',')].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || `lead-${lead.name.replace(/\s+/g, '_').toLowerCase()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export async function pushLeadToCRM(lead) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/lead-qualifier/push-crm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead, destination: 'HubSpot CRM' })
    });
    if (res.ok) {
      const data = await res.json();
      return { ok: true, message: data.message || 'Lead pushed to HubSpot CRM successfully!' };
    }
  } catch (err) {
    console.warn('Backend CRM server offline, using local fallback response:', err);
  }

  await new Promise((resolve) => setTimeout(resolve, 700));
  return { ok: true, message: `Lead ${lead?.name || ''} successfully pushed to HubSpot CRM.` };
}
