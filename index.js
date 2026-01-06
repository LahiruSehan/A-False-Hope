
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

// Utility: Show View
window.showView = function(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('animate-in', 'fade-in', 'duration-500');
    }

    const nav = document.getElementById('app-nav');
    if (viewId !== 'loading-view' && viewId !== 'login-view') {
        nav.classList.remove('hidden');
    } else {
        nav.classList.add('hidden');
    }

    if (viewId === 'chapters-view') loadChapters();
    if (viewId === 'profile-view') fillProfileForm();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Utility: Toggle Modal
window.toggleModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        if (modal.classList.contains('hidden')) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        } else {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }
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
        console.error("Auth check failed", e);
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
    
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

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
    btn.innerText = 'SEALING SCROLL...';

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
        alert('Manifestation Successful!');
    }
    btn.disabled = false;
    btn.innerText = 'SAVE CHANGES';
}

// 2. AI GENERATION (GEMINI)
async function generateAIAvatar() {
    // Check for API key selection
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
        await window.aistudio.openSelectKey();
        // Proceeding after selection (per instructions)
    }

    const promptInput = document.getElementById('ai-prompt');
    const prompt = promptInput.value.trim();
    if (!prompt) return alert('Describe your astral form!');

    const loader = document.getElementById('ai-loading-overlay');
    const preview = document.getElementById('generated-avatar-preview');
    const placeholder = document.getElementById('ai-placeholder-text');
    const applyBtn = document.getElementById('apply-ai-avatar-btn');

    loader.classList.remove('hidden');
    placeholder.classList.add('hidden');

    try {
        // Create instance right before call to use latest key
        const aiInstance = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: `Epic fantasy anime character portrait, magical aura, detailed art: ${prompt}` }] },
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
        if (err.message.includes("Requested entity was not found")) {
             await window.aistudio.openSelectKey();
        } else {
             alert('The Astral Plane is currently unstable. Please try again.');
        }
    } finally {
        loader.classList.add('hidden');
    }
}

async function applyAIAvatar() {
    const dataUrl = document.getElementById('generated-avatar-preview').src;
    if (!dataUrl) return;

    const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: dataUrl })
        .eq('id', currentUser.id);

    if (!error) {
        profileData.avatar_url = dataUrl;
        updateNavUI();
        toggleModal('gemini-modal');
        alert('Your new form is complete!');
    }
}

// 3. SETTINGS & THEMING
window.updateAura = function(color) {
    document.documentElement.style.setProperty('--aura-color', color);
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    document.documentElement.style.setProperty('--aura-glow', `rgba(${r}, ${g}, ${b}, 0.5)`);
    localStorage.setItem('aura-color', color);
}

window.updateFont = function(fontFamily) {
    document.body.style.fontFamily = `'${fontFamily}', sans-serif`;
    localStorage.setItem('app-font', fontFamily);
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
            <div class="glass-panel p-5 rounded-[2rem] flex items-center justify-between group active:scale-[0.98] transition-all border border-white/5" onclick="openReader(${i})">
                <div class="flex items-center gap-5">
                    <div class="w-12 h-12 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center font-magic text-purple-500 group-hover:aura-bg group-hover:text-white transition-all shadow-inner">
                        ${String(i).padStart(2, '0')}
                    </div>
                    <div>
                        <h4 class="font-bold text-sm tracking-wide">Chapter ${i}</h4>
                        <p class="text-[9px] text-slate-500 uppercase tracking-widest font-medium">Scroll Unlocked</p>
                    </div>
                </div>
                <div class="text-purple-500 opacity-50">
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
        iconBox.className = 'w-24 h-24 mx-auto rounded-full flex items-center justify-center text-4xl shadow-2xl bg-pink-500/10 border border-pink-500/20 text-pink-500 animate-pulse';
        textEl.innerText = "The Heart of the Sanctum. Your benevolence illuminates our path and keeps the magic of this archive thriving.";
    } else {
        iconBox.innerHTML = '🔥';
        iconBox.className = 'w-24 h-24 mx-auto rounded-full flex items-center justify-center text-4xl shadow-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500 animate-bounce';
        textEl.innerText = "The Eternal Flame. Your unwavering support ignites the creative spark that drives every chapter forward.";
    }

    window.toggleModal('recognition-modal');
}

window.openReader = function(id) {
    currentChapterId = id;
    alert(`Descending into Chapter ${id}... Prepare your senses.`);
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
