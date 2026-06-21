import React, { useState } from 'react';
import { 
  User as UserIcon, 
  MessageSquare, 
  Sparkles, 
  Heart, 
  Calendar, 
  PenTool, 
  Edit3, 
  Trash2, 
  Clock, 
  Star, 
  ExternalLink,
  ChevronRight,
  UserCheck
} from 'lucide-react';
import { User, PastMovie, ClubDiscussion, Recommendation, Poll, UserReview } from '../types';

interface UserProfileProps {
  currentUser: User | null;
  pastMovies: PastMovie[];
  discussions: ClubDiscussion[];
  recommendations: Recommendation[];
  polls: Poll[];
  setActiveTab: (tab: string) => void;
  setFocusedDiscussionId: (id: string | null) => void;
  onUpdateReview: (movieId: string, reviewId: string, comment: string, rating: number) => Promise<void>;
  onDeleteReview: (movieId: string, reviewId: string) => Promise<void>;
}

export default function UserProfile({
  currentUser,
  pastMovies,
  discussions,
  recommendations,
  polls,
  setActiveTab,
  setFocusedDiscussionId,
  onUpdateReview,
  onDeleteReview
}: UserProfileProps) {
  const [activeSubTab, setActiveSubTab] = useState<'reviews' | 'discussions' | 'comments' | 'recommendations' | 'votes'>('reviews');
  
  // Interactive editing state for reviews accessed via Profile
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editMovieId, setEditMovieId] = useState<string | null>(null);
  const [editComment, setEditComment] = useState('');
  const [editRating, setEditRating] = useState(5);
  const [isSaving, setIsSaving] = useState(false);

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="h-16 w-16 mb-6 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
          <UserIcon className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-serif font-bold text-zinc-200">Access Restricted</h3>
        <p className="text-sm text-zinc-500 mt-2 max-w-sm">
          Please log in using your official IISER Kolkata account to view your activity backlog and customize your profile preferences.
        </p>
      </div>
    );
  }

  // 1. Gather all user-authored reviews
  const userReviews = pastMovies.flatMap(movie => 
    movie.reviews
      .filter(rev => rev.userEmail === currentUser.email)
      .map(rev => ({
        ...rev,
        movieId: movie.id,
        movieTitle: movie.title,
        posterUrl: movie.posterUrl,
        year: movie.year
      }))
  );

  // 2. Gather user-started discussion threads
  const userDiscussions = discussions.filter(disc => disc.authorEmail === currentUser.email);

  // 3. Gather user comments
  const userComments = discussions.flatMap(disc => 
    disc.comments
      .filter(c => c.authorEmail === currentUser.email)
      .map(c => ({
        ...c,
        discussionId: disc.id,
        discussionTitle: disc.title,
        category: disc.category
      }))
  );

  // 4. Gather user recommendations
  const userRecommendations = recommendations.filter(rec => rec.suggestedBy === currentUser.email);

  // 5. Gather user poll votes
  const userVotes = polls.flatMap(poll => 
    poll.options
      .filter(opt => opt.votes.includes(currentUser.email))
      .map(opt => ({
        pollId: poll.id,
        pollQuestion: poll.question,
        optionTitle: opt.title,
        optionDirector: opt.director,
        optionYear: opt.year
      }))
  );

  const startEditingReview = (rev: any) => {
    setEditingReviewId(rev.id);
    setEditMovieId(rev.movieId);
    setEditComment(rev.comment);
    setEditRating(rev.rating);
  };

  const handleSaveEdit = async () => {
    if (!editMovieId || !editingReviewId) return;
    if (!editComment.trim()) return;
    
    setIsSaving(true);
    try {
      await onUpdateReview(editMovieId, editingReviewId, editComment, editRating);
      setEditingReviewId(null);
      setEditMovieId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (movieId: string, reviewId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete your post-screening review log? This cannot be undone.")) return;
    try {
      await onDeleteReview(movieId, reviewId);
    } catch (e) {
      console.error(e);
    }
  };

  const jumpToDiscussion = (discId: string) => {
    setFocusedDiscussionId(discId);
    setActiveTab('discussions');
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
              className={`h-3.5 w-3.5 ${
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

  return (
    <div className="space-y-8">
      {/* Profile Header Cards */}
      <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-6 md:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row items-center gap-6 justify-between">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            <div className="relative h-20 w-20 rounded-full border-2 border-amber-500/20 bg-zinc-900 flex items-center justify-center text-amber-500 font-extrabold text-3xl overflow-hidden shadow-lg shadow-amber-500/5">
              {currentUser.photoURL ? (
                <img 
                  src={currentUser.photoURL} 
                  alt={currentUser.name} 
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span>{currentUser.name.charAt(0).toUpperCase()}</span>
              )}
              <div className="absolute right-0 bottom-0 h-3 w-3 rounded-full bg-green-500 border-2 border-zinc-950"></div>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h2 className="text-2xl font-serif font-extrabold text-zinc-100 uppercase tracking-wide">
                  {currentUser.name}
                </h2>
                {currentUser.role === 'admin' ? (
                  <span className="flex items-center gap-1 text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full uppercase">
                    <UserCheck className="h-3 w-3" /> Admin
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full uppercase">
                    IISER-K Member
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 font-mono tracking-wide">{currentUser.email}</p>
              <p className="text-[11px] text-zinc-500 font-mono italic">
                Active Member since {currentUser.lastActive ? new Date(currentUser.lastActive).toLocaleDateString() : 'June 2026'}
              </p>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full md:w-auto text-center font-mono">
            <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl px-4 py-3 min-w-[90px]">
              <span className="text-xs text-zinc-500 block">Reviews</span>
              <span className="text-lg font-bold text-amber-400">{userReviews.length}</span>
            </div>
            <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl px-4 py-3 min-w-[90px]">
              <span className="text-xs text-zinc-500 block">Threads</span>
              <span className="text-lg font-bold text-amber-400">{userDiscussions.length}</span>
            </div>
            <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl px-4 py-3 min-w-[90px]">
              <span className="text-xs text-zinc-500 block">Comments</span>
              <span className="text-lg font-bold text-amber-400">{userComments.length}</span>
            </div>
            <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl px-4 py-3 min-w-[90px]">
              <span className="text-xs text-zinc-500 block">Voted</span>
              <span className="text-lg font-bold text-amber-400">{userVotes.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Sections */}
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-zinc-900 overflow-x-auto gap-2 pb-1 scrollbar-none">
          {[
            { id: 'reviews', label: 'My Reviews', count: userReviews.length },
            { id: 'discussions', label: 'My Threads', count: userDiscussions.length },
            { id: 'comments', label: 'My Comments', count: userComments.length },
            { id: 'recommendations', label: 'Recommendations', count: userRecommendations.length },
            { id: 'votes', label: 'Poll Votes', count: userVotes.length }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveSubTab(tab.id as any);
                setEditingReviewId(null);
              }}
              className={`px-4 py-2 text-xs font-mono font-medium rounded-lg transition-all shrink-0 border uppercase tracking-wider ${
                activeSubTab === tab.id
                  ? 'bg-zinc-900 text-amber-400 border-zinc-805 ring-1 ring-amber-500/25'
                  : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-900/50'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 opacity-60 text-[10px] bg-black/40 px-1.5 py-0.5 rounded-md">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Tab Panels */}
        <div className="space-y-4">
          {/* Reviews Active Panel */}
          {activeSubTab === 'reviews' && (
            <div className="space-y-4">
              {userReviews.length === 0 ? (
                <div className="bg-zinc-900/20 border border-dashed border-zinc-900 rounded-2xl py-12 px-4 text-center">
                  <p className="text-xs text-zinc-500 italic">You haven't written any cinema screening reviews yet.</p>
                  <button
                    onClick={() => setActiveTab('past')}
                    className="mt-3 text-xs text-amber-400 hover:underline font-mono"
                  >
                    Go to Past Screenings to add a Review Log →
                  </button>
                </div>
              ) : (
                userReviews.map((rev) => {
                  const isEditing = editingReviewId === rev.id;
                  return (
                    <div key={rev.id} className="bg-zinc-950 border border-zinc-900 rounded-xl p-5 hover:border-zinc-800 transition-colors">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center space-x-3.5">
                          <img 
                            src={rev.posterUrl} 
                            alt={rev.movieTitle} 
                            className="h-14 w-10 object-cover rounded-md border border-zinc-800 shadow shrink-0" 
                          />
                          <div>
                            <h4 className="text-sm font-serif font-bold text-zinc-100">
                              {rev.movieTitle} <span className="text-zinc-500 text-xs font-normal">({rev.year})</span>
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              {!isEditing ? (
                                <>
                                  {renderStars(rev.rating)}
                                  <span className="text-[10px] font-mono text-zinc-500">
                                    Logged on {new Date(rev.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </span>
                                </>
                              ) : (
                                <div className="flex items-center space-x-2">
                                  <span className="text-[10px] uppercase font-mono text-zinc-400">Rating:</span>
                                  {renderStars(editRating, true, setEditRating)}
                                  <span className="text-xs font-mono font-bold text-amber-500 mt-0.5">({editRating}/5)</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Edit Action Triggers */}
                        {!isEditing ? (
                          <div className="flex items-center gap-1.5 self-end sm:self-auto font-mono text-[11px]">
                            <button
                              onClick={() => startEditingReview(rev)}
                              className="flex items-center space-x-1 border border-zinc-850 bg-zinc-900/60 hover:bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-amber-400 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleDelete(rev.movieId, rev.id)}
                              className="flex items-center space-x-1 border border-zinc-850 bg-zinc-900/60 hover:bg-zinc-900 text-zinc-400 hover:text-red-400 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 self-end sm:self-auto font-mono text-[11px]">
                            <button
                              disabled={isSaving}
                              onClick={handleSaveEdit}
                              className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-zinc-950 px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 cursor-pointer disabled:opacity-55"
                            >
                              {isSaving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              disabled={isSaving}
                              onClick={() => setEditingReviewId(null)}
                              className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer disabled:opacity-55"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Comment text body or Edit Field */}
                      <div className="mt-4">
                        {!isEditing ? (
                          <p className="text-xs text-zinc-400 bg-zinc-900/30 border border-zinc-900 px-4 py-3 rounded-lg italic">
                            "{rev.comment}"
                          </p>
                        ) : (
                          <textarea
                            rows={2}
                            value={editComment}
                            onChange={(e) => setEditComment(e.target.value)}
                            placeholder="Add your review..."
                            className="w-full text-xs text-zinc-250 bg-zinc-900 border border-zinc-850 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50"
                          />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Discussions Active Panel */}
          {activeSubTab === 'discussions' && (
            <div className="space-y-4">
              {userDiscussions.length === 0 ? (
                <div className="bg-zinc-900/20 border border-dashed border-zinc-900 rounded-2xl py-12 px-4 text-center">
                  <p className="text-xs text-zinc-500 italic">You haven't launched any discussion threads yet.</p>
                  <button
                    onClick={() => setActiveTab('discussions')}
                    className="mt-3 text-xs text-amber-400 hover:underline font-mono"
                  >
                    Go to Discussions to start a Thread Log →
                  </button>
                </div>
              ) : (
                userDiscussions.map((disc) => (
                  <div 
                    key={disc.id} 
                    onClick={() => jumpToDiscussion(disc.id)}
                    className="bg-zinc-955 border border-zinc-900 rounded-xl p-5 hover:border-zinc-800 transition-all cursor-pointer group flex flex-col sm:flex-row justify-between items-start gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded-md uppercase tracking-wider block">
                          {disc.category}
                        </span>
                        {disc.movieTitle && (
                          <span className="text-[11px] font-mono text-amber-500 block max-w-xs truncate">
                            🍿 {disc.movieTitle}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-sans font-bold text-zinc-100 group-hover:text-amber-400 transition-colors leading-snug">
                        {disc.title}
                      </h4>
                      <p className="text-xs text-zinc-400 line-clamp-2 max-w-3xl">
                        {disc.content}
                      </p>
                    </div>

                    <div className="flex items-center space-x-4 self-end sm:self-center shrink-0">
                      <div className="flex items-center text-zinc-500 text-xs font-mono space-x-2">
                        <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5 text-red-500/80 fill-red-500/10" /> {disc.votes.length}</span>
                        <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> {disc.comments.length}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-zinc-650 group-hover:text-amber-500 transition-colors" />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Comments Active Panel */}
          {activeSubTab === 'comments' && (
            <div className="space-y-4">
              {userComments.length === 0 ? (
                <div className="bg-zinc-900/20 border border-dashed border-zinc-900 rounded-2xl py-12 px-4 text-center">
                  <p className="text-xs text-zinc-500 italic">You haven't written any discussion comments yet.</p>
                  <button
                    onClick={() => setActiveTab('discussions')}
                    className="mt-3 text-xs text-amber-400 hover:underline font-mono"
                  >
                    Go to Discussion Forums to write review comments →
                  </button>
                </div>
              ) : (
                userComments.map((comment) => (
                  <div 
                    key={comment.id}
                    onClick={() => jumpToDiscussion(comment.discussionId)}
                    className="bg-zinc-950 border border-zinc-900 rounded-xl p-5 hover:border-zinc-800 transition-all cursor-pointer group flex flex-col gap-3"
                  >
                    <div className="flex items-start sm:items-center justify-between flex-wrap gap-2 text-zinc-450 border-b border-zinc-900/70 pb-2">
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5 text-amber-500/80" />
                        <span className="text-xs font-mono text-zinc-400">
                          Commented inside:
                        </span>
                        <span className="text-xs font-sans font-bold text-zinc-200 group-hover:text-amber-400 transition-colors leading-tight truncate max-w-sm sm:max-w-md">
                          {comment.discussionTitle}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="text-xs text-zinc-300 italic pl-3 border-l-2 border-zinc-800 py-1">
                      "{comment.content}"
                    </div>

                    <span className="text-[10px] font-mono text-amber-500/70 flex items-center gap-0.5 justify-end">
                      Open Thread <ChevronRight className="h-3 w-3 mt-0.5" />
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Recommendations Active Panel */}
          {activeSubTab === 'recommendations' && (
            <div className="space-y-4">
              {userRecommendations.length === 0 ? (
                <div className="bg-zinc-900/20 border border-dashed border-zinc-900 rounded-2xl py-12 px-4 text-center">
                  <p className="text-xs text-zinc-500 italic">You haven't recommended any movies yet.</p>
                  <button
                    onClick={() => setActiveTab('recommendations')}
                    className="mt-3 text-xs text-amber-400 hover:underline font-mono"
                  >
                    Recommend films for campus screenings →
                  </button>
                </div>
              ) : (
                userRecommendations.map((rec) => (
                  <div key={rec.id} className="bg-zinc-950 border border-zinc-900 rounded-xl p-5 flex flex-col md:flex-row justify-between gap-5">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-serif font-bold text-zinc-100">
                          {rec.title} <span className="text-zinc-500 font-normal">({rec.year})</span>
                        </span>
                        <span className="text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono px-2 py-0.5 rounded uppercase">
                          {rec.genre}
                        </span>
                      </div>
                      
                      <p className="text-xs text-zinc-400">
                        Directed by <b className="text-zinc-300">{rec.director}</b>
                      </p>
                      <p className="text-xs text-zinc-500 bg-zinc-900/35 p-3 rounded-lg italic">
                        "{rec.notes}"
                      </p>
                    </div>

                    <div className="flex flex-row md:flex-col items-end justify-between font-mono text-[10px] text-zinc-500 shrink-0 border-t md:border-t-0 border-zinc-900 pt-3 md:pt-0">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Suggested {new Date(rec.suggestedAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm bg-amber-500/5 text-amber-400 border border-amber-500/10 rounded-lg px-2.5 py-1">
                        <Heart className="h-3.5 w-3.5 fill-amber-500/10 text-amber-400" />
                        <b>{rec.votes.length} votes</b>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Poll Votes Active Panel */}
          {activeSubTab === 'votes' && (
            <div className="space-y-4">
              {userVotes.length === 0 ? (
                <div className="bg-zinc-900/20 border border-dashed border-zinc-900 rounded-2xl py-12 px-4 text-center">
                  <p className="text-xs text-zinc-500 italic">You haven't participated in any active polls yet.</p>
                  <button
                    onClick={() => setActiveTab('polls')}
                    className="mt-3 text-xs text-amber-400 hover:underline font-mono"
                  >
                    Check active polls to cast ballot →
                  </button>
                </div>
              ) : (
                userVotes.map((vote, idx) => (
                  <div key={idx} className="bg-zinc-950 border border-zinc-903 rounded-xl p-5 flex items-start gap-4 justify-between">
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-mono text-zinc-550 uppercase tracking-wider block">
                        Casted Vote inside:
                      </span>
                      <h4 className="text-sm font-sans font-bold text-zinc-200 leading-tight">
                        {vote.pollQuestion}
                      </h4>
                      <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl px-3.5 py-1.5 mt-2">
                        <span className="text-[10.5px] uppercase font-mono font-bold">Voted Film:</span>
                        <span className="text-xs font-serif font-bold text-zinc-100">
                          🍿 {vote.optionTitle} <span className="text-zinc-500 font-normal">({vote.optionYear})</span>
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
