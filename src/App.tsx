import { useState, useEffect, useRef } from "react";
import "./App.css";

const BOARD_SIZE = 20;
const INITIAL_SNAKE = [
  { x: 8, y: 10 },
  { x: 7, y: 10 },
  { x: 6, y: 10 },
];
const INITIAL_DIRECTION = { x: 1, y: 0 };
const SPEED = 120;

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

function App() {
  const [snake, setSnake] = useState(INITIAL_SNAKE);
  const [direction, setDirection] = useState(INITIAL_DIRECTION);
  const [food, setFood] = useState(getRandomFood(INITIAL_SNAKE));
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const moveRef = useRef(direction);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const appRef = useRef<HTMLDivElement>(null);

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
    }, SPEED);
    return () => clearInterval(interval);
  }, [direction, food, gameOver]);

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
