const INTERNAL_API_KEY = "AIzaSyAOLlW_kN85EAassW-OV4OTuAT0Enl8RVc";
if (typeof process === 'undefined') window.process = { env: { API_KEY: INTERNAL_API_KEY } };

const SUPABASE_URL = 'https://qpagyfoedsrbenhsoemx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zaDorGnE20zlG805wQ3SXA_81UbgmLY';
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const AUTHOR_EMAIL = 'lamusicstudio831@gmail.com';
const REDIRECT_URL = 'https://lahirusehan.github.io/A-False-Hope/';

let currentUser = null, profileData = null, navHistory = ['home-view'], currentRating = 0;
let chapterSort = 'new', homeTab = 'leaderboard';
let currentChapterId = null;
let activeChatId = null;
let currentFanArtId = null;

// Helper: Haptic Vibration
function v(ms = 10) { if (window.hapticEnabled !== false && navigator.vibrate) navigator.vibrate(ms); }

function initParticles() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    class P { 
        constructor() { this.r(); } 
        r() { this.x = Math.random()*canvas.width; this.y = Math.random()*canvas.height; this.s = Math.random()*1.5; this.vx = (Math.random()-0.5)*0.2; this.vy = (Math.random()-0.5)*0.2; this.o = Math.random()*0.3; } 
        u() { this.x+=this.vx; this.y+=this.vy; if(this.x<0||this.x>canvas.width||this.y<0||this.y>canvas.height) this.r(); } 
        d() { ctx.fillStyle=`rgba(168,85,247,${this.o})`; ctx.beginPath(); ctx.arc(this.x,this.y,this.s,0,Math.PI*2); ctx.fill(); } 
    }
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
    supabase.channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            const msg = payload.new;
            if (activeChatId && (msg.sender_id === activeChatId || msg.receiver_id === activeChatId)) {
                loadMessagesInline(activeChatId);
            }
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
                display_name: currentUser.user_metadata.full_name || 'Guest Reader',
                avatar_url: currentUser.user_metadata.avatar_url || 'https://i.ibb.co/vzG7P6z/default.png',
                email: currentUser.email,
                bio: 'Surviving the hope.',
                rating: 0,
                last_seen: new Date()
            };
            await supabase.from('profiles').upsert(newProfile);
            profileData = newProfile;
            updateUI();
        }
    } catch (e) { console.error("Profile sync error", e); }
}

window.showView = function(id, push = true) {
    v();
    const target = document.getElementById(id);
    if (!target) return;

    document.querySelectorAll('.view').forEach(view => view.classList.add('hidden'));
    target.classList.remove('hidden');
    
    if (push && navHistory[navHistory.length - 1] !== id) navHistory.push(id);
    
    const nav = document.getElementById('app-nav');
    if (nav) nav.classList.toggle('hidden', ['loading-view','login-view'].includes(id));
    
    const backBtn = document.getElementById('master-back-btn');
    if (backBtn) backBtn.classList.toggle('hidden', id === 'home-view');

    if (id === 'home-view') loadHomeContent();
    if (id === 'chapters-view') loadChapters();
    if (id === 'readers-view') loadReaders();
    if (id !== 'reader-view') target.scrollTop = 0;
};

window.goBack = () => { if(navHistory.length > 1) { navHistory.pop(); window.showView(navHistory[navHistory.length-1], false); } };

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

window.setHomeTab = (tab) => { homeTab = tab; loadHomeContent(); };

async function loadHomeContent() {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.id === `tab-${homeTab}`));
    const c = document.getElementById('home-tab-content');
    if (!c) return;
    c.innerHTML = '<div class="opacity-10 py-10 text-center uppercase text-[8px] tracking-widest">Gathering Data...</div>';
    
    try {
        const query = supabase.from('profiles').select('*').limit(20);
        // Fallback for missing last_seen column
        const { data } = await query.order('created_at', { ascending: false }).catch(() => query);
        
        c.innerHTML = (data || []).map((u, i) => {
            const isAuth = u.email === AUTHOR_EMAIL;
            const name = isAuth ? 'LAHIRU SEHAN' : u.display_name;
            const r = u.rating ? `<span class="user-rating-pill">${u.rating} ★</span>` : '';
            return `
            <div class="flex items-center gap-3 p-3 bg-white/5 rounded-xl mb-2 cursor-pointer" onclick="showUserProfile('${u.id}')">
                <span class="text-[10px] font-black opacity-20 w-4">${i+1}</span>
                <img src="${u.avatar_url}" class="w-8 h-8 rounded-full object-cover border border-white/5 ${isAuth ? 'creator-glow' : ''}">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1">
                        <p class="text-[10px] font-black text-white truncate">${name.toUpperCase()}</p>
                        ${r}
                    </div>
                    <p class="text-[7px] text-purple-400 font-bold uppercase">${isAuth ? '<span class="author-tag">AUTHOR</span>' : 'READER'}</p>
                </div>
            </div>`;
        }).join('');
    } catch(e) { c.innerHTML = '<p class="text-center py-10 opacity-20 text-[8px]">FAILED TO LOAD DATA</p>'; }
}

window.openLightbox = (src, id) => {
    const lb = document.getElementById('gallery-lightbox');
    const img = document.getElementById('lightbox-img');
    if (lb && img) {
        img.src = src; 
        currentFanArtId = id;
        lb.classList.remove('hidden');
        loadFanArtInteractions(id);
    }
};

async function loadFanArtInteractions(id) {
    const container = document.getElementById('fanart-interactions');
    if (!container) return;
    container.innerHTML = '<div class="opacity-20 py-4 text-center text-[9px] uppercase tracking-widest">Gathering Scrolls...</div>';
    try {
        const { data: likes } = await supabase.from('fanart_likes').select('id').eq('fanart_id', id);
        const { data: comms } = await supabase.from('fanart_comments').select('*, profiles(display_name, avatar_url, email, rating)').eq('fanart_id', id).order('created_at', { ascending: false });
        
        container.innerHTML = `
            <div class="flex items-center justify-between border-b border-white/5 pb-3">
                <button onclick="likeFanArt('${id}')" class="flex items-center gap-2 bg-red-500/10 px-4 py-2 rounded-lg text-red-500 text-[10px] font-black uppercase">♥ ${likes?.length || 0}</button>
                <div class="text-[9px] font-bold text-slate-500 uppercase">${comms?.length || 0} Comments</div>
            </div>
            <div class="space-y-3 pt-2">
                ${(comms || []).map(c => {
                    const p = c.profiles || {};
                    const isAuth = p.email === AUTHOR_EMAIL;
                    const name = isAuth ? 'LAHIRU SEHAN' : p.display_name;
                    const r = p.rating ? `<span class="user-rating-pill ml-1">${p.rating} ★</span>` : '';
                    return `
                    <div class="flex gap-2 items-start bg-white/5 p-2 rounded-xl">
                        <img src="${p.avatar_url}" class="w-7 h-7 rounded-full object-cover border border-white/10 ${isAuth ? 'creator-glow' : ''}">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-1">
                                <p class="text-[9px] font-black text-purple-400 uppercase truncate">${name}</p>
                                ${r}
                            </div>
                            <p class="text-[11px] text-slate-200 leading-tight break-words">${c.content}</p>
                        </div>
                    </div>`;
                }).join('') || '<p class="text-[8px] opacity-10 text-center py-2 uppercase">No scrolls here yet.</p>'}
            </div>
            <div class="flex gap-2 pt-2">
                <input id="fa-comment-input" type="text" placeholder="Share a thought..." class="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] text-white outline-none">
                <button onclick="submitFanArtComment('${id}')" class="bg-purple-600 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase">Post</button>
            </div>`;
    } catch(e){ console.error(e); }
}

window.likeFanArt = async (id) => {
    v(40);
    try { await supabase.from('fanart_likes').insert({ fanart_id: id, user_id: currentUser.id }); loadFanArtInteractions(id); } catch(e){}
};

window.submitFanArtComment = async (id) => {
    const input = document.getElementById('fa-comment-input');
    const content = input?.value?.trim();
    if(!content) return;
    try {
        await supabase.from('fanart_comments').insert({ fanart_id: id, user_id: currentUser.id, content });
        input.value = ''; loadFanArtInteractions(id);
    } catch(e){}
};

async function loadChapters() {
    const container = document.getElementById('chapters-list-mobile');
    if (!container) return;
    container.innerHTML = '<div class="p-10 text-center opacity-20 uppercase text-[9px] tracking-widest">Summoning Scrolls...</div>';
    try {
        const { data: likes } = await supabase.from('chapter_likes').select('chapter_id');
        const { data: comms } = await supabase.from('chapter_comments').select('chapter_id');
        let chapters = [];
        for(let i=1; i<=30; i++) {
            chapters.push({ 
                id: i, 
                likes: likes?.filter(l => l.chapter_id === i).length || 0, 
                comments: comms?.filter(c => c.chapter_id === i).length || 0 
            });
        }
        if (chapterSort === 'new') chapters.sort((a,b) => b.id - a.id);
        container.innerHTML = chapters.map(c => `
            <div id="chapter-card-${c.id}" class="chapter-tablet rounded-2xl p-4 flex justify-between items-center shadow-xl">
                <div class="flex items-center gap-4 flex-1 cursor-pointer" onclick="openReader(${c.id})">
                    <div class="fantasy-font chapter-num-glow">${c.id}</div>
                    <p class="fantasy-font text-[11px] font-bold text-white uppercase tracking-widest">CHAPTER PORTAL</p>
                </div>
                <div class="flex gap-3">
                    <button onclick="likeChapterInline(${c.id})" class="action-orb"><span class="text-red-500">♥</span><span class="text-[9px]">${c.likes}</span></button>
                    <button onclick="toggleChapterInlineComments(${c.id})" class="action-orb"><span class="text-slate-300">💬</span><span class="text-[9px]">${c.comments}</span></button>
                </div>
            </div>
            <div id="chapter-comments-inline-${c.id}" class="expandable-content border-t border-white/5 bg-black/40"><div id="list-${c.id}" class="p-4 space-y-2"></div></div>`).join('');
    } catch(e){}
}

window.toggleChapterInlineComments = async (id) => {
    const card = document.getElementById(`chapter-card-${id}`);
    const list = document.getElementById(`list-${id}`);
    if(!card || !list) return;
    card.classList.toggle('expanded');
    if(card.classList.contains('expanded')) {
        list.innerHTML = '<div class="text-center py-2 opacity-10 text-[8px] uppercase">Summoning...</div>';
        try {
            const { data } = await supabase.from('chapter_comments').select('*, profiles(display_name, avatar_url, email, rating)').eq('chapter_id', id).order('created_at', { ascending: false });
            list.innerHTML = (data || []).map(c => {
                const p = c.profiles || {};
                const isAuth = p.email === AUTHOR_EMAIL;
                const r = p.rating ? `<span class="user-rating-pill ml-1">${p.rating} ★</span>` : '';
                return `<div class="flex gap-2 items-start p-2 bg-white/5 rounded-xl border border-white/5">
                    <img src="${p.avatar_url}" class="w-7 h-7 rounded-full object-cover ${isAuth ? 'creator-glow' : ''}">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1"><p class="text-[8px] font-black text-purple-400 uppercase truncate">${isAuth ? 'LAHIRU SEHAN' : p.display_name}</p>${r}</div>
                        <p class="text-[11px] text-slate-200">${c.content}</p>
                    </div>
                </div>`;
            }).join('') || '<div class="text-center py-2 opacity-10 text-[8px] uppercase">No comments yet.</div>';
        } catch(e){}
    }
};

window.likeChapterInline = async (id) => {
    v(40);
    try { await supabase.from('chapter_likes').insert({ chapter_id: id, user_id: currentUser.id }); loadChapters(); } catch(e){}
};

window.openReader = (id) => {
    currentChapterId = id;
    window.showView('reader-view');
    const container = document.getElementById('reader-pages');
    if(!container) return;
    container.innerHTML = '<div class="p-20 text-center opacity-10 text-[9px] uppercase tracking-[1em]">Summoning...</div>';
    setTimeout(() => {
        container.innerHTML = '';
        for(let i=1; i<=10; i++) {
            const img = document.createElement('img');
            img.src = `https://picsum.photos/seed/fh${id}_${i}/800/1200`;
            img.className = "manga-page mb-1 w-full shadow-2xl bg-slate-900";
            container.appendChild(img);
        }
    }, 400);
};

window.showUserProfile = async (userId) => {
    try {
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if(!data) return;
        const isAuth = data.email === AUTHOR_EMAIL;
        const name = isAuth ? 'LAHIRU SEHAN' : data.display_name;
        const r = data.rating ? `<span class="user-rating-pill py-1 px-3 mt-2 inline-block">${data.rating} ★ Rated</span>` : '';
        const content = document.getElementById('user-detail-content');
        if(!content) return;
        content.innerHTML = `
            <div class="relative inline-block"><img src="${data.avatar_url}" class="w-24 h-24 rounded-full mx-auto object-cover ${isAuth ? 'creator-glow' : 'border border-purple-500/30'}"></div>
            <div class="flex flex-col items-center gap-1">
                <h4 class="text-sm font-black text-white uppercase tracking-widest">${name}</h4>
                ${isAuth ? '<span class="author-tag">AUTHOR & CREATOR</span>' : '<span class="text-[8px] text-purple-400 font-bold uppercase">READER</span>'}
                ${r}
            </div>
            <p class="text-[11px] text-slate-400 italic px-4 mt-2">${data.bio || "Searching for hope..."}</p>`;
        window.toggleModal('user-detail-modal');
    } catch(e){}
};

async function loadReaders() {
    const c = document.getElementById('readers-list');
    if(!c) return;
    c.innerHTML = '<div class="text-center p-10 opacity-20 uppercase text-[9px]">Searching Users...</div>';
    try {
        const { data } = await supabase.from('profiles').select('*');
        c.innerHTML = (data || []).map(r => {
            const isAuth = r.email === AUTHOR_EMAIL;
            const name = isAuth ? 'LAHIRU SEHAN' : r.display_name;
            const rating = r.rating ? `<span class="user-rating-pill">${r.rating} ★</span>` : '';
            const isSelf = r.id === currentUser.id;
            return `
            <div id="user-card-${r.id}" class="glass-panel p-4 rounded-xl flex flex-col mb-3">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3 cursor-pointer" onclick="showUserProfile('${r.id}')">
                        <img src="${r.avatar_url}" class="w-10 h-10 rounded-full object-cover border border-white/10 ${isAuth ? 'creator-glow' : ''}">
                        <div>
                            <div class="flex items-center gap-1"><p class="text-[11px] font-black text-white uppercase truncate">${name}</p>${rating}</div>
                            <p class="text-[8px] text-purple-400 font-bold uppercase">${isAuth ? 'AUTHOR' : 'READER'}</p>
                        </div>
                    </div>
                    ${!isSelf ? `<button onclick="toggleChat('${r.id}')" class="bg-blue-600 px-4 py-2 rounded-lg text-[9px] font-black uppercase text-white active:scale-95">Message</button>` : ''}
                </div>
                <div id="chat-box-${r.id}" class="expandable-content mt-4 border-t border-white/5 bg-black/40">
                    <div class="h-[300px] flex flex-col p-4">
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
    const box = document.getElementById(`chat-box-${userId}`);
    const card = document.getElementById(`user-card-${userId}`);
    if(!box || !card) return;
    const isOpening = !card.classList.contains('expanded');
    document.querySelectorAll('.glass-panel').forEach(c => c.classList.remove('expanded'));
    if(isOpening) {
        card.classList.add('expanded');
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
            <div class="flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}">
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

window.setRating = (num) => {
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

function updateUI() {
    if (!profileData) return;
    const isAuth = profileData.email === AUTHOR_EMAIL;
    const name = isAuth ? 'LAHIRU SEHAN' : profileData.display_name;
    
    const nameEl = document.getElementById('nav-user-name');
    const roleEl = document.getElementById('nav-user-role');
    if (nameEl) nameEl.innerText = name.toUpperCase();
    if (roleEl) roleEl.innerText = isAuth ? 'AUTHOR & CREATOR' : 'READER';
    
    const navPill = document.getElementById('nav-rating-pill');
    const setPill = document.getElementById('settings-rating-pill');
    if(profileData.rating) {
        if(navPill) { navPill.innerText = profileData.rating + ' ★'; navPill.classList.remove('hidden'); }
        if(setPill) { setPill.innerText = profileData.rating + ' ★'; setPill.classList.remove('hidden'); }
    }

    document.querySelectorAll('#nav-user-avatar, #settings-avatar').forEach(img => {
        img.src = profileData.avatar_url;
        if(isAuth) img.classList.add('creator-glow');
    });
    
    const setUname = document.getElementById('settings-user-name');
    const setRole = document.getElementById('settings-role-label');
    if(setUname) setUname.innerText = name;
    if(setRole) setRole.innerText = isAuth ? 'AUTHOR' : 'READER';
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

window.appSettings = {
    toggleParticles: (val) => { 
        const c = document.getElementById('particle-canvas');
        if(c) c.style.opacity = val ? '1' : '0'; 
    },
    clearCache: () => { localStorage.clear(); location.reload(); }
};

window.shareStory = () => {
    const url = window.location.origin + window.location.pathname;
    if (navigator.share) navigator.share({ title: 'A False Hope', url }).catch(console.error);
    else { navigator.clipboard.writeText(url); alert("Copied!"); }
};

const recognitionData = {
    'MINASHA': { text: "The primary vessel of the story. Carries the weight of the void within her soul.", icon: "❤️" },
    'AROSHA': { text: "The beacon in the dark. A flame that flickers against destiny.", icon: "🔥" }
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

document.addEventListener('DOMContentLoaded', () => { 
    initParticles(); 
    checkAuth();
    const loginBtn = document.getElementById('google-login-btn');
    if(loginBtn) {
        loginBtn.addEventListener('click', () => {
            supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: REDIRECT_URL } });
        });
    }
});