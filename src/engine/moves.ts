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

export interface Move {
  from: number;
  to: number;
  promotion: number;
  captured: number;
}

export function moveToKey(m: Move): string {
  return `${m.from}-${m.to}-${m.promotion}`;
}

export function moveToString(m: Move): string {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
  const f1 = files[m.from % 8];
  const r1 = ranks[Math.floor(m.from / 8)];
  const f2 = files[m.to % 8];
  const r2 = ranks[Math.floor(m.to / 8)];
  
  let s = `${f1}${r1}${f2}${r2}`;
  if (m.promotion !== EMPTY) {
    s += {
      [QUEEN]: 'q',
      [ROOK]: 'r',
      [BISHOP]: 'b',
      [KNIGHT]: 'n',
    }[m.promotion] || '';
  }
  return s;
}

export function generateMoves(board: Board): Move[] {
  const moves: Move[] = [];
  const us = board.sideToMove;
  const them = us === WHITE ? BLACK : WHITE;

  for (let sq = 0; sq < 64; sq++) {
    if (board.getColor(sq) === us) {
      const piece = board.getPiece(sq);
      switch (piece) {
        case PAWN:
          generatePawnMoves(board, sq, us, them, moves);
          break;
        case KNIGHT:
          generateKnightMoves(board, sq, us, them, moves);
          break;
        case BISHOP:
          generateSlidingMoves(board, sq, us, them, moves, [-9, -7, 7, 9]);
          break;
        case ROOK:
          generateSlidingMoves(board, sq, us, them, moves, [-8, -1, 1, 8]);
          break;
        case QUEEN:
          generateSlidingMoves(board, sq, us, them, moves, [-9, -8, -7, -1, 1, 7, 8, 9]);
          break;
        case KING:
          generateKingMoves(board, sq, us, them, moves);
          break;
      }
    }
  }
  return moves;
}

function addMove(moves: Move[], from: number, to: number, captured: number, promotion: number) {
  moves.push({ from, to, promotion, captured });
}

function generatePawnMoves(board: Board, sq: number, us: number, them: number, moves: Move[]) {
  const forward = us === WHITE ? -8 : 8;
  const startRank = us === WHITE ? 6 : 1;
  const promRank = us === WHITE ? 0 : 7;
  const rank = Math.floor(sq / 8);

  // Single push
  const single = sq + forward;
  if (single >= 0 && single < 64 && board.isEmpty(single)) {
    if (Math.floor(single / 8) === promRank) {
      addMove(moves, sq, single, EMPTY, QUEEN);
      addMove(moves, sq, single, EMPTY, ROOK);
      addMove(moves, sq, single, EMPTY, BISHOP);
      addMove(moves, sq, single, EMPTY, KNIGHT);
    } else {
      addMove(moves, sq, single, EMPTY, EMPTY);
      // Double push
      if (rank === startRank) {
        const double = sq + 2 * forward;
        if (board.isEmpty(double)) {
          addMove(moves, sq, double, EMPTY, EMPTY);
        }
      }
    }
  }

  // Captures
  for (const offset of [-1, 1]) {
    if ((sq % 8 === 0 && offset === -1) || (sq % 8 === 7 && offset === 1)) {
      continue;
    }
    const capSq = sq + forward + offset;
    if (capSq >= 0 && capSq < 64) {
      const targetColor = board.getColor(capSq);
      if (targetColor === them) {
        const captured = board.squares[capSq];
        if (Math.floor(capSq / 8) === promRank) {
          addMove(moves, sq, capSq, captured, QUEEN);
          addMove(moves, sq, capSq, captured, ROOK);
          addMove(moves, sq, capSq, captured, BISHOP);
          addMove(moves, sq, capSq, captured, KNIGHT);
        } else {
          addMove(moves, sq, capSq, captured, EMPTY);
        }
      } else if (targetColor === EMPTY) {
        // En Passant capture
        if ((board.activeEpTargets & (1n << BigInt(capSq))) !== 0n) {
          const epPawnSq = capSq - forward;
          if (board.squares[epPawnSq] === (PAWN | them)) {
            addMove(moves, sq, capSq, PAWN | them, EMPTY);
          }
        }
      }
    }
  }
}

function generateKnightMoves(board: Board, sq: number, us: number, _them: number, moves: Move[]) {
  const offsets = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
  ];
  const file = sq % 8;
  const rank = Math.floor(sq / 8);

  for (const [df, dr] of offsets) {
    const f = file + df;
    const r = rank + dr;
    if (f >= 0 && f < 8 && r >= 0 && r < 8) {
      const target = r * 8 + f;
      const color = board.getColor(target);
      if (color !== us) {
        addMove(moves, sq, target, board.squares[target], EMPTY);
      }
    }
  }
}

function generateKingMoves(board: Board, sq: number, us: number, _them: number, moves: Move[]) {
  const offsets = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];
  const file = sq % 8;
  const rank = Math.floor(sq / 8);

  for (const [df, dr] of offsets) {
    const f = file + df;
    const r = rank + dr;
    if (f >= 0 && f < 8 && r >= 0 && r < 8) {
      const target = r * 8 + f;
      const color = board.getColor(target);
      if (color !== us) {
        addMove(moves, sq, target, board.squares[target], EMPTY);
      }
    }
  }

  // Castling
  if (us === WHITE && sq === 60) { // e1
    if ((board.castlingRights & 1) !== 0 && board.isEmpty(61) && board.isEmpty(62)) {
      addMove(moves, 60, 62, EMPTY, EMPTY);
    }
    if ((board.castlingRights & 2) !== 0 && board.isEmpty(59) && board.isEmpty(58) && board.isEmpty(57)) {
      addMove(moves, 60, 58, EMPTY, EMPTY);
    }
  } else if (us === BLACK && sq === 4) { // e8
    if ((board.castlingRights & 4) !== 0 && board.isEmpty(5) && board.isEmpty(6)) {
      addMove(moves, 4, 6, EMPTY, EMPTY);
    }
    if ((board.castlingRights & 8) !== 0 && board.isEmpty(3) && board.isEmpty(2) && board.isEmpty(1)) {
      addMove(moves, 4, 2, EMPTY, EMPTY);
    }
  }
}

function generateSlidingMoves(board: Board, sq: number, us: number, them: number, moves: Move[], directions: number[]) {
  const file = sq % 8;
  const rank = Math.floor(sq / 8);

  for (const dir of directions) {
    let df = 0;
    let dr = 0;
    
    switch (dir) {
      case -9: df = -1; dr = -1; break;
      case -7: df = 1; dr = -1; break;
      case 7: df = -1; dr = 1; break;
      case 9: df = 1; dr = 1; break;
      case -8: df = 0; dr = -1; break;
      case 8: df = 0; dr = 1; break;
      case -1: df = -1; dr = 0; break;
      case 1: df = 1; dr = 0; break;
    }

    let f = file;
    let r = rank;

    while (true) {
      f += df;
      r += dr;
      if (f < 0 || f > 7 || r < 0 || r > 7) {
        break;
      }
      const target = r * 8 + f;
      const color = board.getColor(target);
      if (color === us) {
        break;
      }
      addMove(moves, sq, target, board.squares[target], EMPTY);
      if (color === them) {
        break;
      }
    }
  }
}

export function makeMove(board: Board, m: Move) {
  const piece = board.squares[m.from];
  const pieceType = piece & 7;
  const us = board.sideToMove;
  const them = us === WHITE ? BLACK : WHITE;

  board.squares[m.from] = EMPTY;

  // En Passant capture
  if (pieceType === PAWN && m.captured !== EMPTY && board.isEmpty(m.to)) {
    const forward = us === WHITE ? -8 : 8;
    const epPawnSq = m.to - forward;
    board.squares[epPawnSq] = EMPTY;
  }

  // Castling
  if (pieceType === KING) {
    if (m.from === 60 && m.to === 62) {
      board.squares[63] = EMPTY;
      board.squares[61] = ROOK | WHITE;
    } else if (m.from === 60 && m.to === 58) {
      board.squares[56] = EMPTY;
      board.squares[59] = ROOK | WHITE;
    } else if (m.from === 4 && m.to === 6) {
      board.squares[7] = EMPTY;
      board.squares[5] = ROOK | BLACK;
    } else if (m.from === 4 && m.to === 2) {
      board.squares[0] = EMPTY;
      board.squares[3] = ROOK | BLACK;
    }
  }

  // Place piece
  if (m.promotion !== EMPTY) {
    board.squares[m.to] = m.promotion | us;
  } else {
    board.squares[m.to] = piece;
  }

  // Update castling rights
  if (pieceType === KING) {
    if (us === WHITE) board.castlingRights &= ~3;
    if (us === BLACK) board.castlingRights &= ~12;
  }
  if (pieceType === ROOK) {
    if (m.from === 63) board.castlingRights &= ~1;
    if (m.from === 56) board.castlingRights &= ~2;
    if (m.from === 7) board.castlingRights &= ~4;
    if (m.from === 0) board.castlingRights &= ~8;
  }
  if (m.to === 63) board.castlingRights &= ~1;
  if (m.to === 56) board.castlingRights &= ~2;
  if (m.to === 7) board.castlingRights &= ~4;
  if (m.to === 0) board.castlingRights &= ~8;

  // Update next EP targets
  if (pieceType === PAWN) {
    const dist = Math.abs(m.to - m.from);
    if (dist === 16) {
      const forward = us === WHITE ? -8 : 8;
      const skipped = m.from + forward;
      board.nextEpTargets |= 1n << BigInt(skipped);
    }
  }

  // Turn tracking — White gets 1 ply only on turn 0 (to balance opening advantage);
  // all other turns allow 2 plies.
  board.pliesThisTurn += 1;
  if (board.pliesThisTurn >= board.pliesAllowedThisTurn) {
    board.pliesThisTurn = 0;
    // Increment turn counter when Black finishes (completing a full round White+Black)
    if (us === BLACK) {
      board.turnNumber += 1;
    } else if (board.turnNumber === 0) {
      // White's handicapped first turn: also increment so we don't loop on turn 0
      board.turnNumber += 1;
    }
    board.sideToMove = them;
    board.activeEpTargets = board.nextEpTargets;
    board.nextEpTargets = 0n;
  }
}
