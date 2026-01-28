import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Flashcard, GameStatus, GridCell, GameState, GameMode, Difficulty } from '../../types';
import { validateAnswer } from '../../services/geminiService';
import { shuffleArray } from '../../utils/helpers';
import { Button } from '../Button';
import { Trophy, Flame, HelpCircle } from 'lucide-react';
import canvasConfetti from 'canvas-confetti';

interface GridGameProps {
  cards: Flashcard[];
  difficulty: Difficulty;
  onExit: () => void;
  initialGrid?: GridCell[];
  initialGameState?: GameState;
}

export const GridGame: React.FC<GridGameProps> = ({ cards, difficulty, onExit, initialGrid, initialGameState }) => {
  const [status, setStatus] = useState<GameStatus>(GameStatus.PLAYING);
  const [grid, setGrid] = useState<GridCell[]>([]);
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    streak: 0,
    maxStreak: 0,
    cellsCleared: 0,
    totalCells: 16
  });

  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [isGrading, setIsGrading] = useState(false);
  const [gradingResult, setGradingResult] = useState<{score: number, feedback: string} | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!cards || cards.length === 0) return;

    if (initialGrid && initialGameState) {
      setGrid(initialGrid);
      setGameState(initialGameState);
    } else {
      // Determine Grid Size based on Difficulty
      let gridSize = 16;
      if (difficulty === Difficulty.EASY) gridSize = 12; // 4x3
      if (difficulty === Difficulty.HARD) gridSize = 20; // 4x5

      const newGrid: GridCell[] = [];
      for (let i = 0; i < gridSize; i++) {
        const card = cards[i % cards.length];
        newGrid.push({
          id: `cell-${i}`,
          flashcardId: card.id,
          isCleared: false,
          isRevealed: false
        });
      }
      // Simple shuffle if helper not available, or assume shuffleArray exists (I'll add it inline if needed, but assuming user has helpers)
      // Since helper import is there, I assume it works. If not, I'll use inline sort.
      newGrid.sort(() => Math.random() - 0.5);
      
      setGrid(newGrid);
      setGameState(prev => ({ ...prev, totalCells: gridSize }));
    }
  }, [cards, initialGrid, initialGameState, difficulty]);

  useEffect(() => {
    if (grid.length > 0 && status === GameStatus.PLAYING) {
      const saveData = {
        cards,
        mode: GameMode.GRID,
        difficulty,
        grid,
        gameState,
        timestamp: Date.now()
      };
      localStorage.setItem('studygrid_save', JSON.stringify(saveData));
    }
  }, [grid, gameState, status, cards, difficulty]);

  useEffect(() => {
    if (gameState.cellsCleared === gameState.totalCells && gameState.totalCells > 0) {
      setStatus(GameStatus.WON);
      canvasConfetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#6366f1', '#a855f7', '#ec4899'] });
      localStorage.removeItem('studygrid_save');
    }
  }, [gameState.cellsCleared, gameState.totalCells]);

  const handleClearSaveAndExit = () => {
    localStorage.removeItem('studygrid_save');
    onExit();
  };

  useEffect(() => {
    if (activeCellId && !gradingResult && !isClosing) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [activeCellId, gradingResult, isClosing]);

  const activeCard = useMemo(() => {
    if (!activeCellId) return null;
    const cell = grid.find(c => c.id === activeCellId);
    return cards.find(c => c.id === cell?.flashcardId);
  }, [activeCellId, grid, cards]);

  const handleCellClick = (id: string) => {
    if (status !== GameStatus.PLAYING) return;
    const cell = grid.find(c => c.id === id);
    if (!cell || cell.isCleared) return;
    
    setUserAnswer('');
    setGradingResult(null);
    setIsGrading(false);
    setIsClosing(false);
    setActiveCellId(id);
  };

  const handleSubmitAnswer = async () => {
    if (!activeCard || !userAnswer.trim()) return;
    
    setIsGrading(true);
    try {
      const result = await validateAnswer(activeCard.question, activeCard.answer, userAnswer);
      setGradingResult(result);
    } catch (e) {
      setGradingResult({ score: 0, feedback: "Connection failed." });
    } finally {
      setIsGrading(false);
    }
  };

  const handleGiveUp = () => {
    if (!activeCard) return;
    setGradingResult({ 
        score: 0,
        feedback: `The correct answer was: ${activeCard.answer}` 
    });
  };

  const closeAndApplyResult = () => {
    if (!activeCellId || !gradingResult) return;

    setIsClosing(true);

    timerRef.current = setTimeout(() => {
        // Scoring strictness could be added here based on difficulty too
        if (gradingResult.score >= 50) {
          setGrid(prev => prev.map(cell => cell.id === activeCellId ? { ...cell, isCleared: true } : cell));
          
          const isFullMarks = gradingResult.score >= 75;
          const pointsBase = isFullMarks ? 100 : 50;
    
          setGameState(prev => {
            const newStreak = prev.streak + 1;
            return {
              ...prev,
              score: prev.score + (pointsBase * newStreak),
              streak: newStreak,
              maxStreak: Math.max(prev.maxStreak, newStreak),
              cellsCleared: prev.cellsCleared + 1
            };
          });
        } else {
          setGameState(prev => ({ ...prev, streak: 0 }));
        }
        
        setActiveCellId(null);
        setGradingResult(null);
        setIsClosing(false);
    }, 250);
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-green-400 border-green-500 bg-green-500/20';
    if (score >= 50) return 'text-orange-400 border-orange-500 bg-orange-500/20';
    return 'text-rose-400 border-rose-500 bg-rose-500/20';
  };

  const getScoreTitle = (score: number) => {
    if (score >= 75) return 'Correct';
    if (score >= 50) return 'Partial Credit';
    return 'Incorrect';
  };

  if (status === GameStatus.WON) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 animate-fade-in">
        <div className="bg-indigo-500/20 p-8 rounded-full mb-6 ring-4 ring-indigo-500/30 animate-pop-in">
          <Trophy className="w-24 h-24 text-yellow-400 drop-shadow-lg" />
        </div>
        <h2 className="text-5xl font-bold text-white mb-2 tracking-tight">Grid Cleared!</h2>
        <p className="text-xl text-slate-300 mb-8">Score: <span className="text-indigo-400 font-mono font-bold">{gameState.score}</span></p>
        <div className="flex gap-4">
          <Button onClick={handleClearSaveAndExit} variant="secondary">Menu</Button>
          <Button onClick={() => {
            localStorage.removeItem('studygrid_save');
            window.location.reload();
          }}>Play Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4 flex flex-col h-full">
      <header className="flex items-center justify-between mb-6 glass-panel rounded-2xl p-4 transition-all duration-300">
        <div className="flex gap-8 w-full justify-between items-center">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <span className="font-mono text-xl font-bold">{gameState.score}</span>
          </div>
          <div className="flex-1 mx-8 bg-slate-700/50 h-3 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(99,102,241,0.5)]" style={{ width: `${(gameState.cellsCleared / gameState.totalCells) * 100}%` }} />
          </div>
          <div className="flex items-center gap-2">
            <Flame className={`w-5 h-5 transition-all duration-300 ${gameState.streak > 1 ? 'text-orange-500 scale-110' : 'text-slate-600'}`} />
            <span className="font-mono text-xl font-bold">{gameState.streak}x</span>
          </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-4 gap-3 sm:gap-4 content-center relative perspective-1000">
        {grid.map((cell, index) => (
          <button
            key={cell.id}
            onClick={() => handleCellClick(cell.id)}
            disabled={cell.isCleared}
            style={{ 
              animationDelay: `${index * 0.05}s`,
              animationFillMode: 'forwards'
            }}
            className={`
              aspect-square rounded-2xl relative group outline-none
              ${cell.isCleared 
                ? 'animate-cell-clear pointer-events-none'
                : 'animate-grid-entry bg-indigo-600 hover:bg-indigo-500 active:scale-95 shadow-lg shadow-indigo-900/40 border-b-4 border-indigo-800 hover:border-indigo-700 hover:-translate-y-1 active:translate-y-0 active:border-b-0 z-10 transition-all duration-200'
              }
            `}
          >
            <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${cell.isCleared ? 'opacity-0' : 'opacity-100'}`}>
                 <span className="text-indigo-200/40 font-bold text-4xl group-hover:text-white transition-colors duration-300">?</span>
            </div>
          </button>
        ))}
      </div>

      {activeCellId && activeCard && (
        <div 
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
            style={{ animationDuration: '0.3s' }}
        >
          <div className={`glass-panel w-full max-w-lg rounded-3xl p-8 shadow-2xl border border-slate-700/50 ${isClosing ? 'animate-modal-exit' : 'animate-modal-pop'}`}>
            <div className="text-center mb-6">
              <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">Question</h3>
              <p className="text-2xl font-medium text-white leading-relaxed">{activeCard.question}</p>
            </div>

            {!gradingResult ? (
              <div className="space-y-4 animate-fade-in-up">
                <textarea 
                  ref={inputRef}
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  className="w-full bg-slate-800/50 border border-slate-600 rounded-xl p-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none h-32 transition-all duration-300 focus:bg-slate-800"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitAnswer();
                    }
                  }}
                />
                <div className="flex gap-3">
                  <Button 
                    variant="secondary" 
                    onClick={handleGiveUp}
                    className="flex-1"
                    disabled={isGrading}
                  >
                    <HelpCircle className="w-4 h-4" />
                    Give Up
                  </Button>
                  <Button 
                    onClick={handleSubmitAnswer} 
                    isLoading={isGrading} 
                    disabled={!userAnswer.trim()}
                    className="flex-[2]"
                  >
                    Submit Answer
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center animate-pop-in">
                <div className={`rounded-xl p-6 mb-6 border-2 transition-all duration-500 ${getScoreColor(gradingResult.score)}`}>
                  
                  <div className="flex flex-col items-center justify-center mb-4">
                    <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center mb-2 transform transition-transform hover:scale-110 ${
                        gradingResult.score >= 75 ? 'border-green-400' : gradingResult.score >= 50 ? 'border-orange-400' : 'border-rose-400'
                    }`}>
                        <span className="text-3xl font-bold font-mono">{gradingResult.score}</span>
                    </div>
                    <h3 className="text-xl font-bold tracking-wide uppercase">
                        {getScoreTitle(gradingResult.score)}
                    </h3>
                  </div>

                  <p className="text-slate-200 text-lg mb-2 italic">"{gradingResult.feedback}"</p>
                  
                  {gradingResult.score < 75 && (
                     <div className="mt-4 pt-4 border-t border-white/10">
                        <p className="text-xs text-slate-400 uppercase font-bold mb-1">Correct Answer</p>
                        <p className="text-white">{activeCard.answer}</p>
                     </div>
                  )}
                </div>
                
                <Button 
                    onClick={closeAndApplyResult} 
                    className="w-full py-3" 
                    variant={gradingResult.score >= 50 ? 'primary' : 'secondary'}
                >
                  {gradingResult.score >= 50 ? 'Continue' : 'Try Again Later'}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};