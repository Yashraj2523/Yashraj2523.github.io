// admin.js
let supa = null;
let liveData = null;

function supabaseReady(){
  return typeof SUPABASE_URL === 'string' && SUPABASE_URL.length > 5 &&
         typeof SUPABASE_ANON_KEY === 'string' && SUPABASE_ANON_KEY.length > 5 &&
         window.supabase;
}

function mergeWithDefaults(content){
  const merged = Object.assign({}, SITE_DATA, content);
  merged.settings = Object.assign({}, SITE_DATA.settings, content.settings || {});
  merged.sectionVisibility = Object.assign({}, SITE_DATA.sectionVisibility, content.sectionVisibility || {});
  merged.sectionMeta = Object.assign({}, SITE_DATA.sectionMeta, content.sectionMeta || {});
  merged.customSections = content.customSections || [];
  return merged;
}

/* ====================================================================
   THEME (same as main site, just so admin matches your last choice)
   ==================================================================== */
function initTheme(){
  const root = document.documentElement;
  const saved = localStorage.getItem('site_theme');
  applyTheme(saved || 'dark');
  document.getElementById('themeToggle').addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next);
    localStorage.setItem('site_theme', next);
  });
}
function applyTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('themeIconMoon').style.display = theme === 'light' ? 'block' : 'none';
  document.getElementById('themeIconSun').style.display = theme === 'light' ? 'none' : 'block';
}

function initConstellationLite(){
  const canvas = document.getElementById('constellation');
  const ctx = canvas.getContext('2d');
  function resize(){ canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  resize(); window.addEventListener('resize', resize);
  const styles = getComputedStyle(document.documentElement);
  ctx.fillStyle = `rgba(${styles.getPropertyValue('--node-color').trim() || '160,220,210'},0.3)`;
  for (let i=0;i<40;i++){
    ctx.beginPath();
    ctx.arc(Math.random()*canvas.width, Math.random()*canvas.height, 1.4, 0, Math.PI*2);
    ctx.fill();
  }
}

/* ====================================================================
   AUTH
   ==================================================================== */
async function initAuth(){
  const loginGate = document.getElementById('loginGate');
  const dashboard = document.getElementById('dashboard');
  const submitBtn = document.getElementById('loginSubmitBtn');
  const status = document.getElementById('loginStatus');
  const emailInput = document.getElementById('loginEmail');
  const passInput = document.getElementById('loginPass');
  const signOutBtn = document.getElementById('signOutBtn');

  if (!supabaseReady()){
    status.textContent = "Supabase isn't configured yet in config.js — see README.md.";
    submitBtn.disabled = true;
    return;
  }
  supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  submitBtn.addEventListener('click', async () => {
    status.textContent = 'Signing in…';
    const { error } = await supa.auth.signInWithPassword({ email: emailInput.value.trim(), password: passInput.value });
    if (error){ status.textContent = error.message; return; }
    await enterDashboard();
  });
  passInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitBtn.click(); });

  signOutBtn.addEventListener('click', async () => {
    await supa.auth.signOut();
    location.reload();
  });

  const { data } = await supa.auth.getSession();
  if (data.session) await enterDashboard();

  async function enterDashboard(){
    loginGate.classList.add('hidden');
    dashboard.classList.remove('hidden');
    showToast('✓ Signed in — you can edit everything below');
    await loadContent();
    populateForms();
    initRepeaters();
    initUploads();
  }
}

function showToast(msg){
  let toast = document.getElementById('adminToast');
  if (!toast){
    toast = document.createElement('div');
    toast.id = 'adminToast';
    toast.className = 'admin-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

/* ====================================================================
   LOAD / SAVE
   ==================================================================== */
async function loadContent(){
  const { data, error } = await supa.from('site_content').select('content').eq('id', 'main').single();
  if (!error && data && data.content) liveData = mergeWithDefaults(data.content);
  else { await supa.from('site_content').upsert({ id: 'main', content: SITE_DATA }); liveData = mergeWithDefaults(SITE_DATA); }
}

async function saveContent(message){
  const status = document.getElementById('saveStatus');
  const bottomStatus = document.getElementById('bottomSaveStatus');
  status.textContent = 'Saving…'; bottomStatus.textContent = 'Saving…';
  const { error } = await supa.from('site_content').upsert({ id: 'main', content: liveData });
  const msg = error ? ('Error: ' + error.message) : (message || 'Saved ✓ — live on the site now');
  status.textContent = msg; bottomStatus.textContent = msg;
  setTimeout(() => { status.textContent = ''; bottomStatus.textContent = ''; }, 4000);
}

/* ====================================================================
   TABS
   ==================================================================== */
function initTabs(){
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.admin-panel-section').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.querySelector(`.admin-panel-section[data-panel="${tab.dataset.tab}"]`).classList.add('active');
    });
  });
}

/* ====================================================================
   POPULATE SIMPLE FIELDS
   ==================================================================== */
function populateForms(){
  byId('f_hero_name').value = liveData.hero_name || '';
  byId('f_hero_sub').value = liveData.hero_sub || '';
  byId('f_roles').value = (liveData.roles || []).join('\n');
  byId('f_about').value = htmlToLines(liveData.about_text_html);
  byId('f_email').value = liveData.email || '';
  byId('f_phone').value = liveData.phone || '';

  byId('f_github_username').value = liveData.github_username || '';
  byId('f_linkedin_url').value = liveData.linkedin_url || '';
  byId('f_linkedin_blurb').value = liveData.linkedin_blurb || '';
  byId('f_youtube_url').value = liveData.youtube_url || '';
  byId('f_youtube_subs').value = liveData.youtube_subs || '';

  const s = liveData.settings || {};
  byId('s_iconButtonSize').value = s.iconButtonSize || 36;
  byId('s_avatarSize').value = s.avatarSize || 320;
  byId('s_cardRadius').value = s.cardRadius || 18;
  byId('s_glassBlur').value = s.glassBlur || 18;
  byId('s_sectionSpacing').value = s.sectionSpacing || 130;
  byId('s_wallpaperOpacity').value = s.wallpaperOpacity !== undefined ? s.wallpaperOpacity : 35;
  renderSingleImagePreview('wallpaperPreview', liveData.background_image);
  byId('resumeCurrentLink').innerHTML = liveData.resume_url ? `Current file: <a href="${liveData.resume_url}" target="_blank">${liveData.resume_url}</a>` : 'No résumé uploaded yet.';

  renderUploadPreview('photoPreviewList', liveData.profile_photos || []);
  renderSingleImagePreview('ytBannerPreview', liveData.youtube_banner);
  renderSingleImagePreview('ytLogoPreview', liveData.youtube_logo);
}

function htmlToLines(html){
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return [...div.querySelectorAll('p')].map(p => p.textContent.trim()).join('\n');
}
function linesToHtml(text){
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(l => `<p>${escapeHtml(l)}</p>`).join('\n');
}
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function byId(id){ return document.getElementById(id); }

function collectSimpleFields(){
  liveData.hero_name = byId('f_hero_name').value;
  liveData.hero_sub = byId('f_hero_sub').value;
  liveData.roles = byId('f_roles').value.split('\n').map(s => s.trim()).filter(Boolean);
  liveData.about_text_html = linesToHtml(byId('f_about').value);
  liveData.email = byId('f_email').value;
  liveData.phone = byId('f_phone').value;

  liveData.github_username = byId('f_github_username').value;
  liveData.linkedin_url = byId('f_linkedin_url').value;
  liveData.linkedin_blurb = byId('f_linkedin_blurb').value;
  liveData.youtube_url = byId('f_youtube_url').value;
  liveData.youtube_subs = byId('f_youtube_subs').value;

  liveData.settings = {
    iconButtonSize: +byId('s_iconButtonSize').value || 36,
    avatarSize: +byId('s_avatarSize').value || 320,
    cardRadius: +byId('s_cardRadius').value || 18,
    glassBlur: +byId('s_glassBlur').value || 18,
    sectionSpacing: +byId('s_sectionSpacing').value || 130,
    wallpaperOpacity: +byId('s_wallpaperOpacity').value,
  };
}

/* ====================================================================
   GENERIC REPEATER FACTORY
   Each repeater renders a list of objects as editable cards with a
   remove button, plus an "add" button that appends a blank object.
   ==================================================================== */
function makeRepeater(opts){
  const { wrapId, dataKey, fields, blank, addBtnId, labelFn } = opts;
  const wrap = document.getElementById(wrapId);

  function render(){
    const list = liveData[dataKey] || (liveData[dataKey] = []);
    wrap.innerHTML = list.map((item, idx) => `
      <div class="admin-repeat-item" data-idx="${idx}" draggable="true">
        <span class="drag-handle" title="Drag to reorder">⠿</span>
        <button class="admin-remove-btn" data-action="remove">✕</button>
        ${labelFn ? `<div style="font-size:.78rem; color:var(--accent-2); margin-bottom:10px; font-family:var(--font-mono);">${escapeHtml(labelFn(item, idx))}</div>` : ''}
        ${fields.map(f => fieldHtml(f, item, idx)).join('')}
      </div>`).join('') || '<p class="empty-state">Nothing here yet — use the button below to add one.</p>';

    wrap.querySelectorAll('.admin-repeat-item').forEach(itemEl => {
      const idx = +itemEl.dataset.idx;
      itemEl.querySelector('[data-action="remove"]').addEventListener('click', () => {
        list.splice(idx, 1); render();
      });
      fields.forEach(f => {
        const input = itemEl.querySelector(`[data-field="${f.key}"]`);
        input.addEventListener('input', () => {
          if (f.type === 'list') list[idx][f.key] = input.value.split('\n').map(s => s.trim()).filter(Boolean);
          else if (f.type === 'metrics') list[idx][f.key] = parseMetrics(input.value);
          else if (f.type === 'number') list[idx][f.key] = +input.value;
          else list[idx][f.key] = input.value;
        });
        if (f.type === 'fileupload'){
          const fileInput = itemEl.querySelector(`[data-fileupload="${f.key}"]`);
          fileInput.addEventListener('change', async () => {
            const file = fileInput.files[0]; if (!file) return;
            const status = itemEl.querySelector(`[data-uploadstatus="${f.key}-${idx}"]`);
            const url = await uploadFile(file, status);
            if (url){ list[idx][f.key] = url; render(); }
          });
        }
      });
    });

    initDragReorder(wrap, list, render);
  }

  function fieldHtml(f, item, idx){
    const val = item[f.key];
    const display = f.type === 'list' ? (val || []).join('\n')
      : f.type === 'metrics' ? metricsToText(val)
      : (val !== undefined ? val : '');
    if (f.type === 'fileupload'){
      return `<div class="admin-field">
        <label>${f.label}</label>
        <div class="upload-row">
          <input type="text" data-field="${f.key}" value="${escapeHtml(display)}" placeholder="Paste a URL, or upload a file →" style="flex:1; min-width:160px;" />
          <input type="file" accept="${f.accept || '*'}" data-fileupload="${f.key}" data-idx="${idx}" />
          <span class="settings-hint" data-uploadstatus="${f.key}-${idx}"></span>
        </div>
        ${display ? (/\.pdf($|\?)/i.test(display) ? `<a href="${display}" target="_blank" class="settings-hint">📄 View current PDF</a>` : `<div class="upload-preview-item" style="margin-top:8px;"><img src="${display}" /></div>`) : ''}
      </div>`;
    }
    if (f.type === 'textarea' || f.type === 'list' || f.type === 'metrics'){
      return `<div class="admin-field"><label>${f.label}</label><textarea data-field="${f.key}">${escapeHtml(display)}</textarea></div>`;
    }
    return `<div class="admin-field"><label>${f.label}</label><input type="${f.type === 'number' ? 'number' : 'text'}" data-field="${f.key}" value="${escapeHtml(display)}" /></div>`;
  }

  document.getElementById(addBtnId).addEventListener('click', () => {
    (liveData[dataKey] = liveData[dataKey] || []).push(Object.assign({}, blank));
    render();
  });

  render();
  return render;
}

function initDragReorder(wrap, list, rerender){
  let dragIdx = null;
  wrap.querySelectorAll('.admin-repeat-item').forEach(itemEl => {
    itemEl.addEventListener('dragstart', () => {
      dragIdx = +itemEl.dataset.idx;
      itemEl.classList.add('dragging');
    });
    itemEl.addEventListener('dragend', () => itemEl.classList.remove('dragging'));
    itemEl.addEventListener('dragover', e => { e.preventDefault(); itemEl.classList.add('drag-over'); });
    itemEl.addEventListener('dragleave', () => itemEl.classList.remove('drag-over'));
    itemEl.addEventListener('drop', e => {
      e.preventDefault();
      itemEl.classList.remove('drag-over');
      const dropIdx = +itemEl.dataset.idx;
      if (dragIdx === null || dragIdx === dropIdx) return;
      const [moved] = list.splice(dragIdx, 1);
      list.splice(dropIdx, 0, moved);
      dragIdx = null;
      rerender();
    });
  });
}

function parseMetrics(text){
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const [label, value] = l.split(':').map(s => s.trim());
    return { label: label || '', value: value || '' };
  });
}
function metricsToText(metrics){
  return (metrics || []).map(m => `${m.label}: ${m.value}`).join('\n');
}

function initRepeaters(){
  makeRepeater({
    wrapId: 'skillsRepeatWrap', dataKey: 'skills', addBtnId: 'addSkillGroupBtn',
    blank: { category: 'New category', items: [] },
    labelFn: (item) => item.category || 'Category',
    fields: [
      { key: 'category', label: 'Category name', type: 'text' },
      { key: 'items', label: 'Skills (one per line)', type: 'list' },
    ]
  });

  makeRepeater({
    wrapId: 'projectsRepeatWrap', dataKey: 'projects', addBtnId: 'addProjectBtn',
    blank: { title: 'New project', desc: '', tags: [], metrics: [], features: [], github: '', demo: '', screenshots: [] },
    labelFn: (item) => item.title || 'Project',
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'desc', label: 'Description', type: 'textarea' },
      { key: 'tags', label: 'Tags (one per line)', type: 'list' },
      { key: 'metrics', label: 'Metrics — one per line as "Label: Value" (e.g. Accuracy: 95%)', type: 'metrics' },
      { key: 'features', label: 'Features (one per line)', type: 'list' },
      { key: 'github', label: 'GitHub link', type: 'text' },
      { key: 'demo', label: 'Live demo link', type: 'text' },
      { key: 'screenshots', label: 'Screenshot image URLs (one per line — upload via Photos tab or paste a link)', type: 'list' },
    ]
  });

  makeRepeater({
    wrapId: 'certsRepeatWrap', dataKey: 'certifications', addBtnId: 'addCertBtn',
    blank: { name: 'New certification', issuer: '', year: '', file: '' },
    labelFn: (item) => item.name || 'Certification',
    fields: [
      { key: 'name', label: 'Certificate name', type: 'text' },
      { key: 'issuer', label: 'Issuer', type: 'text' },
      { key: 'year', label: 'Year', type: 'text' },
      { key: 'file', label: 'Certificate file (image or PDF)', type: 'fileupload', accept: '.pdf,image/*' },
    ]
  });

  makeRepeater({
    wrapId: 'experienceRepeatWrap', dataKey: 'experience', addBtnId: 'addExperienceBtn',
    blank: { role: 'New role', org: '', period: '', desc: '' },
    labelFn: (item) => item.role || 'Experience',
    fields: [
      { key: 'role', label: 'Role / title', type: 'text' },
      { key: 'org', label: 'Organization', type: 'text' },
      { key: 'period', label: 'Period (e.g. Jun 2025 – Aug 2025)', type: 'text' },
      { key: 'desc', label: 'Description', type: 'textarea' },
    ]
  });

  makeRepeater({
    wrapId: 'educationRepeatWrap', dataKey: 'education', addBtnId: 'addEducationBtn',
    blank: { degree: 'New degree', school: '', period: '', detail: '' },
    labelFn: (item) => item.degree || 'Education',
    fields: [
      { key: 'degree', label: 'Degree / qualification', type: 'text' },
      { key: 'school', label: 'School / institution', type: 'text' },
      { key: 'period', label: 'Period', type: 'text' },
      { key: 'detail', label: 'Detail (CGPA, %, etc.)', type: 'text' },
    ]
  });

  makeRepeater({
    wrapId: 'languagesRepeatWrap', dataKey: 'languages', addBtnId: 'addLanguageBtn',
    blank: { name: 'New language', level: 80 },
    labelFn: (item) => item.name || 'Language',
    fields: [
      { key: 'name', label: 'Language', type: 'text' },
      { key: 'level', label: 'Proficiency (0-100)', type: 'number' },
    ]
  });

  makeRepeater({
    wrapId: 'achievementsRepeatWrap', dataKey: 'achievements', addBtnId: 'addAchievementBtn',
    blank: { title: 'New achievement', desc: '', year: '' },
    labelFn: (item) => item.title || 'Achievement',
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'desc', label: 'Description', type: 'textarea' },
      { key: 'year', label: 'Year', type: 'text' },
    ]
  });

  makeRepeater({
    wrapId: 'publicationsRepeatWrap', dataKey: 'publications', addBtnId: 'addPublicationBtn',
    blank: { title: 'New publication', venue: '', year: '', link: '' },
    labelFn: (item) => item.title || 'Publication',
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'venue', label: 'Venue / journal / conference', type: 'text' },
      { key: 'year', label: 'Year', type: 'text' },
      { key: 'link', label: 'Link', type: 'text' },
    ]
  });

  makeRepeater({
    wrapId: 'hobbiesRepeatWrap', dataKey: 'hobbies', addBtnId: 'addHobbyBtn',
    blank: { emoji: '✨', label: 'New hobby' },
    labelFn: (item) => item.label || 'Hobby',
    fields: [
      { key: 'emoji', label: 'Emoji', type: 'text' },
      { key: 'label', label: 'Label', type: 'text' },
    ]
  });

  document.getElementById('resetDefaultsBtn').addEventListener('click', async () => {
    if (!confirm('This will overwrite your live database with the contents of data.js. Continue?')) return;
    liveData = mergeWithDefaults(SITE_DATA);
    await saveContent('Reset to defaults ✓');
    populateForms();
    initRepeaters();
  });

  initSectionToggles();
  initSectionTitles();
  initCustomSections();
}

const SECTION_LABELS = {
  about: 'About', experience: 'Experience', timeline: 'Timeline', skills: 'Skills',
  projects: 'Projects', repos: 'GitHub repos', certs: 'Certifications',
  achievements: 'Achievements & publications', hobbies: 'Hobbies', connect: 'Connect',
  contact: 'Contact',
};

function initSectionToggles(){
  const wrap = document.getElementById('sectionTogglesWrap');
  const vis = liveData.sectionVisibility = liveData.sectionVisibility || {};
  wrap.innerHTML = Object.keys(SECTION_LABELS).map(key => `
    <label style="display:flex; align-items:center; gap:10px; padding:8px 0; cursor:pointer;">
      <input type="checkbox" data-section-toggle="${key}" ${vis[key] === false ? '' : 'checked'} style="width:18px; height:18px; accent-color:var(--accent-1);" />
      ${SECTION_LABELS[key]}
    </label>`).join('');
  wrap.querySelectorAll('[data-section-toggle]').forEach(cb => {
    cb.addEventListener('change', async () => {
      liveData.sectionVisibility[cb.dataset.sectionToggle] = cb.checked;
      await saveContent('Saved ✓');
    });
  });
}

function initSectionTitles(){
  const wrap = document.getElementById('sectionTitlesWrap');
  const meta = liveData.sectionMeta = liveData.sectionMeta || {};
  wrap.innerHTML = Object.keys(SECTION_LABELS).filter(k => k !== 'contact').map(key => {
    const m = meta[key] || {};
    return `
    <div class="admin-repeat-item" style="padding-left:18px;">
      <div style="font-size:.78rem; color:var(--accent-2); margin-bottom:10px; font-family:var(--font-mono);">${SECTION_LABELS[key]}</div>
      <div class="admin-row">
        <div class="admin-field"><label>Small label (tag)</label><input type="text" data-meta="${key}-tag" value="${escapeHtml(m.tag || '')}" /></div>
        <div class="admin-field"><label>Heading</label><input type="text" data-meta="${key}-heading" value="${escapeHtml(m.heading || '')}" /></div>
      </div>
    </div>`;
  }).join('');
  wrap.querySelectorAll('[data-meta]').forEach(input => {
    input.addEventListener('input', () => {
      const [key, field] = input.dataset.meta.split('-');
      meta[key] = meta[key] || {};
      meta[key][field] = input.value;
    });
  });
}

function initCustomSections(){
  makeRepeater({
    wrapId: 'customSectionsRepeatWrap', dataKey: 'customSections', addBtnId: 'addCustomSectionBtn',
    blank: { id: 'custom-' + Date.now(), tag: 'New section', heading: 'New section heading', body: [] },
    labelFn: (item) => item.heading || 'Custom section',
    fields: [
      { key: 'tag', label: 'Small label (tag)', type: 'text' },
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'body', label: 'Body text (one paragraph per line)', type: 'list' },
    ]
  });
}

/* ====================================================================
   UPLOADS (Supabase Storage bucket "portfolio-media")
   ==================================================================== */
function renderUploadPreview(containerId, urls){
  const container = document.getElementById(containerId);
  container.innerHTML = (urls || []).map((url, i) => `
    <div class="upload-preview-item" data-i="${i}">
      <img src="${url}" />
      <button data-action="remove">✕</button>
    </div>`).join('');
  container.querySelectorAll('[data-action="remove"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = +btn.closest('.upload-preview-item').dataset.i;
      liveData.profile_photos.splice(i, 1);
      renderUploadPreview(containerId, liveData.profile_photos);
    });
  });
}
function renderSingleImagePreview(containerId, url){
  const container = document.getElementById(containerId);
  container.innerHTML = url ? `<div class="upload-preview-item"><img src="${url}" /></div>` : '';
}

async function uploadFile(file, statusEl){
  if (!supa) return null;
  statusEl.textContent = 'Uploading…';
  const ext = file.name.split('.').pop();
  const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const { error } = await supa.storage.from('portfolio-media').upload(path, file, { cacheControl: '3600', upsert: false });
  if (error){ statusEl.textContent = 'Upload failed: ' + error.message; return null; }
  const { data } = supa.storage.from('portfolio-media').getPublicUrl(path);
  statusEl.textContent = 'Uploaded ✓';
  setTimeout(() => statusEl.textContent = '', 2500);
  return data.publicUrl;
}

function initUploads(){
  document.getElementById('photoUploadInput').addEventListener('change', async (e) => {
    const status = document.getElementById('photoUploadStatus');
    for (const file of e.target.files){
      const url = await uploadFile(file, status);
      if (url){
        liveData.profile_photos = liveData.profile_photos || [];
        liveData.profile_photos.push(url);
      }
    }
    renderUploadPreview('photoPreviewList', liveData.profile_photos);
    e.target.value = '';
  });

  document.getElementById('ytBannerUploadInput').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const status = document.getElementById('ytBannerUploadStatus');
    const url = await uploadFile(file, status);
    if (url){ liveData.youtube_banner = url; renderSingleImagePreview('ytBannerPreview', url); }
    e.target.value = '';
  });

  document.getElementById('ytLogoUploadInput').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const status = document.getElementById('ytLogoUploadStatus');
    const url = await uploadFile(file, status);
    if (url){ liveData.youtube_logo = url; renderSingleImagePreview('ytLogoPreview', url); }
    e.target.value = '';
  });

  document.getElementById('resumeUploadInput').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const status = document.getElementById('resumeUploadStatus');
    const url = await uploadFile(file, status);
    if (url){
      liveData.resume_url = url;
      byId('resumeCurrentLink').innerHTML = `Current file: <a href="${url}" target="_blank">${url}</a>`;
      await saveContent('Résumé updated ✓ — live on the download button now');
    }
    e.target.value = '';
  });

  document.getElementById('wallpaperUploadInput').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const status = document.getElementById('wallpaperUploadStatus');
    const url = await uploadFile(file, status);
    if (url){
      liveData.background_image = url;
      renderSingleImagePreview('wallpaperPreview', url);
      await saveContent('Wallpaper saved ✓');
    }
    e.target.value = '';
  });

  document.getElementById('removeWallpaperBtn').addEventListener('click', async () => {
    liveData.background_image = '';
    renderSingleImagePreview('wallpaperPreview', '');
    await saveContent('Reset to default ✓');
  });

  document.getElementById('s_wallpaperOpacity').addEventListener('change', async () => {
    liveData.settings = liveData.settings || {};
    liveData.settings.wallpaperOpacity = +byId('s_wallpaperOpacity').value;
    await saveContent('Wallpaper dimness saved ✓');
  });
}

/* ====================================================================
   SAVE ALL
   ==================================================================== */
function initSaveAll(){
  document.getElementById('saveAllBtn').addEventListener('click', async () => {
    collectSimpleFields();
    await saveContent();
  });
}

/* ====================================================================
   BOOT
   ==================================================================== */
(function boot(){
  initTheme();
  initConstellationLite();
  initTabs();
  initSaveAll();
  initAuth();
})();
