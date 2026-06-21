import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, ThumbsUp, Calendar, User, Search, Filter, 
  Plus, ArrowLeft, Star, Trash2, Send, Clapperboard, CheckCircle2, MessageCircle
} from 'lucide-react';
import { ClubDiscussion, DiscussionComment, User as UserType } from '../types';
import { letterboxdMovies } from '../letterboxdDb';

interface ClubDiscussionsProps {
  discussions: ClubDiscussion[];
  onAddDiscussion: (data: Omit<ClubDiscussion, 'id' | 'createdAt' | 'authorEmail' | 'authorName' | 'votes' | 'comments'>) => Promise<void>;
  onAddComment: (discussionId: string, content: string) => Promise<void>;
  onVoteDiscussion: (discussionId: string) => Promise<void>;
  onDeleteDiscussion?: (discussionId: string) => Promise<void>;
  currentUser: UserType | null;
  adminMode: boolean;
  focusedDiscussionId?: string | null;
  onSelectDiscussion?: (id: string | null) => void;
}

export default function ClubDiscussions({
  discussions,
  onAddDiscussion,
  onAddComment,
  onVoteDiscussion,
  onDeleteDiscussion,
  currentUser,
  adminMode,
  focusedDiscussionId,
  onSelectDiscussion
}: ClubDiscussionsProps) {
  const [selectedDiscId, setSelectedDiscId] = useState<string | null>(null);

  useEffect(() => {
    if (focusedDiscussionId) {
      setSelectedDiscId(focusedDiscussionId);
    }
  }, [focusedDiscussionId]);

  const handleSetSelectedDiscId = (id: string | null) => {
    setSelectedDiscId(id);
    if (onSelectDiscussion) {
      onSelectDiscussion(id);
    }
  };
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  // Form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'Review' | 'Discussion' | 'Theory' | 'Question' | 'Event'>('Discussion');
  const [newContent, setNewContent] = useState('');
  const [selectedMovieSlug, setSelectedMovieSlug] = useState('');
  const [movieSearchTerm, setMovieSearchTerm] = useState('');
  const [newRating, setNewRating] = useState<number | null>(5);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Comment state
  const [commentInput, setCommentInput] = useState('');
  const [commentError, setCommentError] = useState('');

  // Movie dropdown search
  const [showMovieDropdown, setShowMovieDropdown] = useState(false);

  const filteredMovies = letterboxdMovies.filter(m => 
    m.title.toLowerCase().includes(movieSearchTerm.toLowerCase()) ||
    m.director.toLowerCase().includes(movieSearchTerm.toLowerCase())
  );

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setErrorMsg('You must have logged in using your institute email to start a discussion thread.');
      return;
    }
    if (!newTitle.trim()) {
      setErrorMsg('Please specify a title for your thread.');
      return;
    }
    if (!newContent.trim()) {
      setErrorMsg('Please write some content detailing your review or discussion points.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const movieMatch = letterboxdMovies.find(m => m.id === selectedMovieSlug);
      
      const savePromise = onAddDiscussion({
        title: newTitle.trim(),
        category: newCategory,
        content: newContent.trim(),
        movieTitle: movieMatch?.title || (movieSearchTerm.trim() !== '' ? movieSearchTerm.trim() : undefined),
        movieSlug: movieMatch?.id || undefined,
        rating: newCategory === 'Review' ? newRating : undefined
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("LOCAL_SYNC")), 2000);
      });

      await Promise.race([savePromise, timeoutPromise]);

      // Reset
      setNewTitle('');
      setNewCategory('Discussion');
      setNewContent('');
      setSelectedMovieSlug('');
      setMovieSearchTerm('');
      setNewRating(5);
      setSuccessMsg('Your discussion thread has been launched successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
      setShowCreateModal(false);
    } catch (err: any) {
      if (err.message === "LOCAL_SYNC") {
        setNewTitle('');
        setNewCategory('Discussion');
        setNewContent('');
        setSelectedMovieSlug('');
        setMovieSearchTerm('');
        setNewRating(5);
        setSuccessMsg('Saved! Thread will update as soon as background sync finishes...');
        setTimeout(() => setSuccessMsg(''), 4000);
        setShowCreateModal(false);
      } else {
        setErrorMsg('Failed to launch thread: ' + (err.message || String(err)));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent, discussionId: string) => {
    e.preventDefault();
    if (!currentUser) {
      setCommentError('You must be signed in with your student email to post comments.');
      return;
    }
    const trimmedInput = commentInput.trim();
    if (!trimmedInput) {
      return;
    }

    const backupInput = commentInput;
    setCommentInput('');
    setCommentError('');
    try {
      await onAddComment(discussionId, trimmedInput);
    } catch (err: any) {
      setCommentInput(backupInput);
      setCommentError('Failed to post reply.');
    }
  };

  // Find selected discussion details
  const activeDiscussion = discussions.find(d => d.id === selectedDiscId);

  // Filter discussions list
  const filteredDiscussions = discussions.filter(disc => {
    const matchesCategory = activeCategory === 'All' || disc.category === activeCategory;
    const matchesSearch = 
      disc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      disc.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (disc.movieTitle && disc.movieTitle.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Review': return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      case 'Theory': return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      case 'Question': return 'text-sky-400 bg-sky-500/10 border-sky-500/20';
      case 'Event': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      default: return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    }
  };

  // Star rendering helper
  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center space-x-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-3.5 w-3.5 ${
              star <= rating ? 'text-amber-400 fill-amber-400' : 'text-zinc-700'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Detail Thread View OR Grid View */}
      {activeDiscussion ? (
        <div className="space-y-6">
          {/* Back button */}
          <button
            onClick={() => {
              handleSetSelectedDiscId(null);
              setCommentError('');
              setCommentInput('');
            }}
            className="flex items-center space-x-1.5 text-xs text-zinc-400 hover:text-white font-mono cursor-pointer transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Forums</span>
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Col: Main thread details & replies */}
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-6 sm:p-8 space-y-5 shadow-2xl relative">
                
                {/* Author Info & Date */}
                <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-full border border-zinc-800 bg-zinc-900 flex items-center justify-center font-bold text-amber-500 font-serif shadow-inner">
                      {activeDiscussion.authorName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-200">{activeDiscussion.authorName}</h4>
                      <p className="text-[10.5px] text-zinc-500 font-mono mt-0.5">
                        {activeDiscussion.authorEmail.split('@')[0]} • {new Date(activeDiscussion.createdAt).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}
                      </p>
                    </div>
                  </div>

                  <span className={`text-[10px] uppercase font-mono px-3 py-1 bg-zinc-900 rounded-md border font-bold tracking-widest ${getCategoryColor(activeDiscussion.category)}`}>
                    {activeDiscussion.category}
                  </span>
                </div>

                {/* Cover poster snippet for associated movie in mobile/main */}
                {activeDiscussion.movieTitle && (
                  <div className="flex items-center gap-3.5 bg-zinc-900/40 border border-zinc-900 p-3.5 rounded-xl text-xs">
                    <span className="font-mono text-zinc-500 uppercase text-[9.5px]">Subject Cinema:</span>
                    <span className="font-bold text-zinc-200">{activeDiscussion.movieTitle}</span>
                    {activeDiscussion.rating && (
                      <div className="flex items-center gap-1 border-l border-zinc-800 pl-3.5 ml-2">
                        <span className="text-[10.5px] text-zinc-400 font-mono">Rating:</span>
                        {renderStars(activeDiscussion.rating)}
                      </div>
                    )}
                  </div>
                )}

                {/* Content */}
                <div className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                  {activeDiscussion.content}
                </div>

                {/* Post Actions (Like, Delete) */}
                <div className="flex items-center justify-between border-t border-zinc-900 pt-5">
                  <button
                    onClick={() => onVoteDiscussion(activeDiscussion.id)}
                    className={`flex items-center space-x-2 border px-4 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer ${
                      currentUser && activeDiscussion.votes.includes(currentUser.email)
                        ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                        : 'border-zinc-850 bg-zinc-900/40 text-zinc-400 hover:text-white hover:border-zinc-700'
                    }`}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                    <span>Recommend post ({activeDiscussion.votes.length})</span>
                  </button>

                  {(adminMode || (currentUser && currentUser.email === activeDiscussion.authorEmail)) && onDeleteDiscussion && (
                    <button
                      onClick={async () => {
                        if (window.confirm('Are you strictly sure you want to delete this thread permanently?')) {
                          await onDeleteDiscussion(activeDiscussion.id);
                          handleSetSelectedDiscId(null);
                        }
                      }}
                      className="text-xs text-zinc-650 hover:text-red-400 font-mono flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete post</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Comments Feed Panel */}
              <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-6 space-y-4 shadow-xl">
                <h3 className="text-xs uppercase font-mono tracking-widest text-zinc-400 font-semibold flex items-center gap-1.5 border-b border-zinc-900 pb-3">
                  <MessageSquare className="h-4 w-4 text-amber-500" />
                  <span>Interactive Replies ({activeDiscussion.comments.length})</span>
                </h3>

                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scroll">
                  {activeDiscussion.comments.length === 0 ? (
                    <div className="p-8 text-center bg-zinc-900/10 border border-dashed border-zinc-850 rounded-2xl">
                      <p className="text-xs text-zinc-500 italic">No responses logged yet. Be the first to add your perspective below!</p>
                    </div>
                  ) : (
                    activeDiscussion.comments.map((comm) => (
                      <div key={comm.id} className="bg-zinc-900/20 p-4 rounded-xl border border-zinc-900/50 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-zinc-300 flex items-center gap-1">
                            <User className="h-3 w-3 text-amber-500/80" />
                            {comm.authorName}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {comm.authorEmail.split('@')[0]} • {new Date(comm.createdAt).toLocaleDateString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed pl-4 font-sans whitespace-pre-wrap">
                          {comm.content}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {/* Reply Form */}
                <div className="border-t border-zinc-900 pt-4">
                  {currentUser ? (
                    <form onSubmit={(e) => handleCommentSubmit(e, activeDiscussion.id)} className="space-y-2">
                      <div className="relative">
                        <textarea
                          placeholder="Exchange responses, ask questions, or critique constructively..."
                          value={commentInput}
                          onChange={(e) => {
                            setCommentInput(e.target.value);
                            if (commentError) setCommentError('');
                          }}
                          rows={3}
                          className="w-full rounded-xl border border-zinc-850 bg-zinc-900/40 px-4 py-3 text-xs text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 font-sans leading-relaxed"
                        />
                        <button
                          type="submit"
                          className="absolute right-3.5 bottom-3.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 p-1.5 rounded-lg transition-colors cursor-pointer"
                          title="Post reply"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      </div>

                      {commentError && (
                        <span className="text-[11px] text-red-400 block">{commentError}</span>
                      )}
                    </form>
                  ) : (
                    <div className="bg-zinc-900/30 rounded-xl p-4 text-center border border-dashed border-zinc-850">
                      <p className="text-xs text-zinc-500">
                        Please <span className="text-amber-400 underline font-semibold">Login through Institute ID</span> to exchange comments on the forum boards.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Col: Movie Metadata Widget */}
            <div className="space-y-6">
              {activeDiscussion.movieSlug ? (() => {
                const companionMovie = letterboxdMovies.find(m => m.id === activeDiscussion.movieSlug);
                if (!companionMovie) return null;

                return (
                  <div className="rounded-2xl border border-zinc-900 bg-zinc-950 overflow-hidden shadow-xl">
                    <div className="relative h-44 aspect-video bg-zinc-900 overflow-hidden">
                      <img 
                        src={companionMovie.backdropUrl || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600'} 
                        alt="Backdrop" 
                        className="w-full h-full object-cover opacity-60"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent"></div>
                    </div>
                    
                    <div className="p-5 space-y-4">
                      <div className="flex gap-4">
                        <img 
                          src={companionMovie.posterUrl} 
                          alt="Poster" 
                          className="w-16 h-24 rounded-lg object-cover border border-zinc-850 flex-shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div className="space-y-1">
                          <h4 className="font-serif text-sm font-bold text-zinc-100">{companionMovie.title}</h4>
                          <p className="text-[11px] text-zinc-400">{companionMovie.director} • {companionMovie.year}</p>
                          <div className="flex flex-wrap gap-1 pt-1.5">
                            {companionMovie.genre.slice(0, 2).map((g) => (
                              <span key={g} className="text-[9px] font-mono bg-zinc-900 border border-zinc-850 px-1.5 py-0.5 rounded text-zinc-450 uppercase">{g}</span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="text-[11.5px] leading-relaxed text-zinc-400 font-sans italic border-t border-zinc-900/60 pt-4">
                        "{companionMovie.synopsis}"
                      </div>
                    </div>
                  </div>
                );
              })() : (
                <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-5 space-y-2 text-center border-dashed">
                  <Clapperboard className="h-8 w-8 text-zinc-700 mx-auto" />
                  <h4 className="text-xs font-mono uppercase text-zinc-400 font-semibold">General Discussion</h4>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    This thread isn't tied to any specific screening film in our active Letterboxd registry. It covers global movements, theory concepts, or academic research!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* DISCUSSION MAIN DIRECTORY */
        <div className="space-y-6 animate-fade-in">
          {/* Header row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-900 pb-5 gap-4">
            <div>
              <span className="text-amber-500 font-mono text-xs uppercase tracking-widest font-semibold flex items-center gap-1.5">
                <MessageCircle className="h-4 w-4" /> Discussion Boards
              </span>
              <h2 className="font-serif text-3xl font-bold text-zinc-100 tracking-tight sm:text-4xl mt-1">
                Reviews & Discussions
              </h2>
              <p className="text-xs text-zinc-500 mt-1 max-w-xl">
                The academic film forum of IISER Kolkata. Write elaborate film critiques, exchange scene theories, or post general questions.
              </p>
            </div>

            <button
              onClick={() => {
                if (!currentUser) {
                  alert('Please log in using your institute email to start a discussion thread!');
                  return;
                }
                setShowCreateModal(true);
              }}
              className="flex items-center justify-center space-x-1.5 bg-amber-500 hover:bg-amber-600 font-semibold text-zinc-950 px-4 py-2.5 h-11 rounded-xl text-xs font-mono transition-colors shadow-lg shadow-amber-500/5 cursor-pointer self-start md:self-auto"
            >
              <Plus className="h-4 w-4" />
              <span>Launch Thread</span>
            </button>
          </div>

          {successMsg && (
            <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-4 flex items-center space-x-3.5 text-xs text-green-400 select-none animate-bounce">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <p className="font-sans">{successMsg}</p>
            </div>
          )}

          {/* Search, Filter Category bar */}
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-zinc-950 p-4 rounded-2xl border border-zinc-900">
            {/* Search Input */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search forum headings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-zinc-850 bg-zinc-900/30 pl-9 pr-4 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              />
            </div>

            {/* Filter tags navigation */}
            <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar py-0.5">
              {['All', 'Review', 'Discussion', 'Theory', 'Question', 'Event'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-mono transition-all uppercase tracking-wider shrink-0 cursor-pointer ${
                    activeCategory === cat
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-400 font-bold'
                      : 'border-zinc-900 bg-zinc-900/20 text-zinc-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Discussion grids list */}
          {filteredDiscussions.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-900 bg-zinc-950/40 p-12 text-center text-zinc-500 flex flex-col justify-center items-center space-y-3">
              <div className="h-10 w-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-650 mb-1.5">
                <MessageSquare className="h-5 w-5" />
              </div>
              <p className="text-xs italic">No threads matching "{searchQuery}" under {activeCategory} category.</p>
              <button
                onClick={() => { setSearchQuery(''); setActiveCategory('All'); }}
                className="text-amber-500/80 hover:text-amber-400 font-mono text-[10.5px] font-semibold underline cursor-pointer"
              >
                Reset Search Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredDiscussions.map((disc) => (
                <div
                  key={disc.id}
                  onClick={() => handleSetSelectedDiscId(disc.id)}
                  className="group flex flex-col justify-between rounded-2xl border border-zinc-900 bg-zinc-950 p-5 shadow-lg hover:border-zinc-800 transition-all duration-300 cursor-pointer"
                >
                  <div className="space-y-3.5">
                    {/* Header line: Category tag & rating info */}
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded border tracking-wider font-bold ${getCategoryColor(disc.category)}`}>
                        {disc.category}
                      </span>
                      {disc.createdAt && (
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {new Date(disc.createdAt).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                        </span>
                      )}
                    </div>

                    {/* Thread Title & subject film */}
                    <div className="space-y-1">
                      <h3 className="font-serif text-base font-bold text-zinc-200 group-hover:text-amber-400 transition-colors line-clamp-1">
                        {disc.title}
                      </h3>
                      {disc.movieTitle && (
                        <p className="text-[11px] text-zinc-500 font-mono leading-none">
                          Subject: <span className="font-bold text-zinc-300 font-sans">{disc.movieTitle}</span>
                          {disc.rating && <span className="text-zinc-600 font-normal"> ({disc.rating} ★)</span>}
                        </p>
                      )}
                    </div>

                    {/* Synopsis content preview */}
                    <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3 font-sans">
                      {disc.content}
                    </p>
                  </div>

                  {/* Footing detail row */}
                  <div className="flex items-center justify-between border-t border-zinc-900/60 mt-4 pt-3 text-[11px] text-zinc-500">
                    <div className="flex items-center space-x-1 font-sans">
                      <div className="h-5 w-5 rounded-full border border-zinc-850 bg-zinc-900 flex items-center justify-center font-bold text-amber-500 text-[10px]">
                        {disc.authorName.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-zinc-400 truncate max-w-[100px]">{disc.authorName}</span>
                    </div>

                    <div className="flex items-center space-x-3 font-mono">
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3" />
                        {disc.votes.length}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {disc.comments.length}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CREATE MODAL SCREEN */}
          {showCreateModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fade-in">
              <div className="w-full max-w-2xl rounded-2xl border border-zinc-c800 bg-zinc-950 p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar">
                
                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setErrorMsg('');
                  }}
                  className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-zinc-200 rounded-lg cursor-pointer"
                  title="Close Modal"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                <div className="flex flex-col mb-5">
                  <h3 className="font-serif text-lg font-bold text-zinc-100 flex items-center gap-2">
                    <Plus className="h-5 w-5 text-amber-500" />
                    <span>Launch Discussion Thread</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Compose a brilliant review log, scene theory, or screening post on the forum board.
                  </p>
                </div>

                <form onSubmit={handleCreateSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Category Selection */}
                    <div>
                      <label className="block text-[10.5px] font-mono text-zinc-400 mb-1.5 uppercase tracking-wider">
                        Thread Category
                      </label>
                      <select
                        value={newCategory}
                        onChange={(e: any) => {
                          setNewCategory(e.target.value);
                          if (e.target.value !== 'Review') setNewRating(null);
                          else setNewRating(5);
                        }}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
                      >
                        <option value="Discussion">Discussion</option>
                        <option value="Review">Critic Review</option>
                        <option value="Theory">Theory/Analysis</option>
                        <option value="Question">General Question</option>
                        <option value="Event">Special Event</option>
                      </select>
                    </div>

                    {/* Movie Suggestion/Selection Search autocomplete */}
                    <div className="md:col-span-2 relative">
                      <label className="block text-[10.5px] font-mono text-zinc-400 mb-1.5 uppercase tracking-wider">
                        Associated Cinema Title (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="Search standard cinephile movies or type custom title..."
                        value={movieSearchTerm}
                        onChange={(e) => {
                          setMovieSearchTerm(e.target.value);
                          const movieMatch = letterboxdMovies.find(m => m.title.toLowerCase() === e.target.value.toLowerCase());
                          if (movieMatch) {
                            setSelectedMovieSlug(movieMatch.id);
                          } else {
                            setSelectedMovieSlug('');
                          }
                          setShowMovieDropdown(true);
                        }}
                        onFocus={() => setShowMovieDropdown(true)}
                        className="w-full rounded-lg border border-zinc-850 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-650 focus:border-amber-500 focus:outline-none"
                      />
                      {showMovieDropdown && movieSearchTerm.trim() !== '' && (
                        <div className="absolute left-0 right-0 top-16 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl max-h-32 overflow-y-auto z-50 py-1 font-sans text-xs">
                          {filteredMovies.length === 0 ? (
                            <div className="p-2 text-zinc-500 italic text-[11px]">Hit Enter to leave custom film title "{movieSearchTerm}"</div>
                          ) : (
                            filteredMovies.slice(0, 4).map((movie) => (
                              <button
                                key={movie.id}
                                type="button"
                                onClick={() => {
                                  setSelectedMovieSlug(movie.id);
                                  setMovieSearchTerm(movie.title);
                                  setShowMovieDropdown(false);
                                }}
                                className="w-full text-left p-2 hover:bg-zinc-800 hover:text-amber-400 block truncate"
                              >
                                {movie.title} ({movie.year}) • <span className="text-zinc-500">{movie.director}</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rating selection if Category is Review */}
                  {newCategory === 'Review' && (
                    <div className="flex items-center space-x-3.5 bg-zinc-900/20 border border-zinc-900 p-3 rounded-lg">
                      <span className="text-xs font-mono text-zinc-400">Rating log:</span>
                      <div className="flex space-x-1">
                        {[1, 2, 3, 4, 5].map((stars) => (
                          <button
                            key={stars}
                            type="button"
                            onClick={() => setNewRating(stars)}
                            className="cursor-pointer transition-transform duration-200 hover:scale-108"
                          >
                            <Star
                              className={`h-4 w-4 ${
                                stars <= (newRating || 0)
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-zinc-700'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                      <span className="text-xs text-amber-500 font-mono font-bold">({newRating}/5 Stars)</span>
                    </div>
                  )}

                  {/* Thread Title */}
                  <div>
                    <label className="block text-[10.5px] font-mono text-zinc-400 mb-1.5 uppercase tracking-wider">
                      Thread Title / Headline
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Parallels between Denis Villeneuve's Dune and Lawrence of Arabia"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full rounded-lg border border-zinc-850 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-650 focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  {/* Content markup */}
                  <div>
                    <label className="block text-[10.5px] font-mono text-zinc-400 mb-1.5 uppercase tracking-wider">
                      Detailed Content
                    </label>
                    <textarea
                      required
                      rows={6}
                      placeholder="Explain your scene theory, script details, or detailed review content here..."
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      className="w-full rounded-lg border border-zinc-850 bg-zinc-900/60 px-4 py-3 text-xs text-zinc-100 placeholder-zinc-550 focus:border-amber-500 focus:outline-none leading-relaxed font-sans"
                    />
                  </div>

                  {errorMsg && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/25 p-3 text-xs text-red-400">
                      {errorMsg}
                    </div>
                  )}

                  <div className="flex justify-end space-x-3 pt-3 border-t border-zinc-900">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false);
                        setErrorMsg('');
                      }}
                      className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="bg-amber-500 hover:bg-amber-600 text-zinc-950 px-5 py-2 rounded-lg text-xs font-bold font-mono transition-colors disabled:opacity-50"
                    >
                      {isSubmitting ? 'LAUNCHING...' : 'LAUNCH FORUM'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
