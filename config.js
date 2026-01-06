export const APP_CONFIG = {
    name: "A FALSE HOPE",
    tagline: "The Eldritch Chronicles",
    author: "Lahiru Sehan",
    authorEmail: "lamusicstudio831@gmail.com",
    redirectUrl: 'https://lahirusehan.github.io/A-False-Hope/',
    assets: {
        cover: "https://i.ibb.co/0jNjDF8k/Cover2.png",
        defaultAvatar: "https://i.ibb.co/vzG7P6z/default.png"
    }
};

/**
 * Chapter Configuration
 * id: The chapter number (corresponds to folder imageschapter[id])
 * title: The custom name for the chapter
 * pages: The total number of images (1.png, 2.png, ...) in that folder
 */
export const CHAPTER_CONFIG = {
    1: { title: "THE AWAKENING", pages: 24 },
    2: { title: "VOID WHISPERS", pages: 22 },
    3: { title: "CRYSTAL SHARDS", pages: 20 },
    4: { title: "SHADOW DANCE", pages: 18 },
    5: { title: "THE DESCENT", pages: 25 },
    6: { title: "HOPE'S END", pages: 21 },
    7: { title: "BLOOD MOON", pages: 19 },
    8: { title: "FORGOTTEN TALES", pages: 23 },
    9: { title: "SILENT ECHO", pages: 20 },
    10: { title: "ETERNAL NIGHT", pages: 22 },
    11: { title: "THE RIFT", pages: 18 },
    12: { title: "ASH AND BONE", pages: 20 },
    13: { title: "VOID WALKER", pages: 24 },
    14: { title: "THE ABYSS", pages: 22 },
    15: { title: "REBIRTH", pages: 26 },
    // You can add up to 30 here as per your folder structure
};

// Default values for chapters not explicitly defined above
export const DEFAULT_CHAPTER_PAGES = 15;