import React, { useState, useEffect } from 'react';
import { Flashcard } from '../../types';
import { Button } from '../Button';
import { BookOpen, RotateCw, CheckCircle, XCircle, ChevronRight, GraduationCap } from 'lucide-react';
import canvasConfetti from 'canvas-confetti';

interface LearnGameProps {
  cards: Flashcard[];
  onExit: () => void;
}

export const LearnGame: React.FC<LearnGameProps> = ({ cards, onExit }) => {
  // Queue of cards to study. Incorrect cards get pushed to the back.
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [masteredCount, setMasteredCount] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);

  useEffect(() => {
    setQueue([...cards]);
  }, [cards]);

  const currentCard = queue[0];
  const progress = cards.length > 0 ? (masteredCount / cards.length) * 100 : 0;

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNext = (mastered: boolean) => {
    setDirection(mastered ? 'right' : 'left');
    
    setTimeout(() => {
      setIsFlipped(false);
      
      if (mastered) {
        setMasteredCount(prev => prev + 1);
        const newQueue = queue.slice(1);
        if (newQueue.length === 0) {
          setIsFinished(true);
          canvasConfetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
        } else {
          setQueue(newQueue);
        }
      } else {
        // Move current card to the end of the queue for review
        const current = queue[0];
        const newQueue = [...queue.slice(1), current];
        setQueue(newQueue);
      }
      
      setDirection(null);
    }, 300);
  };

  if (!currentCard || isFinished) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 animate-fade-in">
        <div className="bg-emerald-500/20 p-8 rounded-full mb-6 ring-4 ring-emerald-500/30 animate-pop-in">
          <GraduationCap className="w-24 h-24 text-emerald-400 drop-shadow-lg" />
        </div>
        <h2 className="text-4xl font-bold text-white mb-2">Knowledge Refined!</h2>
        <p className="text-xl text-slate-300 mb-8 max-w-md">
            You've reviewed and mastered all <span className="text-emerald-400 font-bold">{cards.length}</span> cards.
            <br/>Now you're ready for the Game Modes.
        </p>
        <div className="flex gap-4">
          <Button onClick={onExit} variant="primary">Return to Menu</Button>
          <Button onClick={() => {
            setQueue([...cards]);
            setMasteredCount(0);
            setIsFinished(false);
          }} variant="secondary">Study Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-4 flex flex-col h-full justify-center">
      {/* Progress Header */}
      <div className="glass-panel rounded-2xl p-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            <span className="text-slate-300 font-medium">Study Session</span>
        </div>
        <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">
                {masteredCount} / {cards.length} Mastered
            </span>
            <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-emerald-500 transition-all duration-500" 
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
      </div>

      {/* Card Container */}
      <div className="relative perspective-1000 w-full aspect-[4/3] md:aspect-[16/9] mb-8 group cursor-pointer" onClick={handleFlip}>
        <div 
            className={`
                w-full h-full relative transition-all duration-500 transform-style-3d
                ${isFlipped ? 'rotate-y-180' : ''}
                ${direction === 'left' ? '-translate-x-full opacity-0' : ''}
                ${direction === 'right' ? 'translate-x-full opacity-0' : ''}
            `}
            style={{ transformStyle: 'preserve-3d' }}
        >
            {/* Front */}
            <div className="absolute inset-0 backface-hidden bg-slate-800 border-2 border-slate-700 rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-2xl group-hover:border-indigo-500/50 transition-colors">
                <span className="text-indigo-400 font-bold text-sm tracking-widest uppercase mb-4">Question</span>
                <h3 className="text-2xl md:text-3xl font-bold text-white leading-relaxed">
                    {currentCard.question}
                </h3>
                <p className="absolute bottom-8 text-slate-500 text-sm flex items-center gap-2">
                    <RotateCw className="w-4 h-4" /> Click to reveal answer
                </p>
            </div>

            {/* Back */}
            <div 
                className="absolute inset-0 backface-hidden rotate-y-180 bg-slate-800 border-2 border-emerald-900/50 rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-2xl"
                style={{ transform: 'rotateY(180deg)' }}
            >
                <span className="text-emerald-400 font-bold text-sm tracking-widest uppercase mb-4">Answer</span>
                <p className="text-xl md:text-2xl text-slate-100 leading-relaxed">
                    {currentCard.answer}
                </p>
            </div>
        </div>
      </div>

      {/* Controls */}
      <div className={`grid grid-cols-2 gap-4 transition-opacity duration-300 ${isFlipped ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <button 
            onClick={(e) => { e.stopPropagation(); handleNext(false); }}
            className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-800 border border-slate-700 hover:bg-rose-900/20 hover:border-rose-500/50 hover:text-rose-200 transition-all group"
        >
            <RotateCw className="w-6 h-6 mb-2 text-rose-500 group-hover:scale-110 transition-transform" />
            <span className="font-bold text-slate-300 group-hover:text-rose-200">Needs Review</span>
            <span className="text-xs text-slate-500 mt-1">Keep in rotation</span>
        </button>

        <button 
            onClick={(e) => { e.stopPropagation(); handleNext(true); }}
            className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-800 border border-slate-700 hover:bg-emerald-900/20 hover:border-emerald-500/50 hover:text-emerald-200 transition-all group"
        >
            <CheckCircle className="w-6 h-6 mb-2 text-emerald-500 group-hover:scale-110 transition-transform" />
            <span className="font-bold text-slate-300 group-hover:text-emerald-200">Got it!</span>
            <span className="text-xs text-slate-500 mt-1">Mark as mastered</span>
        </button>
      </div>

      {/* Helper text if not flipped */}
      <div className={`text-center transition-opacity duration-300 ${!isFlipped ? 'opacity-100' : 'opacity-0 pointer-events-none'} -mt-16`}>
         <Button onClick={handleFlip} variant="secondary" className="px-8">Show Answer</Button>
      </div>

      {/* Custom Styles for 3D Transform utility classes if not provided by Tailwind config */}
      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
    </div>
  );
};