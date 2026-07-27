import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Film, User as UserIcon, LogOut, Shield, ShieldCheck, HelpCircle, GraduationCap, Camera, UploadCloud, Image as ImageIcon, Settings, Key, Eye, EyeOff, RefreshCw, Menu, X, Calendar, MessageSquare, Sparkles, BarChart2, History, Instagram, ExternalLink } from 'lucide-react';
import { User, PastMovie } from '../types';
import { auth, googleProvider, db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import MovieClubLogo from './MovieClubLogo';
import { signInWithPopup, signInWithRedirect, signOut as fbSignOut, signInAnonymously } from 'firebase/auth';
import { getLocalGeminiKey, setLocalGeminiKey, clearLocalGeminiKey, syncLetterboxdRSS, extractLetterboxdUsername } from '../utils/movieApi';

interface NavbarProps {
  currentUser: User | null;
  onLogin: (email: string, name: string, role: 'admin' | 'student', photoURL?: string) => void;
  onLogout: () => void;
  onUpdateProfile?: (updatedFields: Partial<User>) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  adminMode: boolean;
  setAdminMode: (mode: boolean) => void;
  onImportPastMovies?: (movies: Omit<PastMovie, 'reviews'>[]) => Promise<void>;
}

export default function Navbar({
  currentUser,
  onLogin,
  onLogout,
  onUpdateProfile,
  activeTab,
  setActiveTab,
  adminMode,
  setAdminMode,
  onImportPastMovies,
}: NavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showAdminVerify, setShowAdminVerify] = useState(false);
  const [isGoogleCustom, setIsGoogleCustom] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  // Gemini Setup States for client fallback support
  const [showGeminiModal, setShowGeminiModal] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState(getLocalGeminiKey());
  const [showKeyText, setShowKeyText] = useState(false);
  const [keySaveMsg, setKeySaveMsg] = useState('');

  // Profile Picture Upload State
  const [showEditProfilePic, setShowEditProfilePic] = useState(false);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  // Letterboxd Login & Sync States
  const [adminTab, setAdminTab] = useState<'passcode' | 'letterboxd'>('passcode');
  const [isLetterboxdSyncing, setIsLetterboxdSyncing] = useState(false);
  const [letterboxdUserToSync, setLetterboxdUserToSync] = useState(() => {
    return localStorage.getItem('last_letterboxd_sync_username') || 'ikmc';
  });
  const [syncPhaseInfo, setSyncPhaseInfo] = useState('');
  const [letterboxdSuccessMsg, setLetterboxdSuccessMsg] = useState('');

  const AVATAR_PRESETS = [
    { name: 'Popcorn', url: 'https://images.unsplash.com/photo-1578496479914-7ef3b0193be3?q=80&w=150&auto=format&fit=crop' },
    { name: 'Film Reel', url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=150&auto=format&fit=crop' },
    { name: 'Theater', url: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=150&auto=format&fit=crop' },
    { name: 'Vintage Projector', url: 'https://images.unsplash.com/photo-1543536448-d209d2d13a1c?q=80&w=150&auto=format&fit=crop' },
    { name: 'Neon Sign', url: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?q=80&w=150&auto=format&fit=crop' },
    { name: 'Clapperboard', url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=150&auto=format&fit=crop' }
  ];

  const handleAvatarFile = (file: File) => {
    setAvatarError('');
    if (!file.type.startsWith('image/')) {
      setAvatarError('Please upload an image file (PNG, JPG, SVG, WebP).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('Image is too large. Recommended size is under 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result && typeof e.target.result === 'string') {
        setCustomAvatarUrl(e.target.result);
      }
    };
    reader.onerror = () => {
      setAvatarError('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleAvatarFile(e.dataTransfer.files[0]);
    }
  };

  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleAvatarFile(e.target.files[0]);
    }
  };

  const handleSaveAvatar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customAvatarUrl) {
      setAvatarError('Please select a preset, upload a file, or enter an image URL.');
      return;
    }
    if (onUpdateProfile) {
      onUpdateProfile({ photoURL: customAvatarUrl });
    }
    setShowEditProfilePic(false);
    setCustomAvatarUrl('');
    setAvatarError('');
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput) {
      setErrorMsg('Email address is required');
      return;
    }

    const trimmedEmail = emailInput.trim().toLowerCase();
    // Validate institute email format
    const extMatch = trimmedEmail.endsWith('@iiserkol.ac.in');
    
    if (!extMatch) {
      setErrorMsg('Access is restricted to IISER Kolkata accounts (@iiserkol.ac.in). Please log in using your institute email.');
      return;
    }

    // Extrapolate a name if not provided
    let calculatedName = nameInput.trim();
    if (!calculatedName) {
      const partBeforeAt = trimmedEmail.split('@')[0];
      calculatedName = partBeforeAt
        .split('.')
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ');
    }

    // Default role is student. Manual simulation of the administrator email is blocked for safety.
    if (trimmedEmail === 'movie.activity@iiserkol.ac.in') {
      setErrorMsg('For safety, custom simulation of movie.activity@iiserkol.ac.in is blocked. Please use the Admin Access passcode instead.');
      return;
    }
    const role: 'admin' | 'student' = 'student';

    // Authenticate with Firebase anonymously to grant authorized database session
    signInAnonymously(auth).catch((err) => {
      console.warn("[Firebase] Anonymous session submit-init failed:", err);
    });

    onLogin(trimmedEmail, calculatedName, role);
    setShowLoginModal(false);
    setEmailInput('');
    setNameInput('');
    setPasswordInput('');
    setErrorMsg('');
    setIsGoogleCustom(false);
  };

  const handleRealGoogleSignIn = async () => {
    try {
      setErrorMsg('');
      let result;
      try {
        result = await signInWithPopup(auth, googleProvider);
      } catch (popupErr: any) {
        console.warn('Google Popup Sign-In blocked/failed. Trying redirect flow...', popupErr);
        if (
          popupErr.code === 'auth/popup-blocked' || 
          popupErr.code === 'auth/popup-closed-by-user' ||
          popupErr.code === 'auth/operation-not-supported-in-this-environment' ||
          /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
        ) {
          setErrorMsg('Popup was blocked, closed, or not supported. Please try again or open the app in a new tab.');
          return;
        } else {
          throw popupErr;
        }
      }
      const user = result.user;
      const email = user.email ? user.email.toLowerCase() : '';
      const name = user.displayName || 'IISER-K Member';
      
      // Enforce the rule that students can only Google login with their institute iiserkol.ac.in email
      const extMatch = email.endsWith('@iiserkol.ac.in');
      
      if (!extMatch) {
        await fbSignOut(auth);
        setErrorMsg('Access is restricted to IISER Kolkata accounts (@iiserkol.ac.in). Please log in using your institute email.');
        return;
      }
      
      let role: 'admin' | 'student' = 'student';
      if (email === 'movie.activity@iiserkol.ac.in') {
        role = 'admin';
      }
      
      onLogin(email, name, role, user.photoURL || undefined);
      setShowLoginModal(false);
      setEmailInput('');
      setNameInput('');
      setPasswordInput('');
      setErrorMsg('');
      setIsGoogleCustom(false);
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setErrorMsg('Google login popup was closed. Please try again or open the app in a new tab.');
      } else if (err.message && err.message.includes('cross-origin')) {
        setErrorMsg('Embedded browser iframe restriction. Please try clicking "Open in New Tab" to sign in.');
      } else {
        setErrorMsg(err.message || 'An error occurred during Google Sign-In.');
      }
    }
  };

  const handleAdminGoogleSignIn = async () => {
    try {
      setErrorMsg('');
      let result;
      try {
        result = await signInWithPopup(auth, googleProvider);
      } catch (popupErr: any) {
        console.warn('Google Admin Popup Sign-In blocked/failed. Trying redirect flow...', popupErr);
        if (
          popupErr.code === 'auth/popup-blocked' || 
          popupErr.code === 'auth/popup-closed-by-user' ||
          popupErr.code === 'auth/operation-not-supported-in-this-environment' ||
          /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
        ) {
          setErrorMsg('Popup was blocked, closed, or not supported. Please try again or use the secure passcode validation below.');
          return;
        } else {
          throw popupErr;
        }
      }
      const user = result.user;
      const email = user.email ? user.email.toLowerCase() : '';
      const name = user.displayName || 'Club Coordinator';
      
      const isAllowedAdmin = email === 'movie.activity@iiserkol.ac.in';

      if (!isAllowedAdmin) {
        await fbSignOut(auth);
        setErrorMsg('Administrative access denied. Only authorized Movie Club coordinators are permitted access.');
        return;
      }
      
      setAdminMode(true);
      onLogin(email, name, 'admin', user.photoURL || undefined);
      setShowAdminVerify(false);
      setPasswordInput('');
      setErrorMsg('');
    } catch (err: any) {
      console.error('Google Admin Sign-In Error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setErrorMsg('Google Admin popup was closed. Please try again or use the secure passcode validation below.');
      } else if (err.message && err.message.includes('cross-origin')) {
        setErrorMsg('Embedded login error. Please use the secure passcode validation tab below.');
      } else {
        setErrorMsg(err.message || 'An error occurred during Google Admin Sign-In.');
      }
    }
  };

  const handleGoogleAccountClick = (email: string, name: string) => {
    if (email === 'movie.activity@iiserkol.ac.in') {
      setErrorMsg('For safety, simulating movie.activity@iiserkol.ac.in requires the coordinator passcode. Please click "Admin Access" below instead.');
      return;
    }
    // Authenticate with Firebase anonymously to grant authorized database session
    signInAnonymously(auth).catch((err) => {
      console.warn("[Firebase] Anonymous session click-init failed:", err);
    });
    const role = email === 'movie.activity@iiserkol.ac.in' ? 'admin' : 'student';
    onLogin(email, name, role);
    setShowLoginModal(false);
    setEmailInput('');
    setNameInput('');
    setPasswordInput('');
    setErrorMsg('');
    setIsGoogleCustom(false);
  };

  const handleAdminAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === 'movie@2026') {
      try {
        // Sign out from any student/coordinated Google session to avoid sending a student auth token to Firestore rules
        if (auth.currentUser) {
          try {
            await fbSignOut(auth);
          } catch (signOutErr) {
            console.warn("[Firebase] Pre-admin signout error, skipping:", signOutErr);
          }
        }

        // Authenticate with Firebase anonymously to grant authorized database permission
        let sessionUser = null;
        try {
          const authResult = await signInAnonymously(auth);
          sessionUser = authResult.user;
        } catch (authErr) {
          console.warn("[Firebase] Anonymous session administration auth warning (Anonymous Sign-In might be disabled in Firebase console):", authErr);
        }

        if (sessionUser) {
          // Write the secure verification document to Firestore to grant admin status to this anonymous UID
          const sessionRef = doc(db, 'adminSessions', sessionUser.uid);
          await setDoc(sessionRef, {
            uid: sessionUser.uid,
            passcodeHash: '032cc2334b28463ebeaadeed1da30d46be8606043379d3bc85cb848fbf276687',
            createdAt: new Date().toISOString()
          });
        }
        
        setAdminMode(true);
        onLogin('movie.activity@iiserkol.ac.in', 'Movie Club Administrator', 'admin');
        setShowAdminVerify(false);
        setPasswordInput('');
        setErrorMsg('');
      } catch (err: any) {
        console.error('Anonymous Administration Auth error:', err);
        setErrorMsg('Failed to establish administration database session.');
      }
    } else {
      setErrorMsg('Incorrect passcode. Please enter the secure administrator passcode.');
    }
  };

  const handleLetterboxdLoginAndSync = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = letterboxdUserToSync.trim();
    if (!username) {
      setErrorMsg('Please enter a valid Letterboxd username.');
      return;
    }

    // Require the correct passcode for sync authorization if not already logged in as admin
    const hasAdminSession = currentUser?.email === 'movie.activity@iiserkol.ac.in';
    if (!hasAdminSession && passwordInput !== 'movie@2026') {
      setErrorMsg('Incorrect secure admin passcode. Please check and try again.');
      return;
    }

    setIsLetterboxdSyncing(true);
    setErrorMsg('');
    setLetterboxdSuccessMsg('');
    setSyncPhaseInfo('Authenticating with Firebase services of Movie Club...');

    try {
      // 1. Establish database connection session safely
      let sessionUser = auth.currentUser;
      try {
        if (!sessionUser) {
          const authResult = await signInAnonymously(auth);
          sessionUser = authResult.user;
        }
      } catch (authErr) {
        console.warn("[Firebase] Anonymous authentication warning:", authErr);
      }

      if (sessionUser) {
        // Write the secure verification document to Firestore to grant admin status to this anonymous UID
        const sessionRef = doc(db, 'adminSessions', sessionUser.uid);
        await setDoc(sessionRef, {
          uid: sessionUser.uid,
          passcodeHash: '032cc2334b28463ebeaadeed1da30d46be8606043379d3bc85cb848fbf276687',
          createdAt: new Date().toISOString()
        });
      }

      // 2. Fetch and parse the Letterboxd entries via our proxy RSS feed
      setSyncPhaseInfo(`Connecting to Letterboxd, pulling public diary RSS for "${username}"...`);
      const rawMovies = await syncLetterboxdRSS(username);
      
      if (!rawMovies || rawMovies.length === 0) {
        throw new Error(`Could not find any recent public diary or list entries. Ensure that the Letterboxd username "${username}" is correct and public.`);
      }

      setSyncPhaseInfo(`Successfully fetched ${rawMovies.length} watched entries! Synchronizing with database past screenings archive...`);

      // 3. Format and save to Firestore using batch-import callback if present
      if (onImportPastMovies) {
        const formattedMovies = rawMovies.map(m => ({
          id: m.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + m.year,
          title: m.title,
          director: m.director || 'Unknown Director',
          year: m.year,
          screenedDate: m.screenedDate || new Date().toISOString().split('T')[0],
          rating: m.rating || 4.0,
          letterboxdUrl: m.letterboxdUrl || `https://letterboxd.com/film/${m.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/`,
          posterUrl: m.posterUrl || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=300',
          synopsis: m.synopsis || 'Cinema screening curated and imported from the Movie Club Letterboxd feed.',
          genre: m.genre || ['Drama']
        }));

        await onImportPastMovies(formattedMovies);
      }

      // 4. Save username cache
      localStorage.setItem('last_letterboxd_sync_username', username);

      // 5. Complete login session as Admin!
      setAdminMode(true);
      onLogin('movie.activity@iiserkol.ac.in', `${username} (Letterboxd Sync)`, 'admin', 'https://upload.wikimedia.org/wikipedia/commons/e/e0/Letterboxd_logo_transparent_text.png');
      
      setLetterboxdSuccessMsg(`✨ Success! Unified Admin session established. Sync complete for ${rawMovies.length} Letterboxd diary films!`);
      setSyncPhaseInfo('Redirecting to Past Screenings portfolio...');

      setTimeout(() => {
        setShowAdminVerify(false);
        setIsLetterboxdSyncing(false);
        setLetterboxdSuccessMsg('');
        setSyncPhaseInfo('');
        setActiveTab('past');
      }, 2000);

    } catch (err: any) {
      console.error('Letterboxd login-sync integration failure:', err);
      setErrorMsg(err.message || 'An error occurred fetching user RSS. Verify username spelling and network connections.');
      setIsLetterboxdSyncing(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await fbSignOut(auth);
    } catch (err) {
      console.error('Firebase signOut error:', err);
    }
    onLogout();
    setAdminMode(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800/90 bg-[#100e19]/98 backdrop-blur-xl shadow-2xl shadow-black/60">
        <div className="mx-auto flex items-center justify-between min-h-[80px] sm:min-h-[88px] py-2.5 px-4 sm:px-6 lg:px-8 max-w-7xl gap-3">
          {/* Logo Brand (Left) - Always un-truncated */}
          <div className="flex items-center space-x-3 sm:space-x-3.5 cursor-pointer group shrink-0" onClick={() => setActiveTab('schedule')}>
            <div className="relative flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300">
              <MovieClubLogo className="h-11 w-11 sm:h-12 sm:w-12" />
              <div className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 rounded-full bg-amber-500 animate-pulse ring-2 ring-zinc-950"></div>
            </div>
            <div className="shrink-0">
              <h1 className="font-serif text-lg sm:text-xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 via-amber-200 to-amber-400 drop-shadow-[0_2px_12px_rgba(245,158,11,0.3)] uppercase whitespace-nowrap">
                Movie Club
              </h1>
              <p className="font-mono text-[10px] sm:text-[11px] tracking-[0.2em] text-amber-400 font-bold uppercase whitespace-nowrap">
                IISER Kolkata
              </p>
            </div>
          </div>

          {/* Navigation Items (Center) - Centered & Responsive */}
          <div className="hidden md:flex items-center justify-center flex-1 max-w-fit mx-auto px-1">
            <nav className="flex items-center bg-[#171426]/90 border border-zinc-700/60 p-1.5 rounded-2xl shadow-xl shadow-black/60 backdrop-blur-md gap-0.5 xl:gap-1.5">
              {[
                { id: 'schedule', label: 'Screenings', icon: Calendar },
                { id: 'past', label: 'Past Screenings', shortLabel: 'Past', icon: History },
                { id: 'discussions', label: 'Discussions', shortLabel: 'Forum', icon: MessageSquare },
                { id: 'recommendations', label: 'Recommendations', shortLabel: 'Wishlist', icon: Sparkles },
                { id: 'polls', label: 'Polls', icon: BarChart2 },
                ...(currentUser ? [{ id: 'profile', label: 'My Profile', shortLabel: 'Profile', icon: UserIcon }] : [])
              ].map((tab) => {
                const IconComponent = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    id={`tab-${tab.id}`}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative px-2.5 py-2 xl:px-3.5 xl:py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase transition-colors duration-200 flex items-center gap-1.5 xl:gap-2 cursor-pointer whitespace-nowrap z-10 ${
                      isActive
                        ? 'text-amber-300'
                        : 'text-zinc-300 hover:text-white hover:bg-zinc-800/50'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeNavbarPill"
                        className="absolute inset-0 bg-[#211d38] border border-amber-500/50 rounded-xl shadow-lg shadow-amber-500/20 -z-10"
                        transition={{ type: "spring", stiffness: 450, damping: 32 }}
                      />
                    )}
                    <IconComponent className={`h-3.5 w-3.5 xl:h-4 xl:w-4 ${isActive ? 'text-amber-400' : 'text-zinc-400'}`} />
                    <span className="hidden xl:inline">{tab.label}</span>
                    <span className="inline xl:hidden">{tab.shortLabel || tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* User Session Auth Actions (Right) */}
          <div className="flex items-center space-x-2 sm:space-x-3 justify-end shrink-0">
            {/* Quick Admin Toggler for ease of editing schedules */}
            {adminMode && (
              <div className="flex items-center space-x-1.5">
                <div className="flex items-center space-x-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1.5 rounded-xl text-xs font-mono font-semibold whitespace-nowrap">
                  <ShieldCheck className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="hidden sm:inline">Admin</span>
                  <button
                    onClick={() => {
                      setAdminMode(false);
                      if (currentUser && currentUser.role === 'admin') {
                        onLogin(currentUser.email, currentUser.name, 'student');
                      }
                    }}
                    className="ml-1 underline hover:text-white cursor-pointer"
                  >
                    Exit
                  </button>
                </div>
                
                {/* Custom local Gemini Config gear for GitHub Pages fallback support */}
                <button
                  onClick={() => {
                    setGeminiKeyInput(getLocalGeminiKey());
                    setShowGeminiModal(true);
                  }}
                  className="bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-amber-400 hover:border-amber-500/50 p-2 rounded-xl text-xs font-mono transition-colors flex items-center justify-center cursor-pointer shadow-md shrink-0"
                  title="Configure local Gemini API key"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>
            )}

            {currentUser ? (
              <div className="flex items-center space-x-2.5 sm:space-x-3 pl-2 sm:pl-3 border-l border-zinc-800 shrink-0">
                <div className="hidden lg:block text-right">
                  <p className="text-xs font-semibold text-zinc-100 whitespace-nowrap truncate max-w-[130px] xl:max-w-[170px]">
                    {currentUser.name}
                  </p>
                  <p className="text-[10px] text-amber-400/80 font-mono font-medium whitespace-nowrap">
                    {currentUser.role === 'admin' ? 'Club Coordinator' : 'IISER-K Member'}
                  </p>
                </div>
                <div 
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-zinc-800 border-2 border-zinc-700 hover:border-amber-500/60 flex items-center justify-center text-amber-400 font-bold cursor-pointer group shadow-lg transition-colors shrink-0"
                >
                  {currentUser.photoURL ? (
                    <img 
                      src={currentUser.photoURL} 
                      alt={currentUser.name} 
                      className="h-full w-full rounded-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <span className="text-sm">{currentUser.name.charAt(0).toUpperCase()}</span>
                  )}
                  <div className="absolute right-0 bottom-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-zinc-950"></div>
                  
                  {showProfileDropdown && (
                    <div 
                      className="fixed inset-0 z-40 bg-transparent" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowProfileDropdown(false);
                      }} 
                    />
                  )}

                  {/* Hover dropdown simulated plus touch toggle support */}
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute right-0 top-12 bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-2.5 w-52 text-left shadow-2xl ${
                      showProfileDropdown ? 'block' : 'hidden md:group-hover:block'
                    } z-50 animate-fadeIn`}
                  >
                    <p className="text-[11px] font-mono text-zinc-400 border-b border-zinc-800 pb-2 mb-2 truncate">
                      {currentUser.email}
                    </p>
                    <button
                      onClick={() => {
                        setActiveTab('profile');
                        setShowProfileDropdown(false);
                      }}
                      className="w-full flex items-center space-x-2 text-zinc-200 hover:bg-zinc-800 p-2 rounded-lg text-xs mb-1 transition-colors cursor-pointer"
                    >
                      <UserIcon className="h-4 w-4 text-amber-500 shrink-0" />
                      <span>My Profile</span>
                    </button>
                    <button
                      onClick={() => {
                        setCustomAvatarUrl(currentUser.photoURL || '');
                        setShowEditProfilePic(true);
                        setShowProfileDropdown(false);
                      }}
                      className="w-full flex items-center space-x-2 text-zinc-200 hover:bg-zinc-800 p-2 rounded-lg text-xs mb-1 transition-colors cursor-pointer"
                    >
                      <Camera className="h-4 w-4 text-amber-500 shrink-0" />
                      <span>Update Avatar</span>
                    </button>
                    <button
                      onClick={() => {
                        handleSignOut();
                        setShowProfileDropdown(false);
                      }}
                      className="w-full flex items-center space-x-2 text-red-400 hover:bg-zinc-800 p-2 rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      <LogOut className="h-4 w-4 shrink-0" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  id="btn-signout"
                  className="p-2.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-900 rounded-xl transition-colors hidden sm:inline-block cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                id="btn-login-trigger"
                className="flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 px-5 py-2.5 h-11 rounded-xl text-sm font-bold transition-all shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer"
              >
                <UserIcon className="h-4 w-4 stroke-[2.5]" />
                <span>Login</span>
              </button>
            )}

            {/* Mobile Hamburger toggle button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden flex items-center justify-center p-2.5 rounded-xl text-zinc-200 hover:text-white hover:bg-zinc-800 border border-zinc-700/80 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer transition-all shadow-md"
              title="Toggle Menu"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6 stroke-[2.5]" />
              ) : (
                <Menu className="h-6 w-6 stroke-[2.5]" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Side Menu Bar Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Dark Glass Overlay */}
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          {/* Side Drawer Body */}
          <div 
            className="fixed right-0 top-0 bottom-0 w-80 max-w-[85vw] border-l border-zinc-800 p-6 flex flex-col justify-between shadow-2xl transition-all duration-300 ease-out z-50 text-zinc-100 bg-[#0c0a14]/98 backdrop-blur-xl"
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-5">
                <div className="flex items-center space-x-3">
                  <div className="relative flex h-10 w-10 items-center justify-center shrink-0">
                    <MovieClubLogo className="h-full w-full" />
                  </div>
                  <div>
                    <span className="font-serif text-base font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 to-amber-400 uppercase tracking-wide block">
                      Movie Club
                    </span>
                    <span className="font-mono text-[10px] text-amber-400 block uppercase tracking-wider font-bold">
                      IISER Kolkata
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-all cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Navigation Tabs List */}
              <div className="flex flex-col space-y-2 overflow-y-auto max-h-[50vh] no-scrollbar py-1">
                {[
                  { id: 'schedule', label: 'Upcoming Screenings', icon: Calendar },
                  { id: 'past', label: 'Past Screenings', icon: History },
                  { id: 'discussions', label: 'Club Discussions', icon: MessageSquare },
                  { id: 'recommendations', label: 'Student Wishlist', icon: Sparkles },
                  { id: 'polls', label: 'Interactive Polls', icon: BarChart2 },
                  ...(currentUser ? [{ id: 'profile', label: 'My Member Profile', icon: UserIcon }] : [])
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3.5 rounded-xl text-sm font-semibold tracking-wide transition-all flex items-center space-x-4 border ${
                        isActive
                          ? 'text-amber-300 bg-amber-500/15 border-amber-500/40 font-bold shadow-md shadow-amber-500/10'
                          : 'text-zinc-200 hover:text-white bg-zinc-900/40 border-zinc-800/60 hover:bg-zinc-800/80'
                      }`}
                    >
                      <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-amber-400' : 'text-zinc-400'}`} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Profile snapshot & controls in Drawer Footer */}
            <div className="border-t border-zinc-800/80 pt-4 space-y-3">
              <a
                href="https://www.instagram.com/movieclub.iiserk/"
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-between bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-amber-500/10 border border-amber-500/30 p-3 rounded-2xl text-xs font-bold text-zinc-100 hover:text-amber-300 transition-all shadow-md group cursor-pointer"
              >
                <div className="flex items-center space-x-2.5">
                  <Instagram className="h-4 w-4 text-pink-400 group-hover:scale-110 transition-transform" />
                  <span>Instagram @movieclub.iiserk</span>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-zinc-400 group-hover:text-amber-400" />
              </a>

              {currentUser ? (
                <>
                  <div className="flex items-center space-x-3 bg-zinc-900/90 p-3 rounded-2xl border border-zinc-800">
                    <div className="h-10 w-10 rounded-full bg-zinc-800 border-2 border-zinc-700 overflow-hidden shrink-0 flex items-center justify-center text-amber-400 font-bold">
                      {currentUser.photoURL ? (
                        <img 
                          src={currentUser.photoURL} 
                          alt={currentUser.name} 
                          className="h-full w-full object-cover" 
                        />
                      ) : (
                        <span className="text-sm">{currentUser.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-zinc-100 truncate">{currentUser.name}</p>
                      <p className="text-[10px] text-amber-400 font-mono font-medium truncate uppercase tracking-wider">
                        {currentUser.role === 'admin' ? 'Club Coordinator' : 'IISER-K Member'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      handleSignOut();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full py-3 rounded-xl text-xs font-mono font-bold text-center border border-red-500/30 text-red-400 bg-red-950/20 hover:bg-red-950/40 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setShowLoginModal(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full py-3.5 rounded-xl text-sm font-bold text-zinc-950 bg-gradient-to-r from-amber-400 to-amber-500 shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <UserIcon className="h-4 w-4" />
                  <span>Log In / Register</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Floating Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[#0c0b15]/95 border-t border-zinc-800/90 backdrop-blur-xl px-2 py-1.5 shadow-[0_-8px_30px_rgba(0,0,0,0.85)]">
        <div className="flex items-center justify-around max-w-md mx-auto">
          {[
            { id: 'schedule', label: 'Screenings', icon: Calendar },
            { id: 'past', label: 'Past', icon: History },
            { id: 'discussions', label: 'Forum', icon: MessageSquare },
            { id: 'recommendations', label: 'Wishlist', icon: Sparkles },
            { id: 'polls', label: 'Polls', icon: BarChart2 },
            ...(currentUser 
              ? [{ id: 'profile', label: 'Profile', icon: UserIcon }] 
              : [{ id: 'login', label: 'Login', icon: UserIcon }]
            )
          ].map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id || (item.id === 'login' && showLoginModal);
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'login') {
                    setShowLoginModal(true);
                  } else {
                    setActiveTab(item.id);
                  }
                }}
                className={`relative flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all duration-200 cursor-pointer min-w-[56px] min-h-[48px] ${
                  isActive
                    ? 'text-amber-400 font-bold scale-105'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {isActive && (
                  <span className="absolute -top-1.5 w-6 h-1 bg-amber-400 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.9)]" />
                )}
                <IconComponent className={`h-5 w-5 mb-0.5 transition-transform duration-200 ${isActive ? 'text-amber-400 stroke-[2.5]' : 'text-zinc-400'}`} />
                <span className="text-[10px] tracking-tight leading-none font-sans font-semibold">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl relative">
            
            {/* Close button */}
            <button
              onClick={() => {
                setShowLoginModal(false);
                setIsGoogleCustom(false);
                setErrorMsg('');
              }}
              className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-zinc-200 rounded-lg cursor-pointer transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex flex-col">
              {/* Google Sign-in accounts screen */}
              <div className="flex flex-col items-center text-center mb-6">
                <div className="flex items-center justify-center mb-3 mt-1">
                  <svg className="h-6 w-6 mr-1.5" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12V14.4h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.23z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.87-2.6-2.87-4.53-6.16-4.53z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span className="text-zinc-200 font-sans font-medium text-lg tracking-tight">Google</span>
                </div>
                <h2 className="text-xl font-medium text-zinc-100 font-sans">Sign in with Google</h2>
                <p className="text-xs text-zinc-400 mt-1.5">
                  to continue to <span className="text-amber-400 font-semibold">MovieClub IISER Kolkata</span>
                </p>
              </div>

              {/* Real Google Sign-In Action Button */}
              <button
                type="button"
                onClick={handleRealGoogleSignIn}
                className="w-full mb-4 flex items-center justify-center space-x-3 p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/90 hover:border-amber-500/50 transition-all text-center cursor-pointer shadow-lg group font-medium"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12V14.4h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.23z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.87-2.6-2.87-4.53-6.16-4.53z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span className="text-sm font-semibold text-zinc-200 group-hover:text-amber-400 transition-colors">
                  Sign in with Google
                </span>
              </button>

              {errorMsg && (
                <div className="mb-4 rounded-xl bg-red-500/5 border border-red-500/15 p-3 text-xs text-red-400 leading-relaxed font-sans">
                  <div className="font-bold flex items-center gap-1 mb-0.5 text-red-500 text-[10px] uppercase tracking-wider">
                    Authentication Error
                  </div>
                  {errorMsg}
                </div>
              )}

              <div className="border-t border-zinc-900/80 pt-4.5 mt-2 flex items-center justify-between text-xs text-zinc-500">
                <span className="text-[10px] tracking-wider text-zinc-500 font-semibold uppercase">IISER Kolkata Accounts</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowLoginModal(false);
                    setShowAdminVerify(true);
                  }}
                  className="flex items-center space-x-1 text-zinc-400 hover:text-amber-400 border border-zinc-800 hover:border-amber-500/30 px-2.5 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer animate-fade-in"
                  title="Schedules and screenings can be managed by the Admin Console."
                >
                  <Shield className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span>Admin Access</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Admin Mode Verification Modal */}
      {showAdminVerify && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-850 bg-zinc-950 p-6 shadow-2xl">
            <div className="flex flex-col items-center text-center mb-5">
              <Shield className="h-10 w-10 text-amber-500 mb-2 animate-pulse" />
              <h2 className="font-serif text-lg font-bold text-zinc-100">Unlock Administrative Console</h2>
              <p className="text-xs text-zinc-400 mt-1 pb-2">
                Authorized IISER Kolkata Movie Club coordinators only.
              </p>
            </div>

            {/* Tab selection */}
            <div className="flex border-b border-zinc-900 mb-5 text-[10px] uppercase font-mono tracking-wider">
              <button
                type="button"
                onClick={() => {
                  setAdminTab('passcode');
                  setErrorMsg('');
                }}
                className={`flex-1 pb-2 border-b-2 font-bold transition-all cursor-pointer ${adminTab === 'passcode' ? 'border-amber-500 text-amber-500 font-extrabold' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
              >
                Passcode / Google
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdminTab('letterboxd');
                  setErrorMsg('');
                }}
                className={`flex-1 pb-2 border-b-2 font-bold transition-all cursor-pointer ${adminTab === 'letterboxd' ? 'border-amber-500 text-amber-500 font-extrabold' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
              >
                Letterboxd Sync
              </button>
            </div>

            {/* Passcode / Google Tab */}
            {adminTab === 'passcode' && (
              <div className="space-y-4">
                {/* Real Google Sign-In Action Button for Coordinator */}
                <button
                  type="button"
                  onClick={handleAdminGoogleSignIn}
                  className="w-full mb-1 flex items-center justify-center space-x-3 p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/90 hover:border-amber-500/50 transition-all text-center cursor-pointer shadow-lg group font-medium"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12V14.4h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.23z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.87-2.6-2.87-4.53-6.16-4.53z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span className="text-sm font-semibold text-zinc-200 group-hover:text-amber-400 transition-colors">
                    Sign in with Google (Admin)
                  </span>
                </button>

                <div className="relative my-4 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-900 border-zinc-900/40"></div>
                  </div>
                  <span className="relative bg-zinc-950 px-3 text-[9px] font-mono text-zinc-500 uppercase tracking-widest select-none">
                    OR USE PASSCODE
                  </span>
                </div>

                <form onSubmit={handleAdminAuthSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono text-zinc-400 mb-1.5 uppercase tracking-wider">
                      Admin Passcode
                    </label>
                    <input
                      type="password"
                      required
                      autoFocus
                      placeholder="Enter coordinates or admin passcode"
                      value={passwordInput}
                      onChange={(e) => {
                        setPasswordInput(e.target.value);
                        if (errorMsg) setErrorMsg('');
                      }}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-650 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 text-center"
                    />
                    <span className="text-[10px] text-zinc-550 block text-center mt-2 font-mono">
                      Please enter the secure coordinator passcode.
                    </span>
                  </div>

                  {errorMsg && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/25 p-3 text-xs text-red-400 text-center leading-relaxed font-mono">
                      ⚠️ {errorMsg}
                    </div>
                  )}

                  <div className="flex justify-end space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAdminVerify(false);
                        setPasswordInput('');
                        setErrorMsg('');
                      }}
                      className="px-4 py-2 text-sm font-semibold text-zinc-400 hover:text-zinc-200 cursor-pointer"
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      className="bg-amber-500 hover:bg-amber-600 text-zinc-950 px-5 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center space-x-1 cursor-pointer"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      <span>Authenticate</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Letterboxd Sync login Tab */}
            {adminTab === 'letterboxd' && (
              <form onSubmit={handleLetterboxdLoginAndSync} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1.5 uppercase tracking-wider">
                    Official Letterboxd Username
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="e.g. ikmc"
                      value={letterboxdUserToSync}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.includes('letterboxd.com') || val.includes('/') || val.includes('http')) {
                          setLetterboxdUserToSync(extractLetterboxdUsername(val));
                        } else {
                          setLetterboxdUserToSync(val);
                        }
                        if (errorMsg) setErrorMsg('');
                      }}
                      disabled={isLetterboxdSyncing}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 pl-4 pr-10 py-2.5 text-sm text-zinc-100 placeholder-zinc-650 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                    />
                    <div className="absolute right-3.5 top-3.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 block animate-pulse"></span>
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-500 block mt-2.5 font-mono leading-relaxed">
                    Connecting using public Letterboxd logs automatically downloads watched diaries directly to the <b>Past Screenings</b> db!
                  </span>
                </div>

                {currentUser?.email !== 'movie.activity@iiserkol.ac.in' && (
                  <div>
                    <label className="block text-xs font-mono text-zinc-400 mb-1.5 uppercase tracking-wider">
                      Coordinator Passcode
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Enter admin passcode to authorize"
                      value={passwordInput}
                      onChange={(e) => {
                        setPasswordInput(e.target.value);
                        if (errorMsg) setErrorMsg('');
                      }}
                      disabled={isLetterboxdSyncing}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-650 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 text-center"
                    />
                  </div>
                )}

                {syncPhaseInfo && (
                  <div className="rounded-lg bg-zinc-900/65 border border-zinc-800 p-3 text-[10.5px] text-zinc-350 font-mono flex items-center gap-2.5 leading-normal">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-500 shrink-0" />
                    <span>{syncPhaseInfo}</span>
                  </div>
                )}

                {letterboxdSuccessMsg && (
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-400 text-center font-mono leading-relaxed">
                    {letterboxdSuccessMsg}
                  </div>
                )}

                {errorMsg && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/25 p-3 text-xs text-red-400 text-center leading-relaxed font-mono">
                    ⚠️ {errorMsg}
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdminVerify(false);
                      setIsLetterboxdSyncing(false);
                      setErrorMsg('');
                    }}
                    disabled={isLetterboxdSyncing}
                    className="px-4 py-2 text-sm font-semibold text-zinc-400 hover:text-zinc-200 disabled:opacity-50 cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={isLetterboxdSyncing}
                    className="bg-amber-500 hover:bg-amber-600 disabled:opacity-55 text-zinc-950 px-5 py-2.5 rounded-lg text-xs font-bold font-mono transition-colors flex items-center space-x-1.5 shrink-0 cursor-pointer"
                  >
                    {isLetterboxdSyncing ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Synchronizing...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        <span>Sync & Login</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Update Profile Picture Modal */}
      {showEditProfilePic && currentUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fade-in" id="edit-avatar-modal">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-850 bg-zinc-950 p-6 shadow-2xl relative">
            
            {/* Close button */}
            <button
              onClick={() => {
                setShowEditProfilePic(false);
                setCustomAvatarUrl('');
                setAvatarError('');
              }}
              className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-zinc-200 rounded-lg cursor-pointer transition-colors"
              id="btn-close-avatar-modal"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex flex-col mb-5">
              <h2 className="font-serif text-xl font-bold text-zinc-100 flex items-center gap-2">
                <Camera className="h-5 w-5 text-amber-500 opacity-90" />
                <span>Customize Your Avatar</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Choose a cinematic classic preset, paste any direct image URL, or drop your own custom files!
              </p>
            </div>

            <form onSubmit={handleSaveAvatar} className="space-y-5">
              {/* Image Preview and Drag-and-Drop Area */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <div className="flex flex-col items-center justify-center p-3 bg-zinc-900/40 rounded-xl border border-zinc-900">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase mb-2 select-none">Avatar Preview</span>
                  <div className="h-20 w-20 rounded-full bg-zinc-800 border-2 border-zinc-700 overflow-hidden flex items-center justify-center text-amber-500 font-bold text-2xl relative group">
                    {customAvatarUrl ? (
                      <img 
                        src={customAvatarUrl} 
                        alt="Preview" 
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={() => setAvatarError('Invalid image URL or failed to load image.')}
                      />
                    ) : (
                      <span>{currentUser.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                </div>

                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleAvatarDrop}
                  className={`md:col-span-2 flex flex-col items-center justify-center border border-dashed rounded-xl p-4 transition-all text-center h-28 cursor-pointer relative ${
                    isDragging 
                      ? 'border-amber-500 bg-amber-500/5' 
                      : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/10'
                  }`}
                >
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleAvatarFileSelect}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    title="Click or drag to select custom file"
                    id="avatar-file-input"
                  />
                  <UploadCloud className="h-7 w-7 text-zinc-500 mb-1 pointer-events-none group-hover:text-amber-500 transition-colors" />
                  <p className="text-xs font-semibold text-zinc-300 pointer-events-none">Drag & drop profile picture</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5 pointer-events-none font-mono">or click to browse filesystem</p>
                </div>
              </div>

              {/* Preset Avatars Selection */}
              <div className="space-y-2">
                <span className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Cinematic Presets</span>
                <div className="grid grid-cols-6 gap-2">
                  {AVATAR_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setCustomAvatarUrl(preset.url);
                        setAvatarError('');
                      }}
                      className={`relative h-11 w-11 rounded-full overflow-hidden border transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                        customAvatarUrl === preset.url 
                          ? 'border-amber-500 scale-105 ring-2 ring-amber-500/20' 
                          : 'border-zinc-800 opacity-70 hover:opacity-100'
                      }`}
                      title={preset.name}
                    >
                      <img 
                        src={preset.url} 
                        alt={preset.name} 
                        className="h-full w-full object-cover" 
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* URL input field */}
              <div className="space-y-1">
                <label className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                  Or Paste Custom Image URL
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-650">
                    <ImageIcon className="h-4 w-4 text-zinc-500" />
                  </div>
                  <input
                    type="url"
                    placeholder="https://example.com/avatar.jpg"
                    value={customAvatarUrl.startsWith('data:') ? '' : customAvatarUrl}
                    onChange={(e) => {
                      setCustomAvatarUrl(e.target.value);
                      if (avatarError) setAvatarError('');
                    }}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 pl-9 pr-4 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              {avatarError && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/25 p-3 text-xs text-red-400 text-center leading-relaxed">
                  {avatarError}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-2 border-t border-zinc-900">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditProfilePic(false);
                    setCustomAvatarUrl('');
                    setAvatarError('');
                  }}
                  className="px-4 py-2 text-sm font-semibold text-zinc-400 hover:text-zinc-200"
                  id="btn-cancel-avatar"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-600 text-zinc-950 px-5 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center space-x-1"
                  id="btn-save-avatar"
                >
                  <span>Apply Avatar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Gemini API Key Configuration Modal (For Static/GitHub Pages hosting) */}
      {showGeminiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-850 bg-zinc-950 p-6 shadow-2xl">
            <div className="flex flex-col items-center text-center mb-5">
              <Key className="h-10 w-10 text-amber-500 mb-2 animate-pulse" />
              <h2 className="font-serif text-lg font-bold text-zinc-100">Setup Local Gemini AI Engine</h2>
              <p className="text-xs text-zinc-400 mt-1 pb-2 max-w-sm font-sans leading-relaxed">
                Allows automatic movie poster lookup and Letterboxd RSS imports to run completely client-side. Guaranteed companion for static environments like <b>GitHub Pages</b>.
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-3.5 text-[11px] text-amber-400/90 leading-relaxed font-mono">
                💡 <b>How it works:</b> GitHub Pages does not support running backend servers (<code className="text-amber-300">server.ts</code>). By providing your personal Gemini API Key, the website will securely call Google's GenAI model directly from your browser. Your key is stored solely in your private local browser storage and is never uploaded anywhere.
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1.5 uppercase tracking-wider">
                  Gemini API Key
                </label>
                <div className="relative">
                  <input
                    type={showKeyText ? "text" : "password"}
                    placeholder="AIzaSy..."
                    value={geminiKeyInput}
                    onChange={(e) => {
                      setGeminiKeyInput(e.target.value);
                      if (keySaveMsg) setKeySaveMsg('');
                    }}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 pl-4 pr-10 py-2.5 text-xs font-mono text-zinc-100 placeholder-zinc-750 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeyText(!showKeyText)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-550 hover:text-zinc-350 cursor-pointer"
                  >
                    {showKeyText ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {keySaveMsg && (
                <div className="rounded-lg bg-green-500/10 border border-green-500/25 p-3 text-xs text-green-450 text-center leading-relaxed font-mono">
                  {keySaveMsg}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-zinc-900">
                <button
                  type="button"
                  onClick={() => {
                    clearLocalGeminiKey();
                    setGeminiKeyInput('');
                    setKeySaveMsg('🗑️ Local Gemini key fully cleared! Website will attempt server proxies.');
                  }}
                  className="px-3 py-2 rounded-lg border border-red-500/20 text-xs text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-colors cursor-pointer font-mono"
                >
                  Clear Key
                </button>

                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowGeminiModal(false);
                      setKeySaveMsg('');
                    }}
                    className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!geminiKeyInput.trim()) {
                        setKeySaveMsg('⚠️ Please enter a valid key or clear existing.');
                        return;
                      }
                      setLocalGeminiKey(geminiKeyInput);
                      setKeySaveMsg('✨ Gemini API Key saved locally! Your browser-based AI engine is fully ready.');
                    }}
                    className="bg-amber-500 hover:bg-amber-600 text-zinc-950 px-5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 cursor-pointer"
                  >
                    <span>Save Key</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
