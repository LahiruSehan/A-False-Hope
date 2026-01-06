
const INTERNAL_API_KEY = "AIzaSyAOLlW_kN85EAassW-OV4OTuAT0Enl8RVc";
if (typeof process === 'undefined') window.process = { env: { API_KEY: INTERNAL_API_KEY } };

const SUPABASE_URL = 'https://qpagyfoedsrbenhsoemx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zaDorGnE20zlG805wQ3SXA_81UbgmLY';
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const AUTHOR_EMAIL = 'lamusicstudio831@gmail.com';
let currentUser = null, profileData = null, navHistory = ['home-view'], currentRating = 0;
let chapterSort = 'new', homeTab = 'leaderboard', isMusicPlaying = false;
let currentChapterId = null;
let activeChatId = null;

const LEVEL_CONFIG = [
    { level: 1, xp: 0, name: 'Drifter' }, { level: 2, xp: 10, name: 'Inmate' },
    { level: 3, xp: 20, name: 'Sinner' }, { level: 4, xp: 30, name: 'Follower' },
    { level: 5, xp: 40, name: 'Believer' }, { level: 6, xp: 55, name: 'Apostle' },
    { level: 7, xp: 70, name: 'Prophet' }, { level: 8, xp: 85, name: 'Wraith' },
    { level: 9, xp: 95, name: 'Arch-Demon' }, { level: 10, xp: 100, name: 'MAX' }
];

function v(ms = 10) { if (window.hapticEnabled !== false && navigator.vibrate) navigator.vibrate(ms); }

function initParticles() {
    const canvas = document.getElementById('particle-canvas'), ctx = canvas.getContext('2d');
    let particles = [];
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    class P { constructor() { this.r(); } r() { this.x = Math.random()*canvas.width; this.y = Math.random()*canvas.height; this.s = Math.random()*1.5; this.vx = (Math.random()-0.5)*0.2; this.vy = (Math.random()-0.5)*0.2; this.o = Math.random()*0.3; } u() { this.x+=this.vx; this.y+=this.vy; if(this.x<0||this.x>canvas.width||this.y<0||this.y>canvas.height) this.r(); } d() { ctx.fillStyle=`rgba(168,85,247,${this.o})`; ctx.beginPath(); ctx.arc(this.x,this.y,this.s,0,Math.PI*2); ctx.fill(); } }
    for(let i=0;i<40;i++) particles.push(new P());
    const anim = () => { ctx.clearRect(0,0,canvas.width,canvas.height); particles.forEach(p=>{p.u();p.d();}); requestAnimationFrame(anim); };
    window.addEventListener('resize', resize); resize(); anim();
}

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
    const last = profileData?.last_check_in ? new Date(profileData.last_check_in).toDateString() : null;
    if (last !== today) {
        let newStreak = 1;
        if (last === new Date(Date.now() - 86400000).toDateString()) newStreak = (profileData.streak_count || 0) + 1;
        await supabase.from('profiles').update({ last_check_in: new Date(), streak_count: newStreak }).eq('id', currentUser.id);
        if(profileData) profileData.streak_count = newStreak;
        await addXP(5);
    }
}

function startStatsLoop() {
    setInterval(async () => {
        if (currentUser) {
            await supabase.from('profiles').update({ 
                last_seen: new Date(), 
                total_reading_time: (profileData?.total_reading_time || 0) + 1 
            }).eq('id', currentUser.id);
        }
    }, 60000);
}

window.showView = function(id, push = true) {
    v();
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(id)?.classList.remove('hidden');
    if (push && navHistory[navHistory.length - 1] !== id) navHistory.push(id);
    
    const isReader = id === 'reader-view';
    document.getElementById('app-nav').classList.toggle('hidden', ['loading-view','login-view'].includes(id));
    document.getElementById('master-back-btn').classList.toggle('hidden', ['home-view'].includes(id));
    
    document.getElementById('nav-profile-block').classList.toggle('hidden', isReader);
    document.getElementById('trophy-btn').classList.toggle('hidden', isReader);
    document.getElementById('messages-btn').classList.toggle('hidden', isReader);
    document.getElementById('reader-nav-info').classList.toggle('hidden', !isReader);
    document.getElementById('reader-like-btn').classList.toggle('hidden', !isReader);
    document.getElementById('reader-comment-btn').classList.toggle('hidden', !isReader);

    if (id === 'home-view') loadHomeContent();
    if (id === 'chapters-view') loadChapters();
    if (id === 'readers-view') loadReaders();
    
    // Ensure the view is at top when switching
    if (id !== 'reader-view') document.getElementById(id).scrollTop = 0;
};

window.goBack = () => { if(navHistory.length > 1) { navHistory.pop(); window.showView(navHistory[navHistory.length-1], false); } };
window.toggleModal = (id) => { v(); const m = document.getElementById(id); m.classList.toggle('hidden'); };

window.addXP = async function(amt) {
    if (profileData?.email === AUTHOR_EMAIL && amt > 0) return;
    const nx = Math.min(100, (profileData?.xp || 0) + amt);
    const info = getLvl(nx);
    await supabase.from('profiles').update({ xp: nx, level: info.level }).eq('id', currentUser.id);
    if(profileData) { profileData.xp = nx; profileData.level = info.level; }
    syncProfile();
};

const getLvl = (xp) => {
    let cur = LEVEL_CONFIG[0];
    for(const c of LEVEL_CONFIG) { if(xp >= c.xp) cur = c; else break; }
    return cur;
};

window.setHomeTab = (tab) => { homeTab = tab; loadHomeContent(); };

async function loadHomeContent() {
    v();
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${homeTab}`)?.classList.add('active');
    
    const c = document.getElementById('home-tab-content');
    c.innerHTML = '<div class="opacity-10 py-10 uppercase text-[8px] tracking-widest text-center">Decrypting...</div>';
    
    if (homeTab === 'leaderboard') {
        const { data } = await supabase.from('profiles').select('*').order('xp', { ascending: false }).limit(10);
        c.innerHTML = (data || []).map((u, i) => `
            <div class="flex items-center gap-3 p-3 bg-white/5 rounded-xl mb-2 cursor-pointer active:scale-95 transition-transform" onclick="showUserProfile('${u.id}')">
                <span class="text-[10px] font-black opacity-20 w-4">${i+1}</span>
                <img src="${u.avatar_url}" class="w-8 h-8 rounded-full object-cover border border-white/5">
                <div class="flex-1"><p class="text-[10px] font-black text-white">${u.display_name.toUpperCase()}</p></div>
                <span class="text-[8px] font-black text-purple-400">LVL ${u.level}</span>
            </div>`).join('');
    } else if (homeTab === 'gallery') {
        const items = ['https://picsum.photos/seed/fh1/200/200','https://picsum.photos/seed/fh2/200/200','https://picsum.photos/seed/fh3/200/200','https://picsum.photos/seed/fh4/200/200'];
        c.innerHTML = `<div class="grid grid-cols-2 gap-3">${items.map(img => `<img src="${img}" class="w-full aspect-square object-cover rounded-xl border border-white/5 cursor-pointer active:scale-95 transition-transform" onclick="openLightbox('${img}')">`).join('')}</div>`;
    }
    loadActivePoll();
}

window.openLightbox = (src) => {
    const lb = document.getElementById('gallery-lightbox');
    const img = document.getElementById('lightbox-img');
    img.src = src; lb.classList.remove('hidden');
};

async function loadActivePoll() {
    const container = document.getElementById('active-poll');
    const { data: poll } = await supabase.from('polls').select('*').eq('active', true).single();
    if (!poll) return container.classList.add('hidden');
    container.classList.remove('hidden');
    const { data: vote } = await supabase.from('poll_votes').select('*').eq('poll_id', poll.id).eq('user_id', currentUser.id).single();
    let html = `<h4 class="text-[10px] font-black text-white uppercase tracking-widest">${poll.question}</h4><div class="space-y-2">`;
    for (const opt in poll.options) {
        const isVoted = vote?.option_selected === opt;
        html += `<button onclick="votePoll(${poll.id}, '${opt}')" class="w-full p-3 rounded-lg text-[10px] font-bold text-left ${isVoted ? 'bg-purple-600/20 border border-purple-500/40 text-purple-400' : 'bg-white/5 border border-white/10 text-slate-400'}">${opt}</button>`;
    }
    container.innerHTML = html + `</div>`;
}

window.votePoll = async (id, opt) => {
    const { error } = await supabase.from('poll_votes').upsert({ poll_id: id, user_id: currentUser.id, option_selected: opt });
    if (!error) { v(30); loadActivePoll(); addXP(2); }
};

const recognitionData = {
    'MINASHA': { text: "The primary vessel of the story. Carries the void within her soul.", icon: "❤️" },
    'AROSHA': { text: "The beacon in the dark. A flame that flickers against destiny.", icon: "🔥" }
};
window.openRecognition = (key) => {
    const data = recognitionData[key];
    document.getElementById('recognition-icon-box').innerText = data.icon;
    document.getElementById('recognition-name').innerText = key;
    document.getElementById('recognition-text').innerText = data.text;
    window.toggleModal('recognition-modal');
};

window.setChapterSort = (s) => { chapterSort = s; v(); loadChapters(); };
async function loadChapters() {
    const query = document.getElementById('chapter-search').value.toLowerCase();
    const container = document.getElementById('chapters-list-mobile');
    const { data: likes } = await supabase.from('chapter_likes').select('chapter_id');
    const { data: bookmarks } = await supabase.from('bookmarks').select('chapter_id').eq('user_id', currentUser.id);
    let chapters = [];
    for(let i=1; i<=30; i++) {
        if (query && !`Chapter ${i}`.toLowerCase().includes(query)) continue;
        const count = likes?.filter(l => l.chapter_id === i).length || 0;
        const bookmarked = bookmarks?.some(b => b.chapter_id === i) || false;
        chapters.push({ id: i, likes: count, bookmarked });
    }
    if (chapterSort === 'top') chapters.sort((a,b) => b.likes - a.likes);
    else if (chapterSort === 'old') chapters.sort((a,b) => a.id - b.id);
    else chapters.sort((a,b) => b.id - a.id);
    container.innerHTML = chapters.map(c => `<div class="glass-panel p-4 rounded-xl border border-white/5 flex justify-between items-center cursor-pointer active:scale-[0.98] transition-all" onclick="openReader(${c.id})"><div class="flex items-center gap-4"><span class="bold-italic text-xl text-purple-400 opacity-20">${c.id}</span><p class="text-[11px] font-black text-white uppercase tracking-widest">Chapter ${c.id}</p></div><div class="flex gap-3">${c.bookmarked ? '<span class="text-xs">🔖</span>' : ''}<span class="text-[9px] font-black text-slate-600">♥ ${c.likes}</span></div></div>`).join('');
}

window.openReader = async (id) => {
    currentChapterId = id;
    window.showView('reader-view');
    const container = document.getElementById('reader-pages');
    container.innerHTML = '<div class="p-20 text-center opacity-10 text-[9px] uppercase tracking-[1em]">Summoning...</div>';
    
    // Explicitly scroll reader to top
    document.getElementById('reader-view').scrollTop = 0;

    const { data: prog } = await supabase.from('reading_progress').select('*').eq('user_id', currentUser.id).eq('chapter_id', id).single();
    setTimeout(() => {
        container.innerHTML = '';
        const res = window.highRes ? '1600/2400' : '800/1200';
        for(let i=1;i<=5;i++){
            const wrapper = document.createElement('div');
            wrapper.className = "zoom-container mb-0.5 shadow-2xl";
            const img = document.createElement('img');
            img.src = `https://picsum.photos/seed/fh${id}_${i}/${res}`;
            img.className = "manga-page";
            img.onclick = (e) => { v(5); e.target.classList.toggle('zoomed'); };
            wrapper.appendChild(img);
            container.appendChild(wrapper);
        }
        if (prog) document.getElementById('reader-view').scrollTop = prog.scroll_y;
        addXP(2);
    }, 400);

    const readerView = document.getElementById('reader-view');
    readerView.onscroll = (e) => {
        const perc = (e.target.scrollTop / (e.target.scrollHeight - e.target.clientHeight)) * 100;
        document.getElementById('reader-progress-bar').style.width = perc + '%';
        document.getElementById('reader-mini-progress').style.width = perc + '%';
        clearTimeout(window.saveTimeout);
        window.saveTimeout = setTimeout(() => {
            supabase.from('reading_progress').upsert({ user_id: currentUser.id, chapter_id: id, scroll_y: e.target.scrollTop });
        }, 1500);
    };
};

window.openChapterComments = async () => {
    if(!currentChapterId) return;
    const { data } = await supabase.from('chapter_comments').select('*, profiles(display_name, avatar_url)').eq('chapter_id', currentChapterId).order('created_at', { ascending: false });
    const list = document.getElementById('chapter-comments-list');
    list.innerHTML = (data || []).map(c => `<div class="flex gap-3 p-2 bg-white/5 rounded-lg border border-white/5"><img src="${c.profiles.avatar_url}" class="w-8 h-8 rounded-full object-cover border border-white/10"><div class="flex-1"><div class="flex justify-between items-center"><p class="text-[9px] font-black text-purple-400">${c.profiles.display_name.toUpperCase()}</p><p class="text-[7px] text-slate-600">${new Date(c.created_at).toLocaleDateString()}</p></div><p class="text-[11px] text-slate-300 mt-1">${c.content}</p></div></div>`).join('') || '<p class="text-center opacity-10 py-10">THE VOID IS SILENT</p>';
    window.toggleModal('chapter-comments-modal');
};

window.submitChapterComment = async () => {
    const input = document.getElementById('chapter-comment-input');
    const content = input.value.trim();
    if(!content || !currentChapterId) return;
    const { error } = await supabase.from('chapter_comments').insert({ chapter_id: currentChapterId, user_id: currentUser.id, content });
    if(!error) { input.value = ''; openChapterComments(); addXP(3); }
};

window.likeChapterAction = async () => {
    v(60);
    const { error } = await supabase.from('chapter_likes').insert({ chapter_id: currentChapterId, user_id: currentUser.id });
    if(!error) alert("Sanctified.");
};

window.showUserProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if(!data) return;
    const info = getLvl(data.xp);
    const content = document.getElementById('user-detail-content');
    content.innerHTML = `<img src="${data.avatar_url}" class="w-24 h-24 rounded-full mx-auto border-2 border-purple-500/30 object-cover shadow-2xl"><div><h4 class="text-sm font-black text-white uppercase tracking-widest">${data.display_name}</h4><p class="text-[10px] text-purple-400 font-bold uppercase mt-1">${info.name} • LVL ${data.level}</p></div><div class="text-[11px] text-slate-400 italic px-4">${data.bio || "Searching for hope in the void."}</div><div class="grid grid-cols-2 gap-3 text-[10px] border-t border-white/5 pt-4 text-left px-4"><div class="text-slate-500 font-black">AGE</div><div class="text-right text-white font-bold">${data.age || '—'}</div><div class="text-slate-500 font-black">PAGES</div><div class="text-right text-white font-bold">${data.total_pages_read || 0}</div><div class="text-slate-500 font-black">STREAK</div><div class="text-right text-white font-bold">${data.streak_count || 0}d</div></div>`;
    window.toggleModal('user-detail-modal');
};

// LIVE MESSAGING
window.toggleExpandChat = function(userId) {
    const card = document.getElementById(`user-card-${userId}`);
    const isExpanded = card.classList.contains('expanded');
    document.querySelectorAll('[id^="user-card-"]').forEach(c => c.classList.remove('expanded'));
    if (!isExpanded) {
        card.classList.add('expanded');
        activeChatId = userId;
        loadMessagesInline(userId);
    } else activeChatId = null;
};

async function loadMessagesInline(userId) {
    const container = document.getElementById(`chat-bubbles-${userId}`);
    const { data } = await supabase.from('messages').select('*').or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUser.id})`).order('created_at', { ascending: true });
    if (!data) return;
    container.innerHTML = data.map(m => `
        <div class="flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}">
            <div class="max-w-[85%] px-3 py-1.5 rounded-xl ${m.sender_id === currentUser.id ? 'bg-purple-600 text-white shadow-lg' : 'bg-white/10 text-slate-300'} text-[10px] font-medium mb-1">
                ${m.content}
            </div>
        </div>`).join('');
    container.scrollTop = container.scrollHeight;
}

window.sendMessageInline = async function(userId) {
    const input = document.getElementById(`chat-input-${userId}`);
    const content = input.value.trim();
    if (!content) return;
    v(20);
    const { error } = await supabase.from('messages').insert({ sender_id: currentUser.id, receiver_id: userId, content });
    if (!error) { input.value = ''; loadMessagesInline(userId); }
};

async function loadReaders() {
    const container = document.getElementById('readers-list');
    container.innerHTML = '<div class="text-center p-10 opacity-20 uppercase text-[9px] tracking-widest">Scanning...</div>';
    const { data } = await supabase.from('profiles').select('*').order('xp', { ascending: false });
    if (!data) return;
    container.innerHTML = data.map(r => {
        const isSelf = r.id === currentUser.id;
        return `
        <div id="user-card-${r.id}" class="glass-panel rounded-xl border border-white/5 overflow-hidden mb-3">
            <div class="p-4 flex items-center justify-between">
                <div class="flex items-center gap-3 cursor-pointer" onclick="showUserProfile('${r.id}')">
                    <img src="${r.avatar_url}" class="w-10 h-10 rounded-full object-cover border border-white/10">
                    <div>
                        <p class="text-[11px] font-black text-white uppercase">${r.display_name}</p>
                        <p class="text-[8px] text-purple-400 font-bold uppercase">LVL ${r.level}</p>
                    </div>
                </div>
                ${!isSelf ? `<button onclick="toggleExpandChat('${r.id}')" class="bg-purple-600 border border-purple-500/20 px-4 py-2 rounded-lg text-[9px] font-black uppercase text-white shadow-lg active:scale-95">Signal</button>` : ''}
            </div>
            <div class="expandable-content border-t border-white/5 bg-black/60">
                <div class="flex flex-col h-[300px]">
                    <div id="chat-bubbles-${r.id}" class="flex-1 overflow-y-auto space-y-3 p-4 scroll-container"></div>
                    <div class="p-3 border-t border-white/5 flex gap-2">
                        <input id="chat-input-${r.id}" type="text" placeholder="Pulse input..." class="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] text-white outline-none">
                        <button onclick="sendMessageInline('${r.id}')" class="bg-purple-600 px-3 rounded-lg text-[9px] font-black uppercase shadow-lg">Send</button>
                    </div>
                </div>
            </div>
        </div>`}).join('');
}

window.appSettings = {
    toggleParticles: (val) => { document.getElementById('particle-canvas').style.opacity = val ? '1' : '0'; },
    toggleHaptic: (val) => { window.hapticEnabled = val; },
    setVolume: (val) => { document.getElementById('ambient-audio').volume = val; },
    setBrightness: (val) => { document.getElementById('brightness-overlay').style.opacity = val; },
    toggleProgress: (val) => { document.getElementById('reader-progress-bar').style.display = val ? 'block' : 'none'; document.getElementById('reader-mini-progress').style.display = val ? 'block' : 'none'; },
    toggleHighRes: (val) => { window.highRes = val; if(currentChapterId) openReader(currentChapterId); },
    toggleTransitions: (val) => { document.body.style.setProperty('--transition-speed', val ? '0.3s' : '0s'); },
    toggleSepia: (val) => { document.body.style.filter = val ? 'sepia(0.6)' : 'none'; },
    clearCache: () => { localStorage.clear(); alert("Buffers purged."); location.reload(); },
    toggleExperimental: (val) => { if(val) alert("Warping reality..."); }
};

window.setRating = (num) => {
    currentRating = num;
    document.querySelectorAll('.star').forEach((s, i) => { s.style.opacity = i < num ? '1' : '0.3'; s.classList.toggle('text-yellow-500', i < num); });
};
window.submitRating = async () => { if(currentRating === 0) return; alert("Voice heard."); window.toggleModal('rating-modal'); addXP(10); };

function updateUI() {
    if (!profileData) return;
    const info = getLvl(profileData.xp);
    document.getElementById('nav-user-name').innerText = profileData.display_name.toUpperCase();
    document.getElementById('nav-user-lvl').innerText = info.name.toUpperCase();
    document.querySelectorAll('[id$="-user-avatar"]').forEach(img => img.src = profileData.avatar_url);
    document.getElementById('settings-user-name').innerText = profileData.display_name;
    document.getElementById('stat-pages').innerText = profileData.total_pages_read || 0;
    document.getElementById('stat-streak').innerText = (profileData.streak_count || 0) + 'd';
    document.getElementById('aura-container').className = profileData.level >= 5 ? 'rounded-full p-1 aura-effect' : 'rounded-full p-1';
}

window.updateProfile = async function() {
    const name = document.getElementById('profile-edit-name').value.trim();
    const age = document.getElementById('profile-edit-age').value.trim();
    const bio = document.getElementById('profile-edit-bio').value.trim();
    if(!name) return;
    const { error } = await supabase.from('profiles').update({ display_name: name, age, bio }).eq('id', currentUser.id);
    if (!error) { syncProfile(); alert('Echo saved.'); }
};

window.shareStory = () => {
    const url = "https://lahirusehan.github.io/A-False-Hope/";
    if (navigator.share) navigator.share({ title: 'A False Hope', text: 'Official Story Reader', url }).catch(console.error);
    else { navigator.clipboard.writeText(url); alert("Link copied!"); }
};

document.addEventListener('DOMContentLoaded', () => { 
    initParticles(); 
    checkAuth();
    document.getElementById('google-login-btn')?.addEventListener('click', () => {
        supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'https://lahirusehan.github.io/A-False-Hope/' } });
    });
});
