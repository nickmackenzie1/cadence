/* Built-in Cadence plugin — uses only the public plugin API. */
(() => {
const registerPlugin = def => Cadence.registerPlugin(def);
registerPlugin({
  id:'zoho-tags', name:'Zoho product tags', version:'1.0.0', icon: '<path d="M3.5 12.5V4h8.5l8.5 8.5-8 8z"/><circle cx="8" cy="8.5" r="1.5"/>', color: '#e42527', category: 'Clients', tagline: 'Auto-tags CRM, Books, Desk…', builtin:true,
  description:'Type #crm, #books, #desk, #creator, #flow, #people, #projects, #analytics… and Cadence normalizes them to proper Zoho product tags.',
  setup(api){
    const map = { crm:'Zoho-CRM', books:'Zoho-Books', desk:'Zoho-Desk', creator:'Zoho-Creator', flow:'Zoho-Flow', people:'Zoho-People', projects:'Zoho-Projects', analytics:'Zoho-Analytics', inventory:'Zoho-Inventory', sign:'Zoho-Sign', cliq:'Zoho-Cliq', deluge:'Deluge', campaigns:'Zoho-Campaigns', forms:'Zoho-Forms', one:'Zoho-One' };
    api.parsers.add((text, r) => text.replace(/\s#(crm|books|desk|creator|flow|people|projects|analytics|inventory|sign|cliq|deluge|campaigns|forms|one)(?=\s)/gi, (m, k) => { r.tags.push(map[k.toLowerCase()]); return ' '; }));
  }
});
})();
