const INTERNAL_API_KEY = "AIzaSyAOLlW_kN85EAassW-OV4OTuAT0Enl8RVc";
if (typeof process === 'undefined') window.process = { env: { API_KEY: INTERNAL_API_KEY } };

const SUPABASE_URL = 'https://qpagyfoedsrbenhsoemx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zaDorGnE20zlG805wQ3SXA_81UbgmLY';
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const AUTHOR_EMAIL = 'lamusicstudio831@gmail.com';
const REDIRECT_URL = 'https://lahirusehan.github.io/A-False-Hope/';

let currentUser = null, profileData = null, navHistory = ['home-view'], currentRating = 0;
let chapterSort = 'new', homeTab = 'leaderboard', isMusicPlaying = false;
let currentChapterId = null;
let activeChatId = null;
let messageSubscription = null;

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
        setupRealtime();
        window.showView('home-view');
    } else { window.showView('login-view'); }
}

function setupRealtime() {
    if (messageSubscription) messageSubscription.unsubscribe();
    messageSubscription = supabase
        .channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            const msg = payload.new;
            if (msg.receiver_id === currentUser.id || msg.sender_id === currentUser.id) {
                const partnerId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
                if (activeChatId === partnerId) {
                    loadMessagesInline(partnerId);
                }
            }
        })
        .subscribe();
}

async function syncProfile() {
    try {
        const { data } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
        profileData = data;
        updateUI();
    } catch (e) { console.error("Profile sync failed", e); }
}

function startStatsLoop() {
    // Only update existing known columns to avoid 400 errors
    setInterval(async () => {
        if (currentUser) {
            try {
                await supabase.from('profiles').update({ 
                    last_seen: new Date()
                }).eq('id', currentUser.id);
            } catch(e) {}
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
    document.getElementById('messages-btn').classList.toggle('hidden', isReader);
    document.getElementById('reader-nav-info').classList.toggle('hidden', !isReader);
    document.getElementById('reader-like-btn').classList.toggle('hidden', !isReader);
    document.getElementById('reader-comment-btn').classList.toggle('hidden', !isReader);

    if (id === 'home-view') loadHomeContent();
    if (id === 'chapters-view') loadChapters();
    if (id === 'readers-view') loadReaders();
    
    if (id !== 'reader-view') document.getElementById(id).scrollTop = 0;
};

window.goBack = () => { if(navHistory.length > 1) { navHistory.pop(); window.showView(navHistory[navHistory.length-1], false); } };
window.toggleModal = (id) => { v(); const m = document.getElementById(id); m.classList.toggle('hidden'); };

window.setHomeTab = (tab) => { homeTab = tab; loadHomeContent(); };

async function loadHomeContent() {
    v();
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${homeTab}`)?.classList.add('active');
    
    const c = document.getElementById('home-tab-content');
    c.innerHTML = '<div class="opacity-10 py-10 uppercase text-[8px] tracking-widest text-center">Loading...</div>';
    
    if (homeTab === 'leaderboard') {
        const { data } = await supabase.from('profiles').select('*').limit(10);
        c.innerHTML = (data || []).map((u, i) => `
            <div class="flex items-center gap-3 p-3 bg-white/5 rounded-xl mb-2 cursor-pointer active:scale-95 transition-transform" onclick="showUserProfile('${u.id}')">
                <span class="text-[10px] font-black opacity-20 w-4">${i+1}</span>
                <img src="${u.avatar_url}" class="w-8 h-8 rounded-full object-cover border border-white/5 ${u.email === AUTHOR_EMAIL ? 'creator-glow' : ''}">
                <div class="flex-1">
                    <p class="text-[10px] font-black text-white">${u.display_name.toUpperCase()}</p>
                    <p class="text-[7px] text-purple-400 font-bold">${u.email === AUTHOR_EMAIL ? 'CREATOR & AUTHOR' : 'READER'}</p>
                </div>
            </div>`).join('');
    } else if (homeTab === 'gallery') {
        const items = [
            'https://picsum.photos/seed/fh1/300/300', 'https://picsum.photos/seed/fh2/300/300',
            'https://picsum.photos/seed/fh3/300/300', 'https://picsum.photos/seed/fh4/300/300'
        ];
        c.innerHTML = `
            <button onclick="alert('Submission system coming soon!')" class="w-full py-4 mb-4 bg-purple-600/10 border border-purple-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-purple-400 active:scale-95 transition-transform">Submit Your Fan Art</button>
            <div class="grid grid-cols-2 gap-3">${items.map(img => `<img src="${img}" class="w-full aspect-square object-cover rounded-xl border border-white/5 cursor-pointer active:scale-95 transition-transform" onclick="openLightbox('${img}')">`).join('')}</div>
        `;
    }
}

window.openLightbox = (src) => {
    const lb = document.getElementById('gallery-lightbox');
    const img = document.getElementById('lightbox-img');
    img.src = src; lb.classList.remove('hidden');
};

const recognitionData = {
    'MINASHA': { text: "The primary vessel of the story. Carries the weight of the void within her soul.", icon: "❤️" },
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
    const container = document.getElementById('chapters-list-mobile');
    container.innerHTML = '<div class="p-10 text-center opacity-20 uppercase text-[9px] tracking-widest">Loading...</div>';
    
    let likes = [];
    try { const { data } = await supabase.from('chapter_likes').select('chapter_id'); likes = data || []; } catch(e){}
    
    let chapters = [];
    for(let i=1; i<=30; i++) {
        const count = likes.filter(l => l.chapter_id === i).length || 0;
        chapters.push({ id: i, likes: count });
    }
    
    if (chapterSort === 'old') chapters.sort((a,b) => a.id - b.id);
    else chapters.sort((a,b) => b.id - a.id);
    
    container.innerHTML = chapters.map(c => `
        <div id="chapter-card-${c.id}" class="glass-panel rounded-xl border border-white/10 overflow-hidden mb-4 active:scale-[0.99] transition-all">
            <div class="p-5 flex justify-between items-center">
                <div class="flex-1 py-3 cursor-pointer" onclick="openReader(${c.id})">
                    <p class="text-[12px] font-black text-white uppercase tracking-widest">Chapter ${c.id}</p>
                    <p class="text-[9px] text-slate-500 font-bold uppercase mt-1">Read Now</p>
                </div>
                <div class="flex gap-6 items-center">
                    <button onclick="likeChapterInline(${c.id})" class="flex flex-col items-center p-2 active:scale-125 transition-transform">
                        <span class="text-2xl text-red-500">♥</span>
                        <span class="text-[10px] font-black text-white/50">${c.likes}</span>
                    </button>
                    <button onclick="toggleChapterInlineComments(${c.id})" class="flex flex-col items-center p-2 active:scale-125 transition-transform">
                        <span class="text-2xl text-slate-400">💬</span>
                        <span class="text-[10px] font-black text-white/50">Open</span>
                    </button>
                </div>
            </div>
            <div id="chapter-comments-inline-${c.id}" class="expandable-content border-t border-white/5 bg-black/40">
                <div class="p-4 space-y-4">
                    <div id="chapter-comments-list-${c.id}" class="max-h-[300px] overflow-y-auto space-y-3 scroll-container">
                        <p class="text-[8px] opacity-20 text-center uppercase tracking-widest py-4">Loading Comments...</p>
                    </div>
                    <div class="flex gap-2 pt-3 border-t border-white/5">
                        <input id="chapter-comment-input-${c.id}" type="text" placeholder="Add a comment..." class="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white outline-none">
                        <button onclick="submitChapterCommentInline(${c.id})" class="bg-purple-600 px-4 py-2 rounded-lg text-[9px] font-black uppercase">Post</button>
                    </div>
                </div>
            </div>
        </div>`).join('');
}

window.likeChapterInline = async (id) => {
    v(30);
    try { await supabase.from('chapter_likes').insert({ chapter_id: id, user_id: currentUser.id }); loadChapters(); } catch(e){}
};

window.toggleChapterInlineComments = async (id) => {
    v();
    const card = document.getElementById(`chapter-card-${id}`);
    const isExpanded = card.classList.contains('expanded');
    document.querySelectorAll('[id^="chapter-card-"]').forEach(c => c.classList.remove('expanded'));
    if (!isExpanded) { card.classList.add('expanded'); loadChapterCommentsInline(id); }
};

async function loadChapterCommentsInline(id) {
    const list = document.getElementById(`chapter-comments-list-${id}`);
    try {
        const { data } = await supabase.from('chapter_comments').select('*, profiles(display_name, avatar_url, email)').eq('chapter_id', id).order('created_at', { ascending: false });
        if (!data) return;
        list.innerHTML = data.map(c => `
            <div class="flex gap-3 items-start p-2 bg-white/5 rounded-lg">
                <img src="${c.profiles.avatar_url}" class="w-6 h-6 rounded-full object-cover ${c.profiles.email === AUTHOR_EMAIL ? 'creator-glow' : ''}">
                <div class="flex-1">
                    <div class="flex justify-between items-center mb-0.5">
                        <p class="text-[8px] font-black text-purple-400 uppercase">${c.profiles.display_name}</p>
                        <p class="text-[7px] text-slate-600">${new Date(c.created_at).toLocaleDateString()}</p>
                    </div>
                    <p class="text-[10px] text-slate-200 leading-tight">${c.content}</p>
                </div>
            </div>`).join('') || '<p class="text-[8px] opacity-20 text-center uppercase tracking-widest py-4">No comments found.</p>';
    } catch(e){}
}

window.submitChapterCommentInline = async (id) => {
    const input = document.getElementById(`chapter-comment-input-${id}`);
    const content = input.value.trim();
    if(!content) return;
    try {
        const { error } = await supabase.from('chapter_comments').insert({ chapter_id: id, user_id: currentUser.id, content });
        if(!error) { input.value = ''; loadChapterCommentsInline(id); }
    } catch(e){}
};

window.openReader = async (id) => {
    currentChapterId = id;
    v(15);
    window.showView('reader-view');
    const container = document.getElementById('reader-pages');
    container.innerHTML = '<div class="p-20 text-center opacity-10 text-[9px] uppercase tracking-[1em]">Summoning Pages...</div>';
    document.getElementById('reader-view').scrollTop = 0;

    try {
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
        }, 400);
    } catch(e){}

    const readerView = document.getElementById('reader-view');
    readerView.onscroll = (e) => {
        const perc = (e.target.scrollTop / (e.target.scrollHeight - e.target.clientHeight)) * 100;
        document.getElementById('reader-progress-bar').style.width = perc + '%';
        document.getElementById('reader-mini-progress').style.width = perc + '%';
        clearTimeout(window.saveTimeout);
        window.saveTimeout = setTimeout(async () => {
            try { await supabase.from('reading_progress').upsert({ user_id: currentUser.id, chapter_id: id, scroll_y: e.target.scrollTop }); } catch(err){}
        }, 1500);
    };
};

window.openChapterComments = async () => {
    if(!currentChapterId) return;
    try {
        const { data } = await supabase.from('chapter_comments').select('*, profiles(display_name, avatar_url, email)').eq('chapter_id', currentChapterId).order('created_at', { ascending: false });
        const list = document.getElementById('chapter-comments-list');
        list.innerHTML = (data || []).map(c => `
            <div class="flex gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                <img src="${c.profiles.avatar_url}" class="w-8 h-8 rounded-full object-cover border border-white/10 ${c.profiles.email === AUTHOR_EMAIL ? 'creator-glow' : ''}">
                <div class="flex-1">
                    <div class="flex justify-between items-center">
                        <p class="text-[9px] font-black text-purple-400 uppercase">${c.profiles.display_name}</p>
                        <p class="text-[7px] text-slate-600">${new Date(c.created_at).toLocaleDateString()}</p>
                    </div>
                    <p class="text-[11px] text-slate-300 mt-1">${c.content}</p>
                </div>
            </div>`).join('') || '<p class="text-center opacity-10 py-10">No comments yet.</p>';
        window.toggleModal('chapter-comments-modal');
    } catch(e){}
};

window.submitChapterComment = async () => {
    const input = document.getElementById('chapter-comment-input');
    const content = input.value.trim();
    if(!content || !currentChapterId) return;
    try {
        const { error } = await supabase.from('chapter_comments').insert({ chapter_id: currentChapterId, user_id: currentUser.id, content });
        if(!error) { input.value = ''; openChapterComments(); }
    } catch(e){}
};

window.likeChapterAction = async () => {
    v(60);
    try { await supabase.from('chapter_likes').insert({ chapter_id: currentChapterId, user_id: currentUser.id }); alert("Chapter Liked."); } catch(e){}
};

window.showUserProfile = async (userId) => {
    try {
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if(!data) return;
        const isCreator = data.email === AUTHOR_EMAIL;
        const content = document.getElementById('user-detail-content');
        content.innerHTML = `
            <div class="relative inline-block">
                <img src="${data.avatar_url}" class="w-24 h-24 rounded-full mx-auto object-cover shadow-2xl ${isCreator ? 'creator-glow' : 'border-2 border-purple-500/30'}">
            </div>
            <div class="animate-in fade-in zoom-in duration-500">
                <h4 class="text-sm font-black text-white uppercase tracking-widest">${data.display_name}</h4>
                <p class="text-[10px] text-purple-400 font-bold uppercase mt-1">${isCreator ? 'CREATOR & AUTHOR' : 'READER'}</p>
            </div>
            <div class="text-[11px] text-slate-400 italic px-4">${data.bio || "Reading the story."}</div>`;
        window.toggleModal('user-detail-modal');
    } catch(e){}
};

window.toggleExpandChat = function(userId) {
    const card = document.getElementById(`user-card-${userId}`);
    const isExpanded = card.classList.contains('expanded');
    document.querySelectorAll('[id^="user-card-"]').forEach(c => c.classList.remove('expanded'));
    if (!isExpanded) { card.classList.add('expanded'); activeChatId = userId; loadMessagesInline(userId); }
    else activeChatId = null;
};

async function loadMessagesInline(userId) {
    const container = document.getElementById(`chat-bubbles-${userId}`);
    if (!container) return;
    try {
        const { data } = await supabase.from('messages').select('*').or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUser.id})`).order('created_at', { ascending: true });
        if (!data) return;
        container.innerHTML = data.map(m => `
            <div class="flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300">
                <div class="max-w-[85%] px-3 py-1.5 rounded-xl ${m.sender_id === currentUser.id ? 'bg-purple-600 text-white shadow-lg' : 'bg-white/10 text-slate-300'} text-[10px] font-medium mb-1">
                    ${m.content}
                </div>
            </div>`).join('');
        container.scrollTop = container.scrollHeight;
    } catch(e){}
}

window.sendMessageInline = async function(userId) {
    const input = document.getElementById(`chat-input-${userId}`);
    const content = input.value.trim();
    if (!content) return;
    v(20);
    try { await supabase.from('messages').insert({ sender_id: currentUser.id, receiver_id: userId, content }); input.value = ''; } catch(e){}
};

async function loadReaders() {
    const container = document.getElementById('readers-list');
    container.innerHTML = '<div class="text-center p-10 opacity-20 uppercase text-[9px] tracking-widest">Searching Users...</div>';
    try {
        const { data } = await supabase.from('profiles').select('*');
        if (!data) return;
        container.innerHTML = data.map(r => {
            const isSelf = r.id === currentUser.id;
            const isCreator = r.email === AUTHOR_EMAIL;
            return `
            <div id="user-card-${r.id}" class="glass-panel rounded-xl border border-white/5 overflow-hidden mb-3">
                <div class="p-4 flex items-center justify-between">
                    <div class="flex items-center gap-3 cursor-pointer" onclick="showUserProfile('${r.id}')">
                        <img src="${r.avatar_url}" class="w-10 h-10 rounded-full object-cover border border-white/10 ${isCreator ? 'creator-glow' : ''}">
                        <div>
                            <p class="text-[11px] font-black text-white uppercase">${r.display_name}</p>
                            <p class="text-[8px] text-purple-400 font-bold uppercase">${isCreator ? 'CREATOR & AUTHOR' : 'READER'}</p>
                        </div>
                    </div>
                    ${!isSelf ? `<button onclick="toggleExpandChat('${r.id}')" class="bg-purple-600 border border-purple-500/20 px-4 py-2 rounded-lg text-[9px] font-black uppercase text-white shadow-lg active:scale-95">Message</button>` : ''}
                </div>
                <div class="expandable-content border-t border-white/5 bg-black/60">
                    <div class="flex flex-col h-[300px]">
                        <div id="chat-bubbles-${r.id}" class="flex-1 overflow-y-auto space-y-3 p-4 scroll-container"></div>
                        <div class="p-3 border-t border-white/5 flex gap-2">
                            <input id="chat-input-${r.id}" type="text" placeholder="Type message..." class="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] text-white outline-none">
                            <button onclick="sendMessageInline('${r.id}')" class="bg-purple-600 px-3 rounded-lg text-[9px] font-black uppercase shadow-lg">Send</button>
                        </div>
                    </div>
                </div>
            </div>`}).join('');
    } catch(e){}
}

window.appSettings = {
    toggleParticles: (val) => { document.getElementById('particle-canvas').style.opacity = val ? '1' : '0'; },
    toggleHaptic: (val) => { window.hapticEnabled = val; },
    setVolume: (val) => { document.getElementById('ambient-audio').volume = val; },
    setBrightness: (val) => { document.getElementById('brightness-overlay').style.opacity = val; },
    clearCache: () => { localStorage.clear(); alert("App cache cleared."); location.reload(); }
};

window.setRating = (num) => {
    currentRating = num;
    document.querySelectorAll('.star').forEach((s, i) => { s.style.opacity = i < num ? '1' : '0.3'; s.classList.toggle('text-yellow-500', i < num); });
};
window.submitRating = async () => { if(currentRating === 0) return; alert("Thank you for your rating."); window.toggleModal('rating-modal'); };

function updateUI() {
    if (!profileData) return;
    const isCreator = profileData.email === AUTHOR_EMAIL;
    document.getElementById('nav-user-name').innerText = profileData.display_name.toUpperCase();
    document.getElementById('nav-user-role').innerText = isCreator ? 'CREATOR & AUTHOR' : 'READER';
    document.querySelectorAll('[id$="-user-avatar"]').forEach(img => {
        img.src = profileData.avatar_url;
        if(isCreator) img.classList.add('creator-glow');
    });
    document.getElementById('settings-user-name').innerText = profileData.display_name;
    document.getElementById('settings-role-label').innerText = isCreator ? 'CREATOR & AUTHOR' : 'READER';
    document.getElementById('profile-avatar-wrapper').className = isCreator ? 'rounded-full p-1 creator-glow' : 'rounded-full p-1';
}

window.updateProfile = async function() {
    const name = document.getElementById('profile-edit-name').value.trim();
    const bio = document.getElementById('profile-edit-bio').value.trim();
    if(!name) return;
    try {
        const { error } = await supabase.from('profiles').update({ display_name: name, bio }).eq('id', currentUser.id);
        if (!error) { syncProfile(); alert('Profile updated.'); }
    } catch(e){}
};

window.shareStory = () => {
    const url = window.location.origin + window.location.pathname;
    if (navigator.share) navigator.share({ title: 'A False Hope', text: 'Official Manga Reader!', url }).catch(console.error);
    else { navigator.clipboard.writeText(url); alert("Link copied!"); }
};

document.addEventListener('DOMContentLoaded', () => { 
    initParticles(); 
    checkAuth();
    document.getElementById('google-login-btn')?.addEventListener('click', () => {
        supabase.auth.signInWithOAuth({ 
            provider: 'google', 
            options: { redirectTo: REDIRECT_URL }
        });
    });
});