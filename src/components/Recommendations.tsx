import React, { useState } from 'react';
import { 
  Plus, MessageSquareHeart, Search, ArrowUp, ThumbsUp, Calendar, 
  Filter, Sparkles, User, HelpCircle, Film, BookOpen, AlertCircle, Link2, Upload, Pencil, Star
} from 'lucide-react';
import { motion } from 'motion/react';
import { Recommendation } from '../types';
import { letterboxdMovies, LetterboxdMovie, findMovieByUrlOrSlug, parseLetterboxdUrlToMovie, getPolishedPosterUrl } from '../letterboxdDb';
import { compressAndResizeImage } from '../utils/imageCompressor';

interface RecommendationsProps {
  recommendations: Recommendation[];
  currentUser: { email: string; name: string; role: 'admin' | 'student' } | null;
  adminMode?: boolean;
  onAddRecommendation: (rec: Omit<Recommendation, 'id' | 'suggestedBy' | 'suggestedByName' | 'suggestedAt' | 'votes'>) => any;
  onVoteRecommendation: (id: string, userEmail: string) => void;
  onUpdateRecommendation?: (id: string, updatedFields: Partial<Recommendation>) => void;
  onMarkScreened?: (rec: Recommendation, date: string, rating: number) => void;
}

export default function Recommendations({
  recommendations,
  currentUser,
  adminMode,
  onAddRecommendation,
  onVoteRecommendation,
  onUpdateRecommendation,
  onMarkScreened
}: RecommendationsProps) {
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'votes' | 'newest'>('votes');

  // Submit Form States
  const [title, setTitle] = useState('');
  const [director, setDirector] = useState('');
  const [year, setYear] = useState<number>(2024);
  const [genre, setGenre] = useState('Sci-Fi/Drama');
  const [notes, setNotes] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Additional states for editing suggestions and marking as screened
  const [editingId, setEditingId] = useState<string | null>(null);
  const [screeningToMark, setScreeningToMark] = useState<Recommendation | null>(null);
  const [screenDate, setScreenDate] = useState(new Date().toISOString().split('T')[0]);
  const [screenRating, setScreenRating] = useState<number>(4.5);

  // Poster image file upload
  const [posterFileError, setPosterFileError] = useState('');
  const [isPosterCompressing, setIsPosterCompressing] = useState(false);

  const handlePosterFileUpload = async (file: File) => {
    setPosterFileError('');
    if (!file.type.startsWith('image/')) {
      setPosterFileError('Please select a valid image file (PNG, JPG, WebP, SVG).');
      return;
    }

    setIsPosterCompressing(true);
    try {
      // Compress to optimal dimensions (350x500px, quality 0.7)
      const compressedB64 = await compressAndResizeImage(file, 350, 500, 0.7);
      setPosterUrl(compressedB64);
      setSelectedMovie(null);
    } catch (err) {
      console.error(err);
      setPosterFileError('Failed to process and compress uploaded image.');
    } finally {
      setIsPosterCompressing(false);
    }
  };

  // AI loading and error states
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const fetchAiMovieDetails = async () => {
    const query = title.trim();
    if (!query) {
      setAiError('Please enter a film title first to fetch details.');
      return;
    }
    setIsAiLoading(true);
    setAiError('');
    try {
      const res = await fetch('/api/movie-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ movieQuery: query }),
      });
      if (!res.ok) {
        throw new Error('Could not fetch movie details. Please try again.');
      }
      const data = await res.json();
      if (data.title) setTitle(data.title);
      if (data.director) setDirector(data.director);
      if (data.year) setYear(Number(data.year));
      if (data.genre) setGenre(data.genre);
      if (data.posterUrl) setPosterUrl(data.posterUrl);
      
      setSuccessMsg(`✨ Found details for "${data.title}"!`);
      setTimeout(() => setSuccessMsg(''), 4500);
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'Error occurred while looking up movie details.');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Letterboxd integration states
  const [letterboxdInput, setLetterboxdInput] = useState('');
  const [lbSuggestions, setLbSuggestions] = useState<LetterboxdMovie[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<LetterboxdMovie | null>(null);

  const handleVote = (id: string) => {
    if (!currentUser) {
      setErrorMsg('You must authenticate using your IISER Kolkata email ID before upvoting movies.');
      setTimeout(() => setErrorMsg(''), 5000);
      return;
    }
    onVoteRecommendation(id, currentUser.email);
  };

  const handleLetterboxdInputChange = async (val: string) => {
    setLetterboxdInput(val);
    const query = val.trim();
    if (!query) {
      setLbSuggestions([]);
      return;
    }

    const lowerQuery = query.toLowerCase();

    // 1. Detect if it's an IMDb link, Letterboxd link, or IMDb ID directly (tt1234567...)
    const isUrl = lowerQuery.includes('letterboxd.com/film/') || 
                  lowerQuery.includes('imdb.com/title/') || 
                  lowerQuery.includes('imdb.com/title/tt') ||
                  /\b(tt\d{7,10})\b/i.test(query) ||
                  /^(https?:\/\/)?(www\.)?imdb\.com/i.test(query) ||
                  /^(https?:\/\/)?(www\.)?letterboxd\.com/i.test(query);

    if (isUrl) {
      setLbSuggestions([]); // clear suggestions list for URL inputs
      setIsAiLoading(true);
      setAiError('');
      try {
        const res = await fetch('/api/movie-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ movieQuery: query })
        });
        if (res.ok) {
          const detail = await res.json();
          if (detail && detail.title) {
            setTitle(detail.title);
            setDirector(detail.director || '');
            if (detail.year) setYear(Number(detail.year));
            if (detail.genre) setGenre(detail.genre);
            if (detail.posterUrl) setPosterUrl(detail.posterUrl);
            
            setSuccessMsg(`✨ Auto-filled details for "${detail.title}"!`);
            setTimeout(() => setSuccessMsg(''), 4500);
            setLetterboxdInput(''); // empty input on success
          }
        } else {
          setAiError('Could not load details from this link. Please enter details manually.');
        }
      } catch (err: any) {
        console.warn("Autofill from link failed:", err);
        setAiError('Could not load details from this link. Please enter details manually.');
      } finally {
        setIsAiLoading(false);
      }
      return;
    }

    // 2. Local fallback matches first
    const localFiltered = letterboxdMovies.filter(m => 
      m.title.toLowerCase().includes(lowerQuery) || 
      m.director.toLowerCase().includes(lowerQuery) ||
      m.genre.some(g => g.toLowerCase().includes(lowerQuery))
    );

    const formattedLocal: any[] = localFiltered.map(m => ({
      id: m.id,
      title: m.title,
      year: m.year,
      description: m.synopsis,
      director: m.director,
      duration: m.runtime,
      genre: m.genre.join(', '),
      letterboxdSlug: m.id,
      wikipediaTitle: '',
      posterUrl: m.posterUrl,
      backdropUrl: m.backdropUrl
    }));
    setLbSuggestions(formattedLocal);

    // 3. API Remote grounding suggestions
    if (query.length >= 2) {
      setIsAiLoading(true);
      try {
        const response = await fetch('/api/search-movies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query })
        });
        if (response.ok) {
          const apiMovies = await response.json();
          if (Array.isArray(apiMovies) && apiMovies.length > 0) {
            // Merge unique
            const merged = [...apiMovies];
            formattedLocal.forEach(loc => {
              const duplicated = merged.some(api => api.title.toLowerCase() === loc.title.toLowerCase());
              if (!duplicated) {
                merged.push(loc);
              }
            });
            setLbSuggestions(merged);
          }
        }
      } catch (e) {
        console.warn("API Autocomplete Fetch fail:", e);
      } finally {
        setIsAiLoading(false);
      }
    }
  };

  const selectLetterboxdMovie = (movie: any) => {
    setTitle(movie.title);
    setDirector(movie.director || '');
    if (movie.year) setYear(Number(movie.year));
    if (movie.genre) setGenre(movie.genre);
    if (movie.posterUrl) setPosterUrl(movie.posterUrl);
    
    setLetterboxdInput(movie.title);
    setLbSuggestions([]);

    // Set interactive visual preview block
    setSelectedMovie({
      id: movie.letterboxdSlug || 'custom-movie',
      title: movie.title,
      director: movie.director || '',
      year: Number(movie.year) || 2024,
      runtime: movie.duration || '120 min',
      genre: (movie.genre || '').split(',').map((g: string) => g.trim()),
      language: 'English (with Subs)',
      synopsis: movie.description || movie.synopsis || '',
      posterUrl: movie.posterUrl || '',
      backdropUrl: movie.backdropUrl || '',
      letterboxdUrl: `https://letterboxd.com/film/${movie.letterboxdSlug || 'custom-movie'}/`
    });

    setSuccessMsg(`✨ Successfully populated details for "${movie.title}"!`);
    setTimeout(() => setSuccessMsg(''), 4500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setErrorMsg('Unauthorized context! Please sign in with your email first.');
      return;
    }

    if (!title.trim() || !director.trim() || !notes.trim()) {
      setErrorMsg('Please fill out all required fields: Title, Director, and Screening Reason.');
      return;
    }

    const recPayload: any = {
      title: title.trim(),
      director: director.trim(),
      year: Number(year),
      genre: genre.trim(),
      notes: notes.trim()
    };

    if (posterUrl && posterUrl.trim()) {
      recPayload.posterUrl = posterUrl.trim();
    }

    if (editingId) {
      if (onUpdateRecommendation) {
        onUpdateRecommendation(editingId, recPayload);
      }
      setSuccessMsg(`✨ Recommendation for "${title}" updated successfully!`);
      setTimeout(() => setSuccessMsg(''), 4000);
      setEditingId(null);
    } else {
      const result = await onAddRecommendation(recPayload);
      if (result === 'voted') {
        setSuccessMsg(`✨ "${title}" has already been recommended! We auto-incremented its upvote count for you.`);
        setTimeout(() => setSuccessMsg(''), 5500);
      } else if (result === 'already_voted') {
        setSuccessMsg(`ℹ️ "${title}" has already been recommended, and you've already upvoted it!`);
        setTimeout(() => setSuccessMsg(''), 5500);
      } else {
        setSuccessMsg('Film recommendation logged successfully!');
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    }

    // Reset states
    setTitle('');
    setDirector('');
    setYear(2024);
    setGenre('Sci-Fi/Drama');
    setNotes('');
    setPosterUrl('');
    setLetterboxdInput('');
    setSelectedMovie(null);
    setErrorMsg('');
    setShowSubmitModal(false);
  };

  // Filter & Search Recommendations
  const filteredRecs = recommendations
    .filter(rec => {
      const q = searchQuery.toLowerCase();
      return (
        rec.title.toLowerCase().includes(q) ||
        rec.director.toLowerCase().includes(q) ||
        rec.genre.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'votes') {
        return b.votes.length - a.votes.length;
      } else {
        return new Date(b.suggestedAt).getTime() - new Date(a.suggestedAt).getTime();
      }
    });

  return (
    <div className="space-y-8">
      {/* Header and Action Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-900 pb-6 gap-4">
        <div>
          <span className="text-amber-500 font-mono text-xs uppercase tracking-widest font-semibold flex items-center gap-1.5">
            <MessageSquareHeart className="h-4 w-4" /> Member Voice
          </span>
          <h2 className="font-serif text-3xl font-bold text-zinc-100 tracking-tight sm:text-4xl mt-1">
            Student Wishlist
          </h2>
          <p className="text-xs text-zinc-500 mt-1 max-w-xl">
            Recommend specialized masterpieces, indie gems, or local features you want the club to screen next. Upvote submissions with high peer potential.
          </p>
        </div>

        <div>
          {currentUser ? (
            <button
              onClick={() => {
                setShowSubmitModal(true);
                setTitle('');
                setDirector('');
                setYear(2024);
                setGenre('Sci-Fi/Drama');
                setNotes('');
                setLetterboxdInput('');
                setSelectedMovie(null);
                setLbSuggestions([]);
              }}
              id="btn-recommend-trigger"
              className="flex items-center space-x-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 px-5 py-2.5 rounded-xl font-bold text-sm transition-transform hover:scale-102 shadow-lg shadow-amber-500/10 cursor-pointer"
            >
              <Plus className="h-4.5 w-4.5 font-bold" />
              <span>Recommend a Movie</span>
            </button>
          ) : (
            <div className="text-amber-500/80 bg-amber-500/5 px-4 py-2.5 rounded-xl border border-amber-500/10 text-xs font-mono animate-pulse">
              🔑 Sign in with your IISER email to recommend
            </div>
          )}
        </div>
      </div>

      {/* Control panel: search, sort */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-950/60 p-4 rounded-xl border border-zinc-900">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search wishlist..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-zinc-900 bg-zinc-900/40 py-2 pl-9 pr-4 text-xs text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
          />
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
          <span className="text-zinc-500 text-xs font-mono flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" /> Sort:
          </span>
          <button
            onClick={() => setSortBy('votes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono border transition-all cursor-pointer ${
              sortBy === 'votes'
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Highest Voted
          </button>
          <button
            onClick={() => setSortBy('newest')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono border transition-all cursor-pointer ${
              sortBy === 'newest'
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Newest Submitted
          </button>
        </div>
      </div>

      {/* Custom temporary messages */}
      {successMsg && (
        <div className="rounded-xl border border-green-500/25 bg-green-500/5 p-4 text-xs text-green-400 font-mono">
          ✅ {successMsg}
        </div>
      )}
      {errorMsg && !showSubmitModal && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-4 text-xs text-red-400 font-mono">
          ❌ {errorMsg}
        </div>
      )}

      {/* Grid List representation */}
      {filteredRecs.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-zinc-900 rounded-xl">
          <BookOpen className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
          <h4 className="text-zinc-400 font-serif text-base font-semibold">No requests meet your filter</h4>
          <p className="text-xs text-zinc-650 mt-1 max-w-xs mx-auto">
            Try revising your search terms or be the first to recommend a masterpiece.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredRecs.map((rec) => {
            const hasUpvoted = currentUser ? rec.votes.includes(currentUser.email) : false;

            return (
              <div
                key={rec.id}
                className="group flex flex-col sm:flex-row gap-4 justify-between rounded-xl border border-zinc-900 bg-zinc-950 p-5 shadow-lg hover:border-zinc-800 transition-all duration-300 animate-fadeIn"
              >
                {rec.posterUrl && (
                  <div className="w-24 h-36 shrink-0 rounded-lg overflow-hidden border border-zinc-900 bg-zinc-900 shadow-md self-center sm:self-start">
                    <img 
                      src={getPolishedPosterUrl(rec.title, rec.posterUrl)} 
                      alt={rec.title} 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=300';
                      }}
                    />
                  </div>
                )}
                
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <span className="text-[9.5px] uppercase font-mono font-bold text-amber-500/80 bg-amber-500/5 border border-amber-500/10 px-2 py-0.5 rounded">
                          {rec.genre}
                        </span>
                        <h3 className="font-serif text-lg font-bold text-zinc-100 tracking-tight mt-1.5 leading-snug">
                          {rec.title} <span className="text-zinc-550 font-normal">({rec.year})</span>
                        </h3>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Director: <span className="text-zinc-300 font-medium">{rec.director}</span>
                        </p>
                      </div>

                      {/* Voting lever column */}
                      <button
                        onClick={() => handleVote(rec.id)}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all border shrink-0 scale-95 cursor-pointer ${
                          hasUpvoted
                            ? 'bg-amber-500 border-amber-400 text-zinc-950'
                            : 'bg-zinc-900/60 border-zinc-800 hover:border-amber-500/30 text-zinc-400 hover:text-amber-400'
                        }`}
                      >
                        <ArrowUp className={`h-4.5 w-4.5 ${hasUpvoted ? 'stroke-[3]' : 'animate-bounce'}`} />
                        <span className="text-xs font-extrabold font-mono mt-0.5">{rec.votes.length}</span>
                      </button>
                    </div>

                    {/* Submission note explaining reason */}
                    <div className="mt-4 bg-zinc-900/50 p-3.5 rounded-xl border border-zinc-900/60 text-xs italic text-zinc-300 relative">
                      <span className="absolute -top-1.5 left-3 bg-zinc-950 px-1 font-mono text-[9px] text-zinc-500 uppercase not-italic font-bold tracking-wider">
                        Why Screen This?
                      </span>
                      "{rec.notes}"
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-zinc-900/80 flex items-center justify-between text-[11px] text-zinc-500">
                    <span className="flex items-center gap-1 font-mono">
                      <User className="h-3 w-3 text-zinc-600" />
                      Suggested by <span className="text-zinc-300 font-semibold">{rec.suggestedByName}</span>
                    </span>

                    <span className="flex items-center gap-1 font-mono text-[10px]">
                      <Calendar className="h-3 w-3 text-zinc-600" />
                      {new Date(rec.suggestedAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Action buttons (Edit for author, Mark Screened for admin) */}
                  {((currentUser && rec.suggestedBy === currentUser.email) || adminMode || (currentUser?.role === 'admin')) && (
                    <div className="mt-3 pt-2.5 border-t border-zinc-900/60 flex items-center justify-end gap-2 shrink-0">
                      {currentUser && rec.suggestedBy === currentUser.email && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(rec.id);
                            setTitle(rec.title);
                            setDirector(rec.director);
                            setYear(rec.year);
                            setGenre(rec.genre);
                            setNotes(rec.notes);
                            setPosterUrl(rec.posterUrl || '');
                            setShowSubmitModal(true);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-amber-500/30 text-[10px] font-bold text-zinc-300 hover:text-amber-400 transition-all cursor-pointer"
                        >
                          <Pencil className="h-3 w-3 text-amber-500/80" />
                          <span>EDIT</span>
                        </button>
                      )}
                      {(adminMode || currentUser?.role === 'admin') && (
                        <button
                          type="button"
                          onClick={() => {
                            setScreeningToMark(rec);
                            setScreenDate(new Date().toISOString().split('T')[0]);
                            setScreenRating(4.5);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/15 hover:border-amber-500/35 text-[10px] font-bold text-amber-400 hover:text-amber-300 transition-all cursor-pointer"
                        >
                          <Star className="h-3 w-3 fill-amber-400/80 text-amber-400" />
                          <span>MARK SCREENED</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Informative Tip Box on film screening selection criteria */}
      <div className="rounded-xl border border-zinc-900 bg-zinc-950/20 p-5 flex gap-3.5">
        <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <h4 className="font-semibold text-zinc-300">How do student requests get screened?</h4>
          <p className="text-zinc-500 leading-relaxed">
            We review the community wishlist together. Upvote your favorite recommendations or add new ones! Films with more interest get scheduled for upcoming screenings. Let's make every movie night count!
          </p>
        </div>
      </div>

      {/* Submit Recommendation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-850 bg-zinc-950 p-6 shadow-2xl relative my-8">
            <button
              onClick={() => {
                setShowSubmitModal(false);
                setErrorMsg('');
              }}
              className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-zinc-200 rounded-lg cursor-pointer"
            >
              <Plus className="h-5 w-5 rotate-45" />
            </button>

            <div className="mb-4">
              <span className="text-xs font-mono text-amber-500 uppercase tracking-widest font-semibold flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" /> {editingId ? 'Edit Cinema' : 'Share Cinema'}
              </span>
              <h2 className="font-serif text-xl font-bold text-zinc-100 mt-0.5">
                {editingId ? 'Edit Wishlist Nomination' : 'Suggest Screening Nomination'}
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                {editingId ? 'Refine or perfect the details to help promote your recommendation.' : 'Recommend movies you want to screen to your fellow peers on campus.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-sm text-zinc-300">
                  {/* Intelligent Cinema Autofill & Search Bar */}
              <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-amber-500 flex items-center gap-1.5 px-1.5 py-0.5 bg-amber-500/5 rounded border border-amber-500/10 font-bold uppercase tracking-wider text-[10px]">
                    🍿 SMART CINEMA AUTOFILL & SEARCH
                  </span>
                  <span className="text-zinc-550 text-[10px]/none">Real-time API suggestions</span>
                </div>
                
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-zinc-500">
                    <Link2 className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    value={letterboxdInput}
                    onChange={(e) => handleLetterboxdInputChange(e.target.value)}
                    placeholder="Type film name (e.g. Parasite, Inception) or paste Letterboxd/IMDb link"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-8 text-xs text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none"
                  />
                  {isAiLoading && (
                    <span className="absolute right-3 top-2.5 flex items-center h-4 w-4">
                      <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-amber-500"></span>
                    </span>
                  )}

                  {lbSuggestions.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl divide-y divide-zinc-900 font-sans">
                      {lbSuggestions.map((movie, index) => (
                        <button
                          key={`${movie.title}-${movie.year}-${index}`}
                          type="button"
                          onClick={() => selectLetterboxdMovie(movie)}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-900 flex items-center gap-3 transition-colors cursor-pointer"
                        >
                          <img 
                            src={getPolishedPosterUrl(movie.title, movie.posterUrl)} 
                            className="w-7 h-10 object-cover rounded shrink-0 bg-zinc-850 border border-zinc-800/50" 
                            referrerPolicy="no-referrer" 
                            onError={(e) => {
                              e.currentTarget.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=100';
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-zinc-200 truncate">{movie.title} <span className="text-zinc-550 font-normal">({movie.year})</span></div>
                            <div className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate">Dir: {movie.director || 'Unknown'} • {movie.genre || 'Cinema'}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-zinc-550 leading-normal leading-relaxed font-sans">
                  💡 Hint: Search for a movie by name or paste an IMDb / Letterboxd link above, and we will automatically fill in the film details for you!
                </p>

                {selectedMovie && (
                  <div className="flex items-start gap-4 bg-zinc-950/75 p-3 rounded-lg border border-zinc-800 animate-fadeIn">
                    <img 
                      src={getPolishedPosterUrl(selectedMovie.title, selectedMovie.posterUrl)} 
                      className="w-12 h-18 object-cover rounded border border-zinc-850 shrink-0 shadow-md" 
                      referrerPolicy="no-referrer" 
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=100';
                      }}
                    />
                    <div className="text-xs space-y-0.5 min-w-0 flex-1">
                      <div className="font-bold text-amber-500 font-mono text-[9px] uppercase tracking-wider">Selected Movie Details</div>
                      <div className="font-serif font-bold text-zinc-100 leading-tight truncate">{selectedMovie.title} ({selectedMovie.year})</div>
                      <div className="text-[11px] text-zinc-400 truncate">Director: {selectedMovie.director}</div>
                      <div className="text-[10px] text-zinc-500 font-mono max-w-full overflow-hidden text-ellipsis whitespace-nowrap">{selectedMovie.genre.join(', ')}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Form entries - editable */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-mono text-zinc-400">MOVIE TITLE *</label>
                    <button
                      type="button"
                      onClick={fetchAiMovieDetails}
                      disabled={isAiLoading || !title.trim()}
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded cursor-pointer transition-all border ${
                        title.trim() 
                          ? 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-500' 
                          : 'bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      {isAiLoading ? '⌛ AUTOFILLING...' : '✨ QUICK AUTO-FILL'}
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Arrival"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setSelectedMovie(null);
                    }}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-550 focus:border-amber-500/50 focus:outline-none"
                  />
                  {aiError && <p className="text-[10px] text-red-400 mt-1">{aiError}</p>}
                  
                  {/* Smart Poster Artwork Selector */}
                  <div className="mt-2.5 space-y-1.5">
                    <label className="block text-[10px] font-mono text-zinc-400">POSTER ARTWORK (IMAGE FILE OR URL)</label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="Paste image link"
                        value={posterUrl}
                        onChange={(e) => {
                          setPosterUrl(e.target.value);
                          setSelectedMovie(null);
                        }}
                        className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-650 focus:border-amber-500/50 focus:outline-none"
                      />
                      <label 
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 rounded px-2.5 py-1.5 text-[10px] font-mono font-bold text-zinc-200 cursor-pointer transition-all shrink-0"
                      >
                        {isPosterCompressing ? (
                          <span className="animate-spin h-3 w-3 border-b border-amber-500 rounded-full inline-block"></span>
                        ) : (
                          <Upload className="h-3 w-3 text-amber-500" />
                        )}
                        <span>{isPosterCompressing ? 'COMPRESSING...' : 'UPLOAD FILE'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={isPosterCompressing}
                          onChange={(e) => {
                            e.stopPropagation();
                            const file = e.target.files?.[0];
                            if (file) handlePosterFileUpload(file);
                          }}
                        />
                      </label>
                    </div>
                    {posterFileError && (
                      <p className="text-[9px] text-red-400 font-mono">{posterFileError}</p>
                    )}
                    {posterUrl && (
                      <div className="flex items-center gap-2 bg-zinc-900/40 p-1.5 rounded border border-zinc-850 leading-normal">
                        <img 
                          src={posterUrl} 
                          alt="Poster Preview" 
                          className="w-7 h-10 object-cover rounded border border-zinc-805 shrink-0 bg-zinc-900" 
                          referrerPolicy="no-referrer" 
                          onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=100';
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <span className="block text-[9px] font-bold font-mono text-amber-500">POSTER PREVIEW</span>
                          <span className="block text-[9px] text-zinc-500 truncate font-mono">
                            {posterUrl.startsWith('data:') ? 'Custom uploaded (Compressed)' : posterUrl}
                          </span>
                        </div>
                        {posterUrl.startsWith('data:') && (
                          <button
                            type="button"
                            onClick={() => setPosterUrl('')}
                            className="text-[9px] text-red-400 hover:text-red-300 font-mono px-1 border border-red-500/10 hover:border-red-500/20 bg-red-500/5 hover:bg-red-500/10 rounded cursor-pointer transition-all shrink-0"
                          >
                            RESET
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">DIRECTOR *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Denis Villeneuve"
                    value={director}
                    onChange={(e) => {
                      setDirector(e.target.value);
                      setSelectedMovie(null);
                    }}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-550 focus:border-amber-500/50 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">RELEASE YEAR</label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => {
                      setYear(Number(e.target.value));
                      setSelectedMovie(null);
                    }}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-2 text-sm text-zinc-100 focus:border-amber-500/50 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">GENRES / TAGS</label>
                  <input
                    type="text"
                    placeholder="e.g. Sci-Fi, Thriller"
                    value={genre}
                    onChange={(e) => {
                      setGenre(e.target.value);
                      setSelectedMovie(null);
                    }}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-650 focus:border-amber-500/50 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1.5">SCREENING ESSAY / MOTIVATION *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="In 2 to 3 lines, motivate why the film carries merit (concept, sound design, academic themes, philosophical depth or cinematic mastery) and why the IISER Kolkata student club must screen it..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none resize-none"
                />
              </div>

              {errorMsg && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
                  {errorMsg}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-3 border-t border-zinc-900">
                <button
                  type="button"
                  onClick={() => {
                    setShowSubmitModal(false);
                    setErrorMsg('');
                  }}
                  className="px-4 py-2 text-sm font-semibold text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-600 text-zinc-950 px-5 py-2 rounded-lg text-sm font-semibold transition-colors font-mono cursor-pointer"
                >
                  {editingId ? 'SAVE CHANGES' : 'SUBMIT RECOMMENDATION'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mark Screened Modal */}
      {screeningToMark && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-zinc-850 bg-zinc-950 p-6 shadow-2xl relative">
            <button
              onClick={() => setScreeningToMark(null)}
              className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-zinc-200 rounded-lg cursor-pointer"
            >
              <Plus className="h-5 w-5 rotate-45" />
            </button>

            <div className="mb-4">
              <span className="text-xs font-mono text-amber-500 uppercase tracking-widest font-semibold flex items-center gap-1.5">
                <Star className="h-4 w-4 text-amber-500 fill-amber-500" /> Archive to Screened Section
              </span>
              <h2 className="font-serif text-xl font-bold text-zinc-100 mt-1">
                Mark "{screeningToMark.title}" as Screened
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                This will remove the suggestion from the student wishlist and log it into the <b>Past Screenings</b> archive.
              </p>
            </div>

            <div className="space-y-4 text-sm text-zinc-300">
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">SCREENING DATE *</label>
                <input
                  type="date"
                  value={screenDate}
                  onChange={(e) => setScreenDate(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-2 text-sm text-zinc-100 focus:border-amber-500/50 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-mono text-zinc-400">RATING *</label>
                  <span className="text-amber-500 text-xs font-bold font-mono">{screenRating} / 5 Stars</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="5"
                  step="0.5"
                  value={screenRating}
                  onChange={(e) => setScreenRating(Number(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono mt-1">
                  <span>0.5 Stars</span>
                  <span>5.0 Stars (Masterpiece)</span>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-zinc-900">
                <button
                  type="button"
                  onClick={() => setScreeningToMark(null)}
                  className="px-4 py-2 text-sm font-semibold text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onMarkScreened) {
                      onMarkScreened(screeningToMark, screenDate, screenRating);
                    }
                    setSuccessMsg(`✨ "${screeningToMark.title}" successfully archived to Past Screenings!`);
                    setTimeout(() => setSuccessMsg(''), 4500);
                    setScreeningToMark(null);
                  }}
                  className="bg-amber-500 hover:bg-amber-600 text-zinc-950 px-5 py-2 rounded-lg text-sm font-semibold transition-colors font-mono cursor-pointer"
                >
                  ARCHIVE ENTRY
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
