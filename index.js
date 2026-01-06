
const SUPABASE_URL = 'https://qpagyfoedsrbenhsoemx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zaDorGnE20zlG805wQ3SXA_81UbgmLY';

const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

let currentUser = null;
let profileData = null;
let navigationHistory = ['home-view'];
let activeChatUserId = null;

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
    if (viewId === 'readers-view') loadReaders();
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
    const next = LEVEL_CONFIG.find(c => c.level === current.level + 1) || current;
    const progress = current.level === 10 ? 100 : ((xp - current.xp) / (next.xp - current.xp)) * 100;
    return { ...current, progress };
}

function updateXPUI() {
    const info = getLevelInfo(profileData.xp);
    document.querySelectorAll('.xp-bar-fill').forEach(bar => {
        bar.style.width = `${info.progress}%`;
        bar.style.backgroundColor = info.color;
    });
    document.querySelectorAll('.level-label').forEach(el => el.innerText = `LVL ${info.level}`);
    document.querySelectorAll('.rank-label').forEach(el => el.innerText = info.name.toUpperCase());
    document.documentElement.style.setProperty('--aura-color', info.color);
}

// Chapters Engagement
async function loadChapters() {
    const container = document.getElementById('chapters-list-mobile');
    container.innerHTML = '<div class="text-center p-10 opacity-30">Summoning scrolls...</div>';
    
    const { data: likes } = await supabase.from('chapter_likes').select('chapter_id');
    const { data: comments } = await supabase.from('chapter_comments').select('chapter_id');

    let html = '';
    for (let i = 1; i <= TOTAL_CHAPTERS; i++) {
        const likeCount = likes?.filter(l => l.chapter_id === i).length || 0;
        const commCount = comments?.filter(c => c.chapter_id === i).length || 0;
        const hasLiked = likes?.some(l => l.chapter_id === i && l.user_id === currentUser.id);

        html += `
            <div class="glass-panel p-6 rounded-[2rem] flex items-center justify-between border border-white/5 group">
                <div class="flex items-center gap-4 flex-1" onclick="openReader(${i})">
                    <span class="font-impact text-2xl aura-text opacity-40">${i}</span>
                    <div class="leading-tight">
                        <h4 class="font-bold text-sm text-white">CHAPTER ${i}</h4>
                        <p class="text-[8px] text-slate-500 font-black uppercase">Click to descend</p>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <button onclick="toggleLike(${i})" class="flex flex-col items-center gap-1 group/btn">
                        <span class="text-lg ${hasLiked ? 'text-red-500' : 'text-slate-600'}">♥</span>
                        <span class="text-[7px] font-bold text-slate-500">${likeCount}</span>
                    </button>
                    <button onclick="openComments(${i})" class="flex flex-col items-center gap-1">
                        <span class="text-lg text-slate-600">💬</span>
                        <span class="text-[7px] font-bold text-slate-500">${commCount}</span>
                    </button>
                </div>
            </div>`;
    }
    container.innerHTML = html;
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

// Social & Messaging
async function loadReaders() {
    const container = document.getElementById('readers-list');
    const { data } = await supabase.from('profiles').select('*').neq('id', currentUser.id).order('xp', { ascending: false });
    
    if (!data) return;
    container.innerHTML = data.map(r => `
        <div class="glass-panel p-4 rounded-2xl flex items-center justify-between border border-white/5">
            <div class="flex items-center gap-3">
                <img src="${r.avatar_url}" class="w-10 h-10 rounded-full border border-white/10">
                <div>
                    <h5 class="text-xs font-bold text-white uppercase">${r.display_name}</h5>
                    <p class="text-[8px] text-slate-500 font-black">LVL ${r.level} // ${getLevelInfo(r.xp).name}</p>
                </div>
            </div>
            <button onclick="startChat('${r.id}', '${r.display_name}')" class="px-4 py-2 bg-white/5 rounded-full text-[8px] font-black uppercase">Whisper</button>
        </div>
    `).join('');
}

window.startChat = function(userId, name) {
    activeChatUserId = userId;
    document.getElementById('chat-with-name').innerText = name.toUpperCase();
    window.showView('chat-view');
    loadMessages();
    
    // Subscribe to new messages
    supabase.channel('public:messages')
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
            <div class="max-w-[80%] px-4 py-3 rounded-2xl ${m.sender_id === currentUser.id ? 'aura-bg text-white' : 'bg-white/5 text-slate-300'} text-xs">
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

// Auth & Setup
async function checkAuth() {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    currentUser = user;
    if (user) {
        await fetchProfile();
        window.showView('home-view');
    } else {
        window.showView('login-view');
    }
}

async function fetchProfile() {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    if (error && error.code === 'PGRST116') {
        const newProfile = {
            id: currentUser.id,
            display_name: currentUser.user_metadata.full_name || 'New Reader',
            avatar_url: currentUser.user_metadata.avatar_url || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${currentUser.id}`,
            xp: 0, level: 1
        };
        await supabase.from('profiles').insert(newProfile);
        profileData = newProfile;
    } else {
        profileData = data;
    }
    updateNavUI();
    updateXPUI();
}

function updateNavUI() {
    document.getElementById('nav-user-name').innerText = profileData.display_name.toUpperCase();
    document.getElementById('nav-user-avatar').src = profileData.avatar_url;
}

window.openReader = function(id) {
    window.showView('reader-view');
    const container = document.getElementById('reader-pages');
    container.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
        const img = document.createElement('img');
        img.src = `https://picsum.photos/seed/h${id}p${i}/800/1200`;
        img.className = "w-full mb-1";
        container.appendChild(img);
    }
    window.addXP(20);
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    document.getElementById('google-login-btn')?.addEventListener('click', () => {
        supabase.auth.signInWithOAuth({ provider: 'google' });
    });
});
