import { APP_CONFIG, CHAPTER_CONFIG, DEFAULT_CHAPTER_PAGES, AVATAR_CONFIG, INSPIRATIONS_CONFIG } from './config.js';

const INTERNAL_API_KEY = "AIzaSyAOLlW_kN85EAassW-OV4OTuAT0Enl8RVc";
if (typeof process === 'undefined') window.process = { env: { API_KEY: INTERNAL_API_KEY } };

const SUPABASE_URL = 'https://qpagyfoedsrbenhsoemx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zaDorGnE20zlG805wQ3SXA_81UbgmLY';
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// --- STATE MANAGEMENT ---
let currentUser = null, profileData = null, navHistory = ['home-view'], currentRating = 0;
let chapterSort = 'old';
let homeTab = 'leaderboard'; // 'leaderboard', 'news', 'authors-log', 'inspirations'
let currentChapterId = null;
let activeChatId = null;
let deferredPrompt = null;
let lastScrollTop = 0; // For auto-hide UI
let readingSaveTimeout = null;

// --- SETTINGS MANAGEMENT ---
const DEFAULT_SETTINGS = {
    oled: false,
    music: false,
    haptics: true,
    autoHide: false,
    transitions: true,
    notifications: true,
    particlesHQ: false
};

let appSettings = JSON.parse(localStorage.getItem('afh_settings')) || DEFAULT_SETTINGS;

function saveSettings() {
    localStorage.setItem('afh_settings', JSON.stringify(appSettings));
    applySettings();
}

function applySettings() {
    // OLED Mode
    if (appSettings.oled) document.body.style.backgroundColor = '#000000';
    else document.body.style.backgroundColor = '#020617';

    // Update Toggles in UI
    updateToggleUI('setting-oled', appSettings.oled);
    updateToggleUI('setting-music', appSettings.music);
    updateToggleUI('setting-haptics', appSettings.haptics);
    updateToggleUI('setting-autohide', appSettings.autoHide);
    updateToggleUI('setting-transitions', appSettings.transitions);
    updateToggleUI('setting-notif-chapter', appSettings.notifications);
    updateToggleUI('setting-particles', appSettings.particlesHQ);

    // Particles
    initParticles();
}

function updateToggleUI(id, isActive) {
    const el = document.getElementById(id);
    if (!el) return;
    const knob = el.querySelector('div');
    if (isActive) {
        el.classList.replace('bg-white/10', 'bg-purple-600');
        el.classList.replace('bg-slate-700', 'bg-purple-600'); // Fallback
        knob.classList.replace('left-1', 'right-1');
    } else {
        el.classList.replace('bg-purple-600', 'bg-white/10');
        knob.classList.replace('right-1', 'left-1');
    }
}

window.toggleSetting = (key) => {
    v(15);
    appSettings[key] = !appSettings[key];
    saveSettings();
    if(key === 'music') toggleMusic(appSettings.music);
};

// --- AUDIO SYSTEM ---
let bgMusic = new Audio('audio/bgm.mp3'); // Placeholder path
bgMusic.loop = true;

function toggleMusic(play) {
    if(play) {
        bgMusic.play().catch(e => console.log("Audio waiting for interaction"));
    } else {
        bgMusic.pause();
    }
}

// --- HELPER: HAPTIC VIBRATION ---
function v(ms = 10) { 
    if (appSettings.haptics && navigator.vibrate) navigator.vibrate(ms); 
}

// --- PARTICLES ---
function initParticles() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Stop old animation if exists (basic check)
    if(window.particleAnimId) cancelAnimationFrame(window.particleAnimId);

    let particles = [];
    const count = appSettings.particlesHQ ? 100 : 30; // Settings driven count
    
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    
    class P { 
        constructor() { this.r(); } 
        r() { 
            this.x = Math.random()*canvas.width; 
            this.y = Math.random()*canvas.height; 
            this.s = Math.random() * (appSettings.particlesHQ ? 2 : 1.5); 
            this.vx = (Math.random()-0.5)*0.2; 
            this.vy = (Math.random()-0.5)*0.2; 
            this.o = Math.random()*0.3; 
        } 
        u() { 
            this.x+=this.vx; this.y+=this.vy; 
            if(this.x<0||this.x>canvas.width||this.y<0||this.y>canvas.height) this.r(); 
        } 
        d() { 
            ctx.fillStyle=`rgba(168,85,247,${this.o})`; 
            ctx.beginPath(); 
            ctx.arc(this.x,this.y,this.s,0,Math.PI*2); 
            ctx.fill(); 
        } 
    }
    
    for(let i=0;i<count;i++) particles.push(new P());
    
    const anim = () => { 
        ctx.clearRect(0,0,canvas.width,canvas.height); 
        particles.forEach(p=>{p.u();p.d();}); 
        window.particleAnimId = requestAnimationFrame(anim); 
    };
    
    window.addEventListener('resize', resize); 
    resize(); 
    anim();
}

// --- AUTH & DATA ---
async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        currentUser = user;
        await syncProfile();
        setupRealtime();
        
        // Admin Check
        if(user.email && user.email.toLowerCase() === APP_CONFIG.authorEmail.toLowerCase()){
            const adminBtn = document.getElementById('admin-btn');
            if(adminBtn) adminBtn.classList.remove('hidden');
        }

        window.showView('home-view');
    } else { window.showView('login-view'); }
}

function setupRealtime() {
    supabase.channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            const msg = payload.new;
            if (activeChatId && (msg.sender_id === activeChatId || msg.receiver_id === activeChatId)) {
                loadMessagesInline(activeChatId);
            }
        }).subscribe();

    supabase.channel('public:chapter_updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chapter_comments' }, () => {
            if (window.currentView === 'chapters-view') loadChapters();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chapter_likes' }, () => {
            if (window.currentView === 'chapters-view') loadChapters();
        }).subscribe();
}

async function syncProfile() {
    try {
        const { data } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
        if (data) {
            profileData = data;
            updateUI();
        } else {
            const newProfile = {
                id: currentUser.id,
                display_name: currentUser.user_metadata.full_name || 'Guest Explorer',
                avatar_url: currentUser.user_metadata.avatar_url || APP_CONFIG.assets.defaultAvatar,
                email: currentUser.email,
                bio: 'Surviving the hope.',
                rating: 0,
                last_seen: new Date(),
                last_chapter: 0,
                last_page: 0
            };
            await supabase.from('profiles').upsert(newProfile);
            profileData = newProfile;
            updateUI();
        }
    } catch (e) { console.error("Profile sync error", e); }
}

// --- NAVIGATION & VIEWS ---
window.showView = function(id, push = true) {
    v();
    const target = document.getElementById(id);
    if (!target) return;

    window.currentView = id;
    document.querySelectorAll('.view').forEach(view => {
        view.classList.add('hidden');
        if(appSettings.transitions) view.classList.remove('animate-in', 'fade-in');
    });
    
    target.classList.remove('hidden');
    if(appSettings.transitions) target.classList.add('animate-in', 'fade-in', 'duration-300');
    
    if (push && navHistory[navHistory.length - 1] !== id) navHistory.push(id);
    
    const nav = document.getElementById('app-nav');
    if (nav) nav.classList.toggle('hidden', ['loading-view','login-view','reader-view'].includes(id));
    
    const backBtn = document.getElementById('master-back-btn');
    if (backBtn) backBtn.classList.toggle('hidden', id === 'home-view');

    if (id === 'home-view') loadHomeContent();
    if (id === 'chapters-view') loadChapters();
    if (id === 'readers-view') loadReaders();
    if (id === 'admin-view') loadAdminDashboard();
    if (id !== 'reader-view') target.scrollTop = 0;
};

window.goBack = () => { 
    if(navHistory.length > 1) { 
        navHistory.pop(); 
        window.showView(navHistory[navHistory.length-1], false); 
    } 
};

window.toggleModal = (id) => { 
    v(); 
    const m = document.getElementById(id);
    if(m) {
        m.classList.toggle('hidden');
        if (id === 'settings-modal' && !m.classList.contains('hidden') && profileData) {
            const nameInp = document.getElementById('profile-edit-name');
            const bioInp = document.getElementById('profile-edit-bio');
            if(nameInp) nameInp.value = profileData.display_name;
            if(bioInp) bioInp.value = profileData.bio || '';
        }
    }
};

// --- AVATAR SYSTEM ---
window.openAvatarSelection = () => {
    // Hide settings modal first
    const settingsModal = document.getElementById('settings-modal');
    if(settingsModal) settingsModal.classList.add('hidden');
    
    const grid = document.getElementById('avatar-grid-container');
    if (!grid) return;

    // Use logged in user's last chapter, or 0 if not set
    const userMaxChapter = profileData ? (profileData.last_chapter || 0) : 0;
    
    // Default Option (Google/Original)
    const originalAvatar = currentUser?.user_metadata?.avatar_url || APP_CONFIG.assets.defaultAvatar;
    const isDefaultSelected = profileData && profileData.avatar_url === originalAvatar;
    
    let html = `
        <div onclick="selectAvatar('${originalAvatar}')" class="avatar-option ${isDefaultSelected ? 'selected' : ''}">
            <img src="${originalAvatar}" loading="lazy">
            <div class="absolute bottom-0 inset-x-0 bg-black/60 text-[6px] text-center text-white py-0.5 font-bold uppercase">Original</div>
            ${isDefaultSelected ? '<div class="absolute inset-0 border-[3px] border-purple-500 rounded-full"></div>' : ''}
        </div>
    `;

    html += AVATAR_CONFIG.map((av, index) => {
        const isLocked = av.unlockChapter > userMaxChapter;
        const isSelected = profileData && profileData.avatar_url === av.url;
        
        let lockHtml = isLocked 
            ? `<div class="avatar-lock-icon"><span class="text-xs font-bold text-white drop-shadow-md">CH ${av.unlockChapter}</span></div>` 
            : '';
            
        let clickAction = isLocked 
            ? `alert('Read up to Chapter ${av.unlockChapter} to unlock ${av.name}!')` 
            : `selectAvatar('${av.url}')`;

        return `
            <div onclick="${clickAction}" class="avatar-option ${isLocked ? 'locked' : ''} ${isSelected ? 'selected' : ''}">
                <img src="${av.url}" loading="lazy">
                ${lockHtml}
                ${isSelected ? '<div class="absolute inset-0 border-[3px] border-purple-500 rounded-full"></div>' : ''}
            </div>
        `;
    }).join('');

    grid.innerHTML = html;
    window.toggleModal('avatar-modal');
};

window.selectAvatar = async (url) => {
    if(!url || !currentUser) return;
    v(20);
    try {
        // Optimistic Update
        profileData.avatar_url = url;
        updateUI();
        window.toggleModal('avatar-modal');
        
        await supabase.from('profiles').update({ avatar_url: url }).eq('id', currentUser.id);
        alert("Identity Updated.");
    } catch(e) {
        alert("Failed to update avatar.");
    }
};

// --- HOME & LEADERBOARD ---
window.setHomeTab = (tab) => { 
    v();
    homeTab = tab; 
    loadHomeContent(); 
};

async function loadHomeContent() {
    // Update Tab UI
    document.querySelectorAll('.tab-btn').forEach(b => {
        if(b.id === `tab-${homeTab}`) b.classList.add('active');
        else b.classList.remove('active');
    });

    const c = document.getElementById('home-tab-content');
    if (!c) return;

    if (homeTab === 'leaderboard') {
        renderLeaderboard(c);
    } else if (homeTab === 'news') {
        renderNews(c);
    } else if (homeTab === 'authors-log') {
        renderAuthorsLog(c);
    } else if (homeTab === 'inspirations') {
        renderInspirations(c);
    }
}

function renderNews(container) {
    container.innerHTML = `
        <div class="animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div class="news-card">
                 <div class="flex justify-between items-start mb-2">
                    <h4 class="text-white text-xs font-black uppercase tracking-widest">Inspirations Unlocked</h4>
                    <span class="text-[8px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">NEW</span>
                </div>
                <p class="text-[10px] text-slate-300 leading-relaxed">
                    A new <span class="text-purple-400 font-bold">Inspirations Tab</span> is now available. Discover the music, movies, and art that shaped this world. 
                    <br><span class="opacity-50 italic">(Requires reaching Chapter 30 to view content)</span>
                </p>
            </div>

            <div class="news-card">
                 <div class="flex justify-between items-start mb-2">
                    <h4 class="text-white text-xs font-black uppercase tracking-widest">Avatar Reset</h4>
                    <span class="text-[8px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">UPDATE</span>
                </div>
                <p class="text-[10px] text-slate-300 leading-relaxed">
                    You can now restore your original profile picture from the Avatar menu if you wish to switch back from a character portrait.
                </p>
            </div>
        </div>
    `;
}

function renderAuthorsLog(container) {
    container.innerHTML = `
        <div class="animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div class="log-card">
                 <div class="flex items-center gap-2 mb-2">
                    <span class="text-lg">✨</span>
                    <h4 class="text-purple-400 text-[10px] font-black uppercase tracking-widest">Dev Log #3</h4>
                </div>
                <p class="text-[10px] text-slate-300 leading-relaxed mb-2">
                    Upgraded role tags! All readers are now officially designated as <b class="text-white">Explorers</b>. Added visual flair to the tag to match the aesthetic.
                </p>
            </div>
             <div class="log-card">
                 <div class="flex items-center gap-2 mb-2">
                    <span class="text-lg">🛠️</span>
                    <h4 class="text-blue-400 text-[10px] font-black uppercase tracking-widest">Dev Log #2</h4>
                </div>
                <p class="text-[10px] text-slate-300 leading-relaxed mb-2">
                    Added progress tracking. I can now see where everyone is in the story to help me pace future chapters better. 
                </p>
            </div>
        </div>
    `;
}

function renderInspirations(container) {
    const isUnlocked = profileData && profileData.last_chapter >= 30;
    
    if (!isUnlocked) {
        container.innerHTML = `
            <div class="relative min-h-[300px] rounded-xl overflow-hidden border border-white/10 flex items-center justify-center p-6 text-center">
                <!-- Blurred BG -->
                <div class="absolute inset-0 bg-[url('https://i.ibb.co/0jNjDF8k/Cover2.png')] bg-cover bg-center blur-xl opacity-30"></div>
                <div class="relative z-10 space-y-4">
                    <div class="text-4xl">🔒</div>
                    <h3 class="text-lg font-black text-white uppercase tracking-widest">Classified Archives</h3>
                    <p class="text-xs text-slate-400 font-medium">
                        The inspirations and core memories behind this world are locked.
                    </p>
                    <div class="inline-block border border-purple-500/50 bg-purple-900/20 px-4 py-2 rounded-full">
                        <p class="text-[10px] text-purple-300 font-bold uppercase tracking-widest">Reach Chapter 30 to Unlock</p>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    // Render Unlocked Content
    container.innerHTML = INSPIRATIONS_CONFIG.map(item => `
        <div class="inspiration-card animate-in fade-in slide-in-from-bottom-6">
            <div class="inspiration-img-box group">
                <img src="${item.image}" alt="${item.title}" onerror="this.src='https://i.ibb.co/0jNjDF8k/Cover2.png'; this.style.filter='grayscale(100%)';">
            </div>
            <div class="inspiration-content">
                <p class="text-[9px] text-purple-400 font-black uppercase tracking-widest mb-1">${item.context}</p>
                <h3 class="text-sm font-bold text-white leading-tight mb-2">${item.title}</h3>
                <a href="${item.image}" target="_blank" class="text-[8px] text-slate-400 uppercase tracking-wider underline opacity-50 hover:opacity-100">View Source</a>
            </div>
        </div>
    `).join('');
}

async function renderLeaderboard(container) {
    container.innerHTML = '<div class="opacity-10 py-10 text-center uppercase text-[8px] tracking-widest">Gathering Data...</div>';
    try {
        const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(20);
        
        container.innerHTML = (data || []).map((u, i) => {
            const email = u.email ? u.email.toLowerCase() : '';
            const isAuth = email === APP_CONFIG.authorEmail.toLowerCase();
            const isFirst = email === APP_CONFIG.firstReaderEmail.toLowerCase();
            const isCoWriter = email === APP_CONFIG.coWriterEmail.toLowerCase();
            
            let name = u.display_name;
            if (isAuth) name = APP_CONFIG.author.toUpperCase();
            
            const r = u.rating ? `<span class="user-rating-pill text-[7px] px-1.5 py-0.5 inline-block whitespace-nowrap flex-shrink-0">${u.rating} ★</span>` : '';
            
            let glowClass = '';
            if (isAuth) glowClass = 'creator-glow';
            else if (isFirst) glowClass = 'first-reader-glow';
            else if (isCoWriter) glowClass = 'co-writer-glow';
            
            let tagHTML = '<span class="explorer-tag">EXPLORER</span>';
            if (isAuth) tagHTML = '<span class="author-tag">AUTHOR</span>';
            else if (isFirst) tagHTML = '<span class="first-reader-tag">FIRST EXPLORER</span>';
            else if (isCoWriter) tagHTML = '<span class="co-writer-tag">CO-WRITER (EMOTIONS)</span>';

            let nameColor = 'text-white';
            if (isFirst) nameColor = 'text-cyan-400';
            if (isCoWriter) nameColor = 'text-fuchsia-400';

            return `
            <div class="flex items-center gap-3 p-3 bg-white/5 rounded-xl mb-2 cursor-pointer" onclick="showUserProfile('${u.id}')">
                <span class="text-[10px] font-black opacity-20 w-4">${i+1}</span>
                <img src="${u.avatar_url}" class="w-8 h-8 rounded-full object-cover border border-white/5 ${glowClass}">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                        <p class="text-[10px] font-black ${nameColor} truncate">${name}</p>
                        ${r}
                    </div>
                    <div class="mt-1 leading-none">${tagHTML}</div>
                </div>
            </div>`;
        }).join('');
    } catch(e) { container.innerHTML = '<p class="text-center py-10 opacity-20 text-[8px]">FAILED TO LOAD DATA</p>'; }
}

// --- CHAPTERS ---
window.setChapterSort = (type) => {
    v();
    chapterSort = type;
    document.getElementById('sort-new').classList.toggle('active', type === 'new');
    document.getElementById('sort-old').classList.toggle('active', type === 'old');
    loadChapters();
};

async function loadChapters() {
    const container = document.getElementById('chapters-list-mobile');
    if (!container) return;
    try {
        const { data: likes } = await supabase.from('chapter_likes').select('chapter_id');
        const { data: comms } = await supabase.from('chapter_comments').select('chapter_id');
        let chapters = [];
        
        // Loop starts from 0 to include Chapter 0
        for(let i=0; i<=30; i++) {
            const config = CHAPTER_CONFIG[i] || { title: `CHAPTER ${i}`, pages: DEFAULT_CHAPTER_PAGES };
            chapters.push({ 
                id: i, 
                title: config.title,
                likes: (likes || []).filter(l => l.chapter_id === i).length || 0, 
                comments: (comms || []).filter(c => c.chapter_id === i).length || 0 
            });
        }
        
        if (chapterSort === 'new') chapters.sort((a,b) => b.id - a.id);
        else chapters.sort((a,b) => a.id - b.id);

        container.innerHTML = chapters.map(c => {
            const isZero = c.id === 0;
            // Apply Red Glow for Chapter 0
            const tabletClass = isZero ? 'chapter-tablet border-red-500/50 shadow-[0_0_15px_rgba(220,38,38,0.3)]' : 'chapter-tablet shadow-xl';
            const numClass = isZero ? 'fantasy-font text-red-500 drop-shadow-[0_0_5px_rgba(220,38,38,0.8)] text-xl' : 'fantasy-font chapter-num-glow';
            const titleClass = isZero ? 'text-red-400 animate-pulse' : 'text-white';
            const orbClass = isZero ? 'border-red-500/30 bg-red-900/10' : 'action-orb';

            return `
            <div id="chapter-card-${c.id}" class="${tabletClass} rounded-2xl p-4 flex justify-between items-center mb-4">
                <div class="flex items-center gap-4 flex-1 cursor-pointer" onclick="openReader(${c.id})">
                    <div class="${numClass}">${c.id}</div>
                    <div class="flex flex-col">
                        <p class="fantasy-font text-[11px] font-bold ${titleClass} uppercase tracking-widest">${c.title}</p>
                        <p class="text-[7px] text-slate-500 font-black uppercase tracking-tighter mt-0.5">TAP TO OPEN PORTAL</p>
                    </div>
                </div>
                <div class="flex gap-3">
                    <button onclick="likeChapterInline(${c.id})" class="${orbClass} w-[50px] h-[50px] rounded-full flex flex-col items-center justify-center border border-white/10 transition-all"><span class="text-red-500">♥</span><span class="text-[9px] text-slate-300">${c.likes}</span></button>
                    <button onclick="toggleChapterInlineComments(${c.id})" class="${orbClass} w-[50px] h-[50px] rounded-full flex flex-col items-center justify-center border border-white/10 transition-all"><span class="text-slate-300">💬</span><span class="text-[9px] text-slate-300">${c.comments}</span></button>
                </div>
            </div>
            <div id="chapter-comments-inline-${c.id}" class="hidden bg-black/40 border-x border-b border-white/5 rounded-b-2xl mx-2 overflow-hidden mb-4">
                <div class="p-4 space-y-4">
                    <div class="flex gap-2">
                        <input id="chapter-input-${c.id}" type="text" placeholder="Share your thoughts..." class="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white outline-none">
                        <button onclick="postChapterComment(${c.id})" class="bg-purple-600 px-4 py-2 rounded-lg text-[9px] font-black uppercase text-white">Post</button>
                    </div>
                    <div id="list-${c.id}" class="space-y-3 max-h-[300px] overflow-y-auto pr-1"></div>
                </div>
            </div>`;
        }).join('');
    } catch(e){
        container.innerHTML = `<div class="p-10 text-center opacity-30 text-xs">Error loading chapters.</div>`;
    }
}

window.toggleChapterInlineComments = async (id) => {
    v();
    const box = document.getElementById(`chapter-comments-inline-${id}`);
    if(!box) return;
    box.classList.toggle('hidden');
    if(!box.classList.contains('hidden')) {
        loadChapterComments(id);
    }
};

async function loadChapterComments(id) {
    const list = document.getElementById(`list-${id}`);
    if(!list) return;
    list.innerHTML = '<div class="text-center py-4 opacity-10 text-[8px] uppercase">Summoning...</div>';
    try {
        const { data } = await supabase.from('chapter_comments').select('*, profiles(display_name, avatar_url, email, rating)').eq('chapter_id', id).order('created_at', { ascending: false });
        list.innerHTML = (data || []).map(c => {
            const p = c.profiles || {};
            const email = p.email ? p.email.toLowerCase() : '';
            const isAuth = email === APP_CONFIG.authorEmail.toLowerCase();
            const isFirst = email === APP_CONFIG.firstReaderEmail.toLowerCase();
            const isCoWriter = email === APP_CONFIG.coWriterEmail.toLowerCase();
            
            let name = p.display_name;
            if (isAuth) name = APP_CONFIG.author.toUpperCase();
            
            const r = p.rating ? `<span class="user-rating-pill text-[7px] ml-0 inline-block whitespace-nowrap flex-shrink-0">${p.rating} ★</span>` : '';
            
            let glowClass = '';
            if (isAuth) glowClass = 'creator-glow';
            else if (isFirst) glowClass = 'first-reader-glow';
            else if (isCoWriter) glowClass = 'co-writer-glow';

            let nameColor = 'text-slate-200';
            if (isAuth) nameColor = 'text-purple-400';
            else if (isFirst) nameColor = 'text-cyan-400';
            else if (isCoWriter) nameColor = 'text-fuchsia-400';

            return `<div class="flex gap-3 items-start p-3 bg-white/5 rounded-xl border border-white/5 animate-in slide-in-from-bottom-2">
                <img src="${p.avatar_url}" class="w-8 h-8 rounded-full object-cover ${glowClass}">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                        <p class="text-[9px] font-black ${nameColor} uppercase truncate">${name}</p>
                        ${r}
                    </div>
                    <p class="text-[11px] text-slate-200 leading-snug mt-1">${c.content}</p>
                </div>
            </div>`;
        }).join('') || '<div class="text-center py-4 opacity-10 text-[8px] uppercase tracking-widest">The archives are empty.</div>';
    } catch(e){}
}

window.postChapterComment = async (id) => {
    const input = document.getElementById(`chapter-input-${id}`);
    const content = input?.value?.trim();
    if(!content) return;
    v(30);
    try {
        const { error } = await supabase.from('chapter_comments').insert({ chapter_id: id, user_id: currentUser.id, content });
        if(error) throw error;
        input.value = '';
        loadChapterComments(id);
    } catch(e){}
};

window.likeChapterInline = async (id) => {
    v(40);
    try {
        await supabase.from('chapter_likes').insert({ chapter_id: id, user_id: currentUser.id });
        loadChapters();
    } catch(e){}
};

// --- READING PROGRESS & READER ---
function saveReadingProgress(chapterId, pageNum) {
    if (!currentUser) return;
    // Clear previous timeout to debounce (prevent hammering DB while scrolling)
    if (readingSaveTimeout) clearTimeout(readingSaveTimeout);
    
    readingSaveTimeout = setTimeout(async () => {
        try {
            // Update local state first
            if (profileData) {
                // Only update max chapter if new is greater
                if ((profileData.last_chapter || 0) < chapterId) {
                    profileData.last_chapter = chapterId;
                }
                profileData.last_page = pageNum;
            }
            
            // DB Update
            // We use 'last_active_at' so we can sort by time in Admin view
            await supabase.from('profiles').update({ 
                last_chapter: profileData.last_chapter,
                last_page: pageNum,
                last_active_at: new Date()
            }).eq('id', currentUser.id);
            
        } catch(e) { console.error("Save progress failed", e); }
    }, 3000); // Save after 3 seconds of settling
}

window.openReader = (id) => {
    currentChapterId = id;
    window.showView('reader-view');
    const container = document.getElementById('reader-pages');
    const progress = document.getElementById('reader-progress-bar');
    if(!container) return;
    
    // Save that we opened this chapter
    saveReadingProgress(id, 1);

    // Check if it is the special video chapter (ID 0)
    if (id === 0) {
        container.innerHTML = `
            <div class="min-h-screen flex flex-col items-center justify-center p-4">
                <div class="w-full aspect-video rounded-xl overflow-hidden shadow-2xl border border-red-900/50 relative bg-black">
                     <iframe class="w-full h-full absolute inset-0" 
                        src="https://www.youtube.com/embed/gD72CMuUQrQ?autoplay=1&vq=hd1080&rel=0&modestbranding=1" 
                        title="Chapter 0" 
                        frameborder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                        allowfullscreen>
                     </iframe>
                </div>
                <p class="text-center text-red-500 mt-6 font-bold text-xs tracking-[0.3em] animate-pulse">TRANSMISSION ESTABLISHED</p>
            </div>
        `;
        if(progress) progress.style.width = '0%';
        return;
    }

    const config = CHAPTER_CONFIG[id] || { title: `CHAPTER ${id}`, pages: DEFAULT_CHAPTER_PAGES };
    container.innerHTML = '<div class="p-20 text-center opacity-10 text-[9px] uppercase tracking-[1em]">Summoning Portal...</div>';
    
    setTimeout(() => {
        container.innerHTML = '';
        
        // Create IntersectionObserver to track which page is visible
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if(entry.isIntersecting) {
                    const pageNum = parseInt(entry.target.getAttribute('data-page'));
                    saveReadingProgress(id, pageNum);
                }
            });
        }, { threshold: 0.5 }); // Trigger when 50% visible

        for(let i=1; i<=config.pages; i++) {
            const img = document.createElement('img');
            img.src = `images/imageschapter${id}/${i}.png`;
            img.className = "w-full shadow-2xl bg-slate-900 mb-0.5"; // Added tiny margin for separation
            img.loading = "lazy";
            img.setAttribute('data-page', i);
            img.onerror = () => { img.style.display = 'none'; };
            
            // Attach observer
            observer.observe(img);
            
            container.appendChild(img);
        }
    }, 400);

    const readerView = document.getElementById('reader-view');
    readerView.onscroll = () => {
        const winScroll = readerView.scrollTop;
        const height = readerView.scrollHeight - readerView.clientHeight;
        const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
        if(progress) progress.style.width = scrolled + "%";

        // Auto Hide Logic
        if (appSettings.autoHide) {
            const st = winScroll;
            const nav = document.getElementById('app-nav');
            if (st > lastScrollTop && st > 50) {
                // Scroll Down
                if(nav) nav.style.transform = 'translateY(-100%)';
            } else {
                // Scroll Up
                if(nav) nav.style.transform = 'translateY(0)';
            }
            lastScrollTop = st <= 0 ? 0 : st;
        }
    };
};

// --- ADMIN DASHBOARD ---
async function loadAdminDashboard() {
    const container = document.getElementById('admin-dashboard-content');
    if(!container) return;
    
    try {
        const { data } = await supabase.from('profiles')
            .select('*')
            .order('last_active_at', { ascending: false }); // Show most recently active first

        if(!data || data.length === 0) {
            container.innerHTML = '<div class="p-8 text-center text-xs text-slate-500">No signals detected.</div>';
            return;
        }

        let html = `
        <table class="admin-table">
            <thead>
                <tr>
                    <th>User</th>
                    <th>Last Active</th>
                    <th>Ch</th>
                    <th>Pg</th>
                </tr>
            </thead>
            <tbody>
        `;

        html += data.map(u => {
            const date = u.last_active_at ? new Date(u.last_active_at).toLocaleString() : 'N/A';
            const shortName = u.display_name.length > 15 ? u.display_name.substring(0, 15) + '...' : u.display_name;
            const ch = u.last_chapter || 0;
            const pg = u.last_page || 0;

            return `
                <tr>
                    <td>
                        <div class="flex items-center gap-2">
                            <img src="${u.avatar_url}" class="w-5 h-5 rounded-full border border-white/10">
                            <span class="font-bold text-white">${shortName}</span>
                        </div>
                    </td>
                    <td class="text-[9px] font-mono text-slate-400">${date}</td>
                    <td class="text-purple-400 font-bold">${ch}</td>
                    <td class="text-blue-400 font-bold">${pg}</td>
                </tr>
            `;
        }).join('');

        html += `</tbody></table>`;
        container.innerHTML = html;

    } catch(e) {
        container.innerHTML = `<div class="p-8 text-red-500 text-xs">Access Denied / Error: ${e.message}</div>`;
    }
}

window.showUserProfile = async (userId) => {
    try {
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if(!data) return;
        
        const email = data.email ? data.email.toLowerCase() : '';
        const isAuth = email === APP_CONFIG.authorEmail.toLowerCase();
        const isFirst = email === APP_CONFIG.firstReaderEmail.toLowerCase();
        const isCoWriter = email === APP_CONFIG.coWriterEmail.toLowerCase();
        
        let name = data.display_name;
        if (isAuth) name = APP_CONFIG.author.toUpperCase();
        
        const r = data.rating ? `<span class="user-rating-pill py-1 px-3 mt-2 inline-block">${data.rating} ★ Rated</span>` : '';
        const content = document.getElementById('user-detail-content');
        if(!content) return;
        
        let glowClass = 'border border-purple-500/30';
        if (isAuth) glowClass = 'creator-glow';
        else if (isFirst) glowClass = 'first-reader-glow';
        else if (isCoWriter) glowClass = 'co-writer-glow';
        
        let roleTag = '<span class="explorer-tag">EXPLORER</span>';
        if (isAuth) roleTag = '<span class="author-tag">AUTHOR & CREATOR</span>';
        else if (isFirst) roleTag = '<span class="first-reader-tag">FIRST EXPLORER</span>';
        else if (isCoWriter) roleTag = '<span class="co-writer-tag">CO-WRITER (EMOTIONS)</span>';

        content.innerHTML = `
            <div class="relative inline-block"><img src="${data.avatar_url}" class="w-24 h-24 rounded-full mx-auto object-cover ${glowClass}"></div>
            <div class="flex flex-col items-center gap-1">
                <h4 class="text-sm font-black text-white uppercase tracking-widest">${name}</h4>
                ${roleTag}
                ${r}
            </div>
            <p class="text-[11px] text-slate-400 italic px-4 mt-2">${data.bio || "Searching for hope..."}</p>`;
        window.toggleModal('user-detail-modal');
    } catch(e){}
};

// --- READERS & CHAT ---
async function loadReaders() {
    const c = document.getElementById('readers-list');
    if(!c) return;
    c.innerHTML = '<div class="text-center p-10 opacity-20 uppercase text-[9px]">Searching Users...</div>';
    try {
        const { data } = await supabase.from('profiles').select('*');
        c.innerHTML = (data || []).map(r => {
            const email = r.email ? r.email.toLowerCase() : '';
            const isAuth = email === APP_CONFIG.authorEmail.toLowerCase();
            const isFirst = email === APP_CONFIG.firstReaderEmail.toLowerCase();
            const isCoWriter = email === APP_CONFIG.coWriterEmail.toLowerCase();
            
            let name = r.display_name;
            if (isAuth) name = APP_CONFIG.author.toUpperCase();
            
            const rating = r.rating ? `<span class="user-rating-pill text-[7px] px-1.5 py-0.5 inline-block whitespace-nowrap flex-shrink-0">${r.rating} ★</span>` : '';
            const isSelf = r.id === currentUser.id;
            
            let glowClass = '';
            if (isAuth) glowClass = 'creator-glow';
            else if (isFirst) glowClass = 'first-reader-glow';
            else if (isCoWriter) glowClass = 'co-writer-glow';
            
            let roleText = 'EXPLORER';
            if (isAuth) roleText = 'AUTHOR';
            else if (isFirst) roleText = 'FIRST EXPLORER';
            else if (isCoWriter) roleText = 'CO-WRITER';
            
            let roleColor = 'text-slate-500';
            if (isAuth) roleColor = 'text-purple-400';
            else if (isFirst) roleColor = 'text-cyan-400';
            else if (isCoWriter) roleColor = 'text-fuchsia-400';

            return `
            <div id="user-card-${r.id}" class="glass-panel p-4 rounded-xl flex flex-col mb-3">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3 cursor-pointer" onclick="showUserProfile('${r.id}')">
                        <img src="${r.avatar_url}" class="w-10 h-10 rounded-full object-cover border border-white/10 ${glowClass}">
                        <div>
                            <div class="flex items-center gap-2">
                                <p class="text-[11px] font-black text-white uppercase truncate">${name}</p>
                                ${rating}
                            </div>
                            <p class="text-[8px] ${roleColor} font-bold uppercase mt-1 leading-none">${roleText}</p>
                        </div>
                    </div>
                    ${!isSelf ? `<button onclick="toggleChat('${r.id}')" class="bg-blue-600 px-4 py-2 rounded-lg text-[9px] font-black uppercase text-white active:scale-95">Message</button>` : ''}
                </div>
                <div id="chat-box-${r.id}" class="hidden mt-4 border-t border-white/5 pt-4">
                    <div class="h-[300px] flex flex-col">
                        <div id="messages-list-${r.id}" class="flex-1 overflow-y-auto space-y-3 mb-3 pr-2 scroll-container"></div>
                        <div class="flex gap-2">
                            <input id="chat-input-${r.id}" type="text" placeholder="Type message..." class="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] text-white outline-none">
                            <button onclick="sendMessage('${r.id}')" class="bg-blue-600 px-4 rounded-lg text-[9px] font-black uppercase">Send</button>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch(e){ c.innerHTML = '<p class="text-center py-10 opacity-20 text-[8px]">ERROR FETCHING USERS</p>'; }
}

window.toggleChat = (userId) => {
    v();
    const box = document.getElementById(`chat-box-${userId}`);
    if(!box) return;
    const isVisible = !box.classList.contains('hidden');
    document.querySelectorAll('[id^="chat-box-"]').forEach(el => el.classList.add('hidden'));
    if(!isVisible) {
        box.classList.remove('hidden');
        activeChatId = userId;
        loadMessagesInline(userId);
    } else {
        activeChatId = null;
    }
};

async function loadMessagesInline(userId) {
    const list = document.getElementById(`messages-list-${userId}`);
    if(!list) return;
    try {
        const { data } = await supabase.from('messages').select('*').or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUser.id})`).order('created_at', { ascending: true });
        list.innerHTML = (data || []).map(m => `
            <div class="flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-1">
                <div class="max-w-[85%] px-3 py-1.5 rounded-xl ${m.sender_id === currentUser.id ? 'bg-blue-600 text-white' : 'bg-white/10 text-slate-200'} text-[10px]">
                    ${m.content}
                </div>
            </div>`).join('');
        list.scrollTop = list.scrollHeight;
    } catch(e){}
}

window.sendMessage = async (userId) => {
    const input = document.getElementById(`chat-input-${userId}`);
    const content = input?.value?.trim();
    if(!content) return;
    v(20);
    try {
        await supabase.from('messages').insert({ sender_id: currentUser.id, receiver_id: userId, content });
        input.value = '';
        loadMessagesInline(userId);
    } catch(e){}
};

// --- RATING SYSTEM ---
window.setRating = (num) => {
    v();
    currentRating = num;
    document.querySelectorAll('.star').forEach((s, i) => { 
        s.style.opacity = i < num ? '1' : '0.3'; 
        s.classList.toggle('text-yellow-500', i < num);
    });
};

window.submitRating = async () => {
    if(!currentRating) return;
    try {
        await supabase.from('profiles').update({ rating: currentRating }).eq('id', currentUser.id);
        alert("Thank you for your rating!");
        await syncProfile();
        window.toggleModal('rating-modal');
    } catch(e){}
};

// --- UI UPDATES ---
function updateUI() {
    if (!profileData) return;
    
    const email = profileData.email ? profileData.email.toLowerCase() : '';
    const isAuth = email === APP_CONFIG.authorEmail.toLowerCase();
    const isFirst = email === APP_CONFIG.firstReaderEmail.toLowerCase();
    const isCoWriter = email === APP_CONFIG.coWriterEmail.toLowerCase();
    
    let name = profileData.display_name;
    if (isAuth) name = APP_CONFIG.author.toUpperCase();
    
    const nameEl = document.getElementById('nav-user-name');
    const roleEl = document.getElementById('nav-user-role');
    const settingsNameEl = document.getElementById('settings-user-name');
    const settingsRoleLabel = document.getElementById('settings-role-label');
    
    if (nameEl) nameEl.innerText = name.toUpperCase();
    if (settingsNameEl) settingsNameEl.innerText = name.toUpperCase();
    
    let roleText = 'EXPLORER';
    let roleColorClass = 'text-slate-400';
    
    if (isAuth) {
        roleText = 'AUTHOR & CREATOR';
        roleColorClass = 'text-purple-400';
    } else if (isFirst) {
        roleText = 'FIRST EXPLORER & REVIEWER';
        roleColorClass = 'text-cyan-400';
    } else if (isCoWriter) {
        roleText = 'CO-WRITER (EMOTIONS)';
        roleColorClass = 'text-fuchsia-400';
    }
    
    if (roleEl) {
        roleEl.innerText = roleText;
        roleEl.className = `text-[9px] font-bold uppercase tracking-tighter ${roleColorClass}`;
    }
    
    if (settingsRoleLabel) {
        settingsRoleLabel.innerText = roleText;
        settingsRoleLabel.className = `text-[8px] font-black uppercase ${roleColorClass}`;
    }
    
    const navPill = document.getElementById('nav-rating-pill');
    const setPill = document.getElementById('settings-rating-pill');
    if(profileData.rating) {
        if(navPill) { navPill.innerText = profileData.rating + ' ★'; navPill.classList.remove('hidden'); }
        if(setPill) { setPill.innerText = profileData.rating + ' ★'; setPill.classList.remove('hidden'); }
    }

    document.querySelectorAll('#nav-user-avatar, #settings-avatar').forEach(img => {
        img.src = profileData.avatar_url;
        img.classList.remove('creator-glow', 'first-reader-glow', 'co-writer-glow');
        if(isAuth) img.classList.add('creator-glow');
        else if(isFirst) img.classList.add('first-reader-glow');
        else if(isCoWriter) img.classList.add('co-writer-glow');
    });
}

window.updateProfile = async function() {
    const nameInput = document.getElementById('profile-edit-name');
    const bioInput = document.getElementById('profile-edit-bio');
    if(!nameInput) return;
    const name = nameInput.value.trim();
    const bio = bioInput ? bioInput.value.trim() : '';
    if(!name) return;
    v(30);
    try {
        await supabase.from('profiles').update({ display_name: name, bio, last_seen: new Date() }).eq('id', currentUser.id);
        await syncProfile();
        alert("Profile Saved.");
        window.toggleModal('settings-modal');
    } catch(e){ alert("Error saving."); }
};

window.shareStory = () => {
    const url = window.location.origin + window.location.pathname;
    if (navigator.share) navigator.share({ title: 'A False Hope', url }).catch(console.error);
    else { navigator.clipboard.writeText(url); alert("Copied!"); }
};

window.installApp = async () => {
    if(deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if(outcome === 'accepted') deferredPrompt = null;
    } else {
        alert("App is already installed or not supported on this browser.");
    }
};

window.clearCache = () => {
    if(confirm("Reload app and clear cache?")) {
        window.location.reload(true);
    }
};

const recognitionData = {
    'MINASHA': { text: "Inspired the creation and personality of Viyona — becoming the heart behind her emotions, elegance, and charm — and contributed romantic moment ideas that shaped some of the story’s most beautiful emotional and stylistic scenes. 🌙💞✨", icon: "❤️" },
    'AROSHA': { text: "Early reviewer and first-ever reader of HOPE 2877 (BOOK) & the first to review every manga page as it’s created, providing fresh perspectives, inspirational suggestions and deep story-strengthening feedback throughout the entire creative process. 🌌✨", icon: "🔥" }
};
window.openRecognition = (key) => {
    const d = recognitionData[key];
    const icon = document.getElementById('recognition-icon-box');
    const name = document.getElementById('recognition-name');
    const text = document.getElementById('recognition-text');
    if(icon && name && text) {
        icon.innerText = d.icon;
        name.innerText = key;
        text.innerText = d.text;
        window.toggleModal('recognition-modal');
    }
};

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => { 
    applySettings(); // Apply settings first
    checkAuth();
    
    document.getElementById('sort-new').classList.remove('active');
    document.getElementById('sort-old').classList.add('active');

    const loginBtn = document.getElementById('google-login-btn');
    if(loginBtn) {
        loginBtn.addEventListener('click', () => {
            supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: APP_CONFIG.redirectUrl } });
        });
    }
});