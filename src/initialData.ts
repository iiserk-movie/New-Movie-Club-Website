import { Screening, PastMovie, Recommendation, TriviaQuestion, ClubDiscussion } from './types';

// Initial dataset for IISER Kolkata Movie Club
export const initialScreenings: Screening[] = [];

export const initialPastMovies: PastMovie[] = [
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
    question: 'In Wong Kar-wai’s In the Mood for Love, where does Chow Mo-wan whisper his secret into a hollow in the wall before sealing it with mud?',
    options: ['Angkor Wat', 'Forbidden City', 'Borobudur', 'Victoria Peak'],
    answer: 0,
    explanation: 'In the final sequence, Chow Mo-wan travels to the ancient temple complex of Angkor Wat in Cambodia to whisper his untold secret into a hollow stone wall.'
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
    question: 'In Satyajit Ray’s landmark classic Pather Panchali (1955), who composed the legendary sitar and flute musical score?',
    options: ['Pandit Ravi Shankar', 'Ustad Ali Akbar Khan', 'Salil Chowdhury', 'Vilayat Khan'],
    answer: 0,
    explanation: 'Pandit Ravi Shankar composed the seminal classical score for Pather Panchali in a marathon eleven-hour recording session.'
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
  }
];
