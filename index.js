
const INTERNAL_API_KEY = "AIzaSyAOLlW_kN85EAassW-OV4OTuAT0Enl8RVc";

if (typeof process === 'undefined') {
    window.process = { env: { API_KEY: INTERNAL_API_KEY } };
}

const SUPABASE_URL = 'https://qpagyfoedsrbenhsoemx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zaDorGnE20zlG805wQ3SXA_81UbgmLY';

const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

let currentUser = null;
let profileData = null;
let navigationHistory = ['home-view'];
let activeChatUserId = null;
let currentCommentChapterId = null;

const AUTHOR_EMAIL = 'lamusicstudio831@gmail.com';

const TOTAL_CHAPTERS = 30;
const LEVEL_CONFIG = [
    { level: 1, xp: 0, color: '#a855f7', name: 'Drifter' },
    { level: 2, xp: 100, color: '#6366f1', name: 'Inmate' },
    { level: 3, xp: 250, color: '#3b82f6', name: 'Sinner' },
    { level: 4, xp: 500, color: '#06b6d4', name: 'Follower' },
    { level: 5, xp: 800, color: '#10b981', name: 'Believer' },
    { level: 6, xp: 1200, color: '#f59e0b', name: 'Apostle' },
    { level: 7, xp: 1700, color: '#f97316', name: 'Prophet' },
    { level: 8, xp: 2300, color: '#ec4899', name: 'Wraith' },
    { level: 9, xp: 3000, color: '#ef4444', name: 'Arch-Demon' },
    { level: 10, xp: 4000, color: '#ffffff', name: 'THE VOID' },
];

// Navigation
window.showView = function(viewId, pushHistory = true) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const target = document.getElementById(viewId);
    if (target) target.classList.remove('hidden');

    const nav = document.getElementById('app-nav');
    const backBtn = document.getElementById('master-back-btn');
    
    if (viewId === 'home-view' || viewId === 'login-view' || viewId === 'loading-view') {
        backBtn.classList.add('hidden');
    } else {
        backBtn.classList.remove('hidden');
    }

    if (viewId !== 'loading-view' && viewId !== 'login-view') {
        nav.classList.remove('hidden');
    } else {
        nav.classList.add('hidden');
    }

    if (pushHistory && navigationHistory[navigationHistory.length - 1] !== viewId) {
        navigationHistory.push(viewId);
    }

    if (viewId === 'chapters-view') loadChapters();
    if (viewId === 'readers-view') loadFriends();
    if (viewId === 'profile-view') fillProfileData();
    if (viewId === 'notifications-view') {
        document.getElementById('bell-badge').classList.add('hidden');
    }
}

window.goBack = function() {
    if (navigationHistory.length > 1) {
        navigationHistory.pop();
        const prevView = navigationHistory[navigationHistory.length - 1];
        window.showView(prevView, false);
    }
}

window.toggleModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.toggle('hidden');
        if (modalId === 'admin-modal' && !modal.classList.contains('hidden')) loadAdminUsers();
    }
}

// XP & Leveling
window.addXP = async function(amount, userId = null) {
    const targetId = userId || currentUser.id;
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', targetId).single();
    if (!profile) return;

    const newXP = (profile.xp || 0) + amount;
    const info = getLevelInfo(newXP);
    
    const { error } = await supabase
        .from('profiles')
        .update({ xp: newXP, level: info.level })
        .eq('id', targetId);

    if (!error && targetId === currentUser.id) {
        profileData.xp = newXP;
        profileData.level = info.level;
        updateXPUI();
        renderXPGuide();
    }
}

function getLevelInfo(xp) {
    let current = LEVEL_CONFIG[0];
    for (const conf of LEVEL_CONFIG) {
        if (xp >= conf.xp) current = conf;
        else break;
    }
    const next = LEVEL_CONFIG.find(c => c.level === current.level + 1) || { level: 10, xp: 4000 };
    const progress = current.level === 10 ? 100 : ((xp - current.xp) / (next.xp - current.xp)) * 100;
    return { ...current, progress, nextXp: next.xp };
}

function updateXPUI() {
    if (!profileData) return;
    const info = getLevelInfo(profileData.xp);
    document.querySelectorAll('.xp-bar-fill').forEach(bar => {
        bar.style.width = `${info.progress}%`;
        bar.style.backgroundColor = info.color;
    });
    document.querySelectorAll('.level-label').forEach(el => el.innerText = `LVL ${info.level}`);
    document.querySelectorAll('.rank-label').forEach(el => el.innerText = info.name.toUpperCase());
    document.getElementById('nav-user-lvl').innerText = `LVL ${info.level}`;
    document.documentElement.style.setProperty('--aura-color', info.color);
    
    const xpText = document.getElementById('profile-xp-text');
    if (xpText) xpText.innerText = `${profileData.xp} / ${info.nextXp} XP`;
}

function renderXPGuide() {
    const container = document.getElementById('xp-guide-container');
    if (!container) return;
    container.innerHTML = LEVEL_CONFIG.map(l => {
        const isCurrent = profileData?.level === l.level;
        return `
        <div class="xp-node ${isCurrent ? 'opacity-100' : 'opacity-30'} transition-all duration-300">
            <div class="w-4 h-4 rounded-full mx-auto mb-1 border ${isCurrent ? 'aura-bg' : 'border-white/20'}"></div>
            <p class="text-[7px] font-black text-white uppercase tracking-tighter">${l.name}</p>
        </div>
    `}).join('');
}

// INLINE EXPANSION LOGIC
async function loadChapters() {
    const container = document.getElementById('chapters-list-mobile');
    container.innerHTML = '<div class="text-center p-10 opacity-30 animate-pulse font-impact tracking-widest uppercase">Fetching...</div>';
    
    const { data: likes } = await supabase.from('chapter_likes').select('chapter_id, user_id');
    const { data: comments } = await supabase.from('chapter_comments').select('chapter_id');

    let html = '';
    for (let i = 1; i <= TOTAL_CHAPTERS; i++) {
        const chapterLikes = likes?.filter(l => l.chapter_id === i) || [];
        const commCount = comments?.filter(c => c.chapter_id === i).length || 0;
        const hasLiked = chapterLikes.some(l => l.user_id === currentUser.id);

        html += `
            <div id="chapter-card-${i}" class="glass-panel rounded-2xl border border-white/5 overflow-hidden">
                <div class="p-4 flex items-center justify-between">
                    <div class="flex items-center gap-4 flex-1 cursor-pointer" onclick="openReader(${i})">
                        <span class="font-impact text-2xl aura-text opacity-50">${i}</span>
                        <div class="leading-tight">
                            <h4 class="font-bold text-xs text-white uppercase">CHAPTER ${i}</h4>
                            <p class="text-[8px] text-slate-500 font-bold uppercase">Chronicle Entry</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-4">
                        <button onclick="toggleLike(${i})" class="flex items-center gap-1.5 p-2 bg-white/5 rounded-xl">
                            <span class="${hasLiked ? 'text-red-500' : 'text-slate-600'}">♥</span>
                            <span class="text-[9px] font-black">${chapterLikes.length}</span>
                        </button>
                        <button onclick="toggleExpandChapter(${i})" class="flex items-center gap-1.5 p-2 bg-white/5 rounded-xl">
                            <span class="text-slate-600 text-sm">💬</span>
                            <span class="text-[9px] font-black">${commCount}</span>
                        </button>
                    </div>
                </div>
                <div class="expandable-content border-t border-white/5 bg-black/40">
                    <div class="p-4 space-y-4">
                        <div id="chapter-comments-${i}" class="comment-area space-y-2"></div>
                        <div class="flex gap-2">
                            <input id="comment-input-${i}" type="text" placeholder="Write feedback..." class="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none">
                            <button onclick="postComment(${i})" class="aura-bg px-4 rounded-xl text-[9px] font-black uppercase">Post</button>
                        </div>
                    </div>
                </div>
            </div>`;
    }
    container.innerHTML = html;
}

window.toggleExpandChapter = function(id) {
    const card = document.getElementById(`chapter-card-${id}`);
    const isExpanded = card.classList.contains('expanded');
    document.querySelectorAll('[id^="chapter-card-"]').forEach(c => c.classList.remove('expanded'));
    if (!isExpanded) {
        card.classList.add('expanded');
        loadChapterComments(id);
    }
}

async function loadChapterComments(id) {
    const container = document.getElementById(`chapter-comments-${id}`);
    container.innerHTML = '<div class="text-[8px] opacity-30 text-center py-2 uppercase tracking-widest">Gathering echoes...</div>';
    const { data } = await supabase.from('chapter_comments').select('*, profiles(display_name, avatar_url)').eq('chapter_id', id).order('created_at', { ascending: false });
    if (!data || data.length === 0) {
        container.innerHTML = '<div class="text-[8px] opacity-20 text-center py-2 uppercase">Silence prevails</div>';
        return;
    }
    container.innerHTML = data.map(c => `
        <div class="flex gap-2 p-2 bg-white/5 rounded-lg">
            <img src="${c.profiles?.avatar_url}" class="w-4 h-4 rounded-full border border-white/10">
            <div class="flex-1">
                <div class="flex justify-between items-center mb-0.5">
                    <span class="text-[8px] font-black text-white uppercase">${c.profiles?.display_name}</span>
                </div>
                <p class="text-[10px] text-slate-400 leading-normal">${c.content}</p>
            </div>
        </div>
    `).join('');
}

window.postComment = async function(id) {
    const input = document.getElementById(`comment-input-${id}`);
    const content = input.value.trim();
    if (!content) return;
    const { error } = await supabase.from('chapter_comments').insert({ chapter_id: id, user_id: currentUser.id, content });
    if (!error) {
        input.value = '';
        window.addXP(10);
        loadChapterComments(id);
    }
}

async function loadFriends() {
    const container = document.getElementById('readers-list');
    container.innerHTML = '<div class="text-center p-10 opacity-30 animate-pulse font-impact tracking-widest uppercase">Searching Users...</div>';
    const { data } = await supabase.from('profiles').select('*').order('xp', { ascending: false });
    if (!data) return;
    container.innerHTML = data.map(r => {
        const isSelf = r.id === currentUser.id;
        const info = getLevelInfo(r.xp);
        return `
        <div id="user-card-${r.id}" class="glass-panel rounded-2xl border border-white/5 overflow-hidden">
            <div class="p-4 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="relative">
                        <img src="${r.avatar_url}" class="w-10 h-10 rounded-xl border border-white/10 object-cover">
                        <div class="absolute -bottom-1 -right-1 aura-bg px-1 rounded text-[6px] font-black uppercase">L${r.level}</div>
                    </div>
                    <div>
                        <h5 class="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                            ${r.display_name} 
                            ${r.id === 'lamusicstudio831_id' ? '<span class="text-[6px] bg-yellow-500/20 text-yellow-500 px-1 rounded">AUTHOR</span>' : ''}
                        </h5>
                        <p class="text-[7px] text-slate-500 font-bold uppercase">${info.name}</p>
                    </div>
                </div>
                ${!isSelf ? `<button onclick="toggleExpandChat('${r.id}', '${r.display_name}')" class="aura-bg px-4 py-2 rounded-xl text-[9px] font-black uppercase">Message</button>` : ''}
            </div>
            <div class="expandable-content border-t border-white/5">
                <div class="chat-area p-4">
                    <div id="chat-bubbles-${r.id}" class="flex-1 overflow-y-auto space-y-3 pb-4 flex flex-col"></div>
                    <div class="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
                        <input id="chat-input-${r.id}" type="text" placeholder="Type..." class="flex-1 bg-transparent px-3 py-2 text-xs text-white outline-none">
                        <button onclick="sendMessageInline('${r.id}')" class="aura-bg px-4 rounded-lg text-[8px] font-black uppercase">Send</button>
                    </div>
                </div>
            </div>
        </div>
    `}).join('');
}

window.toggleExpandChat = function(userId, name) {
    const card = document.getElementById(`user-card-${userId}`);
    const isExpanded = card.classList.contains('expanded');
    document.querySelectorAll('[id^="user-card-"]').forEach(c => c.classList.remove('expanded'));
    if (!isExpanded) {
        card.classList.add('expanded');
        activeChatUserId = userId;
        loadMessagesInline(userId);
    }
}

async function loadMessagesInline(userId) {
    const container = document.getElementById(`chat-bubbles-${userId}`);
    const { data } = await supabase.from('messages').select('*').or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUser.id})`).order('created_at', { ascending: true });
    if (!data) return;
    container.innerHTML = data.map(m => `
        <div class="flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}">
            <div class="max-w-[85%] px-3 py-2 rounded-xl ${m.sender_id === currentUser.id ? 'aura-bg text-white' : 'bg-white/10 text-slate-200'} text-[11px] shadow-lg">
                ${m.content}
            </div>
        </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
}

window.sendMessageInline = async function(userId) {
    const input = document.getElementById(`chat-input-${userId}`);
    const content = input.value.trim();
    if (!content) return;
    const { error } = await supabase.from('messages').insert({ sender_id: currentUser.id, receiver_id: userId, content });
    if (!error) {
        input.value = '';
        window.addXP(2);
        loadMessagesInline(userId);
    }
}

// ADMIN FUNCTIONS
async function loadAdminUsers() {
    const container = document.getElementById('admin-user-list');
    container.innerHTML = '<p class="text-center opacity-30 text-xs">Accessing profile records...</p>';
    const { data } = await supabase.from('profiles').select('*').order('xp', { ascending: false });
    if (!data) return;
    container.innerHTML = data.map(u => `
        <div class="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
            <span class="text-[10px] font-black uppercase text-white truncate max-w-[100px]">${u.display_name}</span>
            <div class="flex gap-2">
                <button onclick="window.addXP(100, '${u.id}')" class="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-[8px] font-black">+100 XP</button>
                <button onclick="window.addXP(-100, '${u.id}')" class="px-2 py-1 bg-red-500/20 text-red-400 rounded text-[8px] font-black">-100 XP</button>
            </div>
        </div>
    `).join('');
}

async function fetchProfile() {
    try {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
        const isAuthor = currentUser.email === AUTHOR_EMAIL;

        if (error || !data) {
            const newProfile = {
                id: currentUser.id,
                display_name: currentUser.user_metadata.full_name || 'Reader',
                avatar_url: currentUser.user_metadata.avatar_url || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${currentUser.id}`,
                xp: isAuthor ? 4000 : 0,
                level: isAuthor ? 10 : 1,
                bio: isAuthor ? 'The Author of A False Hope.' : ''
            };
            await supabase.from('profiles').insert(newProfile);
            profileData = newProfile;
        } else {
            profileData = data;
            if (isAuthor) {
                profileData.level = 10;
                profileData.xp = 4000;
            }
        }

        if (isAuthor) {
            document.getElementById('admin-btn').classList.remove('hidden');
            document.getElementById('author-tag').classList.remove('hidden');
        }
    } catch (e) { console.error("Auth init failure", e); }
    updateNavUI();
    updateXPUI();
}

function updateNavUI() {
    if (!profileData) return;
    document.getElementById('nav-user-name').innerText = (profileData.display_name || 'USER').toUpperCase();
    document.getElementById('nav-user-avatar').src = profileData.avatar_url;
}

window.openReader = function(id) {
    window.showView('reader-view');
    const container = document.getElementById('reader-pages');
    container.innerHTML = '<div class="text-center p-20 opacity-20 animate-pulse font-horror text-2xl uppercase">MANIFESTING...</div>';
    setTimeout(() => {
        container.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
            const img = document.createElement('img');
            img.src = `https://picsum.photos/seed/fh_c${id}_p${i}/800/1200`;
            img.className = "w-full mb-1 shadow-2xl";
            container.appendChild(img);
        }
        window.addXP(20);
    }, 400);
}

window.toggleLike = async function(id) {
    const { data } = await supabase.from('chapter_likes').select('*').eq('chapter_id', id).eq('user_id', currentUser.id).single();
    if (data) await supabase.from('chapter_likes').delete().eq('chapter_id', id).eq('user_id', currentUser.id);
    else {
        await supabase.from('chapter_likes').insert({ chapter_id: id, user_id: currentUser.id });
        window.addXP(5);
    }
    loadChapters();
}

function fillProfileData() {
    if (!profileData) return;
    document.getElementById('profile-full-avatar').src = profileData.avatar_url;
    document.getElementById('profile-full-name').innerText = (profileData.display_name || 'USER').toUpperCase();
    document.getElementById('profile-edit-name').value = profileData.display_name || '';
    document.getElementById('profile-edit-bio').value = profileData.bio || '';
    updateXPUI();
}

window.updateProfile = async function() {
    const newName = document.getElementById('profile-edit-name').value.trim();
    const newBio = document.getElementById('profile-edit-bio').value.trim();
    if (!newName) return alert('Name required.');
    const { error } = await supabase.from('profiles').update({ display_name: newName, bio: newBio }).eq('id', currentUser.id);
    if (!error) {
        profileData.display_name = newName; profileData.bio = newBio;
        updateNavUI(); fillProfileData(); alert('Scroll Saved.'); window.addXP(5);
    }
}

async function checkAuth() {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    currentUser = user;
    if (user) { await fetchProfile(); window.showView('home-view'); renderXPGuide(); }
    else window.showView('login-view');
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    document.getElementById('google-login-btn')?.addEventListener('click', () => {
        supabase.auth.signInWithOAuth({ provider: 'google' });
    });
});

window.openRecognition = function(name) {
    const iconBox = document.getElementById('recognition-icon-box');
    const nameEl = document.getElementById('recognition-name');
    const textEl = document.getElementById('recognition-text');
    nameEl.innerText = name;
    if (name === 'MINASHA') { iconBox.innerHTML = '❤️'; textEl.innerText = "The Guardian. A soul of pure light who supports this world eternally."; }
    else { iconBox.innerHTML = '🔥'; textEl.innerText = "The Flame. A passionate dweller who keeps the shadows at bay."; }
    window.toggleModal('recognition-modal');
    window.addXP(5);
}
