import React, { useState, useEffect, useRef, useCallback } from "react";
import { Board, WHITE, BLACK, EMPTY } from "./engine/board";
import { makeMove, generateMoves, moveToString } from "./engine/moves";
import type { Move } from "./engine/moves";
import { search, evaluateNeural, loadModel, loadWasmEngine, evaluate } from "./engine/search";
import { Chessboard } from "./components/Chessboard";
import {
  User,
  Cpu,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Database,
  Trash2,
  Activity,
  Play,
  Loader2,
} from "lucide-react";

interface SavedGame {
  id: string;
  date: string;
  mode: string;
  result: string;
  moves: string[];
}

export default function App() {
  const [previewBoard, setPreviewBoard] = useState<Board>(new Board());
  
  // Game states
  const [gameMode, setGameMode] = useState<"pvr" | "pvp" | "analysis">("pvr");
  const [playerColor, setPlayerColor] = useState<number>(WHITE); // Player is White by default
  const [selectedSq, setSelectedSq] = useState<number | null>(null);
  const [engineThinking, setEngineThinking] = useState(false);
  const [useNeural, setUseNeural] = useState(true);
  const [isFlipped, setIsFlipped] = useState(false);
  
  // Move log and highlights
  const [moveHistory, setMoveHistory] = useState<Move[]>([]);
  const [lastMove1, setLastMove1] = useState<Move | null>(null);
  const [lastMove2, setLastMove2] = useState<Move | null>(null);

  // Status message
  const [statusMsg, setStatusMsg] = useState("White's Turn (Ply 1/2)");
  const [gameOver, setGameOver] = useState<string | null>(null);
  
  // Evaluation Bar
  const [currentEval, setCurrentEval] = useState<number>(0);
  const [loadingModel, setLoadingModel] = useState(true);
  const [modelActive, setModelActive] = useState(false);

  // Saved Games Database
  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
  const [showDatabase, setShowDatabase] = useState(false);

  // Interactive Analysis States
  const [analysisMoves, setAnalysisMoves] = useState<Move[]>([]);
  const [analysisIndex, setAnalysisIndex] = useState(-1);
  const [analysisBoard, setAnalysisBoard] = useState<Board>(new Board());

  // Pre-analysis cache: one result per move index (-1 = starting position)
  type AnalysisEntry = {
    label: string;
    badge: string;
    bestMoveStr: string;
    evalAfter: number;
  };
  const [analysisCache, setAnalysisCache] = useState<(AnalysisEntry | null)[]>([]);
  const [analysisProgress, setAnalysisProgress] = useState<{ done: number; total: number } | null>(null);
  const [analysisStarted, setAnalysisStarted] = useState(false);
  const analysisCancelRef = useRef<number>(0); // increment to cancel a running batch

  // Load ONNX Model and WASM engine on startup
  useEffect(() => {
    async function init() {
      const [modelOk] = await Promise.all([loadModel(), loadWasmEngine()]);
      setModelActive(modelOk);
      setLoadingModel(false);
      updateEvaluation(new Board(), modelOk);
    }
    init();
    loadSavedGames();
  }, []);

  // Fetch games from localStorage
  const loadSavedGames = () => {
    const raw = localStorage.getItem("two_move_chess_games");
    if (raw) {
      try {
        setSavedGames(JSON.parse(raw));
      } catch (e) {
        setSavedGames([]);
      }
    }
  };

  const saveGameToDatabase = (result: string) => {
    if (moveHistory.length === 0) return;
    const newGame: SavedGame = {
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      mode: gameMode === "pvr" ? "Vs Robot" : "Local PvP",
      result,
      moves: moveHistory.map((m) => moveToString(m)),
    };
    const updated = [newGame, ...savedGames];
    setSavedGames(updated);
    localStorage.setItem("two_move_chess_games", JSON.stringify(updated));
  };

  const deleteGame = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedGames.filter((g) => g.id !== id);
    setSavedGames(updated);
    localStorage.setItem("two_move_chess_games", JSON.stringify(updated));
  };

  // Update evaluation bar value
  const updateEvaluation = async (b: Board, neuralOverride?: boolean) => {
    const isNeural = neuralOverride !== undefined ? neuralOverride : useNeural && modelActive;
    if (isNeural) {
      const val = await evaluateNeural(b);
      setCurrentEval(val);
    } else {
      // Static material fallback
      let score = 0;
      for (let sq = 0; sq < 64; sq++) {
        const piece = b.getPiece(sq);
        if (piece !== EMPTY) {
          const val = [0, 10, 30, 30, 50, 90, 10000][piece] || 0;
          score += b.getColor(sq) === WHITE ? val : -val;
        }
      }
      setCurrentEval(score);
    }
  };

  // Flip board color automatically if playing as Black
  useEffect(() => {
    if (gameMode === "pvr" && playerColor === BLACK) {
      setIsFlipped(true);
    } else {
      setIsFlipped(false);
    }
  }, [playerColor, gameMode]);

  // Check if current board is in checkmate/king captured
  const checkGameOver = (b: Board): string | null => {
    let whiteKing = false;
    let blackKing = false;
    for (let sq = 0; sq < 64; sq++) {
      if (b.getPiece(sq) === 6) {
        if (b.getColor(sq) === WHITE) whiteKing = true;
        else blackKing = true;
      }
    }
    if (!whiteKing) return "Black Wins (White King Captured!)";
    if (!blackKing) return "White Wins (Black King Captured!)";
    
    // Check if player has no legal moves
    const moves = generateMoves(b);
    if (moves.length === 0) {
      return b.sideToMove === WHITE ? "Black Wins (White has no moves!)" : "White Wins (Black has no moves!)";
    }
    return null;
  };

  // Coordinates Robot searches
  const triggerRobotMove = async (currentBoard: Board) => {
    setEngineThinking(true);
    // Search is blazingly fast in typescript (~50ms-150ms)
    // Wait brief duration to simulate brain thinking for amazing feel!
    await new Promise((r) => setTimeout(r, 350));
    
    // In the early opening (first 2 turns of the game: moveHistory.length < 4),
    // the neural network is completely untrained due to randomized opening data generation.
    // We bypass the neural network and use a deeper classical search (depth 6) to ensure tactical correctness.
    const isOpening = moveHistory.length < 4;
    const activeNeural = useNeural && modelActive && !isOpening;
    
    let depth = currentBoard.pliesThisTurn === 0 ? 2 : 1;
    if (isOpening) {
      depth = currentBoard.pliesThisTurn === 0 ? 4 : 3;
    } else if (!activeNeural) {
      depth = currentBoard.pliesThisTurn === 0 ? 4 : 3;
    }
    
    let bestMove: Move | null = null;
    try {
      const res = await search(currentBoard, depth, activeNeural);
      bestMove = res[1];
    } catch (e: any) {
      console.error("Search failed:", e);
      setEngineThinking(false);
      const errMsg = e instanceof Error ? e.message : String(e);
      setGameOver("Engine crashed: " + errMsg);
      setStatusMsg("Error: " + errMsg);
      return;
    }
    
    setEngineThinking(false);

    if (bestMove) {
      const nextBoard = currentBoard.clone();
      makeMove(nextBoard, bestMove);
      
      setPreviewBoard(nextBoard);
      setMoveHistory((prev) => [...prev, bestMove]);
      
      const totalPlies = currentBoard.pliesAllowedThisTurn;

      // Still mid-turn (e.g. after ply 1 of a 2-ply turn)?
      if (nextBoard.sideToMove === currentBoard.sideToMove && nextBoard.pliesThisTurn > 0) {
        setLastMove1(bestMove);
        setLastMove2(null);
        setStatusMsg(`Robot's Turn (Ply 2/${totalPlies})`);
        // Trigger second move immediately
        triggerRobotMove(nextBoard);
      } else {
        // Turn is fully done — hand back to the human side
        if (nextBoard.pliesThisTurn === 0) {
          setLastMove2(bestMove);
        } else {
          setLastMove1(bestMove);
          setLastMove2(null);
        }
        const humanColor = nextBoard.sideToMove === WHITE ? "White" : "Black";
        const humanTotal = nextBoard.pliesAllowedThisTurn;
        setStatusMsg(`${humanColor}'s Turn (Ply 1/${humanTotal})`);
        updateEvaluation(nextBoard);

        const result = checkGameOver(nextBoard);
        if (result) {
          setGameOver(result);
          setStatusMsg(result);
          saveGameToDatabase(result);
        }
      }
    } else {
      const result = currentBoard.sideToMove === WHITE ? "Black Wins!" : "White Wins!";
      setGameOver(result);
      setStatusMsg(result);
      saveGameToDatabase(result);
    }
  };

  // Executes player moves
  const handleMakeMove = (from: number, to: number) => {
    if (gameOver || engineThinking) return;

    // Detect if capture/promotion/etc
    const moves = generateMoves(previewBoard);
    const m = moves.find(
      (x) => x.from === from && x.to === to && (x.promotion === EMPTY || x.promotion === 5) // promote queen
    );
    if (!m) return;

    const nextBoard = previewBoard.clone();
    makeMove(nextBoard, m);
    setPreviewBoard(nextBoard);
    setMoveHistory((prev) => [...prev, m]);

    // Check whether the current side still has more plies this turn
    const turnComplete = nextBoard.sideToMove !== previewBoard.sideToMove || nextBoard.pliesThisTurn === 0;
    const totalPlies = previewBoard.pliesAllowedThisTurn;

    if (!turnComplete) {
      // Mid-turn: player still has another ply to play
      setLastMove1(m);
      setLastMove2(null);
      const color = nextBoard.sideToMove === WHITE ? "White" : "Black";
      setStatusMsg(`${color}'s Turn (Ply 2/${totalPlies})`);
      updateEvaluation(nextBoard);
    } else {
      // Completed full turn!
      setLastMove2(m);
      
      const result = checkGameOver(nextBoard);
      if (result) {
        setGameOver(result);
        setStatusMsg(result);
        updateEvaluation(nextBoard);
        saveGameToDatabase(result);
        return;
      }

      updateEvaluation(nextBoard);

      if (gameMode === "pvr") {
        setStatusMsg("Robot is planning...");
        triggerRobotMove(nextBoard);
      } else {
        // Local PvP: Hand turn over
        const nextColor = nextBoard.sideToMove === WHITE ? "White" : "Black";
        const nextTotal = nextBoard.pliesAllowedThisTurn;
        setStatusMsg(`${nextColor}'s Turn (Ply 1/${nextTotal})`);
      }
    }
  };

  // Revert last ply played
  const handleUndo = () => {
    if (moveHistory.length === 0 || engineThinking) return;

    const history = [...moveHistory];
    history.pop();
    
    // Reconstruct board from scratch to ensure perfect integrity!
    const newB = new Board();
    for (const m of history) {
      makeMove(newB, m);
    }

    setPreviewBoard(newB);
    setMoveHistory(history);
    setGameOver(null);
    setLastMove1(history[history.length - 2] || null);
    setLastMove2(history[history.length - 1] || null);

    const plies = newB.pliesThisTurn;
    const color = newB.sideToMove === WHITE ? "White" : "Black";
    const totalPliesUndo = newB.pliesAllowedThisTurn;
    setStatusMsg(`${color}'s Turn (Ply ${plies + 1}/${totalPliesUndo})`);
    updateEvaluation(newB);
  };

  const handleReset = () => {
    const newB = new Board();
    setPreviewBoard(newB);
    setMoveHistory([]);
    setLastMove1(null);
    setLastMove2(null);
    setGameOver(null);
    setStatusMsg("White's Turn (Ply 1/1)"); // White's handicapped first turn
    updateEvaluation(newB);

    if (gameMode === "pvr" && playerColor === BLACK) {
      setStatusMsg("Robot is planning...");
      triggerRobotMove(newB);
    }
  };

  // Classify position evaluation into human-readable label
  const classifyEval = (evalBefore: number, evalAfter: number, sideWhoMoved: number): { label: string; badge: string } => {
    if (Math.abs(evalAfter) > 5000) {
      return evalAfter > 0
        ? { label: "Checkmate Sequence", badge: "badge-great" }
        : { label: "Loses to Checkmate", badge: "badge-blunder" };
    }
    const delta = sideWhoMoved === WHITE ? (evalAfter - evalBefore) : (evalBefore - evalAfter);
    if (delta < -25) return { label: "Blunder", badge: "badge-blunder" };
    if (delta < -10) return { label: "Mistake", badge: "badge-mistake" };
    if (delta >= 10) return { label: "Great Move", badge: "badge-great" };
    if (delta >= 2)  return { label: "Good Move", badge: "badge-good" };
    return { label: "Neutral", badge: "badge-neutral" };
  };

  // Batch-analyze ALL positions in a game, storing results in cache.
  // Fires once when entering analysis mode; navigation then becomes instant.
  const batchAnalyzeGame = useCallback(async (moves: Move[], cancelToken: number) => {
    const total = moves.length; // analyze move 0..N-1  (starting pos has no "move" to classify)
    const cache: (AnalysisEntry | null)[] = Array(total).fill(null);
    setAnalysisCache([...cache]);
    setAnalysisProgress({ done: 0, total });

    // Reconstruct board snapshots once, up-front (cheap)
    const boards: Board[] = [];
    const b = new Board();
    for (let i = 0; i < moves.length; i++) {
      makeMove(b, moves[i]);
      boards.push(b.clone());
    }

    // Evaluate starting position (needed for delta of first move)
    let prevEval = evaluate(new Board());

    for (let i = 0; i < total; i++) {
      if (analysisCancelRef.current !== cancelToken) return; // cancelled

      const board = boards[i];
      const [bestScore, bestMove] = await search(board, 5, useNeural && modelActive);

      if (analysisCancelRef.current !== cancelToken) return; // cancelled mid-search

      const mover = board.sideToMove === WHITE ? BLACK : WHITE;
      const { label, badge } = classifyEval(prevEval, bestScore, mover);
      const entry: AnalysisEntry = {
        label,
        badge,
        bestMoveStr: bestMove ? moveToString(bestMove) : "none",
        evalAfter: bestScore,
      };

      cache[i] = entry;
      prevEval = bestScore;

      // Push incremental update so UI fills in as each move is done
      setAnalysisCache([...cache]);
      setAnalysisProgress({ done: i + 1, total });
    }

    setAnalysisProgress(null); // done
  }, [useNeural, modelActive]);

  // Start analyzing a saved game
  const handleStartAnalysis = (game: SavedGame) => {
    setGameMode("analysis");
    setShowDatabase(false);

    // Parse moves
    const parsedMoves: Move[] = [];
    const tempBoard = new Board();
    for (const mStr of game.moves) {
      const moves = generateMoves(tempBoard);
      const m = moves.find((x) => moveToString(x) === mStr);
      if (m) {
        parsedMoves.push(m);
        makeMove(tempBoard, m);
      }
    }

    setAnalysisMoves(parsedMoves);
    setAnalysisIndex(-1); // Start at initial position
    setAnalysisBoard(new Board());
    setCurrentEval(0);
    setAnalysisCache(Array(parsedMoves.length).fill(null));
    setAnalysisProgress(null);
    setAnalysisStarted(false);

    // Cancel any prior background run
    analysisCancelRef.current++;
  };

  const handleBeginAnalysis = () => {
    setAnalysisStarted(true);
    const token = ++analysisCancelRef.current;
    batchAnalyzeGame(analysisMoves, token);
  };

  // Navigate in Analysis Mode — instant lookup from cache
  const navigateAnalysis = (index: number) => {
    if (index < -1 || index >= analysisMoves.length) return;

    const newB = new Board();
    for (let i = 0; i <= index; i++) {
      makeMove(newB, analysisMoves[i]);
    }

    setAnalysisIndex(index);
    setAnalysisBoard(newB);
    setLastMove1(analysisMoves[index - 1] || null);
    setLastMove2(analysisMoves[index] || null);

    // Update eval bar from cached result (if available)
    const cached = index >= 0 ? analysisCache[index] : null;
    if (cached) {
      setCurrentEval(cached.evalAfter);
    } else {
      setCurrentEval(0);
    }
  };

  const getAnalysisStatus = () => {
    if (analysisIndex === -1) return "Starting Position";
    const turnNum = Math.floor(analysisIndex / 4) + 1;
    const isWhite = (analysisIndex % 4) < 2;
    const plyNum = (analysisIndex % 2) + 1;
    return `Move ${turnNum} — ${isWhite ? "White" : "Black"} (Ply ${plyNum}/2)`;
  };

  // Format Eval Score for output (+1.5, -M3, etc)
  const formatEval = (score: number) => {
    if (Math.abs(score) > 5000) {
      return score > 0 ? "+M" : "-M";
    }
    const val = score / 10.0;
    return val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1);
  };

  // Clamping evaluation to [-80, 80] range
  const evalClamped = Math.max(-80, Math.min(80, currentEval));
  const whitePct = ((evalClamped + 80) / 160) * 100;

  return (
    <div className="app-container">
      {/* Dynamic Header */}
      <header className="header-container">
        <div className="header-logo-title">
          <div
            style={{
              width: "34px",
              height: "34px",
              background: "linear-gradient(135deg, #2ecc71, #27ae60)",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
              fontSize: "17px",
              color: "#fff",
              boxShadow: "0 0 12px rgba(46, 204, 113, 0.4)",
              flexShrink: 0,
            }}
          >
            Ⅱ
          </div>
          <h1 style={{ margin: 0, fontSize: "18px", fontWeight: 500, letterSpacing: "-0.01em" }}>
            Double Move Chess
          </h1>
        </div>

        {/* Mode Buttons */}
        <div className="header-modes">
          <button
            onClick={() => {
              setGameMode("pvr");
              handleReset();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              cursor: "pointer",
              background: gameMode === "pvr" ? "var(--bg-tertiary)" : "transparent",
              color: gameMode === "pvr" ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: 500,
              fontSize: "13px",
              transition: "all 0.15s ease",
            }}
          >
            <Cpu size={15} /> Player vs Robot
          </button>
          <button
            onClick={() => {
              setGameMode("pvp");
              handleReset();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              cursor: "pointer",
              background: gameMode === "pvp" ? "var(--bg-tertiary)" : "transparent",
              color: gameMode === "pvp" ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: 500,
              fontSize: "13px",
              transition: "all 0.15s ease",
            }}
          >
            <User size={15} /> Local PvP
          </button>
          <button
            onClick={() => setShowDatabase(!showDatabase)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              cursor: "pointer",
              background: showDatabase ? "var(--bg-tertiary)" : "transparent",
              color: showDatabase ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: 500,
              fontSize: "13px",
              transition: "all 0.15s ease",
            }}
          >
            <Database size={15} /> Saved Games
          </button>
        </div>
      </header>

      {/* Main Play Area */}
      <main className="main-container">
        {/* Visual Database Popup Modal */}
        {showDatabase && (
          <div
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              background: "rgba(0,0,0,0.65)",
              zIndex: 100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(4px)",
            }}
          >
            <div
              className="glass-card"
              style={{
                width: "90%",
                maxWidth: "600px",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid var(--border-color)",
                  paddingBottom: "12px",
                }}
              >
                <h3 style={{ margin: 0, fontSize: "18px" }}>Saved Games Database</h3>
                <button
                  onClick={() => setShowDatabase(false)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    fontSize: "18px",
                  }}
                >
                  ✕
                </button>
              </div>

              <div
                style={{
                  maxHeight: "360px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {savedGames.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      color: "var(--text-secondary)",
                      padding: "40px",
                    }}
                  >
                    No saved games found yet. Complete a game to save!
                  </div>
                ) : (
                  savedGames.map((g) => (
                    <div
                      key={g.id}
                      onClick={() => handleStartAnalysis(g)}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 16px",
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "8px",
                        cursor: "pointer",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "rgba(255,255,255,0.06)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "rgba(255,255,255,0.03)")
                      }
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <span style={{ fontSize: "14px", fontWeight: "bold" }}>
                          {g.mode} ({g.moves.length} plies)
                        </span>
                        <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                          {g.date} • {g.result}
                        </span>
                      </div>
                      <button
                        onClick={(e) => deleteGame(g.id, e)}
                        style={{
                          background: "rgba(231,76,60,0.15)",
                          border: "none",
                          color: "#e74c3c",
                          padding: "6px 8px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          transition: "background 0.15s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(231,76,60,0.3)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(231,76,60,0.15)")}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. Interactive Board and Side panel */}
        <div className="game-layout">
          {/* Chessboard container with integrated evaluation bar */}
          <div className="board-wrapper">
            {/* 1. Sleek Evaluation Bar (only shown in Analysis Mode when analysis has started!) */}
            {gameMode === "analysis" && analysisStarted && (
              <div className="eval-bar-vertical">
                {/* White Percentage Bar at bottom */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    width: "100%",
                    height: `${whitePct}%`,
                    backgroundColor: "#ecf0f1",
                    transition: "height 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                />

                {/* Centered evaluation tag text */}
                <div
                  className="eval-bar-text"
                  style={{
                    top: whitePct > 50 ? "12px" : "auto",
                    bottom: whitePct <= 50 ? "12px" : "auto",
                    color: whitePct > 50 ? "#2c3e50" : "#ecf0f1",
                  }}
                >
                  {formatEval(currentEval)}
                </div>
              </div>
            )}

            {/* Chessboard itself */}
            <div className="chessboard-container">
              <Chessboard
                board={gameMode === "analysis" ? analysisBoard : previewBoard}
                onMakeMove={handleMakeMove}
                selectedSq={selectedSq}
                setSelectedSq={setSelectedSq}
                isFlipped={isFlipped}
                interactive={gameMode !== "analysis" && !engineThinking && !gameOver}
                lastMove1={lastMove1}
                lastMove2={lastMove2}
              />
            </div>
          </div>

          {/* Left-sidebar game details */}
          <div className="glass-card side-panel">
            {/* Status Section */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                padding: "14px",
                textAlign: "center",
              }}
            >
              <h3 style={{ margin: "0 0 6px 0", fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                Game Controller
              </h3>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: "bold",
                  color: gameOver ? "var(--accent-orange)" : "var(--text-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                {engineThinking && (
                  <Loader2 size={16} className="animate-spin" style={{ color: "var(--accent-blue)" }} />
                )}
                {gameMode === "analysis" ? getAnalysisStatus() : statusMsg}
              </div>
            </div>

            {/* Config & Settings */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Engine Mode:</span>
                <button
                  onClick={() => setUseNeural(!useNeural)}
                  disabled={loadingModel || !modelActive}
                  style={{
                    fontSize: "11px",
                    fontWeight: "bold",
                    padding: "4px 10px",
                    borderRadius: "4px",
                    border: "1px solid var(--border-color)",
                    cursor: loadingModel || !modelActive ? "not-allowed" : "pointer",
                    background: useNeural && modelActive ? "rgba(46, 204, 113, 0.15)" : "rgba(255, 255, 255, 0.05)",
                    color: useNeural && modelActive ? "var(--accent-green)" : "#ccc",
                    transition: "all 0.15s ease",
                  }}
                >
                  {loadingModel
                    ? "Initializing..."
                    : useNeural && modelActive
                    ? "🧠 Neural Network"
                    : "🧮 Pure Classical"}
                </button>
              </div>

              {gameMode === "pvr" && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Choose Side:</span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      onClick={() => setPlayerColor(WHITE)}
                      disabled={moveHistory.length > 0}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "4px",
                        border: "1px solid var(--border-color)",
                        cursor: "pointer",
                        background: playerColor === WHITE ? "#fff" : "transparent",
                        color: playerColor === WHITE ? "#000" : "#fff",
                        fontSize: "11px",
                        fontWeight: "bold",
                        opacity: moveHistory.length > 0 ? 0.5 : 1,
                      }}
                    >
                      White
                    </button>
                    <button
                      onClick={() => setPlayerColor(BLACK)}
                      disabled={moveHistory.length > 0}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "4px",
                        border: "1px solid var(--border-color)",
                        cursor: "pointer",
                        background: playerColor === BLACK ? "#fff" : "transparent",
                        color: playerColor === BLACK ? "#000" : "#fff",
                        fontSize: "11px",
                        fontWeight: "bold",
                        opacity: moveHistory.length > 0 ? 0.5 : 1,
                      }}
                    >
                      Black
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Move Log */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px", overflow: "hidden" }}>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>Move Log</div>
              <div
                style={{
                  flex: 1,
                  background: "rgba(0,0,0,0.2)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  padding: "10px",
                  overflowY: "auto",
                  fontSize: "13px",
                  display: "grid",
                  gridTemplateColumns: "35px 1fr 1fr",
                  alignContent: "flex-start",
                  gap: "6px 0",
                }}
              >
                {/* Reconstruct turns for rendering */}
                {Array.from({ length: Math.ceil((gameMode === "analysis" ? analysisMoves.length : moveHistory.length) / 4) }).map((_, turnIdx) => {
                  const base = turnIdx * 4;
                  const moves = gameMode === "analysis" ? analysisMoves : moveHistory;
                  const whitePly1 = moves[base] ? moveToString(moves[base]) : "";
                  const whitePly2 = moves[base + 1] ? moveToString(moves[base + 1]) : "";
                  const blackPly1 = moves[base + 2] ? moveToString(moves[base + 2]) : "";
                  const blackPly2 = moves[base + 3] ? moveToString(moves[base + 3]) : "";

                  const wText = [whitePly1, whitePly2].filter(Boolean).join(" ");
                  const bText = [blackPly1, blackPly2].filter(Boolean).join(" ");

                  // Highlight current position in analysis mode
                  const isCurrentWhite = gameMode === "analysis" && (analysisIndex === base || analysisIndex === base + 1);
                  const isCurrentBlack = gameMode === "analysis" && (analysisIndex === base + 2 || analysisIndex === base + 3);

                  return (
                    <React.Fragment key={turnIdx}>
                      <span style={{ color: "var(--text-secondary)" }}>{turnIdx + 1}.</span>
                      <span
                        style={{
                          fontWeight: isCurrentWhite ? "bold" : 500,
                          color: isCurrentWhite ? "var(--accent-green)" : "inherit",
                          cursor: gameMode === "analysis" ? "pointer" : "default",
                          textDecoration: isCurrentWhite ? "underline" : "none",
                        }}
                        onClick={() => {
                          if (gameMode === "analysis") {
                            navigateAnalysis(Math.min(base + 1, analysisMoves.length - 1));
                          }
                        }}
                      >
                        {wText || "..."}
                      </span>
                      <span
                        style={{
                          fontWeight: isCurrentBlack ? "bold" : "normal",
                          color: isCurrentBlack ? "var(--accent-green)" : "var(--text-secondary)",
                          cursor: gameMode === "analysis" && bText ? "pointer" : "default",
                          textDecoration: isCurrentBlack ? "underline" : "none",
                        }}
                        onClick={() => {
                          if (gameMode === "analysis" && bText) {
                            navigateAnalysis(Math.min(base + 3, analysisMoves.length - 1));
                          }
                        }}
                      >
                        {bText || ""}
                      </span>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Analysis Navigation Panel */}
            {gameMode === "analysis" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {/* Navigation row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "rgba(255,255,255,0.03)",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <button onClick={() => navigateAnalysis(-1)} style={{ background:"none",border:"none",color:"var(--text-primary)",cursor:"pointer" }} title="First"><ChevronsLeft size={16}/></button>
                  <button onClick={() => navigateAnalysis(analysisIndex - 1)} style={{ background:"none",border:"none",color:"var(--text-primary)",cursor:"pointer" }} title="Previous"><ChevronLeft size={16}/></button>
                  <span style={{ fontSize:"12px", fontWeight:500, color:"var(--text-secondary)" }}>
                    {analysisIndex + 1} / {analysisMoves.length}
                  </span>
                  <button onClick={() => navigateAnalysis(analysisIndex + 1)} style={{ background:"none",border:"none",color:"var(--text-primary)",cursor:"pointer" }} title="Next"><ChevronRight size={16}/></button>
                  <button onClick={() => navigateAnalysis(analysisMoves.length - 1)} style={{ background:"none",border:"none",color:"var(--text-primary)",cursor:"pointer" }} title="Last"><ChevronsRight size={16}/></button>
                </div>

                {!analysisStarted ? (
                  /* Call to Action: Begin Analysis */
                  <div
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      padding: "16px 14px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "12px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text-secondary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      <Activity size={12} />
                      Engine Analysis
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                      Press begin to run depth-5 analysis on all {analysisMoves.length} moves.
                    </div>
                    <button
                      onClick={handleBeginAnalysis}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        background: "linear-gradient(135deg, var(--accent-green) 0%, #27ae60 100%)",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: "13px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        transition: "all 0.15s ease",
                        boxShadow: "0 4px 12px rgba(46, 204, 113, 0.15)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.filter = "brightness(1.1)";
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.filter = "brightness(1.0)";
                        e.currentTarget.style.transform = "none";
                      }}
                    >
                      <Play size={14} fill="white" />
                      Begin Analysis
                    </button>
                  </div>
                ) : (
                  /* Deep Analysis Result Card */
                  <div
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    {/* Header with progress or badge */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text-secondary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        <Activity size={12} />
                        Engine Analysis
                      </div>
                      {(() => {
                        const cached = analysisIndex >= 0 ? analysisCache[analysisIndex] : null;
                        if (analysisProgress && !cached) {
                          return <span className="spinner" />;
                        }
                        if (cached) {
                          return <span className={`analysis-badge ${cached.badge}`}>{cached.label}</span>;
                        }
                        return null;
                      })()}
                    </div>

                    {/* Progress bar (shown while batch runs) */}
                    {analysisProgress && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                        <div style={{ position: "relative", height: "4px", borderRadius: "2px", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                          <div style={{
                            position: "absolute", left: 0, top: 0, bottom: 0,
                            width: `${(analysisProgress.done / analysisProgress.total) * 100}%`,
                            background: "linear-gradient(90deg, var(--accent-green), #27ae60)",
                            borderRadius: "2px",
                            transition: "width 0.3s ease",
                          }} />
                        </div>
                        <div style={{ fontSize: "10px", color: "var(--text-secondary)", textAlign: "right" }}>
                          Analyzing {analysisProgress.done} / {analysisProgress.total} moves
                        </div>
                      </div>
                    )}

                    {/* Eval + Best move row */}
                    {(() => {
                      const cached = analysisIndex >= 0 ? analysisCache[analysisIndex] : null;
                      return (
                        <div style={{ display: "flex", gap: "8px" }}>
                          <div style={{ flex: 1, background: "rgba(0,0,0,0.2)", borderRadius: "6px", padding: "8px 10px", textAlign: "center" }}>
                            <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "3px" }}>Evaluation</div>
                            <div style={{
                              fontSize: "18px", fontWeight: 700,
                              fontFamily: "'Noto Sans Mono', monospace",
                              color: cached
                                ? (cached.evalAfter > 5 ? "var(--accent-green)" : cached.evalAfter < -5 ? "#e74c3c" : "var(--text-primary)")
                                : "var(--text-secondary)",
                            }}>
                              {cached ? formatEval(cached.evalAfter) : "—"}
                            </div>
                          </div>
                          <div style={{ flex: 1, background: "rgba(0,0,0,0.2)", borderRadius: "6px", padding: "8px 10px", textAlign: "center" }}>
                            <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "3px" }}>Best Move</div>
                            <div style={{ fontSize: "15px", fontWeight: 600, fontFamily: "'Noto Sans Mono', monospace", color: "var(--accent-blue)" }}>
                              {cached ? cached.bestMoveStr : "—"}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Compact eval bar */}
                    {(() => {
                      const cached = analysisIndex >= 0 ? analysisCache[analysisIndex] : null;
                      if (!cached) return null;
                      return (
                        <div style={{ position: "relative", height: "6px", borderRadius: "3px", background: "#2c3e50", overflow: "hidden" }}>
                          <div style={{
                            position: "absolute", left: 0, top: 0, bottom: 0,
                            width: `${((Math.max(-80, Math.min(80, cached.evalAfter)) + 80) / 160) * 100}%`,
                            background: "linear-gradient(90deg, #ecf0f1 0%, #bdc3c7 100%)",
                            borderRadius: "3px",
                            transition: "width 0.4s cubic-bezier(0.4,0,0.2,1)",
                          }} />
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            ) : (
              /* Play Mode Control Panel */
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={handleUndo}
                  disabled={moveHistory.length === 0 || engineThinking}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "10px",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    background: "rgba(255,255,255,0.03)",
                    color: "var(--text-primary)",
                    cursor: moveHistory.length === 0 ? "not-allowed" : "pointer",
                    fontSize: "13px",
                    opacity: moveHistory.length === 0 ? 0.5 : 1,
                  }}
                >
                  <RotateCcw size={14} /> Undo Ply
                </button>
                <button
                  onClick={handleReset}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "10px",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    background: "rgba(231, 76, 60, 0.15)",
                    color: "#e74c3c",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                >
                  Reset Game
                </button>
              </div>
            )}

            {gameMode === "analysis" && (
              <button
                onClick={() => {
                  setGameMode("pvr");
                  handleReset();
                  analysisCancelRef.current++;
                  setAnalysisCache([]);
                  setAnalysisProgress(null);
                  setAnalysisStarted(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "10px",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  background: "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  fontSize: "13px",
                  width: "100%",
                }}
              >
                Exit Analysis Mode
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
