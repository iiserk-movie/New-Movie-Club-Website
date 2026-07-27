import { Screening, PastMovie, Recommendation, TriviaQuestion, ClubDiscussion } from './types';

// Let's populate with realistic cinematic entries fit for an institute of scientific and creative minds (IISER Kolkata)
export const initialScreenings: Screening[] = [
  {
    id: 's-1',
    title: '2001: A Space Odyssey',
    director: 'Stanley Kubrick',
    year: 1968,
    date: '2026-06-19',
    time: '18:30',
    venue: 'MND Auditorium',
    description: 'After discovering a mysterious artifact buried beneath the Lunar surface, mankind sets off on a quest to find its origins with the help of H.A.L. 9000, a sentient supercomputer.',
    posterUrl: 'https://upload.wikimedia.org/wikipedia/en/a/a2/2001_A_Space_Odyssey_Poster.jpg', // 2001 Space Odyssey official poster
    backdropUrl: 'https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?q=80&w=1200&auto=format&fit=crop',
    runtime: '149 min',
    genre: ['Sci-Fi', 'Adventure', 'Mystery'],
    language: 'English (with Subs)',
    trailerUrl: 'https://www.youtube.com/watch?v=oR_e9y-bka0'
  },
  {
    id: 's-2',
    title: 'Tumbbad',
    director: 'Rahi Anil Barve',
    year: 2018,
    date: '2026-06-26',
    time: '19:00',
    venue: 'M.N. Saha Auditorium, Ground Floor, TRC building',
    description: 'A mythological story about a goddess who created the entire universe and her first-born son, Hastar, a monster who wants to consume all the gold and grain. A family built a shrine for Hastar, which brings about a terrible curse.',
    posterUrl: 'https://upload.wikimedia.org/wikipedia/en/3/38/Tumbbad_poster.jpg', // Tumbbad official poster
    backdropUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop',
    runtime: '104 min',
    genre: ['Horror', 'Fantasy', 'Drama'],
    language: 'Hindi (with English Subs)',
    trailerUrl: 'https://www.youtube.com/watch?v=sN7AtarS24E'
  },
  {
    id: 's-3',
    title: 'Perfect Days',
    director: 'Wim Wenders',
    year: 2023,
    date: '2026-07-03',
    time: '18:00',
    venue: 'LHC G-02 Lecture Room',
    description: 'Hirayama seems utterly content with his simple life as a cleaner of toilets in Tokyo. Outside of his very structured everyday routine he enjoys his passion for music and for books. And he loves trees and takes photos of them.',
    posterUrl: 'https://upload.wikimedia.org/wikipedia/en/4/4b/Perfect_Days_poster.jpeg', // Perfect Days official poster fallback
    backdropUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?q=80&w=1200&auto=format&fit=crop',
    runtime: '124 min',
    genre: ['Drama'],
    language: 'Japanese (with English Subs)',
    trailerUrl: 'https://www.youtube.com/watch?v=48S43cE0Kz8'
  }
];

export const initialPastMovies: PastMovie[] = [
  {
    id: 'p-1',
    title: 'Oppenheimer',
    director: 'Christopher Nolan',
    year: 2023,
    screenedDate: '2026-05-18',
    rating: 4.8,
    letterboxdUrl: 'https://letterboxd.com/film/oppenheimer-2023/',
    posterUrl: 'https://upload.wikimedia.org/wikipedia/en/8/8a/Oppenheimer_%28film%29.jpg', // Oppenheimer official poster
    synopsis: 'The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb during World War II.',
    genre: ['Biography', 'Drama', 'History'],
    reviews: [
      {
        id: 'r-1',
        userEmail: 'arindam.phys@iiserkol.ac.in',
        userName: 'Arindam Ghosh',
        rating: 5,
        comment: 'As a physics student, this is a spectacular piece of historical realism. The sound design during the Trinity test absolute silence, then the shockwave was stunning.',
        createdAt: '2026-05-18T22:15:00Z'
      },
      {
        id: 'r-2',
        userEmail: 'soham.bio@iiserkol.ac.in',
        userName: 'Soham Mukherjee',
        rating: 4,
        comment: 'Brilliant editing. Nolan somehow made three hours of men talking in chalky rooms feel like an edge-of-your-seat thriller.',
        createdAt: '2026-05-19T09:30:00Z'
      }
    ]
  },
  {
    id: 'p-2',
    title: 'Stalker',
    director: 'Andrei Tarkovsky',
    year: 1979,
    screenedDate: '2026-04-24',
    rating: 4.7,
    letterboxdUrl: 'https://letterboxd.com/film/stalker/',
    posterUrl: 'https://upload.wikimedia.org/wikipedia/en/d/d4/Stalker_poster.jpg', // Stalker official poster
    synopsis: 'An expedition led by a "Stalker" guides a writer and a scientist through a mysterious, post-apocalyptic wasteland known as the "Zone" to find a Room that grants your deepest desires.',
    genre: ['Sci-Fi', 'Drama', 'Art-House'],
    reviews: [
      {
        id: 'r-3',
        userEmail: 'aditi.chem@iiserkol.ac.in',
        userName: 'Aditi Sharma',
        rating: 5,
        comment: 'Philosophical masterpiece! The long shots let us sit with the characters’ existential dread. Unforgettable soundscape.',
        createdAt: '2026-04-24T23:05:00Z'
      }
    ]
  },
  {
    id: 'p-3',
    title: 'In the Mood for Love',
    director: 'Wong Kar-wai',
    year: 2000,
    screenedDate: '2026-03-12',
    rating: 4.9,
    letterboxdUrl: 'https://letterboxd.com/film/in-the-mood-for-love/',
    posterUrl: 'https://upload.wikimedia.org/wikipedia/en/f/fa/In_the_Mood_for_Love_poster.jpg', // In the Mood for Love official poster
    synopsis: 'Two neighbors, a woman and a man, form a strong bond after both suspect extramarital activities of their respective spouses. However, they agree to keep things platonic.',
    genre: ['Drama', 'Romance'],
    reviews: [
      {
        id: 'r-4',
        userEmail: 'poulami.chem@iiserkol.ac.in',
        userName: 'Poulami Das',
        rating: 5,
        comment: 'The color grading, the cheongsams, the melancholic Yumeji’s Theme on loop! Absolute poetry in frame.',
        createdAt: '2026-03-12T22:30:00Z'
      }
    ]
  },
  {
    id: 'p-4',
    title: 'Spider-Man: Into the Spider-Verse',
    director: 'B. Persichetti, P. Ramsey',
    year: 2018,
    screenedDate: '2026-02-14',
    rating: 4.6,
    letterboxdUrl: 'https://letterboxd.com/film/spider-man-into-the-spider-verse/',
    posterUrl: 'https://upload.wikimedia.org/wikipedia/en/0/02/Spider-Man_Into_the_Spider-Verse_poster.png', // Spider-Verse official poster
    synopsis: 'Teen Miles Morales becomes the Spider-Man of his universe, and must join with five spider-powered individuals from other dimensions to stop a threat for all realities.',
    genre: ['Animation', 'Action', 'Sci-Fi'],
    reviews: [
      {
        id: 'r-5',
        userEmail: 'rohit.math@iiserkol.ac.in',
        userName: 'Rohit Sen',
        rating: 5,
        comment: 'Revolutionary animation design. Feels like stepping inside a living comic book. The framing, frame rates, and halftone mapping are genius.',
        createdAt: '2026-02-14T21:10:00Z'
      }
    ]
  }
];

export const initialRecommendations: Recommendation[] = [
  {
    id: 'rec-1',
    title: 'The Zone of Interest',
    director: 'Jonathan Glazer',
    year: 2023,
    genre: 'Drama/History',
    notes: 'The banality of evil shown through pristine sound design. A chilling look at human compartmentalization. Excellent discussion fuel for the club!',
    suggestedBy: 'ritoban.chem@iiserkol.ac.in',
    suggestedByName: 'Ritoban Roy',
    suggestedAt: '2026-06-12T14:24:00Z',
    votes: ['arindam.phys@iiserkol.ac.in', 'soham.bio@iiserkol.ac.in'],
    posterUrl: 'https://upload.wikimedia.org/wikipedia/en/d/d4/The_Zone_of_Interest_poster.jpeg'
  },
  {
    id: 'rec-2',
    title: 'Arrival',
    director: 'Denis Villeneuve',
    year: 2016,
    genre: 'Sci-Fi/Mystery',
    notes: 'Based on Ted Chiang’s Story of Your Life. Explores Sapir-Whorf hypothesis, linguistic relativity, and grand mathematical/geometric concepts of time. Perfect choice for IISER folks!',
    suggestedBy: 'priya.math@iiserkol.ac.in',
    suggestedByName: 'Priya Banerjee',
    suggestedAt: '2026-06-13T10:15:00Z',
    votes: ['arindam.phys@iiserkol.ac.in'],
    posterUrl: 'https://upload.wikimedia.org/wikipedia/en/d/df/Arrival_film_poster.jpg'
  }
];

export const triviaQuestions: TriviaQuestion[] = [
  {
    id: 'q-1',
    question: 'In Christopher Nolan’s Oppenheimer, who did Robert Oppenheimer poison with an injected apple, only to change his mind the next morning?',
    options: ['Patrick Blackett', 'Ernest Lawrence', 'Niels Bohr', 'Luis Alvarez'],
    answer: 0,
    explanation: 'Oppenheimer injected Patrick Blackett’s apple with potassium cyanide due to an academic dispute, before rushing in the next day to prevent Niels Bohr from eating it.'
  },
  {
    id: 'q-2',
    question: 'Which Andrei Tarkovsky movie was filmed near actual abandoned hydro-electric power plants in Estonia, giving it its iconic post-industrial septic green look?',
    options: ['Solaris', 'The Mirror', 'Stalker', 'Nostalghia'],
    answer: 2,
    explanation: 'Stalker’s exterior scenes in the "Zone" were filmed around several retired hydro-electric power plants in Tallinn, Estonia, giving the film its stark authentic texture.'
  },
  {
    id: 'q-3',
    question: 'In Stanley Kubrick’s 2001: A Space Odyssey, what is the designation/name of the spacecraft carrying Dr. David Bowman and Dr. Frank Poole to Jupiter?',
    options: ['Hermes II', 'Discovery One', 'Aries IB', 'Odyssey Prime'],
    answer: 1,
    explanation: 'The USSC Discovery One (XD-1) is the nuclear-powered interplanetary spacecraft that carries the crew and the HAL 9000 supercomputer to Jupiter.'
  }
];

export const initialDiscussions: ClubDiscussion[] = [
  {
    id: 'disc-1',
    title: "Tarkovsky's Stalker: Exploring the Metaphysical Zone",
    movieTitle: "Stalker",
    movieSlug: "stalker",
    category: "Theory",
    content: "Yesterday's screening of Stalker left me absolutely speechless. The transition from the sepia-toned 'real world' to the lush, vibrant, septic green of the Zone is one of the most stunning cinematic devices ever conceived.\n\nWhat is the Zone? Is it a physical manifestation of our hidden subconscious, or does it represent something divine that cannot be rationalized? The way the characters (the Writer and the Scientist) represent different wings of human intellect confronting their primary desires is incredibly deep.\n\nI'd love to hear how other IISER students interpret the room at the center of the Zone. What is your 'deepest desire' that you think the Room would manifest?",
    rating: 5,
    authorEmail: "aditi.chem@iiserkol.ac.in",
    authorName: "Aditi Sharma",
    createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(), // 3 days ago
    votes: ["soham.bio@iiserkol.ac.in", "arindam.phys@iiserkol.ac.in"],
    comments: [
      {
        id: "c-1",
        authorEmail: "arindam.phys@iiserkol.ac.in",
        authorName: "Arindam Ghosh",
        content: "Excellent analysis, Aditi! As a physics student, I interpret the Zone's unpredictability as a macro-scale quantum system where the act of observation (or intent) directly modifies the physical paths. You cannot cross directly; you have to throw metal nuts wrapped in bandage to test state probability.",
        createdAt: new Date(Date.now() - 3600000 * 24 * 2.5).toISOString()
      },
      {
        id: "c-2",
        authorEmail: "soham.bio@iiserkol.ac.in",
        authorName: "Soham Mukherjee",
        content: "Adding to that, the Room itself is a mirror. It doesn't give you what you *say* you want, but what your deepest, primal self actually desires (like Porcupine's tragic realization). That's why they ultimately fear entering.",
        createdAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString()
      }
    ]
  },
  {
    id: 'disc-2',
    title: "Perfect Days: Finding Zen in Komorebi",
    movieTitle: "Perfect Days",
    movieSlug: "perfect-days",
    category: "Review",
    content: "Wim Wenders has crafted a work of supreme beauty. Perfect Days (2023) is a silent protest against digital overdrive and modern hyper-productivity.\n\nHirayama teaches us the art of mindfulness. The repetition of his chores (cleaning Tokyo public toilets with absolute precision), his devotion to physical cassette music, and his analog photos of komorebi (the sunlight filtering through leaves) are magnificent.\n\nThis film is a warm blanket of comfort for those days when you feel overwhelmed by research papers and exams. Highly recommended!",
    rating: 5,
    authorEmail: "soham.bio@iiserkol.ac.in",
    authorName: "Soham Mukherjee",
    createdAt: new Date(Date.now() - 3600000 * 24 * 1).toISOString(), // 1 day ago
    votes: ["aditi.chem@iiserkol.ac.in", "poulami.chem@iiserkol.ac.in"],
    comments: []
  }
];

