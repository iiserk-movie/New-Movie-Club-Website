import React, { useState } from 'react';
import { 
  Plus, Search, ThumbsUp, Calendar, Clock, Sparkles, User, HelpCircle, 
  Film, AlertCircle, Link2, Trash, Check, Crown, Vote, Volume2, Archive, ListFilter, Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Poll, PollMovieOption, User as AppUser } from '../types';
import { db, sanitizeDoc } from '../firebase';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { getPolishedPosterUrl } from '../letterboxdDb';

interface PollsSectionProps {
  polls: Poll[];
  currentUser: AppUser | null;
  adminMode?: boolean;
}

export default function PollsSection({
  polls,
  currentUser,
  adminMode = false
}: PollsSectionProps) {
  const [activeTab, setActiveTab] = useState<'active' | 'closed' | 'upcoming'>('active');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Admin Create Poll States
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollDescription, setPollDescription] = useState('');
  const [startsAtDate, setStartsAtDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [startsAtTime, setStartsAtTime] = useState('08:00');
  const [closesAtDate, setClosesAtDate] = useState(() => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek.toISOString().split('T')[0];
  });
  const [closesAtTime, setClosesAtTime] = useState('22:00');

  // Movie Options Builder State for Admin Create Poll
  const [options, setOptions] = useState<Omit<PollMovieOption, 'id' | 'votes'>[]>([
    { title: '', director: '', year: 2024, genre: 'Drama', synopsis: '', posterUrl: '' },
    { title: '', director: '', year: 2024, genre: 'Sci-Fi/Action', synopsis: '', posterUrl: '' }
  ]);

  // Autofill states for options
  const [autofillIndex, setAutofillIndex] = useState<number | null>(null);
  const [autofillLoading, setAutofillLoading] = useState(false);
  const [autofillError, setAutofillError] = useState('');

  // Real-time server-side cinema fill-in lookup
  const handleAutofillOption = async (index: number) => {
    const movieTitle = options[index].title.trim();
    if (!movieTitle) {
      setAutofillError('Please enter a film title for this choice first.');
      setAutofillIndex(index);
      setTimeout(() => setAutofillError(''), 4000);
      return;
    }

    setAutofillIndex(index);
    setAutofillLoading(true);
    setAutofillError('');

    try {
      const res = await fetch('/api/movie-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movieQuery: movieTitle })
      });

      if (!res.ok) {
        throw new Error('Movie not found or API limits exceeded.');
      }

      const info = await res.json();
      const updated = [...options];
      updated[index] = {
        title: info.title || movieTitle,
        director: info.director || '',
        year: info.year ? Number(info.year) : 2024,
        genre: info.genre || '',
        synopsis: info.plot || info.synopsis || '',
        posterUrl: info.posterUrl || ''
      };
      setOptions(updated);
      setSuccessMsg(`✨ Loaded "${info.title || movieTitle}" metadata!`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.warn(err);
      setAutofillError(err.message || 'Details could not be resolved automatically.');
      setTimeout(() => setAutofillError(''), 4000);
    } finally {
      setAutofillLoading(false);
    }
  };

  const handleAddOptionField = () => {
    setOptions([...options, { title: '', director: '', year: 2024, genre: 'Cinema', synopsis: '', posterUrl: '' }]);
  };

  const handleRemoveOptionField = (index: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, field: string, val: any) => {
    const updated = [...options];
    updated[index] = {
      ...updated[index],
      [field]: val
    };
    setOptions(updated);
  };

  // Submit new poll to Firestore
  const handlePublishPoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMsg('');
    setSuccessMsg('');

    if (!pollQuestion.trim()) {
      setErrorMsg('Please specify a survey request or watch question.');
      return;
    }

    // Validate date/times
    const startIso = `${startsAtDate}T${startsAtTime}:00`;
    const closeIso = `${closesAtDate}T${closesAtTime}:00`;

    if (new Date(closeIso) <= new Date(startIso)) {
      setErrorMsg('Closing schedule must be strictly after the start milestone.');
      return;
    }

    // Validate options
    const invalidOpt = options.some(opt => !opt.title.trim() || !opt.director.trim());
    if (invalidOpt) {
      setErrorMsg('Make sure all cinema choices have at least a Title and Director specified.');
      return;
    }

    setIsSubmitting(true);

    const pollId = `poll-${Date.now()}`;
    const finalizedOptions: PollMovieOption[] = options.map((opt, i) => ({
      ...opt,
      id: `opt-${i}-${Date.now()}`,
      votes: []
    }));

    const newPoll: Poll = {
      id: pollId,
      question: pollQuestion.trim(),
      description: pollDescription.trim(),
      startsAt: startIso,
      closesAt: closeIso,
      createdAt: new Date().toISOString(),
      options: finalizedOptions,
      createdBy: currentUser?.email || 'admin'
    };

    try {
      const savePromise = setDoc(doc(db, 'polls', pollId), sanitizeDoc(newPoll));
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("LOCAL_SYNC")), 1500);
      });

      await Promise.race([savePromise, timeoutPromise]);
      setSuccessMsg('🎉 Survey Poll published to students successfully!');
      setTimeout(() => {
        setSuccessMsg('');
        setShowCreateModal(false);
        // Clear form
        setPollQuestion('');
        setPollDescription('');
        setOptions([
          { title: '', director: '', year: 2024, genre: 'Drama', synopsis: '', posterUrl: '' },
          { title: '', director: '', year: 2024, genre: 'Sci-Fi/Action', synopsis: '', posterUrl: '' }
        ]);
      }, 2000);
    } catch (err: any) {
      if (err.message === "LOCAL_SYNC") {
        setSuccessMsg('💾 Saved! Survey Poll will finish background syncing shortly...');
        setTimeout(() => {
          setSuccessMsg('');
          setShowCreateModal(false);
          setPollQuestion('');
          setPollDescription('');
          setOptions([
            { title: '', director: '', year: 2024, genre: 'Drama', synopsis: '', posterUrl: '' },
            { title: '', director: '', year: 2024, genre: 'Sci-Fi/Action', synopsis: '', posterUrl: '' }
          ]);
        }, 2500);
      } else {
        console.error(err);
        setErrorMsg(`Failed to post metadata: ${err.message}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Vote toggle mechanism
  const handleToggleVote = async (pollId: string, optionId: string) => {
    if (!currentUser) {
      setErrorMsg('You must sign in using your verified IISER Kolkata email ID to cast your vote!');
      setTimeout(() => setErrorMsg(''), 5500);
      return;
    }

    const poll = polls.find(p => p.id === pollId);
    if (!poll) return;

    // Guard against voting if not active
    const now = new Date();
    const starts = new Date(poll.startsAt);
    const closes = new Date(poll.closesAt);
    if (now < starts) {
      setErrorMsg('This screening poll has not started yet.');
      setTimeout(() => setErrorMsg(''), 4000);
      return;
    }
    if (now > closes) {
      setErrorMsg('This screening poll is closed and no longer accepting votes.');
      setTimeout(() => setErrorMsg(''), 4000);
      return;
    }

    const updatedOptions = poll.options.map(opt => {
      if (opt.id === optionId) {
        const hasVoted = opt.votes.includes(currentUser.email);
        const newVotes = hasVoted
          ? opt.votes.filter(email => email !== currentUser.email)
          : [...opt.votes, currentUser.email];
        return { ...opt, votes: newVotes };
      }
      return opt;
    });

    try {
      await updateDoc(doc(db, 'polls', pollId), {
        options: updatedOptions
      });
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Failed updating vote record: ${err.message}`);
    }
  };

  const handleDeletePoll = async (pollId: string) => {
    if (!window.confirm('Are you sure you want to delete this screening survey?')) return;
    try {
      await deleteDoc(doc(db, 'polls', pollId));
      setSuccessMsg('Poll deleted successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Failed deleting record: ${err.message}`);
    }
  };

  // Filter polls based on activeTab
  const now = new Date();
  const filteredPolls = polls.filter(poll => {
    const starts = new Date(poll.startsAt);
    const closes = new Date(poll.closesAt);
    if (activeTab === 'active') {
      return now >= starts && now <= closes;
    } else if (activeTab === 'closed') {
      return now > closes;
    } else {
      return now < starts;
    }
  });

  return (
    <div id="polls-section" className="space-y-8 max-w-5xl mx-auto px-4 py-6">
      
      {/* Alert Notifications */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 bg-red-950/60 border border-red-900 text-red-200 px-4 py-3.5 rounded-xl text-xs sm:text-sm font-sans"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <div className="flex-1">{errorMsg}</div>
            <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-200 font-mono text-xs ml-2 cursor-pointer">dismiss</button>
          </motion.div>
        )}
        {successMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 bg-emerald-950/60 border border-emerald-900 text-emerald-200 px-4 py-3.5 rounded-xl text-xs sm:text-sm font-sans"
          >
            <Check className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 border-b border-zinc-900 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-500/10 rounded-lg text-amber-500 border border-amber-500/20">
              <Vote className="h-5 w-5" />
            </span>
            <span className="text-[10px] font-mono tracking-wider text-amber-500 uppercase bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">
              Screening Survey Engine
            </span>
          </div>
          <h2 className="font-serif text-2xl font-bold tracking-tight text-zinc-100 mt-2 sm:text-3xl">
            Movie Selection Polls
          </h2>
          <p className="text-zinc-400 text-xs sm:text-sm mt-1 max-w-2xl">
            Cast your vote for curated cinema screenings! Multiple options can be selected. The ultimate winner is scheduled automatically after closure.
          </p>
        </div>

        {adminMode && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="shrink-0 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 text-xs font-bold font-mono px-4 py-2.5 rounded-lg active:scale-95 transition-transform shadow-[0_4px_20px_rgba(245,158,11,0.2)] cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
            CREATE SCREENING POLL
          </button>
        )}
      </div>

      {/* Selector Tabs */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-1">
        <div className="flex gap-2">
          {[
            { id: 'active', label: 'Active Polls', desc: 'Accepting Votes' },
            { id: 'closed', label: 'Closed Results', desc: 'Final Screenings' },
            { id: 'upcoming', label: 'Scheduled / Upcoming', desc: 'Opening Soon' }
          ].map((tab) => {
            const count = polls.filter(p => {
              const starts = new Date(p.startsAt);
              const closes = new Date(p.closesAt);
              if (tab.id === 'active') return now >= starts && now <= closes;
              if (tab.id === 'closed') return now > closes;
              return now < starts;
            }).length;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative px-4 py-3 font-mono text-xs font-bold transition-all border-b-2 rounded-t-lg cursor-pointer ${
                  activeTab === tab.id
                    ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-sans ${
                    activeTab === tab.id ? 'bg-amber-500/25 text-amber-300' : 'bg-zinc-900 text-zinc-500'
                  }`}>
                    {count}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Polls Listing block */}
      <div className="space-y-10">
        {filteredPolls.length === 0 ? (
          <div className="text-center py-16 bg-zinc-950/40 rounded-2xl border border-zinc-900/60 max-w-xl mx-auto space-y-4">
            <HelpCircle className="h-10 w-10 text-zinc-600 mx-auto stroke-[1.5]" />
            <div>
              <p className="text-zinc-300 font-mono text-xs font-semibold">No polls found in this category.</p>
              <p className="text-zinc-500 text-xs mt-1 max-w-sm mx-auto leading-relaxed">
                {activeTab === 'active' && "No screening polls are running at this moment. Ask the movie club coordinate to generate a new selection pool!"}
                {activeTab === 'closed' && "Results of closed screening polls will appear here. They show full review rankings and details of the winning movies!"}
                {activeTab === 'upcoming' && "There are no scheduled future polls yet. Check back another time!"}
              </p>
            </div>
          </div>
        ) : (
          filteredPolls.map((poll) => {
            const closes = new Date(poll.closesAt);
            const starts = new Date(poll.startsAt);
            const isClosed = now > closes;
            const hasStarted = now >= starts;
            
            // Calculate total aggregate votes in this poll
            const totalAggVotes = poll.options.reduce((sum, opt) => sum + opt.votes.length, 0);

            // If closed, sort options descending by votes.length to show candidates
            const sortedOptionsForClosed = [...poll.options].sort((a, b) => b.votes.length - a.votes.length);
            const winner = sortedOptionsForClosed[0];
            const runnersUp = sortedOptionsForClosed.slice(1);

            return (
              <motion.div
                key={poll.id}
                layoutId={`poll-card-${poll.id}`}
                className="bg-zinc-950 p-6 rounded-2xl border border-zinc-900 hover:border-zinc-800/80 transition-all duration-300 space-y-6 shadow-xl"
              >
                {/* Header: Dates + Title */}
                <div className="flex flex-col gap-3 border-b border-zinc-900 pb-5 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {isClosed ? (
                        <span className="flex items-center gap-1 text-[9px] font-bold font-mono tracking-wider uppercase text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">
                          🎯 SURVEY CONCLUDED
                        </span>
                      ) : !hasStarted ? (
                        <span className="flex items-center gap-1 text-[9px] font-bold font-mono tracking-wider uppercase text-cyan-400 bg-cyan-500/5 px-2 py-0.5 rounded border border-cyan-500/10 animate-pulse">
                          ⏳ STARTS AT SCHEDULED DATE
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[9px] font-bold font-mono tracking-wider uppercase text-amber-400 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">
                          🔥 VOTES BEING ACCEPTED
                        </span>
                      )}

                      <span className="text-[10px] font-mono text-zinc-550 flex items-center gap-1 bg-zinc-900/60 px-2 py-0.5 rounded">
                        <User className="h-3 w-3" />
                         By Admin
                      </span>
                    </div>

                    <h3 className="font-serif text-lg font-bold text-zinc-100 sm:text-xl">
                      {poll.question}
                    </h3>

                    {poll.description && (
                      <p className="text-xs text-zinc-400 leading-relaxed font-sans max-w-3xl">
                        {poll.description}
                      </p>
                    )}
                  </div>

                  {/* Right side: Timer statistics */}
                  <div className="shrink-0 flex flex-col items-start md:items-end gap-1.5 md:text-right font-mono text-[10px] text-zinc-500 bg-zinc-900/40 p-3 rounded-lg border border-zinc-900/80 min-w-[200px]">
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <Clock className="h-3.5 w-3.5 text-zinc-500" />
                      <span>{isClosed ? 'Closed timeline:' : 'Closing milestone:'}</span>
                    </div>
                    <div className="text-zinc-300 text-xs font-bold font-sans">
                      {closes.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at {poll.closesAt.split('T')[1]?.slice(0, 5) || poll.closesAt}
                    </div>
                    {!isClosed && (
                      <div className="text-amber-500/80 mt-1 uppercase text-[9px] whitespace-nowrap">
                        ⏱️ Ends: {Math.max(0, Math.ceil((closes.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))} Days remaining
                      </div>
                    )}
                    <div className="text-zinc-500 border-t border-zinc-900 w-full pt-1.5 mt-1 text-[9px]">
                      TOTAL COOPERATION CASTS: <strong className="text-zinc-400 font-sans">{totalAggVotes}</strong>
                    </div>
                  </div>
                </div>

                {/* Body Content Rendering depends on active state (Closed Results versus Active Voting Options) */}
                {isClosed ? (
                  /* CLOSED RESULTS VIEW: Winner is at the top spotlighted, and runners-up listed downstairs */
                  <div className="space-y-6">
                    {/* Winner crown announcement spotlight */}
                    {winner && (
                      <div className="bg-gradient-to-br from-amber-500/10 via-zinc-950 to-zinc-950 border border-amber-500/30 p-5 sm:p-6 rounded-2xl space-y-4 shadow-[0_4px_30px_rgba(245,158,11,0.05)]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-amber-400 text-xs font-mono font-bold uppercase tracking-wider">
                            <Crown className="h-4 w-4 fill-amber-400 shrink-0 text-amber-500" />
                            👑 POPULAR SCREENING WINNER
                          </div>
                          <span className="text-xs font-mono bg-amber-500/20 text-amber-200 border border-amber-500/30 px-3 py-1 rounded-full font-bold">
                            🏆 {winner.votes.length} Votes ({totalAggVotes > 0 ? Math.round((winner.votes.length / totalAggVotes) * 100) : 0}%)
                          </span>
                        </div>

                        <div className="flex flex-col md:flex-row gap-5 items-start">
                          <img 
                            src={getPolishedPosterUrl(winner.title, winner.posterUrl)} 
                            alt={winner.title}
                            className="w-24 h-36 sm:w-28 sm:h-42 object-cover rounded-lg bg-zinc-900 border border-amber-500/20 shrink-0 shadow-lg"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=300';
                            }}
                          />
                          <div className="space-y-2 flex-1">
                            <div>
                              <h4 className="font-serif text-lg font-bold text-zinc-100 sm:text-xl">
                                {winner.title} <span className="font-sans text-sm text-zinc-400">({winner.year})</span>
                              </h4>
                              <p className="text-xs text-zinc-400 font-sans mt-0.5">
                                Directed by <strong className="text-zinc-200 font-semibold">{winner.director}</strong> • {winner.genre}
                              </p>
                            </div>

                            {winner.synopsis && (
                              <p className="text-xs leading-relaxed text-zinc-400 line-clamp-3">
                                {winner.synopsis}
                              </p>
                            )}

                            {/* Vote Gauge Progress bar */}
                            <div className="space-y-1.5 pt-2">
                              <div className="w-full bg-zinc-900 rounded-full h-2">
                                <div 
                                  className="bg-amber-500 h-2 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)] transition-all duration-1000" 
                                  style={{ width: `${totalAggVotes > 0 ? (winner.votes.length / totalAggVotes) * 100 : 0}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Runners up table listed beautifully */}
                    {runnersUp.length > 0 && (
                      <div className="space-y-3">
                        <div className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">
                          OTHER RUNNERS-UP ({runnersUp.length})
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {runnersUp.map((runner, idx) => {
                            const ratio = totalAggVotes > 0 ? Math.round((runner.votes.length / totalAggVotes) * 100) : 0;
                            return (
                              <div 
                                key={runner.id} 
                                className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-900 flex items-start gap-3.5 hover:bg-zinc-900 transition-all duration-200"
                              >
                                <img 
                                  src={getPolishedPosterUrl(runner.title, runner.posterUrl)} 
                                  alt={runner.title}
                                  className="w-14 h-20 object-cover rounded bg-zinc-950 border border-zinc-800 shrink-0"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    e.currentTarget.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=150';
                                  }}
                                />
                                <div className="space-y-1.5 min-w-0 flex-1">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 justify-between">
                                      <h5 className="font-serif text-sm font-bold text-zinc-300 truncate">
                                        #{idx + 2} {runner.title}
                                      </h5>
                                      <span className="text-[10px] font-mono font-bold text-zinc-400 whitespace-nowrap">
                                        {runner.votes.length} votes
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                                      {runner.director} • {runner.year}
                                    </p>
                                  </div>

                                  {/* Progress bar gauge */}
                                  <div className="space-y-1">
                                    <div className="w-full bg-zinc-950 rounded-full h-1.5">
                                      <div 
                                        className="bg-zinc-600 h-1.5 rounded-full" 
                                        style={{ width: `${ratio}%` }}
                                      ></div>
                                    </div>
                                    <div className="text-[9px] font-mono text-zinc-550 text-right">
                                      {ratio}% share
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ACTIVE VOTING VIEW */
                  <div className="space-y-4">
                    <p className="text-[10px] font-mono tracking-wider text-amber-500 border border-amber-500/10 bg-amber-500/5 px-2.5 py-1.5 rounded-lg max-w-max font-semibold">
                      💡 MULTIPLE ACTION MODE (You are allowed to vote for as many movie screenings down below as you wish!)
                    </p>

                    <div className="grid gap-4 md:grid-cols-2">
                      {poll.options.map((option) => {
                        const isVoted = currentUser ? option.votes.includes(currentUser.email) : false;
                        return (
                          <div
                            key={option.id}
                            className={`p-4 rounded-xl border transition-all duration-300 flex flex-col justify-between gap-4 ${
                              isVoted
                                ? 'bg-amber-500/5 border-amber-500/40 shadow-[0_4px_25px_rgba(245,158,11,0.02)]'
                                : 'bg-zinc-900/40 border-zinc-850 hover:bg-zinc-900/70 hover:border-zinc-800'
                            }`}
                          >
                            <div className="flex gap-4">
                              <img
                                src={getPolishedPosterUrl(option.title, option.posterUrl)}
                                alt={option.title}
                                className="w-16 h-24 object-cover rounded-md bg-zinc-950 border border-zinc-800/80 shrink-0 shadow"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  e.currentTarget.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=200';
                                }}
                              />
                              <div className="min-w-0 space-y-1">
                                <h4 className="font-serif text-sm font-bold text-zinc-100 uppercase tracking-wide truncate">
                                  {option.title} <span className="font-sans text-xs text-zinc-550 font-normal">({option.year})</span>
                                </h4>
                                <p className="text-[10px] text-zinc-400 font-mono truncate">
                                  Dir: {option.director} • {option.genre}
                                </p>
                                {option.synopsis && (
                                  <p className="text-[11px] leading-relaxed text-zinc-400 line-clamp-3 font-sans pt-0.5">
                                    {option.synopsis}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Voting Button interface */}
                            <div className="flex items-center justify-between border-t border-zinc-900 pt-3">
                              <div className="font-mono text-[10px] text-zinc-500 flex items-center gap-1">
                                <span className={`text-xs font-bold ${isVoted ? 'text-amber-400' : 'text-zinc-400'}`}>
                                  {option.votes.length}
                                </span>
                                <span>{option.votes.length === 1 ? 'Vote' : 'Votes'} cast</span>
                              </div>

                              <button
                                onClick={() => handleToggleVote(poll.id, option.id)}
                                className={`px-4.5 py-1.5 rounded-lg text-[10px] uppercase font-mono font-bold tracking-wider hover:scale-[1.03] transition-all cursor-pointer select-none flex items-center gap-1 ${
                                  isVoted
                                    ? 'bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-[0_2px_12px_rgba(245,158,11,0.2)]'
                                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white border border-zinc-700/50'
                                }`}
                              >
                                {isVoted ? (
                                  <>
                                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                                    VOTED
                                  </>
                                ) : (
                                  <>
                                    <ThumbsUp className="h-3 w-3" />
                                    CAST VOTE
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Footer and Admin Controls */}
                {adminMode && (
                  <div className="flex items-center justify-end gap-3 border-t border-zinc-900 pt-4 mt-2">
                    <button
                      onClick={() => handleDeletePoll(poll.id)}
                      className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-600 hover:text-red-400 transition-colors uppercase border border-zinc-900 bg-zinc-950 px-3 py-1.5 rounded-lg cursor-pointer"
                    >
                      <Trash className="h-3.5 w-3.5" />
                      DELETE SURVEY
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      {/* Admin CREATE POLL Modal / Pane */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-980/90 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative space-y-6"
            >
              <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
                <div className="flex items-center gap-2">
                  <Vote className="h-5 w-5 text-amber-500" />
                  <h3 className="font-serif text-lg font-bold text-zinc-100">
                    Create Curated Selection Poll
                  </h3>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-zinc-500 hover:text-zinc-300 font-mono text-sm cursor-pointer border border-zinc-900 p-2 rounded-full hover:bg-zinc-900"
                >
                  ✕
                </button>
              </div>

              {/* Form implementation */}
              <form onSubmit={handlePublishPoll} className="space-y-6 text-sm text-zinc-300">
                <div className="space-y-4">
                  {/* Question */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-mono tracking-wider text-zinc-400 uppercase">
                      Poll Question / Headline *
                    </label>
                    <input
                      required
                      type="text"
                      value={pollQuestion}
                      onChange={(e) => setPollQuestion(e.target.value)}
                      placeholder='e.g. Which sci-fi masterpiece should we screen next week?'
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-mono tracking-wider text-zinc-400 uppercase">
                      Overview Description / Curates notes
                    </label>
                    <textarea
                      value={pollDescription}
                      onChange={(e) => setPollDescription(e.target.value)}
                      placeholder="Add an editorial context, venue confirmation or commentary for this survey..."
                      rows={2}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                    />
                  </div>

                  {/* Time Range Configuration */}
                  <div className="grid gap-4 sm:grid-cols-2 bg-zinc-900/20 p-4 rounded-xl border border-zinc-900">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-mono tracking-wider text-zinc-400 uppercase">
                        Start Milestones Date & Time *
                      </label>
                      <div className="flex gap-2">
                        <input
                          required
                          type="date"
                          value={startsAtDate}
                          onChange={(e) => setStartsAtDate(e.target.value)}
                          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 hover:border-zinc-700 focus:border-amber-500/50 focus:outline-none"
                        />
                        <input
                          required
                          type="time"
                          value={startsAtTime}
                          onChange={(e) => setStartsAtTime(e.target.value)}
                          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 hover:border-zinc-700/50 focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-mono tracking-wider text-zinc-400 uppercase">
                        Closing Milestones Date & Time *
                      </label>
                      <div className="flex gap-2">
                        <input
                          required
                          type="date"
                          value={closesAtDate}
                          onChange={(e) => setClosesAtDate(e.target.value)}
                          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 hover:border-zinc-700 focus:border-amber-500/50 focus:outline-none"
                        />
                        <input
                          required
                          type="time"
                          value={closesAtTime}
                          onChange={(e) => setClosesAtTime(e.target.value)}
                          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 hover:border-zinc-700/50 focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Movie option entries collection */}
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                      <span className="text-xs font-mono text-zinc-400 uppercase font-bold tracking-wider">
                        🎬 MOVIE CANDIDATES ({options.length})
                      </span>
                      <button
                        type="button"
                        onClick={handleAddOptionField}
                        className="flex items-center gap-1 text-[11px] font-mono text-amber-500 hover:text-amber-400 border border-amber-500/20 bg-amber-500/5 px-2.5 py-1 rounded cursor-pointer"
                      >
                        <Plus className="h-3 w-3 stroke-[2.5]" />
                        ADD OPTION
                      </button>
                    </div>

                    {autofillLoading && autofillIndex !== null && (
                      <div className="text-amber-500 font-mono text-xs flex items-center gap-2 animate-pulse">
                        <span className="animate-spin h-3.5 w-3.5 border-b-2 border-amber-500 rounded-full"></span>
                        Resolving detailed metadata using Cinema API for movie choice #{autofillIndex + 1}...
                      </div>
                    )}
                    {autofillError && (
                      <div className="text-red-400 font-mono text-xs flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-500" />
                        Option #{autofillIndex !== null ? autofillIndex + 1 : ''} Auto-fill Error: {autofillError}
                      </div>
                    )}

                    <div className="space-y-4">
                      {options.map((opt, idx) => (
                        <div 
                          key={idx} 
                          className="border border-zinc-900 bg-zinc-900/10 p-4 rounded-2xl relative space-y-4"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono text-zinc-500 font-bold">
                              Movie Candidate #{idx + 1}
                            </span>
                            {options.length > 2 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveOptionField(idx)}
                                className="text-zinc-600 hover:text-red-400 font-mono text-xs cursor-pointer px-2 py-0.5 border border-zinc-900 rounded"
                              >
                                Delete
                              </button>
                            )}
                          </div>

                          <div className="grid gap-4 sm:grid-cols-12">
                            {/* Title (can be autocompleted) */}
                            <div className="sm:col-span-6 space-y-1.5">
                              <label className="block text-[10px] font-mono text-zinc-400 uppercase">
                                Movie Title *
                              </label>
                              <div className="flex gap-2">
                                <input
                                  required
                                  type="text"
                                  value={opt.title}
                                  onChange={(e) => handleOptionChange(idx, 'title', e.target.value)}
                                  placeholder="e.g. Seven Samurai"
                                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-700 focus:border-amber-500/50 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAutofillOption(idx)}
                                  className="shrink-0 font-mono text-[10px] text-zinc-950 bg-amber-500 hover:bg-amber-600 font-bold px-2.5 rounded-lg flex items-center gap-1 cursor-pointer active:scale-95 transition-transform"
                                  title="Look up and autofill movie properties"
                                >
                                  <Sparkles className="h-3.5 w-3.5" />
                                  AUTO
                                </button>
                              </div>
                            </div>

                            {/* Director */}
                            <div className="sm:col-span-4 space-y-1.5">
                              <label className="block text-[10px] font-mono text-zinc-400 uppercase">
                                Director *
                              </label>
                              <input
                                required
                                type="text"
                                value={opt.director}
                                onChange={(e) => handleOptionChange(idx, 'director', e.target.value)}
                                placeholder="Akira Kurosawa"
                                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-700"
                              />
                            </div>

                            {/* Release Year */}
                            <div className="sm:col-span-2 space-y-1.5">
                              <label className="block text-[10px] font-mono text-zinc-400 uppercase">
                                Year *
                              </label>
                              <input
                                required
                                type="number"
                                value={opt.year}
                                onChange={(e) => handleOptionChange(idx, 'year', e.target.value)}
                                placeholder="1954"
                                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-750"
                              />
                            </div>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-12">
                            {/* Genre */}
                            <div className="sm:col-span-4 space-y-1.5">
                              <label className="block text-[10px] font-mono text-zinc-400 uppercase">
                                Genre
                              </label>
                              <input
                                type="text"
                                value={opt.genre}
                                onChange={(e) => handleOptionChange(idx, 'genre', e.target.value)}
                                placeholder="Action, Adventure, Drama"
                                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-700"
                              />
                            </div>

                            {/* Poster URL */}
                            <div className="sm:col-span-8 space-y-1.5">
                              <label className="block text-[10px] font-mono text-zinc-400 uppercase">
                                Poster Image URL
                              </label>
                              <input
                                type="url"
                                value={opt.posterUrl}
                                onChange={(e) => handleOptionChange(idx, 'posterUrl', e.target.value)}
                                placeholder="https://image-url-link.com/poster.jpg"
                                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-750 font-mono"
                              />
                            </div>
                          </div>

                          {/* Synopsis */}
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-mono text-zinc-400">
                              SYNOPSIS / PLOT DESCRIPTION
                            </label>
                            <textarea
                              value={opt.synopsis}
                              onChange={(e) => handleOptionChange(idx, 'synopsis', e.target.value)}
                              placeholder="Brief overview / review highlight for this movie selection choice..."
                              rows={2}
                              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-700"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Confirm submit buttons */}
                <div className="flex items-center justify-end gap-3 border-t border-zinc-900 pt-4 mt-8">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 hover:bg-zinc-900 rounded-lg text-xs font-mono font-bold text-zinc-400 transition-colors cursor-pointer"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-zinc-950 text-xs font-bold font-mono px-5 py-2.5 rounded-lg active:scale-95 transition-transform shadow-[0_4px_15px_rgba(245,158,11,0.25)] cursor-pointer"
                  >
                    {isSubmitting ? 'PUBLISHING...' : 'PUBLISH SURVEY POLL'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
