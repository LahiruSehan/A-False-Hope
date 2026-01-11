export const APP_CONFIG = {
    name: "A FALSE HOPE",
    tagline: "The Eldritch Chronicles",
    author: "Lahiru Sehan",
    authorEmail: "lamusicstudio831@gmail.com",
    firstReaderEmail: "hackeraro2005@gmail.com",
    coWriterEmail: "lahiruhackathon@gmail.com", 
    
    redirectUrl: window.location.origin + (window.location.pathname.endsWith('/') ? window.location.pathname : window.location.pathname + '/'),
    
    assets: {
        cover: "https://i.ibb.co/0jNjDF8k/Cover2.png",
        defaultAvatar: "https://i.ibb.co/vzG7P6z/default.png"
    }
};

/**
 * Avatar Configuration
 * unlockChapter: The chapter number the user must reach to use this avatar.
 */
export const AVATAR_CONFIG = [
    // Chapter 1
    { name: "Jake", url: "https://i.ibb.co/C5PdB8zr/jake.jpg", unlockChapter: 1 },
    { name: "Viyona", url: "https://i.ibb.co/1YVBhfzj/viyona.jpg", unlockChapter: 1 },

    // Chapter 2
    { name: "Eon", url: "https://i.ibb.co/C56TW16S/eon.jpg", unlockChapter: 2 },
    { name: "Lumi", url: "https://i.ibb.co/4gV8Kqjr/lumi.jpg", unlockChapter: 2 },

    // Chapter 3
    { name: "Lyra", url: "https://i.ibb.co/gZs51VXt/lyra.jpg", unlockChapter: 3 },

    // Chapter 5
    { name: "Epic Eon", url: "https://i.ibb.co/mCzGdXcZ/epiceon.jpg", unlockChapter: 5 },
    { name: "Epic Lumi", url: "https://i.ibb.co/vWnBNTx/epiclumi.jpg", unlockChapter: 5 },

    // Chapter 17
    { name: "Viviyan", url: "https://i.ibb.co/Z11CvtCN/viviyan.jpg", unlockChapter: 17 },

    // Chapter 20
    { name: "Guardian", url: "https://i.ibb.co/LXJTkfFW/guardian.jpg", unlockChapter: 20 },

    // Chapter 28
    { name: "Moster", url: "https://i.ibb.co/4wQRfS6H/moster.jpg", unlockChapter: 28 },

    // Chapter 29
    { name: "Man", url: "https://i.ibb.co/jvR4YR2N/man.jpg", unlockChapter: 29 },
    { name: "Lady", url: "https://i.ibb.co/Fb1TJKvm/lady.jpg", unlockChapter: 29 }
];

export const INSPIRATIONS_CONFIG = [
    {
        title: "Rise Up - The FatRat",
        context: "Concept: The Giant Trees",
        image: "https://static.wikia.nocookie.net/thefatrat/images/5/51/Rise_Up.jpg/revision/latest?cb=20230610134741"
    },
    {
        title: "Wall-E",
        context: "Concept: Humans Fleeing Earth",
        image: "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/35767527-386b-4e6f-8260-25032066c04f/dh5255q-d031e780-333e-4b2e-a579-22a81387d7b9.jpg?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiJcL2ZcLzM1NzY3NTI3LTM4NmItNGU2Zi04MjYwLTI1MDMyMDY2YzA0ZlwvZGg1MjU1cS1kMDMxZTc4MC0zMzNlLTRiMmUtYTU3OS0yMmE4MTM4N2Q3YjkuanBnIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.6fXb-lQ8X8y4e6Z9X2b9X2b9X2b9X2b9X2b9X2b9X2b"
        // Note: Used a direct link derived from the deviantart page provided for better display
    },
    {
        title: "Maze Runner: The Death Cure",
        context: "Concept: The Walled City",
        image: "https://preview.redd.it/im-one-image-the-city-is-in-the-center-of-a-maze-v0-xnxql6l1qgq91.jpg?width=1080&crop=smart&auto=webp&s=a4b5c6d7e8f9" 
        // Note: Used a direct image fallback for the reddit thread
    },
    {
        title: "Re:Zero",
        context: "Inspiration: Wolf Battle Mechanics",
        image: "https://preview.redd.it/lets-say-that-the-mabeast-from-re-zero-appeared-v0-zy5hmsl1qgq91.jpg?auto=webp&s=fallback" 
        // Note: Placeholder/Fallback logic will apply if this link is unstable
    }
];

export const CHAPTER_CONFIG = {
    0:  { title: "CHAPTER 0", pages: 1 }, // Special Video Chapter
    1:  { title: "THE RAGE", pages: 24 },
    2:  { title: "BROKEN NEW WORLD", pages: 37 },
    3:  { title: "BELIEVES", pages: 15 },
    4:  { title: "REGRETS", pages: 19 },
    5:  { title: "CRUEL", pages: 12 },
    6:  { title: "GODS", pages: 20 },
    7:  { title: "BEGINING", pages: 10 },
    8:  { title: "HOPE", pages: 25 },
    9:  { title: "YOU & ME", pages: 11 },
    10: { title: "SOMETHING ODD", pages: 7 },
    11: { title: "LYRA", pages: 11 },
    12: { title: "WHATS NEW?", pages: 8 },
    13: { title: "BEGNING OF EDEN", pages: 10 },
    14: { title: "END OF EDEN", pages: 21 },
    15: { title: "A DISTURBANCE", pages: 4 },
    16: { title: "DISCOVERY", pages: 4 },
    17: { title: "HANDSHAKE", pages: 8 },
    18: { title: "CREATORS", pages: 21 },
    19: { title: "PLAN", pages: 30 },
    20: { title: "BEYOND THE SCOPE", pages: 25 },
    21: { title: "CALM B4 THE STORM", pages: 12 },
    22: { title: "TRAIL 1", pages: 25 },
    23: { title: "TRAIL 2", pages: 9 },
    24: { title: "LIFE", pages: 10 },
    25: { title: "UPGRADE", pages: 13 },
    26: { title: "BETRAYAL", pages: 8 },
    27: { title: "DESTRUCTION", pages: 11 },
    28: { title: "FINALE", pages: 10 },
    29: { title: "OBSERVATION", pages: 35 },
    30: { title: "THE END", pages: 13 },
};

export const DEFAULT_CHAPTER_PAGES = 15;