import React from 'react';
import { Flashcard, GameMode, GridCell, GameState } from '../types';
import { Button } from './Button';
import { ArrowLeft } from 'lucide-react';
import { GridGame } from './games/GridGame';
import { MemoryGame } from './games/MemoryGame';
import { QuizGame } from './games/QuizGame';
import { LearnGame } from './games/LearnGame';

interface GameScreenProps {
  cards: Flashcard[];
  mode: GameMode;
  onExit: () => void;
  initialGrid?: GridCell[];
  initialGameState?: GameState;
}

export const GameScreen: React.FC<GameScreenProps> = ({ cards, mode, onExit, initialGrid, initialGameState }) => {
  
  if (!cards || cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p className="text-slate-400 mb-4">No cards available.</p>
        <Button onClick={onExit}>Back</Button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-screen flex flex-col">
        {/* Shared Top Bar if needed, currently individual games handle headers */}
        <div className="absolute top-4 left-4 z-40">
             <button 
                onClick={onExit} 
                className="p-2 bg-slate-800/50 backdrop-blur-sm rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition border border-slate-700/50"
            >
                <ArrowLeft className="w-6 h-6" />
            </button>
        </div>

        {mode === GameMode.GRID && (
          <GridGame 
            cards={cards} 
            onExit={onExit} 
            initialGrid={initialGrid}
            initialGameState={initialGameState}
          />
        )}
        {mode === GameMode.MEMORY && <MemoryGame cards={cards} onExit={onExit} />}
        {mode === GameMode.QUIZ && <QuizGame cards={cards} onExit={onExit} />}
        {mode === GameMode.LEARN && <LearnGame cards={cards} onExit={onExit} />}
    </div>
  );
};