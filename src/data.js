/**
 * data.js — Seed data and AI extraction logic for the Lead Qualifier Agent demo.
 */

/* ── Avatar colours ── */
export const AVATAR_COLORS = [
  '#00D4FF','#00FFA3','#FFB020','#FF4D6D','#A855F7','#3B82F6','#F97316',
];

export function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export function initials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
}

/* ── Intent scoring ── */
const HOT_KEYWORDS  = ['how much','price','cost','book','buy','order','pay','hire','ready','urgent'];
const WARM_KEYWORDS = ['interested','curious','tell me','what is','when','available','services'];

export function scoreIntent(text) {
  const lower = text.toLowerCase();
  if (HOT_KEYWORDS.some(k => lower.includes(k)))  return 'hot';
  if (WARM_KEYWORDS.some(k => lower.includes(k))) return 'warm';
  return 'cold';
}

export function highlightKeywords(text) {
  const all = [...HOT_KEYWORDS, ...WARM_KEYWORDS];
  let out = text;
  all.forEach(kw => {
    const re = new RegExp(`(${kw})`, 'gi');
    out = out.replace(re, `<mark class="dm-keyword">$1</mark>`);
  });
  return out;
}

/* ── Seed DMs ── */
export const SEED_DMS = [
  { id: 1, name: 'Amara Okonkwo', platform: 'ig', text: "Hey! I'm really interested in your coaching packages. How much does the 1-on-1 session cost?", time: '09:14', contact: 'amara.okonkwo@gmail.com' },
  { id: 2, name: 'Daniel Fernandez', platform: 'tw', text: "Saw your post about the property listing in VI. When can I book a viewing?", time: '09:37', contact: 'danielf_realty' },
  { id: 3, name: 'Sasha Williams', platform: 'ig', text: "What services do you offer for small businesses? We're curious about the full package.", time: '10:02', contact: 'sasha.w@outlook.com' },
  { id: 4, name: 'Kemi Adeyemi', platform: 'ig', text: "Hi! Saw your ad. I want to buy the skincare bundle. How do I pay?", time: '10:18', contact: 'kemi_ade' },
  { id: 5, name: 'Marcus Lee', platform: 'tw', text: "Price list for the social media management plans?", time: '10:45', contact: 'marcus@leedesign.co' },
];

/* ── Simulated incoming DM scenarios ── */
export const DEMO_DMS = [
  { name: 'Fatima Hassan', platform: 'ig', text: "Hi! I'm interested in booking a consultation. What are your prices?", contact: 'fatima.h@gmail.com' },
  { name: 'Chukwudi Obi', platform: 'tw', text: "How much does your web design package cost? Ready to hire if it's within budget.", contact: 'chukwudi@techng.com' },
  { name: 'Priya Sharma', platform: 'ig', text: "Saw your work — amazing! Do you have availability next week? I urgently need help.", contact: 'priya.s_design' },
  { name: 'James Oduya', platform: 'tw', text: "Tell me more about your coaching programme. What's included in the price?", contact: 'james.oduya@yahoo.com' },
  { name: 'Ngozi Eze', platform: 'ig', text: "I want to order the brand identity package. How do I proceed?", contact: 'ngozi_creatives' },
];

/* ── Auto-reply template ── */
export function buildAutoReply(clientName, intent) {
  const opener = intent === 'hot'
    ? `Hi ${clientName}! 👋 Thanks for reaching out — great timing!`
    : `Hi ${clientName}! Thanks for your message.`;

  return `${opener}\n\nI've received your enquiry and will get back to you personally within the hour with full details.\n\nIn the meantime, feel free to check out our latest work at the link in bio.\n\nSpeak soon! 🚀`;
}

/* ── AI Extraction (OpenAI or heuristic) ── */
const SYS = `Extract lead info from this DM text. Return ONLY valid JSON:
{"name":"string","contact":"string or empty","intent":"hot|warm|cold","question":"string","summary":"1 sentence"}`;

export async function extractLead(text, name, apiKey) {
  if (apiKey?.startsWith('sk-')) {
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini', temperature: 0.1,
          messages: [{ role: 'system', content: SYS }, { role: 'user', content: `From: ${name}\n\n${text}` }],
        }),
      });
      if (r.ok) {
        const d = await r.json();
        return JSON.parse(d.choices[0].message.content);
      }
    } catch (_) {}
  }
  // Heuristic fallback
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
  const intent = scoreIntent(text);
  const question = text.length > 80 ? text.slice(0, 77) + '…' : text;
  return {
    name,
    contact: emailMatch ? emailMatch[0] : '',
    intent,
    question,
    summary: `${name} sent a ${intent}-intent DM asking about ${intent === 'hot' ? 'pricing/booking' : 'services'}.`,
  };
}

/* ── Conversion rate calc ── */
export function conversionRate(leads) {
  if (!leads.length) return 0;
  const hot = leads.filter(l => l.intent === 'hot').length;
  return Math.round((hot / leads.length) * 100);
}

export function qualifyLead(text, intent = scoreIntent(text || '')) {
  const lower = (text || '').toLowerCase();
  let score = intent === 'hot' ? 84 : intent === 'warm' ? 63 : 38;
  let reason = intent === 'hot'
    ? 'Strong buying intent with clear action language.'
    : intent === 'warm'
      ? 'Shows interest, but needs a nudge to convert.'
      : 'Low urgency, best kept in a nurture flow.';
  let route = intent === 'hot'
    ? 'Sales rep queue'
    : intent === 'warm'
      ? 'Nurture sequence'
      : 'Low-priority archive';
  let nextAction = intent === 'hot'
    ? 'Call within 30 minutes and send pricing options.'
    : intent === 'warm'
      ? 'Share a case study and follow up in 3 days.'
      : 'Keep in nurture and re-engage later.';

  const followUp = intent === 'hot'
    ? ['Send a calendar link', 'Create a CRM task', 'Notify the sales team']
    : intent === 'warm'
      ? ['Share a relevant case study', 'Add to nurture list', 'Follow up in 3 days']
      : ['Tag as cold', 'Keep in nurture pool', 'Re-engage only if they return'];

  if (lower.includes('ready') || lower.includes('buy') || lower.includes('book') || lower.includes('urgent')) score += 8;
  if (lower.includes('price') || lower.includes('cost') || lower.includes('how much')) score += 5;
  if (lower.includes('interested') || lower.includes('curious')) score += 4;

  score = Math.min(100, score);
  if (score >= 85) {
    reason = 'High-intent lead with a clear buying signal.';
    route = 'Immediate sales handoff';
    nextAction = 'Call immediately and send a tailored offer.';
  } else if (score >= 60) {
    reason = 'Promising lead that needs a short nurture sequence.';
    route = 'Sales nurture';
    nextAction = 'Send a case study and offer a discovery call.';
  }

  return { score, reason, route, nextAction, followUp };
}

/* ── Sheet columns ── */
export const SHEET_COLS = ['Name', 'Platform', 'Contact', 'Intent', 'Time', 'Question'];
export function leadToRow(lead) {
  const intentStr = (lead.intent || scoreIntent(lead.text || '')).toUpperCase();
  const platformStr = (lead.platform || 'ig').toUpperCase();
  return [
    lead.name || 'Unknown',
    platformStr,
    lead.contact || '—',
    intentStr,
    lead.time || nowTime(),
    (lead.text || lead.question || '').slice(0, 40) + '…'
  ];
}

/* ── Time helper ── */
export function nowTime() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}
