
import { GoogleGenAI } from "@google/genai";

// SAFETY SHIM: Prevent crash on GitHub Pages where 'process' is undefined
if (typeof process === 'undefined') {
    window.process = { env: { API_KEY: '' } };
}

const SUPABASE_URL = 'https://qpagyfoedsrbenhsoemx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zaDorGnE20zlG805wQ3SXA_81UbgmLY';

const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

let currentUser = null;
let profileData = null;
let currentChapterId = 1;
const TOTAL_CHAPTERS = 30;

// Utility: Show View
window.showView = function(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('animate-in', 'fade-in', 'duration-500');
    }

    const nav = document.getElementById('app-nav');
    // Hide nav in reader for immersion
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
            display_name: currentUser.user_metadata.full_name || 'Initiate Mage',
            avatar_url: currentUser.user_metadata.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.id}`
        };
        await supabase.from('profiles').insert(newProfile);
        profileData = newProfile;
    } else {
        profileData = data;
    }
    updateNavUI();
}

function updateNavUI() {
    if (!profileData) return;
    const nameEls = ['nav-user-name', 'profile-display-name'];
    nameEls.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = profileData.display_name.toUpperCase();
    });
    const avatarEls = ['nav-user-avatar', 'profile-avatar'];
    avatarEls.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.src = profileData.avatar_url;
    });
}

function fillProfileForm() {
    if (!profileData) return;
    document.getElementById('edit-name').value = profileData.display_name;
    document.getElementById('edit-birth').value = profileData.birth_date || '';
    document.getElementById('edit-bio').value = profileData.bio || '';
}

// 2. AI GENERATION
async function generateAIAvatar() {
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
        await window.aistudio.openSelectKey();
    }

    const prompt = document.getElementById('ai-prompt').value.trim();
    if (!prompt) return alert('Describe your astral form!');

    const loader = document.getElementById('ai-loading-overlay');
    const preview = document.getElementById('generated-avatar-preview');
    const applyBtn = document.getElementById('apply-ai-avatar-btn');

    loader.classList.remove('hidden');
    try {
        const aiInstance = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: `Dark fantasy anime portrait: ${prompt}. Glowing eyes, mystic aura, highly detailed manga art.` }] },
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
        if (err.message.includes("not found")) await window.aistudio.openSelectKey();
        else alert('Astral interference detected. Try again.');
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
    
    // Clear and load mock pages
    container.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
        const img = document.createElement('img');
        // REPLACE WITH ACTUAL FOLDER LOGIC: `./chapter_${id}/page_${i}.jpg`
        img.src = `https://picsum.photos/seed/chapter${id}page${i}/800/1200`;
        img.className = "w-full h-auto mb-2 shadow-2xl rounded-sm";
        img.loading = "lazy";
        container.appendChild(img);
    }
}

// 4. SETTINGS
window.updateAura = function(color) {
    document.documentElement.style.setProperty('--aura-color', color);
    localStorage.setItem('aura-color', color);
}

// 5. BOOTSTRAP
document.addEventListener('DOMContentLoaded', () => {
    const savedColor = localStorage.getItem('aura-color');
    if (savedColor) window.updateAura(savedColor);
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
        alert('Manifested!');
    });

    // Reader Scroll Progress
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
            <div class="glass-panel p-6 rounded-[2.5rem] flex items-center justify-between active:scale-95 transition-all border border-white/5" onclick="openReader(${i})">
                <div class="flex items-center gap-6">
                    <span class="font-magic text-2xl aura-text opacity-50 italic">${String(i).padStart(2, '0')}</span>
                    <div>
                        <h4 class="font-bold text-sm tracking-tight">The Veiled Truth</h4>
                        <p class="text-[8px] text-slate-500 uppercase tracking-widest font-black">Chapter ${i}</p>
                    </div>
                </div>
                <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-600">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="3" d="M9 5l7 7-7 7"></path></svg>
                </div>
            </div>`;
    }
    container.innerHTML = html;
}
