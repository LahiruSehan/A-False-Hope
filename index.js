
// REPLACE THESE WITH YOUR ACTUAL SUPABASE URL AND KEY FROM YOUR DASHBOARD
const SUPABASE_URL = 'https://qpagyfoedsrbenhsoemx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zaDorGnE20zlG805wQ3SXA_81UbgmLY';

// Initialize Supabase
const supabase = (window.supabase && SUPABASE_URL !== 'https://your-project-url.supabase.co') 
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) 
    : null;

// Application State
let currentUser = null;
let currentChapterId = 'chapter-1';
let userProgress = null;

// Utility for showing views
window.showView = function(viewId) {
    document.querySelectorAll('.view').forEach(view => {
        view.classList.add('hidden');
        view.style.opacity = '0';
    });
    
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.remove('hidden');
        setTimeout(() => target.style.opacity = '1', 10);
    }
    
    if (viewId === 'reader-view') {
        loadSocialData();
        saveProgress();
    }
    if (viewId === 'home-view') {
        loadHomeStats();
        fetchUserProgress();
    }
    
    window.scrollTo(0, 0);
}

// 1. AUTH LOGIC
async function checkAuth() {
    if (!supabase) {
        console.warn("Supabase not configured. Using guest mode.");
        window.showView('login-view');
        return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    currentUser = user;
    
    // Auth state listener
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
            currentUser = session.user;
            window.showView('home-view');
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
    if (!supabase) return alert("Please configure SUPABASE_URL and SUPABASE_KEY in index.js first!");
    await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin
        }
    });
}

// 2. REAL PROGRESS SYNCING
async function fetchUserProgress() {
    if (!supabase || !currentUser) return;
    const { data } = await supabase
        .from('user_progress')
        .select('last_chapter_id')
        .eq('user_id', currentUser.id)
        .single();
    
    if (data) {
        userProgress = data.last_chapter_id;
        const progressText = document.getElementById('resume-text');
        if (progressText) progressText.innerText = `Resume ${data.last_chapter_id.replace('-', ' ')}`;
    }
}

async function saveProgress() {
    if (!supabase || !currentUser) return;
    await supabase
        .from('user_progress')
        .upsert({ 
            user_id: currentUser.id, 
            last_chapter_id: currentChapterId,
            updated_at: new Date().toISOString()
        });
}

// 3. SOCIAL DATA (Likes & Comments)
async function loadSocialData() {
    if (!supabase) return;

    // Fetch Likes Count
    const { count: likeCount } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('chapter_id', currentChapterId);
    
    document.getElementById('like-count').innerText = `${likeCount || 0} Likes`;

    // Check if current user liked it
    if (currentUser) {
        const { data: userLike } = await supabase
            .from('likes')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('chapter_id', currentChapterId)
            .single();
        
        const icon = document.getElementById('heart-icon');
        if (userLike) {
            icon.classList.add('text-pink-500', 'fill-current');
        } else {
            icon.classList.remove('text-pink-500', 'fill-current');
        }
    }

    // Fetch Comments
    const { data: comments } = await supabase
        .from('comments')
        .select('*')
        .eq('chapter_id', currentChapterId)
        .order('created_at', { ascending: false });

    const list = document.getElementById('comments-list');
    if (comments && comments.length > 0) {
        list.innerHTML = comments.map(c => {
            // Use fallback if metadata isn't available
            const userName = currentUser && c.user_id === currentUser.id ? "You" : `Reader ${c.user_id.slice(0, 4)}`;
            return `
                <div class="flex space-x-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div class="w-10 h-10 bg-indigo-100 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-indigo-600">
                        ${userName.charAt(0)}
                    </div>
                    <div class="flex-1">
                        <div class="flex items-center space-x-2">
                            <span class="font-bold text-sm text-slate-900">${userName}</span>
                            <span class="text-[10px] text-slate-400 uppercase tracking-tighter">${new Date(c.created_at).toLocaleDateString()}</span>
                        </div>
                        <p class="text-slate-600 mt-1 text-sm leading-relaxed">${c.content}</p>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        list.innerHTML = `<p class="text-slate-400 italic text-sm">No comments yet. Share your thoughts!</p>`;
    }
}

async function toggleLike() {
    if (!currentUser) return alert('Please log in to like!');
    
    const { data: existing } = await supabase
        .from('likes')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('chapter_id', currentChapterId)
        .single();

    if (existing) {
        await supabase.from('likes').delete().eq('id', existing.id);
    } else {
        await supabase.from('likes').insert({ chapter_id: currentChapterId });
    }
    loadSocialData();
}

async function postComment() {
    const input = document.getElementById('comment-input');
    if (!input.value.trim() || !currentUser) return;
    
    const { error } = await supabase.from('comments').insert({
        chapter_id: currentChapterId,
        content: input.value.trim()
    });
    
    if (error) {
        console.error("Error posting comment:", error);
        alert("Failed to post comment. Check your database permissions!");
    } else {
        input.value = '';
        loadSocialData();
    }
}

async function loadHomeStats() {
    if (!supabase) return;
    const { data } = await supabase.from('site_stats').select('reader_count').single();
    if (data) {
        const counter = document.getElementById('global-reader-count');
        counter.innerText = data.reader_count.toLocaleString();
    }
}

// 4. CHAPTER INJECTION
function setupChapters() {
    const chapters = [
        { id: 'chapter-1', title: 'The Awakening', status: 'Available' },
        { id: 'chapter-2', title: 'Whispers in the Dark', status: 'Available' },
        { id: 'chapter-3', title: 'The Resonance', status: 'Premium' }
    ];
    
    const list = document.getElementById('chapters-list');
    list.innerHTML = chapters.map(ch => `
        <div class="chapter-row bg-white border border-slate-100 rounded-3xl p-6 flex justify-between items-center cursor-pointer hover:border-indigo-500 transition-all group" 
             onclick="currentChapterId='${ch.id}'; window.showView('reader-view')">
            <div class="flex items-center gap-6">
                <div class="w-12 h-12 flex items-center justify-center bg-indigo-50 rounded-2xl text-indigo-600 font-extrabold group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    ${ch.id.replace('chapter-', '')}
                </div>
                <div>
                    <h3 class="font-bold text-lg text-slate-900">${ch.title}</h3>
                    <p class="text-sm text-slate-500">${ch.status}</p>
                </div>
            </div>
            <div class="text-indigo-600 font-bold group-hover:translate-x-1 transition-transform">Read →</div>
        </div>
    `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupChapters();

    // Attach Listeners
    const googleBtn = document.getElementById('google-login-btn');
    if (googleBtn) googleBtn.addEventListener('click', loginWithGoogle);
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        if (supabase) supabase.auth.signOut().then(() => location.reload());
    });

    const likeBtn = document.getElementById('like-btn');
    if (likeBtn) likeBtn.addEventListener('click', toggleLike);

    const commentBtn = document.getElementById('post-comment-btn');
    if (commentBtn) commentBtn.addEventListener('click', postComment);
});
