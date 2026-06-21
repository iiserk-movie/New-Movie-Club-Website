import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Gemini client using official @google/genai SDK guidelines
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

// Helper to request metadata directly from IMDb or Letterboxd pages
async function fetchUrlMetadata(url: string) {
  try {
    let cleanUrl = url.trim();

    // Check for raw IMDb IDs (like tt1234567) or links
    const rawImdbIdMatch = cleanUrl.match(/\b(tt\d{7,10})\b/i);
    const hasImdbDomain = /imdb\.com/i.test(cleanUrl);

    let isImdb = false;
    let isLetterboxd = false;

    if (rawImdbIdMatch && !hasImdbDomain) {
      // User entered a raw IMDb ID! Turn it into a full URL.
      cleanUrl = `https://www.imdb.com/title/${rawImdbIdMatch[1]}/`;
      isImdb = true;
    } else {
      isImdb = /imdb\.com\/title\/(tt\d+)/i.test(cleanUrl);
      isLetterboxd = /letterboxd\.com\/film\/([a-zA-Z0-9\-_]+)/i.test(cleanUrl);
    }

    if (!isImdb && !isLetterboxd) {
      console.log(`[Metadata Scraper] URL does not match IMDb or Letterboxd signatures: ${cleanUrl}`);
      return null;
    }

    let targetUrl = cleanUrl;
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }

    console.log(`[Metadata Scraper] Pre-fetching URL: ${targetUrl}`);
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    if (!response.ok) {
      console.warn(`[Metadata Scraper] Fetch failed, HTTP status: ${response.status}`);
      return null;
    }

    const html = await response.text();
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

    // Decode HTML entities if any
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
      // IMDb OG title format is often "Title (Year) - IMDb" or "Title (Year) - Rating - IMDb"
      title = title.replace(/\s*-\s*IMDb$/i, '');
      const yearMatch = title.match(/\((\d{4})\)/);
      const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
      title = title.replace(/\s*\(\d{4}\)/, '').trim();

      // Clean the generic IMDb description prefix
      description = description.replace(/^Directed by [^.]+\.\s*With [^.]+\.\s*/i, '');
      description = description.replace(/^[^:]+:\s*/, ''); // strip "Title (Year):" prefix if present
      
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
    console.warn('[Metadata Scraper] Failed to fetch URL metadata:', err);
    return null;
  }
}

  // API Endpoint to fetch movie details utilizing Gemini Content Generation and live scrapers
  app.post("/api/movie-details", async (req, res) => {
    const { movieQuery } = req.body;
    if (!movieQuery) {
      return res.status(400).json({ error: "movieQuery is required" });
    }

    console.log(`[Server] Resolving movie details for query/link: "${movieQuery}"`);

    try {
      const cleanQuery = movieQuery.trim();
      let scrapedMetadata = null;
      
      // Attempt pre-scraping for direct URL metadata if the input is a valid URL
      if (cleanQuery.includes("http") || cleanQuery.includes("imdb.com") || cleanQuery.includes("letterboxd.com") || /\b(tt\d+)\b/i.test(cleanQuery)) {
        scrapedMetadata = await fetchUrlMetadata(cleanQuery);
      }

      // Format clean query prompt for Gemini Search Grounding
      let geminiQueryPrompt = cleanQuery;
      let focalIdInstructions = "";

      if (scrapedMetadata) {
        console.log(`[Server] Scraper successfully resolved: "${scrapedMetadata.title}" (${scrapedMetadata.year})`);
        geminiQueryPrompt = `Film Title: "${scrapedMetadata.title}" released in ${scrapedMetadata.year || 'unknown'}. Synopsis Context: "${scrapedMetadata.description}"`;
        focalIdInstructions = `We have pre-matched the movie details as: Title: "${scrapedMetadata.title}", Year: ${scrapedMetadata.year || 'unknown'}. Perfect the details using Google search.`;
      } else {
        const imdbMatch = cleanQuery.match(/(tt\d+)/i);
        const lbMatch = cleanQuery.match(/letterboxd\.com\/film\/([a-zA-Z0-9\-_]+)/i);
        
        if (imdbMatch) {
          focalIdInstructions = `The user specified IMDb ID: "${imdbMatch[1]}". Search Google for "IMDb ${imdbMatch[1]}" to resolve the exact film metadata.`;
          geminiQueryPrompt = `IMDb ID ${imdbMatch[1]}`;
        } else if (lbMatch) {
          focalIdInstructions = `The user specified Letterboxd slug: "${lbMatch[1]}". Search Google for "Letterboxd film ${lbMatch[1]}" to resolve the exact film metadata.`;
          geminiQueryPrompt = `Letterboxd film ${lbMatch[1]}`;
        } else if (cleanQuery.includes("http") || cleanQuery.includes("imdb.com") || cleanQuery.includes("letterboxd.com")) {
          focalIdInstructions = `The user specified direct web link: "${cleanQuery}". Search Google for pages linking or containing this reference and extract complete metadata.`;
          geminiQueryPrompt = `Movie link: "${cleanQuery}"`;
        }
      }

      // Fetch rich metadata using Structured JSON Schema and Google Search Grounding to find actual references
      let gResponse;
      try {
        gResponse = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `Find complete, highly accurate and precise cinematic metadata details for the movie query/reference: "${geminiQueryPrompt}". 
          ${focalIdInstructions}
          Find the exact official release year, director name, runtime duration (e.g. '130 min' or '1h 55m'), genre list, a complete synoptic description, its exact Letterboxd slug (e.g., 'tumbbad', 'perfect-days'), and its exact Wikipedia page title (e.g., 'Tumbbad (film)'). Also find a beautiful widescreen photographic landscape backdrop URL, a premium quality poster (ideally TMDB/Wikipedia), its primary spoken language with English subtitles (e.g. 'Japanese (with English Subs)'), and its official YouTube trailer link.`,
          config: {
            systemInstruction: "You are a professional cinema curator for the IISER Kolkata Movie Club. Search movie archives and retrieve precise metadata. Return the synopsis/description concisely (approx 100-150 words). Format the genre as a comma-separated list. If backdrop or poster urls cannot be found, populate placeholders or tmdb URLs. For trailerUrl, always provide a real embedding YouTube link like 'https://www.youtube.com/watch?v=...' or if not found, a YouTube search query link like 'https://www.youtube.com/results?search_query=...'",
            tools: [{ googleSearch: {} }],
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
                language: { type: Type.STRING, description: "Spoken language name optionally including English subtitles status (e.g., 'Hindi (with English Subs)', 'Spanish (with English Subs)', etc.)." },
                trailerUrl: { type: Type.STRING, description: "The official YouTube trailer link for the movie, e.g., 'https://www.youtube.com/watch?v=...' or YouTube trailer search link." }
              },
              required: ["title", "year", "description", "director", "duration", "genre", "letterboxdSlug", "wikipediaTitle", "posterUrl", "backdropUrl", "language", "trailerUrl"]
            }
          }
        });
      } catch (searchError) {
        console.warn("[Server] Gemini content generation with search grounding failed. Retrying without search grounding...", searchError);
        gResponse = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `Find complete, highly accurate and precise cinematic metadata details for the movie query/reference: "${geminiQueryPrompt}". 
          ${focalIdInstructions}
          Find the exact official release year, director name, runtime duration (e.g. '130 min' or '1h 55m'), genre list, a complete synoptic description, its exact Letterboxd slug (e.g., 'tumbbad', 'perfect-days'), and its exact Wikipedia page title (e.g., 'Tumbbad (film)'). Also find a beautiful widescreen photographic landscape backdrop URL, a premium quality poster (ideally TMDB/Wikipedia), its primary spoken language with English subtitles (e.g. 'Japanese (with English Subs)'), and its official YouTube trailer link.`,
          config: {
            systemInstruction: "You are a professional cinema curator for the IISER Kolkata Movie Club. Search movie archives and retrieve precise metadata. Return the synopsis/description concisely (approx 100-150 words). Format the genre as a comma-separated list. If backdrop or poster urls cannot be found, populate placeholders or tmdb URLs. For trailerUrl, provide the official trailer YouTube URL or a search query link if not found.",
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
                language: { type: Type.STRING, description: "Spoken language name optionally including English subtitles status (e.g., 'English (with Subs)', etc.)." },
                trailerUrl: { type: Type.STRING, description: "The official YouTube trailer link for the movie, e.g., 'https://www.youtube.com/watch?v=...'." }
              },
              required: ["title", "year", "description", "director", "duration", "genre", "letterboxdSlug", "wikipediaTitle", "posterUrl", "backdropUrl", "language", "trailerUrl"]
            }
          }
        });
      }

      const textOutput = gResponse.text;
      if (!textOutput) {
        throw new Error("No data returned from Gemini content generator.");
      }

      const movieData = JSON.parse(textOutput.trim());
      
      // Override empty or missing poster/backdrop with pre-scraped ones if found
      if (scrapedMetadata && scrapedMetadata.posterUrl && (!movieData.posterUrl || movieData.posterUrl.includes("placeholder"))) {
        movieData.posterUrl = scrapedMetadata.posterUrl;
      }

      // Multi-layer actual movie poster retriever compiled server-side
      let realPosterUrl: string | null = null;

      // 1. Scraping official Letterboxd Open Graph tags if possible
      if (movieData.letterboxdSlug) {
        try {
          const cleanSlug = movieData.letterboxdSlug.toLowerCase().trim().replace(/[^a-z0-9\-]/g, '');
          const lbUrl = `https://letterboxd.com/film/${cleanSlug}/`;
          console.log(`[Server Scraper] Fetching Letterboxd metadata for: ${lbUrl}`);
          
          const lbRes = await fetch(lbUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
            }
          });

          if (lbRes.ok) {
            const html = await lbRes.text();
            const match = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) 
                       || html.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"/i);
            if (match && match[1] && !match[1].includes("letterboxd-share-logo")) {
              realPosterUrl = match[1];
              console.log(`[Server Scraper] Successfully retrieved Letterboxd poster: ${realPosterUrl}`);
            }
          }
        } catch (err) {
          console.warn("[Server Scraper] Letterboxd scraping failed:", err);
        }
      }

      // 2. Fetching Wikipedia Page Summary REST API as a premium fallback
      if (!realPosterUrl && (movieData.wikipediaTitle || movieData.title)) {
        try {
          const searchTitle = (movieData.wikipediaTitle || movieData.title).trim().replace(/ /g, '_');
          const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchTitle)}`;
          console.log(`[Server Scraper] Requesting Wikipedia original image for: ${wikiUrl}`);
          
          const wikiRes = await fetch(wikiUrl, {
            headers: {
              'User-Agent': 'IISERKolkataMovieClub/1.0 (movie.activity@iiserkol.ac.in) Node-Fetch'
            }
          });

          if (wikiRes.ok) {
            const wikiData = await wikiRes.json() as any;
            if (wikiData.originalimage && wikiData.originalimage.source) {
              realPosterUrl = wikiData.originalimage.source;
              console.log(`[Server Scraper] Successfully retrieved Wikipedia original image: ${realPosterUrl}`);
            }
          }
        } catch (err) {
          console.warn("[Server Scraper] Wikipedia fetch failed:", err);
        }
      }

      // Populate scraped actual poster or keep the AI search fallback
      if (realPosterUrl) {
        movieData.posterUrl = realPosterUrl;
      }

      console.log(`[Server] Successfully resolved details for: "${movieData.title}" (${movieData.year})`);
      res.json(movieData);
    } catch (e: any) {
      console.error("Gemini Movie Details Fetch Failure:", e);
      res.status(500).json({ error: e.message || "Failed to retrieve cinema metadata." });
    }
  });

  // API Endpoint to search movies and provide real-time suggestions using Gemini or Web Search Grounding
  app.post("/api/search-movies", async (req, res) => {
    const { query } = req.body;
    if (!query || query.trim().length < 2) {
      return res.json([]);
    }

    console.log(`[Server Autocomplete] Searching for partial query: "${query}"`);

    try {
      const isUrl = query.toLowerCase().includes("imdb.com/") || query.toLowerCase().includes("letterboxd.com/");
      
      let gResponse;
      try {
        gResponse = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `Search Google for movies matching: "${query}". Return a structured list of up to 4 most matching movies. If the query is an IMDb link or Letterboxd film link, resolve details for that single exact movie. For each movie, find its title, year, director, runtime (e.g. '120 min'), genre(s) comma-separated, a short 1-sentence description, a Letterboxd slug (e.g. 'inception'), a Wikipedia title, and a high-quality poster (prefer TMDB URLs or high-quality posters from search).`,
          config: {
            systemInstruction: "You are a professional cinema curator. Provide search suggestions for matches with precise title, year, director, runtime duration, comma-separated genres, and standard web poster artwork URLs.",
            tools: [{ googleSearch: {} }],
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
      } catch (searchError) {
        console.warn("[Server Autocomplete] Autocomplete search grounding failed, retrying without grounding...", searchError);
        gResponse = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `Find up to 4 classic or modern movies matching the keyword search: "${query}". For each movie, find its title, year, director, runtime (e.g. '120 min'), genre(s) comma-separated, a short 1-sentence description, a Letterboxd slug (e.g. 'inception'), a Wikipedia title, and a high-quality poster (prefer TMDB URLs or high-quality posters).`,
          config: {
            systemInstruction: "You are a professional cinema curator. Provide search suggestions for matches with precise title, year, director, runtime duration, comma-separated genres, and standard web poster artwork URLs.",
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
      }

      const textOutput = gResponse.text;
      if (!textOutput) {
        return res.json([]);
      }

      const moviesList = JSON.parse(textOutput.trim());
      res.json(moviesList);
    } catch (e: any) {
      console.error("Gemini Movie Suggestion Failure:", e);
      res.status(500).json({ error: e.message || "Failed to retrieve suggestion results." });
    }
  });

  // API Endpoint to fetch and parse the public Letterboxd RSS Feed for Admin Diary updates
  app.post("/api/letterboxd-rss", async (req, res) => {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: "username is required" });
    }

    console.log(`[Server] Syncing Letterboxd diary RSS for user: "${username}"`);

    try {
      const feedUrl = `https://letterboxd.com/${encodeURIComponent(username.trim().toLowerCase())}/rss/`;
      const response = await fetch(feedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
          'Accept': 'application/xml, text/xml, */*'
        }
      });

      if (!response.ok) {
        throw new Error(`Letterboxd profile feed not accessible (HTTP ${response.status}). Ensure the username is correct and public on Letterboxd.`);
      }

      const xmlText = await response.text();
      if (!xmlText || !xmlText.includes("<item>")) {
        throw new Error("No recent diary entries found in Letterboxd RSS feed.");
      }

      // Limit XML length to fit safely in model token window while capturing up to 12 recent entries
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

      // Prompt Gemini to parse the RSS XML into structured JSON
      const gResponse = await ai.models.generateContent({
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
          systemInstruction: "You are a professional cinema data extraction utility. Extract and return ONLY a valid structured JSON list of movies. Do not include markdown code ticks other than standard JSON format.",
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

      const parsedText = gResponse.text;
      if (!parsedText) {
        throw new Error("Failed to parse RSS feed movie details.");
      }

      const moviesList = JSON.parse(parsedText.trim());
      res.json({ success: true, username, movies: moviesList });
    } catch (err: any) {
      console.error("[ServerError] Letterboxd RSS sync failed:", err);
      res.status(500).json({ error: err.message || "Failed to parse current Letterboxd RSS feed." });
    }
  });

  // Serve static assets and bind Vite's development middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    
    // Support both root paths and the predefined '/MovieClub-website/' asset base paths
    app.use("/MovieClub-website", express.static(distPath));
    app.use(express.static(distPath));

    app.all("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`IISER Kolkata Movie Club full-stack server running on standard port:${PORT}`);
  });
}

startServer();
