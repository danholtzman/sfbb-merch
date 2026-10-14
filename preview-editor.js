const productViews={};
const adminPreviewChoices={};
function merchPreview(p){
 const choice=adminPreviewChoices[p.id]||{color:0,design:p.designs[0]};
 if(!p.designs.includes(choice.design))choice.design=p.designs[0];
 if(!p.colors[choice.color])choice.color=0;
 adminPreviewChoices[p.id]=choice;
 return `<div class="merch-preview" data-merch-preview="${p.id}"><div class="merch-preview-controls"><label>Preview color<select data-merch-color="${p.id}" aria-label="${esc(p.name)} admin preview color">${p.colors.map((c,i)=>`<option value="${i}" ${choice.color===i?'selected':''}>${esc(c[0])}</option>`).join('')}</select></label>${p.designs.length>1?`<label>Preview artwork set<select data-merch-design="${p.id}" aria-label="${esc(p.name)} admin preview design">${designs.filter(d=>p.designs.includes(d.id)).map(d=>`<option value="${d.id}" ${choice.design===d.id?'selected':''}>${esc(d.name)}</option>`).join('')}</select></label>`:''}</div><div class="merch-preview-images">${['front','back'].map(view=>`<div class="merch-preview-side"><button class="merch-preview-image-button" data-preview-editor="${p.id}" data-preview-side="${view}" aria-label="Edit ${esc(p.name)} ${view} image">${shirt(p,choice.color,choice.design,view)}</button><div class="merch-preview-caption"><span>${view==='front'?'Front':'Back'}</span><button class="text-button" data-preview-editor="${p.id}" data-preview-side="${view}" aria-label="Edit ${esc(p.name)} ${view} preview">Edit ↗</button></div></div>`).join('')}</div></div>`;
}
function refreshMerchPreviews(){document.querySelectorAll('[data-merch-preview]').forEach(el=>{const p=catalog.find(p=>p.id===el.dataset.merchPreview);if(p)el.outerHTML=merchPreview(p)});}
$('#merch-list').addEventListener('change',e=>{
 const id=e.target.dataset.merchColor||e.target.dataset.merchDesign;if(!id)return;
 const choice=adminPreviewChoices[id];
 if(e.target.dataset.merchColor)choice.color=Number(e.target.value);else choice.design=e.target.value;
 refreshMerchPreviews();
});
const defaultPlacement=()=>({x:50,y:47.7,width:25,rotation:0});
const placementKey=(design,view,color)=>`${design}:${view}:${color}`;
const blankKey=(view,color)=>`${view}:${color}`;
function placementFor(p,design,view,color){return p.placements?.[placementKey(design,view,color)]||p.placements?.[placementKey(design,view,'all')]||defaultPlacement();}
function printMarkup(p,color,design,custom=null,view='front'){
 const d=custom||designs.find(d=>d.id===design);
 const artwork=artworkImage(d,view);
 if(artwork)return `<image href="${artwork}" x="120" y="80" width="80" height="136" preserveAspectRatio="xMidYMid meet"/>`;
 if(view==='back')return '';
 const svg=rawShirt(p,color,design),start=svg.indexOf('<g ');return svg.slice(start,svg.lastIndexOf('</svg>'));
}
function blankMarkup(p,color,view){
 const blank=p.blanks?.[blankKey(view,color)]||p.blanks?.[blankKey(view,'all')];
 if(blank)return `<image href="${blank}" x="0" y="0" width="320" height="310" preserveAspectRatio="xMidYMid meet"/>`;
 const raw=rawShirt(p,color,'season'),start=raw.indexOf('<image href=')>=0?raw.indexOf('<image href='):raw.indexOf('<g ');
 return raw.slice(raw.indexOf('<defs>'),start);
}
function shirt(p,color,design='season',view='front'){
 if(photo&&p.id==='classic'&&design==='season'&&view==='front'&&!p.placements&&!p.blanks)return `<img class="preview-photo" src="${photo}" alt="Uploaded classic tee preview">`;
 const t=placementFor(p,design,view,color),scale=t.width*320/100/80;
 const hasBack=view==='front'||artworkImage(designs.find(d=>d.id===design),'back')||p.placements?.[placementKey(design,view,color)]||p.placements?.[placementKey(design,view,'all')];
 return `<svg class="shirt-svg" viewBox="0 0 320 310" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(p.name)} in ${esc(p.colors[color][0])}, ${esc(designName({design}))}, ${view} view">${blankMarkup(p,color,view)}${hasBack?`<g transform="translate(${t.x*3.2} ${t.y*3.1}) rotate(${t.rotation}) scale(${scale}) translate(-160 -148)">${printMarkup(p,color,design,null,view)}</g>`:''}</svg>`;
}
$('#products').addEventListener('click',e=>{
 if(!e.target.dataset.shirtView)return;
 const article=e.target.closest('[data-product]'),id=article.dataset.product,p=catalog.find(p=>p.id===id);
 productViews[id]=e.target.dataset.shirtView;
 const image=article.querySelector('.product-image');
 image.querySelector('.shirt-svg,.preview-photo').outerHTML=shirt(p,selections[id],selectedDesigns[id],productViews[id]);
 image.querySelectorAll('[data-shirt-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.shirtView===productViews[id])));
});
$('#merch-list').addEventListener('click',e=>{const button=e.target.closest('[data-preview-editor]');if(button)openPreviewEditor(button.dataset.previewEditor,button.dataset.previewSide)});
$('#modal').addEventListener('close',()=>$('#modal').classList.remove('placement-editor'));
function openPreviewEditor(id,initialView='front'){
 const p=catalog.find(p=>p.id===id);
 let design=adminPreviewChoices[id]?.design||p.designs[0],color=adminPreviewChoices[id]?.color||0,view=initialView,scope=p.placements?.[placementKey(design,view,color)]?'color':'all',position=structuredClone(placementFor(p,design,view,color));
 modal(`<h2>Make it a perfect fit.</h2><p>Position your design on the blank shirt. Drag the artwork or use the controls, then save the preview.</p><div class="editor-layout"><div><div class="editor-canvas" id="editor-canvas"><div id="editor-blank"></div><div class="editor-center-guide"></div><div class="editor-art" id="editor-art" tabindex="0" aria-label="Drag artwork; use arrow keys to move"><svg id="editor-art-svg" viewBox="120 80 80 136" xmlns="http://www.w3.org/2000/svg"></svg>${['nw','ne','sw','se'].map(c=>`<button class="resize-handle ${c}" data-resize="${c}" aria-label="Resize artwork from ${c} corner"></button>`).join('')}</div></div><p class="editor-hint">Drag to move · pull a corner to resize · arrow keys to nudge</p></div><form id="placement-form"><div class="editor-selector-row"><label>View<select id="editor-view" aria-label="Preview view"><option value="front">Front</option><option value="back">Back</option></select></label><label>Color<select id="editor-color" aria-label="Preview color">${p.colors.map((c,i)=>`<option value="${i}">${esc(c[0])}</option>`).join('')}</select></label></div><label ${p.designs.length===1?'hidden':''}>Artwork set<select id="editor-design" aria-label="Preview artwork set">${designs.filter(d=>p.designs.includes(d.id)).map(d=>`<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select></label><label>Apply placement to<select id="editor-scope" aria-label="Placement scope"><option value="all">All colors of this shirt style</option><option value="color">Only this color</option></select></label><div class="placement-fields">${[['x','Horizontal (%)',0,100],['y','Vertical (%)',0,100],['width','Width (%)',5,90],['rotation','Rotation (°)',-180,180]].map(([key,name,min,max])=>`<label>${name}<input id="placement-${key}" name="${key}" type="number" min="${min}" max="${max}" step="0.1" required></label>`).join('')}</div><div class="editor-utilities"><button type="button" class="secondary" id="center-art">Center horizontally</button><button type="button" class="text-button" id="reset-art">Reset placement</button></div><p class="field-help">Upload artwork in Manage artwork, and unprinted shirt photos in Manage style. This editor saves placement for this set and side.</p><button class="primary wide" type="submit">Save placement</button></form></div>`,'SHIRT PREVIEW / '+p.name.toUpperCase());
 $('#modal').classList.add('placement-editor');
 $('#editor-view').value=view;$('#editor-design').value=design;$('#editor-color').value=String(color);$('#editor-scope').value=scope;
 const canvas=$('#editor-canvas'),art=$('#editor-art');
 function paint(){
  const blank=p.blanks?.[blankKey(view,color)]||p.blanks?.[blankKey(view,'all')];
  $('#editor-blank').innerHTML=`<svg viewBox="0 0 320 310" xmlns="http://www.w3.org/2000/svg">${blank?`<image href="${blank}" x="0" y="0" width="320" height="310" preserveAspectRatio="xMidYMid meet"/>`:blankMarkup(p,color,view)}</svg>`;
  $('#editor-art-svg').innerHTML=printMarkup(p,color,design,null,view);
  art.style.left=position.x+'%';art.style.top=position.y+'%';art.style.width=position.width+'%';art.style.transform=`translate(-50%,-50%) rotate(${position.rotation}deg)`;
  for(const key of ['x','y','width','rotation'])$('#placement-'+key).value=Math.round(position[key]*10)/10;
 }
 function changeContext(){
  design=$('#editor-design').value;color=Number($('#editor-color').value);view=$('#editor-view').value;scope=$('#editor-scope').value;
  position=structuredClone(p.placements?.[placementKey(design,view,scope==='all'?'all':color)]||p.placements?.[placementKey(design,view,'all')]||defaultPlacement());
  paint();
 }
 ['view','color','design','scope'].forEach(key=>$('#editor-'+key).onchange=changeContext);
 $('#placement-form').addEventListener('input',e=>{
  if(!['x','y','width','rotation'].includes(e.target.name)||!e.target.validity.valid||e.target.value==='')return;
  position[e.target.name]=Number(e.target.value);paint();
 });
 $('#center-art').onclick=()=>{position.x=50;paint()};$('#reset-art').onclick=()=>{position=defaultPlacement();paint()};
 let drag=null;
 art.onpointerdown=e=>{
  if(e.button!==0)return;e.preventDefault();
  const rect=canvas.getBoundingClientRect(),center={x:rect.left+position.x/100*rect.width,y:rect.top+position.y/100*rect.height};
  drag={startX:e.clientX,startY:e.clientY,position:{...position},rect,center,resize:!!e.target.dataset.resize,radius:Math.hypot(e.clientX-center.x,e.clientY-center.y)};
  art.setPointerCapture(e.pointerId);
 };
 art.onpointermove=e=>{
  if(!drag)return;
  if(drag.resize){const distance=Math.hypot(e.clientX-drag.center.x,e.clientY-drag.center.y);position.width=Math.min(90,Math.max(5,drag.position.width*distance/Math.max(drag.radius,1)));}
  else{position.x=Math.min(100,Math.max(0,drag.position.x+(e.clientX-drag.startX)/drag.rect.width*100));position.y=Math.min(100,Math.max(0,drag.position.y+(e.clientY-drag.startY)/drag.rect.height*100));}
  paint();
 };
 art.onpointerup=art.onpointercancel=()=>{drag=null};
 art.onkeydown=e=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const step=e.shiftKey?1:.2;
  if(e.key==='ArrowLeft')position.x=Math.max(0,position.x-step);if(e.key==='ArrowRight')position.x=Math.min(100,position.x+step);
  if(e.key==='ArrowUp')position.y=Math.max(0,position.y-step);if(e.key==='ArrowDown')position.y=Math.min(100,position.y+step);paint();
 };
 $('#placement-form').onsubmit=e=>{
  e.preventDefault();for(const key of ['x','y','width','rotation'])position[key]=Number($('#placement-'+key).value);
  p.placements ||= {};p.placements[placementKey(design,view,scope==='all'?'all':color)]={...position};
  adminPreviewChoices[id]={color,design};saveSeasons();renderProducts();renderBag();renderBlankThumbnails();$('#modal').close();toast('Placement saved for '+p.name+' · '+view+(scope==='all'?' · all colors':' · '+p.colors[color][0]));
 };
 paint();
}
function renderBlankUploads(){
 const prior=$('#blank-product').value;
 $('#blank-product').innerHTML=catalog.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
 if(catalog.some(p=>p.id===prior))$('#blank-product').value=prior;
 renderBlankColors();
}
function renderBlankColors(){
 const p=catalog.find(p=>p.id===$('#blank-product').value),prior=$('#blank-color').value;
 $('#blank-color').innerHTML=(p?.colors||[]).map((c,i)=>`<option value="${i}">${esc(c[0])}</option>`).join('');
 if(p?.colors[Number(prior)])$('#blank-color').value=prior||'0';
 $('#blank-front-upload').value='';$('#blank-back-upload').value='';renderBlankThumbnails();
}
function renderBlankThumbnails(){
 const p=catalog.find(p=>p.id===$('#blank-product').value),color=Number($('#blank-color').value);
 for(const view of ['front','back'])$('#blank-'+view+'-upload').disabled=!p;
 $('#blank-thumbnails').innerHTML=p?['front','back'].map(view=>{const image=p.blanks?.[blankKey(view,color)]||p.blanks?.[blankKey(view,'all')];return `<div><b>${view==='front'?'Front':'Back'}</b>${image?`<img src="${image}" alt="${esc(p.name)} ${esc(p.colors[color][0])} blank ${view}"><span>Image uploaded</span>`:'<span class="blank-upload-empty">No image uploaded · using the sample blank</span>'}</div>`;}).join(''):'<p>Add merchandise to this season before uploading shirt images.</p>';
}
$('#blank-product').onchange=renderBlankColors;
$('#blank-color').onchange=()=>{$('#blank-front-upload').value='';$('#blank-back-upload').value='';renderBlankThumbnails()};
for(const view of ['front','back'])$('#blank-'+view+'-upload').onchange=e=>{
 const file=e.target.files[0],p=catalog.find(p=>p.id===$('#blank-product').value),color=Number($('#blank-color').value);if(!file||!p)return;
 if(!['image/png','image/jpeg'].includes(file.type))return toast('Choose a PNG or JPG shirt image.');
 if(file.size>8*1024*1024)return toast('Please choose an image under 8 MB.');
 const season=currentSeason();const reader=new FileReader();reader.onload=()=>{p.blanks ||= {};p.blanks[blankKey(view,color)]=reader.result;if(currentSeason()===season){saveSeasons();renderBlankThumbnails();renderProducts();renderBag();$('#upload-status').textContent=`${p.name} · ${p.colors[color][0]} · ${view} image uploaded.`;}toast('Shirt '+view+' uploaded');};reader.readAsDataURL(file);
};
selectSeason((seasons.find(isOpen)||seasons[0]).id);saveSeasons();save();
