import { GoogleGenAI, Type } from "@google/genai";

// Interface for Movie Details
export interface MovieDetails {
  title: string;
  year: number;
  description: string;
  director: string;
  duration: string;
  genre: string;
  letterboxdSlug: string;
  wikipediaTitle: string;
  posterUrl: string;
  backdropUrl: string;
  language: string;
  trailerUrl: string;
}

// Interface for Search Results
export interface SearchMovieResult {
  title: string;
  year: number;
  description: string;
  director: string;
  duration: string;
  genre: string;
  letterboxdSlug: string;
  wikipediaTitle: string;
  posterUrl: string;
  backdropUrl: string;
}

// Interface for Letterboxd Watch Entry
export interface LetterboxdWatchEntry {
  title: string;
  year: number;
  letterboxdUrl: string;
  screenedDate: string;
  rating: number;
  synopsis: string;
  director: string;
  genre: string[];
  posterUrl: string;
}

// Helper to check if a local Gemini key exists
export function getLocalGeminiKey(): string {
  return localStorage.getItem('iiser_movieclub_gemini_key') || '';
}

// Helper to save local Gemini key
export function setLocalGeminiKey(key: string): void {
  localStorage.setItem('iiser_movieclub_gemini_key', key.trim());
}

// Helper to clear local Gemini key
export function clearLocalGeminiKey(): void {
  localStorage.removeItem('iiser_movieclub_gemini_key');
}

/**
 * Client-Side crawler to extract basic metadata from IMDb or Letterboxd pages via CORS proxy.
 */
async function fetchClientUrlMetadata(url: string): Promise<any> {
  try {
    let cleanUrl = url.trim();

    // Check for raw IMDb IDs (like tt1234567) or links
    const rawImdbIdMatch = cleanUrl.match(/\b(tt\d{7,10})\b/i);
    const hasImdbDomain = /imdb\.com/i.test(cleanUrl);

    let isImdb = false;
    let isLetterboxd = false;

    if (rawImdbIdMatch && !hasImdbDomain) {
      cleanUrl = `https://www.imdb.com/title/${rawImdbIdMatch[1]}/`;
      isImdb = true;
    } else {
      isImdb = /imdb\.com\/title\/(tt\d+)/i.test(cleanUrl);
      isLetterboxd = /letterboxd\.com\/film\/([a-zA-Z0-9\-_]+)/i.test(cleanUrl);
    }

    if (!isImdb && !isLetterboxd) {
      return null;
    }

    let targetUrl = cleanUrl;
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }

    // Call AllOrigins CORS proxy
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) return null;
    
    const data = await response.json();
    const html = data.contents;
    if (!html) return null;

    // Extract basic OG properties
    const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) 
                    || html.match(/<title>([^<]+)<\/title>/i);
    const descMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i)
                   || html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
    const imageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)
                    || html.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"/i);

    let title = titleMatch ? titleMatch[1].trim() : '';
    let description = descMatch ? descMatch[1].trim() : '';
    let posterUrl = imageMatch ? imageMatch[1].trim() : '';

    const decodeHtml = (str: string) => {
      return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'");
    };

    title = decodeHtml(title);
    description = decodeHtml(description);
    posterUrl = decodeHtml(posterUrl);

    if (isImdb) {
      title = title.replace(/\s*-\s*IMDb$/i, '');
      const yearMatch = title.match(/\((\d{4})\)/);
      const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
      title = title.replace(/\s*\(\d{4}\)/, '').trim();

      // Clean typical IMDb description prefixes
      description = description.replace(/^Directed by [^.]+\.\s*With [^.]+\.\s*/i, '');
      description = description.replace(/^[^:]+:\s*/, '');
      
      const idMatch = targetUrl.match(/(tt\d+)/);
      const imdbId = idMatch ? idMatch[1] : '';

      return {
        title,
        year,
        description,
        posterUrl,
        imdbId,
        isImdb: true
      };
    }

    if (isLetterboxd) {
      const yearMatch = title.match(/\((\d{4})\)/);
      const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
      title = title.replace(/\s*\(\d{4}\)/, '').trim();

      const slugMatch = targetUrl.match(/letterboxd\.com\/film\/([a-zA-Z0-9\-_]+)/i);
      const letterboxdSlug = slugMatch ? slugMatch[1] : '';

      return {
        title,
        year,
        description,
        posterUrl,
        letterboxdSlug,
        isLetterboxd: true
      };
    }

    return null;
  } catch (err) {
    console.warn('[Movie API] Client fetchUrlMetadata failed:', err);
    return null;
  }
}

/**
 * Keyless Wikipedia search and detail extractor
 */
async function fetchWikipediaMetadata(movieTitle: string, releaseYear?: number): Promise<any> {
  try {
    let searchQuery = '';
    const imdbIdMatch = movieTitle.match(/\b(tt\d{7,10})\b/i);
    if (imdbIdMatch) {
      searchQuery = imdbIdMatch[1];
    } else if (releaseYear) {
      searchQuery = `${movieTitle} ${releaseYear} film`;
    } else {
      searchQuery = `${movieTitle} film`;
    }
    
    // Search Wikipedia
    const searchUrl = `https://en.wikipedia.org/w/api.php?origin=*&action=query&list=search&srsearch=${encodeURIComponent(searchQuery)}&format=json`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return null;
    
    const searchData = await searchRes.json();
    const results = searchData.query?.search;
    if (!results || results.length === 0) return null;

    // Use first result
    const bestPageTitle = results[0].title;

    // Query Page Summary API
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bestPageTitle.replace(/ /g, '_'))}`;
    const summaryRes = await fetch(summaryUrl);
    if (!summaryRes.ok) return null;

    const summary = await summaryRes.json();
    
    let director = 'Unknown';
    let year = releaseYear || 2024;
    let genre = 'Cinema';
    const desc = summary.description || '';
    
    const directorMatch = desc.match(/(?:directed by|film by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
    if (directorMatch) {
      director = directorMatch[1];
    }
    
    const yearMatch = desc.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearMatch) {
      year = parseInt(yearMatch[1], 10);
    }

    if (desc.toLowerCase().includes('science fiction') || desc.toLowerCase().includes('sci-fi')) {
      genre = 'Sci-Fi';
    } else if (desc.toLowerCase().includes('drama')) {
      genre = 'Drama';
    } else if (desc.toLowerCase().includes('thriller')) {
      genre = 'Thriller';
    } else if (desc.toLowerCase().includes('comedy')) {
      genre = 'Comedy';
    } else if (desc.toLowerCase().includes('documentary')) {
      genre = 'Documentary';
    } else if (desc.toLowerCase().includes('action')) {
      genre = 'Action';
    } else if (desc.toLowerCase().includes('horror')) {
      genre = 'Horror';
    } else if (desc.toLowerCase().includes('animation') || desc.toLowerCase().includes('animated')) {
      genre = 'Animation';
    }

    return {
      title: summary.title || movieTitle,
      year: year,
      description: summary.extract || desc || '',
      director: director,
      genre: genre,
      posterUrl: summary.originalimage?.source || '',
      wikipediaTitle: bestPageTitle,
    };
  } catch (err) {
    console.warn('[Movie API] Client Wikipedia metadata fetch failed:', err);
    return null;
  }
}

/**
 * Resolves full movie metadata client-side completely keylessly.
 */
async function resolveMovieMetadataKeyless(query: string): Promise<MovieDetails | null> {
  try {
    const isUrl = query.toLowerCase().includes('letterboxd.com/film/') || 
                  query.toLowerCase().includes('imdb.com/title/') || 
                  query.toLowerCase().includes('imdb.com/title/tt') ||
                  /\b(tt\d{7,10})\b/i.test(query) ||
                  /^(https?:\/\/)?(www\.)?imdb\.com/i.test(query) ||
                  /^(https?:\/\/)?(www\.)?letterboxd\.com/i.test(query);

    let title = query;
    let year = undefined;
    let posterUrl = '';
    let description = '';
    let letterboxdSlug = '';

    if (isUrl) {
      const urlMeta = await fetchClientUrlMetadata(query);
      if (urlMeta) {
        title = urlMeta.title;
        year = urlMeta.year;
        posterUrl = urlMeta.posterUrl || '';
        description = urlMeta.description || '';
        letterboxdSlug = urlMeta.letterboxdSlug || '';
      } else {
        const rawImdbIdMatch = query.match(/\b(tt\d{7,10})\b/i);
        if (rawImdbIdMatch) {
          title = rawImdbIdMatch[1];
        } else {
          let cleanTitle = query.replace(/^https?:\/\/(www\.)?/, '')
                                .replace(/(imdb|letterboxd)\.com\/(title|film)\//i, '')
                                .split('?')[0]
                                .replace(/\/$/, '')
                                .replace(/[\-_]/g, ' ');
          title = cleanTitle;
        }
      }
    }

    // Enhance using Wikipedia
    const wikiMeta = await fetchWikipediaMetadata(title, year);
    
    if (wikiMeta) {
      return {
        title: wikiMeta.title,
        year: wikiMeta.year || year || 2024,
        description: wikiMeta.description || description || 'Pristine cinematic experience.',
        director: wikiMeta.director || 'Unknown',
        duration: '120 min',
        genre: wikiMeta.genre || 'Drama/Sci-Fi',
        letterboxdSlug: letterboxdSlug || title.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        wikipediaTitle: wikiMeta.wikipediaTitle || '',
        posterUrl: wikiMeta.posterUrl || posterUrl || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=400',
        backdropUrl: wikiMeta.posterUrl || posterUrl || '',
        language: 'English (with Subs)',
        trailerUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(wikiMeta.title + " trailer")}`
      };
    }

    if (title && isUrl) {
      return {
        title: title,
        year: year || 2024,
        description: description || 'Pristine cinematic experience.',
        director: 'Unknown',
        duration: '120 min',
        genre: 'Cinema',
        letterboxdSlug: letterboxdSlug || title.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        wikipediaTitle: '',
        posterUrl: posterUrl || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=400',
        backdropUrl: posterUrl || '',
        language: 'English (with Subs)',
        trailerUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(title + " trailer")}`
      };
    }
    return null;
  } catch (err) {
    console.warn('[Movie API] resolveMovieMetadataKeyless failed:', err);
    return null;
  }
}

/**
 * Searches Wikipedia keylessly to return suggested autocomplete results.
 */
async function searchWikipediaKeyless(query: string): Promise<SearchMovieResult[]> {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?origin=*&action=query&list=search&srsearch=${encodeURIComponent(query + " film")}&format=json`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return [];

    const searchData = await searchRes.json();
    const results = searchData.query?.search;
    if (!results || results.length === 0) return [];

    const promises = results.slice(0, 4).map(async (item: any) => {
      try {
        const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(item.title.replace(/ /g, '_'))}`;
        const summaryRes = await fetch(summaryUrl);
        if (!summaryRes.ok) return null;
        const summary = await summaryRes.json();

        let director = 'Unknown';
        let year = 2024;
        let genre = 'Cinema';
        const desc = summary.description || '';

        const directorMatch = desc.match(/(?:directed by|film by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
        if (directorMatch) director = directorMatch[1];

        const yearMatch = desc.match(/\b(19\d{2}|20\d{2})\b/);
        if (yearMatch) year = parseInt(yearMatch[1], 10);

        return {
          title: summary.title || item.title,
          year: year,
          description: summary.extract || desc || '',
          director: director,
          duration: '120 min',
          genre: genre,
          letterboxdSlug: (summary.title || item.title).toLowerCase().replace(/[^a-z0-9]/g, '-'),
          wikipediaTitle: item.title,
          posterUrl: summary.originalimage?.source || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=200',
          backdropUrl: summary.originalimage?.source || ''
        };
      } catch (err) {
        return null;
      }
    });

    const resolved = await Promise.all(promises);
    return resolved.filter((r): r is SearchMovieResult => r !== null);
  } catch (err) {
    console.warn('[Movie API] Client searchWikipediaKeyless failed:', err);
    return [];
  }
}

/**
 * High-performance movie details metadata retriever.
 * Fully compatible with both full-stack setups AND GitHub Pages static hosting.
 */
export async function getMovieDetails(movieQuery: string): Promise<MovieDetails> {
  const cleanQuery = movieQuery.trim();
  
  // 1. Try to fetch from Express backend API endpoint
  try {
    const res = await fetch('/api/movie-details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movieQuery: cleanQuery }),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.log('[Movie API] Backend /api/movie-details inaccessible. Falling back to keyless client resolver.', err);
  }

  // 2. Client-side backend fallback: Try Keyless Resolver first (so GitHub pages works instantly without a key)
  try {
    const keylessData = await resolveMovieMetadataKeyless(cleanQuery);
    if (keylessData) {
      return keylessData;
    }
  } catch (keylessErr) {
    console.log('[Movie API] Keyless client-side resolver failed. Falling back to local/Gemini API key verification.', keylessErr);
  }

  // 3. Fallback to client-side Gemini-3.5 engine if key is configured locally
  const apiKey = getLocalGeminiKey();
  if (!apiKey) {
    throw new Error(
      'GitHub Pages Note: Automatic AI cinemarque search requires a Gemini API Key when hosted statically. Please configure it in the Administration settings modal!'
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Create prompt
    const prompt = `Find complete, highly accurate and precise cinematic metadata details for the movie query/reference: "${cleanQuery}". 
    Find the exact official release year, director name, runtime duration (e.g. '130 min' or '1h 55m'), genre list, a complete synoptic description, its exact Letterboxd slug (e.g., 'tumbbad', 'perfect-days'), and its exact Wikipedia page title (e.g., 'Tumbbad (film)'). Also find a beautiful widescreen photographic landscape backdrop URL, a premium quality poster (ideally TMDB/Wikipedia), its primary spoken language with English subtitles (e.g. 'Japanese (with English Subs)'), and its official YouTube trailer link.`;

    const systemInstruction = "You are a professional cinema curator for the IISER Kolkata Movie Club. Search movie archives and retrieve precise metadata. Return the synopsis/description concisely (approx 100-150 words). Format the genre as a comma-separated list. If backdrop or poster urls cannot be found, populate placeholders or tmdb URLs. For trailerUrl, always provide a real embedding YouTube link like 'https://www.youtube.com/watch?v=...' or if not found, a YouTube search query link like 'https://www.youtube.com/results?search_query=...'";

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Standard official title of the movie." },
            year: { type: Type.INTEGER, description: "Correct release calendar year." },
            description: { type: Type.STRING, description: "Compelling cinematic synopsis of the movie (under 150 words)." },
            director: { type: Type.STRING, description: "Director of the film." },
            duration: { type: Type.STRING, description: "Runtime format, e.g. '130 min' or '1h 55m'." },
            genre: { type: Type.STRING, description: "Primary genre(s) formatted as a comma-separated list, e.g. 'Drama, Thriller, Sci-Fi'." },
            letterboxdSlug: { type: Type.STRING, description: "The lowercase official Letterboxd URL slug, e.g. 'tumbbad', 'perfect-days'." },
            wikipediaTitle: { type: Type.STRING, description: "The exact Wikipedia title suitable for URL encoding, e.g. 'Tumbbad (film)'." },
            posterUrl: { type: Type.STRING, description: "A high-quality movie poster URL. Prefer TMDB poster URL if found." },
            backdropUrl: { type: Type.STRING, description: "Widescreen background image/snapshot of the movie." },
            language: { type: Type.STRING, description: "Spoken language name optionally including English subtitles status." },
            trailerUrl: { type: Type.STRING, description: "The official YouTube trailer link for the movie." }
          },
          required: ["title", "year", "description", "director", "duration", "genre", "letterboxdSlug", "wikipediaTitle", "posterUrl", "backdropUrl", "language", "trailerUrl"]
        }
      }
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("No response string returned from client-side Gemini engine.");
    }

    const movieData = JSON.parse(textOutput.trim()) as MovieDetails;

    // Wikipedia page summary REST API lookup for premium poster art (direct client-side)
    if (movieData.wikipediaTitle) {
      try {
        const titleSlug = movieData.wikipediaTitle.trim().replace(/ /g, '_');
        const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titleSlug)}`;
        const wikiRes = await fetch(wikiUrl);
        if (wikiRes.ok) {
          const wikiJson = await wikiRes.json();
          if (wikiJson.originalimage && wikiJson.originalimage.source) {
            movieData.posterUrl = wikiJson.originalimage.source;
          }
        }
      } catch (wikiErr) {
        console.warn('[Movie API] Client-side Wikipedia enhancement failed:', wikiErr);
      }
    }

    return movieData;
  } catch (error: any) {
    console.error('[Movie API] Client-side Gemini content generation error:', error);
    throw new Error(error.message || 'Failed to generate movie details via client-side AI.');
  }
}

/**
 * Searches and autocompletes matching movie suggestions.
 */
export async function searchMovies(query: string): Promise<SearchMovieResult[]> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) return [];

  // 1. Try backend
  try {
    const res = await fetch('/api/search-movies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: cleanQuery }),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.log('[Movie API] Backend /api/search-movies inaccessible. Falling back to client-side search.', err);
  }

  // 2. Fall back to client-side
  const apiKey = getLocalGeminiKey();
  if (!apiKey) {
    try {
      return await searchWikipediaKeyless(cleanQuery);
    } catch (wikiErr) {
      console.log('[Movie API] Keyless client-side search autocomplete failed:', wikiErr);
      return [];
    }
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `Find up to 4 classic or modern movies matching the keyword search: "${cleanQuery}". For each movie, find its title, year, director, runtime (e.g. '120 min'), genre(s) comma-separated, a short 1-sentence description, a Letterboxd slug (e.g. 'inception'), a Wikipedia title, and a high-quality poster (prefer TMDB URLs or high-quality posters).`;
    const systemInstruction = "You are a professional cinema curator. Provide search suggestions for matches with precise title, year, director, runtime duration, comma-separated genres, and standard web poster artwork URLs.";

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              year: { type: Type.INTEGER },
              description: { type: Type.STRING, description: "Concise 1-sentence synopsis." },
              director: { type: Type.STRING },
              duration: { type: Type.STRING, description: "e.g. '120 min'" },
              genre: { type: Type.STRING, description: "e.g. 'Drama, Thriller'" },
              letterboxdSlug: { type: Type.STRING },
              wikipediaTitle: { type: Type.STRING },
              posterUrl: { type: Type.STRING },
              backdropUrl: { type: Type.STRING }
            },
            required: ["title", "year", "description", "director", "duration", "genre", "letterboxdSlug", "wikipediaTitle", "posterUrl", "backdropUrl"]
          }
        }
      }
    });

    const textOutput = response.text;
    if (!textOutput) return [];
    
    return JSON.parse(textOutput.trim()) as SearchMovieResult[];
  } catch (error) {
    console.error('[Movie API] Client-side search autocomplete failed:', error);
    return [];
  }
}

/**
 * Fetches and parses the Letterboxd RSS Diary feed.
 * On GitHub Pages, it utilizes "AllOrigins" CORS proxy to bypass cross-domain security,
 * and passes the raw XML snippet to Gemini for pristine parsing.
 */
export async function syncLetterboxdRSS(username: string): Promise<LetterboxdWatchEntry[]> {
  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername) return [];

  // 1. Try backend endpoint
  try {
    const res = await fetch('/api/letterboxd-rss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cleanUsername }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.movies) {
        return data.movies;
      }
    }
  } catch (err) {
    console.log('[Movie API] Backend /api/letterboxd-rss unreachable. Attempting CORS proxy proxying to Letterboxd feed...', err);
  }

  // 2. Fall back to Client-side fetch with CORS proxy
  const apiKey = getLocalGeminiKey();
  if (!apiKey) {
    throw new Error('On GitHub Pages, fetching public RSS feeds requires configuring a Gemini API Key to enable client-side AI parsing.');
  }

  try {
    // Standard RSS feed on Letterboxd
    const feedUrl = `https://letterboxd.com/${encodeURIComponent(cleanUsername)}/rss/`;
    // Use AllOrigins (a highly reputable free, anonymous CORS proxy)
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(feedUrl)}`;
    
    const res = await fetch(proxyUrl);
    if (!res.ok) {
      throw new Error(`Public RSS feed not accessible via proxy. Please check if Letterboxd username "${cleanUsername}" is valid.`);
    }

    const json = await res.json();
    const xmlText = json.contents;

    if (!xmlText || !xmlText.includes("<item>")) {
      throw new Error("No diary entries were found or parsed from the Letterboxd profile.");
    }

    // Truncate to save token limit
    const maxCharacterLimit = 25000;
    let truncatedXml = xmlText;
    if (truncatedXml.length > maxCharacterLimit) {
      const lastItemIdx = truncatedXml.lastIndexOf("</item>", maxCharacterLimit);
      if (lastItemIdx !== -1) {
        truncatedXml = truncatedXml.substring(0, lastItemIdx + 7) + "\n</channel>\n</rss>";
      } else {
        truncatedXml = truncatedXml.substring(0, maxCharacterLimit) + "\n</channel>\n</rss>";
      }
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Parse the following raw Letterboxd RSS XML Feed into a high-quality, structured JSON array of watched movies. 
      Each object MUST represent a watched movie and have the following properties:
      - title: The official name/title of the movie.
      - year: The original release year of the movie (as an integer).
      - letterboxdUrl: The direct URL to the movie on Letterboxd.
      - screenedDate: The date the movie was watched, formatted as YYYY-MM-DD. Use <letterboxd:watchedDate> if present, or format <pubDate>.
      - rating: Member rating mapped to a number out of 5 (e.g. 4.5, 3.0). Parse from <letterboxd:memberRating> or stars of the form '★★★★½' in title/description. If no rating is present, default to 4.0.
      - synopsis: A brief description/synopsis of the movie or a clean summary of the user review.
      - director: If you know or can search/infer the director(s) for this movie, provide it; otherwise guess or leave empty.
      - genre: A list of genres (e.g., ["Drama", "Sci-Fi"]).
      - posterUrl: A beautiful high quality poster URL (you can search or construct a tmdb or wikipedia or unsplash poster URL if not provided directly in feed).

      XML Feed Content snippet:
      ${truncatedXml}`,
      config: {
        systemInstruction: "You are a professional cinema data extraction utility. Extract and return ONLY a valid structured JSON list of movies. Do not include markdown code ticks.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              year: { type: Type.INTEGER },
              letterboxdUrl: { type: Type.STRING },
              screenedDate: { type: Type.STRING },
              rating: { type: Type.NUMBER },
              synopsis: { type: Type.STRING },
              director: { type: Type.STRING },
              genre: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              posterUrl: { type: Type.STRING }
            },
            required: ["title", "year", "letterboxdUrl", "screenedDate", "rating", "synopsis", "director", "genre", "posterUrl"]
          }
        }
      }
    });

    const parsedText = response.text;
    if (!parsedText) {
      throw new Error("Failed to extract RSS feed data correctly.");
    }

    return JSON.parse(parsedText.trim()) as LetterboxdWatchEntry[];
  } catch (err: any) {
    console.error('[Movie API] Letterboxd RSS parsing failed:', err);
    throw new Error(err.message || 'Error occurred while syncing Letterboxd feed client-side.');
  }
}
