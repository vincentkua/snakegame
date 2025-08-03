import { useState, useEffect, useRef } from "react";
import "./App.css";
import { db } from "./firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

const BOARD_SIZE = 20;
const INITIAL_SNAKE = [
  { x: 8, y: 10 },
  { x: 7, y: 10 },
  { x: 6, y: 10 },
];
const INITIAL_DIRECTION = { x: 1, y: 0 };

function getRandomFood(snake: { x: number; y: number }[]): {
  x: number;
  y: number;
} {
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

// Track last touch positions for gesture prevention
let lastTouchY = 0;
let lastTouchX = 0;

function App() {
  const [snake, setSnake] = useState(INITIAL_SNAKE);
  const [direction, setDirection] = useState(INITIAL_DIRECTION);
  const [food, setFood] = useState(getRandomFood(INITIAL_SNAKE));
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [topScoreData, setTopScoreData] = useState<{
    name: string;
    score: number;
  } | null>(null);
  const moveRef = useRef(direction);
  const directionChangedRef = useRef(false); // Track direction change per tick
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const appRef = useRef<HTMLDivElement>(null);

  // Animation state for red dot effect
  const [showRedDot, setShowRedDot] = useState(false);
  const [redDotProgress, setRedDotProgress] = useState(0); // 0 to 1
  const redDotAnimRef = useRef<number | null>(null);

  // Multiple fireworks at random positions, trigger only every 10 points
  const [fireworkBursts, setFireworkBursts] = useState<
    { x: number; y: number; id: number }[]
  >([]);
  const burstCount = 6; // Number of bursts per trigger
  const lastFireworkScore = useRef(0);

  // Show evolved text at center for every 10 points
  const [showEvolvedText, setShowEvolvedText] = useState(false);
  const lastEvolvedScore = useRef(0);

  useEffect(() => {
    moveRef.current = direction;
  }, [direction]);

  useEffect(() => {
    if (gameOver) return;
    const handleKey = (e: KeyboardEvent) => {
      if (directionChangedRef.current) return;
      if (e.key === "ArrowUp" && moveRef.current.y !== 1) {
        setDirection({ x: 0, y: -1 });
        directionChangedRef.current = true;
      } else if (e.key === "ArrowDown" && moveRef.current.y !== -1) {
        setDirection({ x: 0, y: 1 });
        directionChangedRef.current = true;
      } else if (e.key === "ArrowLeft" && moveRef.current.x !== 1) {
        setDirection({ x: -1, y: 0 });
        directionChangedRef.current = true;
      } else if (e.key === "ArrowRight" && moveRef.current.x !== -1) {
        setDirection({ x: 1, y: 0 });
        directionChangedRef.current = true;
      }
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
        if (dx > 30 && moveRef.current.x !== -1)
          setDirection({ x: 1, y: 0 }); // right
        else if (dx < -30 && moveRef.current.x !== 1)
          setDirection({ x: -1, y: 0 }); // left
      } else {
        if (dy > 30 && moveRef.current.y !== -1)
          setDirection({ x: 0, y: 1 }); // down
        else if (dy < -30 && moveRef.current.y !== 1)
          setDirection({ x: 0, y: -1 }); // up
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
      directionChangedRef.current = false; // Reset direction change per tick
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

  // Red dot animation effect
  useEffect(() => {
    if (score > 0 && score % 10 === 0 && score !== lastFireworkScore.current) {
      lastFireworkScore.current = score;
      // Generate random positions for bursts
      const bursts = Array.from({ length: burstCount }, (_, i) => ({
        x: Math.random() * 320,
        y: Math.random() * 320,
        id: Date.now() + i + Math.random(),
      }));
      setFireworkBursts(bursts);
      setShowRedDot(true);
      setRedDotProgress(0);
      let start: number | null = null;
      const duration = 500;
      function animate(ts: number) {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / duration, 1);
        setRedDotProgress(progress);
        if (progress < 1) {
          redDotAnimRef.current = requestAnimationFrame(animate);
        } else {
          setShowRedDot(false);
          setFireworkBursts([]);
        }
      }
      redDotAnimRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (redDotAnimRef.current) cancelAnimationFrame(redDotAnimRef.current);
    };
  }, [score]);

  // Show evolved text at center for every 10 points
  useEffect(() => {
    if (score > 0 && score % 10 === 0 && score !== lastEvolvedScore.current) {
      setShowEvolvedText(true);
      lastEvolvedScore.current = score;
      setTimeout(() => setShowEvolvedText(false), 900);
    }
  }, [score]);

  // Prevent pull-to-refresh and swipe-back gestures on mobile browsers
  useEffect(() => {
    function preventPullToRefresh(e: TouchEvent) {
      if (
        window.scrollY === 0 &&
        e.touches[0].clientY > 10 &&
        e.touches[0].clientY - lastTouchY > 10
      ) {
        e.preventDefault();
      }
      lastTouchY = e.touches[0].clientY;
    }
    function preventSwipeBack(e: TouchEvent) {
      if (e.touches[0].clientX < 30 && e.touches[0].clientX - lastTouchX > 10) {
        e.preventDefault();
      }
      lastTouchX = e.touches[0].clientX;
    }
    document.addEventListener("touchmove", preventPullToRefresh, {
      passive: false,
    });
    document.addEventListener("touchmove", preventSwipeBack, {
      passive: false,
    });
    return () => {
      document.removeEventListener("touchmove", preventPullToRefresh);
      document.removeEventListener("touchmove", preventSwipeBack);
    };
  }, []);

  useEffect(() => {
    const savedName = localStorage.getItem("snakePlayerName");
    if (savedName && typeof savedName === "string") {
      setPlayerName(savedName);
    }

    const el = appRef.current;
    if (!el) return;
    let startY = 0;
    function handleTouchStart(e: TouchEvent) {
      startY = e.touches[0].clientY;
    }
    function handleTouchMove(e: TouchEvent) {
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;
      // If at top and swiping down, block all downward moves
      if (window.scrollY === 0 && deltaY > 0) {
        e.preventDefault();
      }
    }
    el.addEventListener("touchstart", handleTouchStart, { passive: false });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  const handleRestart = () => {
    setSnake(INITIAL_SNAKE);
    setDirection(INITIAL_DIRECTION);
    setFood(getRandomFood(INITIAL_SNAKE));
    setScore(0);
    setGameOver(false);
  };

  async function handleSubmitScore() {
    if (!playerName.trim() || !topScoreData || score <= topScoreData.score)
      return;
    setIsUploading(true);
    try {
      // Update topscore and championdata in Firestore, merge: true
      localStorage.setItem("snakePlayerName", playerName.trim());
      const scoresRef = doc(db, "scores", "topscoredata");
      await setDoc(
        scoresRef,
        {
          name: playerName.trim(),
          score,
        },
        { merge: true }
      );
      setTopScoreData({ name: playerName.trim(), score }); // Update local state
    } catch (err) {
      // handle error
    }
    setIsUploading(false);
    handleRestart();
  }

  useEffect(() => {
    async function fetchTopScore() {
      try {
        const docRef = doc(db, "scores", "topscoredata");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setTopScoreData(docSnap.data() as { name: string; score: number });
        } else {
          setTopScoreData(null);
        }
      } catch (err) {
        setTopScoreData(null);
      }
    }
    fetchTopScore();
  }, []);

  return (
    <div
      className="snake-app mobile-support"
      ref={appRef}
      style={{ overscrollBehaviorY: "contain", touchAction: "pan-x" }}
    >
      <h1>Snake Game</h1>
      <div className="score">Score: {score}</div>
      <div
        className="board"
        style={{
          position: "relative",
          width: "320px",
          height: "320px",
          margin: "0 auto",
        }}
      >
        {/* Evolved text at center for every 10 points */}
        {showEvolvedText && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              color: "#ffd700",
              fontWeight: "bold",
              fontSize: "2rem",
              textShadow: "0 2px 8px #222",
              zIndex: 10,
              pointerEvents: "none",
            }}
          >
            Evolved !
          </div>
        )}
        {/* Multiple fireworks burst at random positions on every score */}
        {showRedDot &&
          fireworkBursts.map((burst) => (
            <svg
              key={burst.id}
              width="48"
              height="48"
              viewBox="0 0 48 48"
              style={{
                position: "absolute",
                left: burst.x - 24,
                top: burst.y - 24,
                pointerEvents: "none",
                zIndex: 2,
              }}
            >
              {[...Array(16)].map((_, i) => {
                const angle = (i * Math.PI * 2) / 16;
                const r = 8 + 32 * redDotProgress; // increase spread radius
                const x = 24 + r * Math.cos(angle);
                const y = 24 + r * Math.sin(angle);
                const color = i % 2 === 0 ? "#ffd700" : "#ff4e50"; // alternate yellow and red
                return (
                  <>
                    <line
                      key={"l" + i}
                      x1={24}
                      y1={24}
                      x2={x}
                      y2={y}
                      stroke={color}
                      strokeWidth={2}
                      style={{ opacity: 1 - redDotProgress }}
                    />
                    <circle
                      key={"c" + i}
                      cx={x}
                      cy={y}
                      r={2 + 2 * (1 - redDotProgress)}
                      fill={color}
                      style={{ opacity: 1 - redDotProgress }}
                    />
                  </>
                );
              })}
            </svg>
          ))}
        {[...Array(BOARD_SIZE)].map((_, y) => (
          <div className="row" key={y}>
            {[...Array(BOARD_SIZE)].map((_, x) => {
              const isSnake = snake.some((seg) => seg.x === x && seg.y === y);
              const isFood = food.x === x && food.y === y;
              return (
                <div
                  key={x}
                  className={`cell${isSnake ? " snake" : ""}${
                    isFood ? " food" : ""
                  }`}
                />
              );
            })}
          </div>
        ))}
      </div>
      {gameOver && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.5)",
            color: "#fff",
            textAlign: "center",
            zIndex: 20,
          }}
        >
          {topScoreData && score > topScoreData.score ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "90%",
              }}
            >
              <p style={{ fontSize: "4rem", margin: 0, color: "#ffd700" }}>
                {score}
              </p>
              <p style={{ fontSize: "1.2rem", margin: 0, color: "yellow" }}>
                New High Score
              </p>

              <br />

              <div style={{ margin: "16px 0" }}>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  style={{
                    fontSize: "1.1rem",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #ccc",
                    width: "100%",
                    maxWidth: "10rem",
                    textAlign: "center",
                  }}
                />
                <br />
                <br />
                <button
                  onClick={handleSubmitScore}
                  style={{
                    padding: "8px 24px",
                    fontSize: "1.1rem",
                    borderRadius: "8px",
                    border: "none",
                    background: "#f4d640",
                    color: "#222",
                    fontWeight: "bold",
                    cursor: "pointer",
                    width: "100%",
                    maxWidth: "10rem",
                  }}
                  disabled={
                    isUploading || !topScoreData || score <= topScoreData.score
                  }
                >
                  {isUploading ? "Uploading..." : "Submit"}
                </button>

                <button
                  onClick={handleRestart}
                  style={{
                    marginTop: "8px",
                    padding: "8px 24px",
                    fontSize: "1.1rem",
                    borderRadius: "8px",
                    border: "none",
                    background: "#9ea39e",
                    color: "#222",
                    fontWeight: "bold",
                    cursor: "pointer",
                    width: "100%",
                    maxWidth: "10rem",
                  }}
                >
                  Play Again
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "90%",
              }}
            >
              <p style={{ fontSize: "4rem", margin: 0, color: "#f36565" }}>
                {score}
              </p>
              <br />
              <p
                style={{
                  fontSize: "1.6rem",
                  fontWeight: "bold",
                  margin: 0,
                  color: "#f36565",
                }}
              >
                Game Over!
              </p>

              <br />
              <button
                onClick={handleRestart}
                style={{
                  marginTop: "16px",
                  fontSize: "1.2rem",
                  padding: "8px 24px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#9ea39e",
                  color: "#222",
                  fontWeight: "bold",
                  cursor: "pointer",
                  width: "100%",
                  maxWidth: "10rem",
                }}
              >
                Restart
              </button>
            </div>
          )}
        </div>
      )}
      {/* Show top score at the bottom */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          width: "100%",
          background: "rgba(0,0,0,0.7)",
          color: "#ffd700",
          textAlign: "center",
          padding: "8px 0",
          fontSize: "1.1rem",
          zIndex: 10,
        }}
      >
        {topScoreData ? (
          <span>
            🏆 Top Score: <b>{topScoreData.score}</b> ({topScoreData.name})
          </span>
        ) : (
          <span>🏆 Top Score: N/A</span>
        )}
      </div>
    </div>
  );
}

export default App;
