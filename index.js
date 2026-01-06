
const INTERNAL_API_KEY = "AIzaSyAOLlW_kN85EAassW-OV4OTuAT0Enl8RVc";

// Safety Shim for environment
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
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('flex-view-active');
    }

    const nav = document.getElementById('app-nav');
    const backBtn = document.getElementById('master-back-btn');
    
    if (viewId === 'home-view' || viewId === 'login-view' || viewId === 'loading-view') {
        backBtn.classList.add('hidden');
    } else {
        backBtn.classList.remove('hidden');
    }

    if (viewId !== 'loading-view' && viewId !== 'login-view' && viewId !== 'reader-view') {
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
    if (modal) modal.classList.toggle('hidden');
}

// XP & Leveling
window.addXP = async function(amount) {
    if (!profileData) return;
    const newXP = (profileData.xp || 0) + amount;
    const info = getLevelInfo(newXP);
    
    const { error } = await supabase
        .from('profiles')
        .update({ xp: newXP, level: info.level })
        .eq('id', currentUser.id);

    if (!error) {
        profileData.xp = newXP;
        profileData.level = info.level;
        updateXPUI();
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
    document.documentElement.style.setProperty('--aura-color', info.color);
    
    const xpText = document.getElementById('profile-xp-text');
    if (xpText) xpText.innerText = `${profileData.xp} / ${info.nextXp} XP`;
}

function renderXPGuide() {
    const container = document.getElementById('xp-guide-container');
    if (!container) return;
    container.innerHTML = LEVEL_CONFIG.map(l => `
        <div class="flex items-center justify-between p-3 glass-panel rounded-xl border border-white/5">
            <div class="flex items-center gap-3">
                <span class="text-[8px] font-black px-1.5 py-0.5 rounded-sm" style="background-color: ${l.color}; color: black;">LVL ${l.level}</span>
                <span class="text-[9px] font-bold text-white uppercase tracking-widest">${l.name}</span>
            </div>
            <span class="text-[8px] text-slate-500 font-bold">${l.xp} XP</span>
        </div>
    `).join('');
}

async function loadChapters() {
    const container = document.getElementById('chapters-list-mobile');
    container.innerHTML = '<div class="text-center p-10 opacity-30 animate-pulse font-impact tracking-widest uppercase">Summoning Scrolls...</div>';
    
    try {
        const { data: likes } = await supabase.from('chapter_likes').select('chapter_id, user_id');
        const { data: comments } = await supabase.from('chapter_comments').select('chapter_id');

        let html = '';
        for (let i = 1; i <= TOTAL_CHAPTERS; i++) {
            const chapterLikes = likes?.filter(l => l.chapter_id === i) || [];
            const likeCount = chapterLikes.length;
            const commCount = comments?.filter(c => c.chapter_id === i).length || 0;
            const hasLiked = chapterLikes.some(l => l.user_id === currentUser.id);

            html += `
                <div class="glass-panel p-6 rounded-[2rem] flex items-center justify-between border border-white/5 group transition-all duration-300">
                    <div class="flex items-center gap-6 flex-1 cursor-pointer" onclick="openReader(${i})">
                        <span class="font-impact text-3xl aura-text opacity-40 group-hover:opacity-100 transition-opacity">${i}</span>
                        <div class="leading-tight">
                            <h4 class="font-bold text-sm text-white tracking-widest">CHAPTER ${i}</h4>
                            <p class="text-[8px] text-slate-500 font-black uppercase tracking-[0.2em]">Click to descend</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-5">
                        <button onclick="toggleLike(${i})" class="btn-interact flex flex-col items-center gap-1 group/btn">
                            <span class="text-2xl transition-all ${hasLiked ? 'liked-glow text-red-500' : 'text-slate-600'}">♥</span>
                            <span class="text-[8px] font-black text-slate-500">${likeCount}</span>
                        </button>
                        <button onclick="openComments(${i})" class="btn-interact flex flex-col items-center gap-1">
                            <span class="text-2xl text-slate-600 hover:text-white transition-colors">💬</span>
                            <span class="text-[8px] font-black text-slate-500">${commCount}</span>
                        </button>
                    </div>
                </div>`;
        }
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<div class="text-center p-10 opacity-30">Archive failed to manifest.</div>';
    }
}

window.toggleLike = async function(id) {
    const { data } = await supabase.from('chapter_likes').select('*').eq('chapter_id', id).eq('user_id', currentUser.id).single();
    if (data) {
        await supabase.from('chapter_likes').delete().eq('chapter_id', id).eq('user_id', currentUser.id);
    } else {
        await supabase.from('chapter_likes').insert({ chapter_id: id, user_id: currentUser.id });
        window.addXP(5);
    }
    loadChapters();
}

window.openComments = async function(chapterId) {
    currentCommentChapterId = chapterId;
    document.getElementById('comment-title').innerText = `CHAPTER ${chapterId} ECHOES`;
    window.toggleModal('comments-modal');
    loadChapterComments(chapterId);
}

async function loadChapterComments(chapterId) {
    const container = document.getElementById('comments-container');
    container.innerHTML = '<div class="text-center py-10 opacity-30 text-[10px] tracking-widest">READING ECHOES...</div>';

    // The key is linking the user_id in comments to the id in profiles
    const { data, error } = await supabase
        .from('chapter_comments')
        .select('*, profiles!chapter_comments_user_id_fkey(display_name, avatar_url)')
        .eq('chapter_id', chapterId)
        .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
        container.innerHTML = '<div class="text-center py-10 opacity-20 text-[8px] tracking-[0.4em] uppercase">No echoes yet in this void</div>';
        return;
    }

    container.innerHTML = data.map(c => `
        <div class="glass-panel p-4 rounded-2xl border border-white/5">
            <div class="flex items-center gap-2 mb-2">
                <img src="${c.profiles?.avatar_url || ''}" class="w-5 h-5 rounded-full border border-white/10">
                <span class="text-[9px] font-black text-white uppercase">${c.profiles?.display_name || 'Lost Soul'}</span>
            </div>
            <p class="text-[11px] text-slate-300 leading-relaxed">${c.content}</p>
        </div>
    `).join('');
}

document.getElementById('submit-comment-btn')?.addEventListener('click', async () => {
    const input = document.getElementById('comment-input');
    const content = input.value.trim();
    if (!content || !currentCommentChapterId) return;

    const { error } = await supabase.from('chapter_comments').insert({
        chapter_id: currentCommentChapterId,
        user_id: currentUser.id,
        content: content
    });

    if (!error) {
        input.value = '';
        window.addXP(10);
        loadChapterComments(currentCommentChapterId);
        loadChapters();
    }
});

async function loadFriends() {
    const container = document.getElementById('readers-list');
    container.innerHTML = '<div class="text-center p-10 opacity-30 animate-pulse font-impact tracking-widest uppercase">Manifesting Dwellers...</div>';
    
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('xp', { ascending: false });
    
    if (error || !data) {
        container.innerHTML = '<div class="text-center p-10 opacity-30">The void refuses to reveal its dwellers.</div>';
        return;
    }

    container.innerHTML = data.map(r => {
        const isSelf = r.id === currentUser.id;
        const info = getLevelInfo(r.xp);
        return `
        <div class="glass-panel p-5 rounded-[2rem] flex items-center justify-between border border-white/5">
            <div class="flex items-center gap-4">
                <div class="relative">
                    <img src="${r.avatar_url}" class="w-12 h-12 rounded-2xl border border-white/10 object-cover">
                    <div class="absolute -bottom-1 -right-1 aura-bg px-1 rounded text-[6px] font-black">LVL ${r.level}</div>
                </div>
                <div>
                    <h5 class="text-xs font-black text-white uppercase tracking-widest">${r.display_name} ${isSelf ? '<span class="text-[8px] opacity-30 ml-1">(YOU)</span>' : ''}</h5>
                    <p class="text-[8px] text-slate-500 font-black uppercase tracking-widest">${info.name} // ${r.xp} XP</p>
                </div>
            </div>
            ${!isSelf ? `
                <button onclick="startChat('${r.id}', '${r.display_name}')" class="aura-bg px-5 py-2.5 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg active:scale-90 transition-transform">Whisper</button>
            ` : ''}
        </div>
    `}).join('');
}

window.startChat = function(userId, name) {
    activeChatUserId = userId;
    document.getElementById('chat-with-name').innerText = name.toUpperCase();
    window.showView('chat-view');
    loadMessages();
    
    supabase.channel(`chat:${activeChatUserId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        if (payload.new.sender_id === activeChatUserId || payload.new.receiver_id === activeChatUserId) {
            loadMessages();
        }
    }).subscribe();
}

async function loadMessages() {
    const container = document.getElementById('chat-bubbles');
    const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeChatUserId}),and(sender_id.eq.${activeChatUserId},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true });

    if (!data) return;
    container.innerHTML = data.map(m => `
        <div class="flex ${m.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}">
            <div class="max-w-[80%] px-4 py-3 rounded-2xl ${m.sender_id === currentUser.id ? 'aura-bg text-white' : 'bg-white/10 text-slate-200'} text-xs leading-relaxed shadow-lg">
                ${m.content}
            </div>
        </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
}

window.sendMessage = async function() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content) return;
    
    const { error } = await supabase.from('messages').insert({
        sender_id: currentUser.id,
        receiver_id: activeChatUserId,
        content: content
    });
    
    if (!error) {
        input.value = '';
        window.addXP(2);
    }
}

function fillProfileData() {
    if (!profileData) return;
    document.getElementById('profile-full-avatar').src = profileData.avatar_url;
    document.getElementById('profile-full-name').innerText = (profileData.display_name || 'Unnamed soul').toUpperCase();
    document.getElementById('profile-edit-name').value = profileData.display_name || '';
    document.getElementById('profile-edit-bio').value = profileData.bio || '';
    updateXPUI();
}

window.updateProfile = async function() {
    const newName = document.getElementById('profile-edit-name').value.trim();
    const newBio = document.getElementById('profile-edit-bio').value.trim();
    
    if (!newName) return alert('Soul designation required.');

    const { error } = await supabase
        .from('profiles')
        .update({ display_name: newName, bio: newBio })
        .eq('id', currentUser.id);

    if (!error) {
        profileData.display_name = newName;
        profileData.bio = newBio;
        updateNavUI();
        fillProfileData();
        alert('Scroll Updated.');
        window.addXP(5);
    } else {
        alert('Update failed. Try again.');
    }
}

async function checkAuth() {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    currentUser = user;
    if (user) {
        await fetchProfile();
        window.showView('home-view');
        renderXPGuide();
    } else {
        window.showView('login-view');
    }
}

async function fetchProfile() {
    try {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
        if (error || !data) {
            // Create if missing
            const newProfile = {
                id: currentUser.id,
                display_name: currentUser.user_metadata.full_name || 'New Reader',
                avatar_url: currentUser.user_metadata.avatar_url || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${currentUser.id}`,
                xp: 0, level: 1, bio: ''
            };
            await supabase.from('profiles').insert(newProfile);
            profileData = newProfile;
        } else {
            profileData = data;
        }
    } catch (e) {
        console.error("Auth init failure", e);
    }
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
    container.innerHTML = '<div class="text-center p-20 opacity-20 animate-pulse font-horror text-2xl">DESCENDING...</div>';
    
    setTimeout(() => {
        container.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
            const img = document.createElement('img');
            img.src = `https://picsum.photos/seed/falsehope_ch${id}_pg${i}/800/1200`;
            img.className = "w-full mb-1 select-none shadow-2xl";
            img.loading = "lazy";
            container.appendChild(img);
        }
        window.addXP(20);
    }, 500);
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
    if (name === 'MINASHA') {
        iconBox.innerHTML = '❤️';
        textEl.innerText = "The Guardian of the Sanctum. Thank you for your eternal light and support.";
    } else {
        iconBox.innerHTML = '🔥';
        textEl.innerText = "The Flame Bearer. A legendary reader whose passion keeps the void burning bright.";
    }
    window.toggleModal('recognition-modal');
    window.addXP(5);
}
