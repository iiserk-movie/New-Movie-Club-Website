import React, { useState } from 'react';
import { 
  Calendar, Clock, MapPin, Film, Plus, Edit2, Trash2, Globe, Eye,
  Clock3, Star, Sparkles, ExternalLink, Bell, Check, X, Tag, Link2, Upload
} from 'lucide-react';
import { motion } from 'motion/react';
import { Screening } from '../types';
import { letterboxdMovies, LetterboxdMovie, findMovieByUrlOrSlug, parseLetterboxdUrlToMovie, getPolishedPosterUrl } from '../letterboxdDb';
import { compressAndResizeImage } from '../utils/imageCompressor';
import MovieClubLogo from './MovieClubLogo';
import { getMovieDetails, searchMovies } from '../utils/movieApi';

interface ScreeningScheduleProps {
  screenings: Screening[];
  adminMode: boolean;
  onAddScreening: (screening: Omit<Screening, 'id'>) => void | Promise<any>;
  onUpdateScreening: (screening: Screening) => void | Promise<any>;
  onDeleteScreening: (id: string) => void | Promise<any>;
  currentUserEmail?: string;
}

export default function ScreeningSchedule({
  screenings,
  adminMode,
  onAddScreening,
  onUpdateScreening,
  onDeleteScreening,
  currentUserEmail
}: ScreeningScheduleProps) {
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingScreening, setEditingScreening] = useState<Screening | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  
  // Form fields
  const [title, setTitle] = useState('');
  const [director, setDirector] = useState('');
  const [year, setYear] = useState<number>(2024);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [venue, setVenue] = useState('M.N. Saha Auditorium, Ground Floor, TRC building');
  const [description, setDescription] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [backdropUrl, setBackdropUrl] = useState('');
  const [runtime, setRuntime] = useState('120 min');
  const [genreInput, setGenreInput] = useState('');
  const [language, setLanguage] = useState('English (with Subs)');
  const [trailerUrl, setTrailerUrl] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  // Letterboxd integration states
  const [letterboxdInput, setLetterboxdInput] = useState('');
  const [lbSuggestions, setLbSuggestions] = useState<LetterboxdMovie[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<LetterboxdMovie | null>(null);

  // Local reminders simulation status
  const [reminders, setReminders] = useState<Record<string, boolean>>({});

  // Poster & Backdrop image upload handlers
  const [posterFileError, setPosterFileError] = useState('');
  const [backdropFileError, setBackdropFileError] = useState('');
  const [isPosterCompressing, setIsPosterCompressing] = useState(false);
  const [isBackdropCompressing, setIsBackdropCompressing] = useState(false);

  const handlePosterFileUpload = async (file: File) => {
    setPosterFileError('');
    if (!file.type.startsWith('image/')) {
      setPosterFileError('Please select an image file (PNG, JPG, WebP, SVG).');
      return;
    }

    setIsPosterCompressing(true);
    try {
      // Compress to optimal dimensions (350x500px, quality 0.7) for efficient storage and fast rendering
      const compressedB64 = await compressAndResizeImage(file, 350, 500, 0.7);
      setPosterUrl(compressedB64);
      setSelectedMovie(null);
    } catch (err) {
      console.error(err);
      setPosterFileError('Failed to process and compress uploaded poster.');
    } finally {
      setIsPosterCompressing(false);
    }
  };

  const handleBackdropFileUpload = async (file: File) => {
    setBackdropFileError('');
    if (!file.type.startsWith('image/')) {
      setBackdropFileError('Please select an image file (PNG, JPG, WebP, SVG).');
      return;
    }

    setIsBackdropCompressing(true);
    try {
      // Compress to optimal widescreen banner dimensions (800x450px, quality 0.65)
      const compressedB64 = await compressAndResizeImage(file, 800, 450, 0.65);
      setBackdropUrl(compressedB64);
      setSelectedMovie(null);
    } catch (err) {
      console.error(err);
      setBackdropFileError('Failed to process and compress uploaded backdrop.');
    } finally {
      setIsBackdropCompressing(false);
    }
  };

  // AI autofill state
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
      const data = await getMovieDetails(query);
      if (data.title) setTitle(data.title);
      if (data.director) setDirector(data.director);
      if (data.year) setYear(Number(data.year));
      if (data.duration) setRuntime(data.duration);
      if (data.genre) setGenreInput(data.genre);
      if (data.description) setDescription(data.description);
      if (data.posterUrl) setPosterUrl(data.posterUrl);
      if (data.backdropUrl) setBackdropUrl(data.backdropUrl);
      if (data.language) setLanguage(data.language);
      if (data.trailerUrl) setTrailerUrl(data.trailerUrl);
      
      setFeedbackMsg(`✨ Found details for "${data.title}"!`);
      setTimeout(() => setFeedbackMsg(''), 4500);
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'Error occurred while looking up movie details.');
    } finally {
      setIsAiLoading(false);
    }
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
      setLbSuggestions([]); // clear list for link uploads
      setIsAiLoading(true);
      setAiError('');
      try {
        const detail = await getMovieDetails(query);
        if (detail && detail.title) {
          setTitle(detail.title);
          setDirector(detail.director || '');
          if (detail.year) setYear(Number(detail.year));
          if (detail.duration) setRuntime(detail.duration);
          if (detail.genre) setGenreInput(detail.genre);
          if (detail.posterUrl) setPosterUrl(detail.posterUrl);
          if (detail.backdropUrl) setBackdropUrl(detail.backdropUrl);
          if (detail.description) setDescription(detail.description);
          if (detail.language) setLanguage(detail.language);
          if (detail.trailerUrl) setTrailerUrl(detail.trailerUrl);
          
          setFeedbackMsg(`✨ Auto-filled details for "${detail.title}"!`);
          setTimeout(() => setFeedbackMsg(''), 4500);
          setLetterboxdInput(''); // empty input on success
        } else {
          setAiError('Could not load details from this link. Please enter details manually.');
        }
      } catch (err: any) {
        console.warn("Autofill from link failed:", err);
        setAiError(err.message || 'Could not load details from this link. Please enter details manually.');
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
        const apiMovies = await searchMovies(query);
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
    if (movie.duration) setRuntime(movie.duration);
    if (movie.genre) setGenreInput(movie.genre);
    if (movie.posterUrl) setPosterUrl(movie.posterUrl);
    if (movie.backdropUrl) setBackdropUrl(movie.backdropUrl);
    if (movie.description || movie.synopsis) setDescription(movie.description || movie.synopsis);
    if (movie.language) setLanguage(movie.language);
    if (movie.trailerUrl) setTrailerUrl(movie.trailerUrl);
    
    setLetterboxdInput(movie.title);
    setLbSuggestions([]);

    // Set interactive visual preview block
    setSelectedMovie({
      id: movie.letterboxdSlug || movie.id || 'custom-movie',
      title: movie.title,
      director: movie.director || '',
      year: Number(movie.year) || 2024,
      runtime: movie.duration || movie.runtime || '120 min',
      genre: Array.isArray(movie.genre) ? movie.genre : (movie.genre || '').split(',').map((g: string) => g.trim()),
      language: movie.language || 'English (with Subs)',
      synopsis: movie.description || movie.synopsis || '',
      posterUrl: movie.posterUrl || '',
      backdropUrl: movie.backdropUrl || '',
      letterboxdUrl: movie.letterboxdUrl || `https://letterboxd.com/film/${movie.letterboxdSlug || movie.id || 'custom-movie'}/`,
      trailerUrl: movie.trailerUrl || ''
    });

    setFeedbackMsg(`✨ Successfully populated details for "${movie.title}"!`);
    setTimeout(() => setFeedbackMsg(''), 4500);
  };

  const openAddForm = () => {
    setEditingScreening(null);
    setTitle('');
    setDirector('');
    setYear(2024);
    setDate('');
    setTime('18:30');
    setVenue('M.N. Saha Auditorium, Ground Floor, TRC building');
    setDescription('');
    setPosterUrl('https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600&auto=format&fit=crop');
    setBackdropUrl('https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=1200&auto=format&fit=crop');
    setRuntime('120 min');
    setGenreInput('Drama, Sci-Fi');
    setLanguage('English (with English subtitles)');
    setTrailerUrl('');
    setLetterboxdInput('');
    setSelectedMovie(null);
    setLbSuggestions([]);
    setShowFormModal(true);
  };

  const openEditForm = (screening: Screening) => {
    setEditingScreening(screening);
    setTitle(screening.title);
    setDirector(screening.director);
    setYear(screening.year);
    setDate(screening.date);
    setTime(screening.time);
    setVenue(screening.venue);
    setDescription(screening.description);
    setPosterUrl(screening.posterUrl);
    setBackdropUrl(screening.backdropUrl || '');
    setRuntime(screening.runtime);
    setGenreInput(screening.genre.join(', '));
    setLanguage(screening.language);
    setTrailerUrl(screening.trailerUrl || '');
    setLetterboxdInput('');
    setSelectedMovie(null);
    setLbSuggestions([]);
    setShowFormModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setIsSubmitting(true);
    const parsedGenres = genreInput.split(',').map(g => g.trim()).filter(g => g.length > 0);
    
    if (!title || !director || !date || !time) {
      setSubmitError('Please fill out all required fields: Title, Director, Date, and Time.');
      setIsSubmitting(false);
      return;
    }

    const screeningData: any = {
      title,
      director,
      year: Number(year),
      date,
      time,
      venue,
      description,
      posterUrl: posterUrl || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600&auto=format&fit=crop',
      backdropUrl: backdropUrl || 'https://images.unsplash.com/photo-1489599850125-9fa8bf1144a8?q=80&w=1200&auto=format&fit=crop',
      runtime,
      genre: parsedGenres.length > 0 ? parsedGenres : ['Cinema'],
      language,
    };

    if (trailerUrl && trailerUrl.trim()) {
      screeningData.trailerUrl = trailerUrl.trim();
    }

    const savePromise = editingScreening
      ? onUpdateScreening({
          ...screeningData,
          id: editingScreening.id
        })
      : onAddScreening(screeningData);

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("LOCAL_SYNC")), 1500);
    });

    try {
      await Promise.race([savePromise, timeoutPromise]);
      setFeedbackMsg(`✨ Screening ${editingScreening ? 'updated' : 'added'} successfully!`);
      setTimeout(() => setFeedbackMsg(''), 4500);
      setShowFormModal(false);
    } catch (err: any) {
      if (err.message === "LOCAL_SYNC") {
        setFeedbackMsg(`💾 Saved! Syncing with Firebase in the background...`);
        setTimeout(() => setFeedbackMsg(''), 4500);
        setShowFormModal(false);
      } else {
        console.error("Failed to save screening:", err);
        let parsedMsg = "";
        try {
          const parsedErr = JSON.parse(err.message);
          const errorText = (parsedErr.error || "").toLowerCase();
          if (errorText.includes("permission denied") || errorText.includes("insufficient permissions")) {
            parsedMsg = "Firebase Permission Denied: Your IISER Kolkata admin credentials or passcode login has expired or is unauthorized.";
          } else {
            parsedMsg = parsedErr.error || err.message;
          }
        } catch (e) {
          const lowerMsg = (err.message || "").toLowerCase();
          if (lowerMsg.includes("permission denied") || lowerMsg.includes("insufficient permissions")) {
            parsedMsg = "Firebase Permission Denied: Your IISER Kolkata admin credentials or passcode login has expired or is unauthorized.";
          } else {
            parsedMsg = err.message || "Failed to publish. Check connection/credentials and try again.";
          }
        }
        setSubmitError(parsedMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleReminder = (id: string, movieTitle: string) => {
    const hasReminder = reminders[id];
    setReminders(prev => ({
      ...prev,
      [id]: !prev[id]
    }));

    if (!hasReminder) {
      const emailText = currentUserEmail ? `to ${currentUserEmail}` : "to your email";
      setFeedbackMsg(`🔔 RSVPs acknowledged! Screening reminder sent ${emailText} for "${movieTitle}"`);
      setTimeout(() => setFeedbackMsg(''), 5500);
    }
  };

  const getCountdownText = (dateStr: string) => {
    const screeningDate = new Date(dateStr);
    const today = new Date();
    screeningDate.setHours(0,0,0,0);
    today.setHours(0,0,0,0);

    const diffTime = screeningDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Screening Today 🍿';
    if (diffDays === 1) return 'Tomorrow • Get Ready';
    if (diffDays < 0) return 'Screened';
    return `In ${diffDays} days`;
  };

  const formatPrettyDate = (dateStr: string) => {
    const options: any = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-US', options);
  };

  return (
    <div className="space-y-12">
      {feedbackMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-amber-500 text-zinc-950 px-5 py-4 rounded-xl shadow-xl border border-amber-400 font-medium flex items-center space-x-3 text-sm max-w-sm animate-bounce">
          <Sparkles className="h-5 w-5 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-zinc-900 pb-6 gap-6">
        <div>
          <span className="text-amber-500 font-mono text-xs uppercase tracking-widest font-semibold flex items-center gap-1.5">
            <Calendar className="h-4 w-4" /> Theatre Calendar
          </span>
          <h2 className="font-serif text-3xl font-bold text-zinc-100 tracking-tight sm:text-4xl mt-1">
            Upcoming Screenings
          </h2>
        </div>
        
        {adminMode && (
          <button
            onClick={openAddForm}
            id="btn-add-screening"
            className="flex items-center space-x-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 px-5 py-2.5 rounded-xl font-bold text-sm transition-transform hover:scale-102 shadow-lg shadow-amber-500/15 cursor-pointer self-start md:self-auto shrink-0 md:mt-4"
          >
            <Plus className="h-4.5 w-4.5" />
            <span>Add Screening</span>
          </button>
        )}
      </div>

      {/* Empty States */}
      {screenings.length === 0 && (
        <div className="text-center py-20 border border-dashed border-zinc-900 rounded-2xl bg-zinc-950/20">
          <Film className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
          <h3 className="font-serif text-xl font-semibold text-zinc-300">No screenings scheduled yet</h3>
          <p className="text-zinc-500 text-sm mt-1 max-w-sm mx-auto">
            Check back later or ask administrators in the club to coordinate the upcoming schedules.
          </p>
          {adminMode && (
            <button
              onClick={openAddForm}
              className="mt-6 bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-amber-500/10 px-4 py-2 rounded-lg text-xs font-mono cursor-pointer"
            >
              Initialize First Entry
            </button>
          )}
        </div>
      )}

      {/* Upcoming Screenings list */}
      <div className="grid grid-cols-1 gap-10">
        {screenings.map((screening) => {
          const countdown = getCountdownText(screening.date);

          return (
            <div 
              key={screening.id}
              className="group relative flex flex-col lg:flex-row rounded-3xl border border-zinc-900/60 bg-zinc-950 overflow-hidden shadow-2xl transition-all duration-300 hover:border-zinc-800/80 hover:shadow-amber-500/[0.02]"
            >
              {adminMode && (
                <div className="absolute top-4 right-4 z-20 flex items-center space-x-1.5 bg-zinc-900/90 border border-zinc-800 p-1.5 rounded-xl">
                  <button
                    onClick={() => openEditForm(screening)}
                    className="p-2 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                    title="Edit entry"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm(`Remove "${screening.title}" from upcoming schedule?`)) {
                        try {
                          await onDeleteScreening(screening.id);
                          setFeedbackMsg(`🗑️ Successfully deleted "${screening.title}" from schedule.`);
                          setTimeout(() => setFeedbackMsg(''), 4500);
                        } catch (err: any) {
                          console.error("Delete failed:", err);
                          let parsedMsg = "Failed to delete screening.";
                          try {
                            const parsedErr = JSON.parse(err.message);
                            if (parsedErr.error && parsedErr.error.includes("Permission denied")) {
                              parsedMsg = "Firebase Permission Denied: Your IISER Kolkata admin session is expired or unauthorized to perform deletes.";
                            } else {
                              parsedMsg = parsedErr.error || err.message;
                            }
                          } catch (e) {
                            parsedMsg = err.message || "Failed to delete.";
                          }
                          setFeedbackMsg(`❌ ${parsedMsg}`);
                          setTimeout(() => setFeedbackMsg(''), 6000);
                        }
                      }
                    }}
                    className="p-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                    title="Delete entry"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Backdrop Art Section */}
              <div className="relative w-full lg:w-[35%] h-64 lg:h-auto min-h-[300px] overflow-hidden">
                <img 
                  src={getPolishedPosterUrl(screening.title, screening.posterUrl)} 
                  alt={screening.title} 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-zinc-950 via-zinc-950/40 to-transparent"></div>

                <div className="absolute bottom-4 left-4 flex flex-col space-y-1 bg-zinc-950/80 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-zinc-800/80">
                  <span className="font-mono text-amber-500 font-bold text-xs uppercase tracking-wider">
                    {countdown}
                  </span>
                  <span className="text-zinc-500 text-[10px] uppercase font-mono">
                    Countdown Status
                  </span>
                </div>
              </div>

              {/* Description Details Content */}
              <div className="flex-1 p-6 sm:p-8 flex flex-col justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {screening.genre.map((g, i) => (
                      <span key={i} className="flex items-center text-[10px] font-semibold font-mono tracking-wider text-zinc-400 bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded-md uppercase">
                        {g}
                      </span>
                    ))}
                    <span className="text-zinc-500 text-xs">•</span>
                    <span className="text-zinc-400 text-xs font-semibold">{screening.runtime}</span>
                  </div>

                  <h3 className="font-serif text-2xl sm:text-3xl font-bold text-zinc-100 tracking-tight group-hover:text-amber-400 transition-colors">
                    {screening.title} <span className="text-zinc-500 font-normal text-lg">({screening.year})</span>
                  </h3>
                  
                  <p className="text-zinc-400 text-xs mt-1">
                    Director: <span className="text-zinc-300 font-medium">{screening.director}</span>
                  </p>

                  <div 
                    onClick={() => setExpandedIds(prev => ({ ...prev, [screening.id]: !prev[screening.id] }))}
                    className="text-zinc-300 text-sm mt-4 leading-relaxed cursor-pointer select-none"
                  >
                    <p className={expandedIds[screening.id] ? "text-zinc-300 text-sm" : "text-zinc-300 text-sm line-clamp-1 truncate"}>
                      {screening.description}
                    </p>
                    <span className="inline-block text-xs font-mono font-bold text-amber-500 hover:text-amber-400 mt-1">
                      {expandedIds[screening.id] ? "Show less details ▲" : "Read screening details ▼"}
                    </span>
                  </div>

                  <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-b border-zinc-900/80 py-4 font-mono text-xs">
                    <div className="space-y-1">
                      <span className="text-zinc-500 block uppercase text-[10px]">Screening Date</span>
                      <span className="text-zinc-200 flex items-center font-semibold gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-amber-500/80" />
                        {formatPrettyDate(screening.date)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-zinc-500 block uppercase text-[10px]">Showtime</span>
                      <span className="text-zinc-200 flex items-center font-semibold gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-amber-500/80" />
                        {screening.time} IST
                      </span>
                    </div>

                    <div className="space-y-1 col-span-2 sm:col-span-1">
                      <span className="text-zinc-500 block uppercase text-[10px]">IISER Venue</span>
                      <span className="text-zinc-200 flex items-center font-semibold gap-1.5 truncate" title={screening.venue}>
                        <MapPin className="h-3.5 w-3.5 text-amber-500/80" />
                        {screening.venue}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-2 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center space-x-2 text-xs font-mono text-zinc-500">
                    <Globe className="h-3.5 w-3.5 text-zinc-600" />
                    <span>Language:</span>
                    <span className="text-zinc-300 font-medium">{screening.language}</span>
                  </div>

                  <div className="flex items-center space-x-3">
                    {screening.trailerUrl && (
                      <a 
                        href={screening.trailerUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center space-x-1 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 px-4 py-2 rounded-xl text-xs font-medium bg-zinc-950/60 transition-colors"
                      >
                        <span>Trailer</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}

                    <button
                      onClick={() => toggleReminder(screening.id, screening.title)}
                      className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        reminders[screening.id]
                          ? 'bg-amber-500 text-zinc-950'
                          : 'bg-zinc-900 border border-zinc-800 hover:border-amber-500/30 text-zinc-300'
                      }`}
                    >
                      {reminders[screening.id] ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>RSVP Confirmed</span>
                        </>
                      ) : (
                        <>
                          <Bell className="h-3.5 w-3.5 text-amber-400" />
                          <span>RSVP & Remind Me</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>



      {/* Unified Add/Edit Screening Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-sm p-4">
          <div className="flex min-h-full items-center justify-center py-4 sm:py-8">
            <div className="w-full max-w-2xl rounded-2xl border border-zinc-850 bg-zinc-950 p-6 shadow-2xl relative">
              <button
                onClick={() => setShowFormModal(false)}
                className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-zinc-200 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

            <div className="mb-5">
              <span className="text-xs font-mono text-amber-500 uppercase tracking-widest font-semibold">
                {editingScreening ? 'Update Coordinate' : 'Publish Schedule'}
              </span>
              <h2 className="font-serif text-xl font-bold text-zinc-100 mt-1">
                {editingScreening ? `Edit Screening: ${editingScreening.title}` : 'Schedule New Screening Event'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-sm text-zinc-300">
              {/* Intelligent Cinema Autofill & Search Bar */}
              <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-amber-500 flex items-center gap-1.5 px-1.5 py-0.5 bg-amber-500/5 rounded border border-amber-500/10 font-bold uppercase tracking-wider text-[10px]">
                    🍿 QUICK MOVIE SEARCH & AUTO-FILL
                  </span>
                  <span className="text-zinc-550 text-[10px]/none">Search by movie name</span>
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
                    <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl divide-y divide-zinc-900">
                      {lbSuggestions.map((movie, index) => (
                        <button
                          key={`${movie.title}-${movie.year}-${index}`}
                          type="button"
                          onClick={() => selectLetterboxdMovie(movie)}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-900 flex items-center gap-3 transition-colors cursor-pointer"
                        >
                          <img 
                            src={getPolishedPosterUrl(movie.title, movie.posterUrl)} 
                            className="w-7 h-10 object-cover rounded shrink-0 bg-zinc-800 border border-zinc-800/50" 
                            referrerPolicy="no-referrer" 
                            onError={(e) => {
                              e.currentTarget.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=100';
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-zinc-200 truncate">{movie.title} <span className="text-zinc-500 font-normal">({movie.year})</span></div>
                            <div className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate">Dir: {movie.director || 'Unknown'} • {movie.genre || 'Cinema'}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-zinc-500 leading-normal leading-relaxed">
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
                      <div className="text-[11px] text-zinc-400 truncate">Director: {selectedMovie.director} • {selectedMovie.runtime}</div>
                      <div className="text-[10px] text-zinc-500 font-mono max-w-full overflow-hidden text-ellipsis whitespace-nowrap">{selectedMovie.genre.join(', ')}</div>
                    </div>
                  </div>
                )}
              </div>

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
                    placeholder="e.g. Inception"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setSelectedMovie(null);
                    }}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-650 focus:border-amber-500/50 focus:outline-none"
                  />
                  {aiError && <p className="text-[10px] text-red-400 mt-1">{aiError}</p>}
                </div>

                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">DIRECTOR *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Christopher Nolan"
                    value={director}
                    onChange={(e) => {
                      setDirector(e.target.value);
                      setSelectedMovie(null);
                    }}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-650 focus:border-amber-500/50 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  <label className="block text-xs font-mono text-zinc-400 mb-1">RUNNING TIME</label>
                  <input
                    type="text"
                    value={runtime}
                    onChange={(e) => {
                      setRuntime(e.target.value);
                      setSelectedMovie(null);
                    }}
                    placeholder="e.g. 148 min"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">LANGUAGE</label>
                  <input
                    type="text"
                    value={language}
                    onChange={(e) => {
                      setLanguage(e.target.value);
                      setSelectedMovie(null);
                    }}
                    placeholder="e.g. English"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">SCREENING DATE *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-2 text-sm text-zinc-100 focus:border-amber-500/50 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">SHOWTIME (IST) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 18:30"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-2 text-sm text-zinc-100 focus:border-amber-500/50 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">IISER VENUE</label>
                  <input
                    type="text"
                    placeholder="e.g. M.N. Saha Auditorium"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-2 text-sm text-zinc-100 focus:border-amber-500/50 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">GENRES (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Sci-Fi, Thriller, Action"
                  value={genreInput}
                  onChange={(e) => {
                    setGenreInput(e.target.value);
                    setSelectedMovie(null);
                  }}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-650 focus:border-amber-500/50 focus:outline-none"
                />
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Poster Block */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-mono text-zinc-400">POSTER ARTWORK (IMAGE FILE OR URL) *</label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="Provide image link"
                        value={posterUrl}
                        onChange={(e) => {
                          setPosterUrl(e.target.value);
                          setSelectedMovie(null);
                        }}
                        className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-650 focus:border-amber-500/50 focus:outline-none"
                      />
                      <label 
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-mono font-bold text-zinc-200 cursor-pointer transition-all shrink-0"
                      >
                        {isPosterCompressing ? (
                          <span className="animate-spin h-3.5 w-3.5 border-b-2 border-amber-500 rounded-full inline-block"></span>
                        ) : (
                          <Upload className="h-3.5 w-3.5 text-amber-500" />
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
                      <p className="text-[10px] text-red-400 font-mono">{posterFileError}</p>
                    )}
                    {posterUrl && (
                      <div className="flex items-center gap-2 bg-zinc-950/40 p-1.5 rounded border border-zinc-900 leading-normal">
                        <img 
                          src={posterUrl} 
                          alt="Poster Preview" 
                          className="w-8 h-12 object-cover rounded border border-zinc-800 bg-zinc-900 shrink-0"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                             e.currentTarget.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=100';
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] text-zinc-500 truncate font-mono">
                            {posterUrl.startsWith('data:') ? '🔌 CUSTOM UPLOADED IMAGE (COMPRESSED)' : posterUrl}
                          </p>
                        </div>
                        {posterUrl.startsWith('data:') && (
                          <button
                            type="button"
                            onClick={() => setPosterUrl('')}
                            className="text-[9px] text-red-400 hover:text-red-300 font-mono px-1.5 py-0.5 bg-red-500/10 hover:bg-red-500/20 rounded cursor-pointer transition-all shrink-0"
                          >
                            RESET
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Backdrop Block */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-mono text-zinc-400">BACKDROP BANNER (IMAGE FILE OR URL)</label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="Provide backdrop banner link"
                        value={backdropUrl}
                        onChange={(e) => {
                          setBackdropUrl(e.target.value);
                          setSelectedMovie(null);
                        }}
                        className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-650 focus:border-amber-500/50 focus:outline-none"
                      />
                      <label 
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-mono font-bold text-zinc-200 cursor-pointer transition-all shrink-0"
                      >
                        {isBackdropCompressing ? (
                          <span className="animate-spin h-3.5 w-3.5 border-b-2 border-amber-500 rounded-full inline-block"></span>
                        ) : (
                          <Upload className="h-3.5 w-3.5 text-amber-500" />
                        )}
                        <span>{isBackdropCompressing ? 'COMPRESSING...' : 'UPLOAD FILE'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={isBackdropCompressing}
                          onChange={(e) => {
                            e.stopPropagation();
                            const file = e.target.files?.[0];
                            if (file) handleBackdropFileUpload(file);
                          }}
                        />
                      </label>
                    </div>
                    {backdropFileError && (
                      <p className="text-[10px] text-red-400 font-mono">{backdropFileError}</p>
                    )}
                    {backdropUrl && (
                      <div className="flex items-center gap-2 bg-zinc-950/40 p-1.5 rounded border border-zinc-900 leading-normal">
                        <img 
                          src={backdropUrl} 
                          alt="Backdrop Preview" 
                          className="w-16 h-10 object-cover rounded border border-zinc-800 bg-zinc-900 shrink-0"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=150';
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] text-zinc-500 truncate font-mono">
                            {backdropUrl.startsWith('data:') ? '🔌 CUSTOM BACKDROP IMAGE (BASE64)' : backdropUrl}
                          </p>
                        </div>
                        {backdropUrl.startsWith('data:') && (
                          <button
                            type="button"
                            onClick={() => setBackdropUrl('')}
                            className="text-[9px] text-red-400 hover:text-red-300 font-mono px-1.5 py-0.5 bg-red-500/10 hover:bg-red-500/20 rounded cursor-pointer transition-all shrink-0"
                          >
                            RESET
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">TRAILER YOUTUBE LINK</label>
                  <input
                    type="url"
                    placeholder="Provide trailer link"
                    value={trailerUrl}
                    onChange={(e) => setTrailerUrl(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-650 focus:border-amber-500/50 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">SYNOPSIS / HIGHLIGHTS</label>
                <textarea
                  rows={3}
                  placeholder="Provide a compelling preview review or description describing why this film is selected..."
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setSelectedMovie(null);
                  }}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none resize-none"
                />
              </div>

              {submitError && (
                <div className="p-3.5 rounded-lg bg-red-950/40 border border-red-900/50 text-red-400 text-xs font-medium">
                  {submitError}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-3 border-t border-zinc-900">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-semibold text-zinc-400 hover:text-zinc-200 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-amber-500 hover:bg-amber-600 text-zinc-950 px-5 py-2 rounded-lg text-sm font-semibold transition-colors font-mono flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-zinc-950"></span>
                      <span>SAVING...</span>
                    </>
                  ) : (
                    editingScreening ? 'PUBLISH CHANGES' : 'CREATE SCREENING'
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
