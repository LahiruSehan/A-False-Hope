import { APP_CONFIG, CHAPTER_CONFIG, DEFAULT_CHAPTER_PAGES } from './config.js';

const INTERNAL_API_KEY = "AIzaSyAOLlW_kN85EAassW-OV4OTuAT0Enl8RVc";
if (typeof process === 'undefined') window.process = { env: { API_KEY: INTERNAL_API_KEY } };

const SUPABASE_URL = 'https://qpagyfoedsrbenhsoemx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zaDorGnE20zlG805wQ3SXA_81UbgmLY';
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

let currentUser = null, profileData = null, navHistory = ['home-view'], currentRating = 0;
let chapterSort = 'new'; 
let homeTab = 'leaderboard';
let currentChapterId = null;
let activeChatId = null;

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

    supabase.channel('public:chapter_updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chapter_comments' }, payload => {
            if (window.currentView === 'chapters-view') loadChapters();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chapter_likes' }, payload => {
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
                display_name: currentUser.user_metadata.full_name || 'Guest Reader',
                avatar_url: currentUser.user_metadata.avatar_url || APP_CONFIG.assets.defaultAvatar,
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

    window.currentView = id;
    document.querySelectorAll('.view').forEach(view => view.classList.add('hidden'));
    target.classList.remove('hidden');
    
    if (push && navHistory[navHistory.length - 1] !== id) navHistory.push(id);
    
    const nav = document.getElementById('app-nav');
    if (nav) nav.classList.toggle('hidden', ['loading-view','login-view','reader-view'].includes(id));
    
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
        const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(20);
        
        c.innerHTML = (data || []).map((u, i) => {
            const isAuth = u.email === APP_CONFIG.authorEmail;
            const name = isAuth ? APP_CONFIG.author.toUpperCase() : u.display_name;
            const r = u.rating ? `<span class="user-rating-pill">${u.rating} ★</span>` : '';
            return `
            <div class="flex items-center gap-3 p-3 bg-white/5 rounded-xl mb-2 cursor-pointer" onclick="showUserProfile('${u.id}')">
                <span class="text-[10px] font-black opacity-20 w-4">${i+1}</span>
                <img src="${u.avatar_url}" class="w-8 h-8 rounded-full object-cover border border-white/5 ${isAuth ? 'creator-glow' : ''}">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1">
                        <p class="text-[10px] font-black text-white truncate">${name}</p>
                        ${r}
                    </div>
                    <p class="text-[7px] text-purple-400 font-bold uppercase">${isAuth ? '<span class="author-tag">AUTHOR</span>' : 'READER'}</p>
                </div>
            </div>`;
        }).join('');
    } catch(e) { c.innerHTML = '<p class="text-center py-10 opacity-20 text-[8px]">FAILED TO LOAD DATA</p>'; }
}

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
        
        // Load all 30 chapters
        for(let i=1; i<=30; i++) {
            const config = CHAPTER_CONFIG[i] || { title: "CHAPTER PORTAL", pages: DEFAULT_CHAPTER_PAGES };
            chapters.push({ 
                id: i, 
                title: config.title,
                likes: (likes || []).filter(l => l.chapter_id === i).length || 0, 
                comments: (comms || []).filter(c => c.chapter_id === i).length || 0 
            });
        }
        
        if (chapterSort === 'new') chapters.sort((a,b) => b.id - a.id);
        else chapters.sort((a,b) => a.id - b.id);

        container.innerHTML = chapters.map(c => `
            <div id="chapter-card-${c.id}" class="chapter-tablet rounded-2xl p-4 flex justify-between items-center shadow-xl">
                <div class="flex items-center gap-4 flex-1 cursor-pointer" onclick="openReader(${c.id})">
                    <div class="fantasy-font chapter-num-glow">${c.id}</div>
                    <div class="flex flex-col">
                        <p class="fantasy-font text-[11px] font-bold text-white uppercase tracking-widest">${c.title}</p>
                        <p class="text-[7px] text-slate-500 font-black uppercase tracking-tighter mt-0.5">TAP TO OPEN PORTAL</p>
                    </div>
                </div>
                <div class="flex gap-3">
                    <button onclick="likeChapterInline(${c.id})" class="action-orb"><span class="text-red-500">♥</span><span class="text-[9px]">${c.likes}</span></button>
                    <button onclick="toggleChapterInlineComments(${c.id})" class="action-orb"><span class="text-slate-300">💬</span><span class="text-[9px]">${c.comments}</span></button>
                </div>
            </div>
            <div id="chapter-comments-inline-${c.id}" class="hidden bg-black/40 border-x border-b border-white/5 rounded-b-2xl mx-2 overflow-hidden">
                <div class="p-4 space-y-4">
                    <div class="flex gap-2">
                        <input id="chapter-input-${c.id}" type="text" placeholder="Share your thoughts..." class="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white outline-none">
                        <button onclick="postChapterComment(${c.id})" class="bg-purple-600 px-4 py-2 rounded-lg text-[9px] font-black uppercase text-white">Post</button>
                    </div>
                    <div id="list-${c.id}" class="space-y-3 max-h-[300px] overflow-y-auto pr-1"></div>
                </div>
            </div>`).join('');
    } catch(e){
        container.innerHTML = `<div class="p-10 text-center opacity-30 text-xs">Run the SQL in your dashboard to fix 404 errors.</div>`;
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
            const isAuth = p.email === APP_CONFIG.authorEmail;
            const r = p.rating ? `<span class="user-rating-pill ml-1">${p.rating} ★</span>` : '';
            return `<div class="flex gap-3 items-start p-3 bg-white/5 rounded-xl border border-white/5 animate-in slide-in-from-bottom-2">
                <img src="${p.avatar_url}" class="w-8 h-8 rounded-full object-cover ${isAuth ? 'creator-glow' : ''}">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1"><p class="text-[9px] font-black text-purple-400 uppercase truncate">${isAuth ? APP_CONFIG.author.toUpperCase() : p.display_name}</p>${r}</div>
                    <p class="text-[11px] text-slate-200 leading-snug mt-0.5">${c.content}</p>
                </div>
            </div>`;
        }).join('') || '<div class="text-center py-4 opacity-10 text-[8px] uppercase tracking-widest">The archives are empty. Be the first to speak.</div>';
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
    } catch(e){ alert("Failed to post comment. Ensure SQL is run."); }
};

window.likeChapterInline = async (id) => {
    v(40);
    try {
        const { error } = await supabase.from('chapter_likes').insert({ chapter_id: id, user_id: currentUser.id });
        if(error && error.code === '23505') {
            // Already liked, handle as unlike or just ignore
        }
        loadChapters();
    } catch(e){}
};

window.openReader = (id) => {
    currentChapterId = id;
    window.showView('reader-view');
    const container = document.getElementById('reader-pages');
    const progress = document.getElementById('reader-progress-bar');
    if(!container) return;
    
    const config = CHAPTER_CONFIG[id] || { title: "CHAPTER PORTAL", pages: DEFAULT_CHAPTER_PAGES };
    
    container.innerHTML = '<div class="p-20 text-center opacity-10 text-[9px] uppercase tracking-[1em]">Summoning Portal...</div>';
    
    setTimeout(() => {
        container.innerHTML = '';
        // Load images based on folder structure provided by user
        for(let i=1; i<=config.pages; i++) {
            const img = document.createElement('img');
            // Path: images/imageschapter[ID]/[PAGE].png
            img.src = `images/imageschapter${id}/${i}.png`;
            img.className = "w-full shadow-2xl bg-slate-900";
            img.loading = "lazy";
            
            // Error handling if image doesn't exist
            img.onerror = () => {
                console.warn(`Failed to load page ${i} for chapter ${id}`);
                img.style.display = 'none';
            };
            
            container.appendChild(img);
        }
    }, 400);

    const readerView = document.getElementById('reader-view');
    readerView.onscroll = () => {
        const winScroll = readerView.scrollTop;
        const height = readerView.scrollHeight - readerView.clientHeight;
        const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
        if(progress) progress.style.width = scrolled + "%";
    };
};

window.showUserProfile = async (userId) => {
    try {
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if(!data) return;
        const isAuth = data.email === APP_CONFIG.authorEmail;
        const name = isAuth ? APP_CONFIG.author.toUpperCase() : data.display_name;
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
            const isAuth = r.email === APP_CONFIG.authorEmail;
            const name = isAuth ? APP_CONFIG.author.toUpperCase() : r.display_name;
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

function updateUI() {
    if (!profileData) return;
    const isAuth = profileData.email === APP_CONFIG.authorEmail;
    const name = isAuth ? APP_CONFIG.author.toUpperCase() : profileData.display_name;
    
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
            supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: APP_CONFIG.redirectUrl } });
        });
    }
});