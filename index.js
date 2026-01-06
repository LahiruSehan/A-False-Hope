
import { GoogleGenAI } from "@google/genai";

// Embedded API Key as requested
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
let currentChapterId = 1;
let currentXP = parseInt(localStorage.getItem('user-xp') || '0');
const TOTAL_CHAPTERS = 30;

// Level Config (10 Levels)
const LEVEL_CONFIG = [
    { level: 1, xp: 0, color: '#a855f7', name: 'Newbie' },
    { level: 2, xp: 100, color: '#6366f1', name: 'Novice' },
    { level: 3, xp: 250, color: '#3b82f6', name: 'Reader' },
    { level: 4, xp: 500, color: '#06b6d4', name: 'Enthusiast' },
    { level: 5, xp: 800, color: '#10b981', name: 'Bookworm' },
    { level: 6, xp: 1200, color: '#f59e0b', name: 'Scholar' },
    { level: 7, xp: 1700, color: '#f97316', name: 'Elite' },
    { level: 8, xp: 2300, color: '#ec4899', name: 'Master' },
    { level: 9, xp: 3000, color: '#ef4444', name: 'Legend' },
    { level: 10, xp: 4000, color: '#ffffff', name: 'GOD' },
];

function getCurrentLevelInfo() {
    let current = LEVEL_CONFIG[0];
    for (const conf of LEVEL_CONFIG) {
        if (currentXP >= conf.xp) current = conf;
        else break;
    }
    const next = LEVEL_CONFIG.find(c => c.level === current.level + 1) || current;
    const progress = current.level === 10 ? 100 : ((currentXP - current.xp) / (next.xp - current.xp)) * 100;
    return { ...current, progress, nextXp: next.xp };
}

window.addXP = function(amount) {
    currentXP += amount;
    localStorage.setItem('user-xp', currentXP);
    updateXPUI();
}

function updateXPUI() {
    const info = getCurrentLevelInfo();
    const bars = document.querySelectorAll('.xp-bar-fill');
    bars.forEach(bar => {
        bar.style.width = `${info.progress}%`;
        bar.style.backgroundColor = info.color;
    });
    
    const levelLabels = document.querySelectorAll('.level-label');
    levelLabels.forEach(el => el.innerText = `LVL ${info.level}`);
    
    const rankLabels = document.querySelectorAll('.rank-label');
    rankLabels.forEach(el => el.innerText = info.name.toUpperCase());

    // Update Theme based on level
    document.documentElement.style.setProperty('--aura-color', info.color);
    document.documentElement.style.setProperty('--aura-glow', `${info.color}66`);
}

// Utility: Show View
window.showView = function(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('flex-view-active');
    }

    const nav = document.getElementById('app-nav');
    if (viewId !== 'loading-view' && viewId !== 'login-view' && viewId !== 'reader-view') {
        nav.classList.remove('hidden');
    } else {
        nav.classList.add('hidden');
    }

    if (viewId === 'chapters-view') loadChapters();
    if (viewId === 'profile-view') fillProfileForm();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.toggleModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.toggle('hidden');
}

// 1. AUTH & PROFILE
async function checkAuth() {
    if (!supabase) return;
    try {
        const { data: { user } } = await supabase.auth.getUser();
        currentUser = user;
        if (user) {
            await fetchProfile();
            window.showView('home-view');
            startReadingTimer();
        } else {
            window.showView('login-view');
        }
    } catch (e) {
        window.showView('login-view');
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN') {
            currentUser = session?.user;
            await fetchProfile();
            window.showView('home-view');
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            window.showView('login-view');
        }
    });
}

async function fetchProfile() {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    if (error && error.code === 'PGRST116') {
        const newProfile = {
            id: currentUser.id,
            display_name: currentUser.user_metadata.full_name || 'New Reader',
            avatar_url: currentUser.user_metadata.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.id}`
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
    if (!profileData) return;
    document.getElementById('nav-user-name').innerText = profileData.display_name.toUpperCase();
    document.getElementById('profile-display-name').innerText = profileData.display_name.toUpperCase();
    document.getElementById('nav-user-avatar').src = profileData.avatar_url;
    document.getElementById('profile-avatar').src = profileData.avatar_url;
}

function fillProfileForm() {
    if (!profileData) return;
    document.getElementById('edit-name').value = profileData.display_name;
    document.getElementById('edit-birth').value = profileData.birth_date || '';
    document.getElementById('edit-bio').value = profileData.bio || '';
}

// 2. AI GENERATION
async function generateAIAvatar() {
    const prompt = document.getElementById('ai-prompt').value.trim();
    if (!prompt) return alert('Enter a description!');

    const loader = document.getElementById('ai-loading-overlay');
    const preview = document.getElementById('generated-avatar-preview');
    const applyBtn = document.getElementById('apply-ai-avatar-btn');

    loader.classList.remove('hidden');
    try {
        const aiInstance = new GoogleGenAI({ apiKey: INTERNAL_API_KEY });
        const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: `Modern anime style profile picture: ${prompt}. High quality, vibrant.` }] },
            config: { imageConfig: { aspectRatio: "1:1" } }
        });

        const base64 = response.candidates[0].content.parts.find(p => p.inlineData)?.inlineData.data;
        if (base64) {
            preview.src = `data:image/png;base64,${base64}`;
            preview.classList.remove('hidden');
            applyBtn.classList.remove('hidden');
            document.getElementById('ai-placeholder-text').classList.add('hidden');
        }
    } catch (err) {
        alert('Generation failed. Please check your network.');
    } finally {
        loader.classList.add('hidden');
    }
}

// 3. READER LOGIC
window.openReader = function(id) {
    currentChapterId = id;
    window.showView('reader-view');
    const container = document.getElementById('reader-pages');
    const title = document.getElementById('reader-title');
    title.innerText = `CHAPTER ${id}`;
    
    container.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
        const img = document.createElement('img');
        img.src = `https://picsum.photos/seed/ch${id}pg${i}/800/1200`;
        img.className = "w-full h-auto mb-1";
        img.loading = "lazy";
        container.appendChild(img);
    }
    window.addXP(20); // XP for opening chapter
}

// 4. SETTINGS
window.updateAura = function(color) {
    document.documentElement.style.setProperty('--aura-color', color);
    localStorage.setItem('aura-color', color);
}

// 5. READING TIMER
let readTimeSeconds = parseInt(localStorage.getItem('read-time') || '0');
function startReadingTimer() {
    setInterval(() => {
        readTimeSeconds++;
        localStorage.setItem('read-time', readTimeSeconds);
        const mins = Math.floor(readTimeSeconds / 60);
        document.querySelectorAll('.read-time-label').forEach(el => el.innerText = `${mins}m read`);
        if (readTimeSeconds % 60 === 0) window.addXP(5); // 5 XP every minute
    }, 1000);
}

// 6. BOOTSTRAP
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

    document.getElementById('google-login-btn')?.addEventListener('click', () => {
        supabase.auth.signInWithOAuth({ provider: 'google' });
    });
    
    document.getElementById('generate-ai-btn')?.addEventListener('click', generateAIAvatar);
    document.getElementById('apply-ai-avatar-btn')?.addEventListener('click', async () => {
        const url = document.getElementById('generated-avatar-preview').src;
        await supabase.from('profiles').update({ avatar_url: url }).eq('id', currentUser.id);
        profileData.avatar_url = url;
        updateNavUI();
        toggleModal('gemini-modal');
        window.addXP(50);
    });

    document.getElementById('save-profile-btn')?.addEventListener('click', async () => {
        const updates = {
            display_name: document.getElementById('edit-name').value,
            birth_date: document.getElementById('edit-birth').value,
            bio: document.getElementById('edit-bio').value
        };
        await supabase.from('profiles').update(updates).eq('id', currentUser.id);
        profileData = {...profileData, ...updates};
        updateNavUI();
        alert('Profile Updated!');
        window.addXP(10);
    });

    window.addEventListener('scroll', () => {
        const reader = document.getElementById('reader-view');
        if (!reader.classList.contains('hidden')) {
            const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
            const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const scrolled = (winScroll / height) * 100;
            const bar = document.getElementById('reader-progress-bar');
            if (bar) bar.style.width = scrolled + "%";
        }
    });
});

function loadChapters() {
    const container = document.getElementById('chapters-list-mobile');
    let html = '';
    for (let i = 1; i <= TOTAL_CHAPTERS; i++) {
        html += `
            <div class="glass-panel p-5 rounded-3xl flex items-center justify-between active:scale-95 transition-all border border-white/5" onclick="openReader(${i})">
                <div class="flex items-center gap-5">
                    <span class="font-bold text-xl opacity-30">${String(i).padStart(2, '0')}</span>
                    <div>
                        <h4 class="font-bold text-sm">Chapter ${i}</h4>
                        <p class="text-[8px] text-slate-500 uppercase font-black">Ready to read</p>
                    </div>
                </div>
                <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-600">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="3" d="M9 5l7 7-7 7"></path></svg>
                </div>
            </div>`;
    }
    container.innerHTML = html;
}

window.openRecognition = function(name) {
    const iconBox = document.getElementById('recognition-icon-box');
    const nameEl = document.getElementById('recognition-name');
    const textEl = document.getElementById('recognition-text');
    nameEl.innerText = name;
    if (name === 'MINASHA') {
        iconBox.innerHTML = '❤️';
        textEl.innerText = "Thank you for supporting our community!";
    } else {
        iconBox.innerHTML = '🔥';
        textEl.innerText = "A true legend who keeps the flame alive.";
    }
    window.toggleModal('recognition-modal');
    window.addXP(5);
}
