export interface Screening {
  id: string;
  title: string;
  director: string;
  year: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  venue: string; // e.g. "LHC G-06" or "Auditorium"
  description: string;
  posterUrl: string;
  backdropUrl?: string;
  runtime: string;
  genre: string[];
  language: string;
  trailerUrl?: string; // e.g. youtube link
  screenedByClub?: boolean;
}

export interface PastMovie {
  id: string;
  title: string;
  director: string;
  year: number;
  screenedDate: string; // YYYY-MM-DD
  rating: number; // 0-5
  letterboxdUrl: string;
  posterUrl: string;
  synopsis: string;
  genre: string[];
  reviews: UserReview[];
}

export interface UserReview {
  id: string;
  userEmail: string;
  userName: string;
  rating: number; // 1-5
  comment: string;
  createdAt: string;
}

export interface Recommendation {
  id: string;
  title: string;
  director: string;
  year: number;
  genre: string;
  notes: string;
  suggestedBy: string; // email of student
  suggestedByName: string; // calculated from email
  suggestedAt: string;
  votes: string[]; // array of student emails who upvoted
  posterUrl?: string;
}

export interface User {
  uid?: string;
  email: string;
  name: string;
  role: 'admin' | 'student';
  photoURL?: string;
  lastActive?: string;
}

export interface TriviaQuestion {
  id: string;
  question: string;
  options: string[];
  answer: number; // Index of correct option
  explanation: string;
}

export interface DiscussionComment {
  id: string;
  authorEmail: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface ClubDiscussion {
  id: string;
  title: string;
  movieTitle?: string;
  movieSlug?: string;
  category: 'Review' | 'Discussion' | 'Theory' | 'Question' | 'Event';
  content: string;
  rating?: number | null; // For reviews (1-5)
  authorEmail: string;
  authorName: string;
  createdAt: string;
  votes: string[]; // List of student emails who liked/upvoted
  comments: DiscussionComment[];
}

export interface PollMovieOption {
  id: string;
  title: string;
  director: string;
  year: number;
  genre: string;
  synopsis: string;
  posterUrl?: string;
  votes: string[]; // List of user emails who voted for this option
}

export interface Poll {
  id: string;
  question: string;
  description?: string;
  startsAt: string; // ISO string timestamp
  closesAt: string; // ISO string timestamp
  createdAt: string; // ISO string timestamp
  options: PollMovieOption[];
  createdBy: string; // admin email
}

