import { APP_CONFIG } from './config.js';

// Initialize Supabase
const SUPABASE_URL = 'https://qpagyfoedsrbenhsoemx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zaDorGnE20zlG805wQ3SXA_81UbgmLY';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let profileData = null;
let currentView = 'loading-view';
let activeChatId = null;
let homeTab = 'leaderboard';

// UI Utils
const v = (ms = 10) => navigator.vibrate?.(ms);

function initParticles() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    class P {
        constructor() { this.r(); }
        r() { 
            this.x = Math.random() * canvas.width; 
            this.y = Math.random() * canvas.height; 
            this.s = Math.random() * 2; 
            this.v = (Math.random() - 0.5) * 0.1; 
            this.o = Math.random() * 0.4; 
        }
        u() { this.y -= this.v; if (this.y < 0) this.r(); }
        d() { 
            ctx.fillStyle = `rgba(59, 130, 246, ${this.o})`; 
            ctx.beginPath(); ctx.arc(this.x, this.y, this.s, 0, Math.PI * 2); ctx.fill(); 
        }
    }
    for (let i = 0; i < 40; i++) particles.push(new P());
    const anim = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); particles.forEach(p => { p.u(); p.d(); }); requestAnimationFrame(anim); };
    window.addEventListener('resize', resize); resize(); anim();
}

// Navigation Logic
window.showView = (id) => {
    v();
    const target = document.getElementById(id);
    if (!target) return;
    
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    target.classList.remove('hidden');
    currentView = id;
    
    // UI State Management
    const nav = document.getElementById('app-nav');
    const backBtn = document.getElementById('nav-back-btn');
    
    nav.classList.toggle('hidden', ['loading-view', 'login-view'].includes(id));
    backBtn.classList.toggle('hidden', id === 'home-view');
    backBtn.onclick = () => showView('home-view');

    // Data Loading Triggers
    if (id === 'home-view') loadHomeData();
    if (id === 'social-view') loadSocialList();
    if (id === 'chapters-view') loadChapters();
};

window.toggleModal = (id) => {
    v();
    const m = document.getElementById(id);
    m.classList.toggle('hidden');
    if (id === 'profile-modal' && !m.classList.contains('hidden')) {
        document.getElementById('edit-avatar-preview').src = profileData.avatar_url;
        document.getElementById('edit-display-name').value = profileData.display_name;
        document.getElementById('edit-bio').value = profileData.bio || '';
    }
};

// Auth & Profiles
async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        currentUser = user;
        await syncProfile();
        setupRealtime();
        startHeartbeat();
        showView('home-view');
    } else {
        showView('login-view');
    }
}

async function syncProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    if (data) {
        profileData = data;
    } else {
        const newProfile = {
            id: currentUser.id,
            display_name: currentUser.user_metadata.full_name || 'Lost Disciple',
            avatar_url: currentUser.user_metadata.avatar_url || APP_CONFIG.assets.defaultAvatar,
            email: currentUser.email,
            last_seen: new Date()
        };
        await supabase.from('profiles').upsert(newProfile);
        profileData = newProfile;
    }
    updateUI();
}

function updateUI() {
    if (!profileData) return;
    document.getElementById('nav-avatar').src = profileData.avatar_url;
    document.getElementById('nav-username').innerText = profileData.display_name.toUpperCase();
    const isAuthor = profileData.email === APP_CONFIG.authorEmail;
    document.getElementById('nav-status').innerText = isAuthor ? 'AUTHOR' : 'DISCIPLE';
    if (isAuthor) document.getElementById('nav-avatar').classList.add('shadow-[0_0_15px_#ef4444]');
}

function startHeartbeat() {
    // Update last_seen every 30 seconds to show user as "Live"
    setInterval(async () => {
        if (currentUser) {
            await supabase.from('profiles').update({ last_seen: new Date() }).eq('id', currentUser.id);
        }
    }, 30000);
}

// Data Handling
window.setHomeTab = (tab) => {
    homeTab = tab;
    document.querySelectorAll('[id^="tab-"]').forEach(btn => {
        const active = btn.id === `tab-${tab}`;
        btn.classList.toggle('text-white', active);
        btn.classList.toggle('border-blue-500', active);
        btn.classList.toggle('text-slate-500', !active);
    });
    loadHomeData();
};

async function loadHomeData() {
    document.getElementById('hero-img').src = APP_CONFIG.assets.cover;
    const container = document.getElementById('home-content');
    container.innerHTML = `<div class="py-20 text-center opacity-30 text-[10px] uppercase tracking-[0.4em]">Summoning Data...</div>`;

    if (homeTab === 'leaderboard') {
        const { data } = await supabase.from('profiles').select('*').order('rating', { ascending: false }).limit(20);
        container.innerHTML = (data || []).map((u, i) => `
            <div class="glass p-5 rounded-3xl flex items-center gap-5 group hover:bg-white/10 transition-all">
                <span class="text-xs font-black opacity-10 w-6">${i+1}</span>
                <img src="${u.avatar_url}" class="w-12 h-12 rounded-full object-cover">
                <div class="flex-1">
                    <p class="text-[11px] font-black uppercase text-white tracking-widest">${u.display_name}</p>
                    <p class="text-[8px] text-blue-400 font-bold uppercase">${u.rating || 0} Void Points</p>
                </div>
            </div>`).join('');
    } else {
        container.innerHTML = `<div class="p-10 glass rounded-3xl text-center"><p class="text-[10px] uppercase font-black opacity-20 tracking-widest">No News from the Abyss</p></div>`;
    }
}

async function loadSocialList() {
    const list = document.getElementById('social-list');
    list.innerHTML = `<div class="p-20 text-center opacity-20 text-[10px] uppercase tracking-widest">Gazing into the void...</div>`;
    
    const { data } = await supabase.from('profiles').select('*').order('last_seen', { ascending: false });
    
    list.innerHTML = (data || []).map(u => {
        const isSelf = u.id === currentUser.id;
        const isOnline = (new Date() - new Date(u.last_seen)) < 120000; // 2 minutes window
        return `
            <div class="glass p-5 rounded-3xl flex items-center justify-between group">
                <div class="flex items-center gap-4">
                    <div class="${isOnline ? 'online-ring' : ''}">
                        <img src="${u.avatar_url}" class="w-14 h-14 rounded-full object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all">
                    </div>
                    <div>
                        <p class="text-xs font-black text-white uppercase tracking-wider">${u.display_name}</p>
                        <p class="text-[9px] text-slate-500 line-clamp-1 italic">${u.bio || 'Silence is their answer...'}</p>
                    </div>
                </div>
                ${!isSelf ? `<button onclick="startChat('${u.id}', '${u.display_name}', '${u.avatar_url}')" class="bg-white/5 hover:bg-blue-600 px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">Message</button>` : '<span class="text-[8px] opacity-20 font-black uppercase">You</span>'}
            </div>
        `;
    }).join('');
}

async function loadChapters() {
    const list = document.getElementById('chapters-list');
    list.innerHTML = '<div class="p-20 text-center opacity-20 text-xs uppercase tracking-widest">Opening Archives...</div>';
    
    // Simulating chapters
    const chapters = Array.from({length: 12}, (_, i) => ({ id: i + 1, title: `Scroll of Hope #${i+1}` }));
    
    list.innerHTML = chapters.map(c => `
        <div class="glass p-6 rounded-[2rem] flex flex-col gap-5 border border-white/5 hover:border-blue-500/30 transition-all">
            <div onclick="openChapter(${c.id})" class="flex items-center justify-between cursor-pointer group">
                <div class="flex items-center gap-5">
                    <span class="fantasy-font text-3xl font-black text-blue-500/40 group-hover:text-blue-500 transition-all">${String(c.id).padStart(2, '0')}</span>
                    <div class="flex flex-col">
                        <span class="text-[11px] font-black text-white uppercase tracking-[0.2em]">${c.title}</span>
                        <span class="text-[8px] text-slate-500 uppercase font-bold">Volume 1: The Descent</span>
                    </div>
                </div>
                <div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-blue-600 transition-all">
                    <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="3" d="M9 5l7 7-7 7"/></svg>
                </div>
            </div>
            <div class="flex gap-2 border-t border-white/5 pt-4">
                <button onclick="likeChapter(${c.id})" class="bg-white/5 px-4 py-2 rounded-full text-[8px] font-black uppercase tracking-widest hover:bg-red-500/20 hover:text-red-500 transition-all">Like</button>
                <button onclick="toggleComments(${c.id})" class="bg-white/5 px-4 py-2 rounded-full text-[8px] font-black uppercase tracking-widest hover:bg-blue-500/20 hover:text-blue-500 transition-all">Discuss</button>
            </div>
        </div>`).join('');
}

window.openChapter = (id) => {
    showView('reader-view');
    const container = document.getElementById('reader-pages');
    const progress = document.getElementById('reader-progress');
    container.innerHTML = '';
    
    // Simulate vertical images
    for (let i = 1; i <= 8; i++) {
        const img = document.createElement('img');
        img.src = `https://picsum.photos/seed/falsehope_${id}_${i}/1200/1800`;
        img.className = "w-full object-contain";
        img.loading = "lazy";
        container.appendChild(img);
    }
    
    document.getElementById('reader-view').onscroll = (e) => {
        const t = e.target;
        const p = (t.scrollTop / (t.scrollHeight - t.clientHeight)) * 100;
        progress.style.width = p + '%';
    };
};

// Chat & Social Systems
window.startChat = (id, name, avatar) => {
    activeChatId = id;
    document.getElementById('chat-target-name').innerText = name.toUpperCase();
    document.getElementById('chat-target-avatar').src = avatar;
    toggleModal('chat-modal');
    loadMessages();
};

async function loadMessages() {
    if (!activeChatId) return;
    const { data } = await supabase.from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeChatId}),and(sender_id.eq.${activeChatId},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true });
    
    const list = document.getElementById('chat-messages');
    list.innerHTML = (data || []).map(m => {
        const isMine = m.sender_id === currentUser.id;
        return `
            <div class="flex ${isMine ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-1">
                <div class="max-w-[80%] px-5 py-3 rounded-2xl text-[11px] leading-relaxed ${isMine ? 'bg-blue-600 text-white rounded-br-none shadow-lg' : 'bg-white/5 text-slate-300 rounded-bl-none border border-white/5'}">
                    ${m.content}
                </div>
            </div>
        `;
    }).join('');
    list.scrollTop = list.scrollHeight;
}

window.sendChatMessage = async () => {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content) return;
    v(20);
    const { error } = await supabase.from('messages').insert({
        sender_id: currentUser.id,
        receiver_id: activeChatId,
        content
    });
    if (!error) {
        input.value = '';
        loadMessages();
    }
};

window.setNewAvatar = () => {
    const url = prompt("Enter Image URL for Avatar:");
    if (url && url.startsWith('http')) {
        document.getElementById('edit-avatar-preview').src = url;
    }
};

window.saveProfile = async () => {
    const name = document.getElementById('edit-display-name').value.trim();
    const bio = document.getElementById('edit-bio').value.trim();
    const avatar_url = document.getElementById('edit-avatar-preview').src;
    
    if (!name) return;
    v(50);
    const { error } = await supabase.from('profiles').update({
        display_name: name,
        bio,
        avatar_url,
        last_seen: new Date()
    }).eq('id', currentUser.id);
    
    if (!error) {
        await syncProfile();
        toggleModal('profile-modal');
    }
};

// Real-time Engine
function setupRealtime() {
    supabase.channel('global-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
            if (activeChatId) loadMessages();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
            if (currentView === 'social-view') loadSocialList();
            if (currentView === 'home-view' && homeTab === 'leaderboard') loadHomeData();
        })
        .subscribe();
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    checkAuth();
    document.getElementById('google-login-btn').addEventListener('click', () => {
        supabase.auth.signInWithOAuth({ 
            provider: 'google', 
            options: { redirectTo: APP_CONFIG.redirectUrl } 
        });
    });
});
