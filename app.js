// app.js
document.getElementById('year').textContent = new Date().getFullYear();

/* ====================================================================
   0. SUPABASE BOOTSTRAP
   ==================================================================== */
let supa = null;
let liveData = null; // the content object actually rendered (from DB or seed)
let isUnlocked = false;

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
      liveData = data.content;
      return;
    }
    // no row yet -> seed it with data.js defaults
    await supa.from('site_content').upsert({ id: 'main', content: SITE_DATA });
    liveData = SITE_DATA;
    return;
  }
  // fallback: browser storage only
  const cached = localStorage.getItem('site_content_cache');
  liveData = cached ? JSON.parse(cached) : SITE_DATA;
}

async function saveContent(){
  localStorage.setItem('site_content_cache', JSON.stringify(liveData));
  if (supa){
    await supa.from('site_content').upsert({ id: 'main', content: liveData });
  }
}

/* ====================================================================
   1. RENDER SECTIONS FROM liveData
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
      <h4>${group.category}</h4>
      <div class="skill-tags">${group.items.map(i => `<span class="skill-tag">${i}</span>`).join('')}</div>
    </div>`).join('');

  // Projects
  const projectsGrid = document.getElementById('projectsGrid');
  projectsGrid.innerHTML = liveData.projects.map((p, idx) => `
    <div class="glass project-card panel reveal" data-index="${idx}" tabindex="0" role="button" aria-haspopup="dialog">
      <h3>${p.title}</h3>
      <p>${p.desc}</p>
      <div class="project-tags">${p.tags.map(t => `<span>${t}</span>`).join('')}</div>
      <span class="project-link">View details ↗</span>
    </div>`).join('');

  // Certifications
  const certsList = document.getElementById('certsList');
  certsList.innerHTML = liveData.certifications.map((c, idx) => `
    <div class="glass cert-item panel reveal" data-index="${idx}" tabindex="0" role="button" aria-haspopup="dialog">
      <div class="cert-main">
        <div class="cert-badge">✓</div>
        <div><div class="cert-name">${c.name}</div><div class="cert-issuer">${c.issuer}</div></div>
      </div>
      <div class="cert-year">${c.year}</div>
    </div>`).join('');

  // Hobbies
  const hobbiesRow = document.getElementById('hobbiesRow');
  hobbiesRow.innerHTML = liveData.hobbies.map(h => `
    <div class="hobby-chip reveal"><span class="hobby-emoji">${h.emoji}</span>${h.label}</div>`).join('');

  renderYoutubeCard();
  initReveal();
}

/* ====================================================================
   1b. YOUTUBE CARD (banner + logo + visit button, no embed)
   ==================================================================== */
function renderYoutubeCard(){
  const banner = document.getElementById('ytBannerImg');
  const logo = document.getElementById('ytLogoImg');
  const subs = document.getElementById('ytSubs');
  if (liveData.youtube_banner) banner.src = liveData.youtube_banner;
  if (liveData.youtube_logo) logo.src = liveData.youtube_logo;
  subs.textContent = liveData.youtube_subs ? `${liveData.youtube_subs} subscribers` : '';
}

/* ====================================================================
   2. ROLE CYCLER (hero subtitle word swap)
   ==================================================================== */
function startRoleCycler(){
  const el = document.getElementById('roleCycler');
  let i = 0;
  setInterval(() => {
    i = (i + 1) % SITE_DATA.roles.length;
    const roles = (liveData && liveData.roles) ? liveData.roles : SITE_DATA.roles;
    el.style.opacity = 0;
    setTimeout(() => {
      el.textContent = roles[i % roles.length];
      el.style.opacity = 1;
    }, 280);
  }, 2800);
  el.style.transition = 'opacity .28s ease';
}

/* ====================================================================
   3. ANIMATED CONSTELLATION BACKGROUND
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

  function resize(){
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
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
   4. SCROLL REVEAL + STAT COUNTERS
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
   5. LIVE GITHUB REPOSITORIES (GitHub public REST API, no auth needed)
   ==================================================================== */
const LANG_COLORS = {
  Python:'#3572A5', JavaScript:'#f1e05a', Java:'#b07219', HTML:'#e34c26',
  CSS:'#563d7c', Jupyter:'#DA5B0B', 'Jupyter Notebook':'#DA5B0B', TypeScript:'#2b7489', default:'#8b949e'
};

async function loadGithubRepos(){
  const grid = document.getElementById('reposGrid');
  const status = document.getElementById('githubStatus');
  const username = liveData.github_username || 'Yashraj2523';
  try{
    const res = await fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=8`);
    if (!res.ok) throw new Error('GitHub API error ' + res.status);
    const repos = await res.json();
    if (!Array.isArray(repos) || repos.length === 0){
      status.textContent = 'No public repositories found yet.';
      return;
    }
    status.textContent = `Showing ${repos.length} most recently updated public repositories — live from GitHub.`;
    grid.innerHTML = repos.map(r => `
      <div class="glass repo-card panel reveal">
        <div class="repo-top">
          <span class="repo-name">${r.name}</span>
          <span style="color:var(--ink-2); font-size:.78rem;">★ ${r.stargazers_count}</span>
        </div>
        <p class="repo-desc">${r.description ? r.description : 'No description provided.'}</p>
        <div class="repo-meta">
          ${r.language ? `<span><span class="repo-lang-dot" style="background:${LANG_COLORS[r.language] || LANG_COLORS.default}"></span>${r.language}</span>` : ''}
          <span>Updated ${new Date(r.pushed_at).toLocaleDateString('en-IN', {month:'short', year:'numeric'})}</span>
        </div>
        <a class="project-link" href="${r.html_url}" target="_blank" rel="noopener">Open repository ↗</a>
      </div>`).join('');
    initReveal();
  } catch(err){
    status.textContent = 'Could not reach GitHub right now — showing cached project list above instead.';
    console.error(err);
  }
}

/* ====================================================================
   6. THEME TOGGLE (light/dark, persisted)
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
  document.querySelector('meta[name="theme-color"]').setAttribute('content', theme === 'light' ? '#f4f6fa' : '#0a0d14');
  window.dispatchEvent(new Event('themechange'));
}

/* ====================================================================
   7. BACK TO TOP
   ==================================================================== */
function initBackToTop(){
  const btn = document.getElementById('backToTop');
  window.addEventListener('scroll', () => {
    btn.classList.toggle('hidden', window.scrollY < 500);
  });
  btn.addEventListener('click', () => window.scrollTo({top:0, behavior:'smooth'}));
}

/* ====================================================================
   8. COPY EMAIL
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
   9. OWNER LOGIN (real Supabase Auth — only the registered owner account works)
   ==================================================================== */
function initAuth(){
  // Editing now happens exclusively in admin.html (separate dashboard).
  // This function is intentionally a no-op on the public site so old
  // boot() calls referencing it don't throw on removed elements.
}

function enableEditableFields(){
  const editableSelectors = ['[data-edit="hero_name"]', '[data-edit="hero_sub"]', '[data-edit="about_text"]', '[data-edit="linkedin_blurb"]'];
  editableSelectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      el.contentEditable = "true";
      el.addEventListener('blur', async () => {
        const key = el.getAttribute('data-edit');
        if (key === 'about_text') liveData.about_text_html = el.innerHTML;
        else liveData[key] = el.textContent;
        await saveContent();
      });
    });
  });

  // make skill tags / project cards / certs / hobbies editable by double-clicking a card
  document.getElementById('skillsGrid').addEventListener('dblclick', e => {
    const card = e.target.closest('.skill-card'); if (!card) return;
    const idx = [...document.getElementById('skillsGrid').children].indexOf(card);
    const group = liveData.skills[idx];
    const newItems = prompt(`Edit "${group.category}" skills (comma separated):`, group.items.join(', '));
    if (newItems !== null){
      group.items = newItems.split(',').map(s => s.trim()).filter(Boolean);
      renderAll(); saveContent();
    }
  });

  document.getElementById('projectsGrid').addEventListener('dblclick', e => {
    const card = e.target.closest('.project-card'); if (!card) return;
    const idx = +card.dataset.index;
    const p = liveData.projects[idx];
    const newDesc = prompt(`Edit description for "${p.title}":`, p.desc);
    if (newDesc === null) return;
    p.desc = newDesc;
    const newGithub = prompt('GitHub link (leave blank to remove):', p.github || '');
    p.github = newGithub || '';
    const newDemo = prompt('Live demo link (leave blank if none):', p.demo || '');
    p.demo = newDemo || '';
    renderAll(); saveContent();
  });

  document.getElementById('certsList').addEventListener('dblclick', e => {
    const card = e.target.closest('.cert-item'); if (!card) return;
    const idx = +card.dataset.index;
    const c = liveData.certifications[idx];
    const newYear = prompt(`Edit year for "${c.name}":`, c.year);
    if (newYear === null) return;
    c.year = newYear;
    const newFile = prompt('Certificate file URL (image or PDF, leave blank if none):', c.file || '');
    c.file = newFile || '';
    renderAll(); saveContent();
  });

  document.getElementById('hobbiesRow').addEventListener('dblclick', e => {
    const chip = e.target.closest('.hobby-chip'); if (!chip) return;
    const idx = [...document.getElementById('hobbiesRow').children].indexOf(chip);
    const h = liveData.hobbies[idx];
    const newLabel = prompt('Edit hobby label:', h.label);
    if (newLabel !== null){ h.label = newLabel; renderAll(); saveContent(); }
  });

  // profile photos: double-click the slideshow to manage the photo list
  document.getElementById('profileSlideshow').addEventListener('dblclick', e => {
    e.stopPropagation();
    const current = (liveData.profile_photos || []).join('\n');
    const next = prompt('Profile photos — one image URL per line:', current);
    if (next !== null){
      liveData.profile_photos = next.split('\n').map(s => s.trim()).filter(Boolean);
      initSlideshow(); saveContent();
    }
  });
}

/* ====================================================================
   10. PROFILE PHOTO SLIDESHOW
   ==================================================================== */
let slideTimer = null;
function initSlideshow(){
  const root = document.getElementById('profileSlideshow');
  const track = document.getElementById('slideshowTrack');
  const dotsWrap = document.getElementById('slideshowDots');
  const photos = (liveData.profile_photos && liveData.profile_photos.length) ? liveData.profile_photos : SITE_DATA.profile_photos;
  let current = 0;

  track.innerHTML = photos.map((src, i) => `
    <div class="slide ${i === 0 ? 'active' : ''}" data-i="${i}">
      <img src="${src}" alt="Profile photo ${i+1}" loading="${i === 0 ? 'eager' : 'lazy'}" />
    </div>`).join('');
  dotsWrap.innerHTML = photos.map((_, i) => `<button class="slide-dot ${i===0?'active':''}" data-i="${i}" aria-label="Show photo ${i+1}"></button>`).join('');

  function goTo(i){
    current = (i + photos.length) % photos.length;
    track.querySelectorAll('.slide').forEach(s => s.classList.toggle('active', +s.dataset.i === current));
    dotsWrap.querySelectorAll('.slide-dot').forEach(d => d.classList.toggle('active', +d.dataset.i === current));
  }
  function next(){ goTo(current + 1); }

  function restartTimer(){
    clearInterval(slideTimer);
    slideTimer = setInterval(next, 4200);
  }
  restartTimer();

  if (photos.length > 1){
    root.addEventListener('click', () => { next(); restartTimer(); });
    root.addEventListener('mouseenter', () => { next(); restartTimer(); });
    root.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); next(); restartTimer(); } });
    dotsWrap.addEventListener('click', e => {
      const dot = e.target.closest('.slide-dot'); if (!dot) return;
      e.stopPropagation();
      goTo(+dot.dataset.i); restartTimer();
    });
  } else {
    dotsWrap.style.display = 'none';
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
    document.getElementById('projModalTags').innerHTML = (p.tags || []).map(t => `<span>${t}</span>`).join('');

    const featuresWrap = document.getElementById('projModalFeaturesWrap');
    const featuresList = document.getElementById('projModalFeatures');
    if (p.features && p.features.length){
      featuresList.innerHTML = p.features.map(f => `<li>${f}</li>`).join('');
      featuresWrap.style.display = 'block';
    } else featuresWrap.style.display = 'none';

    const shotsWrap = document.getElementById('projModalShotsWrap');
    const shotsGrid = document.getElementById('projModalShots');
    if (p.screenshots && p.screenshots.length){
      shotsGrid.innerHTML = p.screenshots.map(s => `<img src="${s}" alt="${p.title} screenshot" loading="lazy" />`).join('');
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
    e.preventDefault();
    open(+card.dataset.index);
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
  const canvas = document.getElementById('certViewerCanvas');

  function setZoom(z, x, y){
    certZoom = Math.min(Math.max(z, 0.3), 6);
    certPanX = x; certPanY = y;
    img.style.transform = `translate(${certPanX}px, ${certPanY}px) scale(${certZoom})`;
  }
  function resetZoom(){ setZoom(1, 0, 0); }
  function fitZoom(){ setZoom(1, 0, 0); }

  function open(idx){
    const c = liveData.certifications[idx];
    if (!c) return;
    document.getElementById('certModalTitle').textContent = c.name;
    document.getElementById('certModalMeta').textContent = `${c.issuer} · ${c.year}`;

    img.classList.add('hidden'); pdf.classList.add('hidden'); emptyMsg.classList.add('hidden');
    resetZoom();

    if (c.file && /\.pdf($|\?)/i.test(c.file)){
      pdf.src = c.file; pdf.classList.remove('hidden');
    } else if (c.file){
      img.src = c.file; img.classList.remove('hidden');
    } else {
      emptyMsg.classList.remove('hidden');
    }
    activeCertIndex = idx;
    showOverlay(overlay);
  }
  function close(){ hideOverlay(overlay); activeCertIndex = null; pdf.src = ''; }

  list.addEventListener('click', e => {
    const card = e.target.closest('.cert-item'); if (!card) return;
    const idx = +card.dataset.index;
    if (activeCertIndex === idx && !overlay.classList.contains('hidden')) close();
    else open(idx);
  });
  list.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.cert-item'); if (!card) return;
    e.preventDefault();
    open(+card.dataset.index);
  });

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !overlay.classList.contains('hidden')) close(); });

  // zoom buttons
  document.getElementById('certZoomIn').addEventListener('click', () => setZoom(certZoom + 0.3, certPanX, certPanY));
  document.getElementById('certZoomOut').addEventListener('click', () => setZoom(certZoom - 0.3, certPanX, certPanY));
  document.getElementById('certZoomReset').addEventListener('click', resetZoom);
  document.getElementById('certZoomFit').addEventListener('click', fitZoom);

  // mouse wheel zoom
  canvas.addEventListener('wheel', e => {
    if (img.classList.contains('hidden')) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoom(certZoom + delta, certPanX, certPanY);
  }, { passive: false });

  // drag to pan (mouse)
  let dragging = false, lastX = 0, lastY = 0;
  img.addEventListener('mousedown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    setZoom(certZoom, certPanX + dx, certPanY + dy);
  });
  window.addEventListener('mouseup', () => dragging = false);

  // touch: pinch zoom + single-finger pan
  let touchStartDist = null, touchStartZoom = 1, lastTouchX = 0, lastTouchY = 0;
  img.addEventListener('touchstart', e => {
    if (e.touches.length === 2){
      touchStartDist = touchDist(e.touches);
      touchStartZoom = certZoom;
    } else if (e.touches.length === 1){
      lastTouchX = e.touches[0].clientX; lastTouchY = e.touches[0].clientY;
    }
  }, { passive: true });
  img.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && touchStartDist){
      const dist = touchDist(e.touches);
      setZoom(touchStartZoom * (dist / touchStartDist), certPanX, certPanY);
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

/* ====================================================================
   BOOT
   ==================================================================== */
(async function boot(){
  initTheme();
  initConstellation();
  await loadContent();
  renderAll();
  initSlideshow();
  startRoleCycler();
  initCounters();
  initAuth();
  initBackToTop();
  initCopyEmail();
  initProjectModal();
  initCertModal();
  loadGithubRepos();
})();


/* ── NEW FEATURES PATCH ── */

/* Intro splash */
function initIntroSplash(){
  const s=document.getElementById('introSplash');if(!s)return;
  if(localStorage.getItem('intro_seen')){s.remove();return;}
  setTimeout(()=>{s.classList.add('exit');setTimeout(()=>{s.remove();},700);localStorage.setItem('intro_seen','1');},4800);
  s.querySelector('#introEnterBtn')?.addEventListener('click',()=>{s.classList.add('exit');setTimeout(()=>s.remove(),700);localStorage.setItem('intro_seen','1');});
}

/* Font size controls */
function initFontSize(){
  const sizes=[13,14,15,16,17,18];let idx=+(localStorage.getItem('fsz')||2);
  const apply=()=>{document.documentElement.style.fontSize=sizes[idx]+'px';localStorage.setItem('fsz',idx);};
  document.getElementById('fontDecrBtn')?.addEventListener('click',()=>{if(idx>0){idx--;apply();}});
  document.getElementById('fontIncrBtn')?.addEventListener('click',()=>{if(idx<sizes.length-1){idx++;apply();}});
  apply();
}

/* Cursor system */
const CURSOR_CSS={default:'',dot:'cursor:none!important;',
  cross:"cursor:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cline x1='12' y1='0' x2='12' y2='24' stroke='%236ee7d8' stroke-width='2'/%3E%3Cline x1='0' y1='12' x2='24' y2='12' stroke='%236ee7d8' stroke-width='2'/%3E%3C/svg%3E\") 12 12,crosshair!important;",
  ring:"cursor:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28'%3E%3Ccircle cx='14' cy='14' r='10' stroke='%23a78bfa' stroke-width='2' fill='none'/%3E%3C/svg%3E\") 14 14,auto!important;",
  star:"cursor:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ctext y='20' font-size='20'%3E%E2%AD%90%3C/text%3E%3C/svg%3E\") 12 12,auto!important;",
  rocket:"cursor:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ctext y='20' font-size='20'%3E%F0%9F%9A%80%3C/text%3E%3C/svg%3E\") 12 12,auto!important;",
  bug:"cursor:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ctext y='20' font-size='20'%3E%F0%9F%90%9B%3C/text%3E%3C/svg%3E\") 12 12,auto!important;"};

function applyCursorStyle(id){
  if(document.body.classList.contains('recruiter-mode')){document.getElementById('cursorStyleRule').textContent='';return;}
  const css=CURSOR_CSS[id]||'';
  document.getElementById('cursorStyleRule').textContent=css?'*{'+css+'}':'';
  const dot=document.getElementById('cursorDot');
  if(id==='dot'){dot.style.display='block';document.addEventListener('mousemove',moveDot);}
  else{dot.style.display='none';document.removeEventListener('mousemove',moveDot);}
  localStorage.setItem('cursor_id',id);
}
function moveDot(e){const d=document.getElementById('cursorDot');d.style.transform='translate('+(e.clientX-6)+'px,'+(e.clientY-6)+'px)';}
let trailOn=false;
function setCursorTrail(on){
  trailOn=on;localStorage.setItem('trail',on?'1':'0');
  if(on)document.addEventListener('mousemove',trailMove);
  else document.removeEventListener('mousemove',trailMove);
}
function trailMove(e){
  if(!trailOn||document.body.classList.contains('recruiter-mode'))return;
  const el=document.createElement('div');el.className='cursor-trail-p';
  el.style.cssText='left:'+e.clientX+'px;top:'+e.clientY+'px;background:hsl('+Math.round(Math.random()*360)+',80%,70%);position:fixed;width:8px;height:8px;border-radius:50%;pointer-events:none;z-index:9998;opacity:.7;animation:trailFade .6s ease forwards;';
  document.body.appendChild(el);setTimeout(()=>el.remove(),600);
}
function initCursorSystem(){
  applyCursorStyle(localStorage.getItem('cursor_id')||'default');
  setCursorTrail(localStorage.getItem('trail')==='1');
}

/* Recruiter mode */
function initRecruiterMode(){
  const btn=document.getElementById('recruiterModeBtn'),lbl=document.getElementById('rmLabel');
  const HIDE=['hobbies','achievements','timeline','connect'];
  function apply(on){
    document.body.classList.toggle('recruiter-mode',on);
    HIDE.forEach(id=>{const el=document.getElementById(id);if(el)el.style.display=on?'none':'';});
    btn.classList.toggle('rm-active',on);
    if(lbl)lbl.textContent=on?'ON':'Mode';
    btn.title=on?'Recruiter Mode ON — click to exit':'Switch to Recruiter Mode';
    localStorage.setItem('rm',on?'1':'0');
    if(on){document.getElementById('cursorStyleRule').textContent='';document.getElementById('cursorDot').style.display='none';}
    else initCursorSystem();
  }
  btn?.addEventListener('click',()=>apply(!document.body.classList.contains('recruiter-mode')));
  if(localStorage.getItem('rm')==='1')apply(true);
  if(!localStorage.getItem('rm_seen')){
    setTimeout(()=>{const c=document.createElement('div');c.className='recruiter-callout';c.innerHTML='👀 Hiring? Try <strong>Recruiter Mode</strong> for a clean focused view.';document.body.appendChild(c);requestAnimationFrame(()=>c.classList.add('show'));setTimeout(()=>{c.classList.remove('show');setTimeout(()=>c.remove(),400);},6000);localStorage.setItem('rm_seen','1');},2500);
  }
}

/* Scroll progress */
function initScrollProgress(){
  const bar=document.getElementById('scrollProgress');if(!bar)return;
  window.addEventListener('scroll',()=>{const h=document.documentElement;bar.style.width=(h.scrollTop/(h.scrollHeight-h.clientHeight)*100)+'%';},{passive:true});
}

/* Parallax wallpaper */
function initParallax(){
  const wp=document.getElementById('wallpaper');if(!wp)return;
  let t=false;
  window.addEventListener('scroll',()=>{if(t)return;t=true;requestAnimationFrame(()=>{if(wp.classList.contains('show')){const p=window.scrollY/(document.documentElement.scrollHeight-window.innerHeight)||0;wp.style.backgroundPosition='center '+(40+p*20)+'%';}t=false;});},{passive:true});
}

/* Animated bg class from settings */
function applyBgStyle(){
  const s=(liveData&&liveData.settings)||{};
  document.body.classList.remove('bg-space','bg-nebula');
  if(s.bgStyle==='space')document.body.classList.add('bg-space');
  if(s.bgStyle==='nebula')document.body.classList.add('bg-nebula');
}

/* Avatar */
function initAvatar(){
  const c=document.getElementById('avatarContainer');if(!c)return;
  let w=false;const hand=document.getElementById('avatarHand');
  function wave(){if(w)return;w=true;hand?.classList.add('waving');setTimeout(()=>{hand?.classList.remove('waving');w=false;},1400);}
  c.addEventListener('click',wave);c.addEventListener('mouseenter',wave);setTimeout(wave,1800);
}

/* Hire me popup */
function initHireMe(){
  const overlay=document.getElementById('hireMeOverlay');if(!overlay)return;
  document.getElementById('hireMeBtn')?.addEventListener('click',e=>{e.preventDefault();showOverlay(overlay);});
  document.getElementById('hireMeClose')?.addEventListener('click',()=>hideOverlay(overlay));
  overlay.addEventListener('click',e=>{if(e.target===overlay)hideOverlay(overlay);});
  document.getElementById('hireMeForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const name=overlay.querySelector('#hmName').value.trim(),email=overlay.querySelector('#hmEmail').value.trim(),message=overlay.querySelector('#hmMessage').value.trim();
    if(!name||!email||!message){overlay.querySelector('#hireMeStatus').textContent='Please fill Name, Email and Message.';return;}
    overlay.querySelector('#hireMeStatus').textContent='Sending…';
    const company=overlay.querySelector('#hmCompany')?.value.trim()||'';
    const phone=overlay.querySelector('#hmPhone')?.value.trim()||'';
    try{if(supa)await supa.from('hire_me_leads').insert({name,company,email,phone,message});}catch(e){}
    const s=(liveData&&liveData.settings)||{};
    if(s.emailjsService&&window.emailjs){try{await window.emailjs.send(s.emailjsService,s.emailjsTemplate,{from_name:name,company,reply_to:email,phone,message},s.emailjsPublic);}catch(e){}}
    overlay.querySelector('#hireMeStatus').textContent='✓ Message received! I will reply to '+email;
    e.target.reset();setTimeout(()=>hideOverlay(overlay),2800);
  });
}

/* QR share */
function initQR(){
  const img=document.getElementById('qrImage');if(!img)return;
  const url=location.href.split('#')[0];
  img.src='https://api.qrserver.com/v1/create-qr-code/?size=180x180&data='+encodeURIComponent(url);
  document.getElementById('qrCopyBtn')?.addEventListener('click',async()=>{
    await navigator.clipboard.writeText(url);
    if(navigator.share)try{await navigator.share({title:document.title,url});}catch(e){}
    const b=document.getElementById('qrCopyBtn');b.textContent='✓ Copied!';setTimeout(()=>b.textContent='Copy link',1800);
  });
}

/* Gimmick helpers */
function eggsAllowed(){return liveData?.settings?.eggsEnabled!==false&&!document.body.classList.contains('recruiter-mode');}
function getBadges(){try{return JSON.parse(localStorage.getItem('badges')||'[]');}catch{return[];}}
function awardBadge(n){const b=getBadges();if(b.includes(n))return;b.push(n);localStorage.setItem('badges',JSON.stringify(b));showBadgeToast('🏆 '+n);}
function showBadgeToast(m){const t=document.getElementById('badgeToast');if(!t)return;t.textContent=m;t.classList.remove('hidden');t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3200);}
function fireConfetti(){if(!eggsAllowed())return;for(let i=0;i<12;i++){setTimeout(()=>{const el=document.createElement('div');el.className='gimmick-emoji';el.textContent=['✨','🎉','⭐','💫','🌟'][i%5];el.style.cssText='left:'+Math.random()*100+'vw;animation-duration:'+(1.6+Math.random())+'s;';document.body.appendChild(el);setTimeout(()=>el.remove(),2600);},i*35);}}
function fireGimmick(){
  if(!eggsAllowed())return;
  const g=[
    ()=>fireConfetti(),
    ()=>{document.body.classList.add('gimmick-shake');setTimeout(()=>document.body.classList.remove('gimmick-shake'),400);},
    ()=>{const el=document.createElement('div');el.className='gimmick-ripple';document.body.appendChild(el);setTimeout(()=>el.remove(),900);},
    ()=>{const msgs=['Nice find!','+10 curiosity','Achievement unlocked!'];const el=document.createElement('div');el.className='gimmick-float-text';el.textContent=msgs[Math.floor(Math.random()*msgs.length)];el.style.cssText='left:'+(20+Math.random()*60)+'vw;top:'+(30+Math.random()*40)+'vh;';document.body.appendChild(el);setTimeout(()=>el.remove(),1800);},
    ()=>{const l=document.getElementById('logoHome');if(!l)return;const old=l.style.transform;l.style.transform='rotate(360deg)';l.style.transition='transform .8s ease';setTimeout(()=>{l.style.transform=old;},800);},
  ];
  g[Math.floor(Math.random()*g.length)]();
}

/* Coffee egg */
function initCoffeeEgg(){
  const el=document.getElementById('coffeeEgg');if(!el)return;
  let n=0;el.style.cursor='pointer';
  el.addEventListener('click',()=>{n++;if(n>=5){n=0;awardBadge('Caffeine Detective ☕');fireGimmick();}});
}

/* Konami */
function initKonami(){
  const seq=['ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','ArrowUp','ArrowDown'];let pos=0;
  let matrixOn=false,matAF=null;
  document.addEventListener('keydown',e=>{
    if(!eggsAllowed())return;
    if(e.key===seq[pos])pos++;else pos=e.key===seq[0]?1:0;
    if(pos===seq.length){pos=0;awardBadge('Konami Master 🕹️');
      matrixOn=!matrixOn;
      const canvas=document.getElementById('matrixCanvas');
      if(!canvas)return;
      if(matrixOn){canvas.classList.remove('hidden');canvas.width=window.innerWidth;canvas.height=window.innerHeight;
        const ctx=canvas.getContext('2d'),cols=Math.floor(canvas.width/14),y=Array(cols).fill(0);
        matAF=setInterval(()=>{ctx.fillStyle='rgba(0,0,0,.05)';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#0f0';ctx.font='14px monospace';y.forEach((v,i)=>{ctx.fillText(String.fromCharCode(0x30A0+Math.random()*96),i*14,v);y[i]=v>canvas.height&&Math.random()>.975?0:v+14;});},50);
      }else{canvas.classList.add('hidden');clearInterval(matAF);}
    }
  });
}

/* Floating star */
function initFloatingStar(){
  const star=document.getElementById('floatingStar');if(!star)return;
  function place(){if(!eggsAllowed()){star.classList.add('hidden');return;}star.style.top=(10+Math.random()*70)+'vh';star.style.left=(5+Math.random()*85)+'vw';star.classList.remove('hidden');}
  star.addEventListener('click',()=>{awardBadge('Star Catcher ⭐');fireGimmick();star.classList.add('hidden');setTimeout(place,20000+Math.random()*15000);});
  setTimeout(place,10000);
}

/* Firefly trail */
function initFirefly(){
  const canvas=document.getElementById('fireflyCanvas');if(!canvas)return;
  const ctx=canvas.getContext('2d');let pts=[];
  function resize(){canvas.width=innerWidth;canvas.height=innerHeight;}resize();window.addEventListener('resize',resize);
  window.addEventListener('mousemove',e=>{if(document.documentElement.getAttribute('data-theme')==='light')return;canvas.classList.add('show');pts.push({x:e.clientX,y:e.clientY,life:1});if(pts.length>40)pts.shift();});
  (function tick(){ctx.clearRect(0,0,canvas.width,canvas.height);pts.forEach(p=>{p.life-=.025;ctx.beginPath();ctx.arc(p.x,p.y,2.4*p.life,0,Math.PI*2);ctx.fillStyle='rgba(110,231,216,'+Math.max(p.life,0)*.5+')';ctx.fill();});pts=pts.filter(p=>p.life>0);requestAnimationFrame(tick);})();
}

/* Logo scroll to top + double-click easter egg */
function initLogo(){
  const logo=document.getElementById('logoHome');if(!logo)return;
  logo.addEventListener('click',e=>{e.preventDefault();window.scrollTo({top:0,behavior:'smooth'});});
  logo.addEventListener('dblclick',e=>{e.preventDefault();if(!eggsAllowed())return;document.body.classList.add('rainbow-burst');fireGimmick();awardBadge('Rainbow Finder 🌈');setTimeout(()=>document.body.classList.remove('rainbow-burst'),1800);});
}

/* Scroll milestone */
function initScrollMilestone(){
  const hit=new Set();
  window.addEventListener('scroll',()=>{if(!eggsAllowed())return;const h=document.documentElement,pct=Math.round(h.scrollTop/(h.scrollHeight-h.clientHeight)*100);if(pct>=99&&!hit.has(100)){hit.add(100);awardBadge('Full Scroll 📜');fireGimmick();}},{passive:true});
}

/* Back to top */
function initBackToTop(){
  const btn=document.getElementById('backToTop');if(!btn)return;
  window.addEventListener('scroll',()=>btn.classList.toggle('hidden',window.scrollY<500),{passive:true});
  btn.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
}

/* Copy email */
function initCopyEmail(){
  document.getElementById('copyEmailBtn')?.addEventListener('click',async()=>{const b=document.getElementById('copyEmailBtn');await navigator.clipboard.writeText(liveData?.email||'yashwanthriya25@gmail.com');const o=b.textContent;b.textContent='✓ Copied!';setTimeout(()=>b.textContent=o,1800);});
}

/* Modal helpers (if not already defined in base app.js) */
if(typeof showOverlay==='undefined'){
  window.showOverlay=function(o){o.classList.remove('hidden');requestAnimationFrame(()=>o.classList.add('show'));document.body.style.overflow='hidden';};
  window.hideOverlay=function(o){o.classList.remove('show');document.body.style.overflow='';setTimeout(()=>o.classList.add('hidden'),250);};
}

/* Apply settings extras */
const _origApplySettings=typeof applySettings==='function'?applySettings:null;
function applySettingsExtras(){
  const s=(liveData&&liveData.settings)||{};
  const r=document.documentElement.style;
  r.setProperty('--icon-btn-size',(s.iconButtonSize||36)+'px');
  r.setProperty('--avatar-size',(s.avatarSize||320)+'px');
  r.setProperty('--card-radius',(s.cardRadius||18)+'px');
  r.setProperty('--glass-blur',(s.glassBlur||18)+'px');
  r.setProperty('--section-spacing',(s.sectionSpacing||130)+'px');
  // Theme palette
  const P={default:['#6ee7d8','#a78bfa'],sunset:['#ff9966','#ff5e8a'],ocean:['#38bdf8','#6366f1'],forest:['#34d399','#0d9488'],amber:['#fbbf24','#d97706'],rose:['#f7b9c4','#c2410c'],lavender:['#c4b5fd','#8b5cf6'],mint:['#6ee7b7','#10b981'],coral:['#fb923c','#f43f5e'],slate:['#94a3b8','#475569'],cherry:['#fda4af','#e11d48'],cyberpunk:['#f0abfc','#22d3ee'],autumn:['#f59e0b','#b91c1c'],arctic:['#a5f3fc','#0891b2'],berry:['#f472b6','#7e22ce'],citrus:['#fde047','#ea580c'],steel:['#7dd3fc','#1e3a8a'],terracotta:['#fdba74','#9a3412'],monochrome:['#e5e7eb','#6b7280'],emerald:['#34d399','#059669']};
  const p=P[s.themePalette||'default']||P.default;
  r.setProperty('--accent-1',p[0]);r.setProperty('--accent-2',p[1]);
  // Wallpaper
  const wp=document.getElementById('wallpaper');
  if(wp){if(liveData?.background_image){wp.style.backgroundImage='url("'+liveData.background_image+'")';r.setProperty('--wallpaper-opacity',(s.wallpaperOpacity||35)/100);wp.classList.add('show');}else wp.classList.remove('show');}
  // Resume
  const rb=document.getElementById('resumeDownloadBtn');if(rb&&liveData?.resume_url)rb.href=liveData.resume_url;
  applyBgStyle();
  applyCursorStyle(s.cursorStyleId||localStorage.getItem('cursor_id')||'default');
  setCursorTrail(!!s.cursorTrailOn||localStorage.getItem('trail')==='1');
}

/* Hook into existing boot — override loadContent success handler */
const _origBoot=document.currentScript?null:null;
document.addEventListener('DOMContentLoaded',()=>{
  initIntroSplash();
  initFontSize();
  initScrollProgress();
  initParallax();
  initRecruiterMode();
  initLogo();
  initBackToTop();
  initCopyEmail();
  initAvatar();
  initHireMe();
  initQR();
  initCoffeeEgg();
  initKonami();
  initFloatingStar();
  initFirefly();
  initScrollMilestone();
  initCursorSystem();
  // delay gimmick-dependent inits until liveData is available
  const waitForData=setInterval(()=>{
    if(!liveData)return;clearInterval(waitForData);
    applySettingsExtras();
  },200);
});
