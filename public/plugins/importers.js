/* Built-in Cadence plugin — uses only the public plugin API. */
(() => {
const registerPlugin = def => Cadence.registerPlugin(def);
const isMe = (name, ctx) => {
  if(!name) return true;
  const n = name.toLowerCase().trim(); if(['me','i','us','we','our team'].includes(n)) return true;
  const mine = (ctx.myName || '').toLowerCase().trim(); if(!mine) return false;
  const first = mine.split(/\s+/)[0];
  return n === mine || n.split(/\s+/)[0] === first;
};
let parseQuick = (t) => ({ title: t });
function stripDates(title){
  const r = parseQuick(title, {}); // pull "by friday" etc. out of the item text
  return { title: r.title || title, dueDate: r.dueDate, dueTime: r.dueTime };
}
registerPlugin({
  id:'fireflies', name:'Fireflies.ai import', version:'1.0.0', builtin:true,
  description:'Parses Fireflies “Action Items” sections (speaker headings or “Name: task” lines) into your items vs the client’s. Works offline, no AI needed.',
  setup(api){
    parseQuick = api.util.parse;
    api.extractors.add({ id:'fireflies', name:'Fireflies format (rule-based)', run: async (text, ctx) => {
      const lines = text.split(/\r?\n/), hasHeader = /action\s*items/i.test(text);
      let inAI = !hasHeader, speaker = null; const out = [];
      for(const raw of lines){
        const l = raw.trim(); if(!l) continue;
        if(/^[#>*\s]*action\s*items\b[*:\s]*$/i.test(l)){ inAI = true; continue; }
        if(hasHeader && inAI && /^#{1,6}\s|^\*\*[^*]+\*\*:?$/.test(l) && /^[#*\s]*(outline|overview|notes|shorthand|keywords|summary|bullet|transcript)\b/i.test(l.replace(/[#*]/g,'').trim())){ inAI = false; continue; }
        if(!inAI) continue;
        let m = l.match(/^\*\*([^*]{2,60})\*\*:?$/) || l.match(/^#{1,6}\s+(.{2,60})$/) || l.match(/^([A-Z][\w.'-]+(?:\s[A-Z][\w.'-]+){0,3}):$/);
        if(m){ speaker = m[1].trim(); continue; }
        let item = l.replace(/^(?:[-*•–]|\d+[.)])\s+/, '').replace(/^\[[ xX]?\]\s*/, '');
        let sp = speaker;
        const m2 = item.match(/^\**([A-Z][\w.'-]+(?:\s[A-Z][\w.'-]+){0,3})\**\s*(?::|–|—|-)\s+(.+)$/);
        if(m2){ sp = m2[1]; item = m2[2]; }
        item = item.replace(/\s*\(\s*\d{1,2}:\d{2}(?::\d{2})?\s*\)\s*$/, '').replace(/\*\*/g, '').trim();
        if(item.length < 4) continue;
        const d = stripDates(item, ctx);
        out.push({ title: d.title.charAt(0).toUpperCase() + d.title.slice(1), owner: isMe(sp, ctx) ? 'me' : 'client', assignee: isMe(sp, ctx) ? '' : (sp || ''), dueDate: d.dueDate, dueTime: d.dueTime });
      }
      return out;
    }});
    api.commands.add({ title:'Import Fireflies notes into meeting', run: api => api.meetings.importNotes() });
  }
});
registerPlugin({
  id:'ai-extract', name:'Smart extraction (Claude)', version:'1.0.0', builtin:true,
  description:'Uses Claude to read messy notes or full transcripts and pull out who owes what, with due dates. Falls back to the Fireflies parser when unavailable.',
  setup(api){
    api.extractors.add({ id:'ai', name:'✦ Smart (AI) — best for transcripts', available: () => !!api.ai, run: async (text, ctx, api) => {
      const ai = api.ai; if(!ai) throw new Error('AI not available here');
      const d = new Date();
      const prompt = `You extract action items from consulting meeting notes.
Today is ${ctx.today} (${d.toLocaleDateString('en-US',{weekday:'long'})}).
The consultant is: ${ctx.myName || 'unknown (assume "we"/"I" from the consultant side means the consultant)'}.
The client is: ${ctx.clientName || 'unknown'}.
Return ONLY JSON of the form {"items":[{"title":"short imperative task","owner":"me"|"client","assignee":"person name or empty","dueDate":"YYYY-MM-DD"|null,"dueTime":"HH:MM"|null}]}.
owner = "me" when the consultant must do it; "client" when anyone at the client must. Resolve relative dates ("by Friday", "next week") against today. Skip non-actionable chatter. Merge duplicates.
Notes:
"""
${text.slice(0, 60000)}
"""`;
      let res;
      if(typeof ai.json === 'function') res = await ai.json(prompt, { modelTier:'default' });
      else { const out = await ai(prompt, { modelTier:'default' }); const m = out.text.match(/\{[\s\S]*\}/); res = m ? JSON.parse(m[0]) : { items: [] }; }
      return (res && res.items) || (Array.isArray(res) ? res : []);
    }});
  }
});
registerPlugin({
  id:'plain-lines', name:'Plain list import', version:'1.0.0', builtin:true,
  description:'One action item per line. Supports “me:” / “c:” prefixes, ^Name, and dates.',
  setup(api){
    api.extractors.add({ id:'lines', name:'Plain list (one per line)', run: async (text) => text.split(/\r?\n/).map(l => l.replace(/^(?:[-*•]|\d+[.)])\s+/, '').trim()).filter(l => l.length > 2).map(l => {
      let owner = 'me'; const pm = l.match(/^(me|i|c|client|they)\s*[:>]\s*/i); if(pm){ owner = /^(me|i)$/i.test(pm[1]) ? 'me' : 'client'; l = l.slice(pm[0].length); }
      const r = api.util.parse(l, { owner }); return { title: r.title, owner: r.owner, assignee: r.assignee, dueDate: r.dueDate, dueTime: r.dueTime };
    })});
  }
});
})();
