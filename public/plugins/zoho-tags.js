/* Built-in Cadence plugin — uses only the public plugin API. */
(() => {
const registerPlugin = def => Cadence.registerPlugin(def);
registerPlugin({
  id:'zoho-tags', name:'Zoho product tags', version:'1.0.0', builtin:true,
  description:'Type #crm, #books, #desk, #creator, #flow, #people, #projects, #analytics… and Cadence normalizes them to proper Zoho product tags.',
  setup(api){
    const map = { crm:'Zoho-CRM', books:'Zoho-Books', desk:'Zoho-Desk', creator:'Zoho-Creator', flow:'Zoho-Flow', people:'Zoho-People', projects:'Zoho-Projects', analytics:'Zoho-Analytics', inventory:'Zoho-Inventory', sign:'Zoho-Sign', cliq:'Zoho-Cliq', deluge:'Deluge', campaigns:'Zoho-Campaigns', forms:'Zoho-Forms', one:'Zoho-One' };
    api.parsers.add((text, r) => text.replace(/\s#(crm|books|desk|creator|flow|people|projects|analytics|inventory|sign|cliq|deluge|campaigns|forms|one)(?=\s)/gi, (m, k) => { r.tags.push(map[k.toLowerCase()]); return ' '; }));
  }
});
})();
