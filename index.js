
const INTERNAL_API_KEY = "AIzaSyAOLlW_kN85EAassW-OV4OTuAT0Enl8RVc";
if (typeof process === 'undefined') window.process = { env: { API_KEY: INTERNAL_API_KEY } };

const SUPABASE_URL = 'https://qpagyfoedsrbenhsoemx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zaDorGnE20zlG805wQ3SXA_81UbgmLY';
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const AUTHOR_EMAIL = 'lamusicstudio831@gmail.com';
let currentUser = null, profileData = null, navHistory = ['home-view'], activeChatId = null, currentRating = 0;
let chapterSort = 'new', homeTab = 'feed', isMusicPlaying = false;

const LEVEL_CONFIG = [
    { level: 1, xp: 0, name: 'Drifter' }, { level: 2, xp: 10, name: 'Inmate' },
    { level: 3, xp: 20, name: 'Sinner' }, { level: 4, xp: 30, name: 'Follower' },
    { level: 5, xp: 40, name: 'Believer' }, { level: 6, xp: 55, name: 'Apostle' },
    { level: 7, xp: 70, name: 'Prophet' }, { level: 8, xp: 85, name: 'Wraith' },
    { level: 9, xp: 95, name: 'Arch-Demon' }, { level: 10, xp: 100, name: 'MAX' }
];

// Helper: Haptic
function v(ms = 10) { if (navigator.vibrate) navigator.vibrate(ms); }

// Particle Background
function initParticles() {
    const canvas = document.getElementById('particle-canvas'), ctx = canvas.getContext('2d');
    let particles = [];
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    class P { constructor() { this.r(); } r() { this.x = Math.random()*canvas.width; this.y = Math.random()*canvas.height; this.s = Math.random()*1.5; this.vx = (Math.random()-0.5)*0.2; this.vy = (Math.random()-0.5)*0.2; this.o = Math.random()*0.3; } u() { this.x+=this.vx; this.y+=this.vy; if(this.x<0||this.x>canvas.width||this.y<0||this.y>canvas.height) this.r(); } d() { ctx.fillStyle=`rgba(168,85,247,${this.o})`; ctx.beginPath(); ctx.arc(this.x,this.y,this.s,0,Math.PI*2); ctx.fill(); } }
    for(let i=0;i<40;i++) particles.push(new P());
    const anim = () => { ctx.clearRect(0,0,canvas.width,canvas.height); particles.forEach(p=>{p.u();p.d();}); requestAnimationFrame(anim); };
    window.addEventListener('resize', resize); resize(); anim();
}

// Auth & Streaks
async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        currentUser = user;
        await syncProfile();
        await handleCheckIn();
        window.showView('home-view');
        startStatsLoop();
    } else { window.showView('login-view'); }
}

async function syncProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    profileData = data;
    updateUI();
}

async function handleCheckIn() {
    const today = new Date().toDateString();
    const last = profileData.last_check_in ? new Date(profileData.last_check_in).toDateString() : null;
    if (last !== today) {
        let newStreak = 1;
        if (last === new Date(Date.now() - 86400000).toDateString()) newStreak = profileData.streak_count + 1;
        await supabase.from('profiles').update({ last_check_in: new Date(), streak_count: newStreak }).eq('id', currentUser.id);
        profileData.streak_count = newStreak;
        await addXP(5);
        document.getElementById('streak-msg').innerText = `STREAK: ${newStreak} DAYS ACTIVE`;
    }
}

function startStatsLoop() {
    setInterval(async () => {
        await supabase.from('profiles').update({ last_seen: new Date(), total_reading_time: (profileData.total_reading_time || 0) + 1 }).eq('id', currentUser.id);
    }, 60000);
}

// Navigation
window.showView = function(id, push = true) {
    v();
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(id)?.classList.remove('hidden');
    if (push && navHistory[navHistory.length - 1] !== id) navHistory.push(id);
    document.getElementById('app-nav').classList.toggle('hidden', ['loading-view','login-view'].includes(id));
    document.getElementById('master-back-btn').classList.toggle('hidden', ['home-view'].includes(id));
    if (id === 'home-view') loadHomeContent();
    if (id === 'chapters-view') loadChapters();
    if (id === 'readers-view') loadReaders();
};

window.goBack = () => { if(navHistory.length > 1) { navHistory.pop(); window.showView(navHistory[navHistory.length-1], false); } };
window.toggleModal = (id) => { v(); const m = document.getElementById(id); m.classList.toggle('hidden'); if(id==='achievements-modal') loadAchievements(); };

// XP & Progress
window.addXP = async function(amt) {
    if (profileData.email === AUTHOR_EMAIL && amt > 0) return;
    const nx = Math.min(100, (profileData.xp || 0) + amt);
    const info = getLvl(nx);
    await supabase.from('profiles').update({ xp: nx, level: info.level }).eq('id', currentUser.id);
    profileData.xp = nx; profileData.level = info.level; syncProfile();
};

const getLvl = (xp) => {
    let cur = LEVEL_CONFIG[0];
    for(const c of LEVEL_CONFIG) { if(xp >= c.xp) cur = c; else break; }
    return cur;
};

// Home Content (Tabs: DevLog, Leaderboard, Gallery)
window.setHomeTab = (tab) => { homeTab = tab; loadHomeContent(); };

async function loadHomeContent() {
    v();
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.innerText.toLowerCase().includes(homeTab)));
    const c = document.getElementById('home-tab-content');
    c.innerHTML = '<div class="opacity-10 py-10 uppercase text-[8px] tracking-widest text-center">Decrypting...</div>';
    
    if (homeTab === 'feed') {
        const { data } = await supabase.from('dev_log').select('*').order('created_at', { ascending: false });
        c.innerHTML = data.map(l => {
            if (l.is_premium && profileData.level < 2) return '';
            return `<div class="p-4 bg-white/5 rounded-xl border border-white/5 mb-3">
                <h4 class="text-[10px] font-black text-purple-400 uppercase mb-1">${l.title}</h4>
                <p class="text-[11px] text-slate-400 leading-tight">${l.content}</p>
            </div>`
        }).join('') || '<p class="text-center opacity-20 py-10">NO LOGS</p>';
    } else if (homeTab === 'leaderboard') {
        const { data } = await supabase.from('profiles').select('*').order('xp', { ascending: false }).limit(10);
        c.innerHTML = data.map((u, i) => `
            <div class="flex items-center gap-3 p-3 bg-white/5 rounded-xl mb-2">
                <span class="text-[10px] font-black opacity-20 w-4">${i+1}</span>
                <img src="${u.avatar_url}" class="w-8 h-8 rounded-full">
                <div class="flex-1"><p class="text-[10px] font-black text-white">${u.display_name.toUpperCase()}</p></div>
                <span class="text-[8px] font-black text-purple-400">LVL ${u.level}</span>
            </div>
        `).join('');
    }
    loadActivePoll();
}

async function loadActivePoll() {
    const container = document.getElementById('active-poll');
    const { data: poll } = await supabase.from('polls').select('*').eq('active', true).single();
    if (!poll) return container.classList.add('hidden');
    container.classList.remove('hidden');
    const { data: vote } = await supabase.from('poll_votes').select('*').eq('poll_id', poll.id).eq('user_id', currentUser.id).single();
    
    let html = `<h4 class="text-[10px] font-black text-white uppercase tracking-widest">${poll.question}</h4><div class="space-y-2">`;
    for (const opt in poll.options) {
        html += `<button onclick="votePoll(${poll.id}, '${opt}')" class="w-full p-3 rounded-lg text-[10px] font-bold text-left ${vote?.option_selected === opt ? 'bg-purple-600/20 border border-purple-500/40 text-purple-400' : 'bg-white/5 border border-white/10 text-slate-400'}">${opt}</button>`;
    }
    container.innerHTML = html + `</div>`;
}

window.votePoll = async (id, opt) => {
    const { error } = await supabase.from('poll_votes').upsert({ poll_id: id, user_id: currentUser.id, option_selected: opt });
    if (!error) { v(30); loadActivePoll(); addXP(2); }
};

// Chapters with Sort/Search
window.setChapterSort = (s) => { chapterSort = s; v(); loadChapters(); };

async function loadChapters() {
    const query = document.getElementById('chapter-search').value.toLowerCase();
    const container = document.getElementById('chapters-list-mobile');
    const { data: likes } = await supabase.from('chapter_likes').select('chapter_id');
    const { data: bookmarks } = await supabase.from('bookmarks').select('chapter_id').eq('user_id', currentUser.id);

    let chapters = [];
    for(let i=1; i<=30; i++) {
        if (query && !`Chapter ${i}`.toLowerCase().includes(query)) continue;
        const count = likes.filter(l => l.chapter_id === i).length;
        const bookmarked = bookmarks.some(b => b.chapter_id === i);
        chapters.push({ id: i, likes: count, bookmarked });
    }

    if (chapterSort === 'top') chapters.sort((a,b) => b.likes - a.likes);
    if (chapterSort === 'old') chapters.sort((a,b) => a.id - b.id);
    else chapters.sort((a,b) => b.id - a.id);

    container.innerHTML = chapters.map(c => `
        <div class="glass-panel p-4 rounded-xl border border-white/5 flex justify-between items-center" onclick="openReader(${c.id})">
            <div class="flex items-center gap-4">
                <span class="bold-italic text-xl text-purple-400 opacity-20">${c.id}</span>
                <p class="text-[11px] font-black text-white uppercase tracking-widest">Chapter ${c.id}</p>
            </div>
            <div class="flex gap-3">
                ${c.bookmarked ? '<span class="text-xs">🔖</span>' : ''}
                <span class="text-[9px] font-black text-slate-600">♥ ${c.likes}</span>
            </div>
        </div>
    `).join('');
}

// Reader Features
window.openReader = async (id) => {
    window.showView('reader-view');
    const container = document.getElementById('reader-pages');
    container.innerHTML = '<div class="p-20 text-center opacity-10 text-[9px] uppercase tracking-[1em]">Summoning...</div>';
    
    // Recovery: Load Progress
    const { data: prog } = await supabase.from('reading_progress').select('*').eq('user_id', currentUser.id).eq('chapter_id', id).single();

    setTimeout(() => {
        container.innerHTML = '';
        for(let i=1;i<=5;i++){
            const img = document.createElement('img');
            img.src = `https://picsum.photos/seed/fh${id}_${i}/800/1200`;
            img.className = "w-full mb-0.5";
            container.appendChild(img);
        }
        if (prog) document.getElementById('reader-view').scrollTop = prog.scroll_y;
        addXP(2);
    }, 400);

    // Save Progress on scroll
    document.getElementById('reader-view').onscroll = (e) => {
        const perc = (e.target.scrollTop / (e.target.scrollHeight - e.target.clientHeight)) * 100;
        document.getElementById('reader-progress-bar').style.width = perc + '%';
        if (perc > 90) supabase.from('profiles').update({ total_pages_read: (profileData.total_pages_read || 0) + 1 }).eq('id', currentUser.id);
        // Debounced save
        clearTimeout(window.saveTimeout);
        window.saveTimeout = setTimeout(() => {
            supabase.from('reading_progress').upsert({ user_id: currentUser.id, chapter_id: id, scroll_y: e.target.scrollTop });
        }, 1000);
    };
};

window.toggleMusic = () => {
    const audio = document.getElementById('ambient-audio');
    isMusicPlaying = !isMusicPlaying;
    isMusicPlaying ? audio.play() : audio.pause();
    document.getElementById('music-btn').innerText = isMusicPlaying ? '🔊' : '🔇';
    v();
};

window.toggleBookmark = async () => {
    // Simplified: Use current chapter from history/nav
    alert("Chapter Bookmarked in your Log.");
    v(30);
};

// Achievements
async function loadAchievements() {
    const { data: all } = await supabase.from('achievements').select('*');
    const { data: earned } = await supabase.from('user_achievements').select('achievement_id').eq('user_id', currentUser.id);
    const container = document.getElementById('achievements-list');
    container.innerHTML = all.map(a => {
        const isEarned = earned.some(e => e.achievement_id === a.id);
        return `<div class="p-3 bg-white/5 rounded-xl flex items-center gap-3 border border-white/5 opacity-${isEarned?100:30}">
            <span class="text-xl">${a.icon}</span>
            <div class="flex-1"><p class="text-[10px] font-black text-white uppercase">${a.name}</p><p class="text-[8px] text-slate-500">${a.description}</p></div>
            ${isEarned ? '<span class="text-xs text-green-500">✔</span>' : ''}
        </div>`
    }).join('');
}

// UI Updates
function updateUI() {
    if (!profileData) return;
    const info = getLvl(profileData.xp);
    document.getElementById('nav-user-name').innerText = profileData.display_name.toUpperCase();
    document.getElementById('nav-user-lvl').innerText = info.name.toUpperCase();
    document.getElementById('nav-user-avatar').src = profileData.avatar_url;
    document.getElementById('settings-avatar').src = profileData.avatar_url;
    document.getElementById('settings-user-name').innerText = profileData.display_name;
    document.getElementById('settings-title-label').innerText = profileData.selected_title || 'DRIFTER';
    document.getElementById('stat-pages').innerText = profileData.total_pages_read || 0;
    document.getElementById('stat-streak').innerText = (profileData.streak_count || 0) + 'd';
    document.getElementById('aura-container').className = profileData.level >= 5 ? 'rounded-full p-1 aura-effect' : 'rounded-full p-1';
}

document.addEventListener('DOMContentLoaded', () => { initParticles(); checkAuth(); });
