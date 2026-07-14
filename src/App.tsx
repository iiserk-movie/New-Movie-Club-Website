import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Film, Sparkles, MapPin, Users, Clapperboard, Calendar, Clock, Play, Bell, ChevronRight, ChevronLeft, ExternalLink, MessageSquare, Volume2, X, ChevronDown, ChevronUp, ThumbsUp, Check
} from 'lucide-react';

import { Screening, PastMovie, Recommendation, User, UserReview, ClubDiscussion, Poll } from './types';
import { initialScreenings, initialPastMovies, initialRecommendations, initialDiscussions } from './initialData';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  writeBatch,
  getDoc,
  getDocs,
  query,
  limit
} from 'firebase/firestore';

import Navbar from './components/Navbar';
import ScreeningSchedule from './components/ScreeningSchedule';
import PastScreenings from './components/PastScreenings';
import Recommendations from './components/Recommendations';
import ClubDiscussions from './components/ClubDiscussions';
import UserProfile from './components/UserProfile';
import PollsSection from './components/PollsSection';
import { CINEMA_QUOTES } from './quotesData';
import { letterboxdMovies } from './letterboxdDb';

// Use database-level seeding markers to prevent unwanted re-seeding on fresh page load/hard refresh

const sanitizeDoc = <T extends object>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

const isScreeningFullyPast = (dateStr: string, timeStr: string): boolean => {
  try {
    const [yr, mo, dy] = dateStr.split('-').map(Number);
    const [hr, mn] = (timeStr || '18:30').split(':').map(Number);
    if (isNaN(yr) || isNaN(mo) || isNaN(dy)) return false;
    // Create local timezone date for the screening start
    const screeningDateTime = new Date(yr, mo - 1, dy, hr, mn, 0);
    // Screening is fully past 3 hours after start
    const archiveThreshold = screeningDateTime.getTime() + (3 * 60 * 60 * 1000);
    return Date.now() > archiveThreshold;
  } catch {
    return false;
  }
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>('schedule');
  const [focusedDiscussionId, setFocusedDiscussionId] = useState<string | null>(null);
  const [adminMode, setAdminMode] = useState<boolean>(false);
  const [spotlightIndex, setSpotlightIndex] = useState<number>(0);
  const [showTrailerModal, setShowTrailerModal] = useState<boolean>(false);
  const [trailerUrlToPlay, setTrailerUrlToPlay] = useState<string>('');
  const [rsvpedIds, setRsvpedIds] = useState<Record<string, boolean>>({});
  const [heroFeedbackMsg, setHeroFeedbackMsg] = useState<string>('');
  const [randomQuote, setRandomQuote] = useState(() => CINEMA_QUOTES[Math.floor(Math.random() * CINEMA_QUOTES.length)]);

  const randomizeQuote = () => {
    const randomIndex = Math.floor(Math.random() * CINEMA_QUOTES.length);
    setRandomQuote(CINEMA_QUOTES[randomIndex]);
  };

  // Core schedules, past screenings, recommendations pools with initial local fallback
  const [screenings, setScreenings] = useState<Screening[]>(initialScreenings);
  const [dbLoaded, setDbLoaded] = useState<boolean>(false);
  const [pastMovies, setPastMovies] = useState<PastMovie[]>(initialPastMovies);
  const [recommendations, setRecommendations] = useState<Recommendation[]>(initialRecommendations);
  const [discussions, setDiscussions] = useState<ClubDiscussion[]>(initialDiscussions);
  const [polls, setPolls] = useState<Poll[]>([]);

  // Filter active/upcoming screenings vs past movies client-side
  const upcomingScreenings = screenings.filter(s => !isScreeningFullyPast(s.date, s.time));

  // Merge any past screenings into pastMovies client-side
  const computedPastMovies = [...pastMovies];
  screenings.forEach(s => {
    if (isScreeningFullyPast(s.date, s.time)) {
      const alreadyExists = pastMovies.some(
        pm => pm.title.toLowerCase() === s.title.toLowerCase() || pm.id === `pm-${s.id}`
      );
      if (!alreadyExists) {
        computedPastMovies.push({
          id: `pm-${s.id}`,
          title: s.title,
          director: s.director || 'Unknown',
          year: s.year || 2026,
          screenedDate: s.date,
          rating: 4.5,
          letterboxdUrl: `https://letterboxd.com/film/${s.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/`,
          posterUrl: s.posterUrl || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=300',
          synopsis: s.description || '',
          genre: s.genre || ['Cinema'],
          reviews: []
        });
      }
    }
  });

  // Sort past movies descending by screening date
  computedPastMovies.sort((a, b) => (b.screenedDate || '').localeCompare(a.screenedDate || ''));

  // Automatic database auto-archive for past screenings when an administrative user is logged in
  useEffect(() => {
    if (!adminMode || !dbLoaded || screenings.length === 0) return;

    const archiveJob = async () => {
      for (const s of screenings) {
        if (isScreeningFullyPast(s.date, s.time)) {
          console.log(`[Auto-Archive] Archive threshold met for "${s.title}". Triggering migration...`);
          const pastId = `pm-${s.id}`;
          const newPastMovie: PastMovie = {
            id: pastId,
            title: s.title,
            director: s.director || 'Unknown',
            year: s.year || 2026,
            screenedDate: s.date,
            rating: 4.5,
            letterboxdUrl: `https://letterboxd.com/film/${s.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/`,
            posterUrl: s.posterUrl || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=300',
            synopsis: s.description || '',
            genre: s.genre || ['Cinema'],
            reviews: []
          };

          try {
            await setDoc(doc(db, 'pastMovies', pastId), sanitizeDoc(newPastMovie));
            await deleteDoc(doc(db, 'screenings', s.id));
            console.log(`[Auto-Archive] Successfully moved "${s.title}" to database pastMovies.`);
          } catch (err) {
            console.warn(`[Auto-Archive] Failed to write past movie / delete screening:`, err);
          }
        }
      }
    };

    archiveJob();
  }, [screenings, adminMode]);

  // Load session auth from local storage on bootstrap
  useEffect(() => {
    const savedUser = localStorage.getItem('iiser_movie_user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser) as User;
      setCurrentUser(parsed);
      if (parsed.role === 'admin') {
        setAdminMode(true);
      }
      // Guarantee a real Firebase Auth session is active
      if (!auth.currentUser) {
        signInAnonymously(auth).catch(err => {
          console.warn("[Firebase] Anonymous session auto-init failed:", err);
        });
      }
    }
  }, []);

  // Unified Database Seeding Check on Startup (using persistent Firestore marker)
  useEffect(() => {
    const runBootstrap = async () => {
      try {
        const seedMarkerRef = doc(db, 'users', 'dbSeeded');
        
        let markerExists = false;
        try {
          const markerSnap = await getDoc(seedMarkerRef);
          markerExists = markerSnap.exists() && markerSnap.data()?.seeded === true;
        } catch (e) {
          console.warn('[Firebase] Seed marker check warning, checking collection states next:', e);
        }

        // Check if each collection is empty independently to guarantee perfect backfill seeding
        let screeningsEmpty = false;
        try {
          const testSnap = await getDocs(query(collection(db, 'screenings'), limit(1)));
          screeningsEmpty = testSnap.empty;
        } catch (e) {
          console.warn('[Firebase] screenings empty check failed:', e);
        }

        let pastMoviesEmpty = false;
        try {
          const testSnap = await getDocs(query(collection(db, 'pastMovies'), limit(1)));
          pastMoviesEmpty = testSnap.empty;
        } catch (e) {
          console.warn('[Firebase] pastMovies empty check failed:', e);
        }

        let recommendationsEmpty = false;
        try {
          const testSnap = await getDocs(query(collection(db, 'recommendations'), limit(1)));
          recommendationsEmpty = testSnap.empty;
        } catch (e) {
          console.warn('[Firebase] recommendations empty check failed:', e);
        }

        let discussionsEmpty = false;
        try {
          const testSnap = await getDocs(query(collection(db, 'discussions'), limit(1)));
          discussionsEmpty = testSnap.empty;
        } catch (e) {
          console.warn('[Firebase] discussions empty check failed:', e);
        }

        if (screeningsEmpty) {
          console.log('[Firebase] Seeding screenings...');
          try {
            const batch = writeBatch(db);
            initialScreenings.forEach((s) => {
              batch.set(doc(db, 'screenings', s.id), sanitizeDoc(s));
            });
            await batch.commit();
            console.log('[Firebase] Successfully seeded screenings.');
          } catch (e) {
            console.warn('[Firebase] Screenings seeding error:', e);
          }
        }

        if (pastMoviesEmpty) {
          console.log('[Firebase] Seeding past movies...');
          try {
            const batch = writeBatch(db);
            initialPastMovies.forEach((m) => {
              batch.set(doc(db, 'pastMovies', m.id), sanitizeDoc(m));
            });
            await batch.commit();
            console.log('[Firebase] Successfully seeded past movies.');
          } catch (e) {
            console.warn('[Firebase] Past movies seeding error:', e);
          }
        }

        if (recommendationsEmpty) {
          console.log('[Firebase] Seeding recommendations...');
          try {
            const batch = writeBatch(db);
            const userEmail = auth.currentUser?.email || null;
            initialRecommendations.forEach((r) => {
              const adjustedRec = {
                ...r,
                suggestedBy: userEmail || r.suggestedBy,
                votes: userEmail ? [userEmail] : r.votes
              };
              batch.set(doc(db, 'recommendations', r.id), sanitizeDoc(adjustedRec));
            });
            await batch.commit();
            console.log('[Firebase] Successfully seeded recommendations.');
          } catch (e) {
            console.warn('[Firebase] Recommendations seeding error:', e);
          }
        }

        if (discussionsEmpty) {
          console.log('[Firebase] Seeding discussions...');
          try {
            const batch = writeBatch(db);
            initialDiscussions.forEach((d) => {
              batch.set(doc(db, 'discussions', d.id), sanitizeDoc(d));
            });
            await batch.commit();
            console.log('[Firebase] Successfully seeded discussions.');
          } catch (e) {
            console.warn('[Firebase] Discussions seeding error:', e);
          }
        }

        // Always ensure the master marker is written if not exists or if collections were empty
        if (!markerExists) {
          try {
            await setDoc(seedMarkerRef, { seeded: true, seededAt: new Date().toISOString() });
            console.log('[Firebase] Master seed marker written successfully.');
          } catch (e) {
            console.warn('[Firebase] Failed to write master seed marker:', e);
          }
        }
      } catch (err) {
        console.warn('[Firebase] Master database seeding check bypassed or failed:', err);
      }
    };

    const timer = setTimeout(() => {
      runBootstrap();
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // Sync / screen datasets in real-time with Firestore onsnapshot
  // 1. Subscribe to Screenings
  useEffect(() => {
    const screeningsCol = collection(db, 'screenings');
    const unsubscribe = onSnapshot(screeningsCol, (snapshot) => {
      const list: Screening[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as Screening);
      });
      // Sort by date/time order
      list.sort((a, b) => {
        const dateTimeA = `${a.date || ''}T${a.time || ''}`;
        const dateTimeB = `${b.date || ''}T${b.time || ''}`;
        return dateTimeA.localeCompare(dateTimeB);
      });
      setScreenings(list);
      setDbLoaded(true);
    }, (error) => {
      const errInfo = {
        error: error instanceof Error ? error.message : String(error),
        authInfo: {
          userId: auth.currentUser?.uid,
          email: auth.currentUser?.email,
          emailVerified: auth.currentUser?.emailVerified,
          isAnonymous: auth.currentUser?.isAnonymous,
          tenantId: auth.currentUser?.tenantId,
          providerInfo: auth.currentUser?.providerData?.map(provider => ({
            providerId: provider.providerId,
            email: provider.email,
          })) || []
        },
        operationType: OperationType.LIST,
        path: 'screenings'
      };
      console.error('Firestore Error: ', JSON.stringify(errInfo));
    });

    return () => unsubscribe();
  }, []);

  // 2. Subscribe to Past Movies
  useEffect(() => {
    const pastCol = collection(db, 'pastMovies');
    const unsubscribe = onSnapshot(pastCol, (snapshot) => {
      const list: PastMovie[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as PastMovie);
      });
      // Sort past movies descending by screening date
      list.sort((a, b) => (b.screenedDate || '').localeCompare(a.screenedDate || ''));
      setPastMovies(list);
    }, (error) => {
      const errInfo = {
        error: error instanceof Error ? error.message : String(error),
        authInfo: {
          userId: auth.currentUser?.uid,
          email: auth.currentUser?.email,
          emailVerified: auth.currentUser?.emailVerified,
          isAnonymous: auth.currentUser?.isAnonymous,
          tenantId: auth.currentUser?.tenantId,
          providerInfo: auth.currentUser?.providerData?.map(provider => ({
            providerId: provider.providerId,
            email: provider.email,
          })) || []
        },
        operationType: OperationType.LIST,
        path: 'pastMovies'
      };
      console.error('Firestore Error: ', JSON.stringify(errInfo));
    });

    return () => unsubscribe();
  }, []);

  // 3. Subscribe to Recommendations
  useEffect(() => {
    const recsCol = collection(db, 'recommendations');
    const unsubscribe = onSnapshot(recsCol, (snapshot) => {
      const list: Recommendation[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as Recommendation);
      });
      // Sort by proposed date descending
      list.sort((a, b) => (b.suggestedAt || '').localeCompare(a.suggestedAt || ''));
      setRecommendations(list);
    }, (error) => {
      const errInfo = {
        error: error instanceof Error ? error.message : String(error),
        authInfo: {
          userId: auth.currentUser?.uid,
          email: auth.currentUser?.email,
          emailVerified: auth.currentUser?.emailVerified,
          isAnonymous: auth.currentUser?.isAnonymous,
          tenantId: auth.currentUser?.tenantId,
          providerInfo: auth.currentUser?.providerData?.map(provider => ({
            providerId: provider.providerId,
            email: provider.email,
          })) || []
        },
        operationType: OperationType.LIST,
        path: 'recommendations'
      };
      console.error('Firestore Error: ', JSON.stringify(errInfo));
    });

    return () => unsubscribe();
  }, []);

  // 4. Subscribe to Discussions & Reviews
  useEffect(() => {
    const discussionsCol = collection(db, 'discussions');
    const unsubscribe = onSnapshot(discussionsCol, (snapshot) => {
      const list: ClubDiscussion[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as ClubDiscussion);
      });
      // Sort by createdAt descending
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setDiscussions(list);
    }, (error) => {
      console.warn('[Firebase] Discussions onSnapshot error (handled gracefully):', error);
    });

    return () => unsubscribe();
  }, []);

  // 5. Subscribe to Selection Polls
  useEffect(() => {
    const pollsCol = collection(db, 'polls');
    const unsubscribe = onSnapshot(pollsCol, (snapshot) => {
      const list: Poll[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as Poll);
      });
      // Sort by createdAt descending
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setPolls(list);
    }, (error) => {
      console.warn('[Firebase] Polls onSnapshot error (handled gracefully):', error);
    });

    return () => unsubscribe();
  }, []);

  // Helper to sync local user state with Firestore 'users' directory
  const syncUserToFirestore = async (userObj: User) => {
    const activeUid = userObj.uid || auth.currentUser?.uid;
    if (!userObj.email || !activeUid) return;
    try {
      await setDoc(doc(db, 'users', activeUid), {
        uid: activeUid,
        email: userObj.email,
        name: userObj.name,
        role: userObj.role,
        photoURL: userObj.photoURL || '',
        lastActive: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.warn('[Firebase] Failed to write user registration to Firestore:', e);
    }
  };

  // Listen to real Firebase auth status changes and auto-login if authenticated
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const email = firebaseUser.email ? firebaseUser.email.toLowerCase() : '';
        const extMatch = email.endsWith('@iiserkol.ac.in');

        if (extMatch) {
          const name = firebaseUser.displayName || 'IISER-K Member';
          let photoURL = firebaseUser.photoURL || undefined;
          let role: 'admin' | 'student' = 'student';
          if (email === 'movie.activity@iiserkol.ac.in') {
            role = 'admin';
          }

          // Check if there is an existing custom profile picture already in the database to prevent overwriting
          try {
            const userDocSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDocSnap.exists()) {
              const dbData = userDocSnap.data();
              if (dbData.photoURL) {
                photoURL = dbData.photoURL;
              }
            }
          } catch (e) {
            console.warn('[Firebase] Failed to fetch custom user profile on auth change:', e);
          }

          const userObj: User = { uid: firebaseUser.uid, email, name, role, photoURL, lastActive: new Date().toISOString() };
          setCurrentUser(userObj);
          localStorage.setItem('iiser_movie_user', JSON.stringify(userObj));
          if (role === 'admin') {
            setAdminMode(true);
          }
          randomizeQuote();
          // Sync to database
          syncUserToFirestore(userObj);
        } else if (!firebaseUser.isAnonymous) {
          // Strictly force signout if authenticated but not @iiserkol.ac.in email
          console.warn('[Firebase] Unauthorized Google Account signed in. Force-logging out:', email);
          try {
            const { signOut: fbSignOut } = await import('firebase/auth');
            await fbSignOut(auth);
          } catch (err) {
            console.error('[Firebase] Failed to sign out unauthorized account:', err);
          }
          setCurrentUser(null);
          localStorage.removeItem('iiser_movie_user');
          setAdminMode(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Synchronize currentUser with Firestore custom fields (like photoURL, name, etc.)
  useEffect(() => {
    if (!currentUser?.uid || !db) return;

    const userDocRef = doc(db, 'users', currentUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCurrentUser(prev => {
          if (!prev) return null;
          if (
            data.photoURL !== prev.photoURL ||
            data.name !== prev.name ||
            data.role !== prev.role
          ) {
            const updated = {
              ...prev,
              name: data.name || prev.name,
              role: data.role || prev.role,
              photoURL: data.photoURL || prev.photoURL
            };
            localStorage.setItem('iiser_movie_user', JSON.stringify(updated));
            return updated;
          }
          return prev;
        });
      }
    }, (err) => {
      console.warn('[Firebase] User profile synchronization error:', err);
    });

    return () => unsubscribe();
  }, [currentUser?.uid, db]);

  // Auth Callbacks
  const handleLogin = async (email: string, name: string, role: 'admin' | 'student', photoURL?: string) => {
    const activeUid = auth.currentUser?.uid;
    let finalPhotoURL = photoURL;
    if (activeUid) {
      try {
        const userDocSnap = await getDoc(doc(db, 'users', activeUid));
        if (userDocSnap.exists()) {
          const dbData = userDocSnap.data();
          if (dbData.photoURL) {
            finalPhotoURL = dbData.photoURL;
          }
        }
      } catch (e) {
        console.warn('[Firebase] Failed to fetch custom user profile during handleLogin:', e);
      }
    }
    const userObj: User = { uid: activeUid, email, name, role, photoURL: finalPhotoURL, lastActive: new Date().toISOString() };
    setCurrentUser(userObj);
    localStorage.setItem('iiser_movie_user', JSON.stringify(userObj));
    if (role === 'admin') {
      setAdminMode(true);
    }
    randomizeQuote();
    syncUserToFirestore(userObj);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('iiser_movie_user');
    setAdminMode(false);
  };

  const handleUpdateProfile = (updatedFields: Partial<User>) => {
    if (!currentUser) return;
    const userObj: User = {
      ...currentUser,
      ...updatedFields,
      lastActive: new Date().toISOString()
    };
    setCurrentUser(userObj);
    localStorage.setItem('iiser_movie_user', JSON.stringify(userObj));
    syncUserToFirestore(userObj);
  };

  // Admin Actions for Schedule (Real-time synced updates to database)
  const handleAddScreening = async (data: Omit<Screening, 'id'>) => {
    const id = `s-${Date.now()}`;
    const newEntry: Screening = {
      ...data,
      id
    };
    try {
      await setDoc(doc(db, 'screenings', id), sanitizeDoc(newEntry));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `screenings/${id}`);
      throw error;
    }
  };

  const handleUpdateScreening = async (updatedItem: Screening) => {
    try {
      await setDoc(doc(db, 'screenings', updatedItem.id), sanitizeDoc(updatedItem));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `screenings/${updatedItem.id}`);
      throw error;
    }
  };

  const handleDeleteScreening = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'screenings', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `screenings/${id}`);
      throw error;
    }
  };

  // Past Screenings Student Reviews Action
  const handleAddReview = async (movieId: string, reviewData: Omit<UserReview, 'id' | 'createdAt'>) => {
    const newReview: UserReview = {
      ...reviewData,
      id: `r-${Date.now()}`,
      createdAt: new Date().toISOString()
    };

    const targetMovie = computedPastMovies.find(m => m.id === movieId);
    if (!targetMovie) return;

    try {
      const updatedReviews = [newReview, ...targetMovie.reviews];
      if (movieId.startsWith('pm-')) {
        const originalScreeningId = movieId.replace('pm-', '');
        const newPastMovie: PastMovie = {
          ...targetMovie,
          id: movieId,
          reviews: updatedReviews
        };
        const batch = writeBatch(db);
        batch.set(doc(db, 'pastMovies', movieId), sanitizeDoc(newPastMovie));
        batch.delete(doc(db, 'screenings', originalScreeningId));
        await batch.commit();
      } else {
        await updateDoc(doc(db, 'pastMovies', movieId), sanitizeDoc({
          reviews: updatedReviews
        }));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `pastMovies/${movieId}`);
      throw error;
    }
  };

  const handleUpdateReview = async (movieId: string, reviewId: string, updatedComment: string, updatedRating: number) => {
    const targetMovie = computedPastMovies.find(m => m.id === movieId);
    if (!targetMovie) return;

    try {
      const updatedReviews = targetMovie.reviews.map(r => {
        if (r.id === reviewId) {
          return {
            ...r,
            comment: updatedComment.trim(),
            rating: updatedRating,
            createdAt: new Date().toISOString()
          };
        }
        return r;
      });

      if (movieId.startsWith('pm-')) {
        const originalScreeningId = movieId.replace('pm-', '');
        const newPastMovie: PastMovie = {
          ...targetMovie,
          id: movieId,
          reviews: updatedReviews
        };
        const batch = writeBatch(db);
        batch.set(doc(db, 'pastMovies', movieId), sanitizeDoc(newPastMovie));
        batch.delete(doc(db, 'screenings', originalScreeningId));
        await batch.commit();
      } else {
        await updateDoc(doc(db, 'pastMovies', movieId), sanitizeDoc({
          reviews: updatedReviews
        }));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `pastMovies/${movieId}`);
      throw error;
    }
  };

  const handleDeleteReview = async (movieId: string, reviewId: string) => {
    const targetMovie = computedPastMovies.find(m => m.id === movieId);
    if (!targetMovie) return;

    try {
      const updatedReviews = targetMovie.reviews.filter(r => r.id !== reviewId);
      if (movieId.startsWith('pm-')) {
        const originalScreeningId = movieId.replace('pm-', '');
        const newPastMovie: PastMovie = {
          ...targetMovie,
          id: movieId,
          reviews: updatedReviews
        };
        const batch = writeBatch(db);
        batch.set(doc(db, 'pastMovies', movieId), sanitizeDoc(newPastMovie));
        batch.delete(doc(db, 'screenings', originalScreeningId));
        await batch.commit();
      } else {
        await updateDoc(doc(db, 'pastMovies', movieId), sanitizeDoc({
          reviews: updatedReviews
        }));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `pastMovies/${movieId}`);
      throw error;
    }
  };

  const handleImportPastMovies = async (importedMovies: Omit<PastMovie, 'reviews'>[]) => {
    try {
      const batch = writeBatch(db);
      importedMovies.forEach(movie => {
        const finalId = movie.id || `pm-${movie.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
        const newDocPayload: PastMovie = {
          ...movie,
          id: finalId,
          reviews: []
        };
        batch.set(doc(db, 'pastMovies', finalId), sanitizeDoc(newDocPayload));
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `pastMovies/batch-import`);
      throw error;
    }
  };

  const handleUpdatePastMovie = async (updatedMovie: PastMovie) => {
    try {
      await setDoc(doc(db, 'pastMovies', updatedMovie.id), sanitizeDoc(updatedMovie));
      
      // Also delete corresponding screening if it exists so that it resides purely in pastMovies and is not duplicated
      const screeningId = updatedMovie.id.startsWith('pm-') ? updatedMovie.id.replace('pm-', '') : updatedMovie.id;
      await deleteDoc(doc(db, 'screenings', screeningId));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `pastMovies/${updatedMovie.id}`);
      throw error;
    }
  };

  const handleDeletePastMovie = async (movieId: string) => {
    try {
      await deleteDoc(doc(db, 'pastMovies', movieId));
      
      // Also delete corresponding screening if it exists so that it doesn't keep regenerating
      const screeningId = movieId.startsWith('pm-') ? movieId.replace('pm-', '') : movieId;
      await deleteDoc(doc(db, 'screenings', screeningId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `pastMovies/${movieId}`);
      throw error;
    }
  };

  // Student Recommendation Submission Action
  const handleAddRecommendation = async (recData: Omit<Recommendation, 'id' | 'suggestedBy' | 'suggestedByName' | 'suggestedAt' | 'votes'>): Promise<'added' | 'voted' | 'already_voted'> => {
    if (!currentUser) return 'added';
    
    const cleanTitle = recData.title.trim().toLowerCase();
    const existing = recommendations.find(r => r.title.trim().toLowerCase() === cleanTitle);

    if (existing) {
      if (!existing.votes.includes(currentUser.email)) {
        try {
          const updatedVotes = [...existing.votes, currentUser.email];
          // Eager state update to avoid stale layout
          setRecommendations(prev => prev.map(r => r.id === existing.id ? { ...r, votes: updatedVotes } : r));

          await updateDoc(doc(db, 'recommendations', existing.id), {
            votes: updatedVotes
          });
          return 'voted';
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `recommendations/${existing.id}`);
          return 'voted';
        }
      } else {
        return 'already_voted';
      }
    }
    
    const id = `rec-${Date.now()}`;
    const newRec: Recommendation = {
      ...recData,
      id,
      suggestedBy: currentUser.email,
      suggestedByName: currentUser.name,
      suggestedAt: new Date().toISOString(),
      votes: [currentUser.email] // core authors auto-upvote their entries
    };

    // Eager state update to avoid stale layout
    setRecommendations(prev => [newRec, ...prev]);

    try {
      await setDoc(doc(db, 'recommendations', id), sanitizeDoc(newRec));
      return 'added';
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `recommendations/${id}`);
      return 'added';
    }
  };

  const handleUpdateRecommendation = async (id: string, updatedFields: Partial<Recommendation>) => {
    // Eager update
    setRecommendations(prev => prev.map(r => r.id === id ? { ...r, ...updatedFields } : r));
    try {
      await updateDoc(doc(db, 'recommendations', id), sanitizeDoc(updatedFields));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `recommendations/${id}`);
    }
  };

  const handleDeleteRecommendation = async (id: string) => {
    // Eager update
    setRecommendations(prev => prev.filter(r => r.id !== id));
    try {
      await deleteDoc(doc(db, 'recommendations', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `recommendations/${id}`);
    }
  };

  const handleMarkScreeningAsScreened = async (screening: Screening, date: string, rating: number) => {
    const pastId = `pm-${Date.now()}`;
    const newPastMovie: PastMovie = {
      id: pastId,
      title: screening.title,
      director: screening.director,
      year: screening.year,
      screenedDate: date || new Date().toISOString().split('T')[0],
      rating: rating || 4.5,
      letterboxdUrl: `https://letterboxd.com/film/${screening.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/`,
      posterUrl: screening.posterUrl || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=300',
      synopsis: screening.description || '',
      genre: screening.genre || ['Cinema'],
      reviews: []
    };

    try {
      // 1. Add to pastMovies collection
      await setDoc(doc(db, 'pastMovies', pastId), sanitizeDoc(newPastMovie));
      // 2. Delete from screenings collection
      await deleteDoc(doc(db, 'screenings', screening.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `pastMovies/${pastId}`);
    }
  };

  const handleMarkScreened = async (rec: Recommendation, date: string, rating: number) => {
    const pastId = `pm-${Date.now()}`;
    const genreArray = rec.genre
      ? rec.genre.split(',').map((g: string) => g.trim()).filter(Boolean)
      : ['Cinema'];

    const newPastMovie: PastMovie = {
      id: pastId,
      title: rec.title,
      director: rec.director,
      year: rec.year,
      screenedDate: date || new Date().toISOString().split('T')[0],
      rating: rating || 4.5,
      letterboxdUrl: `https://letterboxd.com/film/${rec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/`,
      posterUrl: rec.posterUrl || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=300',
      synopsis: rec.notes || '',
      genre: genreArray,
      reviews: []
    };

    try {
      // 1. Add to pastMovies collection
      await setDoc(doc(db, 'pastMovies', pastId), sanitizeDoc(newPastMovie));
      // 2. Delete from recommendations collection
      await deleteDoc(doc(db, 'recommendations', rec.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `pastMovies/${pastId}`);
    }
  };

  const handleVoteRecommendation = async (id: string, userEmail: string) => {
    const rec = recommendations.find(r => r.id === id);
    if (!rec) return;

    const hasVoted = rec.votes.includes(userEmail);
    const newVotes = hasVoted 
      ? rec.votes.filter(email => email !== userEmail) // revoke upvote
      : [...rec.votes, userEmail]; // add upvote

    // Local state eager update
    setRecommendations(prev => prev.map(r => r.id === id ? { ...r, votes: newVotes } : r));

    try {
      await updateDoc(doc(db, 'recommendations', id), {
        votes: newVotes
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `recommendations/${id}`);
    }
  };

  const handleAddDiscussion = async (data: Omit<ClubDiscussion, 'id' | 'createdAt' | 'authorEmail' | 'authorName' | 'votes' | 'comments'>) => {
    if (!currentUser) return;
    const id = `disc-${Date.now()}`;
    const newEntry: ClubDiscussion = {
      ...data,
      id,
      authorEmail: currentUser.email,
      authorName: currentUser.name,
      createdAt: new Date().toISOString(),
      votes: [currentUser.email],
      comments: []
    };
    try {
      await setDoc(doc(db, 'discussions', id), sanitizeDoc(newEntry));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `discussions/${id}`);
    }
  };

  const handleAddComment = async (discussionId: string, content: string) => {
    if (!currentUser) return;
    const target = discussions.find(d => d.id === discussionId);
    if (!target) return;

    const newComment = {
      id: `comm-${Date.now()}`,
      authorEmail: currentUser.email,
      authorName: currentUser.name,
      content,
      createdAt: new Date().toISOString()
    };

    try {
      const updatedComments = [...target.comments, newComment];
      await updateDoc(doc(db, 'discussions', discussionId), {
        comments: updatedComments
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `discussions/${discussionId}`);
    }
  };

  const handleVoteDiscussion = async (discussionId: string) => {
    if (!currentUser) return;
    const target = discussions.find(d => d.id === discussionId);
    if (!target) return;

    const hasVoted = target.votes.includes(currentUser.email);
    const newVotes = hasVoted
      ? target.votes.filter(email => email !== currentUser.email)
      : [...target.votes, currentUser.email];

    try {
      await updateDoc(doc(db, 'discussions', discussionId), {
        votes: newVotes
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `discussions/${discussionId}`);
    }
  };

  const handleDeleteDiscussion = async (discussionId: string) => {
    try {
      await deleteDoc(doc(db, 'discussions', discussionId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `discussions/${discussionId}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a090d] bg-gradient-to-br from-[#1b1424] via-[#0d0c11] to-[#060608] text-zinc-100 flex flex-col font-sans selection:bg-amber-400 selection:text-zinc-950 relative overflow-x-hidden">
      {/* Decorative backdrop gradients representing theatrical lighting effects applied globally behind all content */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-1/4 h-[500px] w-[500px] bg-amber-500/8 rounded-full blur-[130px]"></div>
        <div className="absolute top-[30%] right-[10%] h-[600px] w-[600px] bg-purple-600/5 rounded-full blur-[140px]"></div>
        <div className="absolute bottom-[10%] left-[-10%] h-[600px] w-[600px] bg-rose-500/6 rounded-full blur-[140px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] bg-amber-500/5 rounded-full blur-[130px]"></div>
      </div>

      {/* Upper Navigation Row */}
      <div className="relative z-50">
        <Navbar
          currentUser={currentUser}
          onLogin={handleLogin}
          onLogout={handleLogout}
          onUpdateProfile={handleUpdateProfile}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          adminMode={adminMode}
          setAdminMode={setAdminMode}
          onImportPastMovies={handleImportPastMovies}
        />
      </div>

      {/* Main Feature Cinematic Hero Segment */}
      {activeTab === 'schedule' && (
        (() => {
          const featured = upcomingScreenings[spotlightIndex] || upcomingScreenings[0] || null;
          if (!featured) {
            return (
              <div className="relative border-b border-zinc-900/40 bg-zinc-950/20 py-20 overflow-hidden z-10">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
                  <div className="max-w-3xl">
                    <div className="inline-flex items-center space-x-1.5 bg-zinc-900/90 border border-zinc-800/80 px-3.5 py-1.5 rounded-full text-xs font-mono text-amber-500 mb-6 font-semibold shadow-inner shadow-amber-500/5">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping"></span>
                      <span>MOVIE CLUB • IISER KOLKATA</span>
                    </div>

                    <h2 className="font-serif text-4xl sm:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 via-amber-200 to-amber-300 tracking-tight leading-[1.1] animate-glow">
                      Explore the Language of Cinema.
                    </h2>
                    
                    <p className="mt-4 text-sm sm:text-base text-zinc-350 max-w-2xl leading-relaxed italic font-serif">
                      "{randomQuote.text}" — <span className="text-amber-400/90 font-mono font-medium tracking-wide uppercase text-xs">{randomQuote.author}</span>
                    </p>

                    <div className="mt-8 flex flex-wrap gap-x-8 gap-y-4 text-xs font-mono text-zinc-500">
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4.5 w-4.5 text-amber-500/70" />
                        <span>Regular Base: <b className="text-zinc-300">M.N. Saha Auditorium</b></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          const formatPrettyDate = (dateStr: string) => {
            const options: any = { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' };
            return new Date(dateStr).toLocaleDateString('en-US', options);
          };

          const getYoutubeEmbedUrl = (url?: string): string => {
            if (!url) return '';
            try {
              let videoId = '';
              if (url.includes('v=')) {
                videoId = url.split('v=')[1].split('&')[0];
              } else if (url.includes('youtu.be/')) {
                videoId = url.split('youtu.be/')[1].split('?')[0];
              } else if (url.includes('embed/')) {
                videoId = url.split('embed/')[1].split('?')[0];
              }
              return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0` : '';
            } catch {
              return '';
            }
          };

          return (
            <div className="relative border-b border-zinc-900 overflow-hidden z-10 bg-zinc-950">
              <div className="absolute inset-0 z-0">
                <img 
                  src={featured.backdropUrl || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=1200'} 
                  alt="" 
                  className="w-full h-full object-cover object-center scale-102 filter blur-[2px] opacity-25 brightness-[0.4]"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0a090d] via-[#0a090d]/85 to-[#0a090d]/30"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a090d] via-transparent to-transparent"></div>
              </div>

              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 items-center">
                <div className="lg:col-span-8 space-y-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center space-x-1.5 bg-amber-500/15 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-full text-xs font-mono font-bold tracking-wider uppercase shadow-inner">
                      <Sparkles className="h-3 w-3 text-amber-400 animate-pulse" />
                      <span>SPOTLIGHT SHOWCASE</span>
                    </span>
                    <span className="inline-flex items-center space-x-1 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full text-xs font-mono text-zinc-400">
                      <span>Screening {spotlightIndex + 1} of {upcomingScreenings.length}</span>
                    </span>
                  </div>

                  <h2 className="font-serif text-4xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-zinc-550 via-zinc-150 to-amber-250 tracking-tight leading-[1.05] animate-glow">
                    {featured.title}
                  </h2>

                  <p className="font-mono text-xs text-zinc-400 font-semibold uppercase tracking-wider flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span>Director: <span className="text-amber-400">{featured.director}</span></span>
                    <span className="text-zinc-700">•</span>
                    <span>Year: <span className="text-zinc-200">{featured.year}</span></span>
                    <span className="text-zinc-700">•</span>
                    <span>Runtime: <span className="text-zinc-200">{featured.runtime}</span></span>
                    <span className="text-zinc-700">•</span>
                    <span>Language: <span className="text-zinc-200">{featured.language}</span></span>
                  </p>

                  <p className="text-sm sm:text-base text-zinc-350 max-w-2xl leading-relaxed italic font-serif">
                    "{featured.description}"
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl pt-2 font-sans">
                    <div className="flex items-center space-x-2.5 bg-zinc-900/60 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-zinc-850">
                      <Calendar className="h-4.5 w-4.5 text-amber-400" />
                      <div>
                        <span className="text-zinc-500 block text-[9px] uppercase tracking-wider font-mono">Screen Date</span>
                        <span className="text-zinc-200 text-xs font-bold">{formatPrettyDate(featured.date)}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2.5 bg-zinc-900/60 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-zinc-850">
                      <Clock className="h-4.5 w-4.5 text-rose-400" />
                      <div>
                        <span className="text-zinc-500 block text-[9px] uppercase tracking-wider font-mono">Showtime</span>
                        <span className="text-zinc-200 text-xs font-bold">{featured.time} IST</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2.5 bg-zinc-900/60 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-zinc-850">
                      <MapPin className="h-4.5 w-4.5 text-emerald-400" />
                      <div className="min-w-0">
                        <span className="text-zinc-500 block text-[9px] uppercase tracking-wider font-mono">Venue Lounge</span>
                        <span className="text-zinc-200 text-xs font-bold truncate block" title={featured.venue}>
                          {featured.venue.split(',')[0]}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3.5 pt-4">
                    {featured.trailerUrl && (
                      <button
                        onClick={() => {
                          const embed = getYoutubeEmbedUrl(featured.trailerUrl);
                          if (embed) {
                            setTrailerUrlToPlay(embed);
                            setShowTrailerModal(true);
                          } else {
                            window.open(featured.trailerUrl, '_blank');
                          }
                        }}
                        className="flex items-center space-x-2.5 bg-amber-500 hover:bg-amber-600 active:scale-98 text-zinc-950 px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-xl shadow-amber-500/10 cursor-pointer"
                      >
                        <Play className="h-4 w-4 fill-zinc-950" />
                        <span>Watch Trailer</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setActiveTab('discussions');
                        setFocusedDiscussionId(null);
                      }}
                      className="flex items-center space-x-2.5 bg-zinc-900/60 hover:bg-zinc-900/90 text-zinc-400 hover:text-zinc-200 border border-zinc-800 px-5 py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer"
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span>Discussion Board</span>
                    </button>
                  </div>

                  {upcomingScreenings.length > 1 && (
                    <div className="pt-6 border-t border-zinc-900/60 max-w-2xl">
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2 font-bold">
                        NEXT IN THEATRES:
                      </p>
                      <div className="flex flex-wrap gap-2.5">
                        {upcomingScreenings.map((screen, sIdx) => (
                          <button
                            key={screen.id}
                            onClick={() => setSpotlightIndex(sIdx)}
                            className={`px-3 py-1.5 rounded-lg border text-left text-xs transition-all flex items-center space-x-2 cursor-pointer ${
                              spotlightIndex === sIdx
                                ? 'bg-amber-500/10 border-amber-500/50 text-amber-400 font-bold'
                                : 'bg-zinc-900/40 border-zinc-900 text-zinc-400 hover:border-zinc-800 hover:text-zinc-200'
                            }`}
                          >
                            <span className="font-mono text-[9px] text-zinc-500">#{sIdx + 1}</span>
                            <span className="truncate max-w-[150px]">{screen.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-4 hidden lg:flex justify-center relative">
                  <div className="absolute -inset-1 rounded-3xl bg-gradient-to-tr from-amber-500/10 to-purple-500/15 blur-2xl opacity-60 z-0"></div>
                  
                  <div className="relative group/poster z-10">
                    <img 
                      src={featured.posterUrl || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600'} 
                      alt="" 
                      className="h-[380px] w-[260px] object-cover rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] border border-zinc-800 transition-all duration-700 ease-out transform group-hover/poster:-translate-y-2 group-hover/poster:rotate-1 group-hover/poster:shadow-[0_30px_60px_-10px_rgba(245,158,11,0.25)]"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 left-3 bg-zinc-950/90 backdrop-blur-md px-2.5 py-1 rounded-md text-[9px] font-mono font-bold text-amber-400 uppercase border border-zinc-800 shadow-md">
                      🍿 {featured.runtime}
                    </div>
                  </div>
                </div>
              </div>

              {heroFeedbackMsg && (
                <div className="absolute bottom-6 right-6 z-40 bg-zinc-900 text-amber-400 border border-amber-500/35 px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-2.5 text-xs font-mono animate-slide-in">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping"></div>
                  <span>{heroFeedbackMsg}</span>
                </div>
              )}
            </div>
          );
        })()
      )}

      {/* Main tab panel layout */}
      <main className="flex-grow mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {activeTab === 'schedule' && (
              <ScreeningSchedule
                screenings={upcomingScreenings}
                adminMode={adminMode}
                onAddScreening={handleAddScreening}
                onUpdateScreening={handleUpdateScreening}
                onDeleteScreening={handleDeleteScreening}
                currentUserEmail={currentUser?.email}
                onMarkScreeningAsScreened={handleMarkScreeningAsScreened}
              />
            )}

            {activeTab === 'past' && (
              <PastScreenings
                pastMovies={computedPastMovies}
                onAddReview={handleAddReview}
                currentUser={currentUser}
                onUpdateReview={handleUpdateReview}
                onDeleteReview={handleDeleteReview}
                adminMode={adminMode}
                onImportPastMovies={handleImportPastMovies}
                onUpdatePastMovie={handleUpdatePastMovie}
                onDeletePastMovie={handleDeletePastMovie}
              />
            )}

            {activeTab === 'discussions' && (
              <ClubDiscussions
                discussions={discussions}
                onAddDiscussion={handleAddDiscussion}
                onAddComment={handleAddComment}
                onVoteDiscussion={handleVoteDiscussion}
                onDeleteDiscussion={handleDeleteDiscussion}
                currentUser={currentUser}
                adminMode={adminMode}
                focusedDiscussionId={focusedDiscussionId}
                onSelectDiscussion={setFocusedDiscussionId}
              />
            )}

            {activeTab === 'recommendations' && (
              <Recommendations
                recommendations={recommendations}
                currentUser={currentUser}
                adminMode={adminMode}
                onAddRecommendation={handleAddRecommendation}
                onVoteRecommendation={handleVoteRecommendation}
                onUpdateRecommendation={handleUpdateRecommendation}
                onMarkScreened={handleMarkScreened}
                onDeleteRecommendation={handleDeleteRecommendation}
              />
            )}

            {activeTab === 'polls' && (
              <PollsSection
                polls={polls}
                currentUser={currentUser}
                adminMode={adminMode}
              />
            )}

            {activeTab === 'profile' && (
              <UserProfile
                currentUser={currentUser}
                pastMovies={computedPastMovies}
                discussions={discussions}
                recommendations={recommendations}
                polls={polls}
                setActiveTab={setActiveTab}
                setFocusedDiscussionId={setFocusedDiscussionId}
                onUpdateReview={handleUpdateReview}
                onDeleteReview={handleDeleteReview}
              />
            )}


          </motion.div>
        </AnimatePresence>
      </main>

      {/* Primary Footer Section adhering to strict branding limits */}
      <footer className="border-t border-zinc-900 bg-zinc-980/80 backdrop-blur-md py-12 relative z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left space-y-1">
            <h3 className="font-serif text-sm font-semibold tracking-wide text-zinc-300 uppercase">
              Movie Club IISER Kolkata
            </h3>
            <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
              The Film Studies Society • IISER Kolkata
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-mono text-zinc-500">
            <a href="https://letterboxd.com/ikmc/diary/" target="_blank" rel="noreferrer" className="hover:text-amber-400 transition-colors">Letterboxd Diary</a>
            <span className="text-zinc-800">•</span>
            <a href="https://iiserkol.ac.in" target="_blank" rel="noreferrer" className="hover:text-amber-400 transition-colors">IISER Kolkata Main</a>
            <span className="text-zinc-800">•</span>
            <span className="text-zinc-600">M.N. Saha Auditorium, Ground Floor, TRC building, Mohanpur, West Bengal 741246</span>
          </div>

          <div className="text-center md:text-right">
            <p className="text-[10px] text-zinc-600">
              © 2026 Movie Club IISER Kolkata. Created for cinema lovers of Indian Institute of Science Education and Research, Kolkata.
            </p>
          </div>
        </div>
      </footer>

      {/* Trailer Modal Overlay */}
      {showTrailerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="relative w-full max-w-4xl aspect-video rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl animate-scale-up">
            <button
              onClick={() => {
                setShowTrailerModal(false);
                setTrailerUrlToPlay('');
              }}
              className="absolute top-4 right-4 z-10 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-white p-2 rounded-xl border border-zinc-800 cursor-pointer transition-colors"
              title="Close trailer"
            >
              <X className="h-5 w-5" />
            </button>
            {trailerUrlToPlay ? (
              <iframe
                src={trailerUrlToPlay}
                title="Movie Trailer"
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              ></iframe>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500 font-mono text-xs">
                No active trailer source found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
