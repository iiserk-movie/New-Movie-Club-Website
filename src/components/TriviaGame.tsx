import React, { useState, useEffect } from 'react';
import { 
  Award, RefreshCw, HelpCircle, CheckCircle, XCircle, Sparkles, 
  Lightbulb, GraduationCap, Flame, Star, Trophy
} from 'lucide-react';
import { TriviaQuestion } from '../types';
import { triviaQuestions } from '../initialData';

export default function TriviaGame() {
  const [questions, setQuestions] = useState<TriviaQuestion[]>(triviaQuestions);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [highestScore, setHighestScore] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);

  useEffect(() => {
    // Load highest score from localStorage
    const saved = localStorage.getItem('iiser_movie_highest_score');
    if (saved) {
      setHighestScore(Number(saved));
    }
  }, []);

  const handleOptionClick = (optionIdx: number) => {
    if (isAnswered) return;
    
    setSelectedOption(optionIdx);
    setIsAnswered(true);

    const question = questions[currentIndex];
    if (optionIdx === question.answer) {
      const newScore = score + 10;
      const newStreak = streak + 1;
      setScore(newScore);
      setStreak(newStreak);
      if (newScore > highestScore) {
        setHighestScore(newScore);
        localStorage.setItem('iiser_movie_highest_score', String(newScore));
      }
    } else {
      setStreak(0);
    }
  };

  const handleNext = () => {
    setSelectedOption(null);
    setIsAnswered(false);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setGameComplete(true);
    }
  };

  const restartGame = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setStreak(0);
    setGameComplete(false);
  };

  const activeQuestion = questions[currentIndex];

  return (
    <div className="space-y-8">
      {/* Header section */}
      <div className="border-b border-zinc-900 pb-6">
        <span className="text-amber-500 font-mono text-xs uppercase tracking-widest font-semibold flex items-center gap-1.5">
          <GraduationCap className="h-4 w-4" /> Cine-Trivia Society
        </span>
        <h2 className="font-serif text-3xl font-bold text-zinc-100 tracking-tight sm:text-4xl mt-1">
          CineQuiz Arena
        </h2>
        <p className="text-xs text-zinc-500 mt-1 max-w-xl">
          Weekly film trivia for the Movie Club! Test your knowledge on modern hits, classics, indie favorites, and directorship.
        </p>
      </div>

      {/* Main Container cards */}
      <div className="w-full max-w-2xl mx-auto rounded-3xl border border-zinc-900 bg-zinc-950 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 h-40 w-40 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>

        {/* Top telemetry states */}
        <div className="flex items-center justify-between border-b border-zinc-900/60 pb-4 mb-6">
          <div className="flex items-center space-x-1 font-mono text-xs text-zinc-400">
            <span className="text-amber-500 font-bold">Q:</span>
            <span>{currentIndex + 1} / {questions.length}</span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1 bg-amber-500/5 border border-amber-500/10 text-amber-500 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold">
              <Flame className="h-3.5 w-3.5 fill-amber-500/20" />
              <span>Streak: {streak}</span>
            </div>

            <div className="flex items-center space-x-1 text-zinc-300 text-xs font-mono">
              <Trophy className="h-3.5 w-3.5 text-zinc-500" />
              <span>Score: <b className="text-zinc-100">{score}</b></span>
            </div>

            <div className="text-[10px] text-zinc-500 font-mono border-l border-zinc-900 pl-4">
              Best: <span className="text-amber-400 font-bold">{highestScore}</span>
            </div>
          </div>
        </div>

        {/* Complete view */}
        {gameComplete ? (
          <div className="text-center py-10 space-y-6">
            <Award className="h-16 w-16 text-amber-400 mx-auto animate-bounce mt-2" />
            <div className="space-y-1">
              <h3 className="font-serif text-2xl font-bold text-zinc-100">Quiz Completed!</h3>
              <p className="text-xs text-zinc-400 font-mono">Awesome job finishing the CineQuiz!</p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto bg-zinc-900/40 p-4 rounded-xl border border-zinc-900">
              <div className="text-center">
                <span className="text-[10px] uppercase font-mono text-zinc-500 block">Total Score</span>
                <span className="text-xl font-extrabold font-mono text-amber-400">{score} Pts</span>
              </div>
              <div className="text-center border-l border-zinc-900">
                <span className="text-[10px] uppercase font-mono text-zinc-500 block">Max Streak</span>
                <span className="text-xl font-extrabold font-mono text-zinc-200">{streak || 3} Correct</span>
              </div>
            </div>

            <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
              Fantastic work studying the depths of movie scripts and visuals! Suggest new trivia ideas via the cinema recommendations list.
            </p>

            <button
              onClick={restartGame}
              className="bg-amber-500 hover:bg-amber-600 text-zinc-950 px-6 py-2.5 rounded-xl text-xs font-bold font-mono transition-colors inline-flex items-center space-x-1 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry CineQuiz</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Question Text */}
            <div className="space-y-2">
              <span className="text-[9.5px] font-mono uppercase bg-zinc-900 border border-zinc-850 text-zinc-400 px-2 py-0.5 rounded">
                Master Class Trivia
              </span>
              <h3 className="font-serif text-lg sm:text-xl font-semibold text-zinc-100 leading-snug">
                {activeQuestion.question}
              </h3>
            </div>

            {/* Options list */}
            <div className="space-y-3">
              {activeQuestion.options.map((option, idx) => {
                const isSelected = selectedOption === idx;
                const isCorrect = idx === activeQuestion.answer;
                
                let optionStyle = 'border-zinc-900 bg-zinc-900/30 text-zinc-300 hover:border-zinc-800 hover:bg-zinc-900/60';
                
                if (isAnswered) {
                  if (isCorrect) {
                    optionStyle = 'border-green-500/40 bg-green-500/10 text-green-400 font-semibold';
                  } else if (isSelected) {
                    optionStyle = 'border-red-500/40 bg-red-500/10 text-red-400';
                  } else {
                    optionStyle = 'border-zinc-900 bg-zinc-950/20 text-zinc-600 opacity-60';
                  }
                }

                return (
                  <button
                    key={idx}
                    disabled={isAnswered}
                    onClick={() => handleOptionClick(idx)}
                    className={`w-full text-left p-4 rounded-xl border text-xs sm:text-sm transition-all duration-200 ${optionStyle} flex items-center justify-between ${!isAnswered ? 'cursor-pointer hover:scale-101' : ''}`}
                  >
                    <span>{option}</span>
                    {isAnswered && isCorrect && <CheckCircle className="h-5 w-5 text-green-500 shrink-0 ml-3" />}
                    {isAnswered && isSelected && !isCorrect && <XCircle className="h-5 w-5 text-red-500 shrink-0 ml-3" />}
                  </button>
                );
              })}
            </div>

            {/* Explanation section shown after answered */}
            {isAnswered && (
              <div className="space-y-4 bg-zinc-900/30 rounded-2xl border border-zinc-900 p-4 animate-fade-in mt-6">
                <div className="flex items-start space-x-2.5">
                  <Lightbulb className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold font-mono text-amber-500 uppercase">Acoustics & Context</h4>
                    <p className="text-xs text-zinc-400 leading-relaxed mt-0.5">
                      {activeQuestion.explanation}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleNext}
                    className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-amber-400 hover:text-amber-300 px-4 py-2 rounded-lg text-xs font-mono font-semibold transition-colors cursor-pointer"
                  >
                    {currentIndex < questions.length - 1 ? 'NEXT QUESTION →' : 'Matrix Completed'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CineQuiz Guidelines Info box */}
      <div className="rounded-xl border border-zinc-900 bg-zinc-950/20 p-5 text-xs text-zinc-500 leading-relaxed">
        <h4 className="font-semibold text-zinc-300 mb-1">About the Arena:</h4>
        Trivia is curated by members of the IISER Kolkata Movie Club editorial committee. Want to submit your own trivia entries? Share them with administrators or send suggestions inside student wishlist notes tagged with <b>[Trivia Idea]</b> in the title!
      </div>
    </div>
  );
}
