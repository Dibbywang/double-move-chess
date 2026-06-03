import React, { useState, useEffect } from "react";
import { Board, EMPTY } from "../engine/board";
import { generateMoves } from "../engine/moves";
import type { Move } from "../engine/moves";
import { RenderPiece } from "./ChessPieces";

interface ChessboardProps {
  board: Board;
  onMakeMove: (from: number, to: number) => void;
  selectedSq: number | null;
  setSelectedSq: (sq: number | null) => void;
  isFlipped?: boolean;
  interactive?: boolean;
  lastMove1?: Move | null;
  lastMove2?: Move | null;
}

// Synthesize audio using Web Audio API for zero dependencies and instant load!
const playSound = (type: "move" | "capture" | "check") => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === "capture") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === "check") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(450, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(250, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else {
      // standard clean move click
      osc.type = "sine";
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(260, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    }
  } catch (e) {
    // Ignore audio initialization errors due to user interaction policies
  }
};

export const Chessboard: React.FC<ChessboardProps> = ({
  board,
  onMakeMove,
  selectedSq,
  setSelectedSq,
  isFlipped = false,
  interactive = true,
  lastMove1 = null,
  lastMove2 = null,
}) => {
  const [legalDests, setLegalDests] = useState<number[]>([]);
  const activeMoves = generateMoves(board);

  // States for highlights and planning arrows
  const [highlightedSquares, setHighlightedSquares] = useState<Set<number>>(new Set());
  const [arrows, setArrows] = useState<{ from: number; to: number }[]>([]);
  const [rightDragStart, setRightDragStart] = useState<number | null>(null);
  const [rightDragCurrent, setRightDragCurrent] = useState<number | null>(null);

  // Clear drawings when board changes (new move played)
  useEffect(() => {
    setHighlightedSquares(new Set());
    setArrows([]);
  }, [board]);

  // Trigger synthesized audio when moves are played
  useEffect(() => {
    if (lastMove2) {
      if (lastMove2.captured !== EMPTY) {
        playSound("capture");
      } else {
        playSound("move");
      }
    } else if (lastMove1) {
      if (lastMove1.captured !== EMPTY) {
        playSound("capture");
      } else {
        playSound("move");
      }
    }
  }, [lastMove1, lastMove2]);

  // Compute legal destination squares for the currently selected square
  useEffect(() => {
    if (selectedSq === null) {
      setLegalDests([]);
      return;
    }
    const dests = activeMoves
      .filter((m) => m.from === selectedSq)
      .map((m) => m.to);
    setLegalDests(Array.from(new Set(dests)));
  }, [selectedSq, board]);

  const handleSquareClick = (sq: number) => {
    if (!interactive) return;
    if (rightDragStart !== null) return; // Prevent left-click action if we were right-clicking

    // If clicking on a legal destination, make the move!
    if (legalDests.includes(sq)) {
      onMakeMove(selectedSq!, sq);
      setSelectedSq(null);
      return;
    }

    // If clicking on own color piece, select it
    const pieceColor = board.getColor(sq);
    if (pieceColor === board.sideToMove) {
      setSelectedSq(sq);
    } else {
      setSelectedSq(null);
    }
  };

  const handleMouseDown = (e: React.MouseEvent, sq: number) => {
    if (e.button === 0) {
      // Left click: clear all highlights and arrows
      setHighlightedSquares(new Set());
      setArrows([]);
    } else if (e.button === 2) {
      // Right click: start drag
      e.preventDefault();
      setRightDragStart(sq);
      setRightDragCurrent(sq);
    }
  };

  const handleMouseEnter = (sq: number) => {
    if (rightDragStart !== null) {
      setRightDragCurrent(sq);
    }
  };

  const handleMouseUp = (e: React.MouseEvent, sq: number) => {
    if (e.button === 2 && rightDragStart !== null) {
      e.preventDefault();
      if (rightDragStart === sq) {
        // Toggle square highlight
        setHighlightedSquares((prev) => {
          const next = new Set(prev);
          if (next.has(sq)) {
            next.delete(sq);
          } else {
            next.add(sq);
          }
          return next;
        });
      } else {
        // Toggle arrow
        setArrows((prev) => {
          const arrowIndex = prev.findIndex(
            (arrow) => arrow.from === rightDragStart && arrow.to === sq
          );
          if (arrowIndex !== -1) {
            // Remove existing arrow
            return prev.filter((_, idx) => idx !== arrowIndex);
          } else {
            // Add new arrow
            return [...prev, { from: rightDragStart, to: sq }];
          }
        });
      }
      setRightDragStart(null);
      setRightDragCurrent(null);
    }
  };

  const handleBoardMouseUp = (e: React.MouseEvent) => {
    if (e.button === 2) {
      setRightDragStart(null);
      setRightDragCurrent(null);
    }
  };

  // Generate grid mapping based on whether the board is flipped
  const rankIndices = isFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const fileIndices = isFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  const getSquareCoords = (sq: number) => {
    const r = Math.floor(sq / 8);
    const f = sq % 8;
    const rIdx = rankIndices.indexOf(r);
    const fIdx = fileIndices.indexOf(f);
    return {
      x: (fIdx + 0.5) * 12.5,
      y: (rIdx + 0.5) * 12.5,
    };
  };

  const getArrowCoords = (from: number, to: number) => {
    const fromCoords = getSquareCoords(from);
    const toCoords = getSquareCoords(to);
    
    const dx = toCoords.x - fromCoords.x;
    const dy = toCoords.y - fromCoords.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    
    if (len === 0) return { x1: fromCoords.x, y1: fromCoords.y, x2: toCoords.x, y2: toCoords.y };
    
    // Offset the start and end slightly to make it look clean (not overlapping piece centers)
    const startOffset = 2.5; // in %
    const endOffset = 5.0;   // in %
    
    return {
      x1: fromCoords.x + (dx / len) * startOffset,
      y1: fromCoords.y + (dy / len) * startOffset,
      x2: toCoords.x - (dx / len) * endOffset,
      y2: toCoords.y - (dy / len) * endOffset,
    };
  };

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      onMouseUp={handleBoardMouseUp}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(8, 1fr)",
        gridTemplateRows: "repeat(8, 1fr)",
        aspectRatio: "1/1",
        width: "100%",
        borderRadius: "8px",
        overflow: "hidden",
        border: "1px solid var(--border-color)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
        userSelect: "none",
        position: "relative",
        containerType: "inline-size",
      }}
    >
      {/* SVG overlay for planning arrows */}
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        <defs>
          <marker
            id="arrowhead-green"
            markerWidth="8"
            markerHeight="8"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M 0 0 L 6 3 L 0 6 Z" fill="rgba(46, 204, 113, 0.85)" />
          </marker>
        </defs>
        
        {/* Render persistent arrows */}
        {arrows.map((arrow, idx) => {
          const coords = getArrowCoords(arrow.from, arrow.to);
          return (
            <line
              key={idx}
              x1={`${coords.x1}%`}
              y1={`${coords.y1}%`}
              x2={`${coords.x2}%`}
              y2={`${coords.y2}%`}
              stroke="rgba(46, 204, 113, 0.85)"
              strokeWidth="3.5"
              markerEnd="url(#arrowhead-green)"
            />
          );
        })}

        {/* Render active dragging arrow */}
        {rightDragStart !== null && rightDragCurrent !== null && rightDragStart !== rightDragCurrent && (() => {
          const coords = getArrowCoords(rightDragStart, rightDragCurrent);
          return (
            <line
              x1={`${coords.x1}%`}
              y1={`${coords.y1}%`}
              x2={`${coords.x2}%`}
              y2={`${coords.y2}%`}
              stroke="rgba(46, 204, 113, 0.85)"
              strokeWidth="3.5"
              markerEnd="url(#arrowhead-green)"
            />
          );
        })()}
      </svg>

      {rankIndices.map((r) =>
        fileIndices.map((f) => {
          const sq = r * 8 + f;
          const isLight = (r + f) % 2 !== 0;
          const pieceType = board.getPiece(sq);
          const pieceColor = board.getColor(sq);

          // Highlights and visual styling
          const isSelected = selectedSq === sq;
          const isLegalDest = legalDests.includes(sq);
          const hasPiece = pieceType !== EMPTY;
          const isHighlighted = highlightedSquares.has(sq);

          // Check if square is part of last moves
          const isLastMoveFrom =
            (lastMove1 && lastMove1.from === sq) || (lastMove2 && lastMove2.from === sq);
          const isLastMoveTo =
            (lastMove1 && lastMove1.to === sq) || (lastMove2 && lastMove2.to === sq);

          let squareColor = isLight ? "var(--board-light)" : "var(--board-dark)";
          if (isSelected) {
            squareColor = "var(--square-selected)";
          } else if (isLastMoveTo || isLastMoveFrom) {
            squareColor = "var(--square-path)";
          }

          return (
            <div
              key={sq}
              onMouseDown={(e) => handleMouseDown(e, sq)}
              onMouseEnter={() => handleMouseEnter(sq)}
              onMouseUp={(e) => handleMouseUp(e, sq)}
              onClick={() => handleSquareClick(sq)}
              style={{
                backgroundColor: squareColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                cursor: interactive && (pieceColor === board.sideToMove || isLegalDest) ? "pointer" : "default",
                transition: "background-color 0.15s ease",
              }}
            >
              {/* Right-click highlight overlay */}
              {isHighlighted && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundColor: "rgba(243, 156, 18, 0.35)",
                    pointerEvents: "none",
                    zIndex: 1,
                  }}
                />
              )}

              {/* Piece Rendering */}
              {hasPiece && (
                <div
                  className="piece-anim"
                  style={{
                    width: "82%",
                    height: "82%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "transform 0.1s ease",
                    zIndex: 2,
                  }}
                >
                  <RenderPiece type={pieceType} color={pieceColor} />
                </div>
              )}

              {/* Legal Move Indicators (dots for empty squares, ring overlays for captures) */}
              {isLegalDest && (
                <div
                  style={{
                    position: "absolute",
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                    zIndex: 3,
                  }}
                >
                  {hasPiece ? (
                    // Capture highlight: visual ring
                    <div
                      style={{
                        width: "80%",
                        height: "80%",
                        border: "5px solid rgba(46, 204, 113, 0.4)",
                        borderRadius: "50%",
                        boxSizing: "border-box",
                      }}
                    />
                  ) : (
                    // Destination dot
                    <div
                      className="pulse-target"
                      style={{
                        width: "26%",
                        height: "26%",
                        backgroundColor: "rgba(46, 204, 113, 0.7)",
                        borderRadius: "50%",
                        boxShadow: "0 0 8px rgba(46, 204, 113, 0.5)",
                      }}
                    />
                  )}
                </div>
              )}

              {/* Rank and File Labels (only on board edges like Lichess!) */}
              {f === (isFlipped ? 7 : 0) && (
                <span
                  style={{
                    position: "absolute",
                    top: "3px",
                    left: "4px",
                    fontSize: "10px",
                    fontWeight: "bold",
                    color: isLight ? "var(--board-dark)" : "var(--board-light)",
                    pointerEvents: "none",
                    opacity: 0.8,
                    zIndex: 4,
                  }}
                >
                  {8 - r}
                </span>
              )}
              {r === (isFlipped ? 0 : 7) && (
                <span
                  style={{
                    position: "absolute",
                    bottom: "2px",
                    right: "4px",
                    fontSize: "10px",
                    fontWeight: "bold",
                    color: isLight ? "var(--board-dark)" : "var(--board-light)",
                    pointerEvents: "none",
                    opacity: 0.8,
                    zIndex: 4,
                  }}
                >
                  {["a", "b", "c", "d", "e", "f", "g", "h"][f]}
                </span>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};
