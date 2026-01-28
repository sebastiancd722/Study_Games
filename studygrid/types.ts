
export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  distractors?: string[];
}

export enum GameStatus {
  SETUP = 'SETUP',
  PLAYING = 'PLAYING',
  WON = 'WON',
  LOST = 'LOST'
}

export enum GameMode {
  GRID = 'GRID',
  MEMORY = 'MEMORY',
  QUIZ = 'QUIZ',
  LEARN = 'LEARN'
}

export interface GridCell {
  id: string;
  flashcardId: string;
  isCleared: boolean;
  isRevealed: boolean;
  type?: 'QUESTION' | 'ANSWER'; // For Memory game differentiation
  content?: string; // Cache content for display
}

export interface GameState {
  score: number;
  streak: number;
  maxStreak: number;
  cellsCleared: number; // or Questions Answered
  totalCells: number; // or Total Questions
}

export interface SavedGameData {
  cards: Flashcard[];
  mode: GameMode;
  grid: GridCell[];
  gameState: GameState;
  timestamp: number;
}