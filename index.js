
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
let currentRating = 0;

const AUTHOR_EMAIL = 'lamusicstudio831@gmail.com';

const LEVEL_CONFIG = [
    { level: 1, xp: 0, color: '#a855f7', name: 'Drifter' },
    { level: 2, xp: 10, color: '#9333ea', name: 'Inmate' },
    { level: 3, xp: 20, color: '#7e22ce', name: 'Sinner' },
    { level: 4, xp: 30, color: '#6b21a8', name: 'Follower' },
    { level: 5, xp: 40, color: '#581c87', name: 'Believer' },
    { level: 6, xp: 55, color: '#4c1d95', name: 'Apostle' },
    { level: 7, xp: 70, color: '#d946ef', name: 'Prophet' },
    { level: 8, xp: 85, color: '#c026d3', name: 'Wraith' },
    { level: 9, xp: 95, color: '#db2777', name: 'Arch-Demon' },
    { level: 10, xp: 100, color: '#a855f7', name: 'MAX' },
];

// Supabase Realtime for instant messaging
if (supabase) {
    supabase.channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            const msg = payload.new;
            if (activeChatUserId && (msg.sender_id === activeChatUserId || msg.receiver_id === activeChatUserId)) {
                loadMessagesInline(activeChatUserId);
            }
        })
        .subscribe();
}

// Navigation logic
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
        if (modalId === 'settings-modal' && !modal.classList.contains('hidden')) fillProfileData();
    }
}

// XP & Leveling logic
window.addXP = async function(amount, userId = null) {
    const targetId = userId || currentUser.id;
    const isSelf = targetId === currentUser.id;

    // Only author can modify others
    if (!isSelf && currentUser.email !== AUTHOR_EMAIL) return;

    // Fetch existing profile of the target
    const { data: targetProfile, error: fetchError } = await supabase.from('profiles').select('*').eq('id', targetId).single();
    if (fetchError || !targetProfile) return;

    // Authors stay MAX unless admin is explicitly reducing it (rare)
    if (targetProfile.email === AUTHOR_EMAIL && amount > 0) return;

    let newXP = Math.max(0, Math.min(100, (targetProfile.xp || 0) + amount));
    const info = getLevelInfo(newXP);
    
    const { error: updateError } = await supabase
        .from('profiles')
        .update({ xp: newXP, level: info.level })
        .eq('id', targetId);

    if (!updateError) {
        if (isSelf) {
            profileData.xp = newXP;
            profileData.level = info.level;
            updateXPUI();
            renderXPGuide();
        }
        if (userId) loadAdminUsers(); // Refresh admin list if modifying others
    }
}

function getLevelInfo(xp) {
    let current = LEVEL_CONFIG[0];
    for (const conf of LEVEL_CONFIG) {
        if (xp >= conf.xp) current = conf;
        else break;
    }
    const next = LEVEL_CONFIG.find(c => c.level === current.level + 1) || { level: 10, xp: 100 };
    const progress = current.level === 10 ? 100 : ((xp - current.xp) / (next.xp - current.xp)) * 100;
    const label = current.level === 10 ? "MAX" : `LVL ${current.level}`;
    return { ...current, progress, nextXp: next.xp, label };
}

function updateXPUI() {
    if (!profileData) return;
    const info = getLevelInfo(profileData.xp);
    document.querySelectorAll('.xp-bar-fill').forEach(bar => {
        bar.style.width = `${info.progress}%`;
        bar.style.backgroundColor = info.color;
    });
    document.querySelectorAll('.level-label').forEach(el => el.innerText = info.label);
    document.getElementById('nav-user-lvl').innerText = info.label;
    document.documentElement.style.setProperty('--aura-color', info.color);
    
    const xpText = document.getElementById('profile-xp-text');
    if (xpText) xpText.innerText = `${profileData.xp} / ${info.nextXp} XP`;
}

function renderXPGuide() {
    const container = document.getElementById('xp-guide-container');
    if (!container) return;
    container.innerHTML = LEVEL_CONFIG.map(l => {
        const isCurrent = (profileData?.level || 1) === l.level;
        return `
        <div class="xp-node ${isCurrent ? 'opacity-100' : 'opacity-20'} transition-all">
            <div class="w-2.5 h-2.5 rounded-full mx-auto mb-1 border-2 ${isCurrent ? 'aura-bg' : 'border-white/10'}" style="background: ${isCurrent ? l.color : 'transparent'}"></div>
            <p class="text-[6px] font-black text-white uppercase tracking-tighter">${l.level === 10 ? 'MAX' : l.name}</p>
        </div>
    `}).join('');
}

// Chapter Rendering
async function loadChapters() {
    const container = document.getElementById('chapters-list-mobile');
    container.innerHTML = '<div class="text-center p-10 opacity-20 animate-pulse uppercase tracking-[0.5em] text-xs">Accessing Chronicles...</div>';
    
    const { data: likes } = await supabase.from('chapter_likes').select('chapter_id, user_id');
    const { data: comments } = await supabase.from('chapter_comments').select('chapter_id');

    let html = '';
    for (let i = 1; i <= 30; i++) {
        const chapterLikes = likes?.filter(l => l.chapter_id === i) || [];
        const commCount = comments?.filter(c => c.chapter_id === i).length || 0;
        const hasLiked = chapterLikes.some(l => l.user_id === currentUser.id);

        html += `
            <div id="chapter-card-${i}" class="glass-panel rounded-2xl border border-white/5 overflow-hidden">
                <div class="p-4 flex items-center justify-between">
                    <div class="flex items-center gap-4 flex-1 cursor-pointer" onclick="openReader(${i})">
                        <span class="font-impact text-3xl aura-text opacity-40">${i}</span>
                        <div>
                            <h4 class="font-bold text-xs text-white uppercase tracking-widest">CHAPTER ${i}</h4>
                            <p class="text-[8px] text-slate-500 font-black uppercase">Official Record</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <button onclick="toggleLike(${i})" class="btn-action !p-2">
                            <span class="${hasLiked ? 'text-purple-500' : 'text-slate-700'}">♥</span>
                            <span class="text-[9px] font-black">${chapterLikes.length}</span>
                        </button>
                        <button onclick="toggleExpandChapter(${i})" class="btn-action !p-2">
                            <span class="text-slate-700 text-sm">💬</span>
                            <span class="text-[9px] font-black">${commCount}</span>
                        </button>
                    </div>
                </div>
                <div class="expandable-content border-t border-white/5 bg-black/40">
                    <div class="p-4 space-y-4">
                        <div id="chapter-comments-${i}" class="comment-area space-y-2 max-h-[250px] overflow-y-auto"></div>
                        <div class="flex gap-2">
                            <input id="comment-input-${i}" type="text" placeholder="Write feedback..." class="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-purple-500">
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
    container.innerHTML = '<div class="text-[8px] opacity-20 text-center py-4 uppercase">Tracing Echoes...</div>';
    const { data } = await supabase.from('chapter_comments').select('*, profiles(display_name, avatar_url)').eq('chapter_id', id).order('created_at', { ascending: false });
    if (!data || data.length === 0) {
        container.innerHTML = '<div class="text-[8px] opacity-10 text-center py-4 uppercase">Silence reigns</div>';
        return;
    }
    container.innerHTML = data.map(c => `
        <div class="flex gap-2 p-2 bg-white/5 rounded-lg border border-white/5">
            <img src="${c.profiles?.avatar_url}" class="w-5 h-5 rounded-full object-cover">
            <div class="flex-1">
                <span class="text-[8px] font-black text-purple-400 uppercase">${c.profiles?.display_name}</span>
                <p class="text-[10px] text-slate-400">${c.content}</p>
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
        window.addXP(1); 
        loadChapterComments(id);
    }
}

// User List & Chat
async function loadFriends() {
    const container = document.getElementById('readers-list');
    container.innerHTML = '<div class="text-center p-10 opacity-20 animate-pulse uppercase tracking-widest text-xs">Tracking Souls...</div>';
    const { data } = await supabase.from('profiles').select('*').order('xp', { ascending: false });
    if (!data) return;
    container.innerHTML = data.map(r => {
        const isSelf = r.id === currentUser.id;
        const info = getLevelInfo(r.xp);
        const isAuthor = r.email === AUTHOR_EMAIL;
        const displayLabel = isAuthor ? "MAX" : "L" + r.level;
        return `
        <div id="user-card-${r.id}" class="glass-panel rounded-2xl border border-white/5 overflow-hidden">
            <div class="p-4 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="relative">
                        <img src="${r.avatar_url}" class="w-12 h-12 rounded-2xl border border-white/10 object-cover">
                        <div class="absolute -bottom-1 -right-1 aura-bg px-1.5 rounded text-[7px] font-black uppercase">${displayLabel}</div>
                    </div>
                    <div>
                        <h5 class="text-[11px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                            ${r.display_name} 
                            ${isAuthor ? '<span class="text-[7px] bg-yellow-500/20 text-yellow-500 px-1.5 rounded">AUTHOR</span>' : ''}
                        </h5>
                        <p class="text-[8px] text-slate-500 font-bold uppercase">${isAuthor ? 'THE VOID' : info.name}</p>
                    </div>
                </div>
                ${!isSelf ? `<button onclick="toggleExpandChat('${r.id}', '${r.display_name}')" class="aura-bg px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest">Connect</button>` : ''}
            </div>
            <div class="expandable-content border-t border-white/5 bg-black/50">
                <div class="p-4">
                    <div id="chat-bubbles-${r.id}" class="chat-area overflow-y-auto space-y-4 pb-4"></div>
                    <div class="flex gap-2 p-2 bg-white/5 rounded-xl border border-white/10">
                        <input id="chat-input-${r.id}" type="text" placeholder="Send a message..." class="flex-1 bg-transparent px-3 py-2 text-xs text-white outline-none">
                        <button onclick="sendMessageInline('${r.id}')" class="aura-bg px-5 rounded-lg text-[9px] font-black uppercase">Send</button>
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
    } else {
        activeChatUserId = null;
    }
}

async function loadMessagesInline(userId) {
    const container = document.getElementById(`chat-bubbles-${userId}`);
    const { data } = await supabase.from('messages').select('*').or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUser.id})`).order('created_at', { ascending: true });
    if (!data) return;
    container.innerHTML = data.map(m => `
        <div class="flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}">
            <div class="max-w-[80%] px-4 py-3 rounded-2xl ${m.sender_id === currentUser.id ? 'aura-bg text-white' : 'bg-white/10 text-slate-300'} text-[11px] leading-relaxed shadow-lg">
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
        window.addXP(1);
        loadMessagesInline(userId);
    }
}

// Rating System
window.setRating = function(rating) {
    currentRating = rating;
    const stars = document.querySelectorAll('.star');
    stars.forEach((star, i) => {
        star.classList.toggle('active', i < rating);
    });
}

window.submitRating = async function() {
    if (currentRating === 0) return alert("Select a star.");
    const { error } = await supabase.from('ratings').upsert({ user_id: currentUser.id, rating: currentRating });
    if (!error) {
        alert("The void has accepted your rating.");
        window.toggleModal('rating-modal');
        window.addXP(1);
    }
}

window.shareStory = function() {
    const url = "https://lahirusehan.github.io/A-False-Hope/";
    if (navigator.share) {
        navigator.share({ title: 'A False Hope', text: 'Step into the sanctum.', url }).catch(console.error);
    } else {
        navigator.clipboard.writeText(url);
        alert("URL Copied to Clipboard.");
    }
}

// Admin panel for Author
async function loadAdminUsers() {
    const container = document.getElementById('admin-user-list');
    container.innerHTML = '<p class="text-center opacity-30 text-[10px] uppercase">Accessing Soul Records...</p>';
    const { data } = await supabase.from('profiles').select('*').order('xp', { ascending: false });
    if (!data) return;
    container.innerHTML = data.map(u => `
        <div class="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
            <div class="flex flex-col">
                <span class="text-[11px] font-black uppercase text-white truncate max-w-[100px]">${u.display_name}</span>
                <span class="text-[8px] font-bold text-slate-500 tracking-widest">XP: ${u.xp} / ${u.email === AUTHOR_EMAIL ? 'MAX' : 'LVL '+u.level}</span>
            </div>
            <div class="flex gap-2">
                <button onclick="window.addXP(5, '${u.id}')" class="px-3 py-1.5 bg-purple-900/40 text-purple-300 rounded-lg text-[8px] font-black border border-purple-500/30">+5 XP</button>
                <button onclick="window.addXP(-5, '${u.id}')" class="px-3 py-1.5 bg-red-900/40 text-red-300 rounded-lg text-[8px] font-black border border-red-500/30">-5 XP</button>
            </div>
        </div>
    `).join('');
}

async function fetchProfile() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        currentUser = user;

        const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        const isAuthor = user.email === AUTHOR_EMAIL;

        if (error || !data) {
            const newProfile = {
                id: user.id,
                email: user.email,
                display_name: user.user_metadata.full_name || 'Vessel',
                avatar_url: user.user_metadata.avatar_url || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.id}`,
                xp: isAuthor ? 100 : 0,
                level: isAuthor ? 10 : 1,
                bio: isAuthor ? 'Architect of A False Hope.' : 'A soul adrift in the void.'
            };
            await supabase.from('profiles').insert(newProfile);
            profileData = newProfile;
        } else {
            profileData = data;
            if (isAuthor && profileData.xp < 100) {
                profileData.xp = 100; profileData.level = 10;
                await supabase.from('profiles').update({ xp: 100, level: 10 }).eq('id', user.id);
            }
        }

        if (isAuthor) {
            document.getElementById('admin-btn').classList.remove('hidden');
            document.getElementById('author-tag').classList.remove('hidden');
        }
    } catch (e) { console.error("Profile Fetch Error", e); }
    updateNavUI(); updateXPUI(); renderXPGuide();
}

function updateNavUI() {
    if (!profileData) return;
    document.getElementById('nav-user-name').innerText = (profileData.display_name || 'USER').toUpperCase();
    document.getElementById('nav-user-avatar').src = profileData.avatar_url;
    document.getElementById('settings-avatar').src = profileData.avatar_url;
}

function fillProfileData() {
    if (!profileData) return;
    document.getElementById('profile-edit-name').value = profileData.display_name || '';
    document.getElementById('profile-edit-bio').value = profileData.bio || '';
}

window.updateProfile = async function() {
    const newName = document.getElementById('profile-edit-name').value.trim();
    const newBio = document.getElementById('profile-edit-bio').value.trim();
    if (!newName) return alert('Name required.');
    const { error } = await supabase.from('profiles').update({ display_name: newName, bio: newBio }).eq('id', currentUser.id);
    if (!error) {
        profileData.display_name = newName; profileData.bio = newBio;
        updateNavUI(); alert('Identity updated.'); window.addXP(1);
    }
}

window.openReader = function(id) {
    window.showView('reader-view');
    const container = document.getElementById('reader-pages');
    container.innerHTML = '<div class="text-center p-20 opacity-20 animate-pulse font-horror text-2xl uppercase italic">Manifesting Scrolls...</div>';
    setTimeout(() => {
        container.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
            const img = document.createElement('img');
            img.src = `https://picsum.photos/seed/fh_c${id}_p${i}/800/1200`;
            img.className = "w-full mb-1 shadow-2xl";
            container.appendChild(img);
        }
        window.addXP(2); 
    }, 400);
}

window.toggleLike = async function(id) {
    const { data } = await supabase.from('chapter_likes').select('*').eq('chapter_id', id).eq('user_id', currentUser.id).single();
    if (data) {
        await supabase.from('chapter_likes').delete().eq('chapter_id', id).eq('user_id', currentUser.id);
    } else {
        await supabase.from('chapter_likes').insert({ chapter_id: id, user_id: currentUser.id });
        window.addXP(1);
    }
    loadChapters();
}

async function checkAuth() {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        currentUser = user;
        await fetchProfile();
        window.showView('home-view');
    } else {
        window.showView('login-view');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.style.setProperty('--aura-color', '#a855f7');
    checkAuth();
    
    document.getElementById('google-login-btn')?.addEventListener('click', () => {
        supabase.auth.signInWithOAuth({ 
            provider: 'google',
            options: { redirectTo: 'https://lahirusehan.github.io/A-False-Hope/' }
        });
    });
});

window.openRecognition = function(name) {
    const iconBox = document.getElementById('recognition-icon-box');
    const nameEl = document.getElementById('recognition-name');
    const textEl = document.getElementById('recognition-text');
    nameEl.innerText = name;
    if (name === 'MINASHA') { 
        iconBox.innerHTML = '❤️'; textEl.innerText = "The Guardian of Light. Your eternal support creates the sanctuary."; 
    } else { 
        iconBox.innerHTML = '🔥'; textEl.innerText = "The Undying Flame. Your passion illuminates the darkest paths of the chronicle."; 
    }
    window.toggleModal('recognition-modal');
    window.addXP(1);
}
