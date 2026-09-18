import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MousePointerClick, Trophy, RotateCcw, Play } from 'lucide-react';

/* ============================= CLICKER GAME ============================= */

interface ClickerGameProps {
  onEarn: (amount: number) => void;
}

export const ClickerGame: React.FC<ClickerGameProps> = ({ onEarn }) => {
  const [playing, setPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10);
  const [earned, setEarned] = useState(0);
  const [clicks, setClicks] = useState(0);
  const [popups, setPopups] = useState<{ id: number; x: number; y: number; val: number }[]>([]);
  const [bestScore, setBestScore] = useState<number>(() => parseInt(localStorage.getItem('gta_clicker_best') || '0', 10));
  const popupId = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startGame = () => {
    setPlaying(true);
    setTimeLeft(10);
    setEarned(0);
    setClicks(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setPlaying(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (!playing && earned > 0) {
      onEarn(earned);
      if (earned > bestScore) {
        setBestScore(earned);
        localStorage.setItem('gta_clicker_best', String(earned));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!playing) return;
    const val = Math.floor(Math.random() * 40) + 10;
    setEarned((v) => v + val);
    setClicks((c) => c + 1);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = popupId.current++;
    setPopups((p) => [...p, { id, x, y, val }]);
    setTimeout(() => setPopups((p) => p.filter((pop) => pop.id !== id)), 600);
  };

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="flex items-center justify-between w-full text-xs">
        <span className="text-slate-400">Best: <span className="text-amber-400 font-mono font-bold">${bestScore}</span></span>
        <span className="text-slate-400">Click-uri: <span className="text-white font-mono font-bold">{clicks}</span></span>
      </div>

      {!playing ? (
        <button
          onClick={startGame}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm transition-colors shadow-lg"
        >
          <Play className="w-4 h-4" /> {earned > 0 ? 'Joacă din nou' : 'Start Clicker (10s)'}
        </button>
      ) : (
        <div className="w-full flex items-center justify-between px-1">
          <span className="text-[11px] font-bold text-slate-400">Timp: <span className="text-rose-400 font-mono">{timeLeft}s</span></span>
          <span className="text-[11px] font-bold text-slate-400">Câștig: <span className="text-emerald-400 font-mono">${earned}</span></span>
        </div>
      )}

      <div className="relative">
        <button
          onClick={handleClick}
          disabled={!playing}
          className={`relative w-28 h-28 rounded-full flex items-center justify-center text-4xl font-black text-white select-none transition-transform active:scale-90 ${
            playing
              ? 'bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_0_30px_rgba(251,191,36,0.5)] cursor-pointer'
              : 'bg-slate-700 cursor-not-allowed opacity-50'
          }`}
        >
          $
          {popups.map((p) => (
            <span
              key={p.id}
              className="absolute pointer-events-none font-mono font-bold text-emerald-400 text-sm animate-[float-up_0.6s_ease-out_forwards]"
              style={{ left: p.x, top: p.y }}
            >
              +${p.val}
            </span>
          ))}
        </button>
      </div>

      {!playing && earned === 0 && (
        <p className="text-[10px] text-slate-500 text-center">Apasă cât mai repede pe monedă timp de 10 secunde!</p>
      )}
      {!playing && earned > 0 && (
        <p className="text-xs text-emerald-400 font-bold">Ai câștigat ${earned}! Adăugat la balanță.</p>
      )}

      <style>{`
        @keyframes float-up {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-30px); }
        }
      `}</style>
    </div>
  );
};

/* ============================== DODGE GAME =============================== */

interface Obstacle {
  id: number;
  lane: number;
  y: number;
}

interface DodgeGameProps {
  onEarn: (amount: number) => void;
}

const LANES = 3;
const GAME_HEIGHT = 320;
const GAME_WIDTH = 240;

export const DodgeGame: React.FC<DodgeGameProps> = ({ onEarn }) => {
  const [playing, setPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [playerLane, setPlayerLane] = useState(1);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState<number>(() => parseInt(localStorage.getItem('gta_dodge_best') || '0', 10));
  const obstacleId = useRef(0);
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spawnRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speedRef = useRef(6);
  const playerLaneRef = useRef(1);

  useEffect(() => { playerLaneRef.current = playerLane; }, [playerLane]);

  const endGame = useCallback((finalScore: number) => {
    setGameOver(true);
    setPlaying(false);
    if (loopRef.current) clearInterval(loopRef.current);
    if (spawnRef.current) clearInterval(spawnRef.current);
    const earnedMoney = finalScore * 5;
    if (earnedMoney > 0) onEarn(earnedMoney);
    if (finalScore > bestScore) {
      setBestScore(finalScore);
      localStorage.setItem('gta_dodge_best', String(finalScore));
    }
  }, [bestScore, onEarn]);

  const startGame = () => {
    setPlaying(true);
    setGameOver(false);
    setPlayerLane(1);
    setObstacles([]);
    setScore(0);
    speedRef.current = 6;

    if (loopRef.current) clearInterval(loopRef.current);
    if (spawnRef.current) clearInterval(spawnRef.current);

    loopRef.current = setInterval(() => {
      setObstacles((obs) => {
        const moved = obs.map((o) => ({ ...o, y: o.y + speedRef.current }));
        const hit = moved.find((o) => o.y > GAME_HEIGHT - 60 && o.y < GAME_HEIGHT - 10 && o.lane === playerLaneRef.current);
        if (hit) {
          endGame(scoreRef.current);
        }
        return moved.filter((o) => o.y < GAME_HEIGHT + 20);
      });
      setScore((s) => {
        scoreRef.current = s + 1;
        return s + 1;
      });
      speedRef.current = Math.min(speedRef.current + 0.02, 16);
    }, 50);

    spawnRef.current = setInterval(() => {
      const lane = Math.floor(Math.random() * LANES);
      setObstacles((obs) => [...obs, { id: obstacleId.current++, lane, y: -20 }]);
    }, 700);
  };

  const scoreRef = useRef(0);
  useEffect(() => { scoreRef.current = score; }, [score]);

  useEffect(() => () => {
    if (loopRef.current) clearInterval(loopRef.current);
    if (spawnRef.current) clearInterval(spawnRef.current);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setPlayerLane((l) => Math.max(0, l - 1));
      if (e.key === 'ArrowRight') setPlayerLane((l) => Math.min(LANES - 1, l + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing]);

  const laneWidth = GAME_WIDTH / LANES;

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <div className="flex items-center justify-between w-full text-xs">
        <span className="text-slate-400">Best: <span className="text-amber-400 font-mono font-bold">{bestScore}</span></span>
        <span className="text-slate-400">Scor: <span className="text-white font-mono font-bold">{score}</span></span>
        <span className="text-slate-400">= <span className="text-emerald-400 font-mono font-bold">${score * 5}</span></span>
      </div>

      <div
        className="relative bg-slate-800 rounded-xl border-2 border-slate-700 overflow-hidden"
        style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
      >
        {/* Lane dividers */}
        {Array.from({ length: LANES - 1 }).map((_, i) => (
          <div key={i} className="absolute top-0 bottom-0 w-px bg-slate-700/60" style={{ left: laneWidth * (i + 1) }} />
        ))}

        {/* Obstacles */}
        {obstacles.map((o) => (
          <div
            key={o.id}
            className="absolute bg-rose-500 rounded-md shadow-lg"
            style={{
              left: o.lane * laneWidth + 8,
              top: o.y,
              width: laneWidth - 16,
              height: 24,
            }}
          />
        ))}

        {/* Player */}
        {playing && (
          <div
            className="absolute bg-emerald-400 rounded-md shadow-[0_0_10px_rgba(52,211,153,0.7)] transition-all duration-100"
            style={{
              left: playerLane * laneWidth + 8,
              top: GAME_HEIGHT - 40,
              width: laneWidth - 16,
              height: 24,
            }}
          />
        )}

        {/* Overlay states */}
        {!playing && !gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/70">
            <p className="text-[10px] text-slate-300 text-center px-4">Evită blocurile roșii cu ← →</p>
            <button
              onClick={startGame}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs transition-colors"
            >
              <Play className="w-3.5 h-3.5" /> Start
            </button>
          </div>
        )}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/85">
            <Trophy className="w-8 h-8 text-amber-400" />
            <p className="text-sm font-bold text-white">Game Over!</p>
            <p className="text-[11px] text-emerald-400 font-mono">+${score * 5}</p>
            <button
              onClick={startGame}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs transition-colors mt-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reîncearcă
            </button>
          </div>
        )}
      </div>

      {/* Mobile controls */}
      <div className="flex gap-3 mt-1">
        <button
          onClick={() => setPlayerLane((l) => Math.max(0, l - 1))}
          disabled={!playing}
          className="px-4 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white text-xs font-bold"
        >
          ←
        </button>
        <button
          onClick={() => setPlayerLane((l) => Math.min(LANES - 1, l + 1))}
          disabled={!playing}
          className="px-4 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white text-xs font-bold"
        >
          →
        </button>
      </div>
    </div>
  );
};

export const GamesIcon = MousePointerClick;
