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

// Ensures older saved content (from before new fields existed) doesn't break
// rendering — anything missing falls back to the data.js seed shape.
function mergeWithDefaults(content){
  const merged = Object.assign({}, SITE_DATA, content);
  merged.settings = Object.assign({}, SITE_DATA.settings, content.settings || {});
  merged.sectionVisibility = Object.assign({}, SITE_DATA.sectionVisibility, content.sectionVisibility || {});
  merged.sectionMeta = Object.assign({}, SITE_DATA.sectionMeta, content.sectionMeta || {});
  merged.customSections = content.customSections || [];
  return merged;
}

/* ====================================================================
   1. APPLY SETTINGS AS CSS VARIABLES
   ==================================================================== */
function applySettings(){
  const s = liveData.settings || SITE_DATA.settings;
  const root = document.documentElement.style;
  root.setProperty('--icon-btn-size', (s.iconButtonSize || 36) + 'px');
  root.setProperty('--avatar-size', (s.avatarSize || 320) + 'px');
  root.setProperty('--card-radius', (s.cardRadius || 18) + 'px');
  root.setProperty('--glass-blur', (s.glassBlur || 18) + 'px');
  root.setProperty('--section-spacing', (s.sectionSpacing || 130) + 'px');

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

  // Skills
  const skillsGrid = document.getElementById('skillsGrid');
  skillsGrid.innerHTML = liveData.skills.map(group => `
    <div class="glass skill-card panel reveal">
      <h4>${esc(group.category)}</h4>
      <div class="skill-tags">${group.items.map(i => `<span class="skill-tag">${esc(i)}</span>`).join('')}</div>
    </div>`).join('');

  // Projects
  const projectsGrid = document.getElementById('projectsGrid');
  projectsGrid.innerHTML = liveData.projects.map((p, idx) => `
    <div class="glass project-card panel reveal" data-index="${idx}" tabindex="0" role="button" aria-haspopup="dialog">
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.desc)}</p>
      <div class="project-tags">${(p.tags||[]).map(t => `<span>${esc(t)}</span>`).join('')}</div>
      ${p.metrics && p.metrics.length ? `<div class="metrics-row">${p.metrics.map(m => `<span class="metric-badge">${esc(m.label)}: ${esc(m.value)}</span>`).join('')}</div>` : ''}
      <span class="project-link">View details ↗</span>
    </div>`).join('');

  // Certifications
  const certsList = document.getElementById('certsList');
  certsList.innerHTML = liveData.certifications.map((c, idx) => `
    <div class="glass cert-item panel reveal" data-index="${idx}" tabindex="0" role="button" aria-haspopup="dialog">
      <div class="cert-main">
        <div class="cert-badge">✓</div>
        <div><div class="cert-name">${esc(c.name)}</div><div class="cert-issuer">${esc(c.issuer)}</div></div>
      </div>
      <div class="cert-year">${esc(c.year)}</div>
    </div>`).join('');

  // Hobbies
  const hobbiesRow = document.getElementById('hobbiesRow');
  hobbiesRow.innerHTML = liveData.hobbies.map(h => `
    <div class="hobby-chip reveal"><span class="hobby-emoji">${h.emoji}</span>${esc(h.label)}</div>`).join('');

  // Education + Languages
  const eduList = document.getElementById('eduList');
  if (eduList){
    eduList.innerHTML = (liveData.education || []).map(e => `
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

  // Experience
  const expList = document.getElementById('experienceList');
  if (expList){
    const exp = liveData.experience || [];
    expList.innerHTML = exp.length ? exp.map(e => `
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
      <div class="glass achievement-card panel reveal">
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
  renderCustomSections();
  applySectionVisibility();
  applySectionMeta();
  initReveal();
}

function esc(str){
  if (str === undefined || str === null) return '';
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
  track.innerHTML = items.map(it => `
    <div class="timeline-node reveal">
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
  let w, h, nodes = [];
  const COUNT = window.innerWidth < 760 ? 35 : 70;

  function getThemeColors(){
    const styles = getComputedStyle(document.documentElement);
    return {
      line: styles.getPropertyValue('--line-color').trim() || '120,180,200',
      node: styles.getPropertyValue('--node-color').trim() || '160,220,210'
    };
  }
  let colors = getThemeColors();
  window.addEventListener('themechange', () => { colors = getThemeColors(); });

  function resize(){ w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
  function makeNodes(){
    nodes = Array.from({length: COUNT}, () => ({
      x: Math.random()*w, y: Math.random()*h,
      vx: (Math.random()-0.5)*0.25, vy: (Math.random()-0.5)*0.25,
      r: Math.random()*1.6 + 0.6
    }));
  }
  resize(); makeNodes();
  window.addEventListener('resize', () => { resize(); makeNodes(); });

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function tick(){
    ctx.clearRect(0,0,w,h);
    for (const n of nodes){
      if (!reduceMotion){ n.x += n.vx; n.y += n.vy; }
      if (n.x < 0 || n.x > w) n.vx *= -1;
      if (n.y < 0 || n.y > h) n.vy *= -1;
    }
    for (let i=0; i<nodes.length; i++){
      for (let j=i+1; j<nodes.length; j++){
        const a = nodes[i], b = nodes[j];
        const dx = a.x-b.x, dy = a.y-b.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 150){
          ctx.strokeStyle = `rgba(${colors.line},${0.12 * (1 - dist/150)})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
        }
      }
    }
    for (const n of nodes){
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(${colors.node},0.6)`;
      ctx.fill();
    }
    requestAnimationFrame(tick);
  }
  tick();
}

/* ====================================================================
   5. SCROLL REVEAL + STAT COUNTERS
   ==================================================================== */
function initReveal(){
  const els = document.querySelectorAll('.reveal:not(.in)');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting){ e.target.classList.add('in'); obs.unobserve(e.target); } });
  }, { threshold: 0.12 });
  els.forEach(el => obs.observe(el));
}

function initCounters(){
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
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  const initial = saved || (prefersLight ? 'light' : 'dark');
  applyTheme(initial);

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
    root.addEventListener('click', e => {
      if (e.target.closest('.slide-arrow') || e.target.closest('.slide-dot')) return;
      next(); restartTimer();
    });
    root.addEventListener('mouseenter', () => { next(); restartTimer(); });
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
    const card = e.target.closest('.project-card'); if (!card) return;
    const idx = +card.dataset.index;
    if (activeProjectIndex === idx && !overlay.classList.contains('hidden')) close();
    else open(idx);
  });
  grid.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.project-card'); if (!card) return;
    e.preventDefault(); open(+card.dataset.index);
  });

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
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
    const card = e.target.closest('.cert-item'); if (!card) return;
    const idx = +card.dataset.index;
    if (activeCertIndex === idx && !overlay.classList.contains('hidden')) close();
    else open(idx);
  });
  list.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.cert-item'); if (!card) return;
    e.preventDefault(); open(+card.dataset.index);
  });

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
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
function initScrollProgress(){
  const bar = document.getElementById('scrollProgress');
  window.addEventListener('scroll', () => {
    const h = document.documentElement;
    const pct = (h.scrollTop) / (h.scrollHeight - h.clientHeight) * 100;
    bar.style.width = pct + '%';
  });
}

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
  el.textContent = `● ${greeting} — open to opportunities, M.Tech Software Engineering 2026`;
}

/* ====================================================================
   16. RECRUITER MODE (hides non-essential sections client-side)
   ==================================================================== */
const RECRUITER_HIDE = ['hobbies', 'connect', 'achievements', 'timeline'];
function initRecruiterMode(){
  const btn = document.getElementById('recruiterModeBtn');
  function apply(on){
    document.body.classList.toggle('recruiter-mode', on);
    RECRUITER_HIDE.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = on ? 'none' : (liveData.sectionVisibility?.[id] === false ? 'none' : '');
    });
    btn.classList.toggle('active-toggle', on);
    localStorage.setItem('recruiter_mode', on ? '1' : '0');
  }
  btn.addEventListener('click', () => apply(!document.body.classList.contains('recruiter-mode')));
  if (localStorage.getItem('recruiter_mode') === '1') apply(true);
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

/* ====================================================================
   BOOT
   ==================================================================== */
(async function boot(){
  initTheme();
  initConstellation();
  await loadContent();
  applySettings();
  renderAll();
  initSlideshow();
  startRoleCycler();
  initCounters();
  initBackToTop();
  initCopyEmail();
  initLogoHome();
  initScrollProgress();
  initRecruiterMode();
  initCommandPalette();
  applyDynamicGreeting();
  tagTiltCards();
  initProjectModal();
  initCertModal();
  loadGithubRepos();
})();
