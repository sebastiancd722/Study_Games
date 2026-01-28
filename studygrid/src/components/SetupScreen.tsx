import React, { useState, useRef, useEffect } from 'react';
import { generateFlashcards, FileAttachment } from '../services/geminiService';
import { Flashcard, GameMode, GridCell, GameState, SavedGameData, Difficulty } from '../types';
import { Button } from './Button';
import { Sparkles, Play, FileText, AlertCircle, UploadCloud, X, File as FileIcon, Image as ImageIcon, Presentation, Grid, Brain, Zap, RotateCcw, BookOpen, Check } from 'lucide-react';
import JSZip from 'jszip';

interface SetupScreenProps {
  onStartGame: (cards: Flashcard[], mode: GameMode, difficulty: Difficulty, savedGrid?: GridCell[], savedGameState?: GameState) => void;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({ onStartGame }) => {
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.LEARN); 
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  
  const [topic, setTopic] = useState('');
  const [manualText, setManualText] = useState('');
  const [aiContextText, setAiContextText] = useState(''); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<{name: string, type: string, data: FileAttachment}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savedGame, setSavedGame] = useState<SavedGameData | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('studygrid_save');
      if (saved) {
        const parsed = JSON.parse(saved) as SavedGameData;
        if (parsed.cards && parsed.grid && parsed.mode === GameMode.GRID) {
          setSavedGame(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load save:", e);
    }
  }, []);

  const handleResume = () => {
    if (savedGame) {
      onStartGame(savedGame.cards, savedGame.mode, savedGame.difficulty || Difficulty.MEDIUM, savedGame.grid, savedGame.gameState);
    }
  };

  const handleStart = async () => {
    setError(null);
    let cards: Flashcard[] = [];

    // 1. Get Content
    if (mode === 'ai') {
        if (!topic.trim() && uploadedFiles.length === 0 && !aiContextText.trim()) {
            setError("Please provide a topic, paste terms, or upload a file.");
            return;
        }
        setLoading(true);
        try {
            const files = uploadedFiles.map(f => f.data);
            cards = await generateFlashcards(topic, files, aiContextText);
        } catch (e: any) {
            setError(e.message || "Failed to generate content.");
            setLoading(false);
            return;
        }
    } else {
        const lines = manualText.split('\n').filter(line => line.trim().length > 0);
        lines.forEach((line, idx) => {
            const delimiter = line.includes('|') ? '|' : line.includes(' - ') ? '-' : ',';
            const parts = line.split(delimiter);
            if (parts.length >= 2) {
                cards.push({
                    id: `man-${idx}`,
                    question: parts[0].trim(),
                    answer: parts.slice(1).join(delimiter).trim()
                });
            }
        });
        if (cards.length < 4) {
            setError("Please provide at least 4 valid Q&A pairs.");
            setLoading(false);
            return;
        }
    }

    setLoading(false);
    localStorage.removeItem('studygrid_save');
    onStartGame(cards, gameMode, difficulty);
  };

  const extractTextFromPPTX = async (file: File): Promise<string> => {
    try {
      const zip = new JSZip();
      const loadedZip = await zip.loadAsync(file);
      const slideFiles = Object.keys(loadedZip.files).filter(fileName => 
        fileName.startsWith('ppt/slides/slide') && fileName.endsWith('.xml')
      );
      slideFiles.sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0');
        const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0');
        return numA - numB;
      });
      let fullText = `CONTENT FROM PRESENTATION "${file.name}":\n\n`;
      for (const fileName of slideFiles) {
        const slideXml = await loadedZip.files[fileName].async('string');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(slideXml, 'text/xml');
        const textNodes = xmlDoc.getElementsByTagName('a:t');
        let slideText = '';
        for (let i = 0; i < textNodes.length; i++) {
          slideText += textNodes[i].textContent + ' ';
        }
        if (slideText.trim()) {
          const slideNum = fileName.match(/slide(\d+)\.xml/)?.[1];
          fullText += `[Slide ${slideNum}]: ${slideText.trim()}\n`;
        }
      }
      return fullText;
    } catch (e) {
      console.error("PPTX Parsing Error:", e);
      throw new Error("Could not read PowerPoint file. Ensure it is a valid .pptx.");
    }
  };

  const textToBase64 = (text: string): Promise<string> => {
    return new Promise((resolve) => {
      const blob = new Blob([text], { type: 'text/plain' });
      const reader = new FileReader();
      reader.onload = () => {
        resolve((reader.result as string).split(',')[1]);
      };
      reader.readAsDataURL(blob);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles: {name: string, type: string, data: FileAttachment}[] = [];
    const supportedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];
    const pptxType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let mimeType = file.type;
      let base64Data = '';
      let isPptx = file.name.toLowerCase().endsWith('.pptx') || file.type === pptxType;

      if (!supportedTypes.includes(file.type) && !isPptx) {
        setError(`File type '${file.type}' is not supported. Upload PDF, PPTX, or Images.`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError(`File ${file.name} is too large (max 10MB).`);
        continue;
      }

      try {
        if (isPptx) {
          const textContent = await extractTextFromPPTX(file);
          base64Data = await textToBase64(textContent);
          mimeType = 'text/plain';
        } else {
            base64Data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve((reader.result as string).split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }
        newFiles.push({
          name: file.name,
          type: isPptx ? 'pptx' : file.type,
          data: { mimeType, data: base64Data }
        });
      } catch (err: any) {
        console.error("Error reading file", err);
        setError(`Failed to read ${file.name}: ${err.message}`);
      }
    }
    setUploadedFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (newFiles.length > 0) setError(null);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-indigo-400" />;
    if (type === 'pptx') return <Presentation className="w-5 h-5 text-orange-400" />;
    return <FileIcon className="w-5 h-5 text-indigo-400" />;
  };

  return (
    <div className="max-w-4xl mx-auto w-full p-4 md:p-8 animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-purple-300 to-cyan-300 mb-4 drop-shadow-sm">
          StudyGrid
        </h1>
        <p className="text-slate-400 text-lg">
          Transform your notes into an interactive game.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Content Input */}
        <div className="lg:col-span-2 space-y-6">
            <div className="glass-panel rounded-3xl p-6 shadow-xl">
                <div className="bg-slate-900/50 rounded-2xl p-1.5 mb-6 flex">
                    <button 
                        onClick={() => setMode('ai')}
                        className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition-all font-medium ${mode === 'ai' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
                    >
                        <Sparkles className="w-4 h-4" />
                        AI Generator
                    </button>
                    <button 
                        onClick={() => setMode('manual')}
                        className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition-all font-medium ${mode === 'manual' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
                    >
                        <FileText className="w-4 h-4" />
                        Manual Entry
                    </button>
                </div>

                {mode === 'ai' ? (
                <div className="space-y-6">
                    <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                        Subject / Topic
                    </label>
                    <input 
                        type="text" 
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="e.g. Periodic Table, JavaScript ES6..."
                        className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-4 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                    />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                          Paste Notes / Terms / Vocabulary
                      </label>
                      <textarea 
                        value={aiContextText}
                        onChange={(e) => setAiContextText(e.target.value)}
                        placeholder="Paste your raw list of terms or notes here. The AI will convert them into questions."
                        className="w-full h-32 bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-4 text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none resize-none"
                      />
                    </div>

                    <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                        Reference Files (Optional)
                    </label>
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-700/50 hover:border-indigo-500/50 bg-slate-900/30 rounded-xl p-6 text-center transition-all cursor-pointer group"
                    >
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,.pptx" multiple />
                        <div className="flex flex-col items-center gap-2">
                        <UploadCloud className="w-8 h-8 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                        <p className="text-slate-400 text-sm">Drop files or <span className="text-indigo-400">browse</span></p>
                        </div>
                    </div>
                    {uploadedFiles.length > 0 && (
                        <div className="mt-4 space-y-2">
                        {uploadedFiles.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                            <div className="flex items-center gap-3 overflow-hidden min-w-0 flex-1">
                                {getFileIcon(file.type)}
                                <span className="text-sm text-slate-300 truncate">{file.name}</span>
                            </div>
                            <button onClick={() => removeFile(idx)} className="p-1 hover:bg-slate-700 rounded-full text-slate-500 hover:text-rose-400">
                                <X className="w-4 h-4" />
                            </button>
                            </div>
                        ))}
                        </div>
                    )}
                    </div>
                </div>
                ) : (
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-slate-300">
                            Manual Q&A Pairs
                        </label>
                    </div>
                    <textarea 
                        value={manualText}
                        onChange={(e) => setManualText(e.target.value)}
                        placeholder={`Question | Answer\nAnother Q - Another A`}
                        className="w-full h-64 bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-4 text-white font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none resize-none"
                    />
                    <p className="text-xs text-slate-500 mt-2">Supports delimiters: " | " or " - " (space hyphen space).</p>
                </div>
                )}
            </div>
        </div>

        {/* Right Column: Mode Selection */}
        <div className="space-y-6">
            <h3 className="text-xl font-semibold text-slate-200">Select Mode</h3>

            {savedGame && (
              <div className="animate-fade-in-up">
                 <button
                    onClick={handleResume}
                    className="w-full p-4 rounded-2xl border text-left transition-all duration-300 relative overflow-hidden group bg-emerald-600/20 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.3)] mb-4 hover:bg-emerald-600/30"
                >
                    <div className="flex items-start gap-4 relative z-10">
                        <div className="p-3 rounded-xl bg-emerald-500 text-white">
                            <RotateCcw className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="font-bold text-white">Resume Game</h4>
                            <p className="text-xs text-slate-300 mt-1">Continue your Grid Clear session</p>
                        </div>
                    </div>
                </button>
              </div>
            )}

            {/* LEARNING SECTION */}
            <div className="space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">1. Study & Refine</p>
                <button
                    onClick={() => setGameMode(GameMode.LEARN)}
                    className={`w-full p-4 rounded-2xl border text-left transition-all duration-300 relative overflow-hidden group ${
                        gameMode === GameMode.LEARN
                        ? 'bg-emerald-600/20 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.3)]' 
                        : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800 hover:border-emerald-500/30'
                    }`}
                >
                    <div className="flex items-start gap-4 relative z-10">
                        <div className={`p-3 rounded-xl ${gameMode === GameMode.LEARN ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                            <BookOpen className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className={`font-bold ${gameMode === GameMode.LEARN ? 'text-white' : 'text-slate-300'}`}>Study Mode</h4>
                            <p className="text-xs text-slate-400 mt-1">Review cards one by one until mastered.</p>
                        </div>
                    </div>
                </button>
            </div>

            {/* DIFFICULTY SELECTOR - ALWAYS VISIBLE BETWEEN SECTIONS */}
            <div className="py-4 animate-fade-in"> 
                <div className="flex items-center gap-4 mb-3 px-1">
                     <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent flex-1"></div>
                     <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Game Difficulty</h3>
                     <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent flex-1"></div>
                </div>
                
                <div className="grid grid-cols-3 gap-3 bg-slate-900/40 p-2 rounded-2xl border border-slate-800/50">
                    <button
                        onClick={() => setDifficulty(Difficulty.EASY)}
                        className={`p-2 rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-center gap-1 relative overflow-hidden ${
                            difficulty === Difficulty.EASY 
                            ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                            : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-800'
                        }`}
                    >
                        <span className="font-bold text-sm">Easy</span>
                    </button>

                    <button
                        onClick={() => setDifficulty(Difficulty.MEDIUM)}
                        className={`p-2 rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-center gap-1 relative overflow-hidden ${
                            difficulty === Difficulty.MEDIUM
                            ? 'bg-indigo-500/20 border-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]' 
                            : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-800'
                        }`}
                    >
                        <span className="font-bold text-sm">Medium</span>
                    </button>

                    <button
                        onClick={() => setDifficulty(Difficulty.HARD)}
                        className={`p-2 rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-center gap-1 relative overflow-hidden ${
                            difficulty === Difficulty.HARD
                            ? 'bg-rose-500/20 border-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.3)]' 
                            : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-800'
                        }`}
                    >
                        <span className="font-bold text-sm">Hard</span>
                    </button>
                </div>
            </div>

            {/* GAME SECTION */}
            <div className="space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1 mt-2">2. Play & Test</p>
                <div className="grid gap-3">
                    <button
                        onClick={() => setGameMode(GameMode.GRID)}
                        className={`w-full p-4 rounded-2xl border text-left transition-all duration-300 relative overflow-hidden group ${
                            gameMode === GameMode.GRID 
                            ? 'bg-indigo-600/20 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.3)]' 
                            : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800 hover:border-indigo-500/30'
                        }`}
                    >
                        <div className="flex items-start gap-4 relative z-10">
                            <div className={`p-2 rounded-lg ${gameMode === GameMode.GRID ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                                <Grid className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className={`font-bold text-sm ${gameMode === GameMode.GRID ? 'text-white' : 'text-slate-300'}`}>Grid Clear</h4>
                                <p className="text-xs text-slate-400 mt-1">Clear tiles by typing correct answers.</p>
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={() => setGameMode(GameMode.MEMORY)}
                        className={`w-full p-4 rounded-2xl border text-left transition-all duration-300 relative overflow-hidden group ${
                            gameMode === GameMode.MEMORY 
                            ? 'bg-purple-600/20 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.3)]' 
                            : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800 hover:border-purple-500/30'
                        }`}
                    >
                        <div className="flex items-start gap-4 relative z-10">
                            <div className={`p-2 rounded-lg ${gameMode === GameMode.MEMORY ? 'bg-purple-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                                <Brain className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className={`font-bold text-sm ${gameMode === GameMode.MEMORY ? 'text-white' : 'text-slate-300'}`}>Memory</h4>
                                <p className="text-xs text-slate-400 mt-1">Match questions to their answers.</p>
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={() => setGameMode(GameMode.QUIZ)}
                        className={`w-full p-4 rounded-2xl border text-left transition-all duration-300 relative overflow-hidden group ${
                            gameMode === GameMode.QUIZ 
                            ? 'bg-cyan-600/20 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.3)]' 
                            : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800 hover:border-cyan-500/30'
                        }`}
                    >
                        <div className="flex items-start gap-4 relative z-10">
                            <div className={`p-2 rounded-lg ${gameMode === GameMode.QUIZ ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                                <Zap className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className={`font-bold text-sm ${gameMode === GameMode.QUIZ ? 'text-white' : 'text-slate-300'}`}>Speed Quiz</h4>
                                <p className="text-xs text-slate-400 mt-1">Fast-paced multiple choice challenge.</p>
                            </div>
                        </div>
                    </button>
                </div>
            </div>

            {error && (
              <div className="bg-rose-950/30 border border-rose-500/30 text-rose-300 p-4 rounded-xl flex items-center gap-3 animate-fade-in text-sm mt-4">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button onClick={handleStart} isLoading={loading} className="w-full py-4 text-lg shadow-xl shadow-indigo-900/20 mt-6">
              <Play className="w-5 h-5" />
              {gameMode === GameMode.LEARN ? 'Start Studying' : 'Start Game'}
            </Button>
            <p className="text-center text-xs text-slate-500 mt-2">Powered by Google Gemini</p>
        </div>
      </div>
    </div>
  );
};