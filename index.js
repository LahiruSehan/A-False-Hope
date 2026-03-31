import { APP_CONFIG, CHAPTER_CONFIG, DEFAULT_CHAPTER_PAGES, INSPIRATIONS_CONFIG } from './config.js';

// ── STATE ────────────────────────────────────────────────────────────────────
let navHistory  = ['home-view'];
let chapterSort = 'old';
let homeTab     = 'news';
let lastScrollY = 0;
let deferredPrompt = null;

// ── SETTINGS ─────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
    oled: false, music: false, haptics: true,
    autoHide: false, transitions: true,
    notifications: true, particlesHQ: false
};
let appSettings = JSON.parse(localStorage.getItem('afh_settings')) || DEFAULT_SETTINGS;

function saveSettings() {
    localStorage.setItem('afh_settings', JSON.stringify(appSettings));
    applySettings();
}

function applySettings() {
    document.body.style.backgroundColor = appSettings.oled ? '#000000' : '#020617';
    ['oled','music','haptics','autoHide','transitions','notifications','particlesHQ'].forEach(k => {
        const map = { oled:'setting-oled', music:'setting-music', haptics:'setting-haptics',
                      autoHide:'setting-autohide', transitions:'setting-transitions',
                      notifications:'setting-notif-chapter', particlesHQ:'setting-particles' };
        const el = document.getElementById(map[k]);
        if (el) el.classList.toggle('on', appSettings[k]);
    });
    initParticles();
}

window.toggleSetting = (key) => {
    v(15);
    appSettings[key] = !appSettings[key];
    saveSettings();
    if (key === 'music') toggleMusic(appSettings.music);
};

// ── AUDIO ────────────────────────────────────────────────────────────────────
const bgMusic = new Audio('audio/bgm.mp3');
bgMusic.loop = true;
function toggleMusic(play) {
    play ? bgMusic.play().catch(() => {}) : bgMusic.pause();
}

// ── HAPTICS ──────────────────────────────────────────────────────────────────
function v(ms = 10) {
    if (appSettings.haptics && navigator.vibrate) navigator.vibrate(ms);
}

// ── PARTICLES ────────────────────────────────────────────────────────────────
function initParticles() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (window._particleRaf) cancelAnimationFrame(window._particleRaf);

    const count = appSettings.particlesHQ ? 90 : 28;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };

    // 25% of particles are gold/amber for magical feel
    const GOLD_COLORS = ['rgba(251,191,36,', 'rgba(245,158,11,', 'rgba(254,243,199,'];
    const VIOLET_COLORS = ['rgba(168,85,247,', 'rgba(139,92,246,', 'rgba(196,132,251,'];

    class P {
        constructor() { this.reset(); }
        reset() {
            this.x      = Math.random() * canvas.width;
            this.y      = Math.random() * canvas.height;
            this.s      = Math.random() * (appSettings.particlesHQ ? 1.8 : 1.3);
            this.vx     = (Math.random() - 0.5) * 0.18;
            this.vy     = (Math.random() - 0.5) * 0.18;
            this.o      = Math.random() * 0.28;
            this.isGold = Math.random() < 0.22; // 22% gold
            const palette = this.isGold ? GOLD_COLORS : VIOLET_COLORS;
            this.color  = palette[Math.floor(Math.random() * palette.length)];
        }
        update() {
            this.x += this.vx; this.y += this.vy;
            if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.reset();
        }
        draw() {
            ctx.fillStyle = `${this.color}${this.o})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.s, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    const particles = Array.from({ length: count }, () => new P());

    const loop = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => { p.update(); p.draw(); });
        window._particleRaf = requestAnimationFrame(loop);
    };

    window.removeEventListener('resize', window._particleResize);
    window._particleResize = resize;
    window.addEventListener('resize', window._particleResize);
    resize();
    loop();
}

// ── LOADING SCREEN ───────────────────────────────────────────────────────────
function runLoadingScreen() {
    const titleEl  = document.getElementById('load-title');
    const words    = ['A', 'FALSE', 'HOPE'];
    let   delay    = 0;

    words.forEach((word, wi) => {
        const wordSpan = document.createElement('span');
        wordSpan.style.cssText = 'display:inline-block; margin-right:0.25em;';

        word.split('').forEach((char) => {
            const span = document.createElement('span');
            span.className = 'load-char';
            span.textContent = char;
            span.style.animationDelay = `${delay}ms`;
            delay += 55;
            wordSpan.appendChild(span);
        });

        if (wi < words.length - 1) delay += 80;
        titleEl.appendChild(wordSpan);
    });

    // After 2.8s fade out loading, reveal app
    setTimeout(() => {
        const loadingView = document.getElementById('loading-view');
        loadingView.classList.add('loading-out');
        setTimeout(() => {
            loadingView.classList.add('hidden');
            document.getElementById('bottom-nav').classList.remove('hidden');
            showView('home-view', false);
            checkPromoModal();
        }, 580);
    }, 2800);
}

// ── PROMO MODAL ───────────────────────────────────────────────────────────────
function checkPromoModal() {
    if (localStorage.getItem('afh_follow_instagram') !== 'true') {
        setTimeout(() => {
            const m = document.getElementById('promo-modal');
            if (m) m.classList.remove('hidden');
        }, 900);
    }
}
window.closePromoModal = () => {
    v(); document.getElementById('promo-modal')?.classList.add('hidden');
};
window.followAndClosePromo = () => {
    v();
    localStorage.setItem('afh_follow_instagram', 'true');
    document.getElementById('promo-modal')?.classList.add('hidden');
    window.open('https://www.instagram.com/falsehope2877/', '_blank');
};

// ── NAVIGATION ───────────────────────────────────────────────────────────────
window.showView = function(id, push = true) {
    v();
    const target = document.getElementById(id);
    if (!target) return;

    // Animate out current visible view
    const current = document.querySelector('.view:not(.hidden)');
    if (current && current !== target && appSettings.transitions) {
        current.classList.add('view-exit');
        setTimeout(() => {
            current.classList.add('hidden');
            current.classList.remove('view-exit');
        }, 240);
    } else if (current && current !== target) {
        current.classList.add('hidden');
    }

    window.currentView = id;
    target.classList.remove('hidden');
    if (appSettings.transitions) {
        target.classList.add('view-enter');
        setTimeout(() => target.classList.remove('view-enter'), 500);
    }

    if (push && navHistory[navHistory.length - 1] !== id) navHistory.push(id);

    // Back button: hide on home and loading
    const backBtn = document.getElementById('floating-back');
    if (backBtn) backBtn.classList.toggle('hidden', ['home-view', 'loading-view'].includes(id));

    // Bottom nav: hide in reader
    const nav = document.getElementById('bottom-nav');
    if (nav) nav.classList.toggle('hidden', id === 'reader-view');

    // Update bottom nav active state
    setNavActive(id);

    if (id === 'home-view')     loadHomeContent();
    if (id === 'chapters-view') loadChapters();
    if (id !== 'reader-view')   target.scrollTop = 0;
};

// navTo is called by the bottom nav pill — no back history push
window.navTo = function(id) {
    v();
    // Reset history when using the nav pill
    navHistory = [id];
    showView(id, false);
};

function setNavActive(viewId) {
    const map = { 'home-view': 'nav-home', 'chapters-view': 'nav-archive' };
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const active = map[viewId];
    if (active) document.getElementById(active)?.classList.add('active');
}

window.goBack = () => {
    if (navHistory.length > 1) {
        navHistory.pop();
        showView(navHistory[navHistory.length - 1], false);
    }
};

window.toggleModal = (id) => {
    v();
    const m = document.getElementById(id);
    if (!m) return;
    const isHidden = m.classList.contains('hidden');
    m.classList.toggle('hidden');
    if (isHidden) {
        // Re-trigger enter animation
        m.querySelectorAll('.modal-enter').forEach(el => {
            el.classList.remove('modal-enter');
            void el.offsetWidth;
            el.classList.add('modal-enter');
        });
    }
};

// ── SCROLL REVEAL OBSERVER ────────────────────────────────────────────────────
function initScrollObserver() {
    const obs = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

// ── HOME CONTENT ──────────────────────────────────────────────────────────────
window.setHomeTab = (tab) => {
    v();
    homeTab = tab;
    loadHomeContent();
};

function loadHomeContent() {
    document.querySelectorAll('.tab-pill').forEach(b => {
        b.classList.toggle('active', b.id === `tab-${homeTab}`);
    });
    const c = document.getElementById('home-tab-content');
    if (!c) return;

    c.style.opacity = '0';
    c.style.transform = 'translateY(8px)';

    setTimeout(() => {
        if      (homeTab === 'news')           renderNews(c);
        else if (homeTab === 'authors-log')    renderAuthorsLog(c);
        else if (homeTab === 'inspirations')   renderInspirations(c);
        else if (homeTab === 'animated-series') renderAnimatedSeries(c);

        c.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
        c.style.opacity    = '1';
        c.style.transform  = 'translateY(0)';
    }, 80);
}

function renderNews(container) {
    container.innerHTML = `
    <div class="content-card">
      <div class="flex justify-between items-start mb-2">
        <h4 class="text-white text-[11px] font-black uppercase tracking-widest">Inspirations Unlocked</h4>
        <span class="text-[8px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20 font-black uppercase">New</span>
      </div>
      <p class="text-[11px] text-slate-400 leading-relaxed">A new <span class="text-purple-400 font-bold">Inspirations Tab</span> is available. Discover the music, movies, and art that shaped this world.</p>
    </div>
    <div class="content-card">
      <div class="flex justify-between items-start mb-2">
        <h4 class="text-white text-[11px] font-black uppercase tracking-widest">New Reader</h4>
        <span class="text-[8px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 font-black uppercase">Update</span>
      </div>
      <p class="text-[11px] text-slate-400 leading-relaxed">The app has been redesigned with a fully cinematic interface — faster, smoother, more immersive.</p>
    </div>`;
}

function renderAuthorsLog(container) {
    container.innerHTML = `
    <div class="log-card">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-base">✨</span>
        <h4 class="text-purple-400 text-[10px] font-black uppercase tracking-widest">Dev Log #3</h4>
      </div>
      <p class="text-[11px] text-slate-400 leading-relaxed">Upgraded role tags! All readers are now officially designated as <b class="text-white">Explorers</b>. Added visual flair to match the aesthetic.</p>
    </div>
    <div class="log-card">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-base">🛠️</span>
        <h4 class="text-blue-400 text-[10px] font-black uppercase tracking-widest">Dev Log #2</h4>
      </div>
      <p class="text-[11px] text-slate-400 leading-relaxed">Added special feature unlocks for Explorers as they reach new chapters.</p>
    </div>`;
}

function renderInspirations(container) {
    container.innerHTML = INSPIRATIONS_CONFIG.map(item => `
    <div class="insp-card">
      <img src="${item.image}" alt="${item.title}" loading="lazy"
           onerror="this.src='https://i.ibb.co/0jNjDF8k/Cover2.png';this.style.filter='grayscale(1)'">
      <div class="insp-card-body">
        <p class="text-[9px] text-purple-400 font-black uppercase tracking-widest mb-0.5">${item.context}</p>
        <h3 class="text-sm font-bold text-white leading-tight">${item.title}</h3>
      </div>
    </div>`).join('');
}

function renderAnimatedSeries(container) {
    container.innerHTML = `
    <div class="magical rounded-3xl p-8 text-center border border-white/8 space-y-5">
      <h3 class="ff text-2xl font-black text-white uppercase tracking-widest drop-shadow-lg">A New Animation Series</h3>
      <p class="text-[11px] text-purple-100 font-bold uppercase tracking-wider opacity-80">is in the planning phase behind the scenes</p>
      <div>
        <p class="text-[9px] text-slate-300 uppercase tracking-widest mb-2">Series will be animated by</p>
        <div class="inline-block relative">
          <div class="bg-black text-transparent select-none px-4 py-1 rounded text-lg font-black tracking-widest blur-[3px]">SECRET NAME</div>
          <div class="absolute inset-0 flex items-center justify-center">
            <span class="text-[8px] text-white/40 font-black uppercase tracking-[0.3em]">CENSORED</span>
          </div>
        </div>
        <p class="text-[9px] text-slate-300 uppercase tracking-widest mt-2">Studios</p>
      </div>
      <div class="inline-block bg-black/40 px-6 py-2 rounded-full border border-white/10">
        <p class="text-[11px] font-black text-white uppercase tracking-widest">Releasing Mid 2027</p>
        <p class="text-[8px] text-red-400 uppercase tracking-widest mt-0.5">On YouTube</p>
      </div>
      <a href="https://www.instagram.com/falsehope2877/" target="_blank"
         class="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 rounded-2xl font-black text-[10px] text-white uppercase tracking-widest shadow-lg shadow-purple-500/25 active:scale-95 transition-transform">
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
        Follow for Updates
      </a>
    </div>`;
}

// ── CHAPTERS ──────────────────────────────────────────────────────────────────
window.setChapterSort = (type) => {
    v();
    chapterSort = type;
    document.getElementById('sort-new').classList.toggle('active', type === 'new');
    document.getElementById('sort-old').classList.toggle('active', type === 'old');
    loadChapters();
};

function loadChapters() {
    const container = document.getElementById('chapters-list');
    if (!container) return;

    let chapters = [];
    for (let i = 0; i <= 30; i++) {
        const cfg = CHAPTER_CONFIG[i] || { title: `CHAPTER ${i}`, pages: DEFAULT_CHAPTER_PAGES };
        chapters.push({ id: i, title: cfg.title, pages: cfg.pages });
    }
    if (chapterSort === 'new') chapters.sort((a, b) => b.id - a.id);
    else                       chapters.sort((a, b) => a.id - b.id);

    container.innerHTML = chapters.map((c) => {
        if (c.id === 0) return ch0Card();
        return chCard(c, idx);
    }).join('');

    // Stagger-animate cards in
    container.querySelectorAll('.ch-card, .ch0-card').forEach((el, i) => {
        el.style.opacity   = '0';
        el.style.transform = 'translateY(18px)';
        setTimeout(() => {
            el.style.transition = `opacity 0.45s ease, transform 0.45s cubic-bezier(0.16,1,0.3,1)`;
            el.style.opacity    = '1';
            el.style.transform  = 'translateY(0)';
        }, i * 40);
    });
}

function ch0Card() {
    return `
    <div class="ch0-card p-5 mb-1" onclick="openReader(0)">
      <div class="flex items-center gap-4">
        <div class="w-14 h-14 rounded-2xl bg-red-950/60 border border-red-800/40 flex items-center justify-center flex-shrink-0">
          <svg class="w-7 h-7 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-[8px] font-black text-red-500/70 uppercase tracking-widest border border-red-800/40 px-2 py-0.5 rounded-full">Special · Video</span>
          </div>
          <h3 class="ff font-black text-red-400 text-base uppercase tracking-wider leading-tight">Chapter 0</h3>
          <p class="text-[9px] text-red-600/70 font-black uppercase tracking-widest mt-0.5">Transmission Established</p>
        </div>
        <svg class="w-5 h-5 text-red-700/50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M9 5l7 7-7 7"/></svg>
      </div>
    </div>`;
}

function chCard(c, idx) {
    return `
    <div class="ch-card p-4" onclick="openReader(${c.id})">
      <div class="ch-bg-num">${c.id}</div>
      <div class="flex items-center gap-4 relative z-10">
        <div class="ff text-2xl font-black text-white/8 w-10 text-center flex-shrink-0"
             style="background:linear-gradient(to bottom,rgba(255,255,255,0.6),rgba(251,191,36,0.7));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;filter:drop-shadow(0 0 4px rgba(251,191,36,0.3))">
          ${String(c.id).padStart(2,'0')}
        </div>
        <div class="flex-1 min-w-0">
          <p class="ff text-[11px] font-bold enchanted uppercase tracking-wider leading-tight truncate">${c.title}</p>
          <p class="phi text-[8px] text-slate-600 uppercase tracking-tighter mt-0.5" style="font-style:italic">${c.pages} pages</p>
        </div>
        <svg class="w-4 h-4 text-white/15 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M9 5l7 7-7 7"/></svg>
      </div>
    </div>`;
}

// ── READER ────────────────────────────────────────────────────────────────────
window.openReader = (id) => {
    v(20);
    showView('reader-view');

    const container = document.getElementById('reader-pages');
    const progress  = document.getElementById('reader-progress');
    if (!container) return;

    // Chapter intro overlay
    showChapterIntro(id);

    if (id === 0) {
        container.innerHTML = `
        <div class="min-h-screen flex flex-col items-center justify-center p-4">
          <div class="w-full aspect-video rounded-2xl overflow-hidden shadow-2xl border border-red-900/40 relative bg-black">
            <iframe class="w-full h-full absolute inset-0"
              src="https://www.youtube.com/embed/gD72CMuUQrQ?autoplay=1&vq=hd1080&rel=0&modestbranding=1"
              title="Chapter 0" frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen></iframe>
          </div>
          <p class="text-center text-red-500 mt-8 font-black text-xs tracking-[0.4em] animate-pulse">TRANSMISSION ESTABLISHED</p>
        </div>`;
        if (progress) progress.style.width = '0%';
        return;
    }

    const cfg = CHAPTER_CONFIG[id] || { title: `CHAPTER ${id}`, pages: DEFAULT_CHAPTER_PAGES };
    container.innerHTML = '<div class="min-h-screen flex items-center justify-center"><div class="text-[9px] text-white/10 uppercase tracking-[1.5em] animate-pulse">Summoning Portal...</div></div>';

    setTimeout(() => {
        container.innerHTML = '';
        for (let i = 1; i <= cfg.pages; i++) {
            const img = document.createElement('img');
            img.src       = `images/imageschapter${id}/${i}.png`;
            img.className = 'w-full block bg-slate-950';
            img.style.marginBottom = '2px';
            img.loading   = 'lazy';
            img.onerror   = () => { img.style.display = 'none'; };
            container.appendChild(img);
        }
    }, 380);

    const readerView = document.getElementById('reader-view');
    readerView.onscroll = () => {
        const st     = readerView.scrollTop;
        const height = readerView.scrollHeight - readerView.clientHeight;
        if (progress) progress.style.width = (height > 0 ? (st / height) * 100 : 0) + '%';

        if (appSettings.autoHide) {
            const nav = document.getElementById('bottom-nav');
            const bk  = document.getElementById('floating-back');
            if (st > lastScrollY && st > 60) {
                if (nav) nav.style.transform = 'translateX(-50%) translateY(100px)';
                if (bk)  bk.style.transform  = 'translateY(-80px)';
            } else {
                if (nav) nav.style.transform = 'translateX(-50%) translateY(0)';
                if (bk)  bk.style.transform  = 'translateY(0)';
            }
            lastScrollY = st <= 0 ? 0 : st;
        }
    };
};

function showChapterIntro(id) {
    // Remove any existing overlay
    document.getElementById('chapter-intro-overlay')?.remove();

    const cfg   = CHAPTER_CONFIG[id] || { title: `CHAPTER ${id}`, pages: 0 };
    const isZero = id === 0;

    const overlay = document.createElement('div');
    overlay.id        = 'chapter-intro-overlay';
    overlay.className = 'chapter-intro-overlay';
    overlay.innerHTML = `
      <p class="phi text-[10px] uppercase tracking-[0.3em] mb-5"
         style="font-style:italic;color:${isZero ? 'rgba(220,38,38,0.7)' : 'rgba(168,85,247,0.6)'}">
        ${isZero ? '▶ Video Chapter' : `Chapter ${id}`}
      </p>
      <h2 class="ffd font-black text-3xl uppercase tracking-widest text-center px-8 leading-tight arcane-glow"
          style="color:white;${isZero ? 'text-shadow:0 0 20px rgba(220,38,38,0.7),0 0 50px rgba(220,38,38,0.3)' : ''}">
        ${isZero ? 'Transmission\nEstablished' : cfg.title}
      </h2>
      ${!isZero ? `
        <div class="sparkle-div mt-5 px-16">
          <span class="sparkle-icon text-[10px]">✦</span>
          <span class="phi text-[9px] text-slate-500" style="font-style:italic">${cfg.pages} Pages</span>
          <span class="sparkle-icon text-[10px]" style="animation-delay:1.8s">✦</span>
        </div>` : ''}`;

    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), 2800);
}

// ── MISC ─────────────────────────────────────────────────────────────────────
window.shareStory = () => {
    v(15);
    const url = window.location.origin + window.location.pathname;
    if (navigator.share) navigator.share({ title: 'A False Hope', url }).catch(() => {});
    else navigator.clipboard.writeText(url).then(() => alert('Link copied!'));
};

window.installApp = async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') deferredPrompt = null;
    } else {
        alert('App is already installed or not supported on this browser.');
    }
};

window.clearCache = () => {
    if (confirm('Reload app and clear cache?')) window.location.reload(true);
};

const recognitionData = {
    MINASHA: { icon: '❤️', text: "Inspired the creation and personality of Viyona — becoming the heart behind her emotions, elegance, and charm — and contributed romantic moment ideas that shaped some of the story's most beautiful emotional and stylistic scenes. 🌙💞✨" },
    AROSHA:  { icon: '🔥', text: "Early reviewer and first-ever reader of HOPE 2877 (BOOK) & the first to review every manga page as it's created, providing fresh perspectives, inspirational suggestions and deep story-strengthening feedback throughout the entire creative process. 🌌✨" }
};

window.openRecognition = (key) => {
    v(15);
    const d = recognitionData[key];
    document.getElementById('recognition-icon').textContent = d.icon;
    document.getElementById('recognition-name').textContent = key;
    document.getElementById('recognition-text').textContent = d.text;
    toggleModal('recognition-modal');
};

// ── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    applySettings();
    initScrollObserver();
    runLoadingScreen();

    document.getElementById('sort-new').classList.remove('active');
    document.getElementById('sort-old').classList.add('active');

    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        deferredPrompt = e;
        document.getElementById('install-app-btn')?.classList.remove('hidden');
    });
});
