
// REPLACE THESE WITH YOUR ACTUAL SUPABASE URL AND KEY
const SUPABASE_URL = 'https://your-project-url.supabase.co';
const SUPABASE_KEY = 'your-anon-key';

const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Application State
let currentUser = null;
let currentChapterId = 'chapter-1';

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
    
    if (viewId === 'reader-view') loadSocialData();
    if (viewId === 'home-view') loadHomeStats();
    
    window.scrollTo(0, 0);
}

// 1. AUTH LOGIC
async function checkAuth() {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    currentUser = user;
    
    if (user) {
        window.showView('home-view');
    } else {
        window.showView('login-view');
    }
}

async function loginWithGoogle() {
    await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin
        }
    });
}

// 2. SOCIAL DATA (Likes & Comments)
async function loadSocialData() {
    if (!supabase) return;

    // Fetch Likes
    const { count: likeCount } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('chapter_id', currentChapterId);
    
    document.getElementById('like-count').innerText = `${likeCount || 0} Likes`;

    // Check if user liked it
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

    // Fetch Comments with User Profiles
    const { data: comments } = await supabase
        .from('comments')
        .select(`
            id, content, created_at, user_id
        `)
        .eq('chapter_id', currentChapterId)
        .order('created_at', { ascending: false });

    const list = document.getElementById('comments-list');
    if (comments && comments.length > 0) {
        list.innerHTML = comments.map(c => `
            <div class="flex space-x-4">
                <div class="w-10 h-10 bg-slate-100 rounded-full flex-shrink-0"></div>
                <div>
                    <div class="flex items-center space-x-2">
                        <span class="font-bold text-sm">User ${c.user_id.slice(0,5)}</span>
                        <span class="text-xs text-slate-400">${new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                    <p class="text-slate-600 mt-1">${c.content}</p>
                </div>
            </div>
        `).join('');
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
    
    await supabase.from('comments').insert({
        chapter_id: currentChapterId,
        content: input.value.trim()
    });
    
    input.value = '';
    loadSocialData();
}

async function loadHomeStats() {
    if (!supabase) return;
    const { data } = await supabase.from('site_stats').select('reader_count').single();
    if (data) document.getElementById('global-reader-count').innerText = data.reader_count.toLocaleString();
}

// 3. CHAPTER INJECTION
function setupChapters() {
    const chapters = [
        { id: 'chapter-1', title: 'The Awakening', status: 'Finished' },
        { id: 'chapter-2', title: 'Whispers in the Dark', status: 'Reading' }
    ];
    
    const list = document.getElementById('chapters-list');
    list.innerHTML = chapters.map(ch => `
        <div class="chapter-row bg-white border border-slate-100 rounded-3xl p-6 flex justify-between items-center cursor-pointer hover:border-indigo-500 transition-all group" 
             onclick="currentChapterId='${ch.id}'; window.showView('reader-view')">
            <div class="flex items-center gap-6">
                <div class="w-12 h-12 flex items-center justify-center bg-indigo-50 rounded-2xl text-indigo-600 font-extrabold group-hover:bg-indigo-600 group-hover:text-white transition-all">0${ch.id.slice(-1)}</div>
                <div>
                    <h3 class="font-bold text-lg text-slate-900">${ch.title}</h3>
                    <p class="text-sm text-slate-500">${ch.status}</p>
                </div>
            </div>
            <div class="text-indigo-600 font-bold">Read</div>
        </div>
    `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    // Check initial session
    checkAuth();
    setupChapters();

    // Event Listeners
    document.getElementById('google-login-btn').addEventListener('click', loginWithGoogle);
    document.getElementById('logout-btn').addEventListener('click', () => supabase.auth.signOut().then(() => location.reload()));
    document.getElementById('like-btn').addEventListener('click', toggleLike);
    document.getElementById('post-comment-btn').addEventListener('click', postComment);
});
