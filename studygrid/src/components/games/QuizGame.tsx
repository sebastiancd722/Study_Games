import React, { useState, useEffect, useRef } from 'react';
import { Flashcard, Difficulty } from '../../types';
import { generateVariation } from '../../services/geminiService';
import { Button } from '../Button';
import { Trophy, Check, X, Loader2, RefreshCw, Clock } from 'lucide-react';
import canvasConfetti from 'canvas-confetti';

interface QuizGameProps {
  cards: Flashcard[];
  difficulty: Difficulty;
  onExit: () => void;
}

export const QuizGame: React.FC<QuizGameProps> = ({ cards, difficulty, onExit }) => {
  const [deck, setDeck] = useState<Flashcard[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  
  const [answered, setAnswered] = useState<boolean>(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [finished, setFinished] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [addedCardsCount, setAddedCardsCount] = useState(0);
  
  // Timer State for Hard/Difficult mode
  const [timeLeft, setTimeLeft] = useState<number>(15);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer ref for cleanup on unmount
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    // Initialize deck
    setDeck([...cards]);
    return () => {
        isMountedRef.current = false;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [cards]);

  // Handle Timer for Difficult Mode
  useEffect(() => {
    if (difficulty === Difficulty.HARD && !answered && !isRegenerating && !finished && deck.length > 0) {
        setTimeLeft(15); // Reset to 15s per question
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        
        timerIntervalRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                    handleTimeOut();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }
    return () => {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  }, [currentIdx, difficulty, answered, isRegenerating, finished]);

  useEffect(() => {
    if (deck.length > 0 && currentIdx < deck.length) {
      generateOptions();
    } else if (deck.length > 0 && currentIdx >= deck.length) {
      if (!isRegenerating) {
        setFinished(true);
        canvasConfetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      }
    }
  }, [currentIdx, deck.length]); 

  const handleTimeOut = () => {
    if (answered) return;
    setAnswered(true);
    setIsCorrect(false);
    // Treat as wrong answer
    setIsRegenerating(true);
    // Simulate flow
    handleOptionClick(null);
  };

  const generateOptions = () => {
    const currentCard = deck[currentIdx];
    let allOptions: string[] = [];

    // Easy: 1 distractor (2 options)
    // Hard/Medium: 3 distractors (4 options)
    const distractorCount = difficulty === Difficulty.EASY ? 1 : 3;

    if (currentCard.distractors && currentCard.distractors.length > 0) {
      const distractors = currentCard.distractors.slice(0, distractorCount);
      allOptions = [currentCard.answer, ...distractors];
    } else {
      const otherAnswers = cards.filter(c => c.id !== currentCard.id).map(c => c.answer);
      // Simple shuffle
      otherAnswers.sort(() => Math.random() - 0.5);
      
      const selectedDistractors = otherAnswers.slice(0, distractorCount);
      
      while (selectedDistractors.length < distractorCount && cards.length > 1) {
          const randomCard = cards[Math.floor(Math.random() * cards.length)];
          if (randomCard.id !== currentCard.id) {
              selectedDistractors.push(randomCard.answer);
          }
      }
      allOptions = [currentCard.answer, ...selectedDistractors];
    }
    
    // Shuffle options
    allOptions.sort(() => Math.random() - 0.5);
    setOptions(allOptions);
    setAnswered(false);
    setSelectedOption(null);
  };

  const handleOptionClick = async (option: string | null) => {
    // If option is null, it's a timeout
    if (answered && option !== null) return;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    
    const currentCard = deck[currentIdx];
    const correct = option === currentCard.answer;
    
    setAnswered(true);
    if (option) setSelectedOption(option);
    setIsCorrect(correct);
    
    if (correct) {
      setScore(s => s + 100);
      timeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) setCurrentIdx(prev => prev + 1);
      }, 1500);
    } else {
      setIsRegenerating(true);
      
      try {
        const newCard = await generateVariation(currentCard);
        
        if (isMountedRef.current) {
            setDeck(prev => [...prev, newCard]);
            setAddedCardsCount(prev => prev + 1);
            
            timeoutRef.current = setTimeout(() => {
              if (isMountedRef.current) {
                  setIsRegenerating(false);
                  setCurrentIdx(prev => prev + 1);
              }
            }, 2000);
        }
      } catch (e) {
        console.error("Failed to regenerate", e);
        if (isMountedRef.current) {
            setIsRegenerating(false);
            timeoutRef.current = setTimeout(() => {
                if (isMountedRef.current) setCurrentIdx(prev => prev + 1);
            }, 1500);
        }
      }
    }
  };

  if (finished) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 animate-fade-in">
        <Trophy className="w-24 h-24 text-cyan-400 mb-6 drop-shadow-lg" />
        <h2 className="text-4xl font-bold text-white mb-2">Quiz Complete!</h2>
        <p className="text-xl text-slate-300 mb-2">Score: <span className="text-cyan-400 font-bold">{score}</span></p>
        
        {addedCardsCount > 0 && (
            <div className="bg-slate-800/50 p-4 rounded-xl mb-8 border border-slate-700">
                <p className="text-sm text-slate-400">
                    <RefreshCw className="w-4 h-4 inline mr-2 text-indigo-400"/>
                    You mastered <strong>{addedCardsCount}</strong> adaptive variations of questions you initially missed.
                </p>
            </div>
        )}

        <div className="flex gap-4">
          <Button onClick={onExit} variant="secondary">Menu</Button>
          <Button onClick={() => window.location.reload()}>Play Again</Button>
        </div>
      </div>
    );
  }

  if (deck.length === 0) return null;
  const currentCard = deck[currentIdx];
  const progress = ((currentIdx) / deck.length) * 100;

  return (
    <div className="w-full max-w-2xl mx-auto p-4 flex flex-col h-full justify-center">
      <div className="glass-panel rounded-3xl p-8 shadow-2xl relative overflow-hidden transition-all duration-500">
        <div className="absolute top-0 left-0 w-full h-1 bg-slate-800">
            <div className="h-full bg-cyan-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
        </div>

        <div className="mb-8 text-center mt-4">
          <div className="flex items-center justify-between mb-4">
            <span className="inline-block px-3 py-1 rounded-full bg-slate-800 text-slate-400 text-xs font-bold border border-slate-700">
                Question {currentIdx + 1} / {deck.length}
            </span>
            
            {difficulty === Difficulty.HARD && (
                <span className={`flex items-center gap-2 text-xs font-bold border px-2 py-1 rounded-full ${timeLeft <= 5 ? 'text-rose-400 border-rose-500' : 'text-slate-300 border-slate-600'}`}>
                    <Clock className="w-3 h-3" /> {timeLeft}s
                </span>
            )}

            {isRegenerating && (
                <span className="flex items-center gap-2 text-xs text-indigo-400 font-medium animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Generating variation...
                </span>
            )}
          </div>
          
          <h2 className="text-2xl font-bold text-white leading-relaxed animate-fade-in">
            {currentCard?.question}
          </h2>
        </div>

        <div className="space-y-3">
          {options.map((option, idx) => {
            let stateClass = "bg-slate-800/50 hover:bg-slate-700 border-slate-700";
            if (answered) {
              if (option === currentCard.answer) stateClass = "bg-green-500/20 border-green-500 text-green-200";
              else if (option === selectedOption) stateClass = "bg-rose-500/20 border-rose-500 text-rose-200";
              else stateClass = "opacity-50 border-transparent";
            } else if (selectedOption === option) {
                stateClass = "bg-cyan-600 border-cyan-500";
            }

            return (
              <button
                key={`${currentIdx}-${idx}`}
                onClick={() => handleOptionClick(option)}
                disabled={answered || isRegenerating}
                className={`w-full p-4 rounded-xl border text-left transition-all duration-200 flex items-center justify-between group ${stateClass}`}
              >
                <span className="text-sm md:text-base font-medium">{option}</span>
                {answered && option === currentCard.answer && <Check className="w-5 h-5 text-green-400" />}
                {answered && option === selectedOption && option !== currentCard.answer && <X className="w-5 h-5 text-rose-400" />}
              </button>
            );
          })}
        </div>

        {answered && !isCorrect && (
           <div className="mt-6 p-3 bg-indigo-900/20 border border-indigo-500/30 rounded-lg flex items-center justify-center gap-2 text-indigo-300 text-sm animate-fade-in">
              <RefreshCw className="w-4 h-4" />
              <span>Adaptive Mode: Adding a new variation of this question to the end...</span>
           </div>
        )}

        <div className="mt-6 flex justify-between items-center text-sm text-slate-500 font-mono">
            <span>Score: {score}</span>
        </div>
      </div>
    </div>
  );
};