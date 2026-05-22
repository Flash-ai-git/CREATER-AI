import React, { useState } from "react";
import { 
  Upload, RefreshCw, FileText, Download, Copy, Check, Instagram, Image as ImageIcon, 
  Sparkles, Video, Compass, ChevronRight, ChevronLeft, Layers, Send, HelpCircle, ArrowRight
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
  
  // Feedback alerts
  const [copiedText, setCopiedText] = useState<string | null>(null);

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

  const clearAll = () => {
    setInstagramUrl("");
    setManualPostText("");
    setDownloadedImageUrl(null);
    setExtractedText("");
    setUploadedImages([]);
    setGeneratedScript(null);
    setCustomGoal("Inspiring, modern, and high-tempo");
  };

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

          {/* RIGHT SECTION: Screen Display & Interactive Storyboard (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* STEP 1 outcome: Visual preview of photo */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-purple-600" />
                  <span>Downloaded Post Image</span>
                </h3>
                {downloadedImageUrl && (
                  <a 
                    href={downloadedImageUrl} 
                    download="instagram-image-source.jpg"
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 flex items-center gap-1 shadow-2xs transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Save Photo</span>
                  </a>
                )}
              </div>

              {downloadedImageUrl ? (
                <div className="relative rounded-xl overflow-hidden bg-gray-900 border border-gray-150 flex items-center justify-center max-h-[350px]">
                  <img 
                    src={downloadedImageUrl} 
                    alt="Instagram Post Attachment" 
                    className="max-h-[350px] w-auto object-contain"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-xs text-[10px] text-white px-2 py-0.5 rounded font-mono font-bold tracking-wide">
                    Extracted Photo Source
                  </div>
                </div>
              ) : (
                <div className="border border-dashed border-gray-200 rounded-xl p-10 text-center text-gray-400 bg-[#FAFAFA]">
                  <ImageIcon className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                  <p className="text-xs font-semibold">Ready to display original photography</p>
                  <p className="text-[10px] text-gray-400 mt-1">Image file will render here after successful scrapers or manual screenshot upload.</p>
                </div>
              )}
            </div>

            {/* STEP 2 outcome: Interactive Storyboard Script */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs flex flex-col min-h-[460px]">
              
              <div className="border-b border-gray-100 pb-4 mb-6">
                <span className="text-[10px] font-bold text-[#F56040] uppercase tracking-widest font-mono block mb-1">Interactive Storyboard</span>
                <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                  <span>YouTube Short/Reel Script View</span>
                </h3>
              </div>

              {!generatedScript ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-gray-150 rounded-xl bg-gray-50/50">
                  <div className="bg-gray-100/80 p-3.5 rounded-full text-gray-400 mb-4">
                    <Layers className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-gray-700 text-sm mb-1">No video script built yet</h4>
                  <p className="text-xs text-gray-400 max-w-sm leading-relaxed">
                    Once the visual text is extracted from the image in Step 1, click "Create Video Script" to construct a slide-by-slide vertical storyboard.
                  </p>
                </div>
              ) : (
                <div className="space-y-6 flex-grow flex flex-col justify-between">
                  
                  {/* Title & SEO Description */}
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-xl border border-purple-100/50">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold tracking-wider uppercase text-purple-600 font-mono">Suggested Video Title & Details</span>
                      <button 
                        onClick={() => triggerCopyAlert(`${generatedScript.title}\n\n${generatedScript.description}`, "seo")}
                        className="text-[10px] text-purple-600 font-bold flex items-center gap-1 hover:underline"
                      >
                        {copiedText === "seo" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedText === "seo" ? "Copied" : "Copy Info"}</span>
                      </button>
                    </div>
                    <h4 className="font-extrabold text-sm text-gray-900 mb-1">
                      {generatedScript.title}
                    </h4>
                    <p className="text-[11px] text-gray-500 italic block leading-relaxed line-clamp-2">
                      {generatedScript.description}
                    </p>
                  </div>

                  {/* Dynamic Slide presentation */}
                  <div className="border border-gray-200 rounded-xl p-5 bg-gray-50/60 relative flex-grow my-2">
                    
                    {/* Header bar of slide */}
                    <div className="flex justify-between items-center text-xs font-mono font-bold text-gray-450 border-b border-gray-150 pb-2 mb-4">
                      <span>SCENE {activeSlideIndex + 1} of {generatedScript.slides.length}</span>
                      <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-[10px]">
                        ⏰ {generatedScript.slides[activeSlideIndex].durationSec}s
                      </span>
                    </div>

                    <div className="space-y-4">
                      
                      {/* Screen Caption Preview */}
                      <div className="space-y-1">
                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide">Caption Overlay (on screen)</span>
                        <div className="bg-black text-yellow-300 font-extrabold text-center text-sm py-2 px-4 rounded-lg uppercase tracking-wide shadow-xs font-sans">
                          "{generatedScript.slides[activeSlideIndex].captionText}"
                        </div>
                      </div>

                      {/* Direct narration voiceover */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide">Narration / Voiceover Script</span>
                          <button 
                            onClick={() => triggerCopyAlert(generatedScript.slides[activeSlideIndex].voiceoverText, `vo-${activeSlideIndex}`)}
                            className="text-[9px] text-[#833AB4] font-bold flex items-center gap-0.5 hover:underline"
                          >
                            {copiedText === `vo-${activeSlideIndex}` ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5" />}
                            <span>Copy Voiceover</span>
                          </button>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-lg p-3 text-xs leading-relaxed text-gray-700">
                          {generatedScript.slides[activeSlideIndex].voiceoverText}
                        </div>
                      </div>

                      {/* Background Visual prompting suggestions */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide">AI Image Generator Prompt (9:16)</span>
                          <button 
                            onClick={() => triggerCopyAlert(generatedScript.slides[activeSlideIndex].visualPrompt, `prompt-${activeSlideIndex}`)}
                            className="text-[9px] text-[#833AB4] font-bold flex items-center gap-0.5 hover:underline"
                          >
                            {copiedText === `prompt-${activeSlideIndex}` ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5" />}
                            <span>Copy Prompt</span>
                          </button>
                        </div>
                        <p className="text-[11px] font-mono text-gray-500 bg-[#EAEDF1] p-3 rounded-lg leading-relaxed whitespace-normal break-words shadow-inner select-all">
                          {generatedScript.slides[activeSlideIndex].visualPrompt}
                        </p>
                      </div>

                    </div>
                  </div>

                  {/* Navigation footer for the script carousel */}
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <button 
                      onClick={() => setActiveSlideIndex(p => Math.max(0, p - 1))}
                      disabled={activeSlideIndex === 0}
                      className="text-xs font-bold text-gray-650 hover:text-black hover:bg-gray-100 px-3 py-2 rounded-lg border border-gray-200 disabled:opacity-35 transition flex items-center gap-1 select-none cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Prev Scene</span>
                    </button>

                    <div className="flex gap-1.5 justify-center">
                      {generatedScript.slides.map((_, i) => (
                        <div 
                          key={i} 
                          className={`w-2 h-2 rounded-full transition-all ${
                            i === activeSlideIndex ? "bg-[#833AB4] w-4" : "bg-gray-200"
                          }`}
                        />
                      ))}
                    </div>

                    <button 
                      onClick={() => setActiveSlideIndex(p => Math.min(generatedScript.slides.length - 1, p + 1))}
                      disabled={activeSlideIndex === generatedScript.slides.length - 1}
                      className="text-xs font-bold text-gray-650 hover:text-black hover:bg-gray-100 px-3 py-2 rounded-lg border border-gray-200 disabled:opacity-35 transition flex items-center gap-1 select-none cursor-pointer"
                    >
                      <span>Next Scene</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  
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
