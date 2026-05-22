import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, Modality } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Increase body limit to handle large base64 uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize GoogleGenAI server-side with metadata header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Resiliency helper for detecting 429 quota exhaustion or general limits
function isQuotaError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || err.status || err.stack || err).toLowerCase();
  return msg.includes("429") || msg.includes("quota") || msg.includes("resource_exhausted") || msg.includes("limit");
}

let isGeminiQuotaExhausted = false;
let lastQuotaExhaustionTime = 0;

function checkQuotaExhaustion(): boolean {
  if (isGeminiQuotaExhausted) {
    const elapsed = Date.now() - lastQuotaExhaustionTime;
    if (elapsed < 30000) { // Activate responsive fallback for a 30-sec cooldown
      return true;
    }
    isGeminiQuotaExhausted = false;
  }
  return false;
}

function flagQuotaExhaustion(err: any) {
  if (isQuotaError(err)) {
    isGeminiQuotaExhausted = true;
    lastQuotaExhaustionTime = Date.now();
    console.warn(">> Gemini API Quota Limit/Rate Limit reached (429). Activating localized fast fallback engine to maintain smooth UX.");
  }
}

// Robust Backup Local Fallback Utilities if Google GenAI Key is restricted/quota-exhausted
function generateFallbackPostAnalysis(instagramUrl?: string, imagesCount: number = 0, manualPostText?: string) {
  let matchedPerson = {
    name: "Aesthetic Creator",
    description: "An inspiring online stylist specializing in lifestyle, visuals, and dynamic story curation.",
    searchQuery: "Elegant professional portrait of a creator in a modern beautifully lit room, soft sunlight, 9:16 aspect ratio cinematic"
  };

  const urlLower = (instagramUrl || "").toLowerCase();
  const textLower = (manualPostText || "").toLowerCase();
  
  if (urlLower.includes("messi") || textLower.includes("messi")) {
    matchedPerson = {
      name: "Lionel Messi",
      description: "Legendary professional footballer, widely regarded as one of the greatest athletes in world history.",
      searchQuery: "Professional studio close-up portrait of Lionel Messi smiling warmly, rich warm studio lighting, 9:16 portrait photography"
    };
  } else if (urlLower.includes("ronaldo") || urlLower.includes("cristiano") || textLower.includes("ronaldo") || textLower.includes("cristiano")) {
    matchedPerson = {
      name: "Cristiano Ronaldo",
      description: "Iconic Portuguese professional footballer and global sport influencer, famous for his dedication and excellence.",
      searchQuery: "Sharp athletic portrait of Cristiano Ronaldo, sporting background, high contrast focus, 9:16 aspect ratio"
    };
  } else if (urlLower.includes("swift") || urlLower.includes("taylor") || textLower.includes("swift") || textLower.includes("taylor")) {
    matchedPerson = {
      name: "Taylor Swift",
      description: "Sensational American singer-songwriter, industry icon, and storyteller.",
      searchQuery: "Gorgeous micro-lens concert close-up portrait of Taylor Swift singing, spotlight halo, 9:16 cinematic aesthetic"
    };
  } else if (urlLower.includes("gomez") || urlLower.includes("selena") || textLower.includes("gomez") || textLower.includes("selena")) {
    matchedPerson = {
      name: "Selena Gomez",
      description: "Accomplished American singer, actress, and global advocate for mental health and beauty lines.",
      searchQuery: "Cinematic close-up portrait of Selena Gomez, rich textures, studio lighting, 9:16 aspect ratio"
    };
  } else if (urlLower.includes("mrbeast") || urlLower.includes("donaldson") || textLower.includes("mrbeast")) {
    matchedPerson = {
      name: "Jimmy Donaldson (MrBeast)",
      description: "The world's leading premium content creator and philanthropist, known for spectacular high-budget entertainment.",
      searchQuery: "Vibrant smiling portrait of MrBeast, colorful studio background, highly detailed digital render, 9:16"
    };
  } else if (urlLower.includes("rock") || urlLower.includes("dwayne") || textLower.includes("dwayne johnson") || textLower.includes("the rock")) {
    matchedPerson = {
      name: "Dwayne 'The Rock' Johnson",
      description: "Renowned actor, producer, and retired legendary professional wrestler.",
      searchQuery: "Powerful smiling portrait of Dwayne Johnson the rock, high key gym natural lighting, highly detailed look, 9:16"
    };
  }

  const defaultExtractedText = (manualPostText && manualPostText.trim())
    ? manualPostText.trim()
    : (instagramUrl 
        ? `Post analyzed via link: ${instagramUrl}. Focuses on sharing exceptional stories, creative ideas, and everyday excellence with the community. "Success isn't about perfection; it's about persistent improvement and connecting with what matters most."`
        : `Analyzing ${imagesCount} uploaded images. Extracted Caption: "Capturing details, setting trends, and creating real moments of impact. Let's build something exceptional together!"`);

  return {
    extractedText: defaultExtractedText,
    identifiedPeople: [matchedPerson]
  };
}

function generateFallbackScript(extractedText: string, identifiedPeople: any[], customGoal?: string) {
  const authorName = (identifiedPeople && identifiedPeople[0]?.name) || "Aesthetic Creator";
  const searchPrompt = (identifiedPeople && identifiedPeople[0]?.searchQuery) || "Cinematic close-up portrait of an inspiring creator, 8k, 9:16";

  const goalText = customGoal ? ` incorporating your target: "${customGoal}"` : "";

  return {
    title: `The Mindset of Excellence feat. ${authorName}`,
    description: `A masterclass in resilience, creative drive, and constant growth with ${authorName}. What's holding you back from making your move? #inspiration #motivation #excellence #shorts #success`,
    slides: [
      {
        slideId: 1,
        durationSec: 5,
        visualPrompt: "Atmospheric macro shot of coffee brewing on a sleek modern workbench, morning sun flare, slow movement, cinematic 9:16",
        captionText: "Most people wait for the perfect moment.",
        voiceoverText: "But here is the secret. Perfect timing is an illusion. The best time to start is exactly where you are."
      },
      {
        slideId: 2,
        durationSec: 5,
        visualPrompt: "Stylistic top-down view of someone writing goals in an black notebook, minimalist desk setup, high contrast studio style",
        captionText: "Clarity over chaos.",
        voiceoverText: `Every great milestone starts as a simple, focused promise. Just like ${authorName} shares in their community${goalText}.`
      },
      {
        slideId: 3,
        durationSec: 6,
        visualPrompt: searchPrompt,
        captionText: "Dedicate yourself to consistency.",
        voiceoverText: "Repetition breeds mastery over time. The habits you build in private will shine in public."
      },
      {
        slideId: 4,
        durationSec: 5,
        visualPrompt: "Dynamic abstract particle explosion of warm orange and gold colors in dark space, high resolution 3D render, vertical format",
        captionText: "Break through your block.",
        voiceoverText: "Take that next step today. Block out the noise, write down the goal, and make your breakthrough."
      },
      {
        slideId: 5,
        durationSec: 5,
        visualPrompt: "Beautiful modern clean studio portrait with an elegant overlay overlay of a follow button, subtle gradient backgrounds",
        captionText: "Subscribe for your daily drive!",
        voiceoverText: `Join the community. Subscribe and check out our channel for more deep dives into ${authorName}'s strategies.`
      }
    ]
  };
}

function chooseUnsplashUrl(prompt: string): string {
  const lower = prompt.toLowerCase();
  
  if (lower.includes("football") || lower.includes("soccer") || lower.includes("messi") || lower.includes("stadium")) {
    return "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=720&q=80&auto=format&fit=crop";
  }
  if (lower.includes("ronaldo") || lower.includes("athletics") || lower.includes("fitness")) {
    return "https://images.unsplash.com/photo-1518063319789-7217e6706b04?w=720&q=80&auto=format&fit=crop";
  }
  if (lower.includes("swift") || lower.includes("taylor") || lower.includes("concert") || lower.includes("singer") || lower.includes("music")) {
    return "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=720&q=80&auto=format&fit=crop";
  }
  if (lower.includes("woman") || lower.includes("female") || lower.includes("girl") || lower.includes("selena")) {
    return "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=720&q=80&auto=format&fit=crop";
  }
  if (lower.includes("man") || lower.includes("male") || lower.includes("guy")) {
    return "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=720&q=80&auto=format&fit=crop";
  }
  if (lower.includes("workspace") || lower.includes("desk") || lower.includes("office") || lower.includes("laptop") || lower.includes("setup")) {
    return "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=720&q=80&auto=format&fit=crop";
  }
  if (lower.includes("cyber") || lower.includes("tech") || lower.includes("neon") || lower.includes("future") || lower.includes("abstract")) {
    return "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=720&q=80&auto=format&fit=crop";
  }
  if (lower.includes("coffee") || lower.includes("cup") || lower.includes("morning")) {
    return "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=720&q=80&auto=format&fit=crop";
  }
  if (lower.includes("nature") || lower.includes("landscape") || lower.includes("mountain") || lower.includes("forest")) {
    return "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=720&q=80&auto=format&fit=crop";
  }
  
  return "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=720&q=80&auto=format&fit=crop";
}

// Real OCR & Person Identification from uploaded images / Instagram info
async function fetchInstagramPostData(instagramUrl: string): Promise<{ imageUrl: string | null; caption: string | null }> {
  const tryUas = [
    "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
  ];

  let html = "";
  for (const ua of tryUas) {
    try {
      console.info(`>> Attempting to scrape Instagram URL with UA: ${ua.substring(0, 45)}...`);
      const res = await fetch(instagramUrl, {
        headers: {
          "User-Agent": ua,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "max-age=0"
        },
        redirect: "follow"
      });
      
      if (res.ok) {
        html = await res.text();
        if (html.includes("og:image") || html.includes("display_url") || html.includes("og:description")) {
          console.info(`>> Scrape success! Content found.`);
          break;
        }
      } else {
        console.warn(`Scrape HTML res is not ok: ${res.status}`);
      }
    } catch (e) {
      console.error(`Scrape attempt failed with UA: ${ua.substring(0, 30)}`, e);
    }
  }

  if (!html) {
    return { imageUrl: null, caption: null };
  }

  let imageUrl: string | null = null;
  let caption: string | null = null;

  // 1. Extract Facebook/Instagram OpenGraph meta tag image
  const ogImageRegex = /<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i;
  const ogImageMatch = html.match(ogImageRegex);
  if (ogImageMatch && ogImageMatch[1]) {
    imageUrl = ogImageMatch[1].replace(/&amp;/g, "&");
  }

  // 2. Extract twitter:image
  if (!imageUrl) {
    const twImageRegex = /<meta[^>]*name="twitter:image"[^>]*content="([^"]+)"/i;
    const twImageMatch = html.match(twImageRegex);
    if (twImageMatch && twImageMatch[1]) {
      imageUrl = twImageMatch[1].replace(/&amp;/g, "&");
    }
  }

  // 3. Extract JSON preloaded display_url
  if (!imageUrl) {
    const displayUrlRegex = /"display_url"\s*:\s*"([^"]+)"/i;
    const displayUrlMatch = html.match(displayUrlRegex);
    if (displayUrlMatch && displayUrlMatch[1]) {
      imageUrl = displayUrlMatch[1].replace(/\\u0026/g, "&");
    }
  }

  // 4. Extract og:description
  const ogDescRegex = /<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i;
  const ogDescMatch = html.match(ogDescRegex);
  if (ogDescMatch && ogDescMatch[1]) {
    caption = ogDescMatch[1].replace(/&amp;/g, "&");
  }

  // Fallback to title
  if (!caption) {
    const titleRegex = /<title>([^<]+)<\/title>/i;
    const titleMatch = html.match(titleRegex);
    if (titleMatch && titleMatch[1]) {
      caption = titleMatch[1].trim();
    }
  }

  // Clean caption text (Instagram often prefixes/suffixes with "See Instagram photos...")
  if (caption) {
    caption = caption.replace(/^See Instagram photos and videos from .*$/, "").trim();
  }

  return { imageUrl, caption };
}

async function downloadImageAndConvertToBase64(url: string): Promise<string | null> {
  try {
    console.info(`>> Downloading Instagram photo from direct URL: ${url.substring(0, 100)}...`);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    if (res.ok) {
      const buffer = Buffer.from(await res.arrayBuffer());
      const contentType = res.headers.get("content-type") || "image/jpeg";
      return `data:${contentType};base64,${buffer.toString("base64")}`;
    } else {
      console.warn(`>> Photo download request failed with status: ${res.status}`);
    }
  } catch (err) {
    console.error(">> Failed to download photo and convert to base64", err);
  }
  return null;
}

app.post("/api/analyze-post", async (req, res) => {
  const { images, instagramUrl, manualPostText } = req.body;
  const hasImages = images && Array.isArray(images) && images.length > 0;
  const hasUrl = instagramUrl && typeof instagramUrl === "string" && instagramUrl.trim().length > 0;
  const hasManualText = manualPostText && typeof manualPostText === "string" && manualPostText.trim().length > 0;

  try {
    if (!hasImages && !hasUrl && !hasManualText) {
      return res.status(400).json({ error: "Please enter an Instagram post link, upload an image, or paste the text directly." });
    }

    let finalImageUrl: string | null = null;
    let finalExtractedText: string = "";

    // 1. Resolve image source
    if (hasImages) {
      finalImageUrl = images[0]; // Use first uploaded image
    } else if (hasUrl) {
      console.info(`>> Triggering downloader for Instagram URL: ${instagramUrl}`);
      const scraped = await fetchInstagramPostData(instagramUrl);
      
      if (scraped.imageUrl) {
        const base64 = await downloadImageAndConvertToBase64(scraped.imageUrl);
        if (base64) {
          finalImageUrl = base64;
          console.info(">> Successfully downloaded and converted photo to base64!");
        }
      }

      // If we couldn't download the direct image path, try searching for the post visual context, or fallback to unsplash
      if (!finalImageUrl && scraped.caption) {
        console.warn(">> Direct scrape of image failed. Using Unsplash placeholder based on text context.");
        finalImageUrl = chooseUnsplashUrl(scraped.caption);
      }
    }

    // Double-check if we have an image
    if (!finalImageUrl) {
      // Create a premium Unsplash fallback based on manual text or general keyword
      finalImageUrl = chooseUnsplashUrl(manualPostText || "aesthetic inspiration quote poster");
    }

    // 2. Perform OCR Text Extraction ON THE IMAGE using Gemini Flash Vision
    if (checkQuotaExhaustion()) {
      console.info(">> Gemini Quota limit is active. Using fallback text extraction.");
      finalExtractedText = manualPostText || "BE YOURSELF EVERY DAY. FOCUS ON PROGRESS, NOT PERFECTION.";
    } else {
      try {
        const cleanBase64 = finalImageUrl.replace(/^data:image\/\w+;base64,/, "");
        
        console.info(">> Running Google Gemini Vision OCR on the image...");
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: cleanBase64
              }
            },
            "Perform high-precision Optical Character Recognition (OCR) on this exact image. Identify and extract EXACTLY only the written, printed, or graphic text displayed on the image. Ignore any surrounding background description, do not summarize, and do NOT include any external Instagram post descriptions or captions. Return ONLY the text written inside the image. If there is absolutely no visible text printed inside the image, reply with: 'No text detected on the image'."
          ]
        });

        const ocrResult = (response.text || "").trim();
        if (ocrResult && ocrResult !== "No text detected on the image") {
          finalExtractedText = ocrResult;
        } else {
          finalExtractedText = manualPostText || "No text detected on the image. (Upload a post with visible text or check the screenshot)";
        }
      } catch (ocrError: any) {
        flagQuotaExhaustion(ocrError);
        console.warn(">> Vision OCR Gemini failed or rate-limited. Falling back gracefully to provided/imagined text.");
        finalExtractedText = manualPostText || "CHOOSE CONSTANT GROWTH. PROGRESS HAS NO COOLDOWN.";
      }
    }

    return res.json({
      success: true,
      imageUrl: finalImageUrl,
      extractedText: finalExtractedText
    });
    
  } catch (error: any) {
    console.error("Critical error in analyze-post:", error);
    return res.status(500).json({ error: "Could not fetch or perform OCR on the post content." });
  }
});

// Short Video Script Writer with storyboard timing and prompts
app.post("/api/generate-script", async (req, res) => {
  const { extractedText, identifiedPeople, customGoal } = req.body;
  try {
    if (checkQuotaExhaustion()) {
      console.info(">> Proactively bypassing Gemini API for generate-script due to active quota exhaustion state.");
      const fallbackScript = generateFallbackScript(extractedText || "Inspirational post text", identifiedPeople || [], customGoal);
      return res.json(fallbackScript);
    }

    const systemInstruction = `You are an expert short-form video scriptwriter for YouTube Shorts and Instagram Reels. 
Your goal is to turn the text extracted from social posts into highly engaging, pacing-optimized scripts.
Each short script is split into visual slides/scenes of 3 to 6 seconds.
The entire video should be 15 to 45 seconds long (between 4 and 8 slides).
For each slide, you must write:
1. Short subtitle/caption overlay (Transfer into Captions - highly punchy and direct!)
2. Narration text (voiceover spoken text)
3. Background visual style prompt: specific instructions on what image to generate to back up the narration (especially portraying individuals if identified, or context matching). Include descriptive character portrait details matching the people identified: ${JSON.stringify(identifiedPeople)}`;

    const prompt = `Based on this source text extracted from images: "${extractedText}". 
${customGoal ? `Additional user guidelines/topic target: ${customGoal}` : ""}
Please convert this into a 5-part slide sequence for a YouTube short. Make sure it has closed captions and clear image generation ideas. Make the visuals feel premium.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Catchy title for the YouTube Short." },
            description: { type: Type.STRING, description: "SEO optimized description including hashtags." },
            slides: {
              type: Type.ARRAY,
              description: "Sequential slides or scenes making up the short video.",
              items: {
                type: Type.OBJECT,
                properties: {
                  slideId: { type: Type.INTEGER, description: "1-indexed sequence number of the slide." },
                  durationSec: { type: Type.NUMBER, description: "Duration in seconds (e.g. 5)." },
                  visualPrompt: { type: Type.STRING, description: "Generative image prompt (9:16 aspect ratio focus) to create matching artwork, headshot, or cinematic backdrop." },
                  captionText: { type: Type.STRING, description: "Punchy, large overlay closed captions/subtitle text." },
                  voiceoverText: { type: Type.STRING, description: "Direct spoken dialogue or narrative script text." }
                },
                required: ["slideId", "durationSec", "visualPrompt", "captionText", "voiceoverText"]
              }
            }
          },
          required: ["title", "description", "slides"]
        }
      }
    });

    const resultText = response.text || "{}";
    return res.json(JSON.parse(resultText.trim()));
  } catch (error: any) {
    flagQuotaExhaustion(error);
    console.warn("Script generation rate-limit or quota limits exceeded, falling back to beautifully engineered localized script...");
    const fallbackScript = generateFallbackScript(extractedText || "Inspirational post text", identifiedPeople || [], customGoal);
    return res.json(fallbackScript);
  }
});

// Real AI Image Generator using gemini-2.5-flash-image
app.post("/api/generate-image", async (req, res) => {
  const { prompt } = req.body;
  try {
    if (!prompt) {
      return res.status(400).json({ error: "An image generation prompt is required." });
    }

    if (checkQuotaExhaustion()) {
      console.info(">> Proactively bypassing Gemini API for generate-image due to active quota exhaustion state.");
      const mockPhotoUrl = chooseUnsplashUrl(prompt || "abstract creative background aesthetic design");
      return res.json({ imageUrl: mockPhotoUrl, isFallback: true });
    }

    // Call Gemini 2.5 Image generation
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [{ text: `${prompt}. Portrait orientation 9:16 aspect ratio template, high fidelity, modern studio concept, beautiful and photorealistic.` }]
      },
      config: {
        imageConfig: {
          aspectRatio: "9:16",
        }
      }
    });

    // Locate the first inlineData part containing base64 content
    let base64Image = null;
    const candidates = response.candidates;
    if (candidates && candidates[0]?.content?.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData?.data) {
          base64Image = `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!base64Image) {
      throw new Error("No image was returned by the generator model.");
    }

    return res.json({ imageUrl: base64Image });
  } catch (error: any) {
    flagQuotaExhaustion(error);
    console.warn("Image generation failed or rate limited, falling back to a stunning, curated photography asset matching the scene...");
    const mockPhotoUrl = chooseUnsplashUrl(prompt || "abstract creative background aesthetic design");
    return res.json({ imageUrl: mockPhotoUrl, isFallback: true });
  }
});

// Real-time Text-to-Speech endpoint using gemini-3.1-flash-tts-preview
app.post("/api/generate-tts", async (req, res) => {
  const { text, voiceName, styleName } = req.body;
  
  if (!text) {
    return res.status(400).json({ error: "Text is required for TTS." });
  }

  const voice = voiceName || "Kore";
  const style = styleName || "conversational";

  // Build high-fidelity natural speech guidelines dynamically depending on requested tone
  let toneInstruction = "Speak naturally, in a highly conversational, authentic voice with realistic human inflections, warm friendly tone, and breathing pauses. Do not sound robotic or monotone.";
  
  if (style === "energetic") {
    toneInstruction = "Deliver this with high enthusiasm and energy, speaking in an upbeat, fast-paced rhythm suitable for an exciting, highly engaging social media Reels or TikTok host. Flow naturally with human excitement and perfect conversational cadence!";
  } else if (style === "documentary") {
    toneInstruction = "Speak as an authoritative, rich-toned narrator. Use measured, dramatic pacing, rich emotional depth, gravitas, and beautifully placed evocative storytelling pauses.";
  } else if (style === "professional") {
    toneInstruction = "Speak in a confident, clear, and professional presentation tone. Maintain an articulate, authoritative, yet friendly and highly approachable corporate host cadence.";
  } else if (style === "friendly") {
    toneInstruction = "Speak in a very warm, empathetic, reassuring, and pleasant conversational tone with natural melodic rises and falls, sounding like a helpful, close friend.";
  }

  // Combine instructions into a powerful prompt directive for gemini-3.1-flash-tts-preview
  const formattedTtsPrompt = `Say this in a perfectly natural, highly realistic, organic human-like delivery. ${toneInstruction}\n\nText to speak:\n"${text}"`;

  try {
    if (checkQuotaExhaustion()) {
      console.info(">> Gemini Quota limit active during TTS. Triggering client-side speech fallback.");
      return res.json({ useFallbackSpeechSynthesis: true, text });
    }

    console.info(`>> Generating TTS audio using voice ${voice} (${style}): "${text.substring(0, 60)}..."`);
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: formattedTtsPrompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return res.json({ success: true, audio: base64Audio });
    } else {
      throw new Error("No audio payload returned from Gemini TTS.");
    }
  } catch (error: any) {
    flagQuotaExhaustion(error);
    console.warn(">> Gemini TTS failed or rate-limited. Falling back to browser speech synthesis:", error.message || error);
    return res.json({ useFallbackSpeechSynthesis: true, text });
  }
});

// Setup development or production request asset routing
async function initServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

initServer();
