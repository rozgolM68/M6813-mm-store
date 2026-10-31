const $=s=>document.querySelector(s);
let allProducts=[], allReels=[], activeCat="همه", siteSettings={};
async function request(url,options={}){const r=await fetch(url,{...options,credentials:"same-origin"});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"خطایی رخ داد");return d}
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function render(){
 const list=allProducts.filter(p=>activeCat==="همه"||p.category===activeCat);
 $("#count").textContent=`${list.length} محصول`;
 $("#productsGrid").innerHTML=list.length?list.map(p=>`<article class="card">${p.image?`<img src="${esc(p.image)}" alt="${esc(p.name)}">`:`<div class="no-photo">🌷</div>`}<div class="card-body"><h3>${esc(p.name)}</h3><p>${esc(p.description||p.category||"")}</p><div class="price">${esc(p.price||"تماس بگیرید")}</div></div></article>`).join(""):`<p class="empty">هنوز محصولی اضافه نشده است. 🌸</p>`;
}
function applySettings(s){siteSettings=s;const put=(id,value)=>{const el=$(id);if(el)el.textContent=value||""};
 put("#brand","🌷 "+(s.brand||"M6813.mm"));put("#heroEyebrow",s.eyebrow);put("#heroHeadline",s.headline);put("#heroSubtitle",s.subtitle);put("#heroButton",s.buttonText);put("#productsTitle",s.productsTitle);put("#reelsTitle",s.reelsTitle);put("#reelsEyebrow",s.reelsEyebrow);put("#aboutTitle",s.aboutTitle);put("#aboutText",s.aboutText);put("#footerText",s.footer);
 const a=$("#announcement");a.textContent=s.announcement||"";a.hidden=!s.announcement;
 const c=$("#contactInfo");c.innerHTML=[s.phone?`<p>تلفن: ${esc(s.phone)}</p>`:"",s.instagram?`<p><a target="_blank" rel="noopener" href="${esc(s.instagram)}">صفحه شبکه اجتماعی</a></p>`:""].join("");
}
async function load(){allProducts=await request("/api/products");allReels=await request("/api/reels");siteSettings=await request("/api/site-settings");applySettings(siteSettings);render();renderReels();if(!$("#dashboard").hidden){renderManage();renderManageReels()}}
function renderReels(){
 $("#reelsGrid").innerHTML=allReels.length?allReels.map(r=>`<article class="reel-card"><video src="${esc(r.video)}" controls playsinline preload="metadata"></video><div class="reel-info"><h3>${esc(r.title)}</h3><p>${esc(r.description||"")}</p></div></article>`).join(""):`<p class="empty">هنوز ریلزی منتشر نشده است. 🌷</p>`;
}
document.querySelectorAll(".filter").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");activeCat=b.dataset.cat;render()}));
async function check(){const d=await request("/api/me");$("#loginBox").hidden=d.isAdmin;$("#dashboard").hidden=!d.isAdmin;if(d.isAdmin){renderManage();fillSettings()}}
function fillSettings(){const f=$("#settingsForm");if(!f)return;for(const [k,v] of Object.entries(siteSettings)){if(f.elements[k])f.elements[k].value=v??""}}
$("#settingsForm").addEventListener("submit",async e=>{e.preventDefault();const msg=$("#settingsMsg");msg.textContent="در حال ذخیره…";try{const data=Object.fromEntries(new FormData(e.target));const result=await request("/api/site-settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});applySettings(result.settings);siteSettings=result.settings;msg.textContent="متن‌های سایت با موفقیت ذخیره شدند 🌷"}catch(err){msg.textContent=err.message}});
$("#loginForm").addEventListener("submit",async e=>{e.preventDefault();$("#loginMsg").textContent="";try{await request("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});e.target.reset();await check();await load()}catch(err){$("#loginMsg").textContent=err.message}});
$("#logout").addEventListener("click",async()=>{await request("/api/logout",{method:"POST"});await check()});
$("#productForm").addEventListener("submit",async e=>{e.preventDefault();$("#productMsg").textContent="";try{await request("/api/products",{method:"POST",body:new FormData(e.target)});e.target.reset();$("#productMsg").textContent="محصول با موفقیت اضافه شد 🌷";await load()}catch(err){$("#productMsg").textContent=err.message}});
$("#reelForm").addEventListener("submit",async e=>{e.preventDefault();$("#reelMsg").textContent="در حال آپلود…";try{await request("/api/reels",{method:"POST",body:new FormData(e.target)});e.target.reset();$("#reelMsg").textContent="ریلز با موفقیت منتشر شد 🎬";await load()}catch(err){$("#reelMsg").textContent=err.message}});
function renderManageReels(){$("#manageReels").innerHTML=allReels.map(r=>`<div class="manage-row"><video src="${esc(r.video)}"></video><div class="grow"><b>${esc(r.title)}</b><div class="muted">ریلز</div></div><button class="delete" data-reel-id="${esc(r.id||r._id)}">حذف ریلز</button></div>`).join("");document.querySelectorAll("[data-reel-id]").forEach(b=>b.addEventListener("click",async()=>{if(confirm("این ریلز حذف شود؟")){try{await request("/api/reels/"+encodeURIComponent(b.dataset.reelId),{method:"DELETE"});await load()}catch(e){alert(e.message)}}}))}
function renderManage(){$("#manageList").innerHTML=allProducts.map(p=>`<div class="manage-row">${p.image?`<img src="${esc(p.image)}">`:`<span>🌷</span>`}<div class="grow"><b>${esc(p.name)}</b><div class="muted">${esc(p.price||"")}</div></div><button class="delete" data-id="${esc(p.id||p._id)}">حذف</button></div>`).join("");document.querySelectorAll("#manageList .delete").forEach(b=>b.addEventListener("click",async()=>{if(confirm("این محصول حذف شود؟")){try{await request("/api/products/"+encodeURIComponent(b.dataset.id),{method:"DELETE"});await load()}catch(e){alert(e.message)}}}))}
(async()=>{try{await load();await check()}catch(e){$("#productsGrid").innerHTML=`<p class="empty">${esc(e.message)}</p>`}})();
