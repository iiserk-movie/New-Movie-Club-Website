import React, { useState } from 'react';
import { Film, User as UserIcon, LogOut, Shield, ShieldCheck, HelpCircle, GraduationCap, Camera, UploadCloud, Image as ImageIcon, Settings, Key, Eye, EyeOff } from 'lucide-react';
import { User } from '../types';
import { auth, googleProvider } from '../firebase';
import MovieClubLogo from './MovieClubLogo';
import { signInWithPopup, signInWithRedirect, signOut as fbSignOut, signInAnonymously } from 'firebase/auth';
import { getLocalGeminiKey, setLocalGeminiKey, clearLocalGeminiKey } from '../utils/movieApi';

interface NavbarProps {
  currentUser: User | null;
  onLogin: (email: string, name: string, role: 'admin' | 'student', photoURL?: string) => void;
  onLogout: () => void;
  onUpdateProfile?: (updatedFields: Partial<User>) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  adminMode: boolean;
  setAdminMode: (mode: boolean) => void;
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
}: NavbarProps) {
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
      setErrorMsg('This Google app is restricted to IISER Kolkata accounts (@iiserkol.ac.in). Please log in using your student email.');
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

    // Default role is student unless authenticated, or we can check simple passcode
    let role: 'admin' | 'student' = 'student';
    if (trimmedEmail === 'movie.activity@iiserkol.ac.in') {
      role = 'admin';
    }

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
          popupErr.code === 'auth/operation-not-supported-in-this-environment' ||
          /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
        ) {
          setErrorMsg('Popup blocked. Attempting Google Secure Sign-In Redirect...');
          await signInWithRedirect(auth, googleProvider);
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
        setErrorMsg('This Google app is restricted to IISER Kolkata accounts (@iiserkol.ac.in). Please log in using your student email.');
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
      // Give custom friendly help for embedded/sandbox/mobile environments
      if (err.message && err.message.includes('cross-origin')) {
        setErrorMsg('Embedded browser error. Please try clicking "Use another Google Account" below or select a Sandbox Simulator account to bypass.');
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
          popupErr.code === 'auth/operation-not-supported-in-this-environment' ||
          /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
        ) {
          setErrorMsg('Popup blocked. Attempting Google Admin Sign-In Redirect...');
          await signInWithRedirect(auth, googleProvider);
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
      if (err.message && err.message.includes('cross-origin')) {
        setErrorMsg('Embedded login error. Please use the experimental passcode validation below: admin123');
      } else {
        setErrorMsg(err.message || 'An error occurred during Google Admin Sign-In.');
      }
    }
  };

  const handleGoogleAccountClick = (email: string, name: string) => {
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
    if (passwordInput === 'admin123') {
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
        try {
          await signInAnonymously(auth);
        } catch (authErr) {
          console.warn("[Firebase] Anonymous session administration auth warning (Anonymous Sign-In might be disabled in Firebase console):", authErr);
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
      setErrorMsg('Incorrect passcode. Use experimental password: admin123');
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
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl h-20 items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('schedule')}>
            <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 ring-1 ring-zinc-800 p-0.5 overflow-hidden">
              <MovieClubLogo className="h-11 w-11" />
              <div className="absolute top-0 right-0 flex h-2 w-2 rounded-full bg-amber-500 animate-pulse"></div>
            </div>
            <div>
              <h1 className="font-serif text-lg font-extrabold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 via-amber-200 to-amber-400 sm:text-xl drop-shadow-[0_2px_8px_rgba(245,158,11,0.2)] uppercase">
                Movie Club
              </h1>
              <p className="font-mono text-[10px] tracking-wider text-amber-500/80 uppercase">
                IISER Kolkata
              </p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="hidden md:flex items-center space-x-1">
            {[
              { id: 'schedule', label: 'Screenings' },
              { id: 'past', label: 'Past Screenings' },
              { id: 'discussions', label: 'Discussions' },
              { id: 'recommendations', label: 'Recommendations' },
              { id: 'polls', label: 'Polls' },
              ...(currentUser ? [{ id: 'profile', label: 'My Profile' }] : [])
            ].map((tab) => (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'text-amber-400 bg-zinc-900'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-amber-500 rounded-full" />
                )}
              </button>
            ))}
          </nav>

          {/* User Session Auth Actions */}
          <div className="flex items-center space-x-4">
            {/* Quick Admin Toggler for ease of editing schedules */}
            {adminMode ? (
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1.5 rounded-lg text-xs font-mono">
                  <ShieldCheck className="h-4 w-4 text-amber-500" />
                  <span className="hidden sm:inline">Admin Mode Active</span>
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
                  className="bg-zinc-905/60 border border-zinc-800 text-zinc-400 hover:text-amber-400 hover:border-amber-500/40 p-1.5 rounded-lg text-xs font-mono transition-colors flex items-center justify-center cursor-pointer"
                  title="Configure local Gemini API key (Required for GitHub Pages hosting)"
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAdminVerify(true)}
                className="flex items-center space-x-1 text-zinc-400 hover:text-amber-400 border border-zinc-800 hover:border-amber-500/30 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors"
                title="Schedules can be edited by Admin. Code: admin123"
              >
                <Shield className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Admin Access</span>
              </button>
            )}

            {currentUser ? (
              <div className="flex items-center space-x-3 pl-2 border-l border-zinc-800">
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-medium text-zinc-200 text-ellipsis max-w-[120px] overflow-hidden">
                    {currentUser.name}
                  </p>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    {currentUser.role === 'admin' ? 'Club Coordinator' : 'IISER-K Member'}
                  </p>
                </div>
                <div 
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="relative h-9 w-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-amber-400 font-semibold cursor-pointer group"
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
                    <span>{currentUser.name.charAt(0).toUpperCase()}</span>
                  )}
                  <div className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full bg-green-500 border border-zinc-950"></div>
                  
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
                    className={`absolute right-0 top-10 bg-zinc-900 border border-zinc-800 rounded-lg py-1.5 px-2 w-48 text-left shadow-xl ${
                      showProfileDropdown ? 'block' : 'hidden md:group-hover:block'
                    } z-50 animate-fadeIn`}
                  >
                    <p className="text-[11px] font-mono text-zinc-400 border-b border-zinc-800 pb-1.5 mb-1.5 truncate">
                      {currentUser.email}
                    </p>
                    <button
                      onClick={() => {
                        setActiveTab('profile');
                        setShowProfileDropdown(false);
                      }}
                      className="w-full flex items-center space-x-2 text-zinc-350 hover:bg-zinc-800 p-1.5 rounded text-xs mb-1 transition-colors cursor-pointer"
                    >
                      <UserIcon className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span>My Profile</span>
                    </button>
                    <button
                      onClick={() => {
                        setCustomAvatarUrl(currentUser.photoURL || '');
                        setShowEditProfilePic(true);
                        setShowProfileDropdown(false);
                      }}
                      className="w-full flex items-center space-x-2 text-zinc-300 hover:bg-zinc-800 p-1.5 rounded text-xs mb-1 transition-colors"
                    >
                      <Camera className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span>Update Avatar</span>
                    </button>
                    <button
                      onClick={() => {
                        handleSignOut();
                        setShowProfileDropdown(false);
                      }}
                      className="w-full flex items-center space-x-2 text-red-400 hover:bg-zinc-855 p-1.5 rounded text-xs transition-colors"
                    >
                      <LogOut className="h-3.5 w-3.5 shrink-0" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  id="btn-signout"
                  className="p-2 text-zinc-500 hover:text-red-400 rounded-lg transition-colors hidden sm:inline-block"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                id="btn-login-trigger"
                className="flex items-center space-x-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 px-4 py-2 h-10 rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-amber-500/10 cursor-pointer"
              >
                <UserIcon className="h-4 w-4" />
                <span>Institute Login</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile quick submenu */}
        <div className="flex md:hidden items-center justify-around h-11 border-t border-zinc-900 bg-zinc-950 overflow-x-auto gap-1 scrollbar-none px-2">
          {[
            { id: 'schedule', label: 'Schedule' },
            { id: 'past', label: 'Past' },
            { id: 'discussions', label: 'Discuss' },
            { id: 'recommendations', label: 'Recs' },
            { id: 'polls', label: 'Polls' },
            ...(currentUser ? [{ id: 'profile', label: 'Profile' }] : [])
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${
                activeTab === tab.id ? 'text-amber-400 bg-zinc-900/80' : 'text-zinc-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

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

            {!isGoogleCustom ? (
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
                    Sign in with Google (Real Auth)
                  </span>
                </button>

                {errorMsg && (
                  <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/25 p-3.5 text-xs text-red-400 leading-relaxed">
                    <div className="font-bold flex items-center gap-1 mb-0.5 text-red-500 font-mono text-[10px]">
                      ⚠️ AUTH_ERROR
                    </div>
                    {errorMsg}
                  </div>
                )}

                <div className="relative my-4 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-900"></div>
                  </div>
                  <span className="relative bg-zinc-950 px-3 text-[10px] font-mono text-zinc-600 uppercase tracking-widest bg-zinc-950 select-none">
                    OR USE SANDBOX SIMULATOR
                  </span>
                </div>

                <div className="space-y-2.5 mb-6">
                  {/* Simulated movie club account */}
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest pl-1 select-none">
                    Select official club account
                  </p>

                  <button
                    onClick={() => handleGoogleAccountClick('movie.activity@iiserkol.ac.in', 'IISER Kolkata Movie Club')}
                    className="w-full flex items-center justify-between p-3.5 rounded-xl border border-zinc-900 bg-zinc-900/30 hover:bg-zinc-900/85 hover:border-amber-500/30 transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="h-8 w-8 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center font-bold text-xs select-none">
                        M
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-zinc-200 group-hover:text-amber-400 transition-colors">IISER Kolkata Movie Club</p>
                        <p className="text-[10.5px] text-zinc-500 font-mono">movie.activity@iiserkol.ac.in</p>
                      </div>
                    </div>
                    <span className="text-[9px] text-zinc-500 font-mono border border-zinc-850 px-1.5 py-0.5 rounded uppercase">Club Admin</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsGoogleCustom(true);
                      setErrorMsg('');
                    }}
                    className="w-full flex items-center justify-start p-3.5 rounded-xl border border-zinc-900 bg-zinc-950 hover:bg-zinc-900/30 border-dashed hover:border-zinc-800 transition-all text-left cursor-pointer group"
                  >
                    <div className="h-8 w-8 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800/60 flex items-center justify-center text-xs mr-3">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-zinc-400 group-hover:text-zinc-200">Use another Google Account</span>
                  </button>
                </div>

                <div className="border-t border-zinc-900 pt-4 flex items-center justify-between text-xs text-zinc-500">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-600">iiserkol.ac.in SSO auth</span>
                  <button
                    onClick={() => {
                      setShowLoginModal(false);
                      setShowAdminVerify(true);
                    }}
                    className="text-amber-500/80 hover:text-amber-400 font-mono text-[10.5px] hover:underline"
                  >
                    Coordinator Console
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col">
                {/* Manual Email Input Form */}
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
                  <h2 className="text-xl font-medium text-zinc-100 font-sans">Account Workspace Sign-In</h2>
                  <p className="text-xs text-zinc-400 mt-1.5">
                    Connect using your official IISER Kolkata email ID
                  </p>
                </div>

                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono text-zinc-400 mb-1.5 uppercase tracking-wider">
                      IISER-K Student Email ID
                    </label>
                    <input
                      type="email"
                      required
                      autoFocus
                      placeholder="e.g. username.dept21@iiserkol.ac.in"
                      value={emailInput}
                      onChange={(e) => {
                        setEmailInput(e.target.value);
                        if (errorMsg) setErrorMsg('');
                      }}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                    />
                    <span className="text-[10px] text-zinc-550 block mt-1.5 font-mono italic leading-relaxed">
                      Must end with @iiserkol.ac.in.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-zinc-400 mb-1.5 uppercase tracking-wider">
                      Full Name (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ritoban Roy"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                    />
                  </div>

                  {errorMsg && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/25 p-3.5 text-xs text-red-400 leading-relaxed">
                      <div className="font-bold flex items-center gap-1 mb-0.5 text-red-500 font-mono text-[10px]">
                        ⚠️ SSO_DOMAIN_NOT_ALLOWED
                      </div>
                      {errorMsg}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-zinc-900/70">
                    <button
                      type="button"
                      onClick={() => {
                        setIsGoogleCustom(false);
                        setEmailInput('');
                        setNameInput('');
                        setErrorMsg('');
                      }}
                      className="text-xs font-semibold text-zinc-400 hover:text-zinc-250 flex items-center space-x-1"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      <span>Choose Account</span>
                    </button>
                    
                    <button
                      type="submit"
                      className="bg-amber-500 hover:bg-amber-600 text-zinc-950 px-5 py-2 rounded-lg text-xs font-bold font-mono transition-colors"
                    >
                      SIGN IN
                    </button>
                  </div>
                </form>
              </div>
            )}
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

            {/* Real Google Sign-In Action Button for Coordinator */}
            <button
              type="button"
              onClick={handleAdminGoogleSignIn}
              className="w-full mb-4 flex items-center justify-center space-x-3 p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/90 hover:border-amber-500/50 transition-all text-center cursor-pointer shadow-lg group font-medium"
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
                <div className="w-full border-t border-zinc-900"></div>
              </div>
              <span className="relative bg-zinc-950 px-3 text-[10px] font-mono text-zinc-500 uppercase tracking-widest select-none">
                OR USE EXPERIMENTAL CODES
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
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50 text-center"
                />
                <span className="text-[10px] text-zinc-500 block text-center mt-2 font-mono">
                  Default test passcode: <code className="text-amber-500 font-bold">admin123</code>
                </span>
              </div>

              {errorMsg && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/25 p-3 text-xs text-red-400 text-center leading-relaxed">
                  {errorMsg}
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
                  className="px-4 py-2 text-sm font-semibold text-zinc-400 hover:text-zinc-200"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-600 text-zinc-950 px-5 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center space-x-1"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>Authenticate</span>
                </button>
              </div>
            </form>
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
