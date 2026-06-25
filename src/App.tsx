import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Film, Sparkles, MapPin, Users, Clapperboard 
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

        // Secondary bulletproof check: If the screenings collection has any documents,
        // do not seed. This prevents overwriting of any added details or deletions on refresh.
        let hasExistingScreenings = false;
        try {
          const screeningsCol = collection(db, 'screenings');
          const testSnap = await getDocs(query(screeningsCol, limit(1)));
          hasExistingScreenings = !testSnap.empty;
        } catch (e) {
          console.warn('[Firebase] Screenings collection check failed:', e);
        }

        if (markerExists) {
          console.log('[Firebase] Database already seeded. Direct stream active.');
          return;
        }

        if (hasExistingScreenings) {
          console.log('[Firebase] Active database detected. Backfilling master seed marker to prevent future re-seeding...');
          try {
            await setDoc(seedMarkerRef, { seeded: true, seededAt: new Date().toISOString() });
          } catch (e) {
            console.warn('[Firebase] Failed to write backfilled master seed marker:', e);
          }
          return;
        }

        console.log('[Firebase] Master seed marker not found and screenings are empty. Seeding initial datasets...');

        // 1. Seed Screenings
        try {
          const batch = writeBatch(db);
          initialScreenings.forEach((s) => {
            batch.set(doc(db, 'screenings', s.id), sanitizeDoc(s));
          });
          await batch.commit();
          console.log('[Firebase] Seeded screenings.');
        } catch (e) {
          console.warn('[Firebase] Screenings seeding error:', e);
        }

        // 2. Seed Past Movies
        try {
          const batch = writeBatch(db);
          initialPastMovies.forEach((m) => {
            batch.set(doc(db, 'pastMovies', m.id), sanitizeDoc(m));
          });
          await batch.commit();
          console.log('[Firebase] Seeded past movies.');
        } catch (e) {
          console.warn('[Firebase] Past movies seeding error:', e);
        }

        // 3. Seed Recommendations (using current user email if signed in to bypass rules)
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
          console.log('[Firebase] Seeded recommendations.');
        } catch (e) {
          console.warn('[Firebase] Recommendations seeding error:', e);
        }

        // 4. Seed Discussions
        try {
          const batch = writeBatch(db);
          initialDiscussions.forEach((d) => {
            batch.set(doc(db, 'discussions', d.id), sanitizeDoc(d));
          });
          await batch.commit();
          console.log('[Firebase] Seeded discussions.');
        } catch (e) {
          console.warn('[Firebase] Discussions seeding error:', e);
        }

        // 5. Write Seed status marker
        try {
          await setDoc(seedMarkerRef, { seeded: true, seededAt: new Date().toISOString() });
          console.log('[Firebase] Master seed marker written successfully.');
        } catch (e) {
          console.warn('[Firebase] Failed to write master seed marker:', e);
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
          // Sync to database
          syncUserToFirestore(userObj);
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
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `pastMovies/${updatedMovie.id}`);
      throw error;
    }
  };

  const handleDeletePastMovie = async (movieId: string) => {
    try {
      await deleteDoc(doc(db, 'pastMovies', movieId));
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
    <div className="min-h-screen bg-gradient-to-b from-[#13121a] via-[#0f0e14] to-[#0b0a0e] text-zinc-100 flex flex-col font-sans selection:bg-amber-400 selection:text-zinc-950">
      {/* Upper Navigation Row */}
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

      {/* Main Feature Cinematic Hero Segment */}
      {activeTab === 'schedule' && (
        <div className="relative border-b border-amber-500/10 bg-gradient-to-r from-[#211a28]/45 via-[#131119] to-[#0b0a0e] py-16 sm:py-24 overflow-hidden">
          {/* Decorative backdrop gradients representing theatrical lighting effects */}
          <div className="absolute top-0 left-1/4 h-72 w-96 bg-amber-500/12 rounded-full blur-[120px] pointer-events-none"></div>
          <div className="absolute bottom-0 right-1/4 h-72 w-96 bg-rose-500/10 rounded-full blur-[120px] pointer-events-none"></div>

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
                "Once you overcome the one-inch tall barrier of subtitles, you will be introduced to so many more amazing films." — Bong Joon-ho
              </p>

              {/* Quick stats board */}
              <div className="mt-8 flex flex-wrap gap-x-8 gap-y-4 text-xs font-mono text-zinc-500">
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4.5 w-4.5 text-amber-500/70" />
                  <span>Regular Base: <b className="text-zinc-300">M.N. Saha Auditorium</b></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main tab panel layout */}
      <main className="flex-grow mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-10">
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
      <footer className="border-t border-zinc-900 bg-zinc-980 py-12">
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
            <a href="https://letterboxd.com" target="_blank" rel="noreferrer" className="hover:text-amber-400 transition-colors">Letterboxd Diary</a>
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
    </div>
  );
}
