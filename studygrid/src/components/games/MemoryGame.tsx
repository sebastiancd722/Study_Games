import React, { useState, useEffect, useRef } from 'react';
import { Flashcard, GameStatus, GridCell, GameState, Difficulty } from '../../types';
import { Button } from '../Button';
import { Trophy } from 'lucide-react';
import canvasConfetti from 'canvas-confetti';

interface MemoryGameProps {
  cards: Flashcard[];
  difficulty: Difficulty;
  onExit: () => void;
}

export const MemoryGame: React.FC<MemoryGameProps> = ({ cards, difficulty, onExit }) => {
  const [grid, setGrid] = useState<GridCell[]>([]);
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    streak: 0,
    maxStreak: 0,
    cellsCleared: 0,
    totalCells: 0
  });
  
  const [selectedCells, setSelectedCells] = useState<GridCell[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.PLAYING);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    // Determine pair count based on difficulty
    let pairCount = 8;
    if (difficulty === Difficulty.EASY) pairCount = 6;
    if (difficulty === Difficulty.HARD) pairCount = 10;

    // Take pairs
    const playCards = cards.slice(0, pairCount);
    const newGrid: GridCell[] = [];
    
    playCards.forEach((card, idx) => {
      // Question Card
      newGrid.push({
        id: `q-${idx}`,
        flashcardId: card.id,
        isCleared: false,
        isRevealed: false,
        type: 'QUESTION',
        content: card.question
      });
      // Answer Card
      newGrid.push({
        id: `a-${idx}`,
        flashcardId: card.id,
        isCleared: false,
        isRevealed: false,
        type: 'ANSWER',
        content: card.answer
      });
    });

    newGrid.sort(() => Math.random() - 0.5);
    setGrid(newGrid);
    setGameState(prev => ({ ...prev, totalCells: newGrid.length }));
  }, [cards, difficulty]);

  useEffect(() => {
    if (gameState.cellsCleared === gameState.totalCells && gameState.totalCells > 0) {
      setGameStatus(GameStatus.WON);
      canvasConfetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#a855f7', '#ec4899'] });
    }
  }, [gameState.cellsCleared, gameState.totalCells]);

  const handleCardClick = (cell: GridCell) => {
    if (isProcessing || cell.isRevealed || cell.isCleared) return;

    // Reveal card
    const newGrid = grid.map(c => c.id === cell.id ? { ...c, isRevealed: true } : c);
    setGrid(newGrid);
    
    const newSelected = [...selectedCells, cell];
    setSelectedCells(newSelected);

    if (newSelected.length === 2) {
      setIsProcessing(true);
      checkMatch(newSelected[0], newSelected[1], newGrid);
    }
  };

  const checkMatch = (cell1: GridCell, cell2: GridCell, currentGrid: GridCell[]) => {
    const isMatch = cell1.flashcardId === cell2.flashcardId;

    timerRef.current = setTimeout(() => {
      if (isMatch) {
        setGrid(prev => prev.map(c => 
          c.id === cell1.id || c.id === cell2.id 
          ? { ...c, isCleared: true, isRevealed: false } 
          : c
        ));
        setGameState(prev => ({
          ...prev,
          score: prev.score + 200 + (prev.streak * 50),
          streak: prev.streak + 1,
          cellsCleared: prev.cellsCleared + 2
        }));
      } else {
        setGrid(prev => prev.map(c => 
          c.id === cell1.id || c.id === cell2.id 
          ? { ...c, isRevealed: false } 
          : c
        ));
        setGameState(prev => ({ ...prev, streak: 0 }));
      }
      setSelectedCells([]);
      setIsProcessing(false);
    }, 1000);
  };

  if (gameStatus === GameStatus.WON) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 animate-fade-in">
        <Trophy className="w-24 h-24 text-purple-400 mb-6 drop-shadow-lg" />
        <h2 className="text-4xl font-bold text-white mb-2">Memory Master!</h2>
        <p className="text-xl text-slate-300 mb-8">Score: <span className="text-purple-400 font-bold">{gameState.score}</span></p>
        <div className="flex gap-4">
          <Button onClick={onExit} variant="secondary">Menu</Button>
          <Button onClick={() => window.location.reload()}>Play Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4 flex flex-col h-full">
      <header className="flex justify-between items-center mb-6 glass-panel rounded-2xl p-4">
        <div className="font-mono text-xl text-purple-400 font-bold">Score: {gameState.score}</div>
        <div className="text-slate-400">Find the Pairs</div>
      </header>
      
      <div className="flex-1 grid grid-cols-4 gap-3 md:gap-4 content-center">
        {grid.map((cell) => (
          <button
            key={cell.id}
            onClick={() => handleCardClick(cell)}
            disabled={cell.isCleared || cell.isRevealed}
            className={`
              aspect-square rounded-xl transition-all duration-500 transform perspective-1000 relative
              ${cell.isCleared ? 'opacity-0 pointer-events-none' : ''}
            `}
          >
            <div className={`w-full h-full transition-transform duration-500 transform-style-3d ${cell.isRevealed ? 'rotate-y-180' : ''} relative`}>
                <div className="absolute inset-0 backface-hidden bg-slate-800 border-2 border-slate-700 rounded-xl flex items-center justify-center hover:border-purple-500/50 transition-colors shadow-lg">
                    <span className="text-purple-500/30 text-3xl font-bold">?</span>
                </div>
                <div className="absolute inset-0 backface-hidden rotate-y-180 bg-purple-900/80 border-2 border-purple-500 rounded-xl flex items-center justify-center p-2 shadow-[0_0_15px_rgba(168,85,247,0.4)]">
                    <span className="text-xs md:text-sm text-white font-medium text-center line-clamp-4 leading-tight">
                        {cell.content}
                    </span>
                </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};