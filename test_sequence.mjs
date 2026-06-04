// Test script for the reported game sequence:
// 1. e2e3 d1f3 | g7g5 f7f5
// 2. f3f5 f5d3 | f8g7 e8f8
// 3. d3f5 f5f8  (mate?)

// ---- Piece Constants ----
const EMPTY = 0;
const PAWN = 1;
const KNIGHT = 2;
const BISHOP = 3;
const ROOK = 4;
const QUEEN = 5;
const KING = 6;
const WHITE = 8;
const BLACK = 16;

// ---- Board ----
class Board {
  constructor() {
    this.squares = new Uint8Array(64);
    this.sideToMove = WHITE;
    this.pliesThisTurn = 0;
    this.activeEpTargets = 0n;
    this.nextEpTargets = 0n;
    this.castlingRights = 15;
    this.setInitialPosition();
  }

  setInitialPosition() {
    this.squares.fill(EMPTY);
    const blackBack = [ROOK|BLACK, KNIGHT|BLACK, BISHOP|BLACK, QUEEN|BLACK, KING|BLACK, BISHOP|BLACK, KNIGHT|BLACK, ROOK|BLACK];
    for (let i = 0; i < 8; i++) {
      this.squares[i] = blackBack[i];
      this.squares[8+i] = PAWN|BLACK;
    }
    const whiteBack = [ROOK|WHITE, KNIGHT|WHITE, BISHOP|WHITE, QUEEN|WHITE, KING|WHITE, BISHOP|WHITE, KNIGHT|WHITE, ROOK|WHITE];
    for (let i = 0; i < 8; i++) {
      this.squares[48+i] = PAWN|WHITE;
      this.squares[56+i] = whiteBack[i];
    }
  }

  clone() {
    const b = new Board();
    b.squares.set(this.squares);
    b.sideToMove = this.sideToMove;
    b.pliesThisTurn = this.pliesThisTurn;
    b.activeEpTargets = this.activeEpTargets;
    b.nextEpTargets = this.nextEpTargets;
    b.castlingRights = this.castlingRights;
    return b;
  }

  getPiece(sq) { return this.squares[sq] & 7; }
  getColor(sq) { return this.squares[sq] & 24; }
  isEmpty(sq) { return this.squares[sq] === EMPTY; }
}

// ---- Move Utilities ----
const FILES = ['a','b','c','d','e','f','g','h'];
const RANKS = ['8','7','6','5','4','3','2','1'];

function sqName(sq) {
  return FILES[sq % 8] + RANKS[Math.floor(sq / 8)];
}

function sqFromAlg(alg) {
  const f = alg.charCodeAt(0) - 'a'.charCodeAt(0);
  const r = 8 - parseInt(alg[1]);
  return r * 8 + f;
}

function parseMoveAlg(alg) {
  // e.g. "e2e3", "d1f3"
  const from = sqFromAlg(alg.slice(0, 2));
  const to = sqFromAlg(alg.slice(2, 4));
  return { from, to };
}

function pieceName(sq, board) {
  const p = board.getPiece(sq);
  const c = board.getColor(sq);
  const names = ['', 'Pawn', 'Knight', 'Bishop', 'Rook', 'Queen', 'King'];
  const colorName = c === WHITE ? 'White' : (c === BLACK ? 'Black' : 'Empty');
  return p === EMPTY ? 'Empty' : `${colorName} ${names[p]}`;
}

// ---- Move generation ----
function generateMoves(board) {
  const moves = [];
  const us = board.sideToMove;
  const them = us === WHITE ? BLACK : WHITE;
  for (let sq = 0; sq < 64; sq++) {
    if (board.getColor(sq) === us) {
      const piece = board.getPiece(sq);
      if (piece === PAWN) generatePawnMoves(board, sq, us, them, moves);
      else if (piece === KNIGHT) generateKnightMoves(board, sq, us, them, moves);
      else if (piece === BISHOP) generateSlidingMoves(board, sq, us, them, moves, [-9,-7,7,9]);
      else if (piece === ROOK) generateSlidingMoves(board, sq, us, them, moves, [-8,-1,1,8]);
      else if (piece === QUEEN) generateSlidingMoves(board, sq, us, them, moves, [-9,-8,-7,-1,1,7,8,9]);
      else if (piece === KING) generateKingMoves(board, sq, us, them, moves);
    }
  }
  return moves;
}

function generatePawnMoves(board, sq, us, them, moves) {
  const forward = us === WHITE ? -8 : 8;
  const startRank = us === WHITE ? 6 : 1;
  const promRank = us === WHITE ? 0 : 7;
  const rank = Math.floor(sq / 8);
  const single = sq + forward;
  if (single >= 0 && single < 64 && board.isEmpty(single)) {
    if (Math.floor(single/8) === promRank) {
      moves.push({from:sq, to:single, captured:EMPTY, promotion:QUEEN});
    } else {
      moves.push({from:sq, to:single, captured:EMPTY, promotion:EMPTY});
      if (rank === startRank) {
        const double = sq + 2*forward;
        if (board.isEmpty(double)) moves.push({from:sq, to:double, captured:EMPTY, promotion:EMPTY});
      }
    }
  }
  for (const offset of [-1,1]) {
    if ((sq%8===0 && offset===-1) || (sq%8===7 && offset===1)) continue;
    const capSq = sq + forward + offset;
    if (capSq >= 0 && capSq < 64) {
      const targetColor = board.getColor(capSq);
      if (targetColor === them) {
        const captured = board.squares[capSq];
        if (Math.floor(capSq/8) === promRank) {
          moves.push({from:sq, to:capSq, captured, promotion:QUEEN});
        } else {
          moves.push({from:sq, to:capSq, captured, promotion:EMPTY});
        }
      } else if (targetColor === EMPTY) {
        if ((board.activeEpTargets & (1n << BigInt(capSq))) !== 0n) {
          const epPawnSq = capSq - forward;
          if (board.squares[epPawnSq] === (PAWN|them)) {
            moves.push({from:sq, to:capSq, captured:PAWN|them, promotion:EMPTY});
          }
        }
      }
    }
  }
}

function generateKnightMoves(board, sq, us, _them, moves) {
  const offsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  const file = sq % 8;
  const rank = Math.floor(sq / 8);
  for (const [df,dr] of offsets) {
    const f = file+df, r = rank+dr;
    if (f>=0 && f<8 && r>=0 && r<8) {
      const target = r*8+f;
      if (board.getColor(target) !== us) {
        moves.push({from:sq, to:target, captured:board.squares[target], promotion:EMPTY});
      }
    }
  }
}

function generateKingMoves(board, sq, us, _them, moves) {
  const offsets = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  const file = sq % 8;
  const rank = Math.floor(sq / 8);
  for (const [df,dr] of offsets) {
    const f = file+df, r = rank+dr;
    if (f>=0 && f<8 && r>=0 && r<8) {
      const target = r*8+f;
      if (board.getColor(target) !== us) {
        moves.push({from:sq, to:target, captured:board.squares[target], promotion:EMPTY});
      }
    }
  }
  if (us===WHITE && sq===60) {
    if ((board.castlingRights&1)!==0 && board.isEmpty(61) && board.isEmpty(62)) moves.push({from:60,to:62,captured:EMPTY,promotion:EMPTY});
    if ((board.castlingRights&2)!==0 && board.isEmpty(59) && board.isEmpty(58) && board.isEmpty(57)) moves.push({from:60,to:58,captured:EMPTY,promotion:EMPTY});
  } else if (us===BLACK && sq===4) {
    if ((board.castlingRights&4)!==0 && board.isEmpty(5) && board.isEmpty(6)) moves.push({from:4,to:6,captured:EMPTY,promotion:EMPTY});
    if ((board.castlingRights&8)!==0 && board.isEmpty(3) && board.isEmpty(2) && board.isEmpty(1)) moves.push({from:4,to:2,captured:EMPTY,promotion:EMPTY});
  }
}

function generateSlidingMoves(board, sq, us, them, moves, directions) {
  const file = sq % 8;
  const rank = Math.floor(sq / 8);
  const deltas = {[-9]:[-1,-1],[-7]:[1,-1],[7]:[-1,1],[9]:[1,1],[-8]:[0,-1],[8]:[0,1],[-1]:[-1,0],[1]:[1,0]};
  for (const dir of directions) {
    const [df,dr] = deltas[dir];
    let f = file, r = rank;
    while (true) {
      f+=df; r+=dr;
      if (f<0||f>7||r<0||r>7) break;
      const target = r*8+f;
      const color = board.getColor(target);
      if (color === us) break;
      moves.push({from:sq, to:target, captured:board.squares[target], promotion:EMPTY});
      if (color === them) break;
    }
  }
}

function makeMove(board, m) {
  const piece = board.squares[m.from];
  const pieceType = piece & 7;
  const us = board.sideToMove;
  const them = us === WHITE ? BLACK : WHITE;

  board.squares[m.from] = EMPTY;

  if (pieceType === PAWN && m.captured !== EMPTY && board.isEmpty(m.to)) {
    const forward = us === WHITE ? -8 : 8;
    board.squares[m.to - forward] = EMPTY;
  }

  if (pieceType === KING) {
    if (m.from===60 && m.to===62) { board.squares[63]=EMPTY; board.squares[61]=ROOK|WHITE; }
    else if (m.from===60 && m.to===58) { board.squares[56]=EMPTY; board.squares[59]=ROOK|WHITE; }
    else if (m.from===4 && m.to===6) { board.squares[7]=EMPTY; board.squares[5]=ROOK|BLACK; }
    else if (m.from===4 && m.to===2) { board.squares[0]=EMPTY; board.squares[3]=ROOK|BLACK; }
  }

  board.squares[m.to] = m.promotion !== EMPTY ? (m.promotion | us) : piece;

  if (pieceType === KING) {
    if (us === WHITE) board.castlingRights &= ~3;
    if (us === BLACK) board.castlingRights &= ~12;
  }
  if (pieceType === ROOK) {
    if (m.from===63) board.castlingRights &= ~1;
    if (m.from===56) board.castlingRights &= ~2;
    if (m.from===7)  board.castlingRights &= ~4;
    if (m.from===0)  board.castlingRights &= ~8;
  }

  if (pieceType === PAWN && Math.abs(m.to - m.from) === 16) {
    const forward = us === WHITE ? -8 : 8;
    board.nextEpTargets |= 1n << BigInt(m.from + forward);
  }

  board.pliesThisTurn += 1;
  if (board.pliesThisTurn === 2) {
    board.pliesThisTurn = 0;
    board.sideToMove = them;
    board.activeEpTargets = board.nextEpTargets;
    board.nextEpTargets = 0n;
  }
}

// ---- Board Display ----
function displayBoard(board, label) {
  const pieceChars = ['.', 'P', 'N', 'B', 'R', 'Q', 'K'];
  console.log(`\n=== ${label} ===`);
  console.log(`  a b c d e f g h`);
  for (let r = 0; r < 8; r++) {
    let row = `${8-r} `;
    for (let f = 0; f < 8; f++) {
      const sq = r*8+f;
      const p = board.getPiece(sq);
      const c = board.getColor(sq);
      if (p === EMPTY) row += '. ';
      else {
        const ch = pieceChars[p];
        row += (c === WHITE ? ch.toUpperCase() : ch.toLowerCase()) + ' ';
      }
    }
    row += `${8-r}`;
    console.log(row);
  }
  console.log(`  a b c d e f g h`);
  console.log(`  Side to move: ${board.sideToMove === WHITE ? 'White' : 'Black'} (ply ${board.pliesThisTurn}/2)`);
}

// ---- Check if king can be captured next ----
function canCaptureKing(board) {
  const moves = generateMoves(board);
  for (const m of moves) {
    if ((m.captured & 7) === KING) return m;
  }
  return null;
}

// ---- Has legal moves ----
function hasLegalMoves(board) {
  return generateMoves(board).length > 0;
}

// ---- Apply move by algebraic notation ----
function applyAlgMove(board, algStr) {
  const { from, to } = parseMoveAlg(algStr);
  const moves = generateMoves(board);
  const found = moves.find(m => m.from === from && m.to === to);
  if (!found) {
    console.log(`  *** ILLEGAL MOVE: ${algStr} (${sqName(from)}->${sqName(to)}) not found in legal moves!`);
    console.log(`  Legal moves from ${sqName(from)}: ${moves.filter(m=>m.from===from).map(m=>sqName(m.to)).join(', ') || 'none'}`);
    console.log(`  Piece on ${sqName(from)}: ${pieceName(from, board)}`);
    return false;
  }
  const capturedPiece = found.captured & 7;
  const capturedColor = found.captured & 24;
  const capNames = ['','Pawn','Knight','Bishop','Rook','Queen','King'];
  const colorStr = capturedColor === WHITE ? 'White' : (capturedColor === BLACK ? 'Black' : '');
  console.log(`  Move ${algStr}: ${pieceName(from, board)} ${sqName(from)}->${sqName(to)}` +
    (found.captured !== EMPTY ? ` captures ${colorStr} ${capNames[capturedPiece]}` : ''));
  makeMove(board, found);
  return true;
}

// ---- Main test ----
const board = new Board();
displayBoard(board, 'Initial Position');

console.log('\n\n====== TURN 1: White plays e2e3, d1f3 ======');
applyAlgMove(board, 'e2e3');
applyAlgMove(board, 'd1f3');
displayBoard(board, 'After White turn 1 (e2e3 d1f3)');

console.log('\n\n====== TURN 1: Black plays g7g5, f7f5 ======');
applyAlgMove(board, 'g7g5');
applyAlgMove(board, 'f7f5');
displayBoard(board, 'After Black turn 1 (g7g5 f7f5)');

console.log('\n\n====== TURN 2: White plays f3f5, f5d3 ======');
applyAlgMove(board, 'f3f5');  // Queen captures f5 pawn
applyAlgMove(board, 'f5d3');  // Wait -- d3 from f5? Let's check
displayBoard(board, 'After White turn 2 (f3f5 f5d3)');

console.log('\n\n====== TURN 2: Black plays f8g7, e8f8 ======');
applyAlgMove(board, 'f8g7');  // Bishop retreats to g7
applyAlgMove(board, 'e8f8');  // King moves to f8
displayBoard(board, 'After Black turn 2 (f8g7 e8f8)');

console.log('\n\n====== TURN 3: White plays d3f5, f5f8 ======');
applyAlgMove(board, 'd3f5');  // Queen goes to f5
applyAlgMove(board, 'f5f8');  // Queen captures f8 King??
displayBoard(board, 'After White turn 3 (d3f5 f5f8)');

// Final analysis
console.log('\n\n====== FINAL ANALYSIS ======');
const finalMoves = generateMoves(board);
console.log(`Legal moves for ${board.sideToMove === WHITE ? 'White' : 'Black'}: ${finalMoves.length}`);

if (finalMoves.length === 0) {
  console.log('RESULT: No legal moves — this is checkmate or stalemate!');
}

// Check if the king can be captured
const kingCapture = canCaptureKing(board);
if (kingCapture) {
  console.log(`King can be captured by moving from ${sqName(kingCapture.from)} to ${sqName(kingCapture.to)}!`);
}

// Check if the white queen reached f8 and captured the black king
const f8piece = board.getPiece(sqFromAlg('f8'));
const f8color = board.getColor(sqFromAlg('f8'));
if (f8piece !== EMPTY) {
  const names = ['','Pawn','Knight','Bishop','Rook','Queen','King'];
  const colorNames = {[WHITE]:'White', [BLACK]:'Black'};
  console.log(`Piece on f8: ${colorNames[f8color]} ${names[f8piece]}`);
}

// Look for black king
let blackKingFound = false;
for (let sq = 0; sq < 64; sq++) {
  if (board.getPiece(sq) === KING && board.getColor(sq) === BLACK) {
    console.log(`Black King is on: ${sqName(sq)}`);
    blackKingFound = true;
  }
}
if (!blackKingFound) {
  console.log('*** BLACK KING WAS CAPTURED — WHITE WINS! ***');
}
