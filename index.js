
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
let hasNewMessages = false;

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

// Particle System
function initParticles() {
    const canvas = document.getElementById('particle-canvas');
    const ctx = canvas.getContext('2d');
    let particles = [];
    
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    
    class Particle {
        constructor() {
            this.reset();
        }
        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 1.5;
            this.speedX = (Math.random() - 0.5) * 0.2;
            this.speedY = (Math.random() - 0.5) * 0.2;
            this.opacity = Math.random() * 0.3;
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
                this.reset();
            }
        }
        draw() {
            ctx.fillStyle = `rgba(168, 85, 247, ${this.opacity})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    for (let i = 0; i < 40; i++) particles.push(new Particle());
    
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        requestAnimationFrame(animate);
    }
    
    window.addEventListener('resize', resize);
    resize();
    animate();
}

// Supabase Realtime
if (supabase) {
    supabase.channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            const msg = payload.new;
            if (msg.receiver_id === currentUser.id) {
                if (activeChatUserId === msg.sender_id) {
                    loadMessagesInline(activeChatUserId);
                } else {
                    hasNewMessages = true;
                    document.getElementById('new-msg-dot').classList.remove('hidden');
                }
            }
        })
        .subscribe();
}

// Navigation
window.showView = function(viewId, pushHistory = true) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const target = document.getElementById(viewId);
    if (target) target.classList.remove('hidden');

    if (viewId === 'readers-view') {
        hasNewMessages = false;
        document.getElementById('new-msg-dot').classList.add('hidden');
    }

    const nav = document.getElementById('app-nav');
    const backBtn = document.getElementById('master-back-btn');
    
    if (['home-view', 'login-view', 'loading-view'].includes(viewId)) {
        backBtn.classList.add('hidden');
    } else {
        backBtn.classList.remove('hidden');
    }

    if (!['loading-view', 'login-view'].includes(viewId)) nav.classList.remove('hidden');
    else nav.classList.add('hidden');

    if (pushHistory && navigationHistory[navigationHistory.length - 1] !== viewId) {
        navigationHistory.push(viewId);
    }

    if (viewId === 'chapters-view') loadChapters();
    if (viewId === 'readers-view') loadFriends();
}

window.goBack = function() {
    if (navigationHistory.length > 1) {
        navigationHistory.pop();
        window.showView(navigationHistory[navigationHistory.length - 1], false);
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

// XP System Fix
window.addXP = async function(amount, userId = null) {
    const targetId = userId || currentUser.id;
    const isSelf = targetId === currentUser.id;

    if (!isSelf && currentUser.email !== AUTHOR_EMAIL) return;

    const { data: targetProfile } = await supabase.from('profiles').select('*').eq('id', targetId).single();
    if (!targetProfile) return;

    if (targetProfile.email === AUTHOR_EMAIL && amount > 0) return;

    let newXP = Math.max(0, Math.min(100, (targetProfile.xp || 0) + amount));
    const info = getLevelInfo(newXP);
    
    const { error } = await supabase.from('profiles').update({ xp: newXP, level: info.level }).eq('id', targetId);

    if (!error) {
        if (isSelf) {
            profileData.xp = newXP; profileData.level = info.level;
            updateXPUI(); renderXPGuide();
        }
        if (userId) loadAdminUsers();
    }
}

function getLevelInfo(xp) {
    let current = LEVEL_CONFIG[0];
    for (const conf of LEVEL_CONFIG) {
        if (xp >= conf.xp) current = conf; else break;
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
    });
    document.querySelectorAll('.level-label').forEach(el => el.innerText = info.label);
    document.getElementById('nav-user-lvl').innerText = info.label;
    document.getElementById('settings-user-lvl-text').innerText = info.label;
    document.getElementById('profile-xp-text').innerText = `${profileData.xp} / ${info.nextXp} XP`;
}

function renderXPGuide() {
    const container = document.getElementById('xp-guide-container');
    if (!container) return;
    container.innerHTML = LEVEL_CONFIG.map(l => {
        const isCurrent = (profileData?.level || 1) === l.level;
        return `
        <div class="flex-shrink-0 text-center w-10 opacity-${isCurrent ? '100' : '20'}">
            <div class="w-1 h-1 rounded-full mx-auto mb-1 ${isCurrent ? 'bg-purple-500 shadow-[0_0_5px_rgba(168,85,247,1)]' : 'bg-white/10'}"></div>
            <p class="text-[5px] font-black text-white uppercase truncate tracking-tighter">${l.name}</p>
        </div>
    `}).join('');
}

// Chapters
async function loadChapters() {
    const container = document.getElementById('chapters-list-mobile');
    container.innerHTML = '<div class="text-center p-10 opacity-20 uppercase text-[9px] tracking-widest">Loading Records...</div>';
    
    const { data: likes } = await supabase.from('chapter_likes').select('chapter_id, user_id');
    const { data: comments } = await supabase.from('chapter_comments').select('chapter_id');

    let html = '';
    for (let i = 1; i <= 30; i++) {
        const chLikes = likes?.filter(l => l.chapter_id === i) || [];
        const chCommCount = comments?.filter(c => c.chapter_id === i).length || 0;
        const hasLiked = chLikes.some(l => l.user_id === currentUser.id);

        html += `
            <div id="chapter-card-${i}" class="glass-panel rounded-xl border border-white/5 overflow-hidden">
                <div class="p-3.5 flex items-center justify-between cursor-pointer" onclick="openReader(${i})">
                    <div class="flex items-center gap-3">
                        <span class="bold-italic text-xl text-purple-400 opacity-30">${i}</span>
                        <div>
                            <h4 class="font-bold text-[11px] text-white uppercase">CHAPTER ${i}</h4>
                        </div>
                    </div>
                    <div class="flex items-center gap-2" onclick="event.stopPropagation()">
                        <button onclick="toggleLike(${i})" class="flex items-center gap-1.5 p-2 bg-white/5 rounded-lg text-[8px] font-black">
                            <span class="${hasLiked ? 'text-purple-500' : 'text-slate-600'}">♥</span> ${chLikes.length}
                        </button>
                        <button onclick="toggleExpandChapter(${i})" class="flex items-center gap-1.5 p-2 bg-white/5 rounded-lg text-[8px] font-black">
                            <span class="text-slate-600">💬</span> ${chCommCount}
                        </button>
                    </div>
                </div>
                <div class="expandable-content border-t border-white/5 bg-black/40">
                    <div class="p-4 space-y-4">
                        <div id="chapter-comments-${i}" class="space-y-2 max-h-[180px] overflow-y-auto scroll-container"></div>
                        <div class="flex gap-2">
                            <input id="comment-input-${i}" type="text" placeholder="Add feedback..." class="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] text-white outline-none">
                            <button onclick="postComment(${i})" class="bg-purple-600 px-3 rounded-lg text-[8px] font-black uppercase">Send</button>
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
    container.innerHTML = '<div class="text-[7px] opacity-20 text-center py-2 uppercase">Tracing signals...</div>';
    const { data } = await supabase.from('chapter_comments').select('*, profiles(display_name, avatar_url)').eq('chapter_id', id).order('created_at', { ascending: false });
    if (!data || data.length === 0) {
        container.innerHTML = '<div class="text-[7px] opacity-10 text-center py-2 uppercase">No signals</div>';
        return;
    }
    container.innerHTML = data.map(c => `
        <div class="flex gap-2 p-2 bg-white/5 rounded-lg">
            <img src="${c.profiles?.avatar_url}" class="w-4 h-4 rounded-full object-cover">
            <div class="flex-1 min-w-0">
                <span class="text-[7px] font-black text-purple-400 uppercase truncate block">${c.profiles?.display_name}</span>
                <p class="text-[9px] text-slate-400 leading-tight font-medium">${c.content}</p>
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
        input.value = ''; window.addXP(1); loadChapterComments(id);
    }
}

// Readers & Messaging Redesigned (Hide chat initially)
async function loadFriends() {
    const container = document.getElementById('readers-list');
    container.innerHTML = '<div class="text-center p-10 opacity-20 uppercase text-[9px] tracking-widest">Scanning souls...</div>';
    const { data } = await supabase.from('profiles').select('*').order('xp', { ascending: false });
    if (!data) return;
    container.innerHTML = data.map(r => {
        const isSelf = r.id === currentUser.id;
        const info = getLevelInfo(r.xp);
        const isAuthor = r.email === AUTHOR_EMAIL;
        return `
        <div id="user-card-${r.id}" class="glass-panel rounded-xl border border-white/5 overflow-hidden">
            <div class="p-3 flex items-center justify-between">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="relative flex-shrink-0">
                        <img src="${r.avatar_url}" class="w-9 h-9 rounded-full object-cover">
                        <div class="absolute -bottom-1 -right-1 bg-purple-600 px-1 rounded text-[5px] font-black uppercase tracking-tighter">${isAuthor ? 'MAX' : 'L'+r.level}</div>
                    </div>
                    <div class="min-w-0">
                        <h5 class="text-[10px] font-black text-white uppercase truncate flex items-center gap-1.5">
                            ${r.display_name} ${isAuthor ? '<span class="text-[5px] bg-yellow-500/10 text-yellow-500 px-1 rounded tracking-tighter">AUTHOR</span>' : ''}
                        </h5>
                        <p class="text-[7px] text-slate-500 font-bold uppercase truncate tracking-tighter">${isAuthor ? 'Main Team' : info.name}</p>
                    </div>
                </div>
                ${!isSelf ? `<button onclick="toggleExpandChat('${r.id}', '${r.display_name}')" class="bg-purple-600/10 border border-purple-500/20 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase text-purple-400">Message</button>` : ''}
            </div>
            <div class="expandable-content border-t border-white/5 bg-black/60">
                <div class="flex flex-col h-[300px]">
                    <div id="chat-bubbles-${r.id}" class="flex-1 overflow-y-auto space-y-3 p-4 scroll-container"></div>
                    <div class="p-3 border-t border-white/5 flex gap-2">
                        <input id="chat-input-${r.id}" type="text" placeholder="Type a message..." class="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] text-white outline-none">
                        <button onclick="sendMessageInline('${r.id}')" class="bg-purple-600 px-3 rounded-lg text-[9px] font-black uppercase">Send</button>
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
            <div class="max-w-[85%] px-3 py-1.5 rounded-xl ${m.sender_id === currentUser.id ? 'bg-purple-600 text-white' : 'bg-white/10 text-slate-300'} text-[10px] font-medium leading-snug">
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
        input.value = ''; loadMessagesInline(userId);
    }
}

// Rating
window.setRating = function(rating) {
    currentRating = rating;
    document.querySelectorAll('.star').forEach((star, i) => star.classList.toggle('active', i < rating));
}

window.submitRating = async function() {
    if (currentRating === 0) return alert("Select a star.");
    const { error } = await supabase.from('ratings').upsert({ user_id: currentUser.id, rating: currentRating });
    if (!error) {
        alert("Echo received!");
        window.toggleModal('rating-modal'); window.addXP(1);
    }
}

window.shareStory = function() {
    const url = "https://lahirusehan.github.io/A-False-Hope/";
    if (navigator.share) navigator.share({ title: 'A False Hope', text: 'Official Story Reader', url }).catch(console.error);
    else { navigator.clipboard.writeText(url); alert("Link copied!"); }
}

// Profile
async function fetchProfile() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return; currentUser = user;
        const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        const isAuthor = user.email === AUTHOR_EMAIL;

        if (error || !data) {
            const newProf = {
                id: user.id, email: user.email,
                display_name: user.user_metadata.full_name || 'Vessel',
                avatar_url: user.user_metadata.avatar_url || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.id}`,
                xp: isAuthor ? 100 : 0, level: isAuthor ? 10 : 1,
                bio: isAuthor ? 'Story Author' : 'Story Reader'
            };
            await supabase.from('profiles').insert(newProf); profileData = newProf;
        } else {
            profileData = data;
            if (isAuthor && profileData.xp < 100) {
                profileData.xp = 100; profileData.level = 10;
                await supabase.from('profiles').update({ xp: 100, level: 10 }).eq('id', user.id);
            }
        }
        if (isAuthor) document.getElementById('admin-btn').classList.remove('hidden');
    } catch (e) { console.error(e); }
    updateNavUI(); updateXPUI(); renderXPGuide();
}

function updateNavUI() {
    if (!profileData) return;
    document.getElementById('nav-user-name').innerText = (profileData.display_name || 'USER').toUpperCase();
    document.getElementById('nav-user-avatar').src = profileData.avatar_url;
    document.getElementById('settings-avatar').src = profileData.avatar_url;
    document.getElementById('settings-user-name').innerText = profileData.display_name;
}

function fillProfileData() {
    if (!profileData) return;
    document.getElementById('profile-edit-name').value = profileData.display_name || '';
    document.getElementById('profile-edit-bio').value = profileData.bio || '';
}

window.updateProfile = async function() {
    const newName = document.getElementById('profile-edit-name').value.trim();
    const newBio = document.getElementById('profile-edit-bio').value.trim();
    if (!newName) return;
    const { error } = await supabase.from('profiles').update({ display_name: newName, bio: newBio }).eq('id', currentUser.id);
    if (!error) {
        profileData.display_name = newName; profileData.bio = newBio;
        updateNavUI(); alert('Echo updated!');
    }
}

// Reader
window.openReader = function(id) {
    window.showView('reader-view');
    const container = document.getElementById('reader-pages');
    container.innerHTML = '<div class="text-center p-20 opacity-20 uppercase text-[9px] tracking-widest">Opening scroll...</div>';
    setTimeout(() => {
        container.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
            const img = document.createElement('img');
            img.src = `https://picsum.photos/seed/fh_c${id}_p${i}/800/1200`;
            img.className = "w-full mb-0.5 shadow-xl";
            container.appendChild(img);
        }
        window.addXP(2); 
    }, 400);
}

window.toggleLike = async function(id) {
    const { data } = await supabase.from('chapter_likes').select('*').eq('chapter_id', id).eq('user_id', currentUser.id).single();
    if (data) await supabase.from('chapter_likes').delete().eq('chapter_id', id).eq('user_id', currentUser.id);
    else {
        await supabase.from('chapter_likes').insert({ chapter_id: id, user_id: currentUser.id });
        window.addXP(1);
    }
    loadChapters();
}

async function loadAdminUsers() {
    const container = document.getElementById('admin-user-list');
    container.innerHTML = '<p class="text-center opacity-30 text-[8px] uppercase">Tracing records...</p>';
    const { data } = await supabase.from('profiles').select('*').order('xp', { ascending: false });
    if (!data) return;
    container.innerHTML = data.map(u => `
        <div class="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
            <div class="min-w-0">
                <span class="text-[10px] font-black text-white truncate block uppercase">${u.display_name}</span>
                <span class="text-[7px] font-bold text-slate-500 uppercase tracking-widest">XP: ${u.xp} / L${u.level}</span>
            </div>
            <div class="flex gap-1 flex-shrink-0">
                <button onclick="window.addXP(10, '${u.id}')" class="px-2 py-1 bg-purple-900/40 text-purple-300 rounded text-[7px] font-black">+10</button>
                <button onclick="window.addXP(-10, '${u.id}')" class="px-2 py-1 bg-red-900/40 text-red-300 rounded text-[7px] font-black">-10</button>
            </div>
        </div>
    `).join('');
}

async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        currentUser = user; await fetchProfile();
        window.showView('home-view');
    } else {
        window.showView('login-view');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initParticles();
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
        iconBox.innerHTML = '❤️'; textEl.innerText = "The Supporter. Thank you for your energy."; 
    } else { 
        iconBox.innerHTML = '🔥'; textEl.innerText = "The Flame. Your passion keeps the team going."; 
    }
    window.toggleModal('recognition-modal'); window.addXP(1);
}
