import React, { useState, useRef, useEffect } from "react";
import { 
  Upload, RefreshCw, FileText, Download, Copy, Check, Instagram, Image as ImageIcon, 
  Sparkles, Video, Compass, ChevronRight, ChevronLeft, Layers, Send, HelpCircle, ArrowRight,
  Play, Pause, Volume2, RotateCcw, Clapperboard, Sliders, Music, Film, Headphones
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Slide {
  slideId: number;
  durationSec: number;
  visualPrompt: string;
  captionText: string;
  voiceoverText: string;
}

interface ScriptResponse {
  title: string;
  description: string;
  slides: Slide[];
}

export default function App() {
  // Media extraction states
  const [instagramUrl, setInstagramUrl] = useState("");
  const [manualPostText, setManualPostText] = useState("");
  const [downloadedImageUrl, setDownloadedImageUrl] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  
  // Script generation states
  const [customGoal, setCustomGoal] = useState("Inspiring, modern, and high-tempo");
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<ScriptResponse | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Text-To-Speech & Video Simulation states
  const [selectedVoice, setSelectedVoice] = useState("Kore"); // Kore, Zephyr, Puck, Fenrir, Charon
  const [selectedSpeechStyle, setSelectedSpeechStyle] = useState("conversational"); // conversational, energetic, documentary, professional, friendly
  const [slideImages, setSlideImages] = useState<Record<number, string>>({});
  const [isGeneratingImage, setIsGeneratingImage] = useState<Record<number, boolean>>({});
  const [isTtsLoading, setIsTtsLoading] = useState<Record<number, boolean>>({});
  const [slideAudio, setSlideAudio] = useState<Record<number, string>>({});
  const [currentlyPlayingIndex, setCurrentlyPlayingIndex] = useState<number | null>(null);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [isFallbackSpeech, setIsFallbackSpeech] = useState(false); // Tells the UI when Web Speech API is speaking

  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Feedback alerts
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Autopilot specific state machine
  const [isAutopilotRunning, setIsAutopilotRunning] = useState(false);
  const [autopilotStep, setAutopilotStep] = useState<"idle" | "extracting" | "writing" | "synthesizing" | "complete" | "failed">("idle");
  const [autopilotError, setAutopilotError] = useState<string | null>(null);
  const [compiledAudioBase64, setCompiledAudioBase64] = useState<string | null>(null);

  // Cleanup synthesizer actions on element unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  // Helper to trigger transient alerts
  const triggerCopyAlert = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2500);
  };

  // Convert File to Base64
  const handleFileConvert = (file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsLoading(true);
    setStatusMessage("Reading imported image...");
    const file = e.target.files[0];
    try {
      const base64 = await handleFileConvert(file);
      setDownloadedImageUrl(base64);
      setUploadedImages([base64]);
    } catch (err) {
      alert("Failed to read image file.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setIsLoading(true);
      setStatusMessage("Importing drag-and-drop file...");
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        try {
          const base64 = await handleFileConvert(file);
          setDownloadedImageUrl(base64);
          setUploadedImages([base64]);
        } catch (err) {
          alert("Could not process dropped image file.");
        }
      }
      setIsLoading(false);
    }
  };

  // Step 1: Download Media & Run Multimodal Vision OCR to get text written ON the image
  const handleExtractTextOnImage = async () => {
    if (!instagramUrl.trim() && uploadedImages.length === 0 && !manualPostText.trim()) {
      alert("Please paste an Instagram link or drop a screenshot file to begin.");
      return;
    }

    setIsLoading(true);
    setGeneratedScript(null); // Reset downstream script
    setStatusMessage("Fetching image file & executing AI text recognition...");

    try {
      const res = await fetch("/api/analyze-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: uploadedImages,
          instagramUrl: instagramUrl.trim(),
          manualPostText: manualPostText.trim()
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Image extraction failed.");
      }

      const data = await res.json();
      if (data.imageUrl) {
        setDownloadedImageUrl(data.imageUrl);
      }
      if (data.extractedText) {
        setExtractedText(data.extractedText);
      }
    } catch (err: any) {
      alert(err.message || "We ran into an error scanning the image. Please try uploading a manual screen capture.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Create structured script based purely on the text written on the image
  const handleGenerateScript = async () => {
    if (!extractedText.trim()) {
      alert("Please extract text from an image or type text into the 'Text Written on Image' box first.");
      return;
    }

    setIsGeneratingScript(true);
    try {
      const res = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extractedText: extractedText.trim(),
          customGoal: customGoal.trim()
        })
      });

      if (!res.ok) {
        throw new Error("Could not construct short video script.");
      }

      const data = await res.json();
      setGeneratedScript(data);
      setActiveSlideIndex(0);
    } catch (err: any) {
      alert("Could not communicate with script generator. Please retry.");
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // Speak text using Web Speech API as a high-fidelity local fallback
  const speakWithSpeechSynthesis = (text: string, onEnded: () => void) => {
    window.speechSynthesis.cancel();
    setIsFallbackSpeech(true);
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.15; // Quick pace suitable for Shorts/Reels
    utterance.pitch = 1.0;
    
    // Choose standard natural English voice
    let voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      v.lang.startsWith("en-") && 
      (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Apple"))
    ) || voices.find(v => v.lang.startsWith("en-"));

    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onend = () => {
      setIsFallbackSpeech(false);
      onEnded();
    };

    utterance.onerror = () => {
      setIsFallbackSpeech(false);
      onEnded();
    };

    window.speechSynthesis.speak(utterance);
  };

  // Play slide voiceover using Gemini TTS (with natural Web Speech fallback)
  const playSlideAudio = async (index: number, autoAdvance: boolean = false) => {
    if (!generatedScript) return;
    const slide = generatedScript.slides[index];
    if (!slide) return;

    // Flush any ongoing vocal playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();
    setIsFallbackSpeech(false);

    setCurrentlyPlayingIndex(index);

    const triggerAudioElement = (srcStr: string) => {
      const audio = new Audio(srcStr);
      audioRef.current = audio;
      
      audio.onended = () => {
        setCurrentlyPlayingIndex(null);
        if (autoAdvance && isPlayingVideo) {
          if (index < generatedScript.slides.length - 1) {
            setActiveSlideIndex(index + 1);
            playSlideAudio(index + 1, true);
          } else {
            setIsPlayingVideo(false);
          }
        }
      };

      audio.onerror = () => {
        console.warn(">> Selected audio failed to decode or load. Triggering local SpeechSynthesis fallback.");
        speakWithSpeechSynthesis(slide.voiceoverText, () => {
          setCurrentlyPlayingIndex(null);
          if (autoAdvance && isPlayingVideo) {
            if (index < generatedScript.slides.length - 1) {
              setActiveSlideIndex(index + 1);
              playSlideAudio(index + 1, true);
            } else {
              setIsPlayingVideo(false);
            }
          }
        });
      };

      audio.play().catch(e => {
        console.warn("Autoplay was blocked by browser. Handled gracefully.", e);
        setCurrentlyPlayingIndex(null);
        setIsPlayingVideo(false);
      });
    };

    // Voice Cache Lookup
    const cacheKey = `${index}-${selectedVoice}-${selectedSpeechStyle}`;
    if (slideAudio[cacheKey]) {
      triggerAudioElement(slideAudio[cacheKey]);
      return;
    }

    setIsTtsLoading(prev => ({ ...prev, [index]: true }));

    try {
      const res = await fetch("/api/generate-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: slide.voiceoverText,
          voiceName: selectedVoice,
          styleName: selectedSpeechStyle
        })
      });

      if (!res.ok) {
        throw new Error("TTS Route Failed");
      }

      const data = await res.json();
      if (data.useFallbackSpeechSynthesis) {
        speakWithSpeechSynthesis(slide.voiceoverText, () => {
          setCurrentlyPlayingIndex(null);
          if (autoAdvance && isPlayingVideo) {
            if (index < generatedScript.slides.length - 1) {
              setActiveSlideIndex(index + 1);
              playSlideAudio(index + 1, true);
            } else {
              setIsPlayingVideo(false);
            }
          }
        });
      } else if (data.audio) {
        const dataUrl = `data:audio/wav;base64,${data.audio}`;
        setSlideAudio(prev => ({ ...prev, [cacheKey]: dataUrl }));
        triggerAudioElement(dataUrl);
      } else {
        throw new Error("No audio payload received");
      }
    } catch (err) {
      console.warn(">> TTS API service issue, loading browser fallback synthesis:", err);
      speakWithSpeechSynthesis(slide.voiceoverText, () => {
        setCurrentlyPlayingIndex(null);
        if (autoAdvance && isPlayingVideo) {
          if (index < generatedScript.slides.length - 1) {
            setActiveSlideIndex(index + 1);
            playSlideAudio(index + 1, true);
          } else {
            setIsPlayingVideo(false);
          }
        }
      });
    } finally {
      setIsTtsLoading(prev => ({ ...prev, [index]: false }));
    }
  };

  // Generate 9:16 specific AI slide background artwork from prompt
  const generateSlideImage = async (index: number) => {
    if (!generatedScript) return;
    const slide = generatedScript.slides[index];
    if (!slide) return;

    setIsGeneratingImage(prev => ({ ...prev, [index]: true }));

    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: slide.visualPrompt })
      });

      if (!res.ok) {
        throw new Error("Artwork service errored.");
      }

      const data = await res.json();
      if (data.imageUrl) {
        setSlideImages(prev => ({ ...prev, [index]: data.imageUrl }));
      }
    } catch (err) {
      console.error(err);
      alert("Failed to generate custom backdrop. Choosing a stock aesthetic photo.");
    } finally {
      setIsGeneratingImage(prev => ({ ...prev, [index]: false }));
    }
  };

  const startFullVideoAutoplay = () => {
    if (!generatedScript || generatedScript.slides.length === 0) return;
    setIsPlayingVideo(true);
    setActiveSlideIndex(0);
    playSlideAudio(0, true);
  };

  const stopVideoAutoplay = () => {
    setIsPlayingVideo(false);
    setCurrentlyPlayingIndex(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();
    setIsFallbackSpeech(false);
  };

  const clearAll = () => {
    setInstagramUrl("");
    setManualPostText("");
    setDownloadedImageUrl(null);
    setExtractedText("");
    setUploadedImages([]);
    setGeneratedScript(null);
    setCustomGoal("Inspiring, modern, and high-tempo");
    setSlideImages({});
    setSlideAudio({});
    setSelectedVoice("Kore");
    setSelectedSpeechStyle("conversational");
    setIsPlayingVideo(false);
    setCurrentlyPlayingIndex(null);
    setIsFallbackSpeech(false);
    setIsAutopilotRunning(false);
    setAutopilotStep("idle");
    setAutopilotError(null);
    setCompiledAudioBase64(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();
  };

  const downloadTxtMetadata = () => {
    if (!generatedScript) return;
    const content = `======================================================
SHORT-FORM VIDEO METADATA BUNDLE
======================================================

--- ORIGINAL EXTRACTED TEXT FROM POST ---
${extractedText || "No source text extracted."}

--- SUGGESTED VIDEO TITLE ---
${generatedScript.title}

--- SUGGESTED VIDEO DESCRIPTION & HASHTAGS ---
${generatedScript.description}

--- SCENE-BY-SCENE Storyboard SCRIPT ---
${generatedScript.slides.map((s, i) => `
Scene ${i + 1} (Duration: ${s.durationSec}s)
Caption Overlay: "${s.captionText}"
Narration Voiceover: "${s.voiceoverText}"
Visual Prompt Description: "${s.visualPrompt}"
`).join("\n")}

======================================================
Generated via Creator-AI Short-Form Studio
======================================================`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${generatedScript.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-metadata.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadMp3Voiceover = () => {
    if (!compiledAudioBase64 || compiledAudioBase64 === "fallback") {
      alert("No pre-rendered voiceover data available in fallback state. Please play/simulate in individual slide modes or copy scripts directly.");
      return;
    }
    const link = document.createElement("a");
    link.href = compiledAudioBase64;
    link.download = `${generatedScript?.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-voiceover.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAutopilotPipeline = async (linkToProcess?: string) => {
    const targetLink = (linkToProcess || instagramUrl).trim();
    if (!targetLink) {
      setAutopilotError("Please enter an Instagram post link first.");
      alert("Please enter an Instagram post link first.");
      return;
    }

    setIsAutopilotRunning(true);
    setAutopilotStep("extracting");
    setAutopilotError(null);
    setCompiledAudioBase64(null);
    setGeneratedScript(null);

    let finalExtractedText = "";
    
    try {
      // 1. Download & OCR text on image
      console.info(">> Autopilot Step 1: Running OCR/Image extraction on ", targetLink);
      const extractRes = await fetch("/api/analyze-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: [],
          instagramUrl: targetLink,
          manualPostText: ""
        })
      });

      if (!extractRes.ok) {
        const errData = await extractRes.json();
        throw new Error(errData.error || "Failed to download image or extract text from post.");
      }

      const extractData = await extractRes.json();
      if (extractData.imageUrl) {
        setDownloadedImageUrl(extractData.imageUrl);
      }
      if (extractData.extractedText) {
        setExtractedText(extractData.extractedText);
        finalExtractedText = extractData.extractedText;
      } else {
        throw new Error("No readable text could be obtained from the post.");
      }

      // 2. Generate script using the visual text
      setAutopilotStep("writing");
      console.info(">> Autopilot Step 2: Generating script on text:", finalExtractedText);
      const scriptRes = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extractedText: finalExtractedText,
          customGoal: customGoal.trim()
        })
      });

      if (!scriptRes.ok) {
        throw new Error("Could not construct structured short video script.");
      }

      const scriptData: ScriptResponse = await scriptRes.json();
      setGeneratedScript(scriptData);
      setActiveSlideIndex(0);

      // 3. Synthesize entire continuous voiceover narration
      setAutopilotStep("synthesizing");
      console.info(">> Autopilot Step 3: Compiling full continuous voice-over audio");
      const ttsRes = await fetch("/api/compiled-voiceover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slides: scriptData.slides,
          voiceName: selectedVoice,
          styleName: selectedSpeechStyle
        })
      });

      if (!ttsRes.ok) {
        throw new Error("Vocal synthesis route failed during compilation.");
      }

      const ttsData = await ttsRes.json();
      if (ttsData.useFallbackSpeechSynthesis) {
        setCompiledAudioBase64("fallback");
        console.warn(">> TTS quota limit active; fallback text-to-speech loaded.");
      } else if (ttsData.audio) {
        setCompiledAudioBase64(`data:audio/wav;base64,${ttsData.audio}`);
      } else {
        throw new Error("Vocal audio synthesis failed.");
      }

      setAutopilotStep("complete");
    } catch (err: any) {
      console.error("Autopilot pipeline failed:", err);
      setAutopilotError(err.message || "An unexpected issue occurred in the automated media pipeline.");
      setAutopilotStep("failed");
    } finally {
      setIsAutopilotRunning(false);
    }
  };

  const [studioTab, setStudioTab] = useState<"player" | "planner">("player");

  return (
    <div className="min-h-screen bg-[#FBFBFC] text-[#1E2022] flex flex-col antialiased font-sans">
      
      {/* Sticky Premium Header */}
      <header className="bg-white border-b border-gray-150 py-5 px-6 md:px-12 sticky top-0 z-50 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-[#833AB4] via-[#F56040] to-[#FCAF45] p-2.5 rounded-xl text-white shadow-xs">
              <Video className="w-5.5 h-5.5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-gray-900 flex items-center gap-2">
                <span>Social Visual OCR & Script Writer</span>
                <span className="text-[10px] bg-rose-50 text-rose-600 font-mono font-bold px-2.5 py-0.5 rounded-full border border-rose-100 uppercase tracking-wider">Vision Engine</span>
              </h1>
              <p className="text-xs text-gray-500 font-medium">Extract text printed visually on images to build perfect Shorts & Reels scripts</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              id="clear_fields_btn"
              onClick={clearAll}
              className="text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50 bg-white border border-gray-200 px-4 py-2.5 rounded-lg transition shadow-xs"
            >
              Reset Board
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-8">
        
        {/* Core Description / Disclaimer info */}
        <div className="bg-[#EEF1F6] border border-gray-200 rounded-2xl p-4 mb-8 flex gap-3 text-xs text-[#4A5568]">
          <HelpCircle className="w-5 h-5 text-[#833AB4] flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>How it works:</strong> Paste any Instagram post URL. The system downloads the actual photo directly, completely ignores the external comment caption/metadata, reads text written <strong>on the image itself</strong>, and uses that text to draft custom video scripts. If a direct link scraper gets restricted, you can drag-and-drop a screenshot instead!
          </p>
        </div>

        {/* Core Description / Disclaimer info */}
        <div className="bg-[#EEF1F6] border border-gray-200 rounded-2xl p-4 mb-8 flex gap-3 text-xs text-[#4A5568]">
          <HelpCircle className="w-5 h-5 text-[#833AB4] flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>How it works:</strong> Paste any Instagram post URL. The system downloads the actual photo directly, completely ignores the external comment caption/metadata, reads text written <strong>on the image itself</strong>, and uses that text to draft custom video scripts. If a direct link scraper gets restricted, you can drag-and-drop a screenshot instead!
          </p>
        </div>

        {/* =============================================================== */}
        {/* AUTOPILOT MASTER CONTROL CENTER */}
        {/* =============================================================== */}
        <div className="mb-10 bg-white border border-[#E2E8F0] shadow-[0_4px_24px_rgba(0,0,0,0.03)] rounded-3xl p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
            <div className="flex items-center gap-3">
              <div className="bg-[#833AB4] text-white p-3 rounded-2xl shadow-sm">
                <Sparkles className="w-6 h-6 text-yellow-300 animate-pulse" />
              </div>
              <div>
                <h2 className="text-lg font-black text-[#1E2022] flex items-center gap-2">
                  <span>Creator-AI Autopilot Studio</span>
                  <span className="text-[10px] bg-purple-50 text-purple-600 font-mono font-bold px-2.5 py-0.5 rounded-full border border-purple-100 uppercase tracking-wider">Default Active</span>
                </h2>
                <p className="text-xs text-gray-400 mt-1">One-click automation: Extract photo Text → Draft Script → Compile Natural voiceover MP3 & hashtags</p>
              </div>
            </div>
            {generatedScript && (
              <button 
                onClick={clearAll}
                className="self-start md:self-auto text-xs text-rose-500 font-bold border border-rose-100 hover:bg-rose-50 px-3 py-1.5 rounded-xl transition"
              >
                Clear / Reset Board
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
            {/* Input Link Bar */}
            <div className="lg:col-span-6 space-y-2">
              <label htmlFor="autopilot_link" className="block text-xs font-bold text-gray-500 uppercase tracking-widest font-mono">Instagram Post URL:</label>
              <div className="relative">
                <input 
                  id="autopilot_link"
                  type="url"
                  placeholder="https://www.instagram.com/p/..."
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  disabled={isAutopilotRunning}
                  className="w-full bg-gray-50 border border-gray-250 focus:border-[#833AB4] focus:bg-white focus:ring-1 focus:ring-[#833AB4] pr-4 pl-11 py-3.5 text-sm transition outline-none rounded-2xl placeholder-gray-400 font-semibold text-gray-800"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <Instagram className="w-5 h-5 text-[#833AB4]" />
                </div>
              </div>
            </div>

            {/* Voice Pick */}
            <div className="lg:col-span-3 space-y-2">
              <label htmlFor="autopilot_voice" className="block text-xs font-bold text-gray-500 uppercase tracking-widest font-mono">Profile Voice Style:</label>
              <select
                id="autopilot_voice"
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                disabled={isAutopilotRunning}
                className="w-full bg-gray-50 border border-gray-250 py-3.5 px-4 text-xs font-bold rounded-2xl outline-none focus:ring-1 focus:ring-[#833AB4] text-gray-700 cursor-pointer"
              >
                <option value="Kore">♀ Kore (Clean & Crisp)</option>
                <option value="Zephyr">♀ Zephyr (Cheerful & Friendly)</option>
                <option value="Puck">♂ Puck (Warm & Enthusiastic)</option>
                <option value="Fenrir">♂ Fenrir (Energetic Reels Vibe)</option>
                <option value="Charon">♂ Charon (Serious Narrator)</option>
              </select>
            </div>

            {/* Tone Pick */}
            <div className="lg:col-span-3 space-y-2">
              <label htmlFor="autopilot_tone" className="block text-xs font-bold text-gray-500 uppercase tracking-widest font-mono">Narrator Vibe Tone:</label>
              <select
                id="autopilot_tone"
                value={selectedSpeechStyle}
                onChange={(e) => setSelectedSpeechStyle(e.target.value)}
                disabled={isAutopilotRunning}
                className="w-full bg-gray-50 border border-gray-250 py-3.5 px-4 text-xs font-bold rounded-2xl outline-none focus:ring-1 focus:ring-[#833AB4] text-gray-700 cursor-pointer"
              >
                <option value="conversational">🗣️ Conversational (Conversational, realistic pauses)</option>
                <option value="friendly">🤗 Friendly (Warm, empathetic, friendly)</option>
                <option value="energetic">⚡ Energetic (Fast-paced high tempo social host)</option>
                <option value="documentary">🎙️ Storyteller (Measured documentary narration)</option>
                <option value="professional">👔 Official (Confident professional host)</option>
              </select>
            </div>
          </div>

          {/* Autopilot Activation Button */}
          {!generatedScript && !isAutopilotRunning && (
            <button
              onClick={() => handleAutopilotPipeline()}
              className="w-full bg-gradient-to-r from-[#833AB4] via-[#F56040] to-[#FCAF45] hover:brightness-105 active:scale-[0.99] text-white py-4.5 rounded-2xl font-black transition flex items-center justify-center gap-3 text-sm uppercase tracking-widest select-none shadow-md shadow-[#F56040]/10 cursor-pointer border-none"
            >
              <Sparkles className="w-5 h-5 text-white" />
              <span>⚡ Generate Voiceover Bundle & Metadata</span>
            </button>
          )}

          {/* Pipeline Loader / Stepper */}
          {isAutopilotRunning && (
            <div className="bg-gray-50 border border-purple-100 rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 animate-spin text-[#833AB4]" />
                <span className="text-xs font-black text-gray-700 uppercase tracking-wider font-mono">Master Autopilot Running...</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {[
                  { step: "extracting", title: "1. Post OCR", label: "Downloading and reading..." },
                  { step: "writing", title: "2. Scriptwriting", label: "Structuring storyboard..." },
                  { step: "synthesizing", title: "3. Human TTS", label: "Synthesizing vocal cadence..." },
                  { step: "complete", title: "4. Finished", label: "Compiling downloads..." }
                ].map((item, idx) => {
                  let isCurrent = autopilotStep === item.step;
                  let isPast = false;
                  if (autopilotStep === "writing" && idx < 1) isPast = true;
                  if (autopilotStep === "synthesizing" && idx < 2) isPast = true;
                  if (autopilotStep === "complete" && idx < 3) isPast = true;
                  
                  return (
                    <div 
                      key={idx} 
                      className={`border rounded-xl p-3.5 transition-all text-left ${
                        isPast 
                          ? "border-emerald-250 bg-emerald-50/50" 
                          : isCurrent 
                          ? "border-[#833AB4] bg-purple-50/20 shadow-xs" 
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-widest font-mono text-gray-400">{item.title}</span>
                        {isPast ? (
                          <span className="text-emerald-600 text-xs font-bold">✓ Done</span>
                        ) : isCurrent ? (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#833AB4]"></span>
                          </span>
                        ) : null}
                      </div>
                      <span className={`text-xs font-extrabold truncate block ${isPast ? "text-emerald-700" : isCurrent ? "text-purple-950 font-bold" : "text-gray-450"}`}>
                        {isCurrent ? item.label : isPast ? "Done" : "Waiting"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Autopilot Error block */}
          {autopilotError && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-800 font-semibold">
              ⚠️ Operation Failed: {autopilotError}
            </div>
          )}

          {/* Autopilot Delivery Center */}
          {compiledAudioBase64 && autopilotStep === "complete" && (
            <div className="border-2 border-emerald-500 rounded-2xl overflow-hidden shadow-lg animate-fade-in">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-5 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 animate-bounce text-yellow-300" />
                  <div>
                    <span className="text-[9px] uppercase font-bold tracking-widest font-mono bg-white/20 px-2.5 py-0.5 rounded-full">Pipeline Succeeded</span>
                    <h3 className="font-extrabold text-sm mt-1">Ready for Reels/TikTok Production!</h3>
                  </div>
                </div>
                <div className="text-[10px] font-mono bg-black/25 px-2.5 py-1 rounded-md font-bold">
                  ⚡ Autopilot Mode Complete
                </div>
              </div>

              <div className="p-6 space-y-6 bg-white text-left">
                {/* Continuous Audio Player */}
                <div className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 border border-purple-100 p-5 rounded-2xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-100 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-xs">
                        <Headphones className="w-5 h-5 text-white animate-pulse" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-[#833AB4] uppercase tracking-wide font-mono block">Voiceover Player</span>
                        <h4 className="font-extrabold text-[#1E2022] text-sm mt-0.5">Continuous Voiceover File</h4>
                      </div>
                    </div>
                    <span className="text-xs bg-indigo-50 text-[#833AB4] font-mono px-3 py-1 rounded-full font-bold self-start sm:self-auto border border-indigo-150">
                      Narrator: {selectedVoice} style ({selectedSpeechStyle})
                    </span>
                  </div>

                  {compiledAudioBase64 !== "fallback" ? (
                    <div className="bg-white p-3.5 rounded-xl border border-purple-200/50 shadow-xs flex flex-col sm:flex-row items-center gap-4">
                      <span className="text-[11px] text-gray-400 font-mono shrink-0">Continuous Audio:</span>
                      <audio controls src={compiledAudioBase64} className="w-full flex-1 h-10 outline-none" />
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-850 text-xs flex gap-3 leading-relaxed">
                      <Volume2 className="w-5 h-5 text-amber-600 shrink-0" />
                      <div>
                        <p className="font-bold">TTS Model fallback activated</p>
                        <p className="mt-0.5">You can play individual storyboard slides seamlessly inside the interactive smartphone player simulation below. Please obtain your structured metadata script document package directly using the black button below!</p>
                      </div>
                    </div>
                  )}

                  {/* Dynamic Autopilot Downloads */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    {compiledAudioBase64 !== "fallback" && (
                      <button
                        onClick={downloadMp3Voiceover}
                        className="flex-1 uppercase tracking-widest text-xs font-bold font-sans flex items-center justify-center gap-2 bg-[#833AB4] hover:bg-[#6c2899] text-white py-4 rounded-xl transition shadow-sm cursor-pointer select-none border-none outline-none"
                      >
                        <Download className="w-4.5 h-4.5 text-white" />
                        <span>Download Voiceover (WAV)</span>
                      </button>
                    )}

                    <button
                      onClick={downloadTxtMetadata}
                      className="flex-1 uppercase tracking-widest text-xs font-bold font-sans flex items-center justify-center gap-2 bg-[#1E2022] hover:bg-black text-white py-4 rounded-xl transition shadow-sm cursor-pointer select-none border-none outline-none"
                    >
                      <FileText className="w-4.5 h-4.5 text-yellow-300" />
                      <span>Download Metadata text bundle (TXT)</span>
                    </button>
                  </div>
                </div>

                {/* Previews */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="border border-gray-150 rounded-2xl p-5 bg-gray-50/50">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block font-mono mb-2">Shorts suggested SEO Title</span>
                    <p className="font-extrabold text-sm text-gray-900 leading-snug">{generatedScript?.title}</p>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block font-mono mt-4 mb-2">Hashtags & Description</span>
                    <p className="text-xs text-gray-500 italic block leading-relaxed line-clamp-3">{generatedScript?.description}</p>
                  </div>
                  <div className="border border-gray-150 rounded-2xl p-5 bg-gray-50/50">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block font-mono mb-2">Insta extracted raw text</span>
                    <p className="text-xs text-gray-650 leading-relaxed font-mono line-clamp-6 bg-white p-3 rounded-lg border border-gray-200">{extractedText}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT SECTION: Steps (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* STEP 1 Box: Source Media */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 font-mono flex items-center gap-2">
                  <span className="bg-[#833AB4] text-white w-5 h-5 rounded-md flex items-center justify-center text-[11px]">1</span>
                  <span>Source Instagram Image</span>
                </h2>
              </div>

              {/* URL Input */}
              <div className="space-y-2 mb-5">
                <label htmlFor="ig_url_input" className="block text-xs font-semibold text-gray-700">Paste Instagram Post Link</label>
                <div className="relative">
                  <input 
                    id="ig_url_input"
                    type="url" 
                    placeholder="https://www.instagram.com/p/..." 
                    value={instagramUrl} 
                    onChange={(e) => setInstagramUrl(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-[#833AB4] focus:ring-1 focus:ring-[#833AB4] pr-4 pl-10 py-3 text-sm transition outline-none rounded-xl placeholder-gray-450"
                  />
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <Instagram className="w-4 h-4 text-[#833AB4]" />
                  </div>
                </div>
              </div>

              {/* Or manual upload drag-drop container */}
              <div className="space-y-2 mb-6">
                <span className="block text-xs font-semibold text-gray-700">Or drag & drop screenshot directly</span>
                <div 
                  id="image_drag_drop_zone"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-5 text-center transition flex flex-col items-center justify-center ${
                    isDragOver ? "border-[#833AB4] bg-purple-50/30" : "border-gray-200 bg-gray-50 hover:bg-gray-100/50"
                  }`}
                >
                  <Upload className="w-7 h-7 text-gray-400 mb-2" />
                  <p className="text-xs font-bold text-gray-700 mb-0.5">Drag & drop photo</p>
                  <p className="text-[10px] text-gray-400 mb-3">Any standard image format</p>
                  
                  <input 
                    id="manual_file_uploader_input"
                    type="file" 
                    accept="image/*" 
                    onChange={handleFilesSelected} 
                    className="hidden"
                  />
                  <label 
                    htmlFor="manual_file_uploader_input"
                    className="cursor-pointer bg-white border border-gray-200 hover:border-gray-300 rounded-lg px-3.5 py-1.5 text-[11px] font-semibold inline-flex items-center shadow-xs select-none"
                  >
                    Select Screenshot file
                  </label>
                </div>
              </div>

              {/* Trigger Button */}
              <button 
                id="trigger_extract_btn"
                onClick={handleExtractTextOnImage}
                disabled={isLoading || (!instagramUrl.trim() && uploadedImages.length === 0)}
                className="w-full bg-gradient-to-r from-[#833AB4] to-[#F56040] hover:opacity-95 active:scale-[0.99] text-white py-3.5 rounded-xl font-bold transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-xs uppercase tracking-wider select-none"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{statusMessage || "Downloading & processing..."}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Download Image & Run OCR</span>
                  </>
                )}
              </button>
            </div>

            {/* Display / Edit visual extracted text */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">
                  Text Visually Written on Image
                </h3>
                {extractedText && (
                  <button 
                    onClick={() => triggerCopyAlert(extractedText, "extracted")}
                    className="text-[11px] font-semibold text-[#833AB4] flex items-center gap-1 hover:underline"
                  >
                    {copiedText === "extracted" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedText === "extracted" ? "Copied" : "Copy Source"}</span>
                  </button>
                )}
              </div>

              <textarea 
                rows={4}
                placeholder="The text detected within your post image will appear here. You can also manually type or refine it here directly!"
                value={extractedText}
                onChange={(e) => setExtractedText(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono text-gray-700 outline-none focus:bg-white focus:border-[#833AB4] transition"
              />
              <p className="text-[10px] text-gray-400 italic">
                Tip: Clean or tweak the OCR text above to make sure the script writer focuses on the exact points you want to express.
              </p>
            </div>

            {/* Step 2 Box: Script Configuration */}
            <div className="bg-white border border-[#EEF1F6] rounded-2xl p-6 shadow-xs space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 font-mono flex items-center gap-2">
                <span className="bg-[#F56040] text-white w-5 h-5 rounded-md flex items-center justify-center text-[11px]">2</span>
                <span>Configure Script Tone & Target</span>
              </h2>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-700">What is the vibe or target of this script?</label>
                <input 
                  type="text" 
                  value={customGoal} 
                  onChange={(e) => setCustomGoal(e.target.value)}
                  placeholder="e.g. Inspiring, dramatic, fitness focus, educational" 
                  className="w-full bg-gray-50 border border-gray-205 focus:border-[#F56040] focus:ring-1 focus:ring-[#F56040] px-4 py-2.5 text-sm rounded-xl outline-none transition"
                />
              </div>

              <button 
                id="generate_script_btn"
                onClick={handleGenerateScript}
                disabled={isGeneratingScript || !extractedText.trim()}
                className="w-full bg-[#1E2022] hover:bg-black text-white py-3.5 rounded-xl font-bold transition flex items-center justify-center gap-2 text-xs uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed select-none shadow-xs"
              >
                {isGeneratingScript ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Writing Visual Script...</span>
                  </>
                ) : (
                  <>
                    <Video className="w-4 h-4 text-[#FCAF45]" />
                    <span>Create Video Script</span>
                  </>
                )}
              </button>
            </div>

          </div>

          {/* RIGHT SECTION: Studio Preview & Interactive Storyboard (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Downloaded Original Post Image Drawer */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-pink-50 text-pink-600">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">Original Post Source Image</h4>
                    <p className="text-[10px] text-gray-400">Extracted and parsed via multimodal OCR</p>
                  </div>
                </div>
                {downloadedImageUrl && (
                  <a 
                    href={downloadedImageUrl} 
                    download="instagram-image-source.jpg"
                    className="text-xs font-bold text-gray-650 hover:text-black bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 flex items-center gap-x-1 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Save Photo</span>
                  </a>
                )}
              </div>

              {downloadedImageUrl ? (
                <div className="relative rounded-xl overflow-hidden bg-gray-900 border border-gray-155 flex items-center justify-center max-h-[220px]">
                  <img 
                    src={downloadedImageUrl} 
                    alt="Instagram Post Attachment" 
                    className="max-h-[220px] w-auto object-contain"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-xs text-[9px] text-white px-2 py-0.5 rounded font-mono font-bold tracking-wide">
                    Instagram Post Frame
                  </div>
                </div>
              ) : (
                <div className="border border-dashed border-gray-200 rounded-xl p-6 text-center text-gray-400 bg-[#FAFAFA]">
                  <ImageIcon className="w-6 h-6 mx-auto text-gray-300 mb-1" />
                  <p className="text-xs font-semibold">No screenshot or photo has been loaded</p>
                  <p className="text-[10px] text-gray-400">Image will appear here after parsing in Step 1.</p>
                </div>
              )}
            </div>

            {/* MAIN CREATOR STUDIO BOARD */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden flex flex-col min-h-[580px]">
              
              {/* Studio Header & Tab Switching */}
              <div className="bg-gradient-to-b from-[#FAF9FA] to-white border-b border-gray-150 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <span className="text-[10px] font-bold text-[#833AB4] uppercase tracking-widest font-mono block mb-0.5">Short-Form Studio</span>
                  <h3 className="text-lg font-extrabold text-[#1E2022] flex items-center gap-2">
                    <Clapperboard className="w-5 h-5 text-[#F56040]" />
                    <span>Video Developer Playground</span>
                  </h3>
                </div>

                {generatedScript && (
                  <div className="flex bg-gray-100 rounded-xl p-1 border border-gray-200/80 w-full sm:w-auto">
                    <button
                      onClick={() => {
                        stopVideoAutoplay();
                        setStudioTab("player");
                      }}
                      className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition select-none cursor-pointer outline-none ${
                        studioTab === "player" 
                          ? "bg-white text-[#833AB4] shadow-xs border border-purple-100" 
                          : "text-gray-500 hover:text-black"
                      }`}
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Live 9:16 Video Player</span>
                    </button>
                    <button
                      onClick={() => {
                        stopVideoAutoplay();
                        setStudioTab("planner");
                      }}
                      className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition select-none cursor-pointer outline-none ${
                        studioTab === "planner" 
                          ? "bg-white text-[#833AB4] shadow-xs border border-purple-100" 
                          : "text-gray-500 hover:text-black"
                      }`}
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Storyboard Scenes</span>
                    </button>
                  </div>
                )}
              </div>

              {!generatedScript ? (
                // Empty state
                <div className="flex-grow flex flex-col items-center justify-center text-center p-12 bg-[#FAFBFC]">
                  <div className="bg-gray-100 p-4 rounded-full text-gray-400 mb-4">
                    <Video className="w-8 h-8 text-neutral-450" />
                  </div>
                  <h4 className="font-extrabold text-gray-700 text-sm mb-1">Storyboard studio is offline</h4>
                  <p className="text-xs text-gray-400 max-w-sm leading-relaxed">
                    Extract visual information from your original image in Step 1, configure script tone, and click "Create Video Script". The interactive shorts engine will boot automatically.
                  </p>
                </div>
              ) : (
                <div className="flex-grow p-6 flex flex-col justify-between bg-gray-50/20">
                  
                  {/* Tab 1: Live Interactive Phone Simulator */}
                  {studioTab === "player" && (
                    <div className="space-y-6 flex-grow flex flex-col justify-between">
                      
                      {/* Sub-Header with Active Scene info */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-4 border-b border-gray-100">
                        <div>
                          <span className="text-xs font-bold font-mono text-[#833AB4]">Voice Selection & Playback:</span>
                          <span className="text-xs text-gray-400 ml-1">Prebuilt high-fidelity Gemini neural voices.</span>
                        </div>
                        {/* Status notification bar */}
                        {currentlyPlayingIndex !== null && (
                          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span>{isFallbackSpeech ? "WEB SPEECH FALLBACK VOICE" : `GEMINI VOICE: ${selectedVoice}`}</span>
                          </div>
                        )}
                      </div>

                      {/* Phone simulator layout panel */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                        
                        {/* COLUMN A: Smartphone viewport */}
                        <div className="md:col-span-6 flex justify-center">
                          <div className="relative w-full max-w-[270px] h-[480px] bg-black text-white overflow-hidden rounded-[40px] border-[10px] border-gray-900 shadow-2xl select-none">
                            {/* Camera notch */}
                            <div className="absolute top-2.5 left-1/2 -translate-y-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-full z-20 flex items-center justify-center gap-1.5 px-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#1F2937]"></div>
                              <div className="w-7 h-1 bg-[#1F2937] rounded-full"></div>
                              <div className="w-1.5 h-1.5 rounded-full bg-[#1F2937]"></div>
                            </div>

                            {/* Active segment indicators at top */}
                            <div className="absolute top-5 left-4 right-4 z-20 flex gap-1">
                              {generatedScript.slides.map((_, i) => (
                                <div 
                                  key={i} 
                                  className={`h-1 flex-1 rounded-full transition-all ${
                                    i === activeSlideIndex 
                                      ? "bg-[#FCAF45]" 
                                      : i < activeSlideIndex 
                                      ? "bg-white" 
                                      : "bg-white/30"
                                  }`}
                                />
                              ))}
                            </div>

                            {/* Scene text bubble floating top-left */}
                            <div className="absolute top-8 left-4 z-20 bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded-md text-[10px] font-bold font-mono tracking-wide text-gray-200">
                              Scene {activeSlideIndex + 1} • {generatedScript.slides[activeSlideIndex].durationSec}s
                            </div>

                            {/* Slide image backdrop renderer */}
                            <div className="absolute inset-0 bg-neutral-950 flex items-center justify-center">
                              {slideImages[activeSlideIndex] ? (
                                <img 
                                  src={slideImages[activeSlideIndex]} 
                                  alt="Slide Scene Artwork" 
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : downloadedImageUrl ? (
                                <div className="w-full h-full relative">
                                  <img 
                                    src={downloadedImageUrl} 
                                    alt="Fallback Source BG" 
                                    className="w-full h-full object-cover opacity-35 blur-xs scale-105"
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-4">
                                    <Video className="w-8 h-8 text-white/50 mb-2" />
                                    <p className="text-[10px] text-gray-300 font-bold uppercase tracking-wider">Default Backing Track</p>
                                    <p className="text-[9px] text-gray-450 mt-1 max-w-[160px]">Click 'AI Artwork' to paint image backdrop matching this scene prompt with Gemini.</p>
                                  </div>
                                </div>
                              ) : (
                                <div className="w-full h-full bg-gradient-to-b from-neutral-900 to-neutral-800 flex flex-col items-center justify-center text-center p-4">
                                  <Compass className="w-8 h-8 text-white/20 mb-2" />
                                  <p className="text-[10px] text-neutral-400 font-mono">Ambient backdrop placeholder</p>
                                </div>
                              )}

                              {/* Soft dark vignette overlays */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/45 z-10 pointer-events-none" />
                            </div>

                            {/* Reels Styled Big Interactive Subtitles Overlay in lower-third */}
                            <div className="absolute bottom-16 left-3 right-3 text-center z-10 px-1 pointer-events-none leading-snug">
                              <AnimatePresence mode="wait">
                                <motion.div 
                                  key={activeSlideIndex}
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 1.05 }}
                                  transition={{ duration: 0.16 }}
                                  className="inline-block bg-yellow-300 text-black font-extrabold text-[12px] md:text-[13px] py-1.5 px-3.5 uppercase tracking-wide rounded-lg leading-tight border-2 border-black shadow-lg shadow-black/80 whitespace-normal break-words"
                                >
                                  "{generatedScript.slides[activeSlideIndex].captionText}"
                                </motion.div>
                              </AnimatePresence>
                            </div>

                            {/* CSS Animated Audio spectrum visualization floating right */}
                            {currentlyPlayingIndex === activeSlideIndex && (
                              <div className="absolute bottom-4 right-4 z-20 flex gap-0.5 items-end justify-center h-5 w-6 bg-black/50 backdrop-blur-xs rounded-md px-1.5 py-1">
                                <div className="w-0.5 bg-[#833AB4] rounded-t animate-pulse" style={{ height: '70%', animationDelay: '0.1s', animationDuration: '0.5s' }}></div>
                                <div className="w-0.5 bg-[#F56040] rounded-t animate-pulse" style={{ height: '90%', animationDelay: '0.2s', animationDuration: '0.3s' }}></div>
                                <div className="w-0.5 bg-[#FCAF45] rounded-t animate-pulse" style={{ height: '50%', animationDelay: '0.3s', animationDuration: '0.6s' }}></div>
                              </div>
                            )}

                            {/* Floating Generate Slide Image button on top layer of phone */}
                            <button
                              title="Generate customized AI backdrop matching this scene prompt"
                              disabled={isGeneratingImage[activeSlideIndex]}
                              onClick={() => generateSlideImage(activeSlideIndex)}
                              className="absolute bottom-4 left-4 z-20 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 backdrop-blur-md shadow-xs active:scale-95 transition disabled:opacity-40 cursor-pointer border-none"
                            >
                              {isGeneratingImage[activeSlideIndex] ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-200" />
                              ) : (
                                <Sparkles className="w-3.5 h-3.5 text-[#FCAF45] animate-pulse" />
                              )}
                            </button>
                            
                          </div>
                        </div>

                        {/* COLUMN B: Simulator Controls, voice configuration, active sliders */}
                        <div className="md:col-span-6 space-y-4">
                          
                          {/* 1. Voice Selector Block */}
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <span className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest font-mono">Gemini AI Model Voice</span>
                              <div className="grid grid-cols-2 lg:grid-cols-5 gap-1.55">
                                {[
                                  { name: "Kore", label: "♀ Kore", desc: "Clear" },
                                  { name: "Zephyr", label: "♀ Zephyr", desc: "Cheerful" },
                                  { name: "Puck", label: "♂ Puck", desc: "Warm" },
                                  { name: "Fenrir", label: "♂ Fenrir", desc: "Energetic" },
                                  { name: "Charon", label: "♂ Charon", desc: "Serious" }
                                ].map((v) => (
                                  <button
                                    key={v.name}
                                    onClick={() => setSelectedVoice(v.name)}
                                    className={`text-left p-2 rounded-xl border text-xs transition cursor-pointer select-none truncate ${
                                      selectedVoice === v.name
                                        ? "bg-[#833AB4]/5 border-[#833AB4] text-[#833AB4] font-bold"
                                        : "bg-white border-gray-200 text-gray-650 hover:bg-gray-50"
                                    }`}
                                  >
                                    <span className="block font-bold">{v.label}</span>
                                    <span className="text-[10px] text-gray-400 block font-normal">{v.desc}</span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest font-mono">Speech Tone & Vibe</span>
                                <span className="text-[10px] bg-indigo-50 text-[#833AB4] font-mono px-2.5 py-0.5 rounded-full font-bold">Natural Speaking Modulator</span>
                              </div>
                              <div className="grid grid-cols-2 lg:grid-cols-5 gap-1.5">
                                {[
                                  { name: "conversational", label: "Conversational", emoji: "🗣️", desc: "Natural, realistic pauses" },
                                  { name: "friendly", label: "Warm Friendly", emoji: "🤗", desc: "Empathetic, pleasant" },
                                  { name: "energetic", label: "Energetic Host", emoji: "⚡", desc: "Fast-paced Reels style" },
                                  { name: "documentary", label: "Narrator Vibe", emoji: "🎙️", desc: "Measured, storytelling" },
                                  { name: "professional", label: "Official Host", emoji: "👔", desc: "Confident, executive" }
                                ].map((s) => (
                                  <button
                                    key={s.name}
                                    onClick={() => setSelectedSpeechStyle(s.name)}
                                    className={`text-left p-2 rounded-xl border text-[11px] transition cursor-pointer select-none ${
                                      selectedSpeechStyle === s.name
                                        ? "bg-indigo-50 border-indigo-500 text-indigo-700 font-bold"
                                        : "bg-white border-gray-200 text-gray-650 hover:bg-gray-50"
                                    }`}
                                    title={s.desc}
                                  >
                                    <span className="block font-bold truncate">{s.emoji} {s.label}</span>
                                    <span className="text-[9px] text-gray-400 block font-normal line-clamp-1 truncate">{s.desc}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* 2. Slide Meta Details */}
                          <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-4 space-y-3">
                            <div>
                              <span className="block text-[10px] font-bold text-gray-450 uppercase tracking-wide">Scene Narration Script</span>
                              <p className="text-xs leading-relaxed text-gray-700 mt-1 font-medium">
                                {generatedScript.slides[activeSlideIndex].voiceoverText}
                              </p>
                            </div>

                            <div className="border-t border-gray-200/60 pt-2 flex flex-wrap gap-2 items-center justify-between">
                              <span className="text-[10px] font-mono text-gray-400">Active Prompt:</span>
                              <button 
                                onClick={() => triggerCopyAlert(generatedScript.slides[activeSlideIndex].visualPrompt, `promptext-${activeSlideIndex}`)}
                                className="text-[9px] text-[#833AB4] font-bold flex items-center gap-0.5 hover:underline"
                              >
                                {copiedText === `promptext-${activeSlideIndex}` ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5" />}
                                <span>Copy Scene Prompt</span>
                              </button>
                            </div>
                          </div>

                          {/* 3. Audio Triggers & Quick Simulation Utilities */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => playSlideAudio(activeSlideIndex)}
                              disabled={isTtsLoading[activeSlideIndex]}
                              className="flex-1 bg-purple-50 text-[#833AB4] hover:bg-purple-100 border border-purple-200 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 text-xs select-none cursor-pointer"
                            >
                              {isTtsLoading[activeSlideIndex] ? (
                                <>
                                  <RefreshCw className="w-4 h-4 animate-spin animate-spin-slow" />
                                  <span>Generating audio...</span>
                                </>
                              ) : currentlyPlayingIndex === activeSlideIndex ? (
                                <>
                                  <Pause className="w-4 h-4" />
                                  <span>Replay Audio</span>
                                </>
                              ) : (
                                <>
                                  <Volume2 className="w-4 h-4" />
                                  <span>Speak This Scene</span>
                                </>
                              )}
                            </button>

                            <button
                              disabled={isGeneratingImage[activeSlideIndex]}
                              onClick={() => generateSlideImage(activeSlideIndex)}
                              className="bg-white hover:bg-gray-50 border border-gray-200 py-3 px-4 rounded-xl font-bold text-gray-700 transition flex items-center justify-center gap-2 text-xs select-none cursor-pointer"
                              title="Create visual backdrop using Gemini AI representation model"
                            >
                              {isGeneratingImage[activeSlideIndex] ? (
                                <RefreshCw className="w-4 h-4 animate-spin text-[#833AB4]" />
                              ) : (
                                <ImageIcon className="w-4 h-4 text-purple-600" />
                              )}
                              <span>AI Artwork</span>
                            </button>
                          </div>

                          {/* Video player carousel actions */}
                          <div className="flex justify-between items-center bg-gray-50/50 p-2 border border-gray-200 rounded-xl">
                            <button 
                              onClick={() => {
                                stopVideoAutoplay();
                                setActiveSlideIndex(p => Math.max(0, p - 1));
                              }}
                              disabled={activeSlideIndex === 0}
                              className="text-[11px] font-bold text-gray-650 hover:bg-white p-2 rounded-lg disabled:opacity-35 transition flex items-center gap-1 select-none cursor-pointer border border-transparent hover:border-gray-200"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                              <span>Prev Scene</span>
                            </button>

                            <div className="flex gap-1">
                              {generatedScript.slides.map((_, i) => (
                                <div 
                                  key={i} 
                                  onClick={() => {
                                    stopVideoAutoplay();
                                    setActiveSlideIndex(i);
                                  }}
                                  className={`w-1.5 h-1.5 rounded-full cursor-pointer transition-all ${
                                    i === activeSlideIndex ? "bg-[#833AB4] scale-125" : "bg-gray-300"
                                  }`}
                                />
                              ))}
                            </div>

                            <button 
                              onClick={() => {
                                stopVideoAutoplay();
                                setActiveSlideIndex(p => Math.min(generatedScript.slides.length - 1, p + 1));
                              }}
                              disabled={activeSlideIndex === generatedScript.slides.length - 1}
                              className="text-[11px] font-bold text-gray-650 hover:bg-white p-2 rounded-lg disabled:opacity-35 transition flex items-center gap-1 select-none cursor-pointer border border-transparent hover:border-gray-200"
                            >
                              <span>Next Scene</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>

                        </div>
                      </div>

                      {/* Video Autoplay player console */}
                      <div className="border-t border-gray-150 pt-5 mt-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
                        <div className="text-left">
                          <h4 className="text-xs font-bold text-gray-700 flex items-center gap-1">
                            <Film className="w-3.5 h-3.5 text-pink-600" />
                            <span>Cinematic Production Preview</span>
                          </h4>
                          <p className="text-[10px] text-gray-400 mt-0.5">Click compile to play the full Shorts narrative sequentially with automated voice-over transitions.</p>
                        </div>

                        <div className="flex gap-2 w-full sm:w-auto">
                          {isPlayingVideo ? (
                            <button
                              onClick={stopVideoAutoplay}
                              className="flex-1 sm:flex-none bg-[#1E2022] hover:bg-black text-white px-5 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 text-xs uppercase tracking-wider select-none cursor-pointer border-none"
                            >
                              <Pause className="w-4 h-4 text-[#FCAF45]" />
                              <span>Stop Simulation</span>
                            </button>
                          ) : (
                            <button
                              onClick={startFullVideoAutoplay}
                              className="flex-1 sm:flex-none bg-gradient-to-r from-[#833AB4] to-[#F56040] text-white hover:opacity-95 px-5 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow-sm select-none cursor-pointer border-none"
                            >
                              <Play className="w-4 h-4 text-white fill-white" />
                              <span>Play Full Continuous Video</span>
                            </button>
                          )}
                        </div>
                      </div>

                    </div>
                  )}

                  {/* Tab 2: Detailed full storyboard view listing all scenes */}
                  {studioTab === "planner" && (
                    <div className="space-y-6 flex-grow flex flex-col justify-between">
                      
                      {/* Suggested Title & Details Card */}
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-xl border border-purple-100/50">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-bold tracking-wider uppercase text-[#833AB4] font-mono">Suggested Title & Search Metadata</span>
                          <button 
                            onClick={() => triggerCopyAlert(`${generatedScript.title}\n\n${generatedScript.description}`, "seo")}
                            className="text-[10px] text-purple-600 font-bold flex items-center gap-1 hover:underline"
                          >
                            {copiedText === "seo" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedText === "seo" ? "Copied" : "Copy Title Info"}</span>
                          </button>
                        </div>
                        <h4 className="font-extrabold text-sm text-gray-900 mb-1">
                          {generatedScript.title}
                        </h4>
                        <p className="text-[11px] text-gray-500 italic block leading-relaxed line-clamp-2">
                          {generatedScript.description}
                        </p>
                      </div>

                      {/* Scene Accordions list */}
                      <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                        {generatedScript.slides.map((slide, i) => (
                          <div 
                            key={slide.slideId} 
                            className={`border rounded-xl p-4 transition-all ${
                              i === activeSlideIndex 
                                ? "border-[#833AB4] bg-purple-50/10 shadow-xs" 
                                : "border-gray-200 bg-white"
                            }`}
                          >
                            <div className="flex justify-between items-center pb-2 mb-2 border-b border-gray-100">
                              <div className="flex items-center gap-2">
                                <span className="bg-[#833AB4] text-white text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                                  SCENE {i + 1}
                                </span>
                                <span className="text-[10px] text-gray-400 font-mono font-bold">⏰ {slide.durationSec}s duration</span>
                              </div>

                              <div className="flex gap-1.5 items-center">
                                {/* Individual scene speech player */}
                                <button
                                  onClick={() => {
                                    setActiveSlideIndex(i);
                                    playSlideAudio(i);
                                  }}
                                  disabled={isTtsLoading[i]}
                                  className="p-1 px-2.5 rounded-lg border text-[10px] font-bold flex items-center gap-1 bg-purple-50 text-[#833AB4] border-purple-150 hover:bg-purple-100 disabled:opacity-40 transition cursor-pointer select-none border-none outline-none"
                                >
                                  {isTtsLoading[i] ? (
                                    <RefreshCw className="w-2.5 h-2.5 animate-spin text-purple-600" />
                                  ) : currentlyPlayingIndex === i ? (
                                    <Pause className="w-2.5 h-2.5" />
                                  ) : (
                                    <Volume2 className="w-2.5 h-2.5" />
                                  )}
                                  <span>{currentlyPlayingIndex === i ? "Playing" : "Listen"}</span>
                                </button>

                                {/* Individual scene AI background creator */}
                                <button
                                  onClick={() => {
                                    setActiveSlideIndex(i);
                                    generateSlideImage(i);
                                  }}
                                  disabled={isGeneratingImage[i]}
                                  className="p-1 px-2.5 rounded-lg border text-[10px] font-bold flex items-center gap-1 bg-white hover:bg-gray-50 text-gray-750 border-gray-200 disabled:opacity-40 transition cursor-pointer select-none border-none outline-none"
                                >
                                  {isGeneratingImage[i] ? (
                                    <RefreshCw className="w-2.5 h-2.5 animate-spin text-purple-600" />
                                  ) : (
                                    <ImageIcon className="w-2.5 h-2.5 text-purple-600" />
                                  )}
                                  <span>{slideImages[i] ? "Regenerate Art" : "Paint Art"}</span>
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-2 font-sans">
                              {/* Left Thumbnail visual if generated */}
                              <div className="md:col-span-3">
                                {slideImages[i] ? (
                                  <img 
                                    src={slideImages[i]} 
                                    alt={`Visual backdrop Scene ${i+1}`} 
                                    className="w-full h-20 object-cover rounded-lg border border-gray-200"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="w-full h-20 bg-gray-50 border border-dashed border-gray-200 rounded-lg flex items-center justify-center text-center p-2">
                                    <span className="text-[9px] text-gray-400 font-mono leading-tight">No slide custom art</span>
                                  </div>
                                )}
                              </div>

                              <div className="md:col-span-9 space-y-2 text-xs">
                                <div>
                                  <span className="font-bold text-gray-400 text-[10px] uppercase block">Voiceover Voice:</span>
                                  <p className="text-gray-700 italic">"{slide.voiceoverText}"</p>
                                </div>
                                <div className="bg-gray-50/50 p-2 rounded-lg border border-gray-150 flex justify-between items-center">
                                  <div className="truncate pr-2">
                                    <span className="font-bold text-gray-400 text-[9px] uppercase block">Recommended Image Generation Prompt:</span>
                                    <span className="text-gray-500 font-mono text-[10px] truncate block">{slide.visualPrompt}</span>
                                  </div>
                                  <button
                                    onClick={() => triggerCopyAlert(slide.visualPrompt, `listpmp-${i}`)}
                                    className="text-[#833AB4] hover:underline flex items-center font-bold text-[10px] shrink-0 bg-transparent border-none"
                                  >
                                    {copiedText === `listpmp-${i}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              </div>
                            </div>

                          </div>
                        ))}
                      </div>

                      <div className="bg-slate-50 rounded-xl p-4 border border-gray-200 flex justify-between items-center text-xs">
                        <span className="text-gray-500 font-mono font-medium">Ready to review all scenes?</span>
                        <button
                          onClick={() => setStudioTab("player")}
                          className="bg-[#1E2022] hover:bg-black text-white px-4 py-2 rounded-lg font-bold text-xs select-none cursor-pointer border-none"
                        >
                          Switch to Live Player
                        </button>
                      </div>

                    </div>
                  )}

                </div>
              )}

            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-150 py-6 text-center text-xs text-gray-400 font-mono mt-12">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2026 Social Visual OCR & Script Builder Utility. Optimized for dynamic YouTube shorts layout styling.</p>
        </div>
      </footer>
    </div>
  );
}
