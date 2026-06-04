import * as ort from "onnxruntime-web";
import {
  Board,
  EMPTY,
  PAWN,
  KNIGHT,
  BISHOP,
  ROOK,
  QUEEN,
  KING,
  WHITE,
  BLACK,
} from "./board";
import { generateMoves, makeMove } from "./moves";
import type { Move } from "./moves";

// Initialize onnxruntime web assembly options
ort.env.wasm.numThreads = 1;
// We configure wasmPaths to point to local assets or cdn if needed, 
// but by default Vite will serve Ort's wasm files from node_modules if we copy them,
// or we can load them from unpkg CDN for absolute ease of client-side execution!
ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/";

let session: ort.InferenceSession | null = null;
let modelLoading = false;

export async function getModelLoadingState(): Promise<boolean> {
  return modelLoading;
}

export async function loadModel(): Promise<boolean> {
  if (session) return true;
  modelLoading = true;
  try {
    console.log("Loading model.onnx inside browser...");
    // Load model from public root directory (relative path for GitHub Pages compatibility)
    session = await ort.InferenceSession.create("model.onnx", {
      executionProviders: ["wasm"],
    });
    console.log("ONNX Model loaded successfully in browser!");
    modelLoading = false;
    return true;
  } catch (e) {
    console.error("ONNX Model load failed, falling back to classical engine:", e);
    modelLoading = false;
    return false;
  }
}

const PIECE_TO_INDEX: Record<string, number> = {
  'P': 0, 'N': 1, 'B': 2, 'R': 3, 'Q': 4, 'K': 5,   // White pieces
  'p': 6, 'n': 7, 'b': 8, 'r': 9, 'q': 10, 'k': 11  // Black pieces
};

export function boardToString(board: Board): string {
  let s = "";
  for (let sq = 0; sq < 64; sq++) {
    const p = board.getPiece(sq);
    const c = board.getColor(sq);
    let ch = ".";
    if (p !== EMPTY) {
      ch = ['?', 'p', 'n', 'b', 'r', 'q', 'k'][p] || '.';
      if (c === WHITE) {
        ch = ch.toUpperCase();
      }
    }
    s += ch;
  }
  return s;
}

export async function evaluateNeural(board: Board): Promise<number> {
  const staticVal = evaluate(board);
  if (Math.abs(staticVal) > 80) {
    return staticVal;
  }

  // 1-Ply minimax lookahead for mid-turn states
  if (board.pliesThisTurn === 1) {
    const moves = generateMoves(board);
    if (moves.length === 0) {
      return staticVal;
    }
    const isMaximizing = board.sideToMove === WHITE;
    let bestVal = isMaximizing ? -1000000 : 1000000;
    let evaluatedAny = false;

    for (const m of moves) {
      const child = board.clone();
      makeMove(child, m);
      const childVal = await evaluateNeural(child);
      evaluatedAny = true;
      if (isMaximizing) {
        bestVal = Math.max(bestVal, childVal);
      } else {
        bestVal = Math.min(bestVal, childVal);
      }
    }
    return evaluatedAny ? bestVal : staticVal;
  }

  if (!session) {
    return staticVal;
  }

  try {
    const data = new Float32Array(13 * 8 * 8);
    const boardStr = boardToString(board);

    for (let sq = 0; sq < 64; sq++) {
      const piece = boardStr[sq];
      if (piece in PIECE_TO_INDEX) {
        const cIdx = PIECE_TO_INDEX[piece];
        data[cIdx * 64 + sq] = 1.0;
      }
    }

    if (board.sideToMove === WHITE) {
      for (let i = 0; i < 64; i++) {
        data[12 * 64 + i] = 1.0;
      }
    }

    const inputTensor = new ort.Tensor("float32", data, [1, 13, 8, 8]);
    const inputName = session.inputNames[0];
    const results = await session.run({ [inputName]: inputTensor });
    const outputTensor = results[Object.keys(results)[0]];
    const val = (outputTensor.data as Float32Array)[0];

    // Output is in pawns. Scale to decipawns (x10) to match internal scale.
    return val * 10.0;
  } catch (e) {
    console.error("ONNX evaluation runtime error:", e);
    return staticVal;
  }
}

const PAWN_VAL = 10;
const KNIGHT_VAL = 30;
const BISHOP_VAL = 30;
const ROOK_VAL = 50;
const QUEEN_VAL = 90;
const KING_VAL = 10000;

// Returns true if the king on kingSq is directly attacked by any piece of attackerColor.
// This detects "check" — positions where the opponent can capture the king in ONE ply.
// In double-move chess this is critical: an attacked king means guaranteed loss on the
// opponent's NEXT half-move (they capture king as their ply 1, then have a free ply 2).
function isKingAttackedBy(board: Board, kingSq: number, attackerColor: number): boolean {
  const kf = kingSq % 8;
  const kr = Math.floor(kingSq / 8);

  // Sliding pieces: check rook/queen along ranks and files
  for (const [df, dr] of [[0,-1],[0,1],[-1,0],[1,0]]) {
    let f = kf + df, r = kr + dr;
    while (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
      const sq = r * 8 + f;
      const p = board.getPiece(sq);
      if (p !== EMPTY) {
        if (board.getColor(sq) === attackerColor && (p === ROOK || p === QUEEN)) return true;
        break;
      }
      f += df; r += dr;
    }
  }

  // Sliding pieces: check bishop/queen along diagonals
  for (const [df, dr] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
    let f = kf + df, r = kr + dr;
    while (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
      const sq = r * 8 + f;
      const p = board.getPiece(sq);
      if (p !== EMPTY) {
        if (board.getColor(sq) === attackerColor && (p === BISHOP || p === QUEEN)) return true;
        break;
      }
      f += df; r += dr;
    }
  }

  // Knight attacks
  for (const [df, dr] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
    const f = kf + df, r = kr + dr;
    if (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
      const sq = r * 8 + f;
      if (board.getPiece(sq) === KNIGHT && board.getColor(sq) === attackerColor) return true;
    }
  }

  // Pawn attacks: white pawns attack from below (higher row index), black from above (lower)
  const pawnRow = attackerColor === WHITE ? kr + 1 : kr - 1;
  for (const df of [-1, 1]) {
    const f = kf + df;
    if (f >= 0 && f <= 7 && pawnRow >= 0 && pawnRow <= 7) {
      const sq = pawnRow * 8 + f;
      if (board.getPiece(sq) === PAWN && board.getColor(sq) === attackerColor) return true;
    }
  }

  return false;
}

export function evaluate(board: Board): number {
  let score = 0;
  let whiteKingSq = -1;
  let blackKingSq = -1;

  for (let sq = 0; sq < 64; sq++) {
    const piece = board.getPiece(sq);
    if (piece !== EMPTY) {
      let val = 0;
      switch (piece) {
        case PAWN: val = PAWN_VAL; break;
        case KNIGHT: val = KNIGHT_VAL; break;
        case BISHOP: val = BISHOP_VAL; break;
        case ROOK: val = ROOK_VAL; break;
        case QUEEN: val = QUEEN_VAL; break;
        case KING: val = KING_VAL; break;
      }
      const file = sq % 8;
      const rank = Math.floor(sq / 8);
      const isWhite = board.getColor(sq) === WHITE;

      if (piece === KING) {
        if (isWhite) whiteKingSq = sq;
        else blackKingSq = sq;
      }

      if (piece === PAWN) {
        val += isWhite ? (6 - rank) * 1 : (rank - 1) * 1;
      } else if (piece === KNIGHT || piece === BISHOP) {
        const centerDist = Math.abs(3.5 - file) + Math.abs(3.5 - rank);
        val += (7 - centerDist) * 0.5;
      }

      if (isWhite) {
        score += val;
      } else {
        score -= val;
      }
    }
  }

  // King safety: penalize for each missing pawn in the 3-square shield directly
  // in front of the king. In double-move chess an open diagonal/file is lethal
  // because the queen can cover 2 squares in a single turn.
  const KING_SAFETY_PENALTY = 20; // per missing shield pawn
  if (whiteKingSq >= 0) {
    const kr = Math.floor(whiteKingSq / 8);
    const kf = whiteKingSq % 8;
    let shield = 0;
    for (let df = -1; df <= 1; df++) {
      const sf = kf + df;
      const shieldSq = (kr - 1) * 8 + sf;
      if (sf >= 0 && sf <= 7 && kr > 0 &&
          board.getPiece(shieldSq) === PAWN && board.getColor(shieldSq) === WHITE) {
        shield++;
      }
    }
    score += (shield - 3) * KING_SAFETY_PENALTY;
  }
  if (blackKingSq >= 0) {
    const kr = Math.floor(blackKingSq / 8);
    const kf = blackKingSq % 8;
    let shield = 0;
    for (let df = -1; df <= 1; df++) {
      const sf = kf + df;
      const shieldSq = (kr + 1) * 8 + sf;
      if (sf >= 0 && sf <= 7 && kr < 7 &&
          board.getPiece(shieldSq) === PAWN && board.getColor(shieldSq) === BLACK) {
        shield++;
      }
    }
    score -= (shield - 3) * KING_SAFETY_PENALTY;
  }

  // Direct king attack penalty: if any enemy piece can capture the king in ONE PLY,
  // the position is essentially a forced loss — the opponent just wins on their next move.
  // This prevents the horizon effect where a king threat falls just outside search depth.
  const KING_ATTACK_PENALTY = 500;
  if (whiteKingSq >= 0 && isKingAttackedBy(board, whiteKingSq, BLACK)) {
    score -= KING_ATTACK_PENALTY;
  }
  if (blackKingSq >= 0 && isKingAttackedBy(board, blackKingSq, WHITE)) {
    score += KING_ATTACK_PENALTY;
  }

  return score;
}

function scoreMove(board: Board, m: Move): number {
  let score = 0;
  if (m.captured !== EMPTY) {
    const victimType = m.captured & 7;
    const attackerType = board.getPiece(m.from);
    const victimVal = [0, 10, 30, 30, 50, 90, 10000][victimType] || 0;
    const attackerVal = [0, 10, 30, 30, 50, 90, 10000][attackerType] || 0;

    if (victimType === KING) {
      score += 10000000;
    } else {
      score += 1000 * victimVal - attackerVal;
    }
  }
  if (m.promotion !== EMPTY) {
    score += 800;
  }
  return score;
}

export function qsearch(board: Board, alpha: number, beta: number): number {
  const standPat = evaluate(board);
  if (standPat > 5000 || standPat < -5000) {
    return standPat;
  }

  const isMaximizing = board.sideToMove === WHITE;

  if (isMaximizing) {
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;
  } else {
    if (standPat <= alpha) return alpha;
    if (standPat < beta) beta = standPat;
  }

  let moves = generateMoves(board);
  // Filter only captures
  moves = moves.filter(m => m.captured !== EMPTY);
  if (moves.length === 0) {
    return standPat;
  }

  const scoredMoves = moves.map(m => ({ move: m, score: scoreMove(board, m) }));
  scoredMoves.sort((a, b) => b.score - a.score);
  moves = scoredMoves.map(x => x.move);

  if (isMaximizing) {
    let maxEval = standPat;
    for (const m of moves) {
      const child = board.clone();
      makeMove(child, m);
      const score = qsearch(child, alpha, beta);
      maxEval = Math.max(maxEval, score);
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = standPat;
    for (const m of moves) {
      const child = board.clone();
      makeMove(child, m);
      const score = qsearch(child, alpha, beta);
      minEval = Math.min(minEval, score);
      beta = Math.min(beta, score);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

export function alphabeta(board: Board, depth: number, alpha: number, beta: number): [number, Move | null] {
  const staticEval = evaluate(board);
  if (staticEval > 5000 || staticEval < -5000) {
    const adj = staticEval > 0 ? staticEval + depth : staticEval - depth;
    return [adj, null];
  }

  // Direct King Attack Check: at the start of ANY turn (both ply 0 and ply 1) check if
  // the current side can immediately capture the opponent's king. This catches the case
  // where the opponent left their king exposed mid-turn as well as at turn boundaries.
  {
    const moves = generateMoves(board);
    for (const m of moves) {
      if (m.captured !== EMPTY && (m.captured & 7) === KING) {
        const winScore = board.sideToMove === WHITE ? 10000 + depth : -10000 - depth;
        return [winScore, null];
      }
    }
  }

  if (depth === 0) {
    return [qsearch(board, alpha, beta), null];
  }

  let moves = generateMoves(board);
  if (moves.length === 0) {
    return [staticEval, null];
  }

  // Sort moves
  const scoredMoves = moves.map(m => ({ move: m, score: scoreMove(board, m) }));
  scoredMoves.sort((a, b) => b.score - a.score);
  moves = scoredMoves.map(x => x.move);

  const isMaximizing = board.sideToMove === WHITE;
  let bestMove: Move | null = null;

  if (isMaximizing) {
    let maxEval = -2000000;
    for (const m of moves) {
      const child = board.clone();
      makeMove(child, m);
      const [score] = alphabeta(child, depth - 1, alpha, beta);
      if (score > maxEval) {
        maxEval = score;
        bestMove = m;
      }
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break;
    }
    return [maxEval, bestMove];
  } else {
    let minEval = 2000000;
    for (const m of moves) {
      const child = board.clone();
      makeMove(child, m);
      const [score] = alphabeta(child, depth - 1, alpha, beta);
      if (score < minEval) {
        minEval = score;
        bestMove = m;
      }
      beta = Math.min(beta, score);
      if (beta <= alpha) break;
    }
    return [minEval, bestMove];
  }
}

export async function search(board: Board, plies: number, useNeural: boolean): Promise<[number, Move | null]> {
  let moves = generateMoves(board);
  if (moves.length === 0) {
    const evalVal = useNeural && session ? await evaluateNeural(board) : evaluate(board);
    return [evalVal, null];
  }

  // Safeguard: Capture opponent king immediately to win
  for (const m of moves) {
    if (m.captured !== EMPTY && (m.captured & 7) === KING) {
      const winScore = board.sideToMove === WHITE ? 10000 + plies : -10000 - plies;
      return [winScore, m];
    }
  }

  // Sort moves
  const scoredMoves = moves.map(m => ({ move: m, score: scoreMove(board, m) }));
  scoredMoves.sort((a, b) => b.score - a.score);
  moves = scoredMoves.map(x => x.move);

  const isMaximizing = board.sideToMove === WHITE;
  const moveScores: [number, Move][] = [];

  if (useNeural && session) {
    if (board.pliesThisTurn === 0) {
      // Ply 1 of our turn: plan BOTH moves together
      for (const m1 of moves) {
        const child = board.clone();
        makeMove(child, m1);
        const childStatic = evaluate(child);
        if (childStatic > 5000 || childStatic < -5000) {
          moveScores.push([childStatic, m1]);
          continue;
        }

        const childMoves = generateMoves(child);
        if (childMoves.length === 0) {
          const baseScore = await evaluateNeural(child);
          moveScores.push([baseScore, m1]);
          continue;
        }

        const isMax = child.sideToMove === WHITE;
        let bestM2Score = isMax ? -1000000 : 1000000;

        for (const m2 of childMoves) {
          if (m2.captured !== EMPTY && (m2.captured & 7) === KING) {
            bestM2Score = isMax ? 10000 : -10000;
            break;
          }
          const grandchild = child.clone();
          makeMove(grandchild, m2);
          const grandchildStatic = evaluate(grandchild);
          const baseScore = (grandchildStatic > 5000 || grandchildStatic < -5000)
            ? grandchildStatic
            : await evaluateNeural(grandchild);

          // Fast 2-ply classical tactical search to protect pieces
          const [tacticalScore] = alphabeta(grandchild, 2, -2000000, 2000000);
          const score = baseScore + (tacticalScore - grandchildStatic);

          if (isMax) {
            bestM2Score = Math.max(bestM2Score, score);
          } else {
            bestM2Score = Math.min(bestM2Score, score);
          }
        }
        moveScores.push([bestM2Score, m1]);
      }
    } else {
      // Ply 2 of our turn: just complete the turn, looking ahead to the opponent's reply
      for (const m1 of moves) {
        const child = board.clone();
        makeMove(child, m1);
        const childStatic = evaluate(child);
        const baseScore = (childStatic > 5000 || childStatic < -5000)
          ? childStatic
          : await evaluateNeural(child);

        const [tacticalScore] = alphabeta(child, 2, -2000000, 2000000);
        const score = baseScore + (tacticalScore - childStatic);
        moveScores.push([score, m1]);
      }
    }
  } else {
    // Classical alpha-beta search (3 full turns = 6 plies)
    let alpha = -2000000;
    let beta = 2000000;
    for (const m of moves) {
      const child = board.clone();
      makeMove(child, m);
      const [score] = alphabeta(child, plies - 1, alpha, beta);
      moveScores.push([score, m]);
      if (isMaximizing) {
        alpha = Math.max(alpha, score);
      } else {
        beta = Math.min(beta, score);
      }
    }
  }

  if (moveScores.length === 0) {
    return [evaluate(board), null];
  }

  const scoresOnly = moveScores.map(x => x[0]);
  const maxScore = Math.max(...scoresOnly);
  const minScore = Math.min(...scoresOnly);

  // Mate check
  if ((isMaximizing && maxScore > 5000) || (!isMaximizing && minScore < -5000)) {
    const target = isMaximizing ? maxScore : minScore;
    const bestEntry = moveScores.find(x => x[0] === target)!;
    return [bestEntry[0], bestEntry[1]];
  }

  const bestScore = isMaximizing ? maxScore : minScore;
  const bestEntry = moveScores.find(x => x[0] === bestScore)!;
  return bestEntry;
}
