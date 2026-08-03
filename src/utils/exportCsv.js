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

export async function pushLeadToCRM(lead) {
  console.info('CRM push stub for lead:', lead);
  await new Promise((resolve) => setTimeout(resolve, 700));
  return { ok: true, message: 'Lead pushed to CRM (stubbed).' };
}
