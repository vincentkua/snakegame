import { useState, useEffect, useRef } from "react";
import "./App.css";

const BOARD_SIZE = 20;
const INITIAL_SNAKE = [
  { x: 8, y: 10 },
  { x: 7, y: 10 },
  { x: 6, y: 10 },
];
const INITIAL_DIRECTION = { x: 1, y: 0 };

function getRandomFood(
  snake: { x: number; y: number }[]
): { x: number; y: number } {
  let food: { x: number; y: number };
  do {
    food = {
      x: Math.floor(Math.random() * BOARD_SIZE),
      y: Math.floor(Math.random() * BOARD_SIZE),
    };
  } while (snake.some((seg) => seg.x === food.x && seg.y === food.y));
  return food;
}

function isMobile() {
  return /Mobi|Android/i.test(navigator.userAgent);
}

function getSpeed(score: number) {
  return Math.max(40, 120 - Math.floor(score / 10) * 20);
}

function App() {
  const [snake, setSnake] = useState(INITIAL_SNAKE);
  const [direction, setDirection] = useState(INITIAL_DIRECTION);
  const [food, setFood] = useState(getRandomFood(INITIAL_SNAKE));
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [evolution, setEvolution] = useState(false);
  const [fadeEvolution, setFadeEvolution] = useState(false);
  const [fireworkProgress, setFireworkProgress] = useState(0); // 0 to 1
  const fireworkAnimRef = useRef<number | null>(null);
  const moveRef = useRef(direction);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const lastEvolutionScore = useRef(0);

  useEffect(() => {
    moveRef.current = direction;
  }, [direction]);

  useEffect(() => {
    if (gameOver) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" && moveRef.current.y !== 1)
        setDirection({ x: 0, y: -1 });
      else if (e.key === "ArrowDown" && moveRef.current.y !== -1)
        setDirection({ x: 0, y: 1 });
      else if (e.key === "ArrowLeft" && moveRef.current.x !== 1)
        setDirection({ x: -1, y: 0 });
      else if (e.key === "ArrowRight" && moveRef.current.x !== -1)
        setDirection({ x: 1, y: 0 });
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [gameOver]);

  // Gesture support for mobile
  useEffect(() => {
    if (gameOver) return;
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStart.current = { x: touch.clientX, y: touch.clientY };
    };
    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStart.current.x;
      const dy = touch.clientY - touchStart.current.y;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 30 && moveRef.current.x !== -1) setDirection({ x: 1, y: 0 }); // right
        else if (dx < -30 && moveRef.current.x !== 1) setDirection({ x: -1, y: 0 }); // left
      } else {
        if (dy > 30 && moveRef.current.y !== -1) setDirection({ x: 0, y: 1 }); // down
        else if (dy < -30 && moveRef.current.y !== 1) setDirection({ x: 0, y: -1 }); // up
      }
      touchStart.current = null;
    };
    window.addEventListener("touchstart", handleTouchStart);
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [gameOver]);

  // Request fullscreen on mobile
  useEffect(() => {
    if (isMobile() && appRef.current) {
      const el = appRef.current;
      if (document.fullscreenEnabled && !document.fullscreenElement) {
        el.requestFullscreen().catch(() => {});
      }
    }
  }, []);

  useEffect(() => {
    if (gameOver) return;
    const interval = setInterval(() => {
      setSnake((prev) => {
        const newHead = {
          x: (prev[0].x + direction.x + BOARD_SIZE) % BOARD_SIZE,
          y: (prev[0].y + direction.y + BOARD_SIZE) % BOARD_SIZE,
        };
        if (prev.some((seg) => seg.x === newHead.x && seg.y === newHead.y)) {
          setGameOver(true);
          return prev;
        }
        let newSnake = [newHead, ...prev];
        if (newHead.x === food.x && newHead.y === food.y) {
          setFood(getRandomFood(newSnake));
          setScore((s) => s + 1);
        } else {
          newSnake.pop();
        }
        return newSnake;
      });
    }, getSpeed(score));
    return () => clearInterval(interval);
  }, [direction, food, gameOver, score]);

  useEffect(() => {
    if (score > 0 && score % 10 === 0 && score !== lastEvolutionScore.current) {
      setEvolution(true);
      setFadeEvolution(false);
      setFireworkProgress(0);
      lastEvolutionScore.current = score;
      let start: number | null = null;
      const duration = 800;
      function animate(ts: number) {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / duration, 1);
        setFireworkProgress(progress);
        if (progress < 1) {
          fireworkAnimRef.current = requestAnimationFrame(animate);
        }
      }
      fireworkAnimRef.current = requestAnimationFrame(animate);
      setTimeout(() => setFadeEvolution(true), 100); // Start fade after 100ms
      setTimeout(() => {
        setEvolution(false);
        setFireworkProgress(0);
        if (fireworkAnimRef.current) cancelAnimationFrame(fireworkAnimRef.current);
      }, 1200); // Remove after fade
    }
    return () => {
      if (fireworkAnimRef.current) cancelAnimationFrame(fireworkAnimRef.current);
    };
  }, [score]);

  const handleRestart = () => {
    setSnake(INITIAL_SNAKE);
    setDirection(INITIAL_DIRECTION);
    setFood(getRandomFood(INITIAL_SNAKE));
    setScore(0);
    setGameOver(false);
  };

  return (
    <div className="snake-app mobile-support" ref={appRef}>
      <h1>Snake Game</h1>
      <div className="score">Score: {score}</div>
      <div className="board">
        {/* Evolution effect overlay */}
        {evolution && (
          <div className={`evolution-effect${fadeEvolution ? " fade" : ""}`}>  
            <div className="fireworks">
              <svg width="320" height="320" viewBox="0 0 320 320">
                {/* Main burst: 24 particles, animate from center */}
                {[...Array(24)].map((_, i) => {
                  const angle = (i * Math.PI * 2) / 24;
                  const finalX = 160 + 120 * Math.cos(angle);
                  const finalY = 160 + 120 * Math.sin(angle);
                  const cx = 160 + (finalX - 160) * fireworkProgress;
                  const cy = 160 + (finalY - 160) * fireworkProgress;
                  return (
                    <circle
                      key={i}
                      className="firework-particle"
                      cx={cx}
                      cy={cy}
                      r="16"
                      fill={i % 2 === 0 ? "#ffd700" : "#ff4e50"}
                      style={{ opacity: 0.9 * (1 - fireworkProgress * 0.3) }}
                    />
                  );
                })}
                {/* Secondary burst: 16 particles, animate from center */}
                {[...Array(16)].map((_, i) => {
                  const angle = (i * Math.PI * 2) / 16 + Math.PI / 16;
                  const finalX = 160 + 80 * Math.cos(angle);
                  const finalY = 160 + 80 * Math.sin(angle);
                  const cx = 160 + (finalX - 160) * fireworkProgress;
                  const cy = 160 + (finalY - 160) * fireworkProgress;
                  return (
                    <circle
                      key={i + 24}
                      className="firework-particle secondary"
                      cx={cx}
                      cy={cy}
                      r="10"
                      fill={i % 2 === 0 ? "#ffd700" : "#ff4e50"}
                      style={{ opacity: 0.9 * (1 - fireworkProgress * 0.3) }}
                    />
                  );
                })}
                {/* Animated lines: 16 lines, animate endpoint outward */}
                {[...Array(16)].map((_, i) => {
                  const angle = (i * Math.PI * 2) / 16;
                  const finalX = 160 + 150 * Math.cos(angle);
                  const finalY = 160 + 150 * Math.sin(angle);
                  const x2 = 160 + (finalX - 160) * fireworkProgress;
                  const y2 = 160 + (finalY - 160) * fireworkProgress;
                  return (
                    <line
                      key={i + 40}
                      className="firework-line"
                      x1="160"
                      y1="160"
                      x2={x2}
                      y2={y2}
                      stroke={i % 2 === 0 ? "#ffd700" : "#ff4e50"}
                      strokeWidth="8"
                      style={{ opacity: 0.8 * (1 - fireworkProgress * 0.3) }}
                    />
                  );
                })}
              </svg>
              <span className="evolved-text">Evolved!</span>
            </div>
          </div>
        )}
        {[...Array(BOARD_SIZE)].map((_, y) => (
          <div className="row" key={y}>
            {[...Array(BOARD_SIZE)].map((_, x) => {
              const isSnake = snake.some((seg) => seg.x === x && seg.y === y);
              const isFood = food.x === x && food.y === y;
              return (
                <div
                  key={x}
                  className={`cell${
                    isSnake ? " snake" : ""
                  }${isFood ? " food" : ""}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      {gameOver && (
        <div className="game-over">
          <p>Game Over!</p>
          <button onClick={handleRestart}>Restart</button>
        </div>
      )}
    </div>
  );
}

export default App;
