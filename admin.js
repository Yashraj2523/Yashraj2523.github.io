// admin.js — Portfolio admin dashboard
let supa=null,liveData=null;
function supabaseReady(){return typeof SUPABASE_URL==='string'&&SUPABASE_URL.length>5&&typeof SUPABASE_ANON_KEY==='string'&&SUPABASE_ANON_KEY.length>5&&window.supabase;}
function mergeDefaults(c){const m=Object.assign({},SITE_DATA,c);m.settings=Object.assign({},SITE_DATA.settings||{},c.settings||{});m.sectionVisibility=Object.assign({},c.sectionVisibility||{});m.sectionMeta=Object.assign({},c.sectionMeta||{});m.customSections=c.customSections||[];m.connectLinks=c.connectLinks||[];return m;}

/* ── THEME ── */
function initTheme(){const s=localStorage.getItem('site_theme')||'dark';applyTheme(s);document.getElementById('themeToggle').addEventListener('click',()=>{const n=document.documentElement.getAttribute('data-theme')==='light'?'dark':'light';applyTheme(n);localStorage.setItem('site_theme',n);});}
function applyTheme(t){document.documentElement.setAttribute('data-theme',t);document.getElementById('themeIconMoon').style.display=t==='light'?'block':'none';document.getElementById('themeIconSun').style.display=t==='light'?'none':'block';}

/* ── MINI CONSTELLATION ── */
function initDots(){const canvas=document.getElementById('constellation');if(!canvas)return;const ctx=canvas.getContext('2d');function resize(){canvas.width=window.innerWidth;canvas.height=window.innerHeight;}resize();window.addEventListener('resize',resize);const col=getComputedStyle(document.documentElement).getPropertyValue('--node-color').trim()||'160,220,210';for(let i=0;i<50;i++){ctx.beginPath();ctx.arc(Math.random()*canvas.width,Math.random()*canvas.height,1.4,0,Math.PI*2);ctx.fillStyle=`rgba(${col},.28)`;ctx.fill();}}

/* ── HELPERS ── */
function byId(id){return document.getElementById(id);}
function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function htmlToLines(html){if(!html)return'';const d=document.createElement('div');d.innerHTML=html;return[...d.querySelectorAll('p')].map(p=>p.textContent.trim()).join('\n');}
function linesToHtml(t){return t.split('\n').map(l=>l.trim()).filter(Boolean).map(l=>`<p>${esc(l)}</p>`).join('\n');}
function showToast(msg){const t=byId('adminToastEl');if(!t)return;t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3000);}

/* ── AUTH ── */
async function initAuth(){
  const gate=byId('loginGate'),dash=byId('dashboard'),submit=byId('loginSubmitBtn'),status=byId('loginStatus');
  if(!supabaseReady()){status.textContent='Supabase not configured — fill in config.js';submit.disabled=true;return;}
  supa=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  submit.addEventListener('click',async()=>{
    status.textContent='Signing in…';
    const{error}=await supa.auth.signInWithPassword({email:byId('loginEmail').value.trim(),password:byId('loginPass').value});
    if(error){status.textContent=error.message;return;}
    showToast('✓ Signed in — you can now edit everything below');
    gate.classList.add('hidden');dash.classList.remove('hidden');
    await loadContent();populateForms();initRepeaters();initSections();
  });
  byId('loginPass').addEventListener('keydown',e=>{if(e.key==='Enter')submit.click();});
  byId('signOutBtn').addEventListener('click',async()=>{await supa.auth.signOut();location.reload();});
  const{data}=await supa.auth.getSession();
  if(data.session){gate.classList.add('hidden');dash.classList.remove('hidden');await loadContent();populateForms();initRepeaters();initSections();}
}

/* ── LOAD / SAVE ── */
async function loadContent(){
  const{data,error}=await supa.from('site_content').select('content').eq('id','main').single();
  if(!error&&data?.content)liveData=mergeDefaults(data.content);
  else{await supa.from('site_content').upsert({id:'main',content:SITE_DATA});liveData=mergeDefaults(SITE_DATA);}
}
async function saveContent(msg){
  const s=byId('saveStatus'),b=byId('bottomSaveStatus');if(s)s.textContent='Saving…';if(b)b.textContent='Saving…';
  const{error}=await supa.from('site_content').upsert({id:'main',content:liveData});
  const m=error?'Error: '+error.message:(msg||'Saved ✓ — live now');
  if(s)s.textContent=m;if(b)b.textContent=m;
  setTimeout(()=>{if(s)s.textContent='';if(b)b.textContent='';},4000);
}

/* ── TABS ── */
function initTabs(){
  document.querySelectorAll('.admin-tab').forEach(tab=>{
    tab.addEventListener('click',()=>{
      document.querySelectorAll('.admin-tab').forEach(t=>t.classList.remove('active'));
      document.querySelectorAll('.admin-panel-section').forEach(p=>p.classList.remove('active'));
      tab.classList.add('active');
      document.querySelector(`.admin-panel-section[data-panel="${tab.dataset.tab}"]`)?.classList.add('active');
    });
  });
}

/* ── POPULATE FIELDS ── */
function populateForms(){
  byId('f_hero_name').value=liveData.hero_name||'';
  byId('f_hero_sub').value=liveData.hero_sub||'';
  byId('f_roles').value=(liveData.roles||[]).join('\n');
  byId('f_about').value=htmlToLines(liveData.about_text_html);
  byId('f_email').value=liveData.email||'';byId('f_phone').value=liveData.phone||'';
  byId('f_github_username').value=liveData.github_username||'';
  byId('f_linkedin_url').value=liveData.linkedin_url||'';
  byId('f_linkedin_blurb').value=liveData.linkedin_blurb||'';
  byId('f_youtube_url').value=liveData.youtube_url||'';
  byId('f_youtube_subs').value=liveData.youtube_subs||'';
  const s=liveData.settings||{};
  // sliders with live value labels
  [['s_iconButtonSize','s_iconButtonSizeVal',s.iconButtonSize||36],
   ['s_avatarSize','s_avatarSizeVal',s.avatarSize||320],
   ['s_cardRadius','s_cardRadiusVal',s.cardRadius||18],
   ['s_glassBlur','s_glassBlurVal',s.glassBlur||18],
   ['s_sectionSpacing','s_sectionSpacingVal',s.sectionSpacing||130]
  ].forEach(([iId,lId,val])=>{const inp=byId(iId),lbl=byId(lId);if(!inp)return;inp.value=val;if(lbl)lbl.textContent=val;inp.addEventListener('input',()=>{if(lbl)lbl.textContent=inp.value;});});
  // bg style
  if(byId('s_bgStyle')){byId('s_bgStyle').value=s.bgStyle||'dots';byId('s_bgStyle').onchange=async()=>{liveData.settings.bgStyle=byId('s_bgStyle').value;await saveContent('Background style saved ✓');};}
  // wallpaper opacity
  if(byId('s_wallpaperOpacity'))byId('s_wallpaperOpacity').value=s.wallpaperOpacity!==undefined?s.wallpaperOpacity:35;
  // eggs toggle
  if(byId('s_eggsEnabled')){byId('s_eggsEnabled').checked=s.eggsEnabled!==false;byId('s_eggsEnabled').onchange=async()=>{liveData.settings.eggsEnabled=byId('s_eggsEnabled').checked;await saveContent('Easter eggs saved ✓');};}
  // cursor trail
  if(byId('s_cursorTrail')){byId('s_cursorTrail').checked=!!s.cursorTrailOn;byId('s_cursorTrail').onchange=async()=>{liveData.settings.cursorTrailOn=byId('s_cursorTrail').checked;await saveContent('Cursor trail saved ✓');};}
  // emailjs
  if(byId('s_emailjsService'))byId('s_emailjsService').value=s.emailjsService||'';
  if(byId('s_emailjsTemplate'))byId('s_emailjsTemplate').value=s.emailjsTemplate||'';
  if(byId('s_emailjsPublic'))byId('s_emailjsPublic').value=s.emailjsPublic||'';
  // resume / quiz video current state
  if(byId('resumeCurrentLink'))byId('resumeCurrentLink').textContent=liveData.resume_url?'Current: '+liveData.resume_url:'No résumé uploaded';
  if(byId('quizVideoCurrentLink'))byId('quizVideoCurrentLink').textContent=s.quizRewardVideoUrl?'Reward video uploaded ✓':'No reward video uploaded yet';
  renderThemeSwatches(s.themePalette||'default');
  renderCursorPicker(s.cursorStyleId||'default');
  renderWallpaperPresets();
  renderSingleImg('wallpaperPreview',liveData.background_image);
  renderSingleImg('ytLogoPreview',liveData.youtube_logo);
  renderUploadPreview('photoPreviewList',liveData.profile_photos||[]);
  initUploads();
}

function collectSimpleFields(){
  liveData.hero_name=byId('f_hero_name').value;
  liveData.hero_sub=byId('f_hero_sub').value;
  liveData.roles=byId('f_roles').value.split('\n').map(s=>s.trim()).filter(Boolean);
  liveData.about_text_html=linesToHtml(byId('f_about').value);
  liveData.email=byId('f_email').value;liveData.phone=byId('f_phone').value;
  liveData.github_username=byId('f_github_username').value;
  liveData.linkedin_url=byId('f_linkedin_url').value;liveData.linkedin_blurb=byId('f_linkedin_blurb').value;
  liveData.youtube_url=byId('f_youtube_url').value;liveData.youtube_subs=byId('f_youtube_subs').value;
  liveData.settings=Object.assign(liveData.settings||{},{
    iconButtonSize:+byId('s_iconButtonSize').value||36,avatarSize:+byId('s_avatarSize').value||320,
    cardRadius:+byId('s_cardRadius').value||18,glassBlur:+byId('s_glassBlur').value||18,
    sectionSpacing:+byId('s_sectionSpacing').value||130,
    bgStyle:byId('s_bgStyle')?.value||'dots',wallpaperOpacity:+byId('s_wallpaperOpacity')?.value||35,
    eggsEnabled:byId('s_eggsEnabled')?.checked!==false,cursorTrailOn:!!byId('s_cursorTrail')?.checked,
    emailjsService:byId('s_emailjsService')?.value||'',emailjsTemplate:byId('s_emailjsTemplate')?.value||'',emailjsPublic:byId('s_emailjsPublic')?.value||'',
  });
}

/* ── THEME SWATCHES ── */
const PALETTES={default:['#6ee7d8','#a78bfa'],sunset:['#ff9966','#ff5e8a'],ocean:['#38bdf8','#6366f1'],forest:['#34d399','#0d9488'],amber:['#fbbf24','#d97706'],rose:['#f7b9c4','#c2410c'],lavender:['#c4b5fd','#8b5cf6'],mint:['#6ee7b7','#10b981'],coral:['#fb923c','#f43f5e'],slate:['#94a3b8','#475569'],cherry:['#fda4af','#e11d48'],cyberpunk:['#f0abfc','#22d3ee'],autumn:['#f59e0b','#b91c1c'],arctic:['#a5f3fc','#0891b2'],berry:['#f472b6','#7e22ce'],citrus:['#fde047','#ea580c'],steel:['#7dd3fc','#1e3a8a'],terracotta:['#fdba74','#9a3412'],monochrome:['#e5e7eb','#6b7280'],emerald:['#34d399','#059669']};
function renderThemeSwatches(active){
  const row=byId('themePaletteRow');if(!row)return;
  row.innerHTML=Object.keys(PALETTES).map(k=>`<button type="button" class="theme-swatch-btn${k===active?' active':''}" data-key="${k}" title="${k}" style="background:linear-gradient(135deg,${PALETTES[k][0]},${PALETTES[k][1]})"></button>`).join('');
  row.querySelectorAll('.theme-swatch-btn').forEach(btn=>{btn.addEventListener('click',async()=>{liveData.settings=liveData.settings||{};liveData.settings.themePalette=btn.dataset.key;row.querySelectorAll('.theme-swatch-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');await saveContent('Theme saved ✓');});});
}

/* ── CURSOR PICKER ── */
const CURSOR_LABELS=['Default','Dot','Cross','Ring','Star','Rocket','Bug'];
const CURSOR_IDS=['default','dot','cross','ring','star','rocket','bug'];
function renderCursorPicker(active){
  const row=byId('cursorStylePicker');if(!row)return;
  row.innerHTML=CURSOR_IDS.map((id,i)=>`<button type="button" class="cursor-style-chip${id===active?' active':''}" data-id="${id}">${CURSOR_LABELS[i]}</button>`).join('');
  row.querySelectorAll('.cursor-style-chip').forEach(btn=>{btn.addEventListener('click',async()=>{liveData.settings=liveData.settings||{};liveData.settings.cursorStyleId=btn.dataset.id;row.querySelectorAll('.cursor-style-chip').forEach(b=>b.classList.remove('active'));btn.classList.add('active');await saveContent('Cursor saved ✓');});});
}

/* ── WALLPAPER PRESETS ── */
const WP_PRESETS=[{id:'none',label:'None',url:''},{id:'galaxy',label:'Galaxy',url:'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=300&q=40'},{id:'nebula',label:'Nebula',url:'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=300&q=40'},{id:'aurora',label:'Aurora',url:'https://images.unsplash.com/photo-1483347756197-71ef80e95f73?w=300&q=40'},{id:'mountains',label:'Mountains',url:'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&q=40'},{id:'forest',label:'Forest',url:'https://images.unsplash.com/photo-1448375240586-882707db888b?w=300&q=40'},{id:'ocean',label:'Ocean',url:'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=300&q=40'},{id:'city',label:'City',url:'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=300&q=40'},{id:'gradient',label:'Gradient',url:'https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?w=300&q=40'},{id:'circuit',label:'Circuit',url:'https://images.unsplash.com/photo-1518770660439-4636190af475?w=300&q=40'},{id:'code',label:'Code',url:'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=300&q=40'},{id:'marble',label:'Marble',url:'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=300&q=40'},{id:'rain',label:'Rain',url:'https://images.unsplash.com/photo-1428592953211-077101b2021b?w=300&q=40'},{id:'autumn',label:'Autumn',url:'https://images.unsplash.com/photo-1507783548227-544c3b8fc065?w=300&q=40'},{id:'desert',label:'Desert',url:'https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?w=300&q=40'},{id:'abstract',label:'Abstract',url:'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=300&q=40'},{id:'snow',label:'Snow',url:'https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=300&q=40'},{id:'sunset',label:'Sunset',url:'https://images.unsplash.com/photo-1500817487388-039e623edc21?w=300&q=40'},{id:'minimal',label:'Minimal',url:'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=300&q=40'}];
function fullUrl(t){return t?t.replace('w=300&q=40','w=1600&q=70'):'';}
function renderWallpaperPresets(){
  const row=byId('wallpaperPresetsRow');if(!row)return;
  row.innerHTML=WP_PRESETS.map(p=>`<button type="button" class="wallpaper-preset-btn" data-url="${p.url}" title="${p.label}">${p.url?`<img src="${p.url}" alt="${p.label}" loading="lazy"/>`:'<span class="preset-none">✕</span>'}</button>`).join('');
  row.querySelectorAll('.wallpaper-preset-btn').forEach(btn=>{btn.addEventListener('click',async()=>{const u=fullUrl(btn.dataset.url);liveData.background_image=u;renderSingleImg('wallpaperPreview',u);await saveContent(u?'Wallpaper applied ✓':'Wallpaper removed ✓');});});
}

/* ── UPLOAD HELPERS ── */
function renderUploadPreview(cId,urls){
  const c=byId(cId);if(!c)return;
  c.innerHTML=(urls||[]).map((url,i)=>`<div class="upload-preview-item" data-i="${i}"><img src="${esc(url)}"/><button data-action="remove">✕</button></div>`).join('');
  c.querySelectorAll('[data-action="remove"]').forEach(btn=>{btn.addEventListener('click',()=>{const i=+btn.closest('.upload-preview-item').dataset.i;liveData.profile_photos.splice(i,1);renderUploadPreview(cId,liveData.profile_photos);});});
}
function renderSingleImg(cId,url){const c=byId(cId);if(!c)return;c.innerHTML=url?`<div class="upload-preview-item"><img src="${esc(url)}"/></div>`:'';}
async function uploadFile(file,statusEl){
  if(!supa)return null;if(statusEl)statusEl.textContent='Uploading…';
  const ext=file.name.split('.').pop();const path=`uploads/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const{error}=await supa.storage.from('portfolio-media').upload(path,file,{cacheControl:'3600',upsert:false});
  if(error){if(statusEl)statusEl.textContent='Failed: '+error.message;return null;}
  const{data}=supa.storage.from('portfolio-media').getPublicUrl(path);
  if(statusEl){statusEl.textContent='Uploaded ✓';setTimeout(()=>statusEl.textContent='',2500);}
  return data.publicUrl;
}
let uploadsInited=false;
function initUploads(){
  if(uploadsInited)return;uploadsInited=true;
  byId('photoUploadInput')?.addEventListener('change',async e=>{const st=byId('photoUploadStatus');for(const f of e.target.files){const u=await uploadFile(f,st);if(u){(liveData.profile_photos=liveData.profile_photos||[]).push(u);}}renderUploadPreview('photoPreviewList',liveData.profile_photos);e.target.value='';});
  byId('ytLogoUploadInput')?.addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;const u=await uploadFile(f,byId('ytLogoUploadStatus'));if(u){liveData.youtube_logo=u;renderSingleImg('ytLogoPreview',u);}e.target.value='';});
  byId('wallpaperUploadInput')?.addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;const u=await uploadFile(f,byId('wallpaperUploadStatus'));if(u){liveData.background_image=u;renderSingleImg('wallpaperPreview',u);await saveContent('Wallpaper saved ✓');}e.target.value='';});
  byId('removeWallpaperBtn')?.addEventListener('click',async()=>{liveData.background_image='';renderSingleImg('wallpaperPreview','');await saveContent('Wallpaper removed ✓');});
  byId('s_wallpaperOpacity')?.addEventListener('change',async()=>{(liveData.settings=liveData.settings||{}).wallpaperOpacity=+byId('s_wallpaperOpacity').value;await saveContent('Dimness saved ✓');});
  byId('resumeUploadInput')?.addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;const u=await uploadFile(f,byId('resumeUploadStatus'));if(u){liveData.resume_url=u;if(byId('resumeCurrentLink'))byId('resumeCurrentLink').textContent='Current: '+u;await saveContent('Résumé updated ✓');}e.target.value='';});
  byId('quizVideoUploadInput')?.addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;const u=await uploadFile(f,byId('quizVideoUploadStatus'));if(u){(liveData.settings=liveData.settings||{}).quizRewardVideoUrl=u;if(byId('quizVideoCurrentLink'))byId('quizVideoCurrentLink').textContent='Reward video uploaded ✓';await saveContent('Quiz video saved ✓');}e.target.value='';});
}

/* ── DRAG-TO-REORDER ── */
function initDragReorder(wrap,list,rerender){
  let dragIdx=null;
  wrap.querySelectorAll('.admin-repeat-item').forEach(el=>{
    el.addEventListener('dragstart',()=>{dragIdx=+el.dataset.idx;el.classList.add('dragging');});
    el.addEventListener('dragend',()=>el.classList.remove('dragging'));
    el.addEventListener('dragover',e=>{e.preventDefault();el.classList.add('drag-over');});
    el.addEventListener('dragleave',()=>el.classList.remove('drag-over'));
    el.addEventListener('drop',e=>{e.preventDefault();el.classList.remove('drag-over');const di=+el.dataset.idx;if(dragIdx===null||dragIdx===di)return;const[m]=list.splice(dragIdx,1);list.splice(di,0,m);dragIdx=null;rerender();});
  });
}

/* ── REPEATER FACTORY ── */
function makeRepeater({wrapId,dataKey,fields,blank,addBtnId,labelFn}){
  const wrap=byId(wrapId);if(!wrap)return;
  function render(){
    const list=liveData[dataKey]||(liveData[dataKey]=[]);
    if(!list.length){wrap.innerHTML='<p style="color:var(--ink-2);font-size:.84rem;padding:6px 0">Nothing yet — add one below.</p>';byId(addBtnId).addEventListener('click',addItem,{once:true});return;}
    wrap.innerHTML=list.map((item,idx)=>`
      <div class="admin-repeat-item collapsed" data-idx="${idx}" draggable="true">
        <span class="drag-handle" title="Drag to reorder">⠿</span>
        <button class="admin-remove-btn" data-action="remove">✕</button>
        <div class="admin-repeat-header" data-action="toggle">
          <span style="font-size:.8rem;color:var(--accent-2);font-family:var(--font-mono)">${esc(labelFn?labelFn(item,idx):'Item '+(idx+1))}</span>
          <span class="admin-repeat-chevron">⌄</span>
        </div>
        <div class="admin-repeat-body">${fields.map(f=>fieldHtml(f,item,idx)).join('')}</div>
      </div>`).join('');
    wrap.querySelectorAll('.admin-repeat-item').forEach(el=>{
      const idx=+el.dataset.idx;
      el.querySelector('[data-action="toggle"]').addEventListener('click',()=>el.classList.toggle('collapsed'));
      el.querySelector('[data-action="remove"]').addEventListener('click',()=>{list.splice(idx,1);render();});
      fields.forEach(f=>{
        const inp=el.querySelector(`[data-field="${f.key}"]`);if(!inp)return;
        inp.addEventListener('input',()=>{if(f.type==='list')list[idx][f.key]=inp.value.split('\n').map(s=>s.trim()).filter(Boolean);else if(f.type==='metrics')list[idx][f.key]=parseMetrics(inp.value);else if(f.type==='number')list[idx][f.key]=+inp.value;else list[idx][f.key]=inp.value;});
        if(f.type==='fileupload'){const fi=el.querySelector(`[data-fileupload="${f.key}"]`);fi?.addEventListener('change',async()=>{const file=fi.files[0];if(!file)return;const st=el.querySelector(`[data-uploadstatus="${f.key}-${idx}"]`);const u=await uploadFile(file,st);if(u){list[idx][f.key]=u;render();}});}
      });
    });
    initDragReorder(wrap,list,render);
  }
  function fieldHtml(f,item,idx){
    const val=item[f.key];const display=f.type==='list'?(val||[]).join('\n'):f.type==='metrics'?metricsToText(val):(val!==undefined?val:'');
    if(f.type==='fileupload')return`<div class="admin-field"><label>${f.label}</label><div class="upload-row"><input type="text" data-field="${f.key}" value="${esc(display)}" placeholder="Paste URL or upload →" style="flex:1"/><input type="file" accept="${f.accept||'*'}" data-fileupload="${f.key}" data-idx="${idx}"/><span class="settings-hint" data-uploadstatus="${f.key}-${idx}"></span></div></div>`;
    if(f.type==='textarea'||f.type==='list'||f.type==='metrics')return`<div class="admin-field"><label>${f.label}</label><textarea data-field="${f.key}">${esc(display)}</textarea></div>`;
    return`<div class="admin-field"><label>${f.label}</label><input type="${f.type==='number'?'number':'text'}" data-field="${f.key}" value="${esc(display)}"/></div>`;
  }
  function addItem(){(liveData[dataKey]=liveData[dataKey]||[]).push(Object.assign({},blank));render();}
  byId(addBtnId)?.addEventListener('click',addItem);
  render();return render;
}
function parseMetrics(t){return t.split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{const[a,b]=l.split(':').map(s=>s.trim());return{label:a||'',value:b||''};});}
function metricsToText(m){return(m||[]).map(x=>`${x.label}: ${x.value}`).join('\n');}

/* ── ALL REPEATER DEFINITIONS ── */
function initRepeaters(){
  makeRepeater({wrapId:'skillsRepeatWrap',dataKey:'skills',addBtnId:'addSkillGroupBtn',blank:{category:'New category',items:[]},labelFn:i=>i.category||'Category',fields:[{key:'category',label:'Category name',type:'text'},{key:'items',label:'Skills (one per line)',type:'list'}]});
  makeRepeater({wrapId:'projectsRepeatWrap',dataKey:'projects',addBtnId:'addProjectBtn',blank:{title:'New project',desc:'',tags:[],metrics:[],features:[],github:'',demo:'',screenshots:[],date:''},labelFn:i=>i.title||'Project',fields:[{key:'title',label:'Title',type:'text'},{key:'date',label:'Date (e.g. Jun 2025)',type:'text'},{key:'desc',label:'Description',type:'textarea'},{key:'tags',label:'Tags (one per line)',type:'list'},{key:'metrics',label:'Metrics — "Label: Value" per line (e.g. Accuracy: 95%)',type:'metrics'},{key:'features',label:'Features (one per line)',type:'list'},{key:'github',label:'GitHub URL',type:'text'},{key:'demo',label:'Live demo URL',type:'text'},{key:'screenshots',label:'Screenshot URLs (one per line)',type:'list'}]});
  makeRepeater({wrapId:'certsRepeatWrap',dataKey:'certifications',addBtnId:'addCertBtn',blank:{name:'New cert',issuer:'',year:'',file:''},labelFn:i=>i.name||'Certification',fields:[{key:'name',label:'Name',type:'text'},{key:'issuer',label:'Issuer',type:'text'},{key:'year',label:'Year',type:'text'},{key:'file',label:'Certificate file (image or PDF)',type:'fileupload',accept:'.pdf,image/*'}]});
  makeRepeater({wrapId:'experienceRepeatWrap',dataKey:'experience',addBtnId:'addExperienceBtn',blank:{role:'',org:'',period:'',desc:''},labelFn:i=>(i.role?`${i.role} · `:'')+(i.org||'Experience'),fields:[{key:'role',label:'Role / title',type:'text'},{key:'org',label:'Organisation',type:'text'},{key:'period',label:'Period (e.g. Jun 2024 – Aug 2024)',type:'text'},{key:'desc',label:'Description',type:'textarea'}]});
  makeRepeater({wrapId:'educationRepeatWrap',dataKey:'education',addBtnId:'addEducationBtn',blank:{degree:'',school:'',period:'',detail:''},labelFn:i=>i.degree||'Education',fields:[{key:'degree',label:'Degree / qualification',type:'text'},{key:'school',label:'School / institution',type:'text'},{key:'period',label:'Period',type:'text'},{key:'detail',label:'Detail (CGPA, %)',type:'text'}]});
  makeRepeater({wrapId:'languagesRepeatWrap',dataKey:'languages',addBtnId:'addLanguageBtn',blank:{name:'',level:80},labelFn:i=>i.name||'Language',fields:[{key:'name',label:'Language',type:'text'},{key:'level',label:'Level (0–100)',type:'number'}]});
  makeRepeater({wrapId:'achievementsRepeatWrap',dataKey:'achievements',addBtnId:'addAchievementBtn',blank:{title:'',desc:'',year:''},labelFn:i=>i.title||'Achievement',fields:[{key:'title',label:'Title',type:'text'},{key:'desc',label:'Description',type:'textarea'},{key:'year',label:'Year',type:'text'}]});
  makeRepeater({wrapId:'publicationsRepeatWrap',dataKey:'publications',addBtnId:'addPublicationBtn',blank:{title:'',venue:'',year:'',link:''},labelFn:i=>i.title||'Publication',fields:[{key:'title',label:'Title',type:'text'},{key:'venue',label:'Venue / journal',type:'text'},{key:'year',label:'Year',type:'text'},{key:'link',label:'Link URL',type:'text'}]});
  makeRepeater({wrapId:'hobbiesRepeatWrap',dataKey:'hobbies',addBtnId:'addHobbyBtn',blank:{emoji:'✨',label:''},labelFn:i=>i.label||'Hobby',fields:[{key:'emoji',label:'Emoji',type:'text'},{key:'label',label:'Label',type:'text'}]});
  makeRepeater({wrapId:'connectLinksRepeatWrap',dataKey:'connectLinks',addBtnId:'addConnectLinkBtn',blank:{platform:'',label:'',url:''},labelFn:i=>i.label||i.platform||'Link',fields:[{key:'platform',label:'Platform name',type:'text'},{key:'label',label:'Button label',type:'text'},{key:'url',label:'URL',type:'text'}]});
  makeRepeater({wrapId:'customSectionsRepeatWrap',dataKey:'customSections',addBtnId:'addCustomSectionBtn',blank:{id:'custom-'+Date.now(),tag:'New',heading:'',body:[]},labelFn:i=>i.heading||'Custom section',fields:[{key:'tag',label:'Tag label',type:'text'},{key:'heading',label:'Heading',type:'text'},{key:'body',label:'Body paragraphs (one per line)',type:'list'}]});
  byId('resetDefaultsBtn')?.addEventListener('click',async()=>{if(!confirm('Reset all content to data.js defaults? This cannot be undone.'))return;liveData=mergeDefaults(SITE_DATA);await saveContent('Reset to defaults ✓');populateForms();initRepeaters();});
}

/* ── SECTIONS PANEL ── */
const SECTION_LABELS={about:'About',experience:'Experience',timeline:'Timeline',skills:'Skills',projects:'Projects',repos:'GitHub Repos',certs:'Certifications',achievements:'Achievements',hobbies:'Hobbies',connect:'Connect',contact:'Contact'};
function initSections(){
  // visibility toggles
  const tw=byId('sectionTogglesWrap');if(!tw)return;
  const vis=liveData.sectionVisibility=liveData.sectionVisibility||{};
  tw.innerHTML=Object.keys(SECTION_LABELS).map(k=>`<label class="section-toggle-row"><input type="checkbox" data-section="${k}" ${vis[k]===false?'':'checked'} style="width:16px;height:16px;accent-color:var(--accent-1)"/><span>${SECTION_LABELS[k]}</span></label>`).join('');
  tw.querySelectorAll('[data-section]').forEach(cb=>{cb.addEventListener('change',async()=>{liveData.sectionVisibility[cb.dataset.section]=cb.checked;await saveContent('Saved ✓');});});
  // titles
  const meta=liveData.sectionMeta=liveData.sectionMeta||{};
  const mw=byId('sectionTitlesWrap');if(!mw)return;
  const defaults={about:{tag:'About',heading:'A little about how I think.'},experience:{tag:'Experience',heading:"Where I've worked."},timeline:{tag:'Journey',heading:'Everything, in order.'},skills:{tag:'Skills',heading:'The stack I reach for.'},projects:{tag:'Projects',heading:"Things I've shipped."},repos:{tag:'Live from GitHub',heading:'Pulled straight from my repositories.'},certs:{tag:'Certifications',heading:'Credentials that back the skills.'},achievements:{tag:'Recognition',heading:'Achievements & publications.'},hobbies:{tag:'Beyond the screen',heading:'Interests & hobbies.'},connect:{tag:'Connect',heading:'Find me elsewhere.'}};
  mw.innerHTML=Object.keys(defaults).map(k=>{const m=meta[k]||defaults[k];return`<div style="margin-bottom:12px"><div style="font-size:.75rem;color:var(--accent-2);font-family:var(--font-mono);margin-bottom:5px">${SECTION_LABELS[k]}</div><div style="display:grid;grid-template-columns:1fr 2fr;gap:8px"><input type="text" data-meta="${k}-tag" value="${esc(m.tag||'')}" placeholder="Tag"/><input type="text" data-meta="${k}-heading" value="${esc(m.heading||'')}" placeholder="Heading"/></div></div>`;}).join('');
  mw.querySelectorAll('[data-meta]').forEach(inp=>{inp.addEventListener('input',()=>{const[k,f]=inp.dataset.meta.split('-');(meta[k]=meta[k]||{})[f]=inp.value;});});
}

/* ── SAVE ALL ── */
function initSaveAll(){byId('saveAllBtn')?.addEventListener('click',async()=>{collectSimpleFields();await saveContent();});}

/* ── BOOT ── */
(function boot(){initTheme();initDots();initTabs();initSaveAll();initAuth();})();
