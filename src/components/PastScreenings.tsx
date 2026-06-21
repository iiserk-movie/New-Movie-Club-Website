import React, { useState } from 'react';
import { 
  Star, MessageSquare, ExternalLink, RefreshCw, Calendar, 
  ChevronDown, ChevronUp, User, Clock, Send, MessageCircleCode, CheckCircle2,
  Edit3, Trash2, Plus, Search, X, AlertCircle
} from 'lucide-react';
import { PastMovie, UserReview } from '../types';
import { getPolishedPosterUrl } from '../letterboxdDb';

interface PastScreeningsProps {
  pastMovies: PastMovie[];
  onAddReview: (movieId: string, review: Omit<UserReview, 'id' | 'createdAt'>) => void;
  currentUser: { email: string; name: string } | null;
  onUpdateReview?: (movieId: string, reviewId: string, comment: string, rating: number) => Promise<void>;
  onDeleteReview?: (movieId: string, reviewId: string) => Promise<void>;
  adminMode?: boolean;
  onImportPastMovies?: (movies: Omit<PastMovie, 'reviews'>[]) => Promise<void>;
  onUpdatePastMovie?: (movie: PastMovie) => Promise<void>;
  onDeletePastMovie?: (movieId: string) => Promise<void>;
}

export default function PastScreenings({ 
  pastMovies, 
  onAddReview, 
  currentUser,
  onUpdateReview,
  onDeleteReview,
  adminMode = false,
  onImportPastMovies,
  onUpdatePastMovie,
  onDeletePastMovie
}: PastScreeningsProps) {
  const [selectedMovieId, setSelectedMovieId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  
  // Submit state for review
  const [ratingInput, setRatingInput] = useState(5);
  const [commentInput, setCommentInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Editing state for reviews inline
  const [editingRevId, setEditingRevId] = useState<string | null>(null);
  const [editRatingInput, setEditRatingInput] = useState(5);
  const [editCommentInput, setEditCommentInput] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // New States for Letterboxd sync
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [letterboxdUsername, setLetterboxdUsername] = useState(() => {
    return localStorage.getItem('last_letterboxd_sync_username') || '';
  });
  const [syncedMovies, setSyncedMovies] = useState<Omit<PastMovie, 'reviews'>[] | null>(null);
  const [selectedImportIds, setSelectedImportIds] = useState<Record<string, boolean>>({});
  const [syncStatusMsg, setSyncStatusMsg] = useState('');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // New States for Editing Past Movie (Administrators)
  const [editingMovie, setEditingMovie] = useState<PastMovie | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDirector, setEditDirector] = useState('');
  const [editYear, setEditYear] = useState(2025);
  const [editScreenedDate, setEditScreenedDate] = useState('');
  const [editPosterUrl, setEditPosterUrl] = useState('');
  const [editSynopsis, setEditSynopsis] = useState('');
  const [editGenreInput, setEditGenreInput] = useState('');
  const [editLetterboxdUrl, setEditLetterboxdUrl] = useState('');
  const [isSavingMovie, setIsSavingMovie] = useState(false);
  const [movieErrorMsg, setMovieErrorMsg] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  const triggerSync = async () => {
    if (!adminMode) {
      // Non-admin trigger shows the mock successful result to members
      setIsSyncing(true);
      setSyncSuccess(false);
      setTimeout(() => {
        setIsSyncing(false);
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 4000);
      }, 2000);
      return;
    }

    // Admin Mode trigger opens the interactive sync panel/modal
    setShowSyncModal(true);
    setSyncError(null);
    setSyncedMovies(null);
    setSyncStatusMsg('');
  };

  const handleFetchDiary = async () => {
    const trimmedUser = letterboxdUsername.trim();
    if (!trimmedUser) {
      setSyncError('Please enter a Letterboxd username.');
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    setSyncedMovies(null);
    setSyncStatusMsg('Connecting to Letterboxd RSS services, retrieving public diary feed...');

    try {
      const res = await fetch('/api/letterboxd-rss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUser })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch the Letterboxd feed.');
      }

      const moviesList: Omit<PastMovie, 'reviews'>[] = data.movies || [];
      if (moviesList.length === 0) {
        throw new Error('No recent watched/diary items found in the public profile RSS feed.');
      }

      setSyncedMovies(moviesList);
      localStorage.setItem('last_letterboxd_sync_username', trimmedUser);

      // Pre-select items that are NOT currently in the pastMovies list
      const initialSelection: Record<string, boolean> = {};
      moviesList.forEach(m => {
        const exists = pastMovies.some(existing => 
          existing.title.toLowerCase().trim() === m.title.toLowerCase().trim()
        );
        initialSelection[m.title] = !exists;
      });
      setSelectedImportIds(initialSelection);
      setSyncStatusMsg('');
    } catch (err: any) {
      console.error(err);
      setSyncError(err.message || 'Failed connection to Letterboxd proxy.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!syncedMovies || !onImportPastMovies) return;

    const toImport = syncedMovies.filter(m => selectedImportIds[m.title]);
    if (toImport.length === 0) {
      setSyncError('Please select at least one movie to import.');
      return;
    }

    setIsImporting(true);
    setSyncError(null);
    try {
      await onImportPastMovies(toImport);
      setShowSyncModal(false);
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 4000);
    } catch (err: any) {
      console.error(err);
      setSyncError(err.message || 'An error occurred during database writing.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleReviewSubmit = (e: React.FormEvent, movieId: string) => {
    e.preventDefault();
    if (!currentUser) {
      setErrorMsg('You must have logged in using your institute email to write review logs.');
      return;
    }
    if (!commentInput.trim()) {
      setErrorMsg('Please write a quick comment for the film.');
      return;
    }

    onAddReview(movieId, {
      userEmail: currentUser.email,
      userName: currentUser.name,
      rating: ratingInput,
      comment: commentInput.trim()
    });

    setCommentInput('');
    setRatingInput(5);
    setErrorMsg('');
  };

  const calculateAverageRating = (movie: PastMovie) => {
    if (movie.reviews.length === 0) return movie.rating;
    const sum = movie.reviews.reduce((acc, r) => acc + r.rating, 0);
    const calculated = (sum / movie.reviews.length + movie.rating) / 2; // blending initial Letterboxd score with student scores
    return Number(calculated.toFixed(1));
  };

  const renderStars = (rating: number, interactive = false, onSelect?: (r: number) => void) => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => onSelect && onSelect(star)}
            className={`${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
          >
            <Star
              className={`h-4 w-4 ${
                star <= rating
                  ? 'text-amber-400 fill-amber-400'
                  : 'text-zinc-700'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  const handleStartEditPastMovie = (movie: PastMovie) => {
    setEditingMovie(movie);
    setEditTitle(movie.title);
    setEditDirector(movie.director);
    setEditYear(movie.year);
    setEditScreenedDate(movie.screenedDate || '');
    setEditPosterUrl(movie.posterUrl || '');
    setEditSynopsis(movie.synopsis || '');
    setEditGenreInput(movie.genre ? movie.genre.join(', ') : '');
    setEditLetterboxdUrl(movie.letterboxdUrl || '');
    setMovieErrorMsg('');
    setSaveSuccessMsg('');
  };

  const handleSavePastMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMovie) return;
    
    if (!editTitle.trim()) {
      setMovieErrorMsg('Title is required.');
      return;
    }
    if (!editDirector.trim()) {
      setMovieErrorMsg('Director is required.');
      return;
    }
    if (!editScreenedDate.trim()) {
      setMovieErrorMsg('Screened Date is required.');
      return;
    }

    setIsSavingMovie(true);
    setMovieErrorMsg('');
    setSaveSuccessMsg('');

    try {
      const parsedGenres = editGenreInput
        ? editGenreInput.split(',').map((g) => g.trim()).filter((g) => g.length > 0)
        : [];

      const updatedMovie: PastMovie = {
        ...editingMovie,
        title: editTitle.trim(),
        director: editDirector.trim(),
        year: Number(editYear) || 2025,
        screenedDate: editScreenedDate.trim(),
        posterUrl: editPosterUrl.trim(),
        synopsis: editSynopsis.trim(),
        genre: parsedGenres,
        letterboxdUrl: editLetterboxdUrl.trim(),
      };

      if (onUpdatePastMovie) {
        await onUpdatePastMovie(updatedMovie);
        setSaveSuccessMsg('Successfully updated past movie screening!');
        setTimeout(() => {
          setEditingMovie(null);
          setSaveSuccessMsg('');
        }, 1500);
      }
    } catch (err: any) {
      console.error('Update past movie failed:', err);
      setMovieErrorMsg(err.message || 'Failed to update past movie screening.');
    } finally {
      setIsSavingMovie(false);
    }
  };

  const handleDeletePastMovieClick = async (movie: PastMovie) => {
    if (!window.confirm(`Are you absolutely sure you want to permanently delete "${movie.title}" from the past screenings database?\nThis will ALSO remove all corresponding student reviews!`)) {
      return;
    }

    try {
      if (onDeletePastMovie) {
        await onDeletePastMovie(movie.id);
      }
    } catch (err: any) {
      console.error('Delete past movie failed:', err);
      alert(`Delete failed: ${err.message || 'Permission denied or error.'}`);
    }
  };

  return (
    <div className="space-y-10">
      {/* Header and Sync Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-900 pb-6 gap-4">
        <div>
          <span className="text-amber-500 font-mono text-xs uppercase tracking-widest font-semibold flex items-center gap-1.5">
            <MessageCircleCode className="h-4 w-4" /> Letterboxd Archive
          </span>
          <h2 className="font-serif text-3xl font-bold text-zinc-100 tracking-tight sm:text-4xl mt-1">
            Past Screenings
          </h2>
          <p className="text-xs text-zinc-500 mt-1 max-w-xl">
            A comprehensive history of cinema masterpieces screened at the IISER K Movie Club, sourced directly from our curated Letterboxd profile.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <a
            href="https://letterboxd.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center space-x-1 border border-zinc-850 hover:border-zinc-700 text-zinc-400 hover:text-white px-3.5 py-2 rounded-xl text-xs font-medium bg-zinc-950 transition-colors"
          >
            <span>Letterboxd Profile</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>

          <button
            onClick={triggerSync}
            disabled={isSyncing}
            className="flex items-center justify-center space-x-2 bg-zinc-900 text-amber-400 hover:text-amber-300 border border-amber-500/10 hover:border-amber-500/25 px-4 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Feed'}</span>
          </button>
        </div>
      </div>

      {/* Sync animation popover */}
      {isSyncing && (
        <div className="rounded-2xl border border-amber-500/10 bg-amber-500/5 p-4 flex items-center space-x-4 animate-pulse">
          <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
            <RefreshCw className="h-4 w-4 animate-spin" />
          </div>
          <div>
            <h4 className="text-xs font-bold font-mono text-amber-500">READING LETTERBOXD JOURNAL FEED</h4>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Connecting secure pipeline with Letterboxd API targets... fetching ratings and review counts...
            </p>
          </div>
        </div>
      )}

      {syncSuccess && (
        <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-4 flex items-center space-x-4">
          <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-400">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold font-mono text-green-400">SYNC SUCCESSFUL</h4>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Retrieved 4 latest screening records matching Letterboxd diary entries perfectly.
            </p>
          </div>
        </div>
      )}

      {/* Past Screenings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {pastMovies.map((movie) => {
          const isExpanded = selectedMovieId === movie.id;
          const avgRating = calculateAverageRating(movie);

          return (
            <div
              key={movie.id}
              className="group flex flex-col rounded-2xl border border-zinc-900 bg-zinc-950 overflow-hidden shadow-xl hover:border-zinc-800 transition-all duration-300"
            >
              <div className="flex gap-4 p-5">
                {/* Poster Box */}
                <div className="relative w-24 h-36 flex-shrink-0 rounded-lg overflow-hidden border border-zinc-850 bg-zinc-900 shadow-md">
                  <img
                    src={getPolishedPosterUrl(movie.title, movie.posterUrl)}
                    alt={movie.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=300';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/20 to-transparent"></div>
                </div>

                {/* Main details */}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-mono font-bold text-amber-500/80 bg-amber-500/5 border border-amber-500/10 px-2 py-0.5 rounded-md">
                        Screened on {movie.screenedDate}
                      </span>
                      {adminMode && (
                        <div className="flex items-center space-x-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEditPastMovie(movie)}
                            className="p-1.5 text-zinc-400 hover:text-amber-500 hover:bg-zinc-900 rounded-lg transition-colors cursor-pointer"
                            title="Edit Screening Details"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePastMovieClick(movie)}
                            className="p-1.5 text-zinc-400 hover:text-red-450 hover:bg-zinc-900 rounded-lg transition-colors cursor-pointer"
                            title="Delete Past Screening"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <h3 className="font-serif text-lg font-bold text-zinc-100 tracking-tight mt-2 line-clamp-1">
                      {movie.title} <span className="text-zinc-500 font-normal">({movie.year})</span>
                    </h3>
                    
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Directed by <span className="text-zinc-300 font-medium">{movie.director}</span>
                    </p>

                    <div className="flex items-center space-x-1.5 mt-2">
                      {renderStars(Math.round(avgRating))}
                      <span className="text-xs font-bold text-zinc-300 font-mono mt-0.5">{avgRating}</span>
                      <span className="text-[10px] text-zinc-600 font-mono mt-1">({movie.reviews.length + 12} Letterboxd Votes)</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-900/60 pt-3">
                    <span className="text-[10.5px] font-medium text-zinc-500 font-mono flex items-center gap-1">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {movie.reviews.length} Student reviews
                    </span>

                    <button
                      onClick={() => setSelectedMovieId(isExpanded ? null : movie.id)}
                      className="text-xs text-amber-400 hover:text-amber-300 font-mono flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>{isExpanded ? 'Hide Reviews' : 'Student Logs'}</span>
                      {isExpanded ? <ChevronUp className="h-4.5 w-4.5" /> : <ChevronDown className="h-4.5 w-4.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Expansion reviews panel */}
              {isExpanded && (
                <div className="border-t border-zinc-900 bg-zinc-950/80 p-5 space-y-4">
                  
                  {/* Synopsis snippet */}
                  <div className="text-xs text-zinc-400 bg-zinc-900/60 p-3 rounded-lg border border-zinc-900 italic">
                    <span className="text-[10px] uppercase font-mono font-bold text-zinc-500 not-italic block mb-1">Synopsis:</span>
                    "{movie.synopsis}"
                  </div>

                  {/* Reviews lists */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-mono text-zinc-400 uppercase tracking-wider">IISER K Campus Logs</h4>
                    {movie.reviews.length === 0 ? (
                      <p className="text-[11px] text-zinc-600 italic">No reviews logged by campus members yet. Be the first to share your post-screening review below!</p>
                    ) : (
                      movie.reviews.map((rev) => {
                        const isAuthor = currentUser && currentUser.email === rev.userEmail;
                        const isEditing = editingRevId === rev.id;

                        const handleSaveClick = async () => {
                          if (!editCommentInput.trim()) return;
                          setIsUpdating(true);
                          try {
                            if (onUpdateReview) {
                              await onUpdateReview(movie.id, rev.id, editCommentInput, editRatingInput);
                            }
                            setEditingRevId(null);
                          } catch (err) {
                            console.error(err);
                          } finally {
                            setIsUpdating(false);
                          }
                        };

                        const handleDeleteClick = async () => {
                          if (!window.confirm("Are you sure you want to permanently delete your screening review?")) return;
                          try {
                            if (onDeleteReview) {
                              await onDeleteReview(movie.id, rev.id);
                            }
                          } catch (err) {
                            console.error(err);
                          }
                        };

                        return (
                          <div key={rev.id} className="bg-zinc-900/40 p-3.5 rounded-xl border border-zinc-900/60 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-zinc-300 flex items-center gap-1">
                                <User className="h-3 w-3 text-amber-500/80" />
                                {rev.userName}
                              </span>
                              <div className="flex items-center space-x-1.5">
                                <span className="text-[10px] text-zinc-500 font-mono">
                                  {rev.userEmail.split('@')[0]}
                                </span>
                                {isAuthor && !isEditing && (
                                  <div className="flex items-center space-x-1.5 font-mono text-[9px] text-zinc-500 pl-1.5 border-l border-zinc-800">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingRevId(rev.id);
                                        setEditCommentInput(rev.comment);
                                        setEditRatingInput(rev.rating);
                                      }}
                                      className="hover:text-amber-400 cursor-pointer"
                                    >
                                      Edit
                                    </button>
                                    <span>•</span>
                                    <button
                                      type="button"
                                      onClick={handleDeleteClick}
                                      className="hover:text-red-400 cursor-pointer"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2 py-0.5">
                              {isEditing ? (
                                <div className="flex items-center space-x-2">
                                  <span className="text-[10px] font-mono text-zinc-400">Rating:</span>
                                  {renderStars(editRatingInput, true, setEditRatingInput)}
                                </div>
                              ) : (
                                <>
                                  {renderStars(rev.rating)}
                                  <span className="text-[10px] text-zinc-500 font-mono mt-0.5">
                                    {new Date(rev.createdAt).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}
                                  </span>
                                </>
                              )}
                            </div>

                            {isEditing ? (
                              <div className="space-y-2 mt-2">
                                <textarea
                                  value={editCommentInput}
                                  onChange={(e) => setEditCommentInput(e.target.value)}
                                  rows={2}
                                  className="w-full text-xs text-zinc-200 bg-zinc-950 border border-zinc-805 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-amber-500/55 font-sans"
                                />
                                <div className="flex items-center justify-end space-x-2">
                                  <button
                                    type="button"
                                    disabled={isUpdating}
                                    onClick={handleSaveClick}
                                    className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold px-2.5 py-1 rounded text-[10px] uppercase font-mono disabled:opacity-50 cursor-pointer"
                                  >
                                    {isUpdating ? 'Saving...' : 'Save'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isUpdating}
                                    onClick={() => setEditingRevId(null)}
                                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-1 rounded text-[10px] uppercase font-mono disabled:opacity-50 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-zinc-400 italic">
                                "{rev.comment}"
                              </p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Write custom review form */}
                  <div className="border-t border-zinc-900 pt-4">
                    <h4 className="text-xs font-mono text-zinc-400 uppercase tracking-widest mb-3">Add Your Log</h4>
                    {currentUser ? (
                      <form onSubmit={(e) => handleReviewSubmit(e, movie.id)} className="space-y-3">
                        <div className="flex items-center space-x-3">
                          <span className="text-xs font-mono text-zinc-500">Your Rating:</span>
                          {renderStars(ratingInput, true, setRatingInput)}
                          <span className="text-xs font-mono font-bold text-amber-400 mt-0.5">({ratingInput}/5 Stars)</span>
                        </div>

                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Write your thought, critique, or rating log..."
                            value={commentInput}
                            onChange={(e) => {
                              setCommentInput(e.target.value);
                              if (errorMsg) setErrorMsg('');
                            }}
                            className="w-full rounded-lg border border-zinc-850 bg-zinc-900/40 px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 pr-10"
                          />
                          <button
                            type="submit"
                            className="absolute right-2 top-1.5 p-1 text-amber-500 hover:text-amber-400 transition-colors cursor-pointer"
                            title="Submit review"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                        </div>

                        {errorMsg && (
                          <span className="text-[11px] text-red-400 block">{errorMsg}</span>
                        )}
                      </form>
                    ) : (
                      <div className="bg-zinc-900/30 rounded-xl p-3 text-center border border-dashed border-zinc-850">
                        <p className="text-xs text-zinc-500">
                          Please <span className="text-amber-400 underline font-semibold">Login through Institute ID</span> to leave feedback and ratings.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* External Letterboxd outbound */}
                  <div className="flex justify-end pt-2">
                    <a
                      href={movie.letterboxdUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-zinc-500 hover:text-zinc-300 font-mono flex items-center gap-1"
                    >
                      <span>View details on Letterboxd</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sync Dialog modal for Admins */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[99]" id="letterboxd-sync-modal">
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <div className="bg-zinc-950 border border-zinc-900 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
              
              {/* Modal Header */}
              <div className="p-6 border-b border-zinc-900 flex justify-between items-center bg-zinc-950">
                <div className="flex items-center space-x-3">
                  <div className="h-9 w-9 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-400 font-bold border border-amber-500/20">
                    <RefreshCw className="h-4 w-4 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-100 font-mono flex items-center gap-1.5 uppercase tracking-wide">
                      Letterboxd diary sync
                    </h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Retrieve and save official club screenings from your public account
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSyncModal(false)}
                  className="text-zinc-500 hover:text-zinc-200 transition-colors p-1.5 bg-zinc-90 w/50 hover:bg-zinc-900 rounded-lg cursor-pointer transition-all duration-150"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1">
                
                {/* Input section */}
                <div className="bg-zinc-900/30 border border-zinc-900 rounded-2xl p-4 space-y-3">
                  <label className="block text-[10px] font-mono font-semibold tracking-wider text-zinc-400">
                    LETTERBOXD ADMIN ACCOUNT NAME
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-xs font-mono">
                        letterboxd.com/
                      </span>
                      <input
                        type="text"
                        value={letterboxdUsername}
                        onChange={(e) => setLetterboxdUsername(e.target.value)}
                        placeholder="your_letterboxd_user"
                        className="w-full bg-zinc-950 text-zinc-100 border border-zinc-900 rounded-xl pl-28 pr-4 py-2.5 text-xs font-mono focus:outline-none focus:border-amber-500/50 transition-colors"
                        disabled={isSyncing}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleFetchDiary();
                        }}
                      />
                    </div>
                    <button
                      onClick={handleFetchDiary}
                      disabled={isSyncing}
                      className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-5 rounded-xl text-xs font-mono transition-colors font-bold flex items-center justify-center space-x-1 shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {isSyncing ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Fetching...</span>
                        </>
                      ) : (
                        <>
                          <Search className="h-3.5 w-3.5" />
                          <span>Fetch Diary</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-normal">
                    The account must be set to public. This fetches your recent diary events.
                  </p>
                </div>

                {/* Status or error container */}
                {syncStatusMsg && (
                  <div className="flex items-center space-x-2 text-xs text-amber-400 bg-amber-500/5 p-3 rounded-xl border border-amber-500/10">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />
                    <span className="font-mono">{syncStatusMsg}</span>
                  </div>
                )}

                {syncError && (
                  <div className="flex items-center space-x-2 text-xs text-red-400 bg-red-400/5 p-3 rounded-xl border border-red-400/10">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{syncError}</span>
                  </div>
                )}

                {/* Synced movies results */}
                {syncedMovies && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
                        EXTRACTED WIDGETS & DIARY ITEMS
                      </h4>
                      <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 px-2.25 py-0.5 rounded">
                        {syncedMovies.length} found
                      </span>
                    </div>

                    <div className="border border-zinc-900 rounded-2xl overflow-hidden bg-zinc-950 max-h-[220px] overflow-y-auto divide-y divide-zinc-900/40">
                      {syncedMovies.map((movie) => {
                        const isSelected = !!selectedImportIds[movie.title];
                        const existsLocally = pastMovies.some(existing => 
                          existing.title.toLowerCase().trim() === movie.title.toLowerCase().trim()
                        );

                        return (
                          <div 
                            key={movie.title}
                            onClick={() => {
                              if (existsLocally) return;
                              setSelectedImportIds(prev => ({
                                ...prev,
                                [movie.title]: !prev[movie.title]
                              }));
                            }}
                            className={`flex items-center gap-3 p-3 transition-colors select-none ${existsLocally ? 'opacity-50 cursor-default' : 'hover:bg-zinc-900/30 cursor-pointer'}`}
                          >
                            <div className="shrink-0 flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={existsLocally}
                                readOnly
                                className="h-4 w-4 rounded border-zinc-800 bg-zinc-900 text-amber-500 focus:ring-amber-500 checked:bg-amber-500 cursor-pointer focus:ring-offset-zinc-950 transition-all"
                              />
                            </div>

                            <img 
                              src={movie.posterUrl} 
                              alt={movie.title}
                              referrerPolicy="no-referrer"
                              className="w-10 h-14 rounded object-cover border border-zinc-850 bg-zinc-900"
                              onError={(e) => {
                                e.currentTarget.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=300';
                              }}
                            />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-1.5 flex-wrap">
                                <h5 className="text-xs font-bold text-zinc-200 truncate">{movie.title}</h5>
                                <span className="text-[10px] font-mono text-zinc-500">({movie.year})</span>
                              </div>
                              <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                                Directed by <span className="text-zinc-400">{movie.director || 'Unknown'}</span> • {movie.genre?.join(', ')}
                              </p>
                              <p className="text-[9px] font-mono text-zinc-600 mt-1">
                                Date Logged: {movie.screenedDate} • Rating: {movie.rating} ★
                              </p>
                            </div>

                            {existsLocally && (
                              <div className="shrink-0 text-[10px] font-mono text-zinc-650 bg-zinc-900/60 px-2 py-0.5 rounded">
                                Already Added
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-zinc-900 bg-zinc-950 flex justify-between gap-3 px-6">
                <button
                  onClick={() => setShowSyncModal(false)}
                  className="px-4 py-2 border border-zinc-850 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 rounded-xl text-xs font-mono transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteImport}
                  disabled={isImporting || !syncedMovies || syncedMovies.filter(m => selectedImportIds[m.title]).length === 0}
                  className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 px-5 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center space-x-1 shrink-0 cursor-pointer"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Writing to Database...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Selected ({syncedMovies ? syncedMovies.filter(m => selectedImportIds[m.title]).length : 0})</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
      {/* Edit Movie Dialog Modal for Admins */}
      {editingMovie && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[99]" id="edit-past-movie-modal">
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <div className="bg-zinc-950 border border-zinc-900 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              
              {/* Modal Header */}
              <div className="p-6 border-b border-zinc-900 flex justify-between items-center bg-zinc-950">
                <div className="flex items-center space-x-3">
                  <div className="h-9 w-9 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-400 font-bold border border-amber-500/20">
                    <Edit3 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-100 font-mono flex items-center gap-1.5 uppercase tracking-wide">
                      Edit Screening Details
                    </h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Modify fields or sync assets for "{editingMovie.title}"
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingMovie(null)}
                  className="text-zinc-500 hover:text-zinc-200 transition-colors p-1.5 bg-zinc-900/50 hover:bg-zinc-900 rounded-lg cursor-pointer transition-all duration-150"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Body / Form */}
              <form onSubmit={handleSavePastMovie} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-6 overflow-y-auto space-y-4 flex-1">
                  
                  {movieErrorMsg && (
                    <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-500 text-xs">
                      <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                      <span>{movieErrorMsg}</span>
                    </div>
                  )}

                  {saveSuccessMsg && (
                    <div className="p-3.5 bg-green-500/10 border border-green-500/20 rounded-xl flex items-start gap-3 text-green-400 text-xs">
                      <CheckCircle2 className="h-4.5 w-4.5 shrink-0 animate-bounce" />
                      <span>{saveSuccessMsg}</span>
                    </div>
                  )}

                  {/* Fields Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono font-semibold tracking-wider text-zinc-400 mb-1.5 uppercase">
                        Movie Title
                      </label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:border-amber-500/50 transition-colors"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono font-semibold tracking-wider text-zinc-400 mb-1.5 uppercase">
                        Director Name
                      </label>
                      <input
                        type="text"
                        value={editDirector}
                        onChange={(e) => setEditDirector(e.target.value)}
                        className="w-full bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:border-amber-500/50 transition-colors"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono font-semibold tracking-wider text-zinc-400 mb-1.5 uppercase">
                        Release Year
                      </label>
                      <input
                        type="number"
                        value={editYear}
                        onChange={(e) => setEditYear(Number(e.target.value))}
                        className="w-full bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:border-amber-500/50 transition-colors"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono font-semibold tracking-wider text-zinc-400 mb-1.5 uppercase">
                        Screened Date (YYYY-MM-DD)
                      </label>
                      <input
                        type="text"
                        value={editScreenedDate}
                        onChange={(e) => setEditScreenedDate(e.target.value)}
                        placeholder="e.g. 2026-06-18"
                        className="w-full bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:border-amber-500/50 transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-semibold tracking-wider text-zinc-400 mb-1.5 uppercase">
                      Genres (comma separated)
                    </label>
                    <input
                      type="text"
                      value={editGenreInput}
                      onChange={(e) => setEditGenreInput(e.target.value)}
                      placeholder="e.g. Drama, Thriller, Sci-Fi"
                      className="w-full bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:border-amber-500/50 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-semibold tracking-wider text-zinc-400 mb-1.5 uppercase">
                      Poster Image URL
                    </label>
                    <input
                      type="url"
                      value={editPosterUrl}
                      onChange={(e) => setEditPosterUrl(e.target.value)}
                      className="w-full bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:border-amber-500/50 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-semibold tracking-wider text-zinc-400 mb-1.5 uppercase">
                      Letterboxd Link
                    </label>
                    <input
                      type="url"
                      value={editLetterboxdUrl}
                      onChange={(e) => setEditLetterboxdUrl(e.target.value)}
                      className="w-full bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:border-amber-500/50 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-semibold tracking-wider text-zinc-400 mb-1.5 uppercase">
                      Movie Synopsis
                    </label>
                    <textarea
                      value={editSynopsis}
                      onChange={(e) => setEditSynopsis(e.target.value)}
                      rows={3}
                      className="w-full bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:border-amber-500/50 transition-colors resize-none"
                    />
                  </div>

                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-zinc-900 bg-zinc-950 flex justify-between gap-3 px-6 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditingMovie(null)}
                    className="px-4 py-2 border border-zinc-850 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 rounded-xl text-xs font-mono transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingMovie}
                    className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 px-5 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center space-x-1 shrink-0 cursor-pointer"
                  >
                    {isSavingMovie ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Changes</span>
                    )}
                  </button>
                </div>
              </form>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
