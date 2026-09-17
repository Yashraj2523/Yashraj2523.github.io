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
  merged.connectLinks = content.connectLinks || [];
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
  const dashboard = document.getElementById('dashboard');
  const navSignInBtn = document.getElementById('navSignInBtn');
  const signOutBtn = document.getElementById('signOutBtn');
  const loginPopup = document.getElementById('loginPopup');
  const navTitle = document.getElementById('navAdminTitle');
  const submitBtn = document.getElementById('loginSubmitBtn');
  const status = document.getElementById('loginStatus');
  const emailInput = document.getElementById('loginEmail');
  const passInput = document.getElementById('loginPass');

  if (!supabaseReady()){
    status.textContent = "Supabase isn't configured yet in config.js — see README.md.";
    submitBtn.disabled = true;
    return;
  }
  supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
  });

  navSignInBtn.addEventListener('click', () => loginPopup.classList.toggle('hidden'));
  document.addEventListener('click', e => {
    if (!loginPopup.classList.contains('hidden') && !e.target.closest('.nav-auth-wrap')) loginPopup.classList.add('hidden');
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
    location.href = 'index.html?nointro=1';
  });

  const { data } = await supa.auth.getSession();
  if (data.session) await enterDashboard();

  async function enterDashboard(){
    loginPopup.classList.add('hidden');
    navSignInBtn.classList.add('hidden');
    signOutBtn.classList.remove('hidden');
    navTitle.classList.remove('hidden');
    dashboard.classList.remove('hidden');
    showToast('✓ Signed in — you can edit everything below');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await loadContent();
    populateForms();
    initRepeaters();
    initUploads();
    pollHiresBadgeSilently();
    initPreviewPanel();
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
   LOAD / SAVE (draft/publish model)
   Everything you edit lives in the id='draft' row — it never touches the
   live public site until you explicitly hit "Publish". This lets you make
   a batch of changes, preview them in the panel, and only go live when
   you're ready, instead of every keystroke-triggered save being instant.
   ==================================================================== */
async function loadContent(){
  const { data, error } = await supa.from('site_content').select('content').eq('id', 'draft').single();
  if (!error && data && data.content){
    liveData = mergeWithDefaults(data.content);
    return;
  }
  // No draft yet — seed it from whatever is currently published (or from
  // data.js defaults if nothing has ever been published either).
  const { data: mainRow } = await supa.from('site_content').select('content').eq('id', 'main').single();
  const seed = (mainRow && mainRow.content) ? mainRow.content : SITE_DATA;
  await supa.from('site_content').upsert({ id: 'draft', content: seed });
  if (!mainRow || !mainRow.content){
    await supa.from('site_content').upsert({ id: 'main', content: SITE_DATA });
  }
  liveData = mergeWithDefaults(seed);
}

async function saveContent(message){
  const bottomStatus = document.getElementById('bottomSaveStatus');
  bottomStatus.textContent = 'Saving draft…';
  const { error } = await supa.from('site_content').upsert({ id: 'draft', content: liveData });
  const msg = error ? ('Error: ' + error.message) : (message || 'Draft saved — not live yet. Hit "🚀 Publish" when ready.');
  bottomStatus.textContent = msg;
  setTimeout(() => { bottomStatus.textContent = ''; }, 4000);
  if (!error) refreshPreview();
}

async function publishContent(){
  const bottomStatus = document.getElementById('bottomSaveStatus');
  bottomStatus.textContent = 'Publishing…';

  // Always persist whatever is currently in memory to the draft first,
  // so Publish never loses an edit you forgot to explicitly save.
  await supa.from('site_content').upsert({ id: 'draft', content: liveData });

  // Snapshot whatever is currently LIVE before overwriting it — this is
  // the real "undo my last publish" safety net (see Version History tab).
  // Best-effort: if it fails, publishing still proceeds.
  try {
    const { data: current } = await supa.from('site_content').select('content').eq('id', 'main').single();
    if (current && current.content){
      await supa.from('site_content_history').insert({ content: current.content });
      cleanupOldHistory();
    }
  } catch (e) { console.warn('Version history snapshot skipped:', e); }

  const { error } = await supa.from('site_content').upsert({ id: 'main', content: liveData });
  const msg = error ? ('Error: ' + error.message) : 'Published ✓ — live on the real site now';
  bottomStatus.textContent = msg;
  setTimeout(() => { bottomStatus.textContent = ''; }, 5000);
  if (!error) refreshPreview();
}

async function cleanupOldHistory(){
  // Keep only the most recent 10 snapshots so this table never grows unbounded.
  try {
    const { data: rows } = await supa.from('site_content_history').select('id').order('created_at', { ascending: false });
    if (rows && rows.length > 10){
      const idsToDelete = rows.slice(10).map(r => r.id);
      await supa.from('site_content_history').delete().in('id', idsToDelete);
    }
  } catch (e) { console.warn('History cleanup skipped:', e); }
}

/* ====================================================================
   VERSION HISTORY PANEL
   ==================================================================== */
async function loadVersionHistory(){
  const wrap = document.getElementById('versionHistoryList');
  if (!wrap || !supa) return;
  wrap.innerHTML = '<p class="settings-hint">Loading…</p>';
  const { data, error } = await supa.from('site_content_history').select('*').order('created_at', { ascending: false }).limit(10);
  if (error){
    wrap.innerHTML = `<p class="settings-hint">Could not load — run the latest supabase_schema.sql in your Supabase SQL editor (it creates the site_content_history table). Error: ${error.message}</p>`;
    return;
  }
  if (!data || !data.length){
    wrap.innerHTML = '<p class="settings-hint">No history yet — snapshots start appearing after your next save.</p>';
    return;
  }
  wrap.innerHTML = data.map((row, i) => {
    const date = new Date(row.created_at);
    const label = date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    const preview = (row.content && row.content.hero_name) ? row.content.hero_name : 'Snapshot';
    return `
      <div class="version-history-item">
        <div>
          <div class="version-history-date">${escapeHtml(label)}</div>
          <div class="version-history-preview">${i === 0 ? 'Most recent snapshot — right before your last save' : escapeHtml(preview)}</div>
        </div>
        <button type="button" class="btn btn-glass" data-restore-id="${row.id}">↺ Restore this version</button>
      </div>`;
  }).join('');

  wrap.querySelectorAll('[data-restore-id]').forEach(btn => {
    btn.addEventListener('click', () => restoreVersion(btn.dataset.restoreId, data));
  });
}

async function restoreVersion(id, cachedRows){
  const row = (cachedRows || []).find(r => String(r.id) === String(id));
  if (!row){
    showToast('Could not find that version — try reloading the list.');
    return;
  }
  const when = new Date(row.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  if (!confirm(`Load your site as it looked on ${when} into your draft for review? This does not go live until you hit "🚀 Publish".`)) return;

  liveData = mergeWithDefaults(row.content);
  populateForms();
  initRepeaters();
  await saveContent(`Version from ${when} loaded into your draft ✓ — review it, then hit Publish to go live.`);
  loadVersionHistory();
  showToast('✓ Loaded into draft — check the Preview panel, then hit Publish when ready');
}

/* ====================================================================
   LIVE PREVIEW PANEL (embeds the real index.html in an iframe, so
   what you see is the actual site, not an approximation — refreshes
   itself automatically after every successful save)
   ==================================================================== */
function refreshPreview(){
  const frame = document.getElementById('previewIframe');
  if (!frame) return;
  // small delay so Supabase has definitely committed before the site re-fetches
  setTimeout(() => { frame.src = frame.src; }, 500);
}
function initPreviewPanel(){
  const refreshBtn = document.getElementById('previewRefreshBtn');
  const toggleBtn = document.getElementById('previewToggleBtn');
  const showBtn = document.getElementById('previewShowBtn');
  if (!refreshBtn) return;

  refreshBtn.addEventListener('click', refreshPreview);
  toggleBtn.addEventListener('click', () => {
    document.body.classList.add('preview-hidden');
    showBtn.classList.remove('hidden');
    localStorage.setItem('admin_preview_hidden', '1');
  });
  showBtn.addEventListener('click', () => {
    document.body.classList.remove('preview-hidden');
    showBtn.classList.add('hidden');
    localStorage.removeItem('admin_preview_hidden');
    refreshPreview();
  });
  if (localStorage.getItem('admin_preview_hidden') === '1'){
    document.body.classList.add('preview-hidden');
    showBtn.classList.remove('hidden');
  }
}

/* ====================================================================
   TABS
   ==================================================================== */
/* ====================================================================
   VISITOR TRACKING — game/quiz players (visitor_leads) and Hire Me
   submissions (hire_inquiries). Both tables require the SELECT policy
   from supabase_schema.sql (admin-only reads) to already be applied.
   ==================================================================== */
function renderDataTable(wrapId, rows, columns){
  const wrap = document.getElementById(wrapId);
  if (!rows || !rows.length){ wrap.innerHTML = '<p class="settings-hint">Nothing yet.</p>'; return; }
  wrap.innerHTML = `<table class="admin-data-table"><thead><tr>${
    columns.map(c => `<th>${c.label}</th>`).join('')
  }</tr></thead><tbody>${
    rows.map(r => `<tr>${columns.map(c => `<td>${(r[c.key] ?? '').toString().replace(/</g,'&lt;')}</td>`).join('')}</tr>`).join('')
  }</tbody></table>`;
}

function toCSV(rows, columns){
  const header = columns.map(c => `"${c.label}"`).join(',');
  const lines = rows.map(r => columns.map(c => `"${(r[c.key] ?? '').toString().replace(/"/g,'""')}"`).join(','));
  return [header, ...lines].join('\n');
}

function downloadCSV(filename, rows, columns){
  const blob = new Blob([toCSV(rows, columns)], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const VISITOR_COLUMNS = [
  { key: 'name', label: 'Name' }, { key: 'contact', label: 'Contact' },
  { key: 'page', label: 'Page' }, { key: 'created_at', label: 'Date' },
];
const HIRE_COLUMNS = [
  { key: 'name', label: 'Name' }, { key: 'company', label: 'Company' }, { key: 'contact', label: 'Contact' },
  { key: 'message', label: 'Message' }, { key: 'created_at', label: 'Date' },
];

let visitorLeadsCache = [], hireInquiriesCache = [];

async function loadVisitorLeads(){
  if (!supa) return;
  const { data, error } = await supa.from('visitor_leads').select('*').order('created_at', { ascending: false });
  if (error){
    document.getElementById('visitorLeadsTableWrap').innerHTML = `<p class="settings-hint">Could not load — this usually means supabase_schema.sql hasn't been run in your Supabase SQL editor yet (it creates this table). Error: ${error.message}</p>`;
    return;
  }
  visitorLeadsCache = data || [];
  renderDataTable('visitorLeadsTableWrap', visitorLeadsCache, VISITOR_COLUMNS);
}

async function loadHireInquiries(){
  if (!supa) return;
  const { data, error } = await supa.from('hire_inquiries').select('*').order('created_at', { ascending: false });
  if (error){
    document.getElementById('hireInquiriesTableWrap').innerHTML = `<p class="settings-hint">Could not load — this usually means supabase_schema.sql hasn't been run in your Supabase SQL editor yet (it creates this table). Error: ${error.message}</p>`;
    return;
  }
  hireInquiriesCache = data || [];
  renderDataTable('hireInquiriesTableWrap', hireInquiriesCache, HIRE_COLUMNS);
  markHiresSeen(hireInquiriesCache.length);
}

function updateHiresBadge(currentCount){
  const badge = document.getElementById('hiresBadge');
  if (!badge) return;
  const seen = parseInt(localStorage.getItem('hires_seen_count') || '0', 10);
  const unseen = Math.max(0, currentCount - seen);
  if (unseen > 0){
    badge.textContent = unseen > 9 ? '9+' : String(unseen);
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}
function markHiresSeen(currentCount){
  // Only mark as seen once the Hire Me tab is actually opened, not on a
  // background poll — called from loadHireInquiries which only runs on tab click.
  localStorage.setItem('hires_seen_count', String(currentCount));
  const badge = document.getElementById('hiresBadge');
  if (badge) badge.classList.add('hidden');
}
async function pollHiresBadgeSilently(){
  if (!supa) return;
  const { count, error } = await supa.from('hire_inquiries').select('*', { count: 'exact', head: true });
  if (error || count === null || count === undefined) return;
  updateHiresBadge(count);
}

async function loadAnalytics(){
  if (!supa) return;
  const summaryWrap = document.getElementById('analyticsSummaryCards');
  const topWrap = document.getElementById('analyticsTopProjects');
  summaryWrap.innerHTML = `<p class="settings-hint">Loading…</p>`;

  const { data, error } = await supa.from('site_events').select('event_type, meta, created_at');
  if (error){
    summaryWrap.innerHTML = `<p class="settings-hint">Could not load — run the latest supabase_schema.sql in your Supabase SQL editor (it creates the site_events table). Error: ${error.message}</p>`;
    topWrap.innerHTML = '';
    return;
  }
  const rows = data || [];
  const pageViews = rows.filter(r => r.event_type === 'page_view').length;
  const resumeDownloads = rows.filter(r => r.event_type === 'resume_download').length;
  const projectClicks = rows.filter(r => r.event_type === 'project_click');

  summaryWrap.innerHTML = `
    <div class="analytics-card"><div class="analytics-num">${pageViews}</div><div class="analytics-label">Page views</div></div>
    <div class="analytics-card"><div class="analytics-num">${resumeDownloads}</div><div class="analytics-label">Résumé downloads</div></div>
    <div class="analytics-card"><div class="analytics-num">${projectClicks.length}</div><div class="analytics-label">Project card opens</div></div>
  `;

  const counts = {};
  projectClicks.forEach(r => { const name = r.meta || 'Unknown'; counts[name] = (counts[name] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  topWrap.innerHTML = sorted.length
    ? `<table class="admin-data-table"><thead><tr><th>Project</th><th>Opens</th></tr></thead><tbody>${sorted.map(([name, count]) => `<tr><td>${escapeHtml(name)}</td><td>${count}</td></tr>`).join('')}</tbody></table>`
    : `<p class="settings-hint">No project clicks logged yet — they'll appear here as visitors open project cards.</p>`;
}

document.getElementById('downloadVisitorsBtn').addEventListener('click', () => downloadCSV('game-quiz-players.csv', visitorLeadsCache, VISITOR_COLUMNS));
document.getElementById('downloadHiresBtn').addEventListener('click', () => downloadCSV('hire-inquiries.csv', hireInquiriesCache, HIRE_COLUMNS));

function initTabs(){
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.admin-panel-section').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.querySelector(`.admin-panel-section[data-panel="${tab.dataset.tab}"]`).classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (tab.dataset.tab === 'visitors') loadVisitorLeads();
      if (tab.dataset.tab === 'hires') loadHireInquiries();
      if (tab.dataset.tab === 'analytics') loadAnalytics();
      if (tab.dataset.tab === 'version-history') loadVersionHistory();
    });
  });
  initNavGroups();
  initAdminJumpSearch();
}

function initNavGroups(){
  const groups = document.querySelectorAll('.admin-nav-group');
  groups.forEach(group => {
    const head = group.querySelector('.admin-group-head');
    head.addEventListener('click', () => {
      group.classList.toggle('collapsed');
    });
  });
  // Content group open by default (matches the default "hero" active tab);
  // everything else starts collapsed to keep the sidebar short.
  groups.forEach(group => {
    if (group.dataset.group !== 'content') group.classList.add('collapsed');
  });
}

function initAdminJumpSearch(){
  const input = document.getElementById('adminJumpInput');
  if (!input) return;
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    const tabs = document.querySelectorAll('.admin-tab');
    if (!q){
      tabs.forEach(t => t.style.display = '');
      document.querySelectorAll('.admin-nav-group').forEach(g => g.style.display = '');
      return;
    }
    document.querySelectorAll('.admin-nav-group').forEach(group => {
      let anyMatch = false;
      group.querySelectorAll('.admin-tab').forEach(tab => {
        const match = tab.textContent.toLowerCase().includes(q);
        tab.style.display = match ? '' : 'none';
        if (match) anyMatch = true;
      });
      group.style.display = anyMatch ? '' : 'none';
      if (anyMatch) group.classList.remove('collapsed');
    });
  });
  input.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const visibleTabs = Array.from(document.querySelectorAll('.admin-tab')).filter(t => t.style.display !== 'none');
    if (visibleTabs.length) visibleTabs[0].click();
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
  byId('s_availabilityStatus').value = s.availabilityStatus || 'green';
  byId('s_availabilityText').value = s.availabilityText || 'Open to opportunities';
  byId('s_bookingUrl').value = s.bookingUrl || '';
  bindSlider('s_iconButtonSize', 'v_iconButtonSize', s.iconButtonSize || 36, 'px');
  bindSlider('s_avatarSize', 'v_avatarSize', s.avatarSize || 320, 'px');
  bindSlider('s_cardRadius', 'v_cardRadius', s.cardRadius || 18, 'px');
  bindSlider('s_glassBlur', 'v_glassBlur', s.glassBlur || 18, 'px');
  bindSlider('s_sectionSpacing', 'v_sectionSpacing', s.sectionSpacing || 130, 'px');
  renderThemePaletteSwatches(s.themePalette || 'default');
  byId('s_wallpaperOpacity').value = s.wallpaperOpacity !== undefined ? s.wallpaperOpacity : 35;
  renderSingleImagePreview('wallpaperPreview', liveData.background_image);
  byId('s_bgStyle').value = s.bgStyle || 'dots';
  const bgSavedLabel = byId('bgStyleSavedLabel');
  function updateBgSavedLabel(){
    bgSavedLabel.textContent = `Currently saved & live on the site: "${(liveData.settings && liveData.settings.bgStyle) || 'dots'}". If it looks unchanged after saving, hard-refresh the site tab (Ctrl/Cmd+Shift+R) — browsers cache background images.`;
  }
  updateBgSavedLabel();
  byId('s_bgStyle').onchange = async () => {
    liveData.settings = liveData.settings || {};
    liveData.settings.bgStyle = byId('s_bgStyle').value;
    await saveContent('Background style saved ✓');
    updateBgSavedLabel();
  };
  byId('s_heroLayout').value = s.heroLayout || 'centered';
  byId('s_heroLayout').onchange = async () => {
    liveData.settings = liveData.settings || {};
    liveData.settings.heroLayout = byId('s_heroLayout').value;
    await saveContent('Hero layout saved to draft ✓ — check the Preview panel, then Publish to go live.');
  };
  byId('s_timelineLayout').value = s.timelineLayout || 'vertical';
  byId('s_timelineLayout').onchange = async () => {
    liveData.settings = liveData.settings || {};
    liveData.settings.timelineLayout = byId('s_timelineLayout').value;
    await saveContent('Timeline layout saved ✓');
  };
  byId('s_eggsEnabled').checked = s.eggsEnabled !== false;
  byId('s_eggsEnabled').onchange = async () => {
    liveData.settings = liveData.settings || {};
    liveData.settings.eggsEnabled = byId('s_eggsEnabled').checked;
    await saveContent('Easter eggs setting saved ✓');
  };
  byId('s_quizRewardVideoUrl').value = s.quizRewardVideoUrl || '';
  byId('quizVideoCurrent').textContent = s.quizRewardVideoUrl ? `Current: ${s.quizRewardVideoUrl}` : 'Using the default built-in video.';
  byId('s_cursorStyle').value = s.cursorStyle || 'default';
  byId('s_clockStyle').value = s.clockStyle || 'digital';
  byId('s_cursorTrail').checked = !!s.cursorTrail;
  renderWallpaperPresets();
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

// Keeps a slider's little value-badge in sync live while dragging, so the number
// isn't just a static thing you type — you can see it move as you drag.
function bindSlider(inputId, labelId, initial, unit){
  const input = byId(inputId), label = byId(labelId);
  input.value = initial;
  label.textContent = initial + unit;
  input.addEventListener('input', () => { label.textContent = input.value + unit; });
}

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
    themePalette: (liveData.settings && liveData.settings.themePalette) || 'default',
    wallpaperOpacity: +byId('s_wallpaperOpacity').value,
    bgStyle: (liveData.settings && liveData.settings.bgStyle) || 'dots',
    eggsEnabled: (liveData.settings && liveData.settings.eggsEnabled) !== false,
    quizRewardVideoUrl: byId('s_quizRewardVideoUrl').value.trim(),
    cursorStyle: byId('s_cursorStyle').value,
    clockStyle: byId('s_clockStyle').value,
    cursorTrail: byId('s_cursorTrail').checked,
    recruiterHiddenSections: (liveData.settings && liveData.settings.recruiterHiddenSections) || ['hobbies','connect','achievements','timeline'],
    navVisibleSections: (liveData.settings && liveData.settings.navVisibleSections) || Object.keys(SECTION_LABELS).filter(k => k !== 'contact'),
    availabilityStatus: byId('s_availabilityStatus').value,
    availabilityText: byId('s_availabilityText').value.trim(),
    bookingUrl: byId('s_bookingUrl').value.trim(),
  };
}

/* ====================================================================
   GENERIC REPEATER FACTORY
   Each repeater renders a list of objects as editable cards with a
   remove button, plus an "add" button that appends a blank object.
   ==================================================================== */
function ensureBulkToolbar(wrap, wrapId){
  if (!wrap || wrap.previousElementSibling?.dataset?.bulkToolbarFor === wrapId) return;
  const bar = document.createElement('div');
  bar.className = 'admin-bulk-toolbar';
  bar.dataset.bulkToolbarFor = wrapId;
  bar.innerHTML = `
    <button type="button" data-bulk="expand">⌄ Expand all</button>
    <button type="button" data-bulk="collapse">⌃ Collapse all</button>
  `;
  wrap.parentNode.insertBefore(bar, wrap);
  bar.querySelector('[data-bulk="expand"]').addEventListener('click', () => {
    wrap.querySelectorAll('.admin-repeat-item').forEach(el => el.classList.remove('collapsed'));
  });
  bar.querySelector('[data-bulk="collapse"]').addEventListener('click', () => {
    wrap.querySelectorAll('.admin-repeat-item').forEach(el => el.classList.add('collapsed'));
  });
}

function makeRepeater(opts){
  const { wrapId, dataKey, fields, blank, addBtnId, labelFn } = opts;
  const wrap = document.getElementById(wrapId);
  ensureBulkToolbar(wrap, wrapId);

  function render(){
    const list = liveData[dataKey] || (liveData[dataKey] = []);
    wrap.innerHTML = list.map((item, idx) => `
      <div class="admin-repeat-item collapsed" data-idx="${idx}" draggable="true">
        <div class="admin-repeat-header" data-action="toggle">
          <span class="drag-handle" title="Drag to reorder">⠿</span>
          <span class="admin-repeat-title">${escapeHtml(labelFn ? labelFn(item, idx) : `Item ${idx + 1}`)}</span>
          <span class="admin-repeat-chevron">▾</span>
        </div>
        <button class="admin-remove-btn" data-action="remove">✕</button>
        <div class="admin-repeat-body">
          ${renderFieldsWithGroups(fields, item, idx)}
        </div>
      </div>`).join('') || '<p class="empty-state">Nothing here yet — use the button below to add one.</p>';

    wrap.querySelectorAll('.admin-repeat-item').forEach(itemEl => {
      const idx = +itemEl.dataset.idx;
      itemEl.querySelector('[data-action="remove"]').addEventListener('click', (e) => {
        e.stopPropagation();
        list.splice(idx, 1); render();
      });
      itemEl.querySelector('[data-action="toggle"]').addEventListener('click', () => {
        itemEl.classList.toggle('collapsed');
      });
      const titleEl = itemEl.querySelector('.admin-repeat-title');
      fields.forEach(f => {
        const input = itemEl.querySelector(`[data-field="${f.key}"]`);
        const eventName = f.type === 'checkbox' ? 'change' : 'input';
        input.addEventListener(eventName, () => {
          if (f.type === 'list') list[idx][f.key] = input.value.split('\n').map(s => s.trim()).filter(Boolean);
          else if (f.type === 'metrics') list[idx][f.key] = parseMetrics(input.value);
          else if (f.type === 'number') list[idx][f.key] = +input.value;
          else if (f.type === 'checkbox') list[idx][f.key] = input.checked;
          else list[idx][f.key] = input.value;
          if (labelFn && titleEl) titleEl.textContent = labelFn(list[idx], idx);
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

  function renderFieldsWithGroups(fields, item, idx){
    let html = '';
    let lastGroup = null;
    fields.forEach(f => {
      if (f.group && f.group !== lastGroup){
        html += `<div class="admin-field-group-heading">${escapeHtml(f.group)}</div>`;
        lastGroup = f.group;
      } else if (!f.group){
        lastGroup = null;
      }
      html += fieldHtml(f, item, idx);
    });
    return html;
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
    if (f.type === 'checkbox'){
      return `<div class="admin-field"><label class="admin-checkbox-row"><input type="checkbox" data-field="${f.key}" ${val ? 'checked' : ''} />${f.label}</label></div>`;
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
      { key: 'items', label: 'Skills (one per line). Add ":NN" for a proficiency %, e.g. "Python:92" — plain names still work and default to 80%.', type: 'list' },
    ]
  });

  makeRepeater({
    wrapId: 'projectsRepeatWrap', dataKey: 'projects', addBtnId: 'addProjectBtn',
    blank: { title: 'New project', desc: '', tags: [], date: '', metrics: [], features: [], github: '', demo: '', screenshots: [], approach: '', challenges: '', result: '', lessons: '', featured: false },
    labelFn: (item) => (item.featured ? '★ ' : '') + (item.title || 'Project'),
    fields: [
      { key: 'title', label: 'Title', group: 'Basics', type: 'text' },
      { key: 'featured', label: 'Feature this project as a larger bento tile in the Projects grid', group: 'Basics', type: 'checkbox' },
      { key: 'date', label: 'Date completed (e.g. "Jun 2025") — used to sort projects latest-first', group: 'Basics', type: 'text' },
      { key: 'desc', label: 'Description', group: 'Basics', type: 'textarea' },
      { key: 'tags', label: 'Tags (one per line)', group: 'Basics', type: 'list' },
      { key: 'metrics', label: 'Metrics — one per line as "Label: Value" (e.g. Accuracy: 95%)', group: 'Basics', type: 'metrics' },
      { key: 'features', label: 'Features (one per line)', group: 'Basics', type: 'list' },
      { key: 'approach', label: 'Approach (optional, leave blank to hide)', group: 'Case study (optional)', type: 'textarea' },
      { key: 'challenges', label: 'Challenges faced (optional)', group: 'Case study (optional)', type: 'textarea' },
      { key: 'result', label: 'Result / outcome (optional)', group: 'Case study (optional)', type: 'textarea' },
      { key: 'lessons', label: 'What I learned (optional)', group: 'Case study (optional)', type: 'textarea' },
      { key: 'github', label: 'GitHub link', group: 'Links & media', type: 'text' },
      { key: 'demo', label: 'Live demo link', group: 'Links & media', type: 'text' },
      { key: 'screenshots', label: 'Screenshot image URLs (one per line — upload via Photos tab or paste a link)', group: 'Links & media', type: 'list' },
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

  makeRepeater({
    wrapId: 'connectLinksRepeatWrap', dataKey: 'connectLinks', addBtnId: 'addConnectLinkBtn',
    blank: { emoji: '🔗', label: 'New link', url: '' },
    labelFn: (item) => item.label || 'Connect link',
    fields: [
      { key: 'emoji', label: 'Emoji icon', type: 'text' },
      { key: 'label', label: 'Label (e.g. "Twitter / X")', type: 'text' },
      { key: 'url', label: 'URL', type: 'text' },
    ]
  });

  document.getElementById('resetAppearanceBtn').addEventListener('click', async () => {
    if (!confirm('Reset all appearance settings (sizes, blur, spacing, cursor, background style) to default? Your content is not affected.')) return;
    liveData.settings = JSON.parse(JSON.stringify(SITE_DATA.settings));
    await saveContent('Appearance reset to default ✓');
    populateForms();
  });

  document.getElementById('resetDefaultsBtn').addEventListener('click', async () => {
    if (!confirm('This will load the contents of data.js into your draft for review. It will NOT go live until you hit "🚀 Publish". Continue?')) return;
    liveData = mergeWithDefaults(SITE_DATA);
    await saveContent('data.js defaults loaded into your draft ✓ — review, then hit Publish to go live.');
    populateForms();
    initRepeaters();
  });

  initSectionToggles();
  initRecruiterToggles();
  initNavToggles();
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

function initNavToggles(){
  const wrap = document.getElementById('navTogglesWrap');
  liveData.settings = liveData.settings || {};
  const shown = liveData.settings.navVisibleSections || Object.keys(SECTION_LABELS).filter(k => k !== 'contact');
  wrap.innerHTML = Object.keys(SECTION_LABELS).map(key => `
    <label style="display:flex; align-items:center; gap:10px; padding:8px 0; cursor:pointer;">
      <input type="checkbox" data-nav-toggle="${key}" ${shown.includes(key) ? 'checked' : ''} style="width:18px; height:18px; accent-color:var(--accent-1);" />
      Show "${SECTION_LABELS[key]}" in nav bar
    </label>`).join('');
  wrap.querySelectorAll('[data-nav-toggle]').forEach(cb => {
    cb.addEventListener('change', async () => {
      const key = cb.dataset.navToggle;
      let list = liveData.settings.navVisibleSections || Object.keys(SECTION_LABELS).filter(k => k !== 'contact');
      list = cb.checked ? [...new Set([...list, key])] : list.filter(k => k !== key);
      liveData.settings.navVisibleSections = list;
      await saveContent('Saved ✓');
    });
  });
}

function initRecruiterToggles(){
  const wrap = document.getElementById('recruiterTogglesWrap');
  liveData.settings = liveData.settings || {};
  const hidden = liveData.settings.recruiterHiddenSections || ['hobbies','connect','achievements','timeline'];
  wrap.innerHTML = Object.keys(SECTION_LABELS).filter(k => k !== 'contact').map(key => `
    <label style="display:flex; align-items:center; gap:10px; padding:8px 0; cursor:pointer;">
      <input type="checkbox" data-recruiter-toggle="${key}" ${hidden.includes(key) ? 'checked' : ''} style="width:18px; height:18px; accent-color:var(--accent-1);" />
      Hide "${SECTION_LABELS[key]}" in Recruiter Mode
    </label>`).join('');
  wrap.querySelectorAll('[data-recruiter-toggle]').forEach(cb => {
    cb.addEventListener('change', async () => {
      const key = cb.dataset.recruiterToggle;
      let list = liveData.settings.recruiterHiddenSections || ['hobbies','connect','achievements','timeline'];
      list = cb.checked ? [...new Set([...list, key])] : list.filter(k => k !== key);
      liveData.settings.recruiterHiddenSections = list;
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
const THEME_PALETTES = {
  default:{accent1:'#6ee7d8',accent2:'#a78bfa'}, sunset:{accent1:'#ff9966',accent2:'#ff5e8a'},
  ocean:{accent1:'#38bdf8',accent2:'#6366f1'}, forest:{accent1:'#34d399',accent2:'#0d9488'},
  amber:{accent1:'#fbbf24',accent2:'#d97706'}, rose:{accent1:'#f7b9c4',accent2:'#c2410c'},
  lavender:{accent1:'#c4b5fd',accent2:'#8b5cf6'}, mint:{accent1:'#6ee7b7',accent2:'#10b981'},
  coral:{accent1:'#fb923c',accent2:'#f43f5e'}, slate:{accent1:'#94a3b8',accent2:'#475569'},
  cherry:{accent1:'#fda4af',accent2:'#e11d48'}, emerald:{accent1:'#34d399',accent2:'#059669'},
  cyberpunk:{accent1:'#f0abfc',accent2:'#22d3ee'}, autumn:{accent1:'#f59e0b',accent2:'#b91c1c'},
  arctic:{accent1:'#a5f3fc',accent2:'#0891b2'}, berry:{accent1:'#f472b6',accent2:'#7e22ce'},
  citrus:{accent1:'#fde047',accent2:'#ea580c'}, steel:{accent1:'#7dd3fc',accent2:'#1e3a8a'},
  terracotta:{accent1:'#fdba74',accent2:'#9a3412'}, monochrome:{accent1:'#e5e7eb',accent2:'#6b7280'},
};
function renderThemePaletteSwatches(active){
  const row = document.getElementById('themePaletteRow');
  row.innerHTML = Object.keys(THEME_PALETTES).map(key => {
    const p = THEME_PALETTES[key];
    return `<button type="button" class="theme-swatch-btn ${key === active ? 'active' : ''}" data-key="${key}" title="${key}"
      style="background:linear-gradient(135deg, ${p.accent1}, ${p.accent2});"></button>`;
  }).join('');
  row.querySelectorAll('.theme-swatch-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      liveData.settings = liveData.settings || {};
      liveData.settings.themePalette = btn.dataset.key;
      row.querySelectorAll('.theme-swatch-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      await saveContent('Theme palette saved ✓');
    });
  });
}

const WALLPAPER_PRESETS = [
  { id: 'none', label: 'None', url: '' },
  { id: 'galaxy', label: 'Galaxy', url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=300&q=40' },
  { id: 'nebula', label: 'Nebula', url: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=300&q=40' },
  { id: 'aurora', label: 'Aurora', url: 'https://images.unsplash.com/photo-1483347756197-71ef80e95f73?w=300&q=40' },
  { id: 'mountains', label: 'Mountains', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&q=40' },
  { id: 'abstract', label: 'Abstract waves', url: 'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=300&q=40' },
  { id: 'forest', label: 'Forest', url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=300&q=40' },
  { id: 'ocean', label: 'Ocean', url: 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=300&q=40' },
  { id: 'desert', label: 'Desert dunes', url: 'https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?w=300&q=40' },
  { id: 'city', label: 'City skyline', url: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=300&q=40' },
  { id: 'minimal', label: 'Minimal gray', url: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=300&q=40' },
  { id: 'gradient1', label: 'Gradient blue', url: 'https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?w=300&q=40' },
  { id: 'gradient2', label: 'Gradient pink', url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=300&q=40' },
  { id: 'circuit', label: 'Circuit board', url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=300&q=40' },
  { id: 'code', label: 'Code close-up', url: 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=300&q=40' },
  { id: 'paper', label: 'Paper texture', url: 'https://images.unsplash.com/photo-1517842645767-c639042777db?w=300&q=40' },
  { id: 'marble', label: 'Marble', url: 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=300&q=40' },
  { id: 'rain', label: 'Rainy window', url: 'https://images.unsplash.com/photo-1428592953211-077101b2021b?w=300&q=40' },
  { id: 'snow', label: 'Snowy peaks', url: 'https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=300&q=40' },
  { id: 'autumn', label: 'Autumn leaves', url: 'https://images.unsplash.com/photo-1507783548227-544c3b8fc065?w=300&q=40' },
  { id: 'sunset2', label: 'Sunset clouds', url: 'https://images.unsplash.com/photo-1500817487388-039e623edc21?w=300&q=40' },
];
function presetFullUrl(thumbUrl){
  return thumbUrl ? thumbUrl.replace('w=300&q=40', 'w=1600&q=65') : '';
}
function renderWallpaperPresets(){
  const row = document.getElementById('wallpaperPresetsRow');
  row.innerHTML = WALLPAPER_PRESETS.map(p => `
    <button type="button" class="wallpaper-preset-btn" data-url="${p.url}" title="${p.label}">
      ${p.url ? `<img src="${p.url}" alt="${p.label}" loading="lazy" />` : '<span class="preset-none">✕</span>'}
    </button>`).join('');
  row.querySelectorAll('.wallpaper-preset-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const fullUrl = presetFullUrl(btn.dataset.url);
      liveData.background_image = fullUrl;
      renderSingleImagePreview('wallpaperPreview', fullUrl);
      await saveContent(fullUrl ? 'Wallpaper preset applied ✓' : 'Wallpaper removed ✓');
    });
  });
}
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
      await saveContent('Résumé updated in draft ✓ — hit Publish to make it live.');
    }
    e.target.value = '';
  });

  document.getElementById('quizVideoUploadInput').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const status = document.getElementById('quizVideoUploadStatus');
    const url = await uploadFile(file, status);
    if (url){
      liveData.settings = liveData.settings || {};
      liveData.settings.quizRewardVideoUrl = url;
      byId('s_quizRewardVideoUrl').value = url;
      byId('quizVideoCurrent').textContent = `Current: ${url}`;
      await saveContent('Quiz reward video updated ✓ — plays locally now, no YouTube embed needed');
    }
    e.target.value = '';
  });

  document.getElementById('clearQuizVideoBtn').addEventListener('click', async () => {
    liveData.settings = liveData.settings || {};
    liveData.settings.quizRewardVideoUrl = '';
    byId('s_quizRewardVideoUrl').value = '';
    byId('quizVideoCurrent').textContent = 'Using the default built-in video.';
    await saveContent('Reset to default reward video ✓');
  });

  byId('s_quizRewardVideoUrl').addEventListener('change', async () => {
    liveData.settings = liveData.settings || {};
    liveData.settings.quizRewardVideoUrl = byId('s_quizRewardVideoUrl').value.trim();
    byId('quizVideoCurrent').textContent = liveData.settings.quizRewardVideoUrl ? `Current: ${liveData.settings.quizRewardVideoUrl}` : 'Using the default built-in video.';
    await saveContent('Reward video URL saved ✓');
  });

  byId('s_cursorStyle').addEventListener('change', async () => {
    liveData.settings = liveData.settings || {};
    liveData.settings.cursorStyle = byId('s_cursorStyle').value;
    await saveContent('Cursor style saved ✓');
  });

  byId('s_clockStyle').addEventListener('change', async () => {
    liveData.settings = liveData.settings || {};
    liveData.settings.clockStyle = byId('s_clockStyle').value;
    await saveContent('Clock style saved ✓');
  });

  byId('s_cursorTrail').addEventListener('change', async () => {
    liveData.settings = liveData.settings || {};
    liveData.settings.cursorTrail = byId('s_cursorTrail').checked;
    await saveContent('Cursor trail setting saved ✓');
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
  document.getElementById('publishAllBtn').addEventListener('click', async () => {
    if (!confirm('Publish your current draft? This makes it live for every visitor immediately.')) return;
    collectSimpleFields();
    await publishContent();
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
