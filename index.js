
import { GoogleGenAI } from "@google/genai";

// YOUR REAL SUPABASE CREDENTIALS
const SUPABASE_URL = 'https://qpagyfoedsrbenhsoemx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zaDorGnE20zlG805wQ3SXA_81UbgmLY';

// Initialize Supabase
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Application State
let currentUser = null;
let profileData = null;
let currentChapterId = 1;
const TOTAL_CHAPTERS = 30;

// Initialize Google AI
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Utility: Show View
window.showView = function(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const target = document.getElementById(viewId);
    if (target) target.classList.remove('hidden');

    const nav = document.getElementById('app-nav');
    if (viewId !== 'loading-view' && viewId !== 'login-view') {
        nav.classList.remove('hidden');
    } else {
        nav.classList.add('hidden');
    }

    if (viewId === 'chapters-view') loadChapters();
    if (viewId === 'profile-view') fillProfileForm();
    window.scrollTo(0, 0);
}

// Utility: Toggle Modal
window.toggleModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.toggle('hidden');
}

// 1. AUTH & PROFILE
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

    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            currentUser = session?.user || null;
            if (currentUser) {
                await fetchProfile();
                window.showView('home-view');
            }
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            window.showView('login-view');
        }
    });
}

async function fetchProfile() {
    if (!currentUser) return;
    
    // Check if profile exists
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    if (error && error.code === 'PGRST116') {
        // Create profile if missing
        const newProfile = {
            id: currentUser.id,
            display_name: currentUser.user_metadata.full_name || 'New Mage',
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
    document.getElementById('nav-user-name').innerText = profileData.display_name.toUpperCase();
    document.getElementById('nav-user-avatar').src = profileData.avatar_url;
    document.getElementById('profile-avatar').src = profileData.avatar_url;
    document.getElementById('profile-display-name').innerText = profileData.display_name.toUpperCase();
}

function fillProfileForm() {
    if (!profileData) return;
    document.getElementById('edit-name').value = profileData.display_name;
    document.getElementById('edit-birth').value = profileData.birth_date || '';
    document.getElementById('edit-bio').value = profileData.bio || '';
}

async function saveProfile() {
    const btn = document.getElementById('save-profile-btn');
    btn.disabled = true;
    btn.innerText = 'SAVING...';

    const updates = {
        display_name: document.getElementById('edit-name').value,
        birth_date: document.getElementById('edit-birth').value,
        bio: document.getElementById('edit-bio').value,
        updated_at: new Date()
    };

    const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', currentUser.id);

    if (error) alert(error.message);
    else {
        profileData = { ...profileData, ...updates };
        updateNavUI();
        alert('Scroll Updated Successfully!');
    }
    btn.disabled = false;
    btn.innerText = 'SAVE CHANGES';
}

// 2. AI GENERATION (GEMINI)
async function generateAIAvatar() {
    const promptInput = document.getElementById('ai-prompt');
    const prompt = promptInput.value.trim();
    if (!prompt) return alert('Describe your form, Mage!');

    const loader = document.getElementById('ai-loading-overlay');
    const preview = document.getElementById('generated-avatar-preview');
    const placeholder = document.getElementById('ai-placeholder-text');
    const applyBtn = document.getElementById('apply-ai-avatar-btn');

    loader.classList.remove('hidden');
    placeholder.classList.add('hidden');

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: `A high-quality fantasy manga style character portrait: ${prompt}. Cinematic lighting, detailed anime art style.` }] },
            config: { imageConfig: { aspectRatio: "1:1" } }
        });

        let base64 = null;
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                base64 = part.inlineData.data;
                break;
            }
        }

        if (base64) {
            const dataUrl = `data:image/png;base64,${base64}`;
            preview.src = dataUrl;
            preview.classList.remove('hidden');
            applyBtn.classList.remove('hidden');
        }
    } catch (err) {
        console.error(err);
        alert('The AI Oracle is currently resting. Try again later.');
    } finally {
        loader.classList.add('hidden');
    }
}

async function applyAIAvatar() {
    const dataUrl = document.getElementById('generated-avatar-preview').src;
    if (!dataUrl) return;

    // In a real app, you would upload to Supabase Storage. 
    // For this prototype, we save the base64 string directly to the profile's avatar_url
    const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: dataUrl })
        .eq('id', currentUser.id);

    if (!error) {
        profileData.avatar_url = dataUrl;
        updateNavUI();
        toggleModal('gemini-modal');
        alert('Identity Manifested!');
    }
}

// 3. SETTINGS & THEMING
window.updateAura = function(color) {
    document.documentElement.style.setProperty('--aura-color', color);
    const glow = hexToRgba(color, 0.5);
    document.documentElement.style.setProperty('--aura-glow', glow);
    localStorage.setItem('aura-color', color);
}

window.updateFont = function(fontFamily) {
    document.body.style.fontFamily = `'${fontFamily}', sans-serif`;
    localStorage.setItem('app-font', fontFamily);
}

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function loadSettings() {
    const savedColor = localStorage.getItem('aura-color');
    const savedFont = localStorage.getItem('app-font');
    if (savedColor) updateAura(savedColor);
    if (savedFont) updateFont(savedFont);
}

// 4. CONTENT & MODALS
function loadChapters() {
    const container = document.getElementById('chapters-list-mobile');
    if (!container) return;

    let html = '';
    for (let i = 1; i <= TOTAL_CHAPTERS; i++) {
        html += `
            <div class="glass-panel p-5 rounded-3xl flex items-center justify-between group active:scale-[0.98] transition-all" onclick="openReader(${i})">
                <div class="flex items-center gap-5">
                    <div class="w-12 h-12 rounded-2xl bg-slate-900 border border-white/5 flex items-center justify-center font-magic text-purple-500 group-hover:aura-bg group-hover:text-white transition-all">
                        ${String(i).padStart(2, '0')}
                    </div>
                    <div>
                        <h4 class="font-bold text-sm">Chapter ${i}</h4>
                        <p class="text-[9px] text-slate-500 uppercase tracking-widest">Available to read</p>
                    </div>
                </div>
                <div class="text-purple-500">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

window.openRecognition = function(name, type) {
    const iconBox = document.getElementById('recognition-icon-box');
    const nameEl = document.getElementById('recognition-name');
    const textEl = document.getElementById('recognition-text');
    const modal = document.getElementById('recognition-modal');

    nameEl.innerText = name;
    if (name === 'MINASHA') {
        iconBox.innerHTML = '❤️';
        iconBox.className = 'w-20 h-20 mx-auto rounded-full flex items-center justify-center text-3xl shadow-2xl bg-pink-500/20 text-pink-500';
        textEl.innerText = "The Heart of the Archive. Your kindness fuels our hope in the darkest of chapters.";
    } else {
        iconBox.innerHTML = '🔥';
        iconBox.className = 'w-20 h-20 mx-auto rounded-full flex items-center justify-center text-3xl shadow-2xl bg-orange-500/20 text-orange-500';
        textEl.innerText = "The Flame of Persistence. Your passion ignites the creative spirits of this sanctum.";
    }

    modal.classList.remove('hidden');
}

window.openReader = function(id) {
    // Basic redirection to the reader (you can refine the reader UI later if needed)
    currentChapterId = id;
    alert(`Entering Archive: Chapter ${id}. (Images would load from chapterimages${id}/...)`);
}

// 5. EVENT LISTENERS
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    checkAuth();

    document.getElementById('google-login-btn')?.addEventListener('click', () => {
        supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.href.split('#')[0].split('?')[0] }
        });
    });

    document.getElementById('save-profile-btn')?.addEventListener('click', saveProfile);
    document.getElementById('generate-ai-btn')?.addEventListener('click', generateAIAvatar);
    document.getElementById('apply-ai-avatar-btn')?.addEventListener('click', applyAIAvatar);
});
