const $ = s => document.querySelector(s);
const money = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let catalog = [
 {id:'classic',name:'The Classic Tee',description:'Unisex crew neck · soft cotton · the everyday favorite',tag:'THE BAND FAVORITE',price:25,cut:'classic',colors:[['Band blue','#214b9c'],['Black','#24272d'],['White','#eeece5']]},
 {id:'fitted',name:'The Fitted Tee',description:'A shaped fit · lighter feel · same big sound',tag:'A LITTLE MORE FITTED',price:25,cut:'fitted',colors:[['Black','#24272d'],['Band blue','#214b9c'],['Heather gray','#979ca4']]},
 {id:'long',name:'The Long Sleeve',description:'Unisex fit · long sleeves · for those foggy days',tag:'FOR THE SAN FRANCISCO FOG',price:32,cut:'long',colors:[['Natural','#dedbd0'],['Black','#24272d'],['Band blue','#214b9c']]}
];
let designs = [
 {id:'season',name:'Season 2026',image:null}
];
catalog.forEach(p=>p.designs=designs.map(d=>d.id));
const baseCatalog=structuredClone(catalog),baseDesigns=structuredClone(designs);
const shirtSizes=p=>p.sizes||['XS','S','M','L','XL','2XL','3XL'];
let seasons;
try{seasons=JSON.parse(localStorage.getItem('sfbb-demo-seasons'));}catch{}
if(!Array.isArray(seasons)||!seasons.length){
 let legacy;try{legacy=JSON.parse(localStorage.getItem('sfbb-demo-season'));}catch{}
 seasons=[{id:'season-2026',name:legacy?.name||'The 2026 season collection',start:legacy?.start||'2026-10-01',end:legacy?.end||'2026-10-31',announcement:legacy?.announcement||'A season to remember. A shirt to keep.',state:'published',catalog:structuredClone(catalog),designs:structuredClone(designs),photo:null}];
}
let currentSeasonId=seasons[0].id,previewing=false;
const currentSeason=()=>seasons.find(s=>s.id===currentSeasonId);
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Los_Angeles'});
const isOpen=s=>s.state==='published'&&s.start<=today()&&s.end>=today();
const canAddToBag=()=>previewing||isOpen(currentSeason());
const seasonStatus=s=>s.state==='draft'?'Draft':s.state==='archived'?'Archived':isOpen(s)?'Orders open':s.start>today()?'Scheduled':'Closed';
const dateLabel=date=>new Date(date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
function saveSeasons(){const s=currentSeason();s.catalog=catalog;s.designs=designs;s.photo=photo;localStorage.setItem('sfbb-demo-seasons',JSON.stringify(seasons.map(season=>({...season,photo:null,catalog:season.catalog.map(p=>({...p,blanks:{}})),designs:season.designs.map(d=>({...d,image:null,artwork:{}}))}))));}
const selectedDesigns={classic:'season',fitted:'season',long:'season'};
const designName=i=>i.designName||designs.find(d=>d.id===(i.design||'season'))?.name||'Season 2026';
function designGraphic(p,color,design){
 const ink=(p.id==='classic'&&color===2||p.id==='long'&&color===0)?'#214078':'#ede7d0';
 if(design==='bridge')return `<g fill="${ink}" stroke="${ink}" text-anchor="middle"><circle cx="160" cy="137" r="47" fill="none" stroke-width="1"/><path d="M123 155 H197 M140 119 V162 M180 119 V162 M140 123 Q160 155 180 123 M123 143 Q134 137 140 123 M180 123 Q187 137 197 143" fill="none" stroke-width="3"/><path d="M129 140 V155 M151 138 V155 M160 142 V155 M169 138 V155 M191 140 V155" fill="none" stroke-width="1"/><text x="160" y="108" stroke="none" font-family="Arial" font-size="7" letter-spacing="1">GOLDEN GATE</text><text x="160" y="178" stroke="none" font-family="Arial" font-size="12" font-weight="800">BRASS BAND</text><text x="160" y="203" stroke="none" font-family="Arial" font-size="7" letter-spacing="2">SAN FRANCISCO · 2026</text></g>`;
 if(design==='sound')return `<g fill="${ink}" text-anchor="middle"><text x="160" y="102" font-family="Arial" font-size="8" letter-spacing="2">SAN FRANCISCO</text><text x="160" y="124" font-family="Arial" font-size="23" font-weight="900">ONE BIG</text><text x="160" y="147" font-family="Arial" font-size="23" font-weight="900">SOUND.</text><path d="M124 169 V179 M132 162 V186 M140 157 V191 M148 164 V184 M156 153 V195 M164 157 V191 M172 164 V184 M180 159 V189 M188 165 V183 M196 170 V178" stroke="${ink}" stroke-width="4"/><text x="160" y="210" font-family="Arial" font-size="7" letter-spacing="2">SFBB / SEASON 2026</text></g>`;
 return '';
}
let cart=[],editing=null,photo=null;
let orders;try{orders=JSON.parse(localStorage.getItem('sfbb-demo-orders'))}catch{};
if(!Array.isArray(orders))orders=[{code:'BR4SS2',name:'Alex Morgan',note:'See you at rehearsal!',items:[{id:'classic',color:0,size:'L',qty:2,price:25}],status:'Active'},{code:'MUS1C6',name:'Jamie Chen',note:'',items:[{id:'fitted',color:0,size:'M',qty:1,price:25},{id:'long',color:0,size:'L',qty:1,price:32}],status:'Active'},{code:'SF8B24',name:'Taylor Rivera',note:'',items:[{id:'classic',color:1,size:'XL',qty:1,price:25}],status:'Active'}];
const orderStages=['Open','Delivered · unpaid','Complete'];
orders.forEach(o=>{o.seasonId ||= 'season-2026';o.fulfillment=({'Unfulfilled':'Open','Ready for pickup':'Open','Fulfilled':'Delivered · unpaid','Delivered':'Delivered · unpaid','Awaiting Payment':'Delivered · unpaid'})[o.fulfillment]||o.fulfillment||'Open';o.items.forEach(i=>{i.design ||= 'season';i.designName ||= 'Season 2026';});});
const selections={classic:0,fitted:0,long:0};
const total=items=>items.reduce((n,i)=>n+i.price*i.qty,0);
const save=()=>localStorage.setItem('sfbb-demo-orders',JSON.stringify(orders));
function rawShirt(p,color,design='season'){const fill=p.colors[color][1],isLong=p.cut==='long',fitted=p.cut==='fitted';const path=isLong?'M104 39 L137 26 Q160 43 183 26 L216 39 L247 60 L279 232 L246 240 L218 117 L215 273 Q160 282 105 273 L102 117 L74 240 L41 232 L73 60 Z':fitted?'M107 40 L137 26 Q160 44 183 26 L213 40 L253 82 L224 111 L205 89 Q190 159 213 272 Q160 280 107 272 Q130 159 115 89 L96 111 L67 82 Z':'M99 40 L137 26 Q160 44 183 26 L221 40 L260 79 L230 112 L212 93 L213 273 Q160 282 107 273 L108 93 L90 112 L60 79 Z';return `<svg class="shirt-svg" viewBox="0 0 320 310" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(p.name)} in ${esc(p.colors[color][0])}, ${esc(designs.find(d=>d.id===design)?.name||'Season 2026')} design"><defs><linearGradient id="shade-${p.id}-${color}" x1="0" x2="1"><stop stop-color="#000" stop-opacity=".14"/><stop offset=".4" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".08"/></linearGradient></defs><path d="${path}" fill="${fill}"/><path d="${path}" fill="url(#shade-${p.id}-${color})"/><path d="M137 26 Q160 62 183 26" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="5"/><path d="M109 265 Q160 275 211 265" fill="none" stroke="#000" stroke-opacity=".12"/><path d="M117 107 L113 242 M204 107 L207 242" stroke="#000" stroke-opacity=".06" fill="none"/>${designs.find(d=>d.id===design)?.image?`<image href="${designs.find(d=>d.id===design).image}" x="121" y="81" width="78" height="102" preserveAspectRatio="xMidYMid meet"/>`:designGraphic(p,color,design)||`<g fill="${color===2&&p.id==='classic'||p.id==='long'&&color===0?'#214078':'#ede7d0'}" text-anchor="middle"><text x="160" y="93" font-family="Arial" font-size="7" letter-spacing="1.5">SAN FRANCISCO</text><text x="160" y="114" font-family="Arial" font-size="23" font-weight="900" letter-spacing="-1">BRASS</text><text x="160" y="134" font-family="Arial" font-size="23" font-weight="900" letter-spacing="-1">BAND</text><path d="M131 151 L181 151 L181 145 L196 139 L196 165 L181 159 L181 153 L131 153 Z"/><path d="M142 153 Q142 176 163 176 Q175 176 175 163 L175 155" fill="none" stroke="${p.id==='long'&&color===0?'#214078':'#ede7d0'}" stroke-width="3"/><text x="160" y="192" font-family="Arial" font-size="7" letter-spacing="3">SEASON 2026</text><path d="M133 200 L187 200" stroke="${p.id==='long'&&color===0?'#214078':'#ede7d0'}" stroke-width=".6"/></g>`}</svg>`}
function renderProducts(){ $('.section-heading h2 span').textContent=String(catalog.length).padStart(2,'0'); $('#products').innerHTML=catalog.map(p=>`<article class="product" data-product="${p.id}"><div class="product-image">${shirt(p,selections[p.id],selectedDesigns[p.id],productViews[p.id]||'front')}<div class="shirt-view-toggle"><button data-shirt-view="front" aria-pressed="${(productViews[p.id]||'front')==='front'}">Front</button><button data-shirt-view="back" aria-pressed="${productViews[p.id]==='back'}">Back</button></div></div><div class="product-head"><h3>${esc(p.name)}</h3><span class="price">${money(p.price).replace('.00','')}</span></div><p>${esc(p.description)}</p><div class="color-row">${p.colors.map((c,i)=>`<button class="swatch ${selections[p.id]===i?'selected':''}" style="--swatch:${c[1]}" data-color="${i}" aria-label="${esc(c[0])}" aria-pressed="${selections[p.id]===i}"></button>`).join('')}<span class="color-name">${esc(p.colors[selections[p.id]][0])}</span></div>${p.designs.length>1?`<label class="product-design">Artwork set<select data-design="${p.id}" aria-label="${esc(p.name)} design">${designs.filter(d=>p.designs.includes(d.id)).map(d=>`<option value="${d.id}" ${selectedDesigns[p.id]===d.id?'selected':''}>${esc(d.name)}</option>`).join('')}</select></label>`:''}<div class="product-controls"><select class="size-select" aria-label="${esc(p.name)} size"><option value="">Select your size</option>${shirtSizes(p).map(s=>`<option>${esc(s)}</option>`).join('')}</select><label class="product-quantity">Qty<input type="number" min="1" step="1" value="1" required aria-label="${esc(p.name)} quantity"></label><button class="add-button" ${!canAddToBag()?'disabled':''}>Add +</button></div></article>`).join('')||'<div class="empty-state"><h3>Your collection starts here.</h3><p>Add merchandise in the admin workspace before publishing this season.</p></div>';refreshMerchPreviews();}
$('#products').addEventListener('click',e=>{const article=e.target.closest('[data-product]');if(!article)return;const p=catalog.find(p=>p.id===article.dataset.product);if(e.target.matches('[data-color]')){const values=Array.from(document.querySelectorAll('[data-product]')).map(a=>({id:a.dataset.product,size:a.querySelector('.size-select').value,qty:a.querySelector('input').value}));selections[p.id]=Number(e.target.dataset.color);renderProducts();values.forEach(v=>{const a=$(`[data-product="${v.id}"]`);a.querySelector(".size-select").value=v.size;a.querySelector("input").value=v.qty;});}if(e.target.matches('.add-button')){if(!canAddToBag())return toast('This season is not accepting orders.');const size=article.querySelector('.size-select').value;if(!size){article.querySelector('.size-select').focus();return toast('Choose a size to add this shirt.')}const quantityInput=article.querySelector('input');const qty=Number(quantityInput.value);if(!quantityInput.reportValidity()||!Number.isSafeInteger(qty)||qty<1)return toast('Enter a whole-number quantity of at least 1.');const existing=cart.find(i=>i.id===p.id&&i.color===selections[p.id]&&i.size===size&&i.design===selectedDesigns[p.id]);if(existing)existing.qty+=qty;else cart.push({id:p.id,color:selections[p.id],size,qty,price:p.price,design:selectedDesigns[p.id],designName:designs.find(d=>d.id===selectedDesigns[p.id]).name});renderBag();toast(`${esc(p.name)} added to your bag`);}});
$('#products').addEventListener('change',e=>{
 if(!e.target.dataset.design)return;
 const id=e.target.dataset.design;selectedDesigns[id]=e.target.value;
 const p=catalog.find(p=>p.id===id),article=e.target.closest('[data-product]');
 article.querySelector('.product-image .shirt-svg,.product-image .preview-photo').outerHTML=shirt(p,selections[id],selectedDesigns[id],productViews[id]||'front');
});
function renderBag(){$('#bag-count').textContent=$('#drawer-count').textContent=cart.reduce((n,i)=>n+i.qty,0);$('#bag-total').textContent=money(total(cart));$('#checkout-button').disabled=!cart.length||previewing||!isOpen(currentSeason());$('#checkout-button').textContent=previewing?'Preview only — checkout unavailable':'Continue to checkout →';$('.drawer-bottom p').textContent=previewing?'This is a test bag. No order will be submitted.':'You’ll pay the band separately. No payment is taken here.';$('#bag-items').innerHTML=cart.length?cart.map((i,index)=>{const p=catalog.find(p=>p.id===i.id);return `<div class="bag-item"><div class="bag-thumb">${itemShirt(p,i)}</div><div class="bag-details"><h3>${esc(p.name)}</h3><p class="bag-design">${esc(designName(i))}</p><p>${esc(itemColorName(i,p))} / ${i.size} <b>· ${money(i.price)}</b></p><div class="quantity"><button data-quantity="-1" data-index="${index}" aria-label="Decrease quantity">−</button><input class="bag-quantity-input" type="number" min="1" step="1" value="${i.qty}" required data-bag-quantity="${index}" aria-label="${esc(p.name)} ${esc(itemColorName(i,p))} ${i.size} ${esc(designName(i))} quantity"><button data-quantity="1" data-index="${index}" aria-label="Increase quantity">+</button><button class="remove" data-remove="${index}">Remove</button></div></div></div>`}).join(''):'<div class="empty-state"><h3>Your bag is waiting.</h3><p>Add a shirt from the season lineup.</p></div>';}
$('#bag-items').addEventListener('click',e=>{if(e.target.dataset.quantity){const i=cart[+e.target.dataset.index];i.qty+=+e.target.dataset.quantity;cart=cart.filter(i=>i.qty>0);renderBag();}if(e.target.dataset.remove!==undefined){cart.splice(+e.target.dataset.remove,1);renderBag();}});
const openBag=()=>{$('#bag-drawer').hidden=false;$('#overlay').hidden=false;document.body.style.overflow='hidden';$('#bag-drawer [data-close]').focus();};const closeBag=()=>{$('#bag-drawer').hidden=true;$('#overlay').hidden=true;document.body.style.overflow='';};$('#cart-open').onclick=openBag;$('#overlay').onclick=closeBag;document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeBag);document.addEventListener('keydown',e=>{if(e.key==='Escape')closeBag()});
function parkManagementPanels(){document.querySelectorAll('#modal-content .management-panel').forEach(panel=>$('#management-panels').append(panel));}
function modal(html,eyebrow='SFBB MERCH'){parkManagementPanels();$('#modal').classList.remove('management-modal');$('#modal-content').innerHTML=html;$('#modal-eyebrow').textContent=eyebrow;if(!$('#modal').open)$('#modal').showModal();}$('#modal-close').onclick=()=>$('#modal').close();const dialog=$('#modal');
let backdropPress=null;
function outsideDialog(e){const r=dialog.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;}
dialog.addEventListener('pointerdown',e=>{backdropPress=e.button===0?{outside:e.target===dialog&&outsideDialog(e),x:e.clientX,y:e.clientY}:null;});
dialog.addEventListener('pointercancel',()=>{backdropPress=null;});
dialog.addEventListener('close',()=>{backdropPress=null;parkManagementPanels();dialog.classList.remove('management-modal');});
dialog.addEventListener('click',e=>{
 const press=backdropPress;backdropPress=null;
 if(press?.outside&&e.target===dialog&&outsideDialog(e)&&Math.hypot(e.clientX-press.x,e.clientY-press.y)<6)dialog.close();
});
function summary(items,amountOwed=total(items)){return `<div class="checkout-summary">${items.map(i=>{const p=catalog.find(p=>p.id===i.id);return `<div><span>${i.qty} × ${esc(p.name)}<br><small>${esc(designName(i))} · ${esc(itemColorName(i,p))} / ${i.size}</small></span><b>${money(i.qty*i.price)}</b></div>`}).join('')}<div class="total-line"><b>Total owed</b><b>${money(amountOwed)}</b></div></div>`;}
$('#checkout-button').onclick=()=>{if(previewing)return toast('This is a season preview. Checkout is unavailable.');closeBag();if(!isOpen(currentSeason()))return toast('Ordering is closed for this season.');const order=orders.find(o=>o.code===editing);modal(`<h2>${order?'Update your order.':'All set for the season?'}</h2><p>No account needed. Save your order code to make changes before ${dateLabel(currentSeason().end)}.</p><form id="checkout-form"><label>Full name<input name="name" autocomplete="name" required placeholder="Your first and last name" value="${esc(order?.name||'')}"></label><label>Note to the band <span style="font-weight:400;color:#858b95">(optional)</span><textarea name="note" placeholder="Anything we should know?">${esc(order?.note||'')}</textarea></label>${summary(cart)}<p class="field-help">No payment is taken here. Please arrange payment with the band.</p><button class="primary wide" type="submit">${order?'Save changes':'Place order'} →</button></form>`,'CHECKOUT');$('#checkout-form').onsubmit=e=>{e.preventDefault();let code=editing;if(!code){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';do{code=Array.from(crypto.getRandomValues(new Uint8Array(6)),v=>alphabet[v%alphabet.length]).join('')}while(orders.some(o=>o.code===code))}const entry={code,name:e.target.name.value.trim(),note:e.target.note.value.trim(),items:structuredClone(cart).map(i=>snapshotItemColor(i,catalog.find(p=>p.id===i.id))),status:'Active',seasonId:currentSeasonId,fulfillment:order?.fulfillment||'Open'};if(!entry.name)return;const index=orders.findIndex(o=>o.code===code);if(index>=0)orders[index]=entry;else orders.push(entry);save();cart=[];editing=null;renderBag();renderAdmin();confirmation(entry);};};
function confirmation(o){modal(`<div class="success-icon">✓</div><h2>You’re on the list.</h2><p>Thanks, ${esc(o.name)}. Your order is saved in this demo browser.</p><div class="order-code">${o.code}</div><button class="secondary wide" id="copy-code">Copy order code</button><p>Keep this code. Use “Find my order” to view, edit, or cancel before ${dateLabel(currentSeason().end)}.</p>${summary(o.items)}<button class="primary wide" id="done-order">Back to the season shop</button>`,'ORDER CONFIRMED');$('#copy-code').onclick=async()=>{try{await navigator.clipboard.writeText(o.code);toast('Order code copied')}catch{toast(`Your order code: ${o.code}`)}};$('#done-order').onclick=()=>$('#modal').close();}
$('#lookup-nav').onclick=()=>{modal(`<h2>Find your order.</h2><p>Enter the six-character code you received at checkout.</p><form id="lookup-form"><label>Order code<input name="code" maxlength="6" minlength="6" required placeholder="e.g. BR4SS2" style="text-transform:uppercase;letter-spacing:3px" autocomplete="off"></label><p id="lookup-error" role="alert" style="color:#ae3e3e"></p><button class="primary wide">Look up order →</button></form><p class="field-help">Lost your code? Ask the band’s merch admin to find your order by name. Try BR4SS2 in this demo.</p>`,'YOUR ORDER');$('#lookup-form').onsubmit=e=>{e.preventDefault();const o=orders.find(o=>o.code===e.target.code.value.trim().toUpperCase());if(!o){$('#lookup-error').textContent='We couldn’t find that code. Check it and try again.';return}showOrder(o)};};
function showOrder(o,admin=false){if(o.seasonId!==currentSeasonId)selectSeason(o.seasonId);admin=admin&&sessionRole==='admin';const canChange=admin||(isOpen(currentSeason())&&o.fulfillment==='Open');modal(`<h2>${esc(o.name)}’s order</h2><p>Order <b>${o.code}</b> · <span class="status ${o.status==='Cancelled'?'cancelled':''}">${exportStatus(o)}</span></p>${summary(o.items,o.status==='Cancelled'||o.fulfillment==='Complete'?0:total(o.items))}${o.note?`<p><b>Member note</b><br>${esc(o.note)}</p>`:''}<p>Season: ${esc(currentSeason().name)}</p><p class="field-help">${admin?'Admins can edit or cancel this order even after ordering closes.':canChange?'Changes are available until '+dateLabel(currentSeason().end)+'.':'Order changes are closed. Contact the merch admin for help.'}</p><div class="lookup-actions">${!canChange?'':o.status==='Active'?`<button class="primary" id="edit-order">Edit order</button><button class="danger" id="cancel-order">Cancel order</button>`:`<button class="primary" id="restore-order">Restore order</button>`}</div>`,'ORDER DETAILS');if($('#edit-order'))$('#edit-order').onclick=()=>{if(admin)return editAdminOrder(o);cart=structuredClone(o.items);editing=o.code;renderBag();$('#modal').close();showShop();openBag();toast('Update your bag, then check out to save changes.')};if($('#cancel-order'))$('#cancel-order').onclick=()=>{modal(`<h2>Cancel this order?</h2><p>${esc(o.name)}, your ${money(total(o.items))} order will be removed from fulfillment and billing. ${admin?'You can restore it from the admin order view.':'You can restore it while ordering is open.'}</p><button class="danger wide" id="confirm-cancel">Yes, cancel order ${o.code}</button><button class="text-button wide" id="keep-order">Keep my order</button>`);$('#confirm-cancel').onclick=()=>{o.status='Cancelled';save();renderAdmin();showOrder(o,admin);toast('Order cancelled')};$('#keep-order').onclick=()=>showOrder(o,admin)};if($('#restore-order'))$('#restore-order').onclick=()=>{o.status='Active';save();renderAdmin();showOrder(o,admin);toast('Order restored')};}
function editAdminOrder(o){
 const draft=structuredClone(o);
 modal(`<h2>Edit order ${esc(o.code)}.</h2><form id="admin-order-form"><label>Full name<input name="memberName" required maxlength="100" value="${esc(o.name)}"></label><label>Member note<textarea name="note">${esc(o.note)}</textarea></label><div id="admin-order-items"></div><button class="secondary" type="button" id="admin-add-item">+ Add item</button><p id="admin-order-error" role="alert"></p><div class="lookup-actions"><button class="primary" type="submit">Save order</button><button class="secondary" type="button" id="admin-edit-cancel">Discard changes</button></div></form>`,'ADMIN ORDER EDIT');
 $('#modal').classList.add('management-modal');
 const form=$('#admin-order-form'),items=$('#admin-order-items');
 function readItems(){draft.items=Array.from(items.querySelectorAll('.admin-order-row')).map((row,index)=>{const original=draft.items[index],value=key=>row.querySelector(`[data-item-field="${key}"]`).value;return {id:value('id'),color:Number(value('color')),design:value('design'),size:value('size'),qty:Number(value('qty')),price:Number(value('price')),...(original?.id===value('id')&&original?.color===Number(value('color'))?{colorName:original.colorName,colorHex:original.colorHex}:{}),designName:designName({design:value('design')})};});}
 function paintItems(){items.innerHTML=draft.items.map((i,index)=>{
  const p=catalog.find(p=>p.id===i.id),available=designs.filter(d=>p.designs.includes(d.id)||d.id===i.design);
  return `<section class="admin-order-row"><div class="admin-item-heading"><b>Item ${index+1}</b><button class="text-button" type="button" data-admin-remove="${index}" aria-label="Remove item ${index+1}">Remove</button></div><label>Shirt style<select data-item-field="id" aria-label="Item ${index+1} shirt style">${catalog.map(p=>`<option value="${p.id}" ${i.id===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><div class="form-row"><label>Color<select data-item-field="color" aria-label="Item ${index+1} color">${p.colors.map((c,n)=>`<option value="${n}" ${i.color===n?'selected':''}>${esc(c[0])}</option>`).join('')}</select></label><label>Size<select data-item-field="size" aria-label="Item ${index+1} size">${shirtSizes(p).map(size=>`<option ${size===i.size?'selected':''}>${esc(size)}</option>`).join('')}</select></label></div><label ${available.length===1?'hidden':''}>Artwork set<select data-item-field="design" aria-label="Item ${index+1} design">${available.map(d=>`<option value="${d.id}" ${d.id===i.design?'selected':''}>${esc(d.name)}</option>`).join('')}</select></label><div class="form-row"><label>Quantity<input data-item-field="qty" aria-label="Item ${index+1} quantity" type="number" min="1" step="1" required value="${i.qty}"></label><label>Unit price ($)<input data-item-field="price" aria-label="Item ${index+1} unit price" type="number" min="0" step="0.01" required value="${i.price}"></label></div></section>`;
 }).join('');}
 items.onchange=e=>{if(e.target.dataset.itemField!=='id')return;readItems();const index=Array.from(items.children).indexOf(e.target.closest('.admin-order-row')),p=catalog.find(p=>p.id===draft.items[index].id);draft.items[index]={id:p.id,color:0,size:shirtSizes(p)[0],design:p.designs[0],qty:draft.items[index].qty||1,price:p.price};paintItems();};
 items.onclick=e=>{const button=e.target.closest('[data-admin-remove]');if(!button)return;readItems();draft.items.splice(Number(button.dataset.adminRemove),1);paintItems();};
 $('#admin-add-item').onclick=()=>{readItems();const p=catalog[0];if(!p)return;draft.items.push({id:p.id,color:0,size:shirtSizes(p)[0],design:p.designs[0],qty:1,price:p.price});paintItems();};
 $('#admin-edit-cancel').onclick=()=>showOrder(o,true);
 form.onsubmit=e=>{
  e.preventDefault();readItems();const name=form.elements.memberName.value.trim();
  if(!name||!draft.items.length||draft.items.some(i=>!Number.isSafeInteger(i.qty)||i.qty<1||!Number.isFinite(i.price)||i.price<0)){$('#admin-order-error').textContent='Enter a full name and at least one item with a valid quantity and price.';return;}
  draft.items.forEach(i=>snapshotItemColor(i,catalog.find(p=>p.id===i.id)));Object.assign(o,{name,note:form.elements.note.value.trim(),items:draft.items});save();renderAdmin();showOrder(o,true);toast('Order updated');
 };
 paintItems();
}
function selectSeason(id){
 if(!seasons.some(s=>s.id===id))return;
 if(currentSeasonId!==id){saveSeasons();cart=[];editing=null;}
 currentSeasonId=id;const s=currentSeason();catalog=s.catalog;designs=s.designs;photo=s.photo||null;
 catalog.forEach(p=>{selections[p.id]=0;selectedDesigns[p.id]=p.designs[0];});
 renderProducts();renderBag();renderMerch();renderSeasonUI();renderAdmin();
}
function showShop(preview=false){
 previewing=preview;
 if(!preview){const open=seasons.find(isOpen)||seasons.find(s=>s.state==='published');if(open)selectSeason(open.id);}
 renderBag();$('#shop-view').hidden=false;$('#admin-view').hidden=true;$('#shop-nav').classList.add('active');$('#admin-nav').style.color='';renderSeasonUI();
}
$('#shop-nav').onclick=()=>showShop();
$('#admin-nav').onclick=()=>{previewing=false;$('#shop-view').hidden=true;$('#admin-view').hidden=false;$('#shop-nav').classList.remove('active');$('#admin-nav').style.color='var(--blue)';renderAdmin();renderSeasonUI();};
function renderAdmin(){
 const scoped=orders.filter(o=>o.seasonId===currentSeasonId),active=scoped.filter(o=>o.status==='Active');
 $('#stat-orders').textContent=active.length;$('#stat-season').textContent=currentSeason().name;
 $('#stat-items').textContent=active.filter(o=>o.fulfillment==='Open').reduce((n,o)=>n+o.items.reduce((n,i)=>n+i.qty,0),0);
 $('#stat-total').textContent=money(active.filter(o=>o.fulfillment!=='Complete').reduce((n,o)=>n+total(o.items),0)).replace('.00','');
 const search=$('#admin-search').value.toLowerCase();
 $('#order-rows').innerHTML=scoped.filter(o=>(o.name+' '+o.code).toLowerCase().includes(search)).map(o=>`<tr><td><b>${esc(o.name)}</b><small>${o.code}</small></td><td>${o.items.reduce((n,i)=>n+i.qty,0)} items<small>${o.items.map(i=>`${esc(catalog.find(p=>p.id===i.id)?.name||'Merchandise')} · ${esc(designName(i))} · ${i.size}`).join(', ')}</small></td><td><b>${money(o.status==='Cancelled'||o.fulfillment==='Complete'?0:total(o.items))}</b></td><td>${o.status==='Cancelled'?'<span class="status cancelled">Cancelled</span>':`<select class="fulfillment-select" data-fulfillment="${o.code}" aria-label="Order status for ${esc(o.name)}" ${o.status==='Cancelled'?'disabled':''}>${orderStages.map(status=>`<option ${o.fulfillment===status?'selected':''}>${status}</option>`).join('')}</select>`}</td><td><button class="secondary" data-order="${o.code}">View ↗</button></td></tr>`).join('')||'<tr><td colspan="5">No matching orders in this season.</td></tr>';
}
$('#admin-search').oninput=renderAdmin;
$('#order-rows').onclick=e=>{if(e.target.dataset.order)showOrder(orders.find(o=>o.code===e.target.dataset.order),true)};
$('#order-rows').onchange=e=>{if(!e.target.dataset.fulfillment)return;const o=orders.find(o=>o.code===e.target.dataset.fulfillment);o.fulfillment=e.target.value;save();renderAdmin();toast(`${o.name}: ${o.fulfillment}`);};
function adminTab(tab){$('.season-context').hidden=tab==='seasons';document.querySelectorAll('[data-tab]').forEach(t=>t.classList.toggle('active',t.dataset.tab===tab));['orders','merchandise','seasons'].forEach(t=>$(`#admin-${t}`).hidden=t!==tab);}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>adminTab(b.dataset.tab));
function renderMerch(){
 $('#merch-list').innerHTML=catalog.map(p=>`<div class="merch-row"><div class="merch-style-section"><div class="merch-style-header"><b>${esc(p.name)}</b><div class="merch-item-actions"><b>${money(p.price)}</b><button class="secondary" data-manage-style="${p.id}" aria-label="Manage ${esc(p.name)}">Manage style</button></div></div><p>${p.colors.map(c=>esc(c[0])).join(' · ')} / ${shirtSizes(p).map(esc).join(' · ')}</p>${merchPreview(p)}</div></div>`).join('')||'<p>Add a shirt style to start this collection.</p>';
 const prior=$('#art-design').value;
 $('#art-design').innerHTML=designs.map(d=>`<option value="${d.id}">${esc(d.name)}</option>`).join('');
 if(designs.some(d=>d.id===prior))$('#art-design').value=prior;
 $('#art-design').closest('label').hidden=designs.length===1;

 renderBlankUploads();
}
$('#modal-content').addEventListener('click',e=>{
 const button=e.target.closest('[data-delete-style]');if(!button)return;
 const id=button.dataset.deleteStyle,p=catalog.find(p=>p.id===id);if(!p)return;
 const hasOrders=orders.some(o=>o.seasonId===currentSeasonId&&o.items.some(i=>i.id===id));
 if(hasOrders){
  modal(`<h2>This style has member orders.</h2><p>${esc(p.name)} cannot be deleted because it appears in this season’s orders, including cancelled orders. Keep the style so order details and fulfillment reports stay complete.</p><button class="primary wide" id="keep-style">Back to merchandise</button>`,'SHIRT STYLE');
  $('#keep-style').onclick=()=>$('#modal').close();return;
 }
 const inBag=cart.some(i=>i.id===id);
 modal(`<h2>Delete ${esc(p.name)}?</h2><p>This removes the style, its shirt images, and its preview placements from ${esc(currentSeason().name)}.${inBag?' Items of this style will also be removed from your current bag.':''} Other seasons and the design library stay available.</p><div class="lookup-actions"><button class="danger" id="confirm-delete-style">Delete style</button><button class="secondary" id="keep-style">Keep style</button></div>`,'DELETE SHIRT STYLE');
 $('#keep-style').onclick=()=>$('#modal').close();
 $('#confirm-delete-style').onclick=()=>{
  catalog=catalog.filter(p=>p.id!==id);cart=cart.filter(i=>i.id!==id);
  delete selections[id];delete selectedDesigns[id];delete productViews[id];delete adminPreviewChoices[id];
  saveSeasons();renderMerch();renderProducts();renderBag();renderSeasonUI();$('#modal').close();toast('Shirt style deleted');
 };
});
$('#modal-content').addEventListener('input',e=>{
 if(!e.target.dataset.price||!e.target.validity.valid||e.target.value==='')return;
 const p=catalog.find(p=>p.id===e.target.dataset.price);if(!p)return;
 p.price=Number(e.target.value);saveSeasons();renderProducts();renderMerch();
});
$('#modal-content').addEventListener('change',e=>{
 if(e.target.dataset.availableProduct){
  const p=catalog.find(p=>p.id===e.target.dataset.availableProduct);
  if(e.target.checked)p.designs.push(e.target.value);else{
   if(p.designs.length===1){e.target.checked=true;return toast('Keep at least one available design per item.')}
   p.designs=p.designs.filter(id=>id!==e.target.value);
  }
  if(!p.designs.includes(selectedDesigns[p.id]))selectedDesigns[p.id]=p.designs[0];
  renderProducts();saveSeasons();toast('Available designs updated');
 }
});
function openArtworkManager(){
 modal(`<h2>${designs.length===1?'Season artwork set':'Manage artwork sets'}.</h2><p>${designs.length===1?'Upload the front and back artwork as one set. The matching side applies to every shirt style; adjust placement on each preview.':'Upload front and back artwork for the selected set. Choose available sets in each shirt style’s settings.'}</p><div id="management-slot"></div><button class="primary wide" id="management-done">Done</button>`,'DESIGN LIBRARY');
 $('#management-slot').append($('#artwork-management'));$('#modal').classList.add('management-modal');
 renderArtworkThumbnail();$('#management-done').onclick=()=>$('#modal').close();
}
function artworkImage(d,view){return d?.artwork?.[view]||(view==='front'?d?.image:null);}
function renderArtworkThumbnail(){const d=designs.find(d=>d.id===$('#art-design').value);$('#artwork-thumbnail').innerHTML=['front','back'].map(view=>{const src=artworkImage(d,view);return `<div><b>${view==='front'?'Front':'Back'} artwork</b>${src?`<img src="${src}" alt="${esc(d.name)} ${view} artwork">`:'<p class="field-help">No artwork uploaded for this side.</p>'}</div>`;}).join('');}

function deleteArtworkSetPrompt(){
 const id=$('#art-design').value,d=designs.find(d=>d.id===id);if(!d)return;
 if(orders.some(o=>o.seasonId===currentSeasonId&&o.items.some(i=>(i.design||'season')===id))){
  modal(`<h2>This artwork set has orders.</h2><p>${esc(d.name)} cannot be deleted because it appears in this season’s orders, including cancelled orders. Keep it so order records and reports stay complete.</p><button class="primary wide" id="keep-artwork-set">Back to artwork</button>`,'DELETE ARTWORK SET');
  $('#keep-artwork-set').onclick=openArtworkManager;return;
 }
 if(designs.length===1){
  modal('<h2>Keep one artwork set available.</h2><p>Add another front/back set before deleting the season’s last artwork set.</p><button class="primary wide" id="keep-artwork-set">Back to artwork</button>','DELETE ARTWORK SET');
  $('#keep-artwork-set').onclick=openArtworkManager;return;
 }
 const needsReplacement=catalog.some(p=>p.designs.length===1&&p.designs[0]===id),replacement=designs.find(d=>d.id!==id);
 modal(`<h2>Delete ${esc(d.name)}?</h2><p>This removes both artwork files and this set’s saved placements from the season. Blank shirt photos and other sets stay available.${needsReplacement?' Styles using only this set will switch to '+esc(replacement.name)+'.':''}${cart.some(i=>i.design===id)?' Items using this set will be removed from your bag.':''}</p><div class="lookup-actions"><button class="danger" id="confirm-delete-artwork-set">Delete artwork set</button><button class="secondary" id="keep-artwork-set">Keep artwork set</button></div>`,'DELETE ARTWORK SET');
 $('#keep-artwork-set').onclick=openArtworkManager;
 $('#confirm-delete-artwork-set').onclick=()=>{
  if(designs.length===1||orders.some(o=>o.seasonId===currentSeasonId&&o.items.some(i=>(i.design||'season')===id)))return;
  designs=designs.filter(d=>d.id!==id);
  catalog.forEach(p=>{
   p.designs=p.designs.filter(set=>set!==id);if(!p.designs.length)p.designs=[designs[0].id];
   for(const key of Object.keys(p.placements||{}))if(key.startsWith(id+':'))delete p.placements[key];
   if(!p.designs.includes(selectedDesigns[p.id]))selectedDesigns[p.id]=p.designs[0];
   if(adminPreviewChoices[p.id]?.design===id)adminPreviewChoices[p.id].design=p.designs[0];
  });
  cart=cart.filter(i=>(i.design||'season')!==id);saveSeasons();renderMerch();renderProducts();renderBag();openArtworkManager();toast('Artwork set deleted');
 };
}
$('#delete-artwork-set').onclick=deleteArtworkSetPrompt;
$('#manage-artwork').onclick=openArtworkManager;$('#art-design').onchange=renderArtworkThumbnail;
function itemColorName(i,p){return i.colorName||p.colors[i.color][0];}
function snapshotItemColor(i,p){i.colorName ||= p.colors[i.color][0];i.colorHex ||= p.colors[i.color][1];return i;}
function itemShirt(p,i){if(!i.colorHex)return shirt(p,i.color,i.design);const copy={...p,colors:p.colors.map(c=>[...c])};copy.colors[i.color]=[itemColorName(i,p),i.colorHex];return shirt(copy,i.color,i.design);}
function updateStyleColors(p,colors,origins=colors.map((_,i)=>i<p.colors.length?i:null)){
 if(!colors.length||colors.some(c=>!c[0].trim()||!/^#[0-9a-f]{6}$/i.test(c[1])))return 'Keep at least one color, with a name and valid swatch.';
 if(new Set(colors.map(c=>c[0].trim().toLowerCase())).size!==colors.length)return 'Use a different name for each color.';
 const mapping=new Map(origins.flatMap((old,index)=>old===null?[]:[[old,index]]));
 const scoped=orders.filter(o=>o.seasonId===currentSeasonId);
 if(scoped.some(o=>o.items.some(i=>i.id===p.id&&!mapping.has(i.color))))return 'Colors used in orders, including cancelled orders, cannot be removed.';
 scoped.forEach(o=>o.items.filter(i=>i.id===p.id).forEach(i=>{snapshotItemColor(i,p);i.color=mapping.get(i.color);}));
 cart=cart.filter(i=>i.id!==p.id||mapping.has(i.color));cart.forEach(i=>{if(i.id===p.id)i.color=mapping.get(i.color);});
 function remapKeys(data){return Object.fromEntries(Object.entries(data||{}).flatMap(([key,value])=>{const parts=key.split(':'),last=parts.at(-1);if(!/^\d+$/.test(last))return [[key,value]];if(!mapping.has(Number(last)))return [];parts[parts.length-1]=String(mapping.get(Number(last)));return [[parts.join(':'),value]];}));}
 p.blanks=remapKeys(p.blanks);p.placements=remapKeys(p.placements);
 selections[p.id]=mapping.get(selections[p.id])??0;
 if(adminPreviewChoices[p.id])adminPreviewChoices[p.id].color=mapping.get(adminPreviewChoices[p.id].color)??0;
 if($('#blank-product').value===p.id)$('#blank-color').value=String(mapping.get(Number($('#blank-color').value))??0);
 p.colors=colors.map(c=>[c[0].trim(),c[1]]);save();saveSeasons();return null;
}
function openStyleManager(id){
 const p=catalog.find(p=>p.id===id);if(!p)return;
 modal(`<h2>Manage ${esc(p.name)}.</h2><p>${esc(p.description)}</p><label>Price ($)<input type="number" min="0" step="0.01" value="${p.price}" data-price="${p.id}"></label>${designs.length>1?`<fieldset class="available-designs"><legend>Available artwork sets</legend>${designs.map(d=>`<label><input type="checkbox" data-available-product="${p.id}" value="${d.id}" ${p.designs.includes(d.id)?'checked':''}>${esc(d.name)}</label>`).join('')}</fieldset>`:'<p class="field-help">The season’s front/back artwork set is applied automatically.</p>'}<form id="style-colors-form"><fieldset class="style-colors"><legend>Available colors</legend><div id="edit-style-color-rows"></div><button class="text-button" type="button" id="add-edit-color">+ Add color</button></fieldset><p class="field-help">Add, edit, or remove colors, then Save colors. Colors used in orders are protected; keep at least one color.</p><p id="edit-colors-error" role="alert"></p><button class="secondary" type="submit">Save colors</button></form><div id="management-slot"></div><p class="field-help">Prices, available sets, and uploads save immediately. Save color changes with Save colors. Uploaded images stay in this browser session.</p><div class="lookup-actions"><button class="primary" id="management-done">Done</button><button class="text-button delete-style" data-delete-style="${p.id}">Delete style</button></div>`,'SHIRT STYLE');
 $('#management-slot').append($('#shirt-image-management'));$('#modal').classList.add('management-modal');
 $('#blank-product').value=id;renderBlankColors();$('#management-done').onclick=()=>$('#modal').close();
 const colorRows=$('#edit-style-color-rows');let colorRowSequence=0;
 function addColorRow(name='',hex='#214b9c',origin=null){
  const row=document.createElement('div');row.className='edit-style-color-row';const number=++colorRowSequence;row.dataset.origin=origin===null?'new':String(origin);
  row.innerHTML=`<label>Color name<input class="edit-color-name" aria-label="Color ${number} name" maxlength="40" required value="${esc(name)}" placeholder="e.g. Navy"></label><label>Swatch<input class="edit-color-hex" aria-label="Color ${number} swatch" type="color" value="${esc(hex)}"></label><button type="button" class="text-button remove-style-color" aria-label="Remove ${esc(name||'new color')}">Remove</button>`;row.querySelector('button').onclick=()=>{if(colorRows.children.length===1){$('#edit-colors-error').textContent='Keep at least one color.';return;}if(origin!==null&&orders.some(o=>o.seasonId===currentSeasonId&&o.items.some(i=>i.id===p.id&&i.color===origin))){$('#edit-colors-error').textContent='This color is used in orders and cannot be removed.';return;}row.remove();$('#edit-colors-error').textContent='Color removed from this draft. Save colors to apply the change.';};colorRows.append(row);
 }
 p.colors.forEach((c,i)=>addColorRow(...c,i));$('#add-edit-color').onclick=()=>{addColorRow();colorRows.lastElementChild.querySelector('input').focus();};
 $('#style-colors-form').onsubmit=e=>{
  e.preventDefault();const colors=Array.from(colorRows.children).map(row=>[row.querySelector('.edit-color-name').value,row.querySelector('.edit-color-hex').value]);const origins=Array.from(colorRows.children).map(row=>row.dataset.origin==='new'?null:Number(row.dataset.origin));const error=updateStyleColors(p,colors,origins);
  $('#edit-colors-error').textContent=error||'';if(error)return;
  colorRows.innerHTML='';colorRowSequence=0;p.colors.forEach((c,i)=>addColorRow(...c,i));renderMerch();renderProducts();renderBag();renderBlankColors();toast('Shirt colors saved');
 };

}
$('#merch-list').addEventListener('click',e=>{const button=e.target.closest('[data-manage-style]');if(button)openStyleManager(button.dataset.manageStyle);});
$('#add-design').onclick=()=>{
 modal(`<h2>Add an artwork set.</h2><p>Name the set, then upload its front and back PNGs.</p><form id="design-form"><label>Artwork set name<input name="designName" maxlength="60" required placeholder="e.g. Fall concert"></label><button class="primary wide">Add artwork set</button></form>`,'DESIGN LIBRARY');
 $('#design-form').onsubmit=e=>{
  e.preventDefault();const name=e.target.elements.namedItem('designName').value.trim();if(!name)return;
  if(designs.some(d=>d.name.toLowerCase()===name.toLowerCase()))return toast('A design with this name already exists.');
  const id='design-'+crypto.randomUUID();designs.push({id,name,image:null,artwork:{}});catalog.forEach(p=>p.designs.push(id));
  renderMerch();$('#art-design').value=id;renderProducts();saveSeasons();openArtworkManager();toast('Design added. Upload its artwork to finish the preview.');
 };
};
for(const input of [$('#art-upload'),$('#art-back-upload')])input.onchange=()=>{
 const file=input.files[0],d=designs.find(d=>d.id===$('#art-design').value),view=input.dataset.artworkView,season=currentSeason();if(!file||!d)return;
 if(file.type!=='image/png')return toast('Choose a transparent PNG for the artwork.');
 if(file.size>8*1024*1024)return toast('Please choose an image under 8 MB.');
 const reader=new FileReader();reader.onload=()=>{d.artwork ||= {front:d.image||null};d.artwork[view]=reader.result;
  if(currentSeason()===season){renderProducts();renderBag();saveSeasons();renderArtworkThumbnail();$('#upload-status').textContent=`${d.name} · ${view} artwork uploaded. Both sides belong to this set.`;}
  toast(view==='front'?'Front artwork updated':'Back artwork updated');
 };reader.readAsDataURL(file);
};

function renderSeasonUI(){
 const s=currentSeason();$('#editing-season-name').textContent=s.name;$('#editing-season-dates').textContent=dateLabel(s.start)+' – '+dateLabel(s.end);$('#season-settings-name').textContent=s.name;$('#admin-season-select').innerHTML=seasons.map(x=>`<option value="${x.id}" ${x.id===s.id?'selected':''}>${esc(x.name)}</option>`).join('');
 $('#season-context-status').innerHTML=`<span class="status ${s.state==='draft'?'draft':''}">${seasonStatus(s)}</span>`;
 for(const key of ['name','start','end','announcement'])$('#season-form').elements.namedItem(key).value=s[key];
 $('.hero-copy .eyebrow').innerHTML='<span class="status-dot"></span>'+esc(s.name.toUpperCase());
 $('.hero-copy>p').textContent=s.announcement;
 $('.open-pill').textContent=previewing?'Season preview':seasonStatus(s);document.querySelectorAll('.add-button').forEach(b=>b.disabled=!canAddToBag());
 $('#preview-ordering-note').hidden=!previewing;$('.deadline').textContent=isOpen(s)?'Through '+dateLabel(s.end):dateLabel(s.start)+' – '+dateLabel(s.end);
 $('#season-cards').innerHTML=seasons.map(x=>`<article class="season-card"><div><span class="status ${x.state==='draft'?'draft':''}">${seasonStatus(x)}</span><h3>${esc(x.name)}</h3><p>${dateLabel(x.start)} – ${dateLabel(x.end)}</p><small>${x.catalog.length} merchandise items · ${orders.filter(o=>o.seasonId===x.id&&o.status==='Active').length} active orders</small></div><div class="season-card-actions"><button class="secondary" data-manage-season="${x.id}">Manage</button><button class="secondary" data-preview-season="${x.id}">Preview shop ↗</button>${x.state==='draft'?`<button class="primary" data-publish-season="${x.id}">Publish season</button>`:''}</div></article>`).join('');
}
$('#admin-season-select').onchange=e=>selectSeason(e.target.value);
$('#season-form').onsubmit=e=>{
 e.preventDefault();const f=e.target.elements,name=f.namedItem('name').value.trim(),start=f.namedItem('start').value,end=f.namedItem('end').value;
 if(end<start)return toast('Closing date must be after the opening date.');
 if(currentSeason().state==='published'&&seasons.some(s=>s.id!==currentSeasonId&&s.state==='published'&&start<=s.end&&end>=s.start))return toast('These dates overlap another published season.');
 Object.assign(currentSeason(),{name,start,end,announcement:f.namedItem('announcement').value});saveSeasons();renderSeasonUI();$('#modal').close();toast('Season settings saved');
};
function openSeasonManager(){
 modal('<div id="management-slot"></div>','SEASON SETTINGS');
 $('#management-slot').append($('#admin-season'));$('#modal').classList.add('management-modal');
 renderSeasonUI();
}
$('#cancel-season-settings').onclick=()=>$('#modal').close();
function deleteSeasonPrompt(){
 const season=currentSeason(),id=season.id;
 if(orders.some(o=>o.seasonId===id)){
  modal(`<h2>This season has orders.</h2><p>${esc(season.name)} cannot be deleted because it contains member orders, including cancelled orders. Keep it so order lookups and reports remain available.</p><button class="primary wide" id="keep-season">Back to season settings</button>`,'DELETE SEASON');
  $('#keep-season').onclick=openSeasonManager;return;
 }
 if(seasons.length===1){
  modal('<h2>Keep one season available.</h2><p>Create another season before deleting the last one.</p><button class="primary wide" id="keep-season">Back to season settings</button>','DELETE SEASON');
  $('#keep-season').onclick=openSeasonManager;return;
 }
 modal(`<h2>Delete ${esc(season.name)}?</h2><p>This deletes the season and its collection of shirt styles, artwork, and preview placements.${cart.length?' Your current bag for this season will also be cleared.':''} Other seasons remain available.</p><div class="lookup-actions"><button class="danger" id="confirm-delete-season">Delete season</button><button class="secondary" id="keep-season">Keep season</button></div>`,'DELETE SEASON');
 $('#keep-season').onclick=openSeasonManager;
 $('#confirm-delete-season').onclick=()=>{
  if(orders.some(o=>o.seasonId===id)||seasons.length===1)return;
  seasons=seasons.filter(s=>s.id!==id);
  const next=seasons.find(isOpen)||seasons.find(s=>s.state==='published')||seasons[0];
  cart=[];editing=null;previewing=false;currentSeasonId=next.id;
  selectSeason(next.id);saveSeasons();$('#modal').close();adminTab('seasons');toast('Season deleted');
 };
}
$('#delete-season').onclick=deleteSeasonPrompt;

$('#new-season').onclick=()=>{
 modal(`<h2>Create a new season.</h2><p>Start with a draft. Add merchandise and designs, preview the shop, then publish when it’s ready.</p><form id="new-season-form"><label>Season name<input name="seasonName" required maxlength="80" placeholder="e.g. The 2027 season collection"></label><div class="form-row"><label>Opens on<input name="start" type="date" required></label><label>Closes on<input name="end" type="date" required></label></div><label>Starting merchandise<select name="source"><option value="empty">Start with an empty catalog</option>${seasons.map(s=>`<option value="${s.id}">Copy from ${esc(s.name)}</option>`).join('')}</select></label><label class="reuse-artwork-option"><input type="checkbox" name="reuseArtwork"> Also copy the previous season’s designs and placements</label><p class="field-help">By default, each season starts with one new design. Copying merchandise includes styles, colors, prices, sizes, and blank shirt images. Previous orders stay with their original season.</p><button class="primary wide">Create draft season →</button></form>`,'NEW SEASON');
 $('#new-season-form').onsubmit=e=>{
  e.preventDefault();const f=e.target.elements,name=f.namedItem('seasonName').value.trim(),start=f.namedItem('start').value,end=f.namedItem('end').value;
  if(end<start)return toast('Closing date must be after the opening date.');
  const source=seasons.find(s=>s.id===f.namedItem('source').value);
  saveSeasons();const s={id:'season-'+crypto.randomUUID(),name,start,end,state:'draft',announcement:'Your next season starts here.',catalog:source?structuredClone(source.catalog):[],designs:source&&f.namedItem('reuseArtwork').checked?structuredClone(source.designs):[{id:'season',name:'Season artwork set',image:null,artwork:{}}],photo:null};
  if(!source||!f.namedItem('reuseArtwork').checked)s.catalog.forEach(p=>{p.designs=['season'];delete p.placements;});
  seasons.push(s);selectSeason(s.id);saveSeasons();$('#modal').close();adminTab('merchandise');toast('Draft created. Review merchandise, then preview and publish.');
 };
};
$('#season-cards').onclick=e=>{
 if(e.target.dataset.manageSeason){selectSeason(e.target.dataset.manageSeason);adminTab('seasons');openSeasonManager();}
 if(e.target.dataset.previewSeason){selectSeason(e.target.dataset.previewSeason);showShop(true);}
 if(e.target.dataset.publishSeason){
  const s=seasons.find(s=>s.id===e.target.dataset.publishSeason);
  if(!s.catalog.length)return toast('Add at least one merchandise item before publishing.');
  if(seasons.some(other=>other.id!==s.id&&other.state==='published'&&s.start<=other.end&&s.end>=other.start))return toast('Ordering dates overlap another published season.');
  s.state='published';saveSeasons();renderSeasonUI();toast(s.start>today()?'Season published. Ordering opens on '+dateLabel(s.start)+'.':'Season published.');
 }
};
$('#add-product').onclick=()=>{
 const templates=[...catalog,...baseCatalog.filter(base=>!catalog.some(p=>p.id===base.id))];
 modal(`<h2>Add a shirt style.</h2><p>Define a style for this season. Upload its front and back images after adding it.</p><form id="product-form"><label>Start from<select name="template"><option value="">New custom style</option>${templates.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label><label>Style name<input name="productName" maxlength="60" required placeholder="e.g. Bella + Canvas V-neck"></label><label>Description<input name="description" maxlength="160" placeholder="e.g. V-neck · lightweight cotton · relaxed fit"></label><div class="form-row"><label>Price ($)<input name="price" type="number" min="0" step="0.01" value="25" required></label><label>Sample shirt shape<select name="cut"><option value="classic">Regular short sleeve</option><option value="fitted">Fitted short sleeve</option><option value="long">Long sleeve</option></select></label></div><p class="field-help">The sample shape is a placeholder until you upload this style’s shirt images.</p><fieldset class="style-colors"><legend>Available colors</legend><div id="style-color-rows"></div><button type="button" class="text-button" id="add-style-color">+ Add color</button></fieldset><label>Available sizes<input name="sizes" value="XS, S, M, L, XL, 2XL, 3XL" maxlength="160" required></label><p class="field-help">Separate sizes with commas. Use any labels, such as Youth S or 4XL. All season designs are included; you can adjust them on the Merchandise tab.</p><p id="style-error" role="alert"></p><button class="primary wide">Add shirt style</button></form>`,'SEASON MERCHANDISE');
 const form=$('#product-form'),rows=$('#style-color-rows');
 function addColor(name='Band blue',hex='#214b9c'){
  const row=document.createElement('div');row.className='style-color-row';
  row.innerHTML=`<label>Color name<input class="style-color-name" value="${esc(name)}" maxlength="40" required placeholder="e.g. Navy"></label><label>Swatch<input class="style-color-swatch" type="color" value="${esc(hex)}"></label><button type="button" class="text-button" aria-label="Remove color">Remove</button>`;
  row.querySelector('button').onclick=()=>{if(rows.children.length>1)row.remove();else toast('Keep at least one color.');};rows.append(row);
 }
 addColor();$('#add-style-color').onclick=()=>addColor('','#24272d');
 form.elements.template.onchange=()=>{
  const base=templates.find(p=>p.id===form.elements.template.value);
  form.elements.productName.value=base?.name||'';form.elements.description.value=base?.description||'';
  form.elements.price.value=base?.price??25;form.elements.cut.value=base?.cut||'classic';
  form.elements.sizes.value=shirtSizes(base||{}).join(', ');rows.innerHTML='';
  (base?.colors||[['Band blue','#214b9c']]).forEach(c=>addColor(...c));
 };
 form.onsubmit=e=>{
  e.preventDefault();const f=form.elements,name=f.productName.value.trim(),sizes=[...new Set(f.sizes.value.split(',').map(s=>s.trim()).filter(Boolean))],colors=Array.from(rows.children).map(row=>[row.querySelector('.style-color-name').value.trim(),row.querySelector('.style-color-swatch').value]);
  if(!name||!sizes.length||colors.some(c=>!c[0])){$('#style-error').textContent='Enter a style name, at least one size, and a name for each color.';return;}
  if(new Set(colors.map(c=>c[0].toLowerCase())).size!==colors.length){$('#style-error').textContent='Give each color a different name.';return;}
  const p={id:'item-'+crypto.randomUUID(),name,description:f.description.value.trim(),tag:'SEASON COLLECTION',price:Number(f.price.value),cut:f.cut.value,colors,sizes,designs:designs.map(d=>d.id)};
  catalog.push(p);selections[p.id]=0;selectedDesigns[p.id]=p.designs[0];saveSeasons();renderMerch();renderProducts();renderSeasonUI();openStyleManager(p.id);toast('Shirt style added. Upload its front and back images here.');
 };
};
function csv(rows,filename){const value=v=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(value).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('CSV exported')}
const exportStatus=o=>o.status==='Cancelled'?'Cancelled':o.fulfillment;
function exportFilename(report){
 const season=currentSeason(),slug=season.name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'season';
 return `sfbb-${slug}-${season.start}-${report}.csv`;
}
function billingRows(){return [['Order code','Full name','Quantity','Amount owed','Note'],...orders.filter(o=>o.seasonId===currentSeasonId&&o.status==='Active').sort((a,b)=>a.name.localeCompare(b.name)||a.code.localeCompare(b.code)).map(o=>[o.code,o.name,o.items.reduce((n,i)=>n+i.qty,0),(o.status==='Cancelled'||o.fulfillment==='Complete'?0:total(o.items)).toFixed(2),o.note])];}
function manufacturerRows(){
 const grouped=new Map();
 orders.filter(o=>o.seasonId===currentSeasonId&&o.status==='Active').forEach(o=>o.items.forEach(i=>{
  const p=catalog.find(p=>p.id===i.id),key=JSON.stringify([i.id,i.design||'season',itemColorName(i,p),i.colorHex||p.colors[i.color][1],i.size]);
  if(!grouped.has(key))grouped.set(key,[p.name,designName(i),itemColorName(i,p),i.size,0]);
  grouped.get(key)[4]+=i.qty;
 }));
 return [['Item','Artwork set','Color','Size','Quantity'],...Array.from(grouped.values()).sort((a,b)=>a.slice(0,4).join(' ').localeCompare(b.slice(0,4).join(' ')))];
}
function deliveryRows(){
 const rows=[];
 orders.filter(o=>o.seasonId===currentSeasonId&&o.status==='Active').sort((a,b)=>a.name.localeCompare(b.name)||a.code.localeCompare(b.code)).forEach(o=>{
  const variants=new Map();
  o.items.forEach(i=>{const p=catalog.find(p=>p.id===i.id),key=JSON.stringify([i.id,i.design||'season',itemColorName(i,p),i.colorHex||p.colors[i.color][1],i.size]);
   if(!variants.has(key))variants.set(key,[o.name,o.code,p.name,designName(i),itemColorName(i,p),i.size,0,o.note]);
   variants.get(key)[6]+=i.qty;
  });rows.push(...variants.values());
 });
 return [['Full name','Order code','Item','Artwork set','Color','Size','Quantity','Note'],...rows];
}
$('#export-all').onclick=()=>csv(billingRows(),exportFilename('billing'));
$('#export-fulfillment').onclick=()=>csv(manufacturerRows(),exportFilename('manufacturer-order'));
$('#export-delivery').onclick=()=>csv(deliveryRows(),exportFilename('member-delivery'));

let toastTimer;function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3200)}


$('#bag-items').addEventListener('change',e=>{
 if(e.target.dataset.bagQuantity===undefined)return;
 const item=cart[Number(e.target.dataset.bagQuantity)];
 const qty=Number(e.target.value);
 if(!e.target.reportValidity()||!Number.isSafeInteger(qty)||qty<1){e.target.value=item.qty;return;}
 item.qty=qty;renderBag();
});
