export const APP_CONFIG = {
    name: "A FALSE HOPE",
    tagline: "The Eldritch Chronicles",
    author: "Lahiru Sehan",
    authorEmail: "lamusicstudio831@gmail.com",
    firstReaderEmail: "hackeraro2005@gmail.com", // Added First Reader
    // This dynamically gets the current URL. 
    // If you are on hope2877.online, it uses that. 
    // If you are on github.io, it uses that.
    redirectUrl: window.location.origin + (window.location.pathname.endsWith('/') ? window.location.pathname : window.location.pathname + '/'),
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


// Default values for chapters not explicitly defined above
export const DEFAULT_CHAPTER_PAGES = 15;