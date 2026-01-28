import React, { useState } from 'react';
import { SetupScreen } from './components/SetupScreen';
import { GameScreen } from './components/GameScreen';
import { Flashcard, GameStatus, GameMode, GridCell, GameState } from './types';

function App() {
  const [status, setStatus] = useState<GameStatus>(GameStatus.SETUP);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.GRID);
  
  // State for restoring a session
  const [restoredGrid, setRestoredGrid] = useState<GridCell[] | undefined>(undefined);
  const [restoredGameState, setRestoredGameState] = useState<GameState | undefined>(undefined);

  const handleStartGame = (newCards: Flashcard[], mode: GameMode, savedGrid?: GridCell[], savedGameState?: GameState) => {
    setCards(newCards);
    setGameMode(mode);
    setRestoredGrid(savedGrid);
    setRestoredGameState(savedGameState);
    setStatus(GameStatus.PLAYING);
  };

  const handleExit = () => {
    setStatus(GameStatus.SETUP);
    setCards([]);
    setRestoredGrid(undefined);
    setRestoredGameState(undefined);
  };

  return (
    <div className="min-h-screen text-slate-50 flex items-center justify-center overflow-x-hidden">
      {/* Noise texture overlay */}
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none z-0"></div>
      
      <div className="relative z-10 w-full h-full">
        {status === GameStatus.SETUP ? (
            <SetupScreen onStartGame={handleStartGame} />
        ) : (
            <GameScreen 
              cards={cards} 
              mode={gameMode} 
              onExit={handleExit} 
              initialGrid={restoredGrid}
              initialGameState={restoredGameState}
            />
        )}
      </div>
    </div>
  );
}

export default App;