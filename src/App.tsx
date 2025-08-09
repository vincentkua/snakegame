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

function getMultipleFoods(snake: { x: number; y: number }[], count: number): {
  x: number;
  y: number;
}[] {
  const foods: { x: number; y: number }[] = [];
  const occupiedPositions = new Set(snake.map(seg => `${seg.x},${seg.y}`));
  
  while (foods.length < count) {
    const food = {
      x: Math.floor(Math.random() * BOARD_SIZE),
      y: Math.floor(Math.random() * BOARD_SIZE),
    };
    const posKey = `${food.x},${food.y}`;
    
    if (!occupiedPositions.has(posKey)) {
      foods.push(food);
      occupiedPositions.add(posKey);
    }
  }
  return foods;
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

  // Skill: Slow down snake
  const [slowMode, setSlowMode] = useState(false);
  const [slowModeSteps, setSlowModeSteps] = useState(0);
  const [slowModeUsed, setSlowModeUsed] = useState(false);
  // Skill: Cut snake length in half
  const [cutUsed, setCutUsed] = useState(false);
  // Skill: Double points for food
  const [doubleMode, setDoubleMode] = useState(false);
  const [doubleModeSteps, setDoubleModeSteps] = useState(0);
  const [doubleModeUsed, setDoubleModeUsed] = useState(false);
  // Skill: Ghost mode (snake is half transparent and can pass through itself)
  const [ghostMode, setGhostMode] = useState(false);
  const [ghostModeSteps, setGhostModeSteps] = useState(0);
  const [ghostModeUsed, setGhostModeUsed] = useState(false);
  // Skill: Multi-food mode (shows 5 foods on screen)
  const [multiFoodMode, setMultiFoodMode] = useState(false);
  const [multiFoodSteps, setMultiFoodSteps] = useState(0);
  const [multiFoodUsed, setMultiFoodUsed] = useState(false);
  const [foods, setFoods] = useState<{ x: number; y: number }[]>([]);

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
    const interval: NodeJS.Timeout = setInterval(() => {
      directionChangedRef.current = false;
      setSnake((prev) => {
        const newHead = {
          x: (prev[0].x + direction.x + BOARD_SIZE) % BOARD_SIZE,
          y: (prev[0].y + direction.y + BOARD_SIZE) % BOARD_SIZE,
        };
        // Check for self collision
        const hitSelf = prev.some((seg) => seg.x === newHead.x && seg.y === newHead.y);
        
        if (hitSelf && !ghostMode) {
          // Auto-activate ghost mode if not used yet, otherwise end game
          if (!ghostModeUsed) {
            setGhostMode(true);
            setGhostModeUsed(true);
            setGhostModeSteps(0);
          } else {
            setGameOver(true);
            return prev;
          }
        }
        const newSnake = [newHead, ...prev];
        
        // Check food collision - handle both single food and multiple foods
        let foodEaten = false;
        if (multiFoodMode && foods.length > 0) {
          // Check collision with any of the multiple foods
          const eatenFoodIndex = foods.findIndex(f => f.x === newHead.x && f.y === newHead.y);
          if (eatenFoodIndex !== -1) {
            // Remove the eaten food and add a new one
            const newFoods = [...foods];
            newFoods.splice(eatenFoodIndex, 1);
            newFoods.push(...getMultipleFoods(newSnake, 1));
            setFoods(newFoods);
            foodEaten = true;
          }
        } else {
          // Single food mode
          if (newHead.x === food.x && newHead.y === food.y) {
            setFood(getRandomFood(newSnake));
            foodEaten = true;
          }
        }
        
        if (foodEaten) {
          let points = 1;
          if (doubleMode) points = 2;
          setScore((s) => s + points);
        } else {
          newSnake.pop();
        }
        return newSnake;
      });
      if (slowMode) setSlowModeSteps((steps) => steps + 1);
      if (doubleMode) setDoubleModeSteps((steps) => steps + 1);
      if (ghostMode) setGhostModeSteps((steps) => steps + 1);
      if (multiFoodMode) setMultiFoodSteps((steps) => steps + 1);
    }, getSpeed(score) * (slowMode ? 2 : 1));
    return () => clearInterval(interval);
  }, [direction, food, gameOver, score, slowMode, doubleMode, ghostMode, ghostModeUsed, multiFoodMode, foods]);

  // Automatically disable slow mode after 99 steps
  useEffect(() => {
    if (slowMode && slowModeSteps >= 99) {
      setSlowMode(false);
    }
  }, [slowMode, slowModeSteps]);

  // Reset slow mode on restart
  useEffect(() => {
    if (!gameOver) {
      setSlowMode(false);
      setSlowModeSteps(0);
      setSlowModeUsed(false);
    }
  }, [gameOver]);

  // Automatically disable double mode after 99 steps
  useEffect(() => {
    if (doubleMode && doubleModeSteps >= 99) {
      setDoubleMode(false);
    }
  }, [doubleMode, doubleModeSteps]);

  // Reset double mode on restart
  useEffect(() => {
    if (!gameOver) {
      setDoubleMode(false);
      setDoubleModeSteps(0);
      setDoubleModeUsed(false);
    }
  }, [gameOver]);

  // Automatically disable ghost mode after 99 steps
  useEffect(() => {
    if (ghostMode && ghostModeSteps >= 99) {
      setGhostMode(false);
    }
  }, [ghostMode, ghostModeSteps]);

  // Reset ghost mode on restart
  useEffect(() => {
    if (!gameOver) {
      setGhostMode(false);
      setGhostModeSteps(0);
      setGhostModeUsed(false);
    }
  }, [gameOver]);

  // Automatically disable multi-food mode after 99 steps
  useEffect(() => {
    if (multiFoodMode && multiFoodSteps >= 99) {
      setMultiFoodMode(false);
      setFoods([]);
    }
  }, [multiFoodMode, multiFoodSteps]);

  // Reset multi-food mode on restart
  useEffect(() => {
    if (!gameOver) {
      setMultiFoodMode(false);
      setMultiFoodSteps(0);
      setMultiFoodUsed(false);
      setFoods([]);
    }
  }, [gameOver]);

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
    // setSnake(INITIAL_SNAKE);
    // setDirection(INITIAL_DIRECTION);
    // setFood(getRandomFood(INITIAL_SNAKE));
    // setScore(0);
    // setCutUsed(false);
    // setGameOver(false);

    window.location.reload(); // Reload to reset the game state
  };

  async function handleSubmitScore() {
    // get the latest highscore data from Firestore again
    let latestTopScore = 0;
    const latestTopScoreData = await getDoc(doc(db, "scores", "topscoredata"));
    if (latestTopScoreData.exists()) {
      const data = latestTopScoreData.data() as { name: string; score: number };
      latestTopScore = data.score;
    }

    if (score <= latestTopScore) {
      alert("Oh no !!! Someone else has just beat your score !!!");
      handleRestart();
      return;
    }

    if (!playerName.trim() || !topScoreData || score <= topScoreData.score) {
      return;
    }

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

  // Admin reset trigger state
  const [adminStage, setAdminStage] = useState<"none" | "title" | "topscore">(
    "none"
  );
  const [adminTitleCount, setAdminTitleCount] = useState(0);
  const [adminTopScoreCount, setAdminTopScoreCount] = useState(0);

  // Handler for Snake Game title click
  const handleTitleClick = (e: React.MouseEvent<HTMLHeadingElement>) => {
    e.stopPropagation();
    if (adminStage === "none" || adminStage === "title") {
      setAdminStage("title");
      setAdminTitleCount((prev) => {
        if (prev + 1 >= 10) {
          setAdminStage("topscore");
          setAdminTopScoreCount(0);
          return 0;
        }
        return prev + 1;
      });
      setAdminTopScoreCount(0);
    } else {
      // If in topscore stage, clicking title resets everything
      setAdminStage("none");
      setAdminTitleCount(0);
      setAdminTopScoreCount(0);
    }
  };

  useEffect(() => {
    if (adminTitleCount === 1) {
      console.log("Why you clicked this ?");
    }
  }, [adminTitleCount]);

  // Handler for Top Score area click
  const handleTopScoreClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (adminStage === "topscore") {
      if (adminTopScoreCount + 1 >= 10) {
        try {
          const scoresRef = doc(db, "scores", "topscoredata");
          await setDoc(
            scoresRef,
            { name: "New Challenge", score: 0 },
            { merge: true }
          );
          setTopScoreData({ name: "New Challenge", score: 0 });
        } catch (err) {
          // handle error silently
        }
        alert("Top Score Reset Done !");
        setAdminStage("none");
        setAdminTitleCount(0);
        setAdminTopScoreCount(0);
      } else {
        setAdminTopScoreCount(adminTopScoreCount + 1);
      }
    } else {
      // If not in topscore stage, clicking Top Score resets everything
      setAdminStage("none");
      setAdminTitleCount(0);
      setAdminTopScoreCount(0);
    }
  };

  // Reset admin counts if click outside title or Top Score area
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      // Only reset if not clicking title or Top Score area
      const titleEl = document.getElementById("snake-title-admin");
      const topScoreEl = document.getElementById("snake-topscore-admin");
      if (
        (titleEl && titleEl.contains(e.target as Node)) ||
        (topScoreEl && topScoreEl.contains(e.target as Node))
      ) {
        return;
      }
      setAdminStage("none");
      setAdminTitleCount(0);
      setAdminTopScoreCount(0);
    };
    document.addEventListener("click", handleGlobalClick);
    return () => {
      document.removeEventListener("click", handleGlobalClick);
    };
  }, []);

  return (
    <div
      className="snake-app mobile-support"
      ref={appRef}
      style={{
        overscrollBehaviorY: "contain",
        touchAction: "pan-x",
        marginTop: "50px",
      }}
    >
      <h1 id="snake-title-admin" onClick={handleTitleClick}>
        Snake Game
      </h1>
      <div className="score">Score: {score}</div>
      {/* Special skill buttons above the board */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "16px",
          margin: "24px 0 16px 0",
          position: "relative",
          zIndex: 1,
        }}
      >
        {[3, 0, 1, 2, 4].map((i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-end",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                background:
                  i === 0
                    ? slowMode
                      ? "#7db1ff"
                      : slowModeUsed
                      ? "#b0b0b0"
                      : "#409df4"
                    : i === 1
                    ? doubleMode
                      ? "#7db1ff"
                      : doubleModeUsed
                      ? "#b0b0b0"
                      : "#409df4"
                    : i === 2
                    ? cutUsed
                      ? "#b0b0b0"
                      : "#409df4"
                    : i === 3
                    ? ghostMode
                      ? "#7db1ff"
                      : ghostModeUsed
                      ? "#b0b0b0"
                      : "#409df4"
                    : i === 4
                    ? multiFoodMode
                      ? "#7db1ff"
                      : multiFoodUsed
                      ? "#b0b0b0"
                      : "#409df4"
                    : "#409df4",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
                fontSize: "1.5rem",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                cursor:
                  i === 0 && !slowModeUsed
                    ? "pointer"
                    : i === 1 && !doubleModeUsed
                    ? "pointer"
                    : i === 2 && !cutUsed
                    ? "pointer"
                    : i === 3 && !ghostModeUsed
                    ? "pointer"
                    : i === 4 && !multiFoodUsed
                    ? "pointer"
                    : "not-allowed",
                border:
                  i === 0
                    ? slowModeUsed
                      ? "2px solid #434343"
                      : "2px solid #7db1ff"
                    : i === 1
                    ? doubleModeUsed
                      ? "2px solid #606060"
                      : "2px solid #7db1ff"
                    : i === 2
                    ? cutUsed
                      ? "2px solid #606060"
                      : "2px solid #7db1ff"
                    : i === 3
                    ? ghostModeUsed
                      ? "2px solid #606060"
                      : "2px solid #7db1ff"
                    : i === 4
                    ? multiFoodUsed
                      ? "2px solid #606060"
                      : "2px solid #7db1ff"
                    : "2px solid #2e5cf3",
                opacity:
                  (i === 0 && slowModeUsed) ||
                  (i === 1 && doubleModeUsed) ||
                  (i === 2 && cutUsed) ||
                  (i === 3 && ghostModeUsed) ||
                  (i === 4 && multiFoodUsed)
                    ? 0.5
                    : 1,
              }}
              onClick={
                i === 0 && !slowModeUsed
                  ? () => {
                      setSlowMode(true);
                      setSlowModeUsed(true);
                    }
                  : i === 1 && !doubleModeUsed
                  ? () => {
                      setDoubleMode(true);
                      setDoubleModeUsed(true);
                    }
                  : i === 2 && !cutUsed
                  ? () => {
                      setSnake((prev) => {
                        if (prev.length <= 1) return prev;
                        const half = Math.ceil(prev.length / 2);
                        return prev.slice(0, half);
                      });
                      setCutUsed(true);
                    }
                  : i === 3 && !ghostModeUsed
                  ? () => {
                      setGhostMode(true);
                      setGhostModeUsed(true);
                    }
                  : i === 4 && !multiFoodUsed
                  ? () => {
                      setMultiFoodMode(true);
                      setMultiFoodUsed(true);
                      setMultiFoodSteps(0);
                      // Generate 5 foods
                      setFoods(getMultipleFoods(snake, 5));
                    }
                  : undefined
              }
              title={
                i === 0
                  ? slowModeUsed
                    ? "Already used"
                    : slowMode
                    ? `Slow Mode (${99 - slowModeSteps} steps left)`
                    : "Activate Slow Mode (99 steps)"
                  : i === 1
                  ? doubleModeUsed
                    ? "Already used"
                    : doubleMode
                    ? `Double Points (${99 - doubleModeSteps} steps left)`
                    : "Double points for 99 steps"
                  : i === 2
                  ? cutUsed
                    ? "Already used"
                    : "Cut snake length in half"
                  : i === 3
                  ? ghostModeUsed
                    ? "Already used"
                    : ghostMode
                    ? `Ghost Mode (${99 - ghostModeSteps} steps left)`
                    : "Ghost mode for 99 steps"
                  : i === 4
                  ? multiFoodUsed
                    ? "Already used"
                    : multiFoodMode
                    ? `Multi-Food (${99 - multiFoodSteps} steps left)`
                    : "Show 5 foods for 99 steps"
                  : undefined
              }
            >
              {i === 0 ? (
                <span style={{ fontSize: "2rem" }}>🐌</span>
              ) : i === 1 ? (
                <span style={{ fontSize: "2rem" }}>💰</span>
              ) : i === 2 ? (
                <span style={{ fontSize: "2rem" }}>🔪</span>
              ) : i === 3 ? (
                <span style={{ fontSize: "2rem" }}>👻</span>
              ) : i === 4 ? (
                <span style={{ fontSize: "2rem" }}>🍎</span>
              ) : (
                `S${i + 1}`
              )}
            </div>
            {/* Countdown for S1 slow mode */}
            {i === 0 && slowMode && (
              <span
                style={{
                  fontSize: "0.9rem",
                  color: "#ffffff",
                  fontWeight: "bold",
                  marginBottom: "2px",
                  minHeight: "18px",
                }}
              >
                {99 - slowModeSteps}
              </span>
            )}
            {i === 0 && !slowMode && (
              <span
                style={{
                  fontSize: "0.8rem",
                  color: slowModeUsed ? "#b0b0b0" : "#ffffff",
                  marginBottom: "2px",
                  minHeight: "18px",
                }}
              >
                Slow
              </span>
            )}
            {/* Countdown for S2 double mode */}
            {i === 1 && doubleMode && (
              <span
                style={{
                  fontSize: "0.9rem",
                  color: "#ffffff",
                  fontWeight: "bold",
                  marginBottom: "2px",
                  minHeight: "18px",
                }}
              >
                {99 - doubleModeSteps}
              </span>
            )}
            {i === 1 && !doubleMode && (
              <span
                style={{
                  fontSize: "0.8rem",
                  color: doubleModeUsed ? "#b0b0b0" : "#ffffff",
                  marginBottom: "2px",
                  minHeight: "18px",
                }}
              >
                Double
              </span>
            )}
            {/* Countdown for S4 ghost mode */}
            {i === 3 && ghostMode && (
              <span
                style={{
                  fontSize: "0.9rem",
                  color: "#ffffff",
                  fontWeight: "bold",
                  marginBottom: "2px",
                  minHeight: "18px",
                }}
              >
                {99 - ghostModeSteps}
              </span>
            )}
            {i === 3 && !ghostMode && (
              <span
                style={{
                  fontSize: "0.8rem",
                  color: ghostModeUsed ? "#b0b0b0" : "#ffffff",
                  marginBottom: "2px",
                  minHeight: "18px",
                }}
              >
                Ghost
              </span>
            )}
            {/* Add descriptive text Cut */}
            {i === 2 && (
              <span
                style={{
                  fontSize: "0.8rem",
                  color: cutUsed ? "#8a8a8a" : "#ffffff",
                  marginTop: "2px",
                  minHeight: "18px",
                }}
              >
                Cut
              </span>
            )}
            {/* Countdown for S5 multi-food mode */}
            {i === 4 && multiFoodMode && (
              <span
                style={{
                  fontSize: "0.9rem",
                  color: "#ffffff",
                  fontWeight: "bold",
                  marginBottom: "2px",
                  minHeight: "18px",
                }}
              >
                {99 - multiFoodSteps}
              </span>
            )}
            {i === 4 && !multiFoodMode && (
              <span
                style={{
                  fontSize: "0.8rem",
                  color: multiFoodUsed ? "#b0b0b0" : "#ffffff",
                  marginBottom: "2px",
                  minHeight: "18px",
                }}
              >
                Multi
              </span>
            )}
          </div>
        ))}
      </div>
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
              const isFood = multiFoodMode 
                ? foods.some((f) => f.x === x && f.y === y)
                : food.x === x && food.y === y;
              
              return (
                <div
                  key={x}
                  className={`cell${isSnake ? " snake" : ""}${
                    isFood ? " food" : ""
                  }`}
                  style={isSnake && ghostMode ? { opacity: 0.5 } : undefined}
                />
              );
            })}
          </div>
        ))}
      </div>
      {gameOver && (
        <div
          style={{
            position: "fixed",
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
                    background: "#dddddd",
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
                  background: "#efefef",
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
      {/* Show top score at the top */}
      <div
        id="snake-topscore-admin"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          background: "rgba(0,0,0,0.7)",
          color: "rgb(216, 192, 57)",
          textAlign: "center",
          padding: "8px 0",
          fontSize: "1.1rem",
          zIndex: 10,
        }}
        onClick={handleTopScoreClick}
      >
        {topScoreData ? (
          <span>
            🏆 Top Score: <b>{topScoreData.score}</b> ({topScoreData.name}) 🏆
          </span>
        ) : (
          <span>🏆 Top Score: N/A 🏆</span>
        )}
      </div>
    </div>
  );
}

export default App;
