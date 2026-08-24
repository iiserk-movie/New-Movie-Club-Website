export interface LetterboxdMovie {
  id: string; // url slug
  title: string;
  director: string;
  year: number;
  runtime: string;
  genre: string[];
  language: string;
  synopsis: string;
  posterUrl: string;
  backdropUrl: string;
  letterboxdUrl: string;
  trailerUrl?: string;
}

const rawLetterboxdMovies: LetterboxdMovie[] = [
  {
    id: "interstellar",
    title: "Interstellar",
    director: "Christopher Nolan",
    year: 2014,
    runtime: "169 min",
    genre: ["Sci-Fi", "Drama", "Adventure"],
    language: "English (with Subs)",
    synopsis: "The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel and conquer the vast distances involved in an interstellar voyage.",
    posterUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=600&auto=format&fit=crop",
    backdropUrl: "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=1200&auto=format&fit=crop",
    letterboxdUrl: "https://letterboxd.com/film/interstellar/"
  },
  {
    id: "parasite",
    title: "Parasite",
    director: "Bong Joon Ho",
    year: 2019,
    runtime: "132 min",
    genre: ["Thriller", "Drama", "Comedy"],
    language: "Korean (with English Subs)",
    synopsis: "All unemployed, Ki-taek's family takes peculiar interest in the wealthy and glamorous Parks for their livelihood until they get entangled in an unexpected incident.",
    posterUrl: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=600&auto=format&fit=crop",
    backdropUrl: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=1200&auto=format&fit=crop",
    letterboxdUrl: "https://letterboxd.com/film/parasite-2019/"
  },
  {
    id: "everything-everywhere-all-at-once",
    title: "Everything Everywhere All at Once",
    director: "Daniel Kwan, Daniel Scheinert",
    year: 2022,
    runtime: "139 min",
    genre: ["Sci-Fi", "Action", "Comedy", "Drama"],
    language: "English / Chinese (with Subs)",
    synopsis: "An aging Chinese immigrant is swept up in an insane adventure, where she alone can save the world by exploring other universes connecting with the lives she could have led.",
    posterUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=600&auto=format&fit=crop",
    backdropUrl: "https://images.unsplash.com/photo-1461360370896-922624d12aa1?q=80&w=1200&auto=format&fit=crop",
    letterboxdUrl: "https://letterboxd.com/film/everything-everywhere-all-at-once/"
  },
  {
    id: "whiplash",
    title: "Whiplash",
    director: "Damien Chazelle",
    year: 2014,
    runtime: "106 min",
    genre: ["Drama", "Music"],
    language: "English",
    synopsis: "A promising young drummer enrolls at a cut-throat music conservatory where his dreams of greatness are mentored by an instructor who will stop at nothing to realize a student's potential.",
    posterUrl: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=600&auto=format&fit=crop",
    backdropUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop",
    letterboxdUrl: "https://letterboxd.com/film/whiplash/"
  },
  {
    id: "spirited-away",
    title: "Spirited Away",
    director: "Hayao Miyazaki",
    year: 2001,
    runtime: "125 min",
    genre: ["Anime", "Fantasy", "Family"],
    language: "Japanese (with Subs)",
    synopsis: "During her family's move to the suburbs, a sullen 10-year-old girl wanders into a world ruled by gods, witches, and spirits, and where humans are changed into beasts.",
    posterUrl: "https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=600&auto=format&fit=crop",
    backdropUrl: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=1200&auto=format&fit=crop",
    letterboxdUrl: "https://letterboxd.com/film/spirited-away/"
  },
  {
    id: "la-la-land",
    title: "La La Land",
    director: "Damien Chazelle",
    year: 2016,
    runtime: "128 min",
    genre: ["Romance", "Music", "Drama"],
    language: "English",
    synopsis: "While navigating their careers in Los Angeles, a pianist and an actress fall in love while attempting to reconcile their aspirations for the future.",
    posterUrl: "https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=600&auto=format&fit=crop",
    backdropUrl: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=1200&auto=format&fit=crop",
    letterboxdUrl: "https://letterboxd.com/film/la-la-land/"
  },
  {
    id: "dune-part-two",
    title: "Dune: Part Two",
    director: "Denis Villeneuve",
    year: 2024,
    runtime: "166 min",
    genre: ["Sci-Fi", "Adventure", "Action"],
    language: "English (with Subs)",
    synopsis: "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family. Facing a choice between the love of his life and the fate of the universe, he endeavors to prevent a terrible future only he can foresee.",
    posterUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=600&auto=format&fit=crop",
    backdropUrl: "https://images.unsplash.com/photo-1547234935-80c7145ec969?q=80&w=1200&auto=format&fit=crop",
    letterboxdUrl: "https://letterboxd.com/film/dune-part-two/"
  },
  {
    id: "blade-runner-2049",
    title: "Blade Runner 2049",
    director: "Denis Villeneuve",
    year: 2017,
    runtime: "164 min",
    genre: ["Sci-Fi", "Mystery", "Thriller"],
    language: "English",
    synopsis: "A new blade runner, LAPD Officer K, unearths a long-buried secret that has the potential to plunge what's left of society into chaos. K's discovery leads him on a quest to find Rick Deckard, a former LAPD blade runner who has been missing for 30 years.",
    posterUrl: "https://images.unsplash.com/photo-1535223289827-42f1e9919769?q=80&w=600&auto=format&fit=crop",
    backdropUrl: "https://images.unsplash.com/photo-1515621061946-eff1c2a352bd?q=80&w=1200&auto=format&fit=crop",
    letterboxdUrl: "https://letterboxd.com/film/blade-runner-2049/"
  },
  {
    id: "your-name",
    title: "Your Name.",
    director: "Makoto Shinkai",
    year: 2016,
    runtime: "106 min",
    genre: ["Anime", "Fantasy", "Romance"],
    language: "Japanese (with English Subs)",
    synopsis: "Two strangers find themselves linked in a bizarre way. When a connection forms, will distance be the only thing to keep them apart?",
    posterUrl: "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop",
    backdropUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1200&auto=format&fit=crop",
    letterboxdUrl: "https://letterboxd.com/film/your-name/"
  },
  {
    id: "fight-club",
    title: "Fight Club",
    director: "David Fincher",
    year: 1999,
    runtime: "139 min",
    genre: ["Drama", "Thriller"],
    language: "English",
    synopsis: "An insomniac office worker and a devil-may-care soap maker form an underground fight club that evolves into much more.",
    posterUrl: "https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=600&auto=format&fit=crop",
    backdropUrl: "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?q=80&w=1200&auto=format&fit=crop",
    letterboxdUrl: "https://letterboxd.com/film/fight-club/"
  },
  {
    id: "pulp-fiction",
    title: "Pulp Fiction",
    director: "Quentin Tarantino",
    year: 1994,
    runtime: "154 min",
    genre: ["Crime", "Thriller"],
    language: "English",
    synopsis: "The lives of two mob hitmen, a boxer, a gangster and his wife, and a pair of diner bandits intertwine in four tales of violence and redemption.",
    posterUrl: "https://images.unsplash.com/photo-1593085512500-5d55148d6f0d?q=80&w=600&auto=format&fit=crop",
    backdropUrl: "https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?q=80&w=1200&auto=format&fit=crop",
    letterboxdUrl: "https://letterboxd.com/film/pulp-fiction/"
  },
  {
    id: "the-godfather",
    title: "The Godfather",
    director: "Francis Ford Coppola",
    year: 1972,
    runtime: "175 min",
    genre: ["Crime", "Drama"],
    language: "English",
    synopsis: "Spanning the years 1945 to 1955, a chronicle of the fictional Italian-American Corleone crime family. When organized crime family patriarch, Vito Corleone, barely survives an attempt on his life, his youngest son, Michael, steps in to take care of the would-be killers.",
    posterUrl: "https://images.unsplash.com/photo-1508244751656-78b17b621ebd?q=80&w=600&auto=format&fit=crop",
    backdropUrl: "https://images.unsplash.com/photo-1543536448-d209d2d13a1c?q=80&w=1200&auto=format&fit=crop",
    letterboxdUrl: "https://letterboxd.com/film/the-godfather/"
  },
  {
    id: "perfect-blue",
    title: "Perfect Blue",
    director: "Satoshi Kon",
    year: 1997,
    runtime: "81 min",
    genre: ["Anime", "Mystery", "Thriller", "Psychological"],
    language: "Japanese (with English Subs)",
    synopsis: "A retired pop singer turned actress's sense of reality starts to slip away as she is stalked by an obsessed fan and plagued by ghosts of her past.",
    posterUrl: "https://images.unsplash.com/photo-1514306191717-452ec28c7814?q=80&w=600&auto=format&fit=crop",
    backdropUrl: "https://images.unsplash.com/photo-1533157697527-b15441d89251?q=80&w=1200&auto=format&fit=crop",
    letterboxdUrl: "https://letterboxd.com/film/perfect-blue/"
  },
  {
    id: "pather-panchali",
    title: "Pather Panchali",
    director: "Satyajit Ray",
    year: 1955,
    runtime: "115 min",
    genre: ["Drama", "Classics"],
    language: "Bengali (with English Subs)",
    synopsis: "Impatient with his life in a small Bengali village, priest Harihar Ray dreams of a wealthier life in the city, while his wife Sarbojaya raises their children, Apu and Durga, in extreme hardship.",
    posterUrl: "https://images.unsplash.com/photo-1506501139174-099022df5260?q=80&w=600&auto=format&fit=crop",
    backdropUrl: "https://images.unsplash.com/photo-1471874276752-65e2d717604a?q=80&w=1200&auto=format&fit=crop",
    letterboxdUrl: "https://letterboxd.com/film/pather-panchali/"
  },
  {
    id: "metropolis",
    title: "Metropolis",
    director: "Fritz Lang",
    year: 1927,
    runtime: "153 min",
    genre: ["Sci-Fi", "Drama", "German Expressionism"],
    language: "Silent (with English Intertitles)",
    synopsis: "In a futuristic city sharply divided between the working class and the city planners, the son of the city's mastermind falls in love with a working class prophet, who predicts the coming of a savior to mediate their differences.",
    posterUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=600&auto=format&fit=crop",
    backdropUrl: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=1200&auto=format&fit=crop",
    letterboxdUrl: "https://letterboxd.com/film/metropolis/"
  },
  {
    id: "the-zone-of-interest",
    title: "The Zone of Interest",
    director: "Jonathan Glazer",
    year: 2023,
    runtime: "105 min",
    genre: ["Drama", "History", "War"],
    language: "German / Polish (with English Subs)",
    synopsis: "The commandant of Auschwitz, Rudolf Höss, and his wife Hedwig, strive to build a dream life for their family in a house and garden next to the camp.",
    posterUrl: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?q=80&w=600&auto=format&fit=crop",
    backdropUrl: "https://images.unsplash.com/photo-1505830495833-476b7b125019?q=80&w=1200&auto=format&fit=crop",
    letterboxdUrl: "https://letterboxd.com/film/the-zone-of-interest/"
  },
  {
    id: "arrival",
    title: "Arrival",
    director: "Denis Villeneuve",
    year: 2016,
    runtime: "116 min",
    genre: ["Sci-Fi", "Mystery", "Drama"],
    language: "English",
    synopsis: "Taking place after mysterious spacecraft touch down across the globe, an elite team, led by translation expert Louise Banks, is brought together to investigate.",
    posterUrl: "https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?q=80&w=600&auto=format&fit=crop",
    backdropUrl: "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1200&auto=format&fit=crop",
    letterboxdUrl: "https://letterboxd.com/film/arrival-2016/"
  },
  {
    id: "in-the-mood-for-love",
    title: "In the Mood for Love",
    director: "Wong Kar-wai",
    year: 2000,
    runtime: "98 min",
    genre: ["Drama", "Romance", "Arthouse"],
    language: "Cantonese (with English Subs)",
    synopsis: "Two neighbors form a strong bond after they suspect extramarital activities of their respective spouses. However, they agree to keep their bond platonic so as not to commit the same wrongs.",
    posterUrl: "https://images.unsplash.com/photo-1513151233558-d860c5398176?q=80&w=600&auto=format&fit=crop",
    backdropUrl: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=1200&auto=format&fit=crop",
    letterboxdUrl: "https://letterboxd.com/film/in-the-mood-for-love/"
  },
  {
    id: "stalker",
    title: "Stalker",
    director: "Andrei Tarkovsky",
    year: 1979,
    runtime: "162 min",
    genre: ["Sci-Fi", "Drama", "Philosophy"],
    language: "Russian (with English Subs)",
    synopsis: "An expedition led by a 'Stalker' guides a writer and a scientist through a mysterious, post-apocalyptic wasteland known as the 'Zone' to find a Room that grants your deepest desires.",
    posterUrl: "https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=600&auto=format&fit=crop",
    backdropUrl: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=1200&auto=format&fit=crop",
    letterboxdUrl: "https://letterboxd.com/film/stalker/"
  },
  {
    id: "mononoke-hime",
    title: "Princess Mononoke",
    director: "Hayao Miyazaki",
    year: 1997,
    runtime: "134 min",
    genre: ["Anime", "Fantasy", "Adventure"],
    language: "Japanese (with English Subs)",
    synopsis: "Ashitaka, a prince of the disappearing Emishi people, is cursed by a demonized boar god and must travel to the West to find a cure, finding himself in the middle of a conflict between forest gods and humans.",
    posterUrl: "https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=600&auto=format&fit=crop",
    backdropUrl: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?q=80&w=1200&auto=format&fit=crop",
    letterboxdUrl: "https://letterboxd.com/film/princess-mononoke/"
  },
  {
    id: "past-lives",
    title: "Past Lives",
    director: "Celine Song",
    year: 2023,
    runtime: "105 min",
    genre: ["Drama", "Romance"],
    language: "English / Korean (with English Subs)",
    synopsis: "Nora and Hae Sung, two deeply connected childhood friends, are wrest apart after Nora's family migrates from South Korea. Two decades later, they are reunited in New York for one fateful week as they confront notions of destiny, love, and the choices that make a life.",
    posterUrl: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?q=80&w=600&auto=format&fit=crop",
    backdropUrl: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1200&auto=format&fit=crop",
    letterboxdUrl: "https://letterboxd.com/film/past-lives/"
  },
  {
    id: "shutter-island",
    title: "Shutter Island",
    director: "Martin Scorsese",
    year: 2010,
    runtime: "138 min",
    genre: ["Mystery", "Thriller", "Drama"],
    language: "English",
    synopsis: "In 1954, a U.S. Marshal investigates the disappearance of a murderer who escaped from a hospital for the criminally insane.",
    posterUrl: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?q=80&w=600&auto=format&fit=crop",
    backdropUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop",
    letterboxdUrl: "https://letterboxd.com/film/shutter-island/"
  },
  {
    id: "se7en",
    title: "Se7en",
    director: "David Fincher",
    year: 1995,
    runtime: "127 min",
    genre: ["Crime", "Mystery", "Thriller"],
    language: "English",
    synopsis: "Two detectives, a rookie and a veteran, hunt a serial killer who uses the seven deadly sins as his motives.",
    posterUrl: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?q=80&w=600&auto=format&fit=crop",
    backdropUrl: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?q=80&w=1200&auto=format&fit=crop",
    letterboxdUrl: "https://letterboxd.com/film/seven/"
  },
  {
    id: "inception",
    title: "Inception",
    director: "Christopher Nolan",
    year: 2010,
    runtime: "148 min",
    genre: ["Sci-Fi", "Action", "Thriller"],
    language: "English",
    synopsis: "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O., but his tragic past may doom the project.",
    posterUrl: "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop",
    backdropUrl: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1200&auto=format&fit=crop",
    letterboxdUrl: "https://letterboxd.com/film/inception/"
  }
];

const realMoviePosters: Record<string, string> = {
  "interstellar": "https://upload.wikimedia.org/wikipedia/en/b/bc/Interstellar_film_poster.jpg",
  "parasite": "https://upload.wikimedia.org/wikipedia/en/5/53/Parasite_%282019_film%29_poster.gif",
  "everything-everywhere-all-at-once": "https://upload.wikimedia.org/wikipedia/en/1/11/Everything_Everywhere_All_at_Once.png",
  "whiplash": "https://upload.wikimedia.org/wikipedia/en/0/01/Whiplash_poster.jpg",
  "spirited-away": "https://upload.wikimedia.org/wikipedia/en/d/db/Spirited_Away_Japanese_poster.png",
  "la-la-land": "https://upload.wikimedia.org/wikipedia/en/a/ab/La_La_Land_%28film%29.png",
  "dune-part-two": "https://upload.wikimedia.org/wikipedia/en/5/52/Dune_Part_Two_poster.jpeg",
  "blade-runner-2049": "https://upload.wikimedia.org/wikipedia/en/9/9b/Blade_Runner_2049_poster.png",
  "your-name": "https://upload.wikimedia.org/wikipedia/en/0/0b/Your_Name_poster.png",
  "fight-club": "https://upload.wikimedia.org/wikipedia/en/f/fc/Fight_Club_poster.jpg",
  "pulp-fiction": "https://upload.wikimedia.org/wikipedia/en/3/3d/Pulp_Fiction_cover.jpg",
  "the-godfather": "https://upload.wikimedia.org/wikipedia/en/1/1c/The_Godfather_poster.jpg",
  "perfect-blue": "https://upload.wikimedia.org/wikipedia/en/c/cb/Perfect_blue_poster.png",
  "pather-panchali": "https://upload.wikimedia.org/wikipedia/en/7/74/Pather_Panchali_1955_Poster.jpg",
  "metropolis": "https://upload.wikimedia.org/wikipedia/commons/9/97/Metropolis_poster_German_Expressionism_silent_film.jpg",
  "the-zone-of-interest": "https://upload.wikimedia.org/wikipedia/en/d/d4/The_Zone_of_Interest_poster.jpeg",
  "arrival": "https://upload.wikimedia.org/wikipedia/en/d/df/Arrival_film_poster.jpg",
  "in-the-mood-for-love": "https://upload.wikimedia.org/wikipedia/en/f/fa/In_the_Mood_for_Love_poster.jpg",
  "stalker": "https://upload.wikimedia.org/wikipedia/en/d/d4/Stalker_poster.jpg",
  "mononoke-hime": "https://upload.wikimedia.org/wikipedia/en/2/22/Princess_Mononoke_theatrical_poster.png",
  "past-lives": "https://upload.wikimedia.org/wikipedia/en/4/41/Past_Lives_poster.jpeg",
  "shutter-island": "https://upload.wikimedia.org/wikipedia/en/7/76/Shutter_island_poster.jpg",
  "se7en": "https://upload.wikimedia.org/wikipedia/en/6/68/Seven_deadly_sins_poster.jpg",
  "inception": "https://upload.wikimedia.org/wikipedia/en/2/2e/Inception_%282010%29_theatrical_poster.jpg",
  "spider-man-into-the-spider-verse": "https://upload.wikimedia.org/wikipedia/en/0/02/Spider-Man_Into_the_Spider-Verse_poster.png",
  "the-dark-knight": "https://upload.wikimedia.org/wikipedia/en/1/1c/The_Dark_Knight_%282008_film%29_poster.jpg"
};

export const DISTINCT_FALLBACK_POSTERS = [
  "https://upload.wikimedia.org/wikipedia/en/b/bc/Interstellar_film_poster.jpg",
  "https://upload.wikimedia.org/wikipedia/en/5/53/Parasite_%282019_film%29_poster.jpg",
  "https://upload.wikimedia.org/wikipedia/en/1/11/Everything_Everywhere_All_at_Once.png",
  "https://upload.wikimedia.org/wikipedia/en/0/01/Whiplash_poster.jpg",
  "https://upload.wikimedia.org/wikipedia/en/d/db/Spirited_Away_Japanese_poster.png",
  "https://upload.wikimedia.org/wikipedia/en/a/ab/La_La_Land_%28film%29.png",
  "https://upload.wikimedia.org/wikipedia/en/5/52/Dune_Part_Two_poster.jpeg",
  "https://upload.wikimedia.org/wikipedia/en/9/9b/Blade_Runner_2049_poster.png",
  "https://upload.wikimedia.org/wikipedia/en/0/0b/Your_Name_poster.png",
  "https://upload.wikimedia.org/wikipedia/en/f/fc/Fight_Club_poster.jpg",
  "https://upload.wikimedia.org/wikipedia/en/3/3d/Pulp_Fiction_cover.jpg",
  "https://upload.wikimedia.org/wikipedia/en/1/1c/The_Godfather_poster.jpg",
  "https://upload.wikimedia.org/wikipedia/en/c/cb/Perfect_blue_poster.png",
  "https://upload.wikimedia.org/wikipedia/en/7/74/Pather_Panchali_1955_Poster.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/9/97/Metropolis_poster_German_Expressionism_silent_film.jpg",
  "https://upload.wikimedia.org/wikipedia/en/d/d4/The_Zone_of_Interest_poster.jpeg",
  "https://upload.wikimedia.org/wikipedia/en/d/df/Arrival_film_poster.jpg",
  "https://upload.wikimedia.org/wikipedia/en/f/fa/In_the_Mood_for_Love_poster.jpg",
  "https://upload.wikimedia.org/wikipedia/en/d/d4/Stalker_poster.jpg",
  "https://upload.wikimedia.org/wikipedia/en/2/22/Princess_Mononoke_theatrical_poster.png",
  "https://upload.wikimedia.org/wikipedia/en/4/41/Past_Lives_poster.jpeg",
  "https://upload.wikimedia.org/wikipedia/en/7/76/Shutter_island_poster.jpg",
  "https://upload.wikimedia.org/wikipedia/en/6/68/Seven_deadly_sins_poster.jpg",
  "https://upload.wikimedia.org/wikipedia/en/2/2e/Inception_%282010%29_theatrical_poster.jpg",
  "https://upload.wikimedia.org/wikipedia/en/0/02/Spider-Man_Into_the_Spider-Verse_poster.png",
  "https://upload.wikimedia.org/wikipedia/en/1/1c/The_Dark_Knight_%282008_film%29_poster.jpg",
  "https://upload.wikimedia.org/wikipedia/en/3/3b/Chungking_Express_poster.jpg",
  "https://upload.wikimedia.org/wikipedia/en/7/75/Akira_poster.jpg",
  "https://upload.wikimedia.org/wikipedia/en/6/69/Oldboy_2003_poster.jpg",
  "https://upload.wikimedia.org/wikipedia/en/8/8e/Drive2011Poster.jpg",
  "https://upload.wikimedia.org/wikipedia/en/0/00/The_Grand_Budapest_Hotel.jpg",
  "https://upload.wikimedia.org/wikipedia/en/7/70/Portrait_of_a_Lady_on_Fire_poster.jpg",
  "https://upload.wikimedia.org/wikipedia/en/0/00/Mulholland_Drive_%28poster%29.jpg",
  "https://upload.wikimedia.org/wikipedia/en/5/53/Amelie_poster.jpg",
  "https://upload.wikimedia.org/wikipedia/en/3/33/Taxi_Driver_%281976_film_poster%29.jpg",
  "https://upload.wikimedia.org/wikipedia/en/9/93/Eternal_Sunshine_of_the_Spotless_Mind.png",
  "https://upload.wikimedia.org/wikipedia/en/9/9f/Matrix_poster.jpg",
  "https://upload.wikimedia.org/wikipedia/en/c/c1/The_Shining_%281980%29_U.K._release_poster.jpg",
  "https://upload.wikimedia.org/wikipedia/en/c/c0/Psycho_%281960%29_theatrical_poster.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/c/c0/CasablancaPoster-root.jpg",
  "https://upload.wikimedia.org/wikipedia/en/c/c3/Alien_movie_poster.jpg",
  "https://upload.wikimedia.org/wikipedia/en/1/18/Seven_Samurai_poster.jpg",
  "https://upload.wikimedia.org/wikipedia/en/4/48/Goodfellas.jpg",
  "https://upload.wikimedia.org/wikipedia/en/7/70/Ran_poster.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/b/ba/Citizen_Kane_poster_%281941%29.jpg",
  "https://upload.wikimedia.org/wikipedia/en/c/c2/Modern_Times_poster.jpg"
];

export function getDeterministicPoster(identifier: string): string {
  if (!identifier) return DISTINCT_FALLBACK_POSTERS[0];
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = (hash << 5) - hash + identifier.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % DISTINCT_FALLBACK_POSTERS.length;
  return DISTINCT_FALLBACK_POSTERS[index];
}

export const letterboxdMovies: LetterboxdMovie[] = rawLetterboxdMovies.map(movie => {
  const realUrl = realMoviePosters[movie.id];
  if (realUrl) {
    return {
      ...movie,
      posterUrl: realUrl
    };
  }
  return movie;
});

export function findMovieByUrlOrSlug(input: string): LetterboxdMovie | null {
  const normalized = input.toLowerCase().trim();
  
  // Try to parse out the slug from a full Letterboxd URL if present
  // e.g., https://letterboxd.com/film/everything-everywhere-all-at-once/ -> everything-everywhere-all-at-once
  let slug = normalized;
  try {
    if (normalized.includes("letterboxd.com/film/")) {
      const parts = normalized.split("letterboxd.com/film/");
      if (parts[1]) {
        slug = parts[1].split("/")[0];
      }
    }
  } catch (e) {
    // Fall back to original input
  }

  // Exact matches
  const match = letterboxdMovies.find(m => m.id === slug || m.title.toLowerCase() === normalized);
  if (match) return match;

  // Fuzzy matches
  const fuzzyMatch = letterboxdMovies.find(m => 
    m.title.toLowerCase().includes(normalized) || 
    normalized.includes(m.id)
  );
  return fuzzyMatch || null;
}

export function parseLetterboxdUrlToMovie(url: string): { title: string; slug: string; year: number } {
  let title = "Custom Movie";
  let slug = "custom-movie";
  let year = new Date().getFullYear() - 1;

  try {
    const cleanUrl = url.trim().replace(/\/$/, ""); // Strip trailing slash
    const parts = cleanUrl.split("/film/");
    if (parts[1]) {
      slug = parts[1].split("/")[0];
      
      // Attempt to clean the slug into a human-readable title
      // e.g. everything-everywhere-all-at-once -> Everything Everywhere All At Once
      // e.g. parasite-2019 -> Parasite
      let words = slug.split("-");
      
      // If last word is a 4-digit number, treat it as the year
      const lastWord = words[words.length - 1];
      if (/^\d{4}$/.test(lastWord)) {
        year = parseInt(lastWord);
        words = words.slice(0, words.length - 1);
      }
      
      title = words
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
  } catch (e) {
    // ignore
  }

  return { title, slug, year };
}

export function getPolishedPosterUrl(title: string, currentPosterUrl?: string): string {
  const url = currentPosterUrl?.trim() || '';
  const isGeneric = !url || url.includes('images.unsplash.com') || url.includes('photo-1489599849927');

  if (!isGeneric) {
    return url;
  }

  if (title) {
    const cleanTitle = title.toLowerCase().trim();
    // Match by exact title, stripped title, or slug substring
    const match = letterboxdMovies.find(m => 
      m.title.toLowerCase().trim() === cleanTitle ||
      m.title.toLowerCase().trim().replace(/[^a-z0-9]/g, '') === cleanTitle.replace(/[^a-z0-9]/g, '') ||
      cleanTitle.includes(m.id) ||
      m.id.includes(cleanTitle.replace(/\s+/g, '-'))
    );
    if (match && match.posterUrl && !match.posterUrl.includes('images.unsplash.com')) {
      return match.posterUrl;
    }
  }

  return getDeterministicPoster(title);
}
