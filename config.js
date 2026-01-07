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


export const CHAPTER_CONFIG = {
    0:  { title: "CHAPTER 0", pages: 1 }, // Special Video Chapter
    1:  { title: "THE RAGE", pages: 24 },
    2:  { title: "BROKEN NEW WORLD", pages: 37 },
    3:  { title: "BELIEVES", pages: 60 },
    4:  { title: "REGRETS", pages: 60 },
    5:  { title: "CRUEL", pages: 60 },
    6:  { title: "GODS", pages: 60 },
    7:  { title: "BEGINING", pages: 60 },
    8:  { title: "HOPE", pages: 60 },
    9:  { title: "YOU & ME", pages: 60 },
    10: { title: "SOMETHING ODD", pages: 60 },
    11: { title: "LYRA", pages: 60 },
    12: { title: "WHATS NEW?", pages: 60 },
    13: { title: "BEGNING OF EDEN", pages: 60 },
    14: { title: "END OF EDEN", pages: 60 },
    15: { title: "A DISTURBANCE", pages: 60 },
    16: { title: "DISCOVERY", pages: 60 },
    17: { title: "HANDSHAKE", pages: 60 },
    18: { title: "CREATORS", pages: 60 },
    19: { title: "PLAN", pages: 60 },
    20: { title: "BEYOND THE SCOPE", pages: 60 },
    21: { title: "CALM B4 THE STORM", pages: 60 },
    22: { title: "TRAIL 1", pages: 60 },
    23: { title: "TRAIL 2", pages: 60 },
    24: { title: "LIFE", pages: 60 },
    25: { title: "UPGRADE", pages: 60 },
    26: { title: "BETRAYAL", pages: 60 },
    27: { title: "DESTRUCTION", pages: 60 },
    28: { title: "FINALE", pages: 60 },
    29: { title: "OBSERVATION", pages: 60 },
    30: { title: "THE END", pages: 60 },
};

export const DEFAULT_CHAPTER_PAGES = 15;