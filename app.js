// app.js — main public site (read-only content + interactions).
// All editing now happens in admin.html, which writes to the same Supabase
// row this file reads from. There is no editing UI on this page anymore.
document.getElementById('year').textContent = new Date().getFullYear();

/* ====================================================================
   0. SUPABASE BOOTSTRAP (read-only here)
   ==================================================================== */
let supa = null;
let liveData = null;

function supabaseReady(){
  return typeof SUPABASE_URL === 'string' && SUPABASE_URL.length > 5 &&
         typeof SUPABASE_ANON_KEY === 'string' && SUPABASE_ANON_KEY.length > 5 &&
         window.supabase;
}

async function loadContent(){
  if (supabaseReady()){
    supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await supa.from('site_content').select('content').eq('id', 'main').single();
    if (!error && data && data.content){
      liveData = mergeWithDefaults(data.content);
      return;
    }
    // no row yet -> seed it with data.js defaults
    await supa.from('site_content').upsert({ id: 'main', content: SITE_DATA });
    liveData = SITE_DATA;
    return;
  }
  const cached = localStorage.getItem('site_content_cache');
  liveData = cached ? mergeWithDefaults(JSON.parse(cached)) : SITE_DATA;
}

// Live sync: whenever admin.html saves, this pushes the update to any open
// index.html tab within ~1 second, no reload needed. Requires realtime enabled
// on the site_content table (see supabase_schema.sql — one-time setup).
function initLiveSync(){
  if (!supa) return;
  supa.channel('site_content_live')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'site_content', filter: 'id=eq.main' }, (payload) => {
      if (!payload.new || !payload.new.content) return;
      liveData = mergeWithDefaults(payload.new.content);
      applySettings();
      renderAll();
      renderNavLinks();
    })
    .subscribe();
}

// Ensures older saved content (from before new fields existed) doesn't break
// rendering — anything missing falls back to the data.js seed shape.
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
   1. APPLY SETTINGS AS CSS VARIABLES
   ==================================================================== */
/* ====================================================================
   1b. THEME PALETTE PRESETS (separate from light/dark — these recolor accents)
   ==================================================================== */
const THEME_PALETTES = {
  default:   { name: 'Default (Aqua/Violet)', accent1: '#6ee7d8', accent2: '#a78bfa' },
  sunset:    { name: 'Sunset',                 accent1: '#ff9966', accent2: '#ff5e8a' },
  ocean:     { name: 'Ocean',                  accent1: '#38bdf8', accent2: '#6366f1' },
  forest:    { name: 'Forest',                 accent1: '#34d399', accent2: '#0d9488' },
  amber:     { name: 'Amber Gold',             accent1: '#fbbf24', accent2: '#d97706' },
  rose:      { name: 'Rose Gold',              accent1: '#f7b9c4', accent2: '#c2410c' },
  lavender:  { name: 'Lavender',               accent1: '#c4b5fd', accent2: '#8b5cf6' },
  mint:      { name: 'Mint Fresh',             accent1: '#6ee7b7', accent2: '#10b981' },
  coral:     { name: 'Coral Reef',             accent1: '#fb923c', accent2: '#f43f5e' },
  slate:     { name: 'Slate Mono',             accent1: '#94a3b8', accent2: '#475569' },
  cherry:    { name: 'Cherry Blossom',         accent1: '#fda4af', accent2: '#e11d48' },
  emerald:   { name: 'Emerald',                accent1: '#34d399', accent2: '#059669' },
  cyberpunk: { name: 'Cyberpunk',              accent1: '#f0abfc', accent2: '#22d3ee' },
  autumn:    { name: 'Autumn Leaves',          accent1: '#f59e0b', accent2: '#b91c1c' },
  arctic:    { name: 'Arctic',                 accent1: '#a5f3fc', accent2: '#0891b2' },
  berry:     { name: 'Berry',                  accent1: '#f472b6', accent2: '#7e22ce' },
  citrus:    { name: 'Citrus',                 accent1: '#fde047', accent2: '#ea580c' },
  steel:     { name: 'Steel Blue',             accent1: '#7dd3fc', accent2: '#1e3a8a' },
  terracotta:{ name: 'Terracotta',             accent1: '#fdba74', accent2: '#9a3412' },
  monochrome:{ name: 'Monochrome',             accent1: '#e5e7eb', accent2: '#6b7280' },
};
function applyThemePalette(){
  const key = (liveData.settings && liveData.settings.themePalette) || 'default';
  const palette = THEME_PALETTES[key] || THEME_PALETTES.default;
  document.documentElement.style.setProperty('--accent-1', palette.accent1);
  document.documentElement.style.setProperty('--accent-2', palette.accent2);
}

/* ====================================================================
   CURSOR STYLES (admin-configurable, always off in Recruiter Mode)
   ==================================================================== */
let cursorEl = null, cursorRAF = null, cursorTargetX = 0, cursorTargetY = 0, cursorX = 0, cursorY = 0;
function ensureCursorEl(){
  if (cursorEl) return cursorEl;
  cursorEl = document.createElement('div');
  cursorEl.id = 'customCursor';
  document.body.appendChild(cursorEl);
  window.addEventListener('mousemove', e => { cursorTargetX = e.clientX; cursorTargetY = e.clientY; });
  function loop(){
    // Lerp toward the pointer — gives every style a smooth, slightly trailing feel
    // instead of snapping frame-to-frame.
    cursorX += (cursorTargetX - cursorX) * 0.25;
    cursorY += (cursorTargetY - cursorY) * 0.25;
    if (cursorEl) cursorEl.style.transform = `translate(${cursorX}px, ${cursorY}px) translate(-50%, -50%)`;
    cursorRAF = requestAnimationFrame(loop);
  }
  loop();
  return cursorEl;
}
function applyCursorSettings(){
  const s = liveData.settings || {};
  const recruiterOn = document.body.classList.contains('recruiter-mode');
  const style = (!recruiterOn && s.cursorStyle) || 'default';
  document.body.classList.remove('custom-cursor-active');
  document.body.classList.toggle('custom-cursor-active', style !== 'default');
  if (style !== 'default'){
    const el = ensureCursorEl();
    el.className = `cursor-style-${style}`;
  } else if (cursorEl){
    cursorEl.className = '';
  }
}

function applySettings(){
  window.__liveDataRef = liveData;
  const s = liveData.settings || SITE_DATA.settings;
  const root = document.documentElement.style;

  // bg-style body class for CSS aurora variants
  document.body.classList.remove('bg-space','bg-nebula');
  if (s.bgStyle === 'space') document.body.classList.add('bg-space');
  if (s.bgStyle === 'nebula') document.body.classList.add('bg-nebula');
  // hero layout variant — "split" gives a full-bleed photo half instead
  // of the default centered/card style; purely a CSS reflow of the same markup
  document.body.classList.toggle('hero-split', s.heroLayout === 'split');
  root.setProperty('--icon-btn-size', (s.iconButtonSize || 36) + 'px');
  root.setProperty('--avatar-size', (s.avatarSize || 320) + 'px');
  root.setProperty('--card-radius', (s.cardRadius || 18) + 'px');
  root.setProperty('--glass-blur', (s.glassBlur || 18) + 'px');
  root.setProperty('--section-spacing', (s.sectionSpacing || 130) + 'px');
  applyThemePalette();
  applyCursorSettings();

  const wallpaper = document.getElementById('wallpaper');
  if (wallpaper){
    if (liveData.background_image){
      wallpaper.style.backgroundImage = `url("${liveData.background_image}")`;
      root.setProperty('--wallpaper-opacity', ((s.wallpaperOpacity !== undefined ? s.wallpaperOpacity : 35) / 100));
      wallpaper.classList.add('show');
    } else {
      wallpaper.classList.remove('show');
    }
  }
}

/* ====================================================================
   2. RENDER SECTIONS FROM liveData
   ==================================================================== */
function renderAll(){
  document.querySelectorAll('[data-edit="hero_name"]').forEach(el => el.textContent = liveData.hero_name);
  document.querySelectorAll('[data-edit="hero_sub"]').forEach(el => el.textContent = liveData.hero_sub);
  document.querySelectorAll('[data-edit="about_text"]').forEach(el => el.innerHTML = liveData.about_text_html);
  document.querySelectorAll('[data-edit="linkedin_blurb"]').forEach(el => el.textContent = liveData.linkedin_blurb);

  // Skills — animated proficiency bars. Backward-compatible: plain skill
  // names ("Python") still work and get a sensible default bar level;
  // optionally add ":NN" per line ("Python:92") to set an exact level.
  const skillsGrid = document.getElementById('skillsGrid');
  skillsGrid.innerHTML = liveData.skills.map(group => `
    <div class="glass skill-card panel reveal reveal-zoom tilt-card">
      <h4>${esc(group.category)}</h4>
      <div class="skill-bars">${group.items.map(raw => {
        const parsed = parseSkillLevel(raw);
        return `<div class="skill-bar-row">
          <div class="skill-bar-label"><span>${esc(parsed.name)}</span><span class="skill-bar-pct">${parsed.level}%</span></div>
          <div class="skill-bar-track"><div class="skill-bar-fill" data-level="${parsed.level}" style="width:0%"></div></div>
        </div>`;
      }).join('')}</div>
    </div>`).join('');

  // Projects — sorted by date (latest first); undated ones keep their relative order at the end.
  // Bento-grid: projects explicitly marked "featured" (or, if none are marked,
  // the most recent one) render as a larger tile to visually signal best work.
  const projectsGrid = document.getElementById('projectsGrid');
  const sortedProjects = sortByDateDesc(liveData.projects, p => p.date);
  const anyExplicitlyFeatured = sortedProjects.some(({ item }) => item.featured);
  projectsGrid.innerHTML = sortedProjects.map(({ item: p, idx }, i) => {
    const isFeatured = anyExplicitlyFeatured ? !!p.featured : i === 0;
    return `
    <div class="glass project-card panel reveal tilt-card card-clickable ${isFeatured ? 'project-card-featured' : ''} ${i % 2 === 0 ? 'reveal-left' : 'reveal-right'}" data-index="${idx}" tabindex="0" role="button" aria-label="Open full details for ${esc(p.title)}">
      ${isFeatured ? '<span class="project-featured-tag">★ Featured</span>' : ''}
      <div class="project-card-top">
        <h3>${esc(p.title)}</h3>
        <span class="cert-arrow" aria-hidden="true">→</span>
      </div>
      <p class="card-preview-desc">${esc(p.desc)}</p>
      <div class="project-tags">${(p.tags||[]).slice(0, isFeatured ? 6 : 4).map(t => `<span>${esc(t)}</span>`).join('')}</div>
    </div>`;
  }).join('');

  // Certifications — grouped by issuer, each group sorted by year (latest first)
  const certsList = document.getElementById('certsList');
  const sortedCerts = sortByDateDesc(liveData.certifications, c => c.year);
  const certGroups = {};
  sortedCerts.forEach(({ item: c, idx }) => {
    const key = c.issuer || 'Other';
    (certGroups[key] = certGroups[key] || []).push({ item: c, idx });
  });
  certsList.innerHTML = Object.keys(certGroups).map(issuer => `
    <div class="cert-issuer-group">
      <h4 class="cert-issuer-heading">${esc(issuer)} <span class="cert-issuer-count">${certGroups[issuer].length}</span></h4>
      <div class="cert-issuer-items">
        ${certGroups[issuer].map(({ item: c, idx }) => `
          <div class="glass cert-item panel reveal card-clickable" data-index="${idx}" tabindex="0" role="button" aria-label="View certificate for ${esc(c.name)}">
            <div class="cert-badge">✓</div>
            <div class="cert-name">${esc(c.name)}</div>
            <span class="cert-year">${esc(c.year)}</span>
            <span class="cert-arrow" aria-hidden="true">→</span>
          </div>`).join('')}
      </div>
    </div>`).join('');

  // Hobbies
  const hobbiesRow = document.getElementById('hobbiesRow');
  hobbiesRow.innerHTML = liveData.hobbies.map(h => `
    <div class="hobby-chip reveal"><span class="hobby-emoji">${h.emoji}</span>${esc(h.label)}</div>`).join('');

  // Education + Languages — education sorted latest-first
  const eduList = document.getElementById('eduList');
  if (eduList){
    const sortedEdu = sortByDateDesc(liveData.education, e => e.period).map(x => x.item);
    eduList.innerHTML = sortedEdu.map(e => `
      <div class="edu-item">
        <div class="edu-top"><strong>${esc(e.degree)}</strong><span>${esc(e.period)}</span></div>
        <p>${esc(e.school)}${e.detail ? ' · ' + esc(e.detail) : ''}</p>
      </div>`).join('') || '';
  }
  const langBars = document.getElementById('langBars');
  if (langBars){
    langBars.innerHTML = (liveData.languages || []).map(l => `
      <div class="lang-row"><span>${esc(l.name)}</span><div class="bar"><div style="width:${l.level}%"></div></div></div>`).join('');
  }

  // Experience — sorted latest-first
  const expList = document.getElementById('experienceList');
  if (expList){
    const sortedExp = sortByDateDesc(liveData.experience, e => e.period).map(x => x.item);
    expList.innerHTML = sortedExp.length ? sortedExp.map(e => `
      <div class="experience-item reveal">
        <span class="experience-dot"></span>
        <div class="experience-body">
          <h4>${esc(e.role)} · ${esc(e.org)}</h4>
          <p class="exp-meta">${esc(e.period)}</p>
          <p>${esc(e.desc || '')}</p>
        </div>
      </div>`).join('') : '';
  }

  // Achievements
  const achGrid = document.getElementById('achievementsGrid');
  if (achGrid){
    const achievements = liveData.achievements || [];
    achGrid.innerHTML = achievements.length ? achievements.map(a => `
      <div class="glass achievement-card panel reveal reveal-zoom tilt-card">
        <span class="achievement-icon">🏆</span>
        <div><h4>${esc(a.title)}</h4><p>${esc(a.desc || '')}</p>${a.year ? `<span class="achievement-year">${esc(a.year)}</span>` : ''}</div>
      </div>`).join('') : '';
  }

  // Publications
  const pubList = document.getElementById('publicationsList');
  if (pubList){
    const publications = liveData.publications || [];
    pubList.innerHTML = publications.length ? publications.map(p => `
      <div class="glass publication-item panel reveal">
        <div class="publication-main"><h4>${esc(p.title)}</h4><p>${esc(p.venue || '')}${p.year ? ' · ' + esc(p.year) : ''}</p></div>
        ${p.link ? `<a href="${esc(p.link)}" target="_blank" rel="noopener" class="btn btn-glass">Read ↗</a>` : ''}
      </div>`).join('') : '';
  }

  const resumeBtn = document.getElementById('resumeDownloadBtn');
  if (resumeBtn && liveData.resume_url) resumeBtn.href = liveData.resume_url;

  renderTimeline();
  renderYoutubeCard();
  renderConnectLinks();
  renderCustomSections();
  applySectionVisibility();
  applyEggsVisibility();
  applySectionMeta();
  initReveal();
}

function esc(str){
  if (str === undefined || str === null) return '';
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Parses freeform date text like "Jun 2025 – Aug 2025", "2021 – 2026",
// "Jul 2024", "Present" into a sortable number (bigger = more recent).
// Uses the LAST date mentioned (the end of a range) so ongoing/ranges sort correctly.
function parseDateKey(text){
  if (!text) return -1;
  const t = String(text).toLowerCase();
  if (/present|current|ongoing|\bnow\b/.test(t)) return 999999;
  const monthMap = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
  const matches = [...t.matchAll(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(\d{4})|(\d{4})/g)];
  if (!matches.length) return -1;
  const last = matches[matches.length - 1];
  if (last[3]) return (+last[3]) * 100;
  return (+last[2]) * 100 + (monthMap[last[1].slice(0,3)] || 0);
}

// Sorts an array by date (descending, latest first) without mutating the
// original — returns [{item, idx}] where idx is the ORIGINAL array index,
// so popups/admin edits referencing that index still work correctly.
function sortByDateDesc(arr, getText){
  return (arr || []).map((item, idx) => ({ item, idx }))
    .sort((a, b) => parseDateKey(getText(b.item)) - parseDateKey(getText(a.item)));
}

/* ====================================================================
   2b. TIMELINE (merges education + experience + achievements)
   ==================================================================== */
function renderTimeline(){
  const track = document.getElementById('timelineTrack');
  if (!track) return;
  const items = [];
  (liveData.education || []).forEach(e => items.push({ tag: 'Education', period: e.period, title: e.degree, desc: e.school + (e.detail ? ' · ' + e.detail : '') }));
  (liveData.experience || []).forEach(e => items.push({ tag: 'Experience', period: e.period, title: `${e.role} · ${e.org}`, desc: e.desc || '' }));
  (liveData.achievements || []).forEach(a => items.push({ tag: 'Achievement', period: a.year || '', title: a.title, desc: a.desc || '' }));

  if (!items.length){
    track.innerHTML = '';
    return;
  }
  items.sort((a, b) => parseDateKey(b.period) - parseDateKey(a.period));
  const horizontal = (liveData.settings && liveData.settings.timelineLayout === 'horizontal');
  track.classList.toggle('timeline-track-horizontal', horizontal);
  track.innerHTML = items.map((it, i) => `
    <div class="timeline-node reveal ${horizontal ? 'reveal-zoom' : 'reveal-left'}">
      <span class="tl-tag">${esc(it.tag)}</span>
      <div class="tl-period">${esc(it.period)}</div>
      <h4>${esc(it.title)}</h4>
      <p>${esc(it.desc)}</p>
    </div>`).join('');
}

/* ====================================================================
   2c. YOUTUBE CARD
   ==================================================================== */
function renderYoutubeCard(){
  const banner = document.getElementById('ytBannerImg');
  const logo = document.getElementById('ytLogoImg');
  const subs = document.getElementById('ytSubs');
  banner.style.display = '';
  document.getElementById('ytBanner').classList.remove('yt-banner-fallback');
  if (liveData.youtube_banner) banner.src = liveData.youtube_banner;
  else { banner.style.display = 'none'; document.getElementById('ytBanner').classList.add('yt-banner-fallback'); }
  if (liveData.youtube_logo) logo.src = liveData.youtube_logo;
  subs.textContent = liveData.youtube_subs ? `${liveData.youtube_subs} subscribers` : '';
}

/* ====================================================================
   3. ROLE CYCLER (hero subtitle word swap)
   ==================================================================== */
function startRoleCycler(){
  const el = document.getElementById('roleCycler');
  let i = 0;
  setInterval(() => {
    const roles = (liveData && liveData.roles && liveData.roles.length) ? liveData.roles : SITE_DATA.roles;
    i = (i + 1) % roles.length;
    el.style.opacity = 0;
    setTimeout(() => {
      el.textContent = roles[i];
      el.style.opacity = 1;
    }, 280);
  }, 2800);
  el.style.transition = 'opacity .28s ease';
}

/* ====================================================================
   4. ANIMATED CONSTELLATION BACKGROUND
   ==================================================================== */
function initConstellation(){
  const canvas = document.getElementById('constellation');
  const ctx = canvas.getContext('2d');
  let w, h, nodes = [], stars = [], nebulae = [];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function getThemeColors(){
    const styles = getComputedStyle(document.documentElement);
    return {
      line: styles.getPropertyValue('--line-color').trim() || '120,180,200',
      node: styles.getPropertyValue('--node-color').trim() || '160,220,210'
    };
  }
  let colors = getThemeColors();
  window.addEventListener('themechange', () => { colors = getThemeColors(); });

  function style(){ return (window.__liveDataRef && window.__liveDataRef.settings && window.__liveDataRef.settings.bgStyle) || 'dots'; }

  function resize(){ w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
  function makeDots(){
    const COUNT = window.innerWidth < 760 ? 35 : 70;
    nodes = Array.from({length: COUNT}, () => ({
      x: Math.random()*w, y: Math.random()*h,
      vx: (Math.random()-0.5)*0.25, vy: (Math.random()-0.5)*0.25,
      r: Math.random()*1.6 + 0.6
    }));
  }
  function makeStars(){
    // 3 depth layers -> real parallax feel as scrollY shifts them at different rates
    stars = [];
    const layers = [
      { count: 90, r: [0.5,1.1], speed: 0.02, parallax: 0.05 },
      { count: 50, r: [1.0,1.8], speed: 0.05, parallax: 0.12 },
      { count: 25, r: [1.6,2.6], speed: 0.09, parallax: 0.22 },
    ];
    layers.forEach((layer, li) => {
      for (let i=0;i<layer.count;i++){
        stars.push({ x: Math.random()*w, y: Math.random()*h, r: layer.r[0]+Math.random()*(layer.r[1]-layer.r[0]),
          twinkle: Math.random()*Math.PI*2, layer: li, parallax: layer.parallax, drift: layer.speed });
      }
    });
  }
  function makeNebulae(){
    nebulae = Array.from({length: 4}, () => ({
      x: Math.random()*w, y: Math.random()*h, r: 180 + Math.random()*220,
      hue: [170, 260, 320, 200][Math.floor(Math.random()*4)],
      parallax: 0.03 + Math.random()*0.05
    }));
  }
  resize(); makeDots(); makeStars(); makeNebulae();
  window.addEventListener('resize', () => { resize(); makeDots(); makeStars(); makeNebulae(); });

  function drawDots(){
    ctx.clearRect(0,0,w,h);
    for (const n of nodes){
      if (!reduceMotion){ n.x += n.vx; n.y += n.vy; }
      if (n.x < 0 || n.x > w) n.vx *= -1;
      if (n.y < 0 || n.y > h) n.vy *= -1;
    }
    for (let i=0; i<nodes.length; i++){
      for (let j=i+1; j<nodes.length; j++){
        const a = nodes[i], b = nodes[j];
        const dist = Math.hypot(a.x-b.x, a.y-b.y);
        if (dist < 150){
          ctx.strokeStyle = `rgba(${colors.line},${0.12 * (1 - dist/150)})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
        }
      }
    }
    for (const n of nodes){
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(${colors.node},0.6)`; ctx.fill();
    }
  }
  function drawSpace(t){
    ctx.clearRect(0,0,w,h);
    const scrollY = window.scrollY || 0;
    stars.forEach(s => {
      if (!reduceMotion) s.x -= s.drift;
      if (s.x < -5) s.x = w + 5;
      const yOffset = scrollY * s.parallax * 0.5;
      const y = (s.y + yOffset) % (h + 40) - 20;
      const tw = 0.5 + 0.5 * Math.sin(t/500 + s.twinkle);
      ctx.beginPath();
      ctx.arc(s.x, y, s.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(${colors.node},${0.35 + tw*0.5})`;
      ctx.fill();
    });
  }
  function drawNebula(t){
    ctx.clearRect(0,0,w,h);
    const scrollY = window.scrollY || 0;
    nebulae.forEach((n, i) => {
      const yOffset = scrollY * n.parallax;
      const y = n.y + yOffset * 0.4 + Math.sin(t/4000 + i) * 12;
      const x = n.x + Math.cos(t/5000 + i) * 16;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, n.r);
      grad.addColorStop(0, `hsla(${n.hue},70%,65%,0.10)`);
      grad.addColorStop(1, 'hsla(0,0%,0%,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(x, y, n.r, 0, Math.PI*2); ctx.fill();
    });
    drawSpace(t);
  }

  function tick(t){
    const s = style();
    if (s === 'space') drawSpace(t || 0);
    else if (s === 'nebula') drawNebula(t || 0);
    else drawDots();
    requestAnimationFrame(tick);
  }

  // Click a star/comet/nebula cloud (only visible in the Space/Nebula background styles) to trigger a surprise.
  canvas.addEventListener('click', e => {
    const s = style();
    if (s !== 'space' && s !== 'nebula') return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    const scrollY = window.scrollY || 0;
    if (s === 'space'){
      for (const st of stars){
        const y = (st.y + scrollY * st.parallax * 0.5) % (h + 40) - 20;
        if (Math.hypot(st.x - cx, y - cy) < Math.max(14, st.r * 5)){ fireGimmick(); return; }
      }
    } else {
      for (const n of nebulae){
        const y = n.y + scrollY * n.parallax * 0.4;
        if (Math.hypot(n.x - cx, y - cy) < n.r * 0.5){ fireGimmick(); return; }
      }
    }
  });
  tick();
}

/* ====================================================================
   5. SCROLL REVEAL + STAT COUNTERS
   ==================================================================== */
function initReveal(){
  const els = document.querySelectorAll('.reveal');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      e.target.classList.toggle('in', e.isIntersecting);
    });
  }, { threshold: 0.12 });
  els.forEach(el => obs.observe(el));
  initSkillBarAnimation();
}

function parseSkillLevel(raw){
  const str = String(raw || '').trim();
  const match = str.match(/^(.*?):(\d{1,3})$/);
  if (match){
    const level = Math.min(100, Math.max(0, parseInt(match[2], 10)));
    return { name: match[1].trim(), level };
  }
  return { name: str, level: 80 };
}

function initSkillBarAnimation(){
  const bars = document.querySelectorAll('.skill-bar-fill:not([data-animated])');
  if (!bars.length) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.dataset.animated = '1';
      requestAnimationFrame(() => { el.style.width = el.dataset.level + '%'; });
      obs.unobserve(el);
    });
  }, { threshold: 0.3 });
  bars.forEach(bar => obs.observe(bar));
}

function initCounters(){
  // Pull real counts from the actual content instead of hardcoded numbers
  const statProjects = document.getElementById('statProjects');
  const statCerts = document.getElementById('statCerts');
  const statLangs = document.getElementById('statLangs');
  if (statProjects) statProjects.dataset.count = (liveData.projects || []).length;
  if (statCerts) statCerts.dataset.count = (liveData.certifications || []).length;
  if (statLangs) statLangs.dataset.count = (liveData.languages || []).length;

  document.querySelectorAll('.stat-num').forEach(el => {
    const target = parseInt(el.dataset.count, 10);
    let current = 0;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting){
        const step = Math.max(1, Math.ceil(target/40));
        const iv = setInterval(() => {
          current += step;
          if (current >= target){ current = target; clearInterval(iv); }
          el.textContent = current;
        }, 30);
        obs.disconnect();
      }
    }, { threshold: 0.4 });
    obs.observe(el);
  });
}

/* ====================================================================
   6. LIVE GITHUB REPOSITORIES
   ==================================================================== */
const LANG_COLORS = {
  Python:'#3572A5', JavaScript:'#f1e05a', Java:'#b07219', HTML:'#e34c26',
  CSS:'#563d7c', Jupyter:'#DA5B0B', 'Jupyter Notebook':'#DA5B0B', TypeScript:'#2b7489', default:'#8b949e'
};

async function loadGithubRepos(){
  const grid = document.getElementById('reposGrid');
  const status = document.getElementById('githubStatus');
  const statsStrip = document.getElementById('githubStatsStrip');
  const username = liveData.github_username || 'Yashraj2523';
  try{
    const [userRes, reposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`),
      fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=8`)
    ]);
    const user = userRes.ok ? await userRes.json() : null;
    const repos = reposRes.ok ? await reposRes.json() : [];

    if (user){
      const allRepos = await fetch(`https://api.github.com/users/${username}/repos?per_page=100`).then(r => r.ok ? r.json() : []);
      const totalStars = Array.isArray(allRepos) ? allRepos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0) : 0;
      statsStrip.innerHTML = `
        <div class="gh-stat"><span class="gh-stat-num">${user.public_repos ?? '—'}</span><span class="gh-stat-label">Repositories</span></div>
        <div class="gh-stat"><span class="gh-stat-num">${totalStars}</span><span class="gh-stat-label">Total stars</span></div>
        <div class="gh-stat"><span class="gh-stat-num">${user.followers ?? '—'}</span><span class="gh-stat-label">Followers</span></div>
        <div class="gh-stat"><span class="gh-stat-num">${user.following ?? '—'}</span><span class="gh-stat-label">Following</span></div>`;
    }

    if (!Array.isArray(repos) || repos.length === 0){
      status.textContent = 'No public repositories found yet.';
      grid.innerHTML = '';
      return;
    }
    status.textContent = `Showing ${repos.length} most recently updated public repositories — live from GitHub.`;
    grid.innerHTML = repos.map(r => `
      <div class="glass repo-card panel reveal tilt-card">
        <div class="repo-top">
          <span class="repo-name">${esc(r.name)}</span>
          <span style="color:var(--ink-2); font-size:.78rem;">★ ${r.stargazers_count}</span>
        </div>
        <p class="repo-desc">${r.description ? esc(r.description) : 'No description provided.'}</p>
        <div class="repo-meta">
          ${r.language ? `<span><span class="repo-lang-dot" style="background:${LANG_COLORS[r.language] || LANG_COLORS.default}"></span>${esc(r.language)}</span>` : ''}
          <span>Updated ${new Date(r.pushed_at).toLocaleDateString('en-IN', {month:'short', year:'numeric'})}</span>
        </div>
        <a class="project-link" href="${r.html_url}" target="_blank" rel="noopener">Open repository ↗</a>
      </div>`).join('');
    initReveal();
    initTiltCards();
  } catch(err){
    status.textContent = 'Could not reach GitHub right now — showing cached project list above instead.';
    grid.innerHTML = '';
    console.error(err);
  }
}

/* ====================================================================
   7. THEME TOGGLE (light/dark, persisted)
   ==================================================================== */
function initTheme(){
  const root = document.documentElement;
  const saved = localStorage.getItem('site_theme');
  const media = window.matchMedia('(prefers-color-scheme: light)');
  const initial = saved || (media.matches ? 'light' : 'dark');
  applyTheme(initial, true);

  document.getElementById('themeToggle').addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    crossFadeTheme(next);
    localStorage.setItem('site_theme', next);
  });

  // Live-follow the OS theme if the visitor hasn't manually chosen one yet
  media.addEventListener('change', (e) => {
    if (localStorage.getItem('site_theme')) return; // respect explicit user choice
    crossFadeTheme(e.matches ? 'light' : 'dark');
  });
}

function crossFadeTheme(next){
  const overlay = getThemeFadeOverlay();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion){ applyTheme(next); return; }
  overlay.style.opacity = '1';
  setTimeout(() => {
    applyTheme(next);
    requestAnimationFrame(() => { overlay.style.opacity = '0'; });
  }, 180);
}
function getThemeFadeOverlay(){
  let el = document.getElementById('themeFadeOverlay');
  if (!el){
    el = document.createElement('div');
    el.id = 'themeFadeOverlay';
    document.body.appendChild(el);
  }
  return el;
}

function applyTheme(theme, isInitial){
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('themeIconMoon').style.display = theme === 'light' ? 'block' : 'none';
  document.getElementById('themeIconSun').style.display = theme === 'light' ? 'none' : 'block';
  document.querySelector('meta[name="theme-color"]').setAttribute('content', theme === 'light' ? '#eef2f7' : '#0a0d14');
  window.dispatchEvent(new Event('themechange'));
}

/* ====================================================================
   8. BACK TO TOP
   ==================================================================== */
function initBackToTop(){
  const btn = document.getElementById('backToTop');
  window.addEventListener('scroll', () => { btn.classList.toggle('hidden', window.scrollY < 500); });
  btn.addEventListener('click', () => window.scrollTo({top:0, behavior:'smooth'}));
}

/* ====================================================================
   9. COPY EMAIL
   ==================================================================== */
function initCopyEmail(){
  const btn = document.getElementById('copyEmailBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(liveData.email || 'yashwanthriya25@gmail.com');
    const original = btn.textContent;
    btn.textContent = '✓ Copied!';
    setTimeout(() => btn.textContent = original, 1800);
  });
}

/* ====================================================================
   10. PROFILE PHOTO SLIDESHOW (with prev/next arrows + swipe)
   ==================================================================== */
let slideTimer = null;
function initSlideshow(){
  const root = document.getElementById('profileSlideshow');
  const track = document.getElementById('slideshowTrack');
  const dotsWrap = document.getElementById('slideshowDots');
  const prevBtn = document.getElementById('slidePrev');
  const nextBtn = document.getElementById('slideNext');
  const photos = (liveData.profile_photos && liveData.profile_photos.length) ? liveData.profile_photos : SITE_DATA.profile_photos;
  let current = 0;

  track.innerHTML = photos.map((src, i) => `
    <div class="slide ${i === 0 ? 'active' : ''}" data-i="${i}">
      <img src="${esc(src)}" alt="Profile photo ${i+1}" loading="${i === 0 ? 'eager' : 'lazy'}"
           onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 200 200%27%3E%3Crect width=%27200%27 height=%27200%27 fill=%27%23222a38%27/%3E%3Ctext x=%27100%27 y=%27106%27 font-size=%2718%27 fill=%27%236ee7d8%27 text-anchor=%27middle%27 font-family=%27Arial%27%3EPhoto missing%3C/text%3E%3C/svg%3E'" />
    </div>`).join('');
  dotsWrap.innerHTML = photos.map((_, i) => `<button class="slide-dot ${i===0?'active':''}" data-i="${i}" aria-label="Show photo ${i+1}"></button>`).join('');

  function goTo(i){
    current = (i + photos.length) % photos.length;
    track.querySelectorAll('.slide').forEach(s => s.classList.toggle('active', +s.dataset.i === current));
    dotsWrap.querySelectorAll('.slide-dot').forEach(d => d.classList.toggle('active', +d.dataset.i === current));
  }
  function next(){ goTo(current + 1); }
  function prev(){ goTo(current - 1); }
  function restartTimer(){ clearInterval(slideTimer); slideTimer = setInterval(next, 4200); }
  restartTimer();

  if (photos.length > 1){
    root.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight'){ next(); restartTimer(); }
      if (e.key === 'ArrowLeft'){ prev(); restartTimer(); }
      if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); next(); restartTimer(); }
    });
    dotsWrap.addEventListener('click', e => {
      const dot = e.target.closest('.slide-dot'); if (!dot) return;
      e.stopPropagation(); goTo(+dot.dataset.i); restartTimer();
    });
    prevBtn.addEventListener('click', e => { e.stopPropagation(); prev(); restartTimer(); });
    nextBtn.addEventListener('click', e => { e.stopPropagation(); next(); restartTimer(); });

    // swipe support
    let touchStartX = null;
    root.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    root.addEventListener('touchend', e => {
      if (touchStartX === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 40){ dx > 0 ? prev() : next(); restartTimer(); }
      touchStartX = null;
    }, { passive: true });
  } else {
    dotsWrap.style.display = 'none';
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'none';
  }
}

/* ====================================================================
   11. PROJECT POPUP MODAL
   ==================================================================== */
let activeProjectIndex = null;
function initProjectModal(){
  const overlay = document.getElementById('projectModalOverlay');
  const closeBtn = document.getElementById('projModalClose');
  const grid = document.getElementById('projectsGrid');

  function open(idx){
    const p = liveData.projects[idx];
    if (!p) return;
    document.getElementById('projModalTitle').textContent = p.title;
    document.getElementById('projModalDesc').textContent = p.desc;
    document.getElementById('projModalTags').innerHTML = (p.tags || []).map(t => `<span>${esc(t)}</span>`).join('');

    const metricsWrap = document.getElementById('projModalMetrics');
    if (metricsWrap){
      metricsWrap.innerHTML = (p.metrics && p.metrics.length) ? p.metrics.map(m => `<span class="metric-badge">${esc(m.label)}: ${esc(m.value)}</span>`).join('') : '';
    }

    const featuresWrap = document.getElementById('projModalFeaturesWrap');
    const featuresList = document.getElementById('projModalFeatures');
    if (p.features && p.features.length){
      featuresList.innerHTML = p.features.map(f => `<li>${esc(f)}</li>`).join('');
      featuresWrap.style.display = 'block';
    } else featuresWrap.style.display = 'none';

    // Case-study fields — each shown only if that project has content for it
    const caseFields = [
      ['Approach', 'approach', 'projModalApproachBlock', 'projModalApproach'],
      ['Challenges', 'challenges', 'projModalChallengesBlock', 'projModalChallenges'],
      ['Result', 'result', 'projModalResultBlock', 'projModalResult'],
      ['Lessons', 'lessons', 'projModalLessonsBlock', 'projModalLessons'],
    ];
    let anyCaseContent = false;
    caseFields.forEach(([label, key, blockId, textId]) => {
      const block = document.getElementById(blockId);
      const textEl = document.getElementById(textId);
      if (p[key] && String(p[key]).trim()){
        textEl.textContent = p[key];
        block.style.display = 'block';
        anyCaseContent = true;
      } else {
        block.style.display = 'none';
      }
    });
    const caseWrap = document.getElementById('projModalCaseStudyWrap');
    if (caseWrap) caseWrap.style.display = anyCaseContent ? 'block' : 'none';

    const shotsWrap = document.getElementById('projModalShotsWrap');
    const shotsGrid = document.getElementById('projModalShots');
    if (p.screenshots && p.screenshots.length){
      shotsGrid.innerHTML = p.screenshots.map(s => `<img src="${esc(s)}" alt="${esc(p.title)} screenshot" loading="lazy" />`).join('');
      shotsWrap.classList.add('show');
    } else { shotsWrap.classList.remove('show'); shotsGrid.innerHTML = ''; }

    const githubLink = document.getElementById('projModalGithub');
    const demoLink = document.getElementById('projModalDemo');
    if (p.github){ githubLink.href = p.github; githubLink.classList.remove('hidden'); } else githubLink.classList.add('hidden');
    if (p.demo){ demoLink.href = p.demo; demoLink.classList.remove('hidden'); } else demoLink.classList.add('hidden');

    activeProjectIndex = idx;
    showOverlay(overlay);
  }
  function close(){ hideOverlay(overlay); activeProjectIndex = null; }

  grid.addEventListener('click', e => {
    const card = e.target.closest('.project-card');
    if (!card) return;
    open(+card.dataset.index);
  });
  grid.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.project-card');
    if (!card) return;
    e.preventDefault();
    open(+card.dataset.index);
  });

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => {
    // Closes on a click anywhere in the popup, including its content — except on
    // an actual link/button, which needs its click to do its own thing first.
    if (e.target.closest('a, button')) return;
    close();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !overlay.classList.contains('hidden')) close(); });
}




/* ====================================================================
   12. CERTIFICATION POPUP MODAL + ZOOM/PAN IMAGE VIEWER
   ==================================================================== */
let activeCertIndex = null;
let certZoom = 1, certPanX = 0, certPanY = 0;
function initCertModal(){
  const overlay = document.getElementById('certModalOverlay');
  const closeBtn = document.getElementById('certModalClose');
  const list = document.getElementById('certsList');
  const img = document.getElementById('certViewerImg');
  const pdf = document.getElementById('certViewerPdf');
  const emptyMsg = document.getElementById('certViewerEmpty');
  const loading = document.getElementById('certViewerLoading');
  const canvas = document.getElementById('certViewerCanvas');

  function setZoom(z, x, y){
    certZoom = Math.min(Math.max(z, 0.3), 6);
    certPanX = x; certPanY = y;
    img.style.transform = `translate(${certPanX}px, ${certPanY}px) scale(${certZoom})`;
  }
  function resetZoom(){ setZoom(1, 0, 0); }

  function open(idx){
    const c = liveData.certifications[idx];
    if (!c) return;
    document.getElementById('certModalTitle').textContent = c.name;
    document.getElementById('certModalMeta').textContent = `${c.issuer} · ${c.year}`;

    // Always clear previous file first so a stale cert never lingers visually
    img.src = '';
    pdf.src = 'about:blank';
    img.classList.add('hidden'); pdf.classList.add('hidden'); emptyMsg.classList.add('hidden'); loading.classList.add('hidden');
    resetZoom();

    if (c.file && /\.pdf($|\?)/i.test(c.file)){
      loading.classList.remove('hidden');
      pdf.onload = () => loading.classList.add('hidden');
      pdf.src = c.file;
      pdf.classList.remove('hidden');
    } else if (c.file){
      loading.classList.remove('hidden');
      img.onload = () => loading.classList.add('hidden');
      img.onerror = () => loading.classList.add('hidden');
      img.src = c.file; img.classList.remove('hidden');
    } else {
      emptyMsg.classList.remove('hidden');
    }
    activeCertIndex = idx;
    showOverlay(overlay);
  }
  function close(){ hideOverlay(overlay); activeCertIndex = null; pdf.src = 'about:blank'; img.src = ''; }

  list.addEventListener('click', e => {
    const item = e.target.closest('.cert-item');
    if (!item) return;
    open(+item.dataset.index);
  });
  list.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const item = e.target.closest('.cert-item');
    if (!item) return;
    e.preventDefault();
    open(+item.dataset.index);
  });

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => {
    // Same click-anywhere-closes behavior — except the zoom/pan certificate viewer
    // itself (dragging/zooming it shouldn't also close the popup) and real controls.
    if (e.target.closest('a, button, #certViewerCanvas, #certViewerImg, #certViewerPdf')) return;
    close();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !overlay.classList.contains('hidden')) close(); });

  document.getElementById('certZoomIn').addEventListener('click', () => setZoom(certZoom + 0.3, certPanX, certPanY));
  document.getElementById('certZoomOut').addEventListener('click', () => setZoom(certZoom - 0.3, certPanX, certPanY));
  document.getElementById('certZoomReset').addEventListener('click', resetZoom);
  document.getElementById('certZoomFit').addEventListener('click', resetZoom);

  canvas.addEventListener('wheel', e => {
    if (img.classList.contains('hidden')) return;
    e.preventDefault();
    setZoom(certZoom + (e.deltaY > 0 ? -0.15 : 0.15), certPanX, certPanY);
  }, { passive: false });

  let dragging = false, lastX = 0, lastY = 0;
  img.addEventListener('mousedown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    setZoom(certZoom, certPanX + dx, certPanY + dy);
  });
  window.addEventListener('mouseup', () => dragging = false);

  let touchStartDist = null, touchStartZoom = 1, lastTouchX = 0, lastTouchY = 0;
  img.addEventListener('touchstart', e => {
    if (e.touches.length === 2){ touchStartDist = touchDist(e.touches); touchStartZoom = certZoom; }
    else if (e.touches.length === 1){ lastTouchX = e.touches[0].clientX; lastTouchY = e.touches[0].clientY; }
  }, { passive: true });
  img.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && touchStartDist){
      setZoom(touchStartZoom * (touchDist(e.touches) / touchStartDist), certPanX, certPanY);
    } else if (e.touches.length === 1){
      const dx = e.touches[0].clientX - lastTouchX, dy = e.touches[0].clientY - lastTouchY;
      lastTouchX = e.touches[0].clientX; lastTouchY = e.touches[0].clientY;
      setZoom(certZoom, certPanX + dx, certPanY + dy);
    }
  }, { passive: true });
  img.addEventListener('touchend', () => { touchStartDist = null; });

  function touchDist(touches){
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx*dx + dy*dy);
  }
}

/* ---- shared modal show/hide helpers ---- */
function showOverlay(overlay){
  overlay.classList.remove('hidden');
  requestAnimationFrame(() => overlay.classList.add('show'));
  document.body.style.overflow = 'hidden';
  sfxOpen();
}
function hideOverlay(overlay){
  overlay.classList.remove('show');
  document.body.style.overflow = '';
  setTimeout(() => overlay.classList.add('hidden'), 250);
}

function initLogoHome(){
  const logo = document.getElementById('logoHome');
  if (!logo) return;
  logo.addEventListener('click', e => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ====================================================================
   2d. SECTION VISIBILITY / TITLES / CUSTOM SECTIONS
   ==================================================================== */
function applySectionVisibility(){
  const vis = liveData.sectionVisibility || {};
  Object.keys(vis).forEach(key => {
    const el = document.getElementById(key);
    if (el) el.style.display = vis[key] === false ? 'none' : '';
  });
}

function applySectionMeta(){
  const meta = liveData.sectionMeta || {};
  Object.keys(meta).forEach(key => {
    const section = document.getElementById(key);
    if (!section) return;
    const tagEl = section.querySelector('.section-head .tag');
    const headEl = section.querySelector('.section-head h2');
    if (tagEl && meta[key].tag) tagEl.textContent = meta[key].tag;
    if (headEl && meta[key].heading) headEl.textContent = meta[key].heading;
  });
}

function renderCustomSections(){
  const container = document.getElementById('customSectionsContainer');
  if (!container) return;
  const sections = liveData.customSections || [];
  container.innerHTML = sections.map(s => `
    <section class="section reveal" id="${esc(s.id)}">
      <div class="section-head">
        <span class="tag">${esc(s.tag || '')}</span>
        <h2>${esc(s.heading || '')}</h2>
      </div>
      <div class="glass panel custom-section-body">
        ${(s.body || []).map(p => `<p>${esc(p)}</p>`).join('')}
      </div>
    </section>`).join('');
  initReveal();
}

/* ====================================================================
   13. SCROLL PROGRESS BAR
   ==================================================================== */
/* ====================================================================
   14. MOUSE TILT + GLOW ON CARDS
   ==================================================================== */
function initTiltCards(){
  const cards = document.querySelectorAll('.tilt-card:not([data-tilt-bound])');
  cards.forEach(card => {
    card.setAttribute('data-tilt-bound', '1');
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const rotX = ((y / r.height) - 0.5) * -6;
      const rotY = ((x / r.width) - 0.5) * 6;
      card.style.transform = `perspective(700px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-4px)`;
      card.style.setProperty('--glow-x', x + 'px');
      card.style.setProperty('--glow-y', y + 'px');
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });
}
function tagTiltCards(){
  document.querySelectorAll('.project-card, .skill-card, .achievement-card, .repo-card').forEach(c => c.classList.add('tilt-card'));
  initTiltCards();
}

/* ====================================================================
   15. DYNAMIC TIME-BASED GREETING
   ==================================================================== */
function applyDynamicGreeting(){
  const el = document.getElementById('heroEyebrow');
  if (!el) return;
  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Burning the midnight oil too?' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : hour < 21 ? 'Good evening' : 'Working late?';
  const settings = (liveData && liveData.settings) || {};
  const statusColor = settings.availabilityStatus === 'yellow' ? '#eab308' : settings.availabilityStatus === 'gray' ? '#9ca3af' : '#22c55e';
  const statusText = settings.availabilityText || 'Open to opportunities';
  el.innerHTML = `<span class="eyebrow-dot" style="color:${statusColor};">●</span> <span class="eyebrow-wish">${greeting}</span> — ${escapeHtmlLocal(statusText)}`;
}

/* ====================================================================
   AVATAR ASSISTANT — a lightweight, zero-cost scripted FAQ bot.
   Not a real AI chat (that needs a paid API + backend); this answers
   from the site's own content with keyword matching + quick-reply chips.
   Upgrade path if you ever want real AI chat: swap answerFor() below for
   a fetch() to an LLM API from your own backend (never expose an API key
   in this client-side file).
   ==================================================================== */
function initAvatarWidget(){
  const btn = document.getElementById('avatarAssistantBtn');
  const panel = document.getElementById('avatarAssistantPanel');
  const closeBtn = document.getElementById('avatarAssistantClose');
  const messages = document.getElementById('avatarAssistantMessages');
  const quick = document.getElementById('avatarAssistantQuick');
  const input = document.getElementById('avatarAssistantInput');
  const sendBtn = document.getElementById('avatarAssistantSend');
  if (!btn) return;

  const name = (liveData.hero_name || 'Yashwanth').split(' ')[0];
  const QUICK = [
    { label: 'About him', kw: 'about' },
    { label: 'Top projects', kw: 'projects' },
    { label: 'Skills', kw: 'skills' },
    { label: 'How to hire', kw: 'hire' },
    { label: 'Contact', kw: 'contact' },
  ];

  function addMsg(text, who){
    const el = document.createElement('div');
    el.className = `aa-msg ${who}`;
    el.textContent = text;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
  }

  function answerFor(raw){
    const q = raw.toLowerCase();
    if (/hire|job|opportunit|recruit/.test(q)){
      setTimeout(() => document.getElementById('hireMeBtn')?.click(), 900);
      return `Click "💼 Hire Me" up top — I'll open that for you now. It sends straight to ${name}.`;
    }
    if (/project/.test(q)){
      scrollToId('projects');
      return `Scrolling you to the Projects section — that has all of ${name}'s shipped work with details on click.`;
    }
    if (/skill|tech|stack|language/.test(q)){
      scrollToId('skills');
      return `Heading to the Skills section now — covers the full stack ${name} works with.`;
    }
    if (/contact|email|reach|phone/.test(q)){
      scrollToId('contact');
      return `Scrolling to Contact — you'll find email and other ways to reach ${name} directly there.`;
    }
    if (/about|who|background/.test(q)){
      scrollToId('about');
      return `Here's the About section — a quick summary of ${name}'s background.`;
    }
    if (/certif|badge/.test(q)){
      scrollToId('certifications');
      return `Certifications section coming up — click any card for the full certificate.`;
    }
    return `I'm a simple scripted assistant, so I can only point you around the site — try one of the quick options below, or use the "Hire Me" button for anything specific.`;
  }

  function handle(text){
    addMsg(text, 'user');
    const reply = answerFor(text);
    setTimeout(() => addMsg(reply, 'bot'), 350);
  }

  QUICK.forEach(q => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = q.label;
    b.addEventListener('click', () => handle(q.label));
    quick.appendChild(b);
  });

  btn.addEventListener('click', () => {
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden') && !messages.children.length){
      addMsg(`Hey, I'm ${name}'s avatar 👋 — ask me about projects, skills, or how to get in touch.`, 'bot');
    }
  });
  closeBtn.addEventListener('click', () => panel.classList.add('hidden'));
  sendBtn.addEventListener('click', () => { if (input.value.trim()){ handle(input.value.trim()); input.value=''; } });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && input.value.trim()){ handle(input.value.trim()); input.value=''; } });
}
function initHireMe(){
  const overlay = document.getElementById('hireMeOverlay');
  const btn = document.getElementById('hireMeBtn');
  const status = document.getElementById('hireMeStatus');
  if (!btn) return;

  if (window.emailjs && typeof EMAILJS_PUBLIC_KEY === 'string' && EMAILJS_PUBLIC_KEY){
    try { emailjs.init(EMAILJS_PUBLIC_KEY); } catch(e){}
  }

  btn.addEventListener('click', () => showOverlay(overlay));
  document.getElementById('hireMeClose').addEventListener('click', () => hideOverlay(overlay));
  overlay.addEventListener('click', e => { if (e.target === overlay) hideOverlay(overlay); });

  document.getElementById('hireMeSubmit').addEventListener('click', async () => {
    const name = document.getElementById('hireName').value.trim();
    const company = document.getElementById('hireCompany').value.trim();
    const contact = document.getElementById('hireContact').value.trim();
    const message = document.getElementById('hireMessage').value.trim();
    if (!name || !contact){ status.textContent = 'Name and email/phone are required.'; return; }
    status.textContent = '';

    let emailed = false;
    const hasEmailJs = window.emailjs && EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY;
    if (hasEmailJs){
      try {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
          from_name: name, from_contact: contact, company: company || '—', message: message || '(no message)',
        });
        emailed = true;
      } catch(e){ console.warn('EmailJS send failed', e); }
    }
    if (supa){
      try { await supa.from('hire_inquiries').insert({ name, company, contact, message, page: location.href }); }
      catch(e){ console.warn('Supabase insert failed', e); }
    }
    sfxSuccess();
    hideOverlay(overlay);
    document.getElementById('hireName').value = '';
    document.getElementById('hireCompany').value = '';
    document.getElementById('hireContact').value = '';
    document.getElementById('hireMessage').value = '';
    showMiniToast(emailed || supa ? '✓ Sent' : 'Could not send — email me directly');
  });
}
function initIntroSplash(){
  const el = document.getElementById('introSplash');
  if (!el) return;
  const skipIntro = new URLSearchParams(location.search).get('nointro') === '1';
  if (skipIntro){ el.remove(); return; }
  const sound = document.getElementById('introSound');
  function tryPlaySound(){
    if (!sound) return;
    sound.volume = 0.5;
    sound.play().catch(() => {
      // Autoplay-with-sound was blocked — plays on the visitor's very first
      // click/tap anywhere instead (still while the splash is up, if they're quick).
      const resume = () => { sound.play().catch(()=>{}); document.removeEventListener('pointerdown', resume); };
      document.addEventListener('pointerdown', resume, { once: true });
    });
  }
  tryPlaySound();
  function dismiss(){
    el.classList.add('hide');
    if (sound){ sound.pause(); sound.currentTime = 0; }
    setTimeout(() => el.remove(), 650);
  }
  setTimeout(dismiss, 3600);
  el.addEventListener('click', dismiss);
}

/* ====================================================================
   LIVE DIGITAL CLOCK
   ==================================================================== */
function initLiveClock(){
  const root = document.getElementById('liveClock');
  const digital = document.getElementById('clockDigital');
  const analog = document.getElementById('clockAnalog');
  const dateEl = document.getElementById('clockDate');
  if (!root) return;
  const style = (liveData.settings && liveData.settings.clockStyle) || 'digital';
  root.classList.toggle('style-neon', style === 'neon');
  digital.classList.toggle('hidden', style === 'analog');
  analog.classList.toggle('hidden', style !== 'analog');
  const hourHand = document.getElementById('clockHourHand');
  const minHand = document.getElementById('clockMinHand');
  const secHand = document.getElementById('clockSecHand');
  function tick(){
    const now = new Date();
    if (style === 'analog'){
      const h = now.getHours() % 12, m = now.getMinutes(), s = now.getSeconds();
      setHand(hourHand, (h + m / 60) * 30);
      setHand(minHand, (m + s / 60) * 6);
      setHand(secHand, s * 6);
    } else {
      const hh = String(now.getHours()).padStart(2,'0');
      const mm = String(now.getMinutes()).padStart(2,'0');
      const ss = String(now.getSeconds()).padStart(2,'0');
      digital.textContent = `${hh}:${mm}:${ss}`;
    }
    dateEl.textContent = now.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
  }
  function setHand(el, deg){ el.setAttribute('transform', `rotate(${deg} 50 50)`); }
  tick();
  setInterval(tick, 1000);
}

/* ====================================================================
   ADMIN LOCK ICON — sign in directly on index.html, then jump straight
   to admin.html's dashboard (session persists, no second login there).
   ==================================================================== */
function initAdminLockPopup(){
  const lockBtn = document.getElementById('adminLockBtn');
  const popup = document.getElementById('loginPopup');
  const submitBtn = document.getElementById('loginSubmitBtn');
  const status = document.getElementById('loginStatus');
  const emailInput = document.getElementById('loginEmail');
  const passInput = document.getElementById('loginPass');
  if (!lockBtn) return;

  lockBtn.addEventListener('click', e => { e.stopPropagation(); popup.classList.toggle('hidden'); });
  document.addEventListener('click', e => {
    if (!popup.classList.contains('hidden') && !e.target.closest('.nav-auth-wrap')) popup.classList.add('hidden');
  });

  submitBtn.addEventListener('click', async () => {
    if (!supa){ status.textContent = 'Not connected to Supabase yet.'; return; }
    status.textContent = 'Signing in…';
    const { error } = await supa.auth.signInWithPassword({ email: emailInput.value.trim(), password: passInput.value });
    if (error){ status.textContent = error.message; return; }
    status.textContent = '✓ Signed in — opening dashboard…';
    location.href = 'admin.html';
  });
  passInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitBtn.click(); });
}
/* ====================================================================
   FLOATING UI OFFSET — keeps clock/font-size/connect buttons below the
   navbar even when it wraps to multiple lines (more nav links checked).
   ==================================================================== */
function updateFloatingUIOffset(){
  const nav = document.querySelector('.navbar');
  if (!nav) return;
  const rect = nav.getBoundingClientRect();
  const gap = rect.bottom + 10; // 10px breathing room below the navbar
  document.documentElement.style.setProperty('--floating-ui-top', `${Math.max(10, gap)}px`);
}
function initFloatingUIOffset(){
  updateFloatingUIOffset();
  window.addEventListener('resize', updateFloatingUIOffset);
  const links = document.getElementById('navLinks');
  if (links) new MutationObserver(updateFloatingUIOffset).observe(links, { childList: true });
}

function initFontSizeControl(){
  const MIN = 85, MAX = 130, STEP = 10;
  let pct = +(localStorage.getItem('font_size_pct')) || 100;
  const resetBtn = document.getElementById('fontSizeReset');
  const wrapper = document.getElementById('scaleWrapper');
  function apply(){
    if (wrapper) wrapper.style.zoom = pct / 100;
    resetBtn.textContent = pct + '%';
    localStorage.setItem('font_size_pct', pct);
  }
  document.getElementById('fontSizeUp').addEventListener('click', () => { pct = Math.min(MAX, pct + STEP); apply(); });
  document.getElementById('fontSizeDown').addEventListener('click', () => { pct = Math.max(MIN, pct - STEP); apply(); });
  resetBtn.addEventListener('click', () => { pct = 100; apply(); });
  apply();
}

/* ====================================================================
   NAV LINKS — built dynamically from which sections are actually visible
   (admin's Sections toggles), short labels, re-filtered for Recruiter Mode.
   ==================================================================== */
const NAV_FULL_LABELS = {
  about: 'About', experience: 'Experience', timeline: 'Timeline', skills: 'Skills',
  skillMatch: 'Job Match', projects: 'Projects', repos: 'GitHub', certs: 'Certifications',
  hobbies: 'Hobbies', achievements: 'Achievements', connect: 'Connect', contact: 'Contact',
};
function renderNavLinks(){
  const wrap = document.getElementById('navLinks');
  if (!wrap) return;
  const recruiterOn = document.body.classList.contains('recruiter-mode');
  const recruiterHidden = (liveData.settings && liveData.settings.recruiterHiddenSections) || [];
  const navShown = (liveData.settings && liveData.settings.navVisibleSections) || Object.keys(NAV_FULL_LABELS).filter(k => k !== 'contact');
  const html = Object.keys(NAV_FULL_LABELS).filter(id => {
    if (!navShown.includes(id)) return false;
    if (liveData.sectionVisibility?.[id] === false) return false;
    if (recruiterOn && recruiterHidden.includes(id)) return false;
    return document.getElementById(id);
  }).map(id => `<a href="#${id}">${NAV_FULL_LABELS[id]}</a>`).join('');
  wrap.innerHTML = html;
  initNavScrollSpy();
}
function initNavScrollSpy(){
  const links = Array.from(document.querySelectorAll('.navlinks a[href^="#"]'));
  if (!links.length) return;
  const map = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
  const label = document.getElementById('scrollSectionLabel');
  let currentTitle = '';
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      const link = map.get(e.target.id);
      if (!link) return;
      if (e.isIntersecting){
        links.forEach(l => l.classList.toggle('nav-active', l === link));
        currentTitle = link.textContent.trim();
      }
    });
  }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
  map.forEach((_, id) => { const el = document.getElementById(id); if (el) obs.observe(el); });

  if (label){
    let hideTimer = null;
    window.addEventListener('scroll', () => {
      if (!currentTitle) return;
      label.textContent = currentTitle;
      const h = document.documentElement;
      const pct = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
      label.style.top = `${10 + pct * 80}%`;
      label.classList.add('visible');
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => label.classList.remove('visible'), 900);
    }, { passive: true });
  }
}

/* ====================================================================
   16. RECRUITER MODE (hides non-essential sections client-side)
   ==================================================================== */
function buildPrintResume(){
  const doc = document.getElementById('printResumeDoc');
  if (!doc || !liveData) return;
  const esc = (s) => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const edu = sortByDateDesc(liveData.education || [], e => e.period).map(x => x.item);
  const exp = sortByDateDesc(liveData.experience || [], e => e.period).map(x => x.item);
  const projects = sortByDateDesc(liveData.projects || [], p => p.date).map(x => x.item);
  const certs = sortByDateDesc(liveData.certifications || [], c => c.year).map(x => x.item);
  const skills = liveData.skills || [];

  const contactBits = [
    liveData.email ? `✉ ${esc(liveData.email)}` : '',
    liveData.phone ? `☎ ${esc(liveData.phone)}` : '',
    liveData.linkedin_url ? `🔗 ${esc(liveData.linkedin_url.replace(/^https?:\/\//,''))}` : '',
    liveData.github_username ? `⌥ github.com/${esc(liveData.github_username)}` : '',
  ].filter(Boolean).join('&nbsp;&nbsp;·&nbsp;&nbsp;');

  doc.innerHTML = `
    <header class="pr-header">
      <h1>${esc(liveData.hero_name || 'Your Name')}</h1>
      <p class="pr-role">${esc(liveData.hero_sub || '')}</p>
      <p class="pr-contact">${contactBits}</p>
    </header>

    ${skills.length ? `
    <section class="pr-section">
      <h2>Skills</h2>
      ${skills.map(g => `<p class="pr-line"><strong>${esc(g.category)}:</strong> ${(g.items||[]).map(esc).join(', ')}</p>`).join('')}
    </section>` : ''}

    ${exp.length ? `
    <section class="pr-section">
      <h2>Experience</h2>
      ${exp.map(e => `
        <div class="pr-item">
          <div class="pr-item-top"><strong>${esc(e.role)} · ${esc(e.org)}</strong><span>${esc(e.period)}</span></div>
          ${e.desc ? `<p>${esc(e.desc)}</p>` : ''}
        </div>`).join('')}
    </section>` : ''}

    ${edu.length ? `
    <section class="pr-section">
      <h2>Education</h2>
      ${edu.map(e => `
        <div class="pr-item">
          <div class="pr-item-top"><strong>${esc(e.degree)}</strong><span>${esc(e.period)}</span></div>
          <p>${esc(e.school)}${e.detail ? ' · ' + esc(e.detail) : ''}</p>
        </div>`).join('')}
    </section>` : ''}

    ${projects.length ? `
    <section class="pr-section">
      <h2>Projects</h2>
      ${projects.map(p => `
        <div class="pr-item">
          <div class="pr-item-top"><strong>${esc(p.title)}</strong>${p.date ? `<span>${esc(p.date)}</span>` : ''}</div>
          <p>${esc(p.desc)}</p>
          ${(p.tags && p.tags.length) ? `<p class="pr-tags">${p.tags.map(esc).join(' · ')}</p>` : ''}
        </div>`).join('')}
    </section>` : ''}

    ${certs.length ? `
    <section class="pr-section">
      <h2>Certifications</h2>
      ${certs.map(c => `<p class="pr-line"><strong>${esc(c.name)}</strong> — ${esc(c.issuer)} (${esc(c.year)})</p>`).join('')}
    </section>` : ''}
  `;
}

/* ====================================================================
   NEW: DOWNLOADABLE VCARD (save contact directly to phone)
   ==================================================================== */
function initBookingButton(){
  const btn = document.getElementById('bookCallBtn');
  if (!btn) return;
  const url = (liveData.settings && liveData.settings.bookingUrl) || '';
  if (url){
    btn.href = url;
    btn.style.display = 'inline-flex';
  } else {
    btn.style.display = 'none';
  }
}

function initSaveContactCard(){
  const btn = document.getElementById('saveContactBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const name = liveData.hero_name || 'Yashwanth R';
    const email = liveData.email || 'yashwanthriya25@gmail.com';
    const phone = liveData.phone || '';
    const linkedin = liveData.linkedin_url || '';
    const github = liveData.github_username ? `https://github.com/${liveData.github_username}` : '';
    const title = liveData.hero_sub ? liveData.hero_sub.split('.')[0] : 'Software Engineer';

    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${name}`,
      `TITLE:${title}`,
      email ? `EMAIL;TYPE=INTERNET:${email}` : '',
      phone ? `TEL;TYPE=CELL:${phone}` : '',
      linkedin ? `URL;TYPE=LinkedIn:${linkedin}` : '',
      github ? `URL;TYPE=GitHub:${github}` : '',
      'END:VCARD'
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([vcard], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '_')}.vcf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    if (typeof sfxSuccess === 'function') sfxSuccess();
    if (typeof awardBadge === 'function') awardBadge('Contact Saved 📇');
  });
}

/* ====================================================================
   NEW: JOB DESCRIPTION SKILL-MATCH ANALYZER (client-side only)
   ==================================================================== */
function initSkillMatchAnalyzer(){
  const btn = document.getElementById('analyzeJdBtn');
  const input = document.getElementById('jdInput');
  const scoreEl = document.getElementById('jdMatchScore');
  const resultsEl = document.getElementById('jdMatchResults');
  if (!btn || !input) return;

  function allMySkills(){
    const set = new Set();
    (liveData.skills || []).forEach(group => (group.items || []).forEach(item => set.add(item.toLowerCase().trim())));
    return Array.from(set);
  }

  btn.addEventListener('click', () => {
    const jd = (input.value || '').toLowerCase();
    if (!jd.trim()){
      scoreEl.textContent = 'Paste a job description first.';
      resultsEl.innerHTML = '';
      return;
    }
    const mySkills = allMySkills();
    const matched = [];
    const missing = [];
    mySkills.forEach(skill => {
      // word-boundary-ish match so "R" doesn't match every word containing r
      const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
      if (pattern.test(jd)) matched.push(skill); else missing.push(skill);
    });

    const pct = mySkills.length ? Math.round((matched.length / mySkills.length) * 100) : 0;
    scoreEl.innerHTML = `<strong style="color:var(--accent-1); font-size:1.1rem;">${pct}% match</strong> — ${matched.length} of ${mySkills.length} listed skills found in this description.`;

    resultsEl.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
        <div>
          <p style="font-size:.82rem; color:var(--accent-1); font-weight:600; margin-bottom:8px;">✓ Matched (${matched.length})</p>
          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            ${matched.map(s => `<span class="skill-tag" style="border-color:var(--accent-1);">${escapeHtmlLocal(s)}</span>`).join('') || '<span class="muted" style="font-size:.82rem;">None found</span>'}
          </div>
        </div>
        <div>
          <p style="font-size:.82rem; color:var(--ink-2); font-weight:600; margin-bottom:8px;">Not mentioned (${missing.length})</p>
          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            ${missing.map(s => `<span class="skill-tag" style="opacity:.5;">${escapeHtmlLocal(s)}</span>`).join('') || '<span class="muted" style="font-size:.82rem;">None — full match!</span>'}
          </div>
        </div>
      </div>
      <div id="jdPitchCard" class="jd-pitch-card">
        <p id="jdPitchText" class="jd-pitch-text"></p>
        <button id="jdCopyPitchBtn" type="button" class="btn btn-glass" style="margin-top:12px; font-size:.82rem;">📋 Copy this summary</button>
      </div>`;

    // Generate a one-paragraph, shareable pitch a recruiter could forward internally
    const name = (liveData.hero_name || 'This candidate').split(' ')[0];
    const topMatched = matched.slice(0, 4);
    const strengthLine = topMatched.length
      ? `especially in ${topMatched.slice(0, -1).map(s => capitalizeLocal(s)).join(', ')}${topMatched.length > 1 ? ' and ' + capitalizeLocal(topMatched[topMatched.length - 1]) : capitalizeLocal(topMatched[0])}`
      : 'across a broad general skill set';
    const verdict = pct >= 70 ? 'a strong fit worth an interview'
      : pct >= 40 ? 'a reasonable fit worth a closer look'
      : 'a partial fit, though the core skills may still transfer';
    const pitchText = `${name} matches ${pct}% of this role's listed requirements, ${strengthLine}. Based on this overlap, ${name} looks like ${verdict}.`;
    document.getElementById('jdPitchText').textContent = pitchText;

    document.getElementById('jdCopyPitchBtn').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(pitchText);
        const b = document.getElementById('jdCopyPitchBtn');
        const original = b.textContent;
        b.textContent = '✓ Copied!';
        setTimeout(() => { b.textContent = original; }, 1800);
      } catch (e) { /* clipboard may be blocked in some contexts; fail silently */ }
    });

    if (typeof fireConfetti === 'function' && pct >= 70) fireConfetti();
    if (typeof awardBadge === 'function') awardBadge('Job Match Checked 🎯');
  });
}
function escapeHtmlLocal(s){
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function capitalizeLocal(s){
  return String(s || '').replace(/\b\w/g, c => c.toUpperCase());
}

/* ====================================================================
   NEW: LIGHTWEIGHT VISITOR ANALYTICS (page views, résumé downloads,
   project clicks) — logged to Supabase, visible only in admin.html.
   No third-party tracker, no cookies, just a few insert-only rows.
   ==================================================================== */
function logSiteEvent(eventType, meta){
  if (!supa) return;
  supa.from('site_events').insert({ event_type: eventType, meta: meta || null }).then(() => {}, () => {});
}
let mobileBottomBarObserver = null;
/* ====================================================================
   MAGNETIC BUTTONS — primary CTAs subtly pull toward the cursor as it
   approaches, snapping back on mouse-leave. Skipped entirely on touch
   devices (no hover concept) and honors prefers-reduced-motion.
   ==================================================================== */
/* ====================================================================
   COMPACT MODE — viewer-facing toggle that tightens spacing/padding
   site-wide so a skimming recruiter sees more content per screen.
   Purely a CSS class + remembered locally; doesn't touch admin settings.
   ==================================================================== */
function initCompactMode(){
  const btn = document.getElementById('compactModeBtn');
  if (!btn) return;
  function apply(on){
    document.body.classList.toggle('compact-mode', on);
    btn.classList.toggle('icon-btn-active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    localStorage.setItem('compact_mode', on ? '1' : '0');
  }
  btn.addEventListener('click', () => apply(!document.body.classList.contains('compact-mode')));
  if (localStorage.getItem('compact_mode') === '1') apply(true);
}

/* ====================================================================
   ONE-PAGE MINI-MAP MODE — a floating vertical dot-nav, one dot per
   visible section, active dot highlighted as you scroll. Reuses the
   exact same section list/visibility rules as the main nav so it never
   shows a dot for a hidden or recruiter-suppressed section.
   ==================================================================== */
let minimapObserver = null;
function buildMinimapDots(){
  const nav = document.getElementById('minimapNav');
  if (!nav) return;
  const recruiterOn = document.body.classList.contains('recruiter-mode');
  const recruiterHidden = (liveData.settings && liveData.settings.recruiterHiddenSections) || [];
  const navShown = (liveData.settings && liveData.settings.navVisibleSections) || Object.keys(NAV_FULL_LABELS).filter(k => k !== 'contact');
  const ids = Object.keys(NAV_FULL_LABELS).filter(id => {
    if (!navShown.includes(id)) return false;
    if (liveData.sectionVisibility?.[id] === false) return false;
    if (recruiterOn && recruiterHidden.includes(id)) return false;
    return document.getElementById(id);
  });
  nav.innerHTML = ids.map(id => `<a href="#${id}" class="minimap-dot" data-section="${id}" title="${escapeHtmlLocal(NAV_FULL_LABELS[id])}"></a>`).join('');

  if (minimapObserver) minimapObserver.disconnect();
  const dots = Array.from(nav.querySelectorAll('.minimap-dot'));
  const map = new Map(dots.map(d => [d.dataset.section, d]));
  minimapObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const dot = map.get(entry.target.id);
      if (dot && entry.isIntersecting) dots.forEach(d => d.classList.toggle('minimap-dot-active', d === dot));
    });
  }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
  ids.forEach(id => { const el = document.getElementById(id); if (el) minimapObserver.observe(el); });
}
function initMinimapMode(){
  const btn = document.getElementById('minimapModeBtn');
  const nav = document.getElementById('minimapNav');
  if (!btn || !nav) return;
  function apply(on){
    document.body.classList.toggle('minimap-mode', on);
    nav.classList.toggle('hidden', !on);
    btn.classList.toggle('icon-btn-active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    localStorage.setItem('minimap_mode', on ? '1' : '0');
    if (on) buildMinimapDots();
  }
  btn.addEventListener('click', () => apply(!document.body.classList.contains('minimap-mode')));
  if (localStorage.getItem('minimap_mode') === '1') apply(true);
}

function initMagneticButtons(){
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(hover: none)').matches) return; // touch devices

  const buttons = document.querySelectorAll('.btn-magnetic');
  const strength = 0.35;
  const maxOffset = 10;

  buttons.forEach(btn => {
    btn.addEventListener('mousemove', e => {
      btn.style.transition = 'transform 0.05s linear';
      const rect = btn.getBoundingClientRect();
      const relX = e.clientX - (rect.left + rect.width / 2);
      const relY = e.clientY - (rect.top + rect.height / 2);
      const x = Math.max(-maxOffset, Math.min(maxOffset, relX * strength));
      const y = Math.max(-maxOffset, Math.min(maxOffset, relY * strength));
      btn.style.transform = `translate(${x}px, ${y}px)`;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transition = 'transform 0.4s cubic-bezier(.34,1.56,.64,1)';
      btn.style.transform = '';
    });
  });
}

/* ====================================================================
   HERO PARALLAX — hero text and photo drift at slightly different
   speeds while scrolling past the hero, for a subtle sense of depth.
   Uses rAF-throttled scroll, disabled under reduced-motion.
   ==================================================================== */
function initHeroParallax(){
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const hero = document.getElementById('hero');
  const text = hero ? hero.querySelector('.hero-text') : null;
  const photo = hero ? hero.querySelector('.hero-photo-wrap') : null;
  if (!hero || (!text && !photo)) return;

  let ticking = false;
  function update(){
    const rect = hero.getBoundingClientRect();
    // Only animate while the hero is at least partially in view, and only
    // for the natural scroll range of the hero itself (not the whole page).
    if (rect.bottom < 0 || rect.top > window.innerHeight){ ticking = false; return; }
    const progress = Math.min(Math.max(-rect.top / (rect.height || 1), 0), 1);
    if (text) text.style.transform = `translateY(${progress * 40}px)`;
    if (photo) photo.style.transform = `translateY(${progress * 70}px)`;
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, { passive: true });
}

/* ====================================================================
   SECTION NAV TRANSITION — clicking any in-page nav link (desktop nav,
   mobile bottom bar, or footer/anchor links) gives the destination
   section a brief, designed fade+lift as it arrives, instead of a bare
   jump. Purely additive on top of the existing scroll-reveal system.
   ==================================================================== */
function initSectionNavTransition(){
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // Event delegation on document — works for the desktop nav (which is
  // regenerated dynamically by renderNavLinks), the mobile bottom bar,
  // and any other in-page anchor link, without needing to re-bind listeners.
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (!target) return;
    target.classList.remove('section-nav-enter');
    void target.offsetWidth; // force reflow so replaying the same section retriggers the animation
    target.classList.add('section-nav-enter');
    setTimeout(() => target.classList.remove('section-nav-enter'), 700);
  });
}

function initMobileBottomBar(){
  const bar = document.getElementById('mobileBottomBar');
  if (!bar) return;
  const tabs = Array.from(bar.querySelectorAll('.mbb-tab'));

  // Hide any tab whose target section doesn't exist or is turned off
  tabs.forEach(tab => {
    const id = tab.dataset.section;
    const target = document.getElementById(id);
    const isVisible = target && getComputedStyle(target).display !== 'none';
    tab.style.display = isVisible ? '' : 'none';
  });

  const visibleTabs = tabs.filter(t => t.style.display !== 'none');
  if (!visibleTabs.length) return;

  if (mobileBottomBarObserver) mobileBottomBarObserver.disconnect();

  const sectionMap = new Map(visibleTabs.map(t => [t.dataset.section, t]));
  mobileBottomBarObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const tab = sectionMap.get(entry.target.id);
      if (!tab) return;
      if (entry.isIntersecting){
        tabs.forEach(t => t.classList.remove('mbb-active'));
        tab.classList.add('mbb-active');
      }
    });
  }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });

  sectionMap.forEach((tab, id) => {
    const el = document.getElementById(id);
    if (el) mobileBottomBarObserver.observe(el);
  });

  // First tab (hero) active by default before any scrolling
  visibleTabs[0].classList.add('mbb-active');
}

function initAnalyticsLogging(){
  // one page-view log per browser tab session (not per scroll/interaction)
  if (!sessionStorage.getItem('pv_logged')){
    sessionStorage.setItem('pv_logged', '1');
    logSiteEvent('page_view', location.pathname);
  }
  const resumeBtn = document.getElementById('resumeDownloadBtn');
  if (resumeBtn) resumeBtn.addEventListener('click', () => logSiteEvent('resume_download'));

  const grid = document.getElementById('projectsGrid');
  if (grid){
    grid.addEventListener('click', e => {
      const card = e.target.closest('.project-card');
      if (!card) return;
      const idx = +card.dataset.index;
      const title = liveData.projects?.[idx]?.title || ('project #' + idx);
      logSiteEvent('project_click', title);
    });
  }
}

function initPrintResumeButton(){
  const btn = document.getElementById('printResumeBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    buildPrintResume();
    document.documentElement.classList.add('printing-resume');
    window.print();
  });
  window.addEventListener('afterprint', () => {
    document.documentElement.classList.remove('printing-resume');
  });
}

function initRecruiterMode(){
  const btn = document.getElementById('recruiterModeBtn');
  const label = btn.querySelector('.recruiter-label') || (() => {
    const span = document.createElement('span');
    span.className = 'recruiter-label';
    btn.appendChild(span);
    return span;
  })();
  function apply(on){
    document.body.classList.toggle('recruiter-mode', on);
    const hidden = (liveData.settings && liveData.settings.recruiterHiddenSections) || ['hobbies', 'connect', 'achievements', 'timeline'];
    hidden.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = on ? 'none' : (liveData.sectionVisibility?.[id] === false ? 'none' : '');
    });
    btn.classList.toggle('active-toggle', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    label.textContent = on ? 'Recruiter Mode: ON' : 'Recruiter Mode';
    localStorage.setItem('recruiter_mode', on ? '1' : '0');
    renderNavLinks();
    initMobileBottomBar();
    if (document.body.classList.contains('minimap-mode')) buildMinimapDots();
    // Cursor styling + trail are gimmicks — always off while recruiter mode is on, no matter what's saved.
    applyCursorSettings();
  }
  btn.addEventListener('click', () => apply(!document.body.classList.contains('recruiter-mode')));
  if (localStorage.getItem('recruiter_mode') === '1') apply(true);

  if (!localStorage.getItem('recruiter_callout_seen')){
    setTimeout(() => {
      const callout = document.createElement('div');
      callout.className = 'recruiter-callout';
      callout.innerHTML = `👀 Hiring? Try <strong>Recruiter Mode</strong> ↑ for a no-clutter view — just projects, skills, experience &amp; contact.`;
      document.body.appendChild(callout);
      requestAnimationFrame(() => callout.classList.add('show'));
      setTimeout(() => { callout.classList.remove('show'); setTimeout(() => callout.remove(), 400); }, 7000);
      localStorage.setItem('recruiter_callout_seen', '1');
    }, 2500);
  }
}

/* ====================================================================
   17. COMMAND PALETTE + GLOBAL SEARCH (Ctrl+K)
   ==================================================================== */
function buildSearchIndex(){
  const idx = [];
  idx.push({ type: 'Section', title: 'About', action: () => scrollToId('about') });
  idx.push({ type: 'Section', title: 'Timeline', action: () => scrollToId('timeline') });
  idx.push({ type: 'Section', title: 'Skills', action: () => scrollToId('skills') });
  idx.push({ type: 'Section', title: 'Projects', action: () => scrollToId('projects') });
  idx.push({ type: 'Section', title: 'GitHub repositories', action: () => scrollToId('repos') });
  idx.push({ type: 'Section', title: 'Certifications', action: () => scrollToId('certs') });
  idx.push({ type: 'Section', title: 'Connect', action: () => scrollToId('connect') });

  (liveData.projects || []).forEach((p, i) => idx.push({ type: 'Project', title: p.title, sub: p.desc, action: () => { scrollToId('projects'); setTimeout(() => document.querySelector(`#projectsGrid [data-index="${i}"]`)?.click(), 350); } }));
  (liveData.certifications || []).forEach((c) => idx.push({ type: 'Certification', title: c.name, sub: c.issuer, action: () => scrollToId('certs') }));
  (liveData.skills || []).forEach(s => idx.push({ type: 'Skill category', title: s.category, sub: (s.items||[]).join(', '), action: () => scrollToId('skills') }));
  (liveData.experience || []).forEach(e => idx.push({ type: 'Experience', title: `${e.role} · ${e.org}`, sub: e.period, action: () => scrollToId('experience') || scrollToId('timeline') }));
  (liveData.education || []).forEach(e => idx.push({ type: 'Education', title: e.degree, sub: e.school, action: () => scrollToId('about') }));

  idx.push({ type: 'Command', title: 'Toggle light / dark theme', action: () => document.getElementById('themeToggle').click() });
  idx.push({ type: 'Command', title: 'Download résumé', action: () => document.getElementById('resumeDownloadBtn')?.click() });
  idx.push({ type: 'Command', title: 'Print résumé view', action: () => window.print() });
  idx.push({ type: 'Command', title: 'Copy email address', action: () => document.getElementById('copyEmailBtn')?.click() });
  idx.push({ type: 'Command', title: 'Toggle Recruiter Mode', action: () => document.getElementById('recruiterModeBtn')?.click() });
  idx.push({ type: 'Command', title: 'Open GitHub profile', action: () => window.open(`https://github.com/${liveData.github_username}`, '_blank') });
  idx.push({ type: 'Command', title: 'Open LinkedIn profile', action: () => window.open(liveData.linkedin_url, '_blank') });
  idx.push({ type: 'Command', title: 'Open YouTube channel', action: () => window.open(liveData.youtube_url, '_blank') });
  if (eggsAllowed()){
    idx.push({ type: '🎮 Games', title: 'Play a mini-game (Bug Squash / Snake / Dino)', action: () => window.__openGameHub && window.__openGameHub() });
  }
  return idx;
}
function scrollToId(id){
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
  return true;
}

let paletteIndex = [];
let paletteSelected = 0;
function initCommandPalette(){
  const overlay = document.getElementById('paletteOverlay');
  const input = document.getElementById('paletteInput');
  const results = document.getElementById('paletteResults');
  const searchBtn = document.getElementById('searchBtn');

  function open(){
    paletteIndex = buildSearchIndex();
    showOverlay(overlay);
    input.value = '';
    renderResults('');
    setTimeout(() => input.focus(), 150);
  }
  function close(){ hideOverlay(overlay); }

  function renderResults(query){
    const q = query.trim().toLowerCase();
    const filtered = q ? paletteIndex.filter(item =>
      item.title.toLowerCase().includes(q) || (item.sub || '').toLowerCase().includes(q)
    ) : paletteIndex.slice(0, 10);
    paletteSelected = 0;
    results.innerHTML = filtered.length ? filtered.map((item, i) => `
      <div class="palette-item ${i === 0 ? 'selected' : ''}" data-i="${i}">
        <span class="palette-type">${esc(item.type)}</span>
        <span class="palette-title">${esc(item.title)}</span>
      </div>`).join('') : '<div class="palette-empty">No matches — try another term.</div>';
    results.dataset.count = filtered.length;
    results._filtered = filtered;
    results.querySelectorAll('.palette-item').forEach(el => {
      el.addEventListener('click', () => { filtered[+el.dataset.i].action(); close(); });
    });
  }

  searchBtn.addEventListener('click', open);
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){ e.preventDefault(); open(); }
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) close();
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  input.addEventListener('input', () => renderResults(input.value));
  input.addEventListener('keydown', e => {
    const items = results.querySelectorAll('.palette-item');
    if (!items.length) return;
    if (e.key === 'ArrowDown'){ e.preventDefault(); paletteSelected = Math.min(paletteSelected + 1, items.length - 1); updateSelected(items); }
    if (e.key === 'ArrowUp'){ e.preventDefault(); paletteSelected = Math.max(paletteSelected - 1, 0); updateSelected(items); }
    if (e.key === 'Enter'){ e.preventDefault(); results._filtered[paletteSelected]?.action(); close(); }
  });
  function updateSelected(items){
    items.forEach((el, i) => el.classList.toggle('selected', i === paletteSelected));
    items[paletteSelected]?.scrollIntoView({ block: 'nearest' });
  }
}

function renderConnectLinks(){
  const grid = document.getElementById('connectGrid');
  if (!grid) return;
  grid.querySelectorAll('.connect-card-custom').forEach(el => el.remove());
  (liveData.connectLinks || []).forEach(link => {
    const card = document.createElement('div');
    card.className = 'glass panel connect-card connect-card-custom';
    card.innerHTML = `
      <div class="connect-top">
        <span style="font-size:1.6rem; line-height:1;">${esc(link.emoji || '🔗')}</span>
        <div><h3>${esc(link.label || 'Link')}</h3></div>
      </div>
      <a href="${esc(link.url || '#')}" target="_blank" rel="noopener" class="btn btn-glass btn-block">Visit ↗</a>`;
    grid.appendChild(card);
  });
}

/* ====================================================================
   18. EASTER EGGS, BADGES & MINI-GAME (disabled in Recruiter Mode)
   ==================================================================== */
function eggsAllowed(){
  const adminEnabled = liveData && liveData.settings && liveData.settings.eggsEnabled !== false;
  return adminEnabled && !document.body.classList.contains('recruiter-mode');
}

function consoleWelcome(){
  console.log('%c👋 Hey, curious developer.', 'color:#6ee7d8; font-size:16px; font-weight:bold;');
  console.log('%cSince you\'re here — try the Konami code (↑ ↑ ↓ ↓ ← → ← → B A), or click the ☕ in the footer a few times.', 'color:#a78bfa; font-size:12px;');
  console.log('%cWant to talk instead? yashwanthriya25@gmail.com', 'color:#aab2c5; font-size:12px;');
}

function getBadges(){ try { return JSON.parse(localStorage.getItem('portfolio_badges') || '[]'); } catch(e){ return []; } }
function awardBadge(name){
  const badges = getBadges();
  if (badges.includes(name)) return;
  badges.push(name);
  localStorage.setItem('portfolio_badges', JSON.stringify(badges));
  showBadgeToast(`🏆 Badge unlocked: ${name}`);
  sfxBadge();
}
function showBadgeToast(msg){
  const toast = document.getElementById('badgeToast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove('hidden');
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.classList.add('hidden'), 400); }, 3200);
}

// Small, transparent, quick — for low-key confirmations (e.g. Hire Me sent) that
// shouldn't feel as loud/celebratory as the gradient badge-unlock toast above.
function showMiniToast(msg){
  let toast = document.getElementById('miniToast');
  if (!toast){
    toast = document.createElement('div');
    toast.id = 'miniToast';
    toast.className = 'mini-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => toast.classList.remove('show'), 1600);
}

// ---- Coffee cup easter egg (footer): 5 clicks within 3s -> confetti + badge ----
function initCoffeeEgg(){
  const egg = document.getElementById('coffeeEgg');
  if (!egg) return;
  let clicks = 0, timer = null;
  egg.addEventListener('click', () => {
    if (!eggsAllowed()) return;
    clicks++;
    clearTimeout(timer);
    timer = setTimeout(() => clicks = 0, 3000);
    if (clicks >= 5){
      clicks = 0;
      fireGimmick();
      awardBadge('Caffeine Detective ☕');
    }
  });
}

function fireConfetti(){
  const colors = ['#6ee7d8', '#a78bfa', '#f0a8d0', '#ffd166'];
  for (let i = 0; i < 60; i++){
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = (Math.random() * 0.4) + 's';
    piece.style.transform = `rotate(${Math.random()*360}deg)`;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 2600);
  }
}

// ---- Konami code -> Matrix Mode ----
function initKonami(){
  const seq = ['ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','ArrowUp','ArrowDown'];
  const reverseSeq = ['ArrowUp','ArrowDown','ArrowUp','ArrowDown','ArrowRight','ArrowLeft','ArrowRight','ArrowLeft'];
  let pos = 0, rPos = 0;
  document.addEventListener('keydown', e => {
    if (!eggsAllowed()) return;
    const key = e.key;
    if (key === seq[pos]) pos++; else pos = (key === seq[0]) ? 1 : 0;
    if (pos === seq.length){
      pos = 0;
      toggleMatrixMode();
      awardBadge('Konami Master 🕹️');
    }
    if (key === reverseSeq[rPos]) rPos++; else rPos = (key === reverseSeq[0]) ? 1 : 0;
    if (rPos === reverseSeq.length){
      rPos = 0;
      toggleInverseMode();
      awardBadge('Mirror Mode 🔄');
    }
  });
}

let inverseTimer = null;
function toggleInverseMode(){
  const on = !document.body.classList.contains('inverse-mode');
  document.body.classList.toggle('inverse-mode', on);
  showBadgeToast(on ? '🔄 Mirror Mode activated — do the sequence again to undo' : '🔄 Mirror Mode off');
}

let matrixAnimFrame = null;
function toggleMatrixMode(){
  const on = !document.body.classList.contains('matrix-mode');
  document.body.classList.toggle('matrix-mode', on);
  const canvas = document.getElementById('matrixCanvas');
  if (on){
    canvas.classList.remove('hidden');
    runMatrixRain(canvas);
    showBadgeToast('🟢 Developer Mode: Matrix rain activated — press the code again to exit');
  } else {
    canvas.classList.add('hidden');
    cancelAnimationFrame(matrixAnimFrame);
  }
}
function runMatrixRain(canvas){
  const ctx = canvas.getContext('2d');
  function resize(){ canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  resize();
  const chars = '01アイウエオカキクケコ<>{}[]/;=+-'.split('');
  const cols = Math.floor(canvas.width / 16);
  const drops = new Array(cols).fill(0);
  function tick(){
    ctx.fillStyle = 'rgba(10,13,20,0.08)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#6ee7d8';
    ctx.font = '14px monospace';
    drops.forEach((y, i) => {
      const char = chars[Math.floor(Math.random() * chars.length)];
      ctx.fillText(char, i * 16, y * 16);
      drops[i] = (y * 16 > canvas.height && Math.random() > 0.975) ? 0 : y + 1;
    });
    if (document.body.classList.contains('matrix-mode')) matrixAnimFrame = requestAnimationFrame(tick);
  }
  tick();
}

// ---- GAME HUB: menu switching between Bug Squash / Snake / Dino ----
function initGameHub(){
  const overlay = document.getElementById('gameOverlay');
  const closeBtn = document.getElementById('gameCloseBtn');
  const menu = document.getElementById('gameMenu');
  const panels = { bugsquash: document.getElementById('gameBugSquash'), snake: document.getElementById('gameSnake'), dino: document.getElementById('gameDino') };

  function showMenu(){
    menu.classList.remove('hidden');
    Object.values(panels).forEach(p => p.classList.add('hidden'));
    stopAllGames();
  }
  function showPanel(key){
    menu.classList.add('hidden');
    Object.entries(panels).forEach(([k, p]) => p.classList.toggle('hidden', k !== key));
  }
  function openHub(){ showOverlay(overlay); showMenu(); }
  function closeHub(){ stopAllGames(); hideOverlay(overlay); }

  document.getElementById('gameLauncherBtn').addEventListener('click', () => {
    if (!eggsAllowed()) return;
    requireVisitorGate(openHub);
  });
  closeBtn.addEventListener('click', closeHub);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeHub(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeHub(); });

  menu.querySelectorAll('.game-menu-card').forEach(card => {
    card.addEventListener('click', () => showPanel(card.dataset.game));
  });
  overlay.querySelectorAll('[data-back]').forEach(btn => btn.addEventListener('click', showMenu));

  window.__openGameHub = openHub;
  initBugSquashGame();
  initSnakeGame();
  initDinoGame();
}
function stopAllGames(){
  if (window.__stopBugSquash) window.__stopBugSquash();
  if (window.__stopSnake) window.__stopSnake();
  if (window.__stopDino) window.__stopDino();
}

// ---- Bug Squash mini-game ----
let gameInterval = null, gameTimerInterval = null, gameScore = 0, gameRunning = false;
function initBugSquashGame(){
  const startBtn = document.getElementById('gameStartBtn');
  const startOverlay = document.getElementById('gameStartOverlay');
  const field = document.getElementById('gameField');
  const scoreEl = document.getElementById('gameScore');
  const timeEl = document.getElementById('gameTime');
  const bestEl = document.getElementById('gameBest');
  bestEl.textContent = localStorage.getItem('bug_squash_best') || 0;
  startBtn.addEventListener('click', startGame);

  function startGame(){
    startOverlay.classList.add('hidden');
    gameScore = 0; scoreEl.textContent = 0;
    let timeLeft = 30; timeEl.textContent = timeLeft;
    gameRunning = true;
    field.querySelectorAll('.game-bug').forEach(b => b.remove());
    gameInterval = setInterval(spawnBug, 650);
    gameTimerInterval = setInterval(() => { timeLeft--; timeEl.textContent = timeLeft; if (timeLeft <= 0) endGame(); }, 1000);
  }
  function spawnBug(){
    if (!gameRunning) return;
    const bug = document.createElement('div');
    bug.className = 'game-bug';
    bug.textContent = '🐛';
    bug.style.left = Math.random() * 88 + '%';
    bug.style.animationDuration = (1.6 + Math.random() * 1.2) + 's';
    bug.addEventListener('click', () => { gameScore += 10; scoreEl.textContent = gameScore; bug.remove(); });
    bug.addEventListener('animationend', () => bug.remove());
    field.appendChild(bug);
  }
  function endGame(){
    stop();
    const best = +(localStorage.getItem('bug_squash_best') || 0);
    if (gameScore > best){ localStorage.setItem('bug_squash_best', gameScore); bestEl.textContent = gameScore; }
    if (gameScore >= 100) awardBadge('Bug Squasher Pro 🐛');
    startOverlay.classList.remove('hidden');
    startOverlay.querySelector('button').textContent = `Game over — scored ${gameScore}. Play again?`;
  }
  function stop(){
    gameRunning = false;
    clearInterval(gameInterval); clearInterval(gameTimerInterval);
    field.querySelectorAll('.game-bug').forEach(b => b.remove());
  }
  window.__stopBugSquash = stop;
}

// ---- Snake mini-game ----
function initSnakeGame(){
  const canvas = document.getElementById('snakeCanvas');
  const ctx = canvas.getContext('2d');
  const startBtn = document.getElementById('snakeStartBtn');
  const startOverlay = document.getElementById('snakeStartOverlay');
  const scoreEl = document.getElementById('snakeScore');
  const bestEl = document.getElementById('snakeBest');
  bestEl.textContent = localStorage.getItem('snake_best') || 0;

  const grid = 18, size = canvas.width / grid;
  let snake, dir, food, score, loop, running = false;

  function reset(){
    snake = [{x:9,y:9},{x:8,y:9},{x:7,y:9}];
    dir = {x:1,y:0};
    food = randFood();
    score = 0; scoreEl.textContent = 0;
  }
  function randFood(){ return { x: Math.floor(Math.random()*grid), y: Math.floor(Math.random()*grid) }; }
  function draw(){
    ctx.fillStyle = '#0d1117'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.font = (size*0.9) + 'px serif';
    ctx.fillText('🐛', food.x*size, food.y*size + size*0.85);
    snake.forEach((s,i) => {
      ctx.fillStyle = i === 0 ? '#6ee7d8' : '#a78bfa';
      ctx.fillRect(s.x*size+1, s.y*size+1, size-2, size-2);
    });
  }
  function tick(){
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    if (head.x < 0 || head.x >= grid || head.y < 0 || head.y >= grid || snake.some(s => s.x===head.x && s.y===head.y)){
      return endGame();
    }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y){
      score += 10; scoreEl.textContent = score;
      food = randFood();
      if (score >= 150) awardBadge('Snake Charmer 🐍');
    } else snake.pop();
    draw();
  }
  function startGame(){
    startOverlay.classList.add('hidden');
    reset(); draw(); running = true;
    clearInterval(loop); loop = setInterval(tick, 130);
  }
  function endGame(){
    stop();
    const best = +(localStorage.getItem('snake_best') || 0);
    if (score > best){ localStorage.setItem('snake_best', score); bestEl.textContent = score; }
    startOverlay.classList.remove('hidden');
    startOverlay.querySelector('button').textContent = `Game over — scored ${score}. Play again?`;
  }
  function stop(){ running = false; clearInterval(loop); }

  startBtn.addEventListener('click', startGame);
  document.addEventListener('keydown', e => {
    if (!running) return;
    const map = { ArrowUp:{x:0,y:-1}, ArrowDown:{x:0,y:1}, ArrowLeft:{x:-1,y:0}, ArrowRight:{x:1,y:0} };
    const next = map[e.key]; if (!next) return;
    if (next.x === -dir.x && next.y === -dir.y) return; // no reverse
    dir = next;
  });
  // simple swipe support
  let touchStart = null;
  canvas.addEventListener('touchstart', e => { touchStart = e.touches[0]; });
  canvas.addEventListener('touchend', e => {
    if (!touchStart || !running) return;
    const dx = e.changedTouches[0].clientX - touchStart.clientX;
    const dy = e.changedTouches[0].clientY - touchStart.clientY;
    if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? {x:1,y:0} : {x:-1,y:0};
    else dir = dy > 0 ? {x:0,y:1} : {x:0,y:-1};
  });
  window.__stopSnake = stop;
}

// ---- Dino Runner mini-game ----
function initDinoGame(){
  const canvas = document.getElementById('dinoCanvas');
  const ctx = canvas.getContext('2d');
  const startBtn = document.getElementById('dinoStartBtn');
  const startOverlay = document.getElementById('dinoStartOverlay');
  const scoreEl = document.getElementById('dinoScore');
  const bestEl = document.getElementById('dinoBest');
  bestEl.textContent = localStorage.getItem('dino_best') || 0;

  const groundY = 150;
  let dino, obstacles, speed, score, frame, running = false, raf;

  function reset(){
    dino = { y: groundY, vy: 0, jumping: false };
    obstacles = [];
    speed = 4; score = 0; frame = 0; scoreEl.textContent = 0;
  }
  function jump(){
    if (!running || dino.jumping) return;
    dino.jumping = true; dino.vy = -9;
  }
  function tick(){
    frame++;
    ctx.fillStyle = '#0d1117'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle = '#30363d'; ctx.beginPath(); ctx.moveTo(0, groundY+24); ctx.lineTo(canvas.width, groundY+24); ctx.stroke();

    dino.vy += 0.55; dino.y += dino.vy;
    if (dino.y >= groundY){ dino.y = groundY; dino.vy = 0; dino.jumping = false; }
    ctx.save();
    ctx.font = '28px serif';
    ctx.translate(30 + 26, dino.y + 22);
    ctx.scale(-1, 1);
    ctx.fillText('🦖', 0, 0);
    ctx.restore();

    if (frame % Math.max(30, 70 - Math.floor(speed*3)) === 0) obstacles.push({ x: canvas.width, hit:false });
    obstacles.forEach(o => o.x -= speed);
    obstacles = obstacles.filter(o => o.x > -30);
    obstacles.forEach(o => {
      ctx.font = '24px serif'; ctx.fillText('🐛', o.x, groundY + 20);
      const dinoBox = { x: 30, y: dino.y, w: 26, h: 26 };
      const bugBox = { x: o.x, y: groundY, w: 22, h: 22 };
      if (dinoBox.x < bugBox.x + bugBox.w && dinoBox.x + dinoBox.w > bugBox.x && dinoBox.y < bugBox.y + bugBox.h && dinoBox.y + dinoBox.h > bugBox.y){
        return endGame();
      }
    });

    score++; scoreEl.textContent = Math.floor(score/5);
    if (score % 300 === 0) speed += 0.6;
    if (Math.floor(score/5) >= 100) awardBadge('Deadline Dodger 🦖');
    if (running) raf = requestAnimationFrame(tick);
  }
  function startGame(){
    startOverlay.classList.add('hidden');
    reset(); running = true; raf = requestAnimationFrame(tick);
  }
  function endGame(){
    stop();
    const finalScore = Math.floor(score/5);
    const best = +(localStorage.getItem('dino_best') || 0);
    if (finalScore > best){ localStorage.setItem('dino_best', finalScore); bestEl.textContent = finalScore; }
    startOverlay.classList.remove('hidden');
    startOverlay.querySelector('button').textContent = `Game over — scored ${finalScore}. Play again?`;
  }
  function stop(){ running = false; cancelAnimationFrame(raf); }

  startBtn.addEventListener('click', startGame);
  document.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'ArrowUp'){ e.preventDefault(); jump(); } });
  canvas.addEventListener('touchstart', e => { e.preventDefault(); jump(); });
  canvas.addEventListener('click', jump);
  window.__stopDino = stop;
}

/* ====================================================================
   19. EASTER EGG HINTS PANEL
   ==================================================================== */
const HINT_LIST = [
  { id: 'konami', text: 'A classic cheat-code rhythm (← → ← → ↑ ↓ ↑ ↓) does something here. Same code turns it off.' },
  { id: 'coffee', text: 'The footer has a tiny ☕ — it might like being clicked. Repeatedly.' },
  { id: 'games', text: 'Bored? There\'s a 🎮 floating around for exactly that.' },
  { id: 'star', text: 'Keep an eye out for something shiny drifting across the screen.' },
  { id: 'console', text: 'Open your browser console (F12) — someone left a note.' },
  { id: 'logo', text: 'Double-clicking the logo does something a single click doesn\'t.' },
];
function initHintsPanel(){
  const btn = document.getElementById('hintsBtn');
  const panel = document.getElementById('hintsPanel');
  const closeBtn = document.getElementById('hintsCloseBtn');
  const list = document.getElementById('hintsList');
  const progress = document.getElementById('hintsProgress');

  function render(){
    const found = getBadges();
    const map = { 'konami': 'Konami Master 🕹️', 'coffee': 'Caffeine Detective ☕', 'games': 'Bug Squasher Pro 🐛', 'star': 'Star Catcher ⭐', 'scroll': 'Full Scroll 📜', 'logo': 'Rainbow Finder 🌈' };
    list.innerHTML = HINT_LIST.map(h => {
      const isFound = h.id === 'console' ? false : found.includes(map[h.id]);
      return `<li class="${isFound ? 'found' : ''}">${esc(h.text)}</li>`;
    }).join('');
    const trackable = HINT_LIST.length - 1; // console hint has no badge to track
    const foundCount = HINT_LIST.filter(h => h.id !== 'console' && found.includes(map[h.id])).length;
    progress.textContent = `${foundCount} / ${trackable} found`;
  }

  btn.addEventListener('click', () => {
    requireVisitorGate(() => {
      panel.classList.toggle('hidden');
      if (!panel.classList.contains('hidden')) render();
    });
  });
  closeBtn.addEventListener('click', () => panel.classList.add('hidden'));
}

/* ====================================================================
   20. SCROLL MILESTONES (25/50/75/100% scrolled)
   ==================================================================== */
function initBottomGimmick(){
  let fired = false;
  window.addEventListener('scroll', () => {
    if (fired || !eggsAllowed()) return;
    const h = document.documentElement;
    if (h.scrollTop + h.clientHeight >= h.scrollHeight - 4){
      fired = true;
      awardBadge('Full Scroll 📜');
      fireGimmick();
    }
  }, { passive: true });
}

/* ====================================================================
   21. FLOATING COLLECTIBLE STAR (random drift + click to catch)
   ==================================================================== */
function initFloatingStar(){
  const star = document.getElementById('floatingStar');
  function relocate(){
    if (!eggsAllowed()){ star.classList.add('hidden'); return; }
    star.style.top = (10 + Math.random() * 70) + 'vh';
    star.style.left = (5 + Math.random() * 85) + 'vw';
    star.classList.remove('hidden');
  }
  star.addEventListener('click', () => {
    awardBadge('Star Catcher ⭐');
    fireGimmick();
    star.classList.add('hidden');
    setTimeout(relocate, 15000 + Math.random()*15000);
  });
  setTimeout(relocate, 8000);
  setInterval(() => { if (!star.classList.contains('hidden')) return; if (Math.random() < 0.5) relocate(); }, 25000);
}

/* ====================================================================
   22. FIREFLY CURSOR TRAIL (decorative, dark mode only)
   ==================================================================== */
function initFireflyTrail(){
  const canvas = document.getElementById('fireflyCanvas');
  const ctx = canvas.getContext('2d');
  let particles = [];
  function resize(){ canvas.width = innerWidth; canvas.height = innerHeight; }
  resize(); window.addEventListener('resize', resize);
  window.addEventListener('mousemove', e => {
    // Admin-controlled (Settings → Cursor style) — and always off in Recruiter Mode.
    const enabled = (liveData.settings && liveData.settings.cursorTrail) && !document.body.classList.contains('recruiter-mode');
    if (!enabled){ canvas.classList.remove('show'); particles = []; return; }
    canvas.classList.add('show');
    particles.push({ x: e.clientX, y: e.clientY, life: 1 });
    if (particles.length > 40) particles.shift();
  });
  function tick(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p => {
      p.life -= 0.025;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.4 * p.life, 0, Math.PI*2);
      ctx.fillStyle = `rgba(110,231,216,${Math.max(p.life,0)*0.5})`;
      ctx.fill();
    });
    particles = particles.filter(p => p.life > 0);
    requestAnimationFrame(tick);
  }
  tick();
}

/* ====================================================================
   23. LOGO DOUBLE-CLICK -> RAINBOW BURST EASTER EGG
   ==================================================================== */
function initLogoEasterEgg(){
  const logo = document.getElementById('logoHome');
  if (!logo) return;
  logo.addEventListener('dblclick', e => {
    e.preventDefault();
    if (!eggsAllowed()) return;
    document.body.classList.add('rainbow-burst');
    fireConfetti();
    awardBadge('Rainbow Finder 🌈');
    setTimeout(() => document.body.classList.remove('rainbow-burst'), 1800);
  });
}

/* ====================================================================
   24. PARALLAX BACKGROUND ON SCROLL
   ==================================================================== */
function initParallaxBackground(){
  const wallpaper = document.getElementById('wallpaper');
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      const totalH = document.documentElement.scrollHeight - window.innerHeight;
      // pan background-position from 50%/40% to 50%/60% as user scrolls top-to-bottom
      // — this moves the *visible crop* within the image, never reveals empty space
      if (wallpaper && wallpaper.classList.contains('show')){
        const pct = totalH > 0 ? y / totalH : 0;
        const vPos = 40 + pct * 20; // 40% → 60%
        wallpaper.style.backgroundPosition = `center ${vPos}%`;
      }
      ticking = false;
    });
  }, { passive: true });
}

/* ====================================================================
   25. VISITOR INFO GATE (asks name + contact once before games/hints)
   ==================================================================== */
function visitorGateSatisfied(){
  return localStorage.getItem('visitor_info_submitted') === '1';
}

/* Single "✨" launcher by default; once the visitor fills the info gate once,
   it's replaced by the 3 individual icons (game/hints/quiz) from then on. */
function initFunLauncher(){
  const combo = document.getElementById('funLauncherBtn');
  const gated = document.querySelectorAll('.gated-icon');
  function reveal(){
    combo.classList.add('hidden');
    gated.forEach(el => el.classList.remove('hidden'));
  }
  if (visitorGateSatisfied()){ reveal(); return; }
  combo.addEventListener('click', () => requireVisitorGate(reveal));
}
function requireVisitorGate(onUnlocked){
  if (visitorGateSatisfied()){ onUnlocked(); return; }
  const overlay = document.getElementById('visitorGateOverlay');
  const nameInput = document.getElementById('visitorName');
  const contactInput = document.getElementById('visitorContact');
  const submitBtn = document.getElementById('visitorGateSubmit');
  const status = document.getElementById('visitorGateStatus');
  const closeBtn = document.getElementById('visitorGateClose');

  showOverlay(overlay);
  const handler = async () => {
    const name = nameInput.value.trim();
    const contact = contactInput.value.trim();
    if (!name || !contact){ status.textContent = 'Please fill in both fields.'; return; }
    status.textContent = 'Saving…';
    try{
      if (supa) await supa.from('visitor_leads').insert({ name, contact, page: location.href });
    } catch(err){ console.warn('Visitor lead save skipped:', err); }
    localStorage.setItem('visitor_info_submitted', '1');
    status.textContent = '';
    hideOverlay(overlay);
    submitBtn.removeEventListener('click', handler);
    onUnlocked();
  };
  submitBtn.addEventListener('click', handler);
  closeBtn.addEventListener('click', () => hideOverlay(overlay), { once: true });
}

function applyEggsVisibility(){
  document.body.classList.toggle('eggs-off', !eggsAllowed());
}

/* ====================================================================
   26. SOUND SYSTEM (WebAudio-generated short SFX only — no ambient hum)
   ==================================================================== */
let audioCtx = null;
function getAudioCtx(){
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function soundEnabled(){ return localStorage.getItem('sound_off') !== '1'; }

function playTone(freq, dur, type, vol){
  if (!soundEnabled()) return;
  try{
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type || 'sine'; osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol || 0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + dur);
  } catch(e){}
}
function sfxClick(){ playTone(740, 0.08, 'sine', 0.045); }
function sfxSuccess(){ playTone(660,0.1,'sine',0.05); setTimeout(()=>playTone(880,0.16,'sine',0.05),90); }
function sfxFail(){ playTone(220,0.22,'sawtooth',0.04); }
function sfxBadge(){ [523,659,784,1046].forEach((f,i)=>setTimeout(()=>playTone(f,0.18,'sine',0.05), i*80)); }
function sfxOpen(){ playTone(420,0.07,'triangle',0.04); }

function initSoundToggle(){
  const btn = document.getElementById('soundToggleBtn');
  if (!btn) return;
  function applyIcon(){ btn.textContent = soundEnabled() ? '🔊' : '🔇'; }
  applyIcon();
  btn.addEventListener('click', () => {
    localStorage.setItem('sound_off', soundEnabled() ? '1' : '0');
    if (soundEnabled()) getAudioCtx().resume();
    applyIcon();
  });
  // browsers require a user gesture before audio starts — first click anywhere arms it
  document.addEventListener('click', function armAudio(){
    if (soundEnabled()) getAudioCtx().resume();
    document.removeEventListener('click', armAudio);
  }, { once: true });

  // light click sound on buttons/cards site-wide
  document.addEventListener('click', e => {
    if (e.target.closest('.btn, .icon-btn, .project-card, .cert-item, .skill-tag, .game-menu-card, .palette-item')) sfxClick();
  });
}

/* ====================================================================
   27. QR SHARE
   ==================================================================== */
function initQrShare(){
  const img = document.getElementById('qrImage');
  const copyBtn = document.getElementById('qrCopyBtn');
  const flipWrap = document.getElementById('avatarFlip');
  if (!img) return;
  const url = location.href.split('#')[0];
  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
  copyBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(url);
    if (navigator.share){ try{ await navigator.share({ title: document.title, url }); } catch(e){} }
    copyBtn.textContent = '✓ Link copied';
    setTimeout(() => copyBtn.textContent = 'Copy link instead', 2000);
  });
  if (flipWrap){
    function toggleFlip(){
      const flipping = flipWrap.classList.toggle('flipped');
      flipWrap.setAttribute('aria-label', flipping ? 'Click to go back to the profile photo' : 'Click to reveal a QR code for this site');
      sfxClick();
    }
    flipWrap.addEventListener('click', e => {
      // Ignore clicks on the slideshow's own controls (arrows/dots) and the copy button —
      // only a click on the photo/QR itself flips the card.
      if (e.target.closest('.slide-arrow, .slide-dot, #qrCopyBtn')) return;
      toggleFlip();
    });
    flipWrap.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === flipWrap){ e.preventDefault(); toggleFlip(); }
    });
  }
}

/* ====================================================================
   28. TECH QUIZ (funny/educational, gated, YouTube reward on correct)
   ==================================================================== */
const QUIZ_QUESTIONS = [
  { q: "Python's famous import joke — `import antigravity` actually opens what?", options: ["A flight simulator", "An XKCD comic in your browser", "A NASA API", "Nothing, it's a myth"], correct: 1 },
  { q: "In Git, what does `git blame` actually do?", options: ["Emails your manager", "Shows who last edited each line", "Deletes the repo", "Reverts your last commit"], correct: 1 },
  { q: "What does CNN stand for in 'AI-Based Meat Spoilage Detection'?", options: ["Cable News Network", "Convolutional Neural Network", "Central Node Network", "Custom Numeric Notation"], correct: 1 },
  { q: "FastAPI is built on top of which Python standard for async speed?", options: ["WSGI", "ASGI", "CGI", "REST"], correct: 1 },
  { q: "What's the classic developer joke ending in '...0 or 1'?", options: ["There are 10 kinds of people: those who understand binary and those who don't", "Why did the chicken cross the road", "It compiles, ship it", "404 joke not found"], correct: 0 },
  { q: "In React/JS, what does NaN === NaN evaluate to?", options: ["true", "false", "undefined", "Throws an error"], correct: 1 },
  { q: "TensorFlow and Keras are mainly used for…", options: ["Styling websites", "Deep learning models", "Database indexing", "Network routing"], correct: 1 },
];
let quizAttempt = null;
function pickQuizQuestion(){ return QUIZ_QUESTIONS[Math.floor(Math.random()*QUIZ_QUESTIONS.length)]; }
function initTechQuiz(){
  const overlay = document.getElementById('quizOverlay');
  const launcher = document.getElementById('quizLauncherBtn');
  const qView = document.getElementById('quizQuestionView');
  const correctView = document.getElementById('quizCorrectView');
  const wrongView = document.getElementById('quizWrongView');
  const qText = document.getElementById('quizQuestionText');
  const optsWrap = document.getElementById('quizOptions');
  const frame = document.getElementById('quizRewardVideoFrame');
  const localVideo = document.getElementById('quizRewardVideoLocal');

  function open(){ showOverlay(overlay); newQuestion(); }
  function close(){
    frame.src = ''; frame.classList.add('hidden');
    localVideo.pause(); localVideo.removeAttribute('src'); localVideo.load(); localVideo.classList.add('hidden');
    hideOverlay(overlay);
  }
  // Plays whichever reward video the owner has configured in admin.html → Settings → "Quiz reward video".
  // If it's a local file (uploaded via admin, ends in a video extension) it plays inline with <video>,
  // which sidesteps YouTube's embed restrictions entirely. Falls back to the YouTube embed otherwise.
  function playRewardVideo(){
    const url = (liveData.settings && liveData.settings.quizRewardVideoUrl) || '';
    const isLocalFile = /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
    if (url && isLocalFile){
      localVideo.src = url;
      localVideo.classList.remove('hidden');
      localVideo.play().catch(() => {});
    } else {
      const id = url ? extractYouTubeId(url) : 'QDia3e12czc';
      frame.src = `https://www.youtube.com/embed/${id}?autoplay=1`;
      frame.classList.remove('hidden');
    }
  }
  function extractYouTubeId(url){
    const m = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : url;
  }
  function newQuestion(){
    qView.classList.remove('hidden'); correctView.classList.add('hidden'); wrongView.classList.add('hidden');
    quizAttempt = pickQuizQuestion();
    qText.textContent = quizAttempt.q;
    optsWrap.innerHTML = quizAttempt.options.map((o, i) => `<button class="quiz-opt" data-i="${i}">${esc(o)}</button>`).join('');
    optsWrap.querySelectorAll('.quiz-opt').forEach(btn => btn.addEventListener('click', () => answer(+btn.dataset.i)));
  }
  function answer(i){
    if (i === quizAttempt.correct){
      sfxSuccess(); fireConfetti();
      qView.classList.add('hidden');
      correctView.classList.remove('hidden');
      playRewardVideo();
      awardBadge('Quiz Whiz 🧠');
    } else {
      sfxFail();
      qView.classList.add('hidden');
      wrongView.classList.remove('hidden');
    }
  }

  launcher.addEventListener('click', () => {
    if (!eggsAllowed()) return;
    requireVisitorGate(open);
  });
  document.getElementById('quizCloseBtn').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.getElementById('quizPlayAgainBtn').addEventListener('click', newQuestion);
  document.getElementById('quizRetryBtn').addEventListener('click', newQuestion);
  document.getElementById('quizSkipBtn').addEventListener('click', close);
}

/* ====================================================================
   29. VARIED RANDOM GIMMICKS (10-15 distinct micro-interactions, not
   the same confetti every time) — triggered on scroll milestones, the
   floating star, badges, etc. via fireGimmick() instead of always confetti.
   ==================================================================== */
const GIMMICKS = [
  () => fireConfetti(),
  () => screenShake(),
  () => emojiBurst(['✨','⭐','💫']),
  () => emojiBurst(['🐛','🪲','🦋']),
  () => rippleFlash(),
  () => colorPulseBorder(),
  () => emojiBurst(['☕','💻','⌨️']),
  () => floatingTextPopup(['Nice find!','+10 curiosity','Achievement unlocked','Keep exploring']),
  () => spinLogo(),
  () => emojiBurst(['🚀','🛰️','🌟']),
  () => emojiBurst(['🎉','🎊','🥳']),
];
function fireGimmick(){ if (!eggsAllowed()) return; GIMMICKS[Math.floor(Math.random()*GIMMICKS.length)](); }

function screenShake(){
  document.body.classList.add('gimmick-shake');
  setTimeout(() => document.body.classList.remove('gimmick-shake'), 400);
}
function emojiBurst(emojis){
  for (let i=0;i<10;i++){
    const el = document.createElement('span');
    el.className = 'gimmick-emoji';
    el.textContent = emojis[Math.floor(Math.random()*emojis.length)];
    el.style.left = Math.random()*100 + 'vw';
    el.style.animationDuration = (1.6 + Math.random()) + 's';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }
}
function rippleFlash(){
  const el = document.createElement('div');
  el.className = 'gimmick-ripple';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 900);
}
function colorPulseBorder(){
  document.body.classList.add('gimmick-border-pulse');
  setTimeout(() => document.body.classList.remove('gimmick-border-pulse'), 1200);
}
function floatingTextPopup(msgs){
  const el = document.createElement('div');
  el.className = 'gimmick-float-text';
  el.textContent = msgs[Math.floor(Math.random()*msgs.length)];
  el.style.left = (20 + Math.random()*60) + 'vw';
  el.style.top = (30 + Math.random()*40) + 'vh';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}
function spinLogo(){
  const logo = document.getElementById('logoHome');
  if (!logo) return;
  logo.classList.add('gimmick-spin');
  setTimeout(() => logo.classList.remove('gimmick-spin'), 800);
}

/* ====================================================================
   30. SECTION ACCORDION (homepage sections collapse to title-only)
   ==================================================================== */
function initSectionAccordion(){
  // No-op: per-card accordions (projects, certifications) are handled
  // directly inside renderAll() now instead of collapsing whole sections.
}

/* ====================================================================
   BOOT
   ==================================================================== */
(async function boot(){
  initIntroSplash();
  initFontSizeControl();
  initAdminLockPopup();
  initTheme();
  initConstellation();
  await loadContent();
  applySettings();
  renderAll();
  initLiveClock();
  initLiveSync();
  initSlideshow();
  startRoleCycler();
  initCounters();
  initBackToTop();
  initCopyEmail();
  initLogoHome();
  initRecruiterMode();
  initPrintResumeButton();
  initSaveContactCard();
  initBookingButton();
  initAnalyticsLogging();
  initMobileBottomBar();
  initMagneticButtons();
  initCompactMode();
  initMinimapMode();
  initHeroParallax();
  initSectionNavTransition();
  initSkillMatchAnalyzer();
  renderNavLinks();
  initFloatingUIOffset();
  initSoundToggle();
  initCommandPalette();
  applyDynamicGreeting();
  tagTiltCards();
  consoleWelcome();
  initCoffeeEgg();
  initKonami();
  initGameHub();
  initHintsPanel();
  initFunLauncher();
  applyEggsVisibility();
  initFloatingStar();
  initBottomGimmick();
  initFireflyTrail();
  initParallaxBackground();
  initLogoEasterEgg();
  initQrShare();
  initTechQuiz();
  initSectionAccordion();
  initProjectModal();
  initCertModal();
  initHireMe();
  initAvatarWidget();
  loadGithubRepos();
})();
