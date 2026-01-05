
// YOUR REAL SUPABASE CREDENTIALS
const SUPABASE_URL = 'https://qpagyfoedsrbenhsoemx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zaDorGnE20zlG805wQ3SXA_81UbgmLY';

// Initialize Supabase
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Application State
let currentUser = null;
let currentChapterId = 1; // numeric for easy folder mapping
const TOTAL_CHAPTERS = 30;

function getRedirectUrl() {
    return window.location.href.split('#')[0].split('?')[0];
}

window.showView = function(viewId) {
    document.querySelectorAll('.view').forEach(view => {
        view.classList.add('hidden');
    });
    
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.remove('hidden');
    }
    
    if (viewId === 'reader-view') loadReaderData();
    if (viewId === 'chapters-view') loadAllChapterStats();
    if (viewId === 'home-view') loadHomeStats();
    
    window.scrollTo(0, 0);
}

// 1. AUTH LOGIC
async function checkAuth() {
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    currentUser = user;
    
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            currentUser = session?.user || null;
            if (currentUser) window.showView('home-view');
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            window.showView('login-view');
        }
    });

    if (user) {
        window.showView('home-view');
    } else {
        window.showView('login-view');
    }
}

async function loginWithGoogle() {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: getRedirectUrl() }
    });
    if (error) alert(error.message);
}

// 2. CHAPTERS GENERATION & STATS
async function loadAllChapterStats() {
    const grid = document.getElementById('chapters-grid');
    if (!grid) return;

    // Build the 30 chapters structure
    let chaptersHtml = '';
    for (let i = 1; i <= TOTAL_CHAPTERS; i++) {
        chaptersHtml += `
            <div id="chapter-card-${i}" class="group cursor-pointer relative" onclick="openChapter(${i})">
                <div class="relative aspect-[4/5] overflow-hidden rounded-2xl glass border border-slate-800 group-hover:border-purple-500 transition-all pulse-card">
                    <img src="https://picsum.photos/id/${100 + i}/300/400" class="w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700">
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
                    <div class="absolute top-4 left-4 font-tech text-xs font-black italic text-purple-400 text-glow">CH.${String(i).padStart(2, '0')}</div>
                    
                    <div class="absolute bottom-0 left-0 right-0 p-6 translate-y-2 group-hover:translate-y-0 transition-transform">
                        <div class="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
                            <div class="flex items-center gap-1.5 text-pink-500">
                                <svg class="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                                <span id="likes-count-${i}">...</span>
                            </div>
                            <div class="flex items-center gap-1.5 text-blue-400">
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg>
                                <span id="comments-count-${i}">...</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    grid.innerHTML = chaptersHtml;

    // Fetch batch stats from Supabase
    fetchGlobalStats();
}

async function fetchGlobalStats() {
    if (!supabase) return;
    
    // In a real app, we'd do a grouped select. For now, we'll iterate or show placeholders
    // to keep it performant. Let's try to fetch all likes/comments for the project.
    const { data: likes } = await supabase.from('likes').select('chapter_id');
    const { data: comments } = await supabase.from('comments').select('chapter_id');

    for (let i = 1; i <= TOTAL_CHAPTERS; i++) {
        const lCount = likes?.filter(l => l.chapter_id == `chapter-${i}`).length || 0;
        const cCount = comments?.filter(c => c.chapter_id == `chapter-${i}`).length || 0;
        
        const lEl = document.getElementById(`likes-count-${i}`);
        const cEl = document.getElementById(`comments-count-${i}`);
        if (lEl) lEl.innerText = lCount;
        if (cEl) cEl.innerText = cCount;
    }
}

// 3. READER LOGIC
window.openChapter = function(id) {
    currentChapterId = id;
    window.showView('reader-view');
}

async function loadReaderData() {
    const container = document.getElementById('manga-pages-container');
    const title = document.getElementById('reader-chapter-title');
    if (!container) return;

    title.innerText = `DATA STREAM // CH.${String(currentChapterId).padStart(2, '0')}`;
    container.innerHTML = `<div class="p-20 text-slate-500 font-tech animate-pulse">LOADING ASSETS...</div>`;

    // Simulate loading images from "chapterimages{ID}/page_{N}.jpg"
    // Since we don't have the real files, we'll mock them with placeholders.
    // In your real setup, you'd loop 1 to 20 or similar.
    let imagesHtml = '';
    for (let i = 1; i <= 5; i++) {
        // ACTUAL FOLDER LOGIC: `chapterimages${currentChapterId}/page_${i}.jpg`
        const mockUrl = `https://picsum.photos/id/${(currentChapterId * 10) + i}/800/1200`;
        imagesHtml += `<img src="${mockUrl}" class="manga-img shadow-2xl mb-1" alt="Page ${i}" loading="lazy">`;
    }
    container.innerHTML = imagesHtml;

    loadSocialForReader();
}

async function loadSocialForReader() {
    const cid = `chapter-${currentChapterId}`;
    
    // Likes
    const { count: likeCount } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('chapter_id', cid);
    
    document.getElementById('reader-like-count').innerText = `${likeCount || 0} LIKES`;

    // Heart Icon State
    if (currentUser) {
        const { data: userLike } = await supabase
            .from('likes')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('chapter_id', cid)
            .single();
        
        const icon = document.getElementById('reader-heart-icon');
        if (userLike) {
            icon.classList.add('text-pink-500', 'fill-current');
        } else {
            icon.classList.remove('text-pink-500', 'fill-current');
        }
    }

    // Comments
    const { data: comments } = await supabase
        .from('comments')
        .select('*')
        .eq('chapter_id', cid)
        .order('created_at', { ascending: false });

    const list = document.getElementById('reader-comments-list');
    if (comments && comments.length > 0) {
        list.innerHTML = comments.map(c => `
            <div class="glass p-4 rounded-2xl border-l-2 border-purple-500">
                <div class="flex justify-between items-center mb-1">
                    <span class="text-[10px] font-black italic text-purple-400">USER_${c.user_id.slice(0, 5).toUpperCase()}</span>
                    <span class="text-[8px] text-slate-600 uppercase tracking-widest">${new Date(c.created_at).toLocaleDateString()}</span>
                </div>
                <p class="text-xs text-slate-300 leading-relaxed">${c.content}</p>
            </div>
        `).join('');
    } else {
        list.innerHTML = `<div class="text-center py-10 text-slate-700 text-[10px] uppercase tracking-widest italic">No transmissions recorded</div>`;
    }
}

async function toggleLike() {
    if (!currentUser) return alert('VERIFICATION REQUIRED: Login to interact');
    const cid = `chapter-${currentChapterId}`;
    
    const { data: existing } = await supabase
        .from('likes')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('chapter_id', cid)
        .single();

    if (existing) {
        await supabase.from('likes').delete().eq('id', existing.id);
    } else {
        await supabase.from('likes').insert({ chapter_id: cid });
    }
    loadSocialForReader();
}

async function postComment() {
    const input = document.getElementById('comment-input');
    if (!input || !input.value.trim() || !currentUser) return;
    
    const cid = `chapter-${currentChapterId}`;
    const { error } = await supabase.from('comments').insert({
        chapter_id: cid,
        content: input.value.trim()
    });
    
    if (!error) {
        input.value = '';
        loadSocialForReader();
    }
}

async function loadHomeStats() {
    if (!supabase) return;
    const { count } = await supabase.from('likes').select('*', { count: 'exact', head: true });
    const el = document.getElementById('global-reader-count');
    if (el) el.innerText = (count || 0) + 1240; // Add some base numbers for "hype"
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

    document.getElementById('google-login-btn')?.addEventListener('click', loginWithGoogle);
    document.getElementById('logout-btn')?.addEventListener('click', () => {
        supabase.auth.signOut().then(() => location.reload());
    });
    document.getElementById('reader-like-btn')?.addEventListener('click', toggleLike);
    document.getElementById('post-comment-btn')?.addEventListener('click', postComment);
});
