// Diagnose the exact problem:
// 1. What does the bot actually evaluate after Black plays g7g5 f7f5?
// 2. What depth can it see the forced mate?
// 3. What move SHOULD Black play instead?

const EMPTY=0,PAWN=1,KNIGHT=2,BISHOP=3,ROOK=4,QUEEN=5,KING=6,WHITE=8,BLACK=16;
const FILES=['a','b','c','d','e','f','g','h'];
const RANKS=['8','7','6','5','4','3','2','1'];
function sqName(sq){return FILES[sq%8]+RANKS[Math.floor(sq/8)];}
function sqFromAlg(alg){return(8-parseInt(alg[1]))*8+(alg.charCodeAt(0)-97);}
function moveName(m){return sqName(m.from)+sqName(m.to);}

class Board{
  constructor(){this.squares=new Uint8Array(64);this.sideToMove=WHITE;this.pliesThisTurn=0;this.activeEpTargets=0n;this.nextEpTargets=0n;this.castlingRights=15;this.setInitialPosition();}
  setInitialPosition(){this.squares.fill(EMPTY);const bp=[ROOK|BLACK,KNIGHT|BLACK,BISHOP|BLACK,QUEEN|BLACK,KING|BLACK,BISHOP|BLACK,KNIGHT|BLACK,ROOK|BLACK];for(let i=0;i<8;i++){this.squares[i]=bp[i];this.squares[8+i]=PAWN|BLACK;}const wp=[ROOK|WHITE,KNIGHT|WHITE,BISHOP|WHITE,QUEEN|WHITE,KING|WHITE,BISHOP|WHITE,KNIGHT|WHITE,ROOK|WHITE];for(let i=0;i<8;i++){this.squares[48+i]=PAWN|WHITE;this.squares[56+i]=wp[i];}}
  clone(){const b=new Board();b.squares.set(this.squares);b.sideToMove=this.sideToMove;b.pliesThisTurn=this.pliesThisTurn;b.activeEpTargets=this.activeEpTargets;b.nextEpTargets=this.nextEpTargets;b.castlingRights=this.castlingRights;return b;}
  getPiece(sq){return this.squares[sq]&7;}
  getColor(sq){return this.squares[sq]&24;}
  isEmpty(sq){return this.squares[sq]===EMPTY;}
}

function generateMoves(board){const moves=[];const us=board.sideToMove;const them=us===WHITE?BLACK:WHITE;for(let sq=0;sq<64;sq++){if(board.getColor(sq)===us){const p=board.getPiece(sq);if(p===PAWN)genPawn(board,sq,us,them,moves);else if(p===KNIGHT)genKnight(board,sq,us,moves);else if(p===BISHOP)genSlide(board,sq,us,them,moves,[-9,-7,7,9]);else if(p===ROOK)genSlide(board,sq,us,them,moves,[-8,-1,1,8]);else if(p===QUEEN)genSlide(board,sq,us,them,moves,[-9,-8,-7,-1,1,7,8,9]);else if(p===KING)genKing(board,sq,us,moves);}}return moves;}
function genPawn(board,sq,us,them,moves){const fwd=us===WHITE?-8:8;const sr=us===WHITE?6:1;const pr=us===WHITE?0:7;const rk=Math.floor(sq/8);const s=sq+fwd;if(s>=0&&s<64&&board.isEmpty(s)){if(Math.floor(s/8)===pr)moves.push({from:sq,to:s,captured:EMPTY,promotion:QUEEN});else{moves.push({from:sq,to:s,captured:EMPTY,promotion:EMPTY});if(rk===sr){const d=sq+2*fwd;if(board.isEmpty(d))moves.push({from:sq,to:d,captured:EMPTY,promotion:EMPTY});}}}for(const o of[-1,1]){if((sq%8===0&&o===-1)||(sq%8===7&&o===1))continue;const cs=sq+fwd+o;if(cs>=0&&cs<64){const tc=board.getColor(cs);if(tc===them){const cap=board.squares[cs];if(Math.floor(cs/8)===pr)moves.push({from:sq,to:cs,captured:cap,promotion:QUEEN});else moves.push({from:sq,to:cs,captured:cap,promotion:EMPTY});}else if(tc===EMPTY&&(board.activeEpTargets&(1n<<BigInt(cs)))!==0n){const eps=cs-fwd;if(board.squares[eps]===(PAWN|them))moves.push({from:sq,to:cs,captured:PAWN|them,promotion:EMPTY});}}}}
function genKnight(board,sq,us,moves){const offs=[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];const f=sq%8,r=Math.floor(sq/8);for(const[df,dr]of offs){const nf=f+df,nr=r+dr;if(nf>=0&&nf<8&&nr>=0&&nr<8){const t=nr*8+nf;if(board.getColor(t)!==us)moves.push({from:sq,to:t,captured:board.squares[t],promotion:EMPTY});}}}
function genKing(board,sq,us,moves){const offs=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];const f=sq%8,r=Math.floor(sq/8);for(const[df,dr]of offs){const nf=f+df,nr=r+dr;if(nf>=0&&nf<8&&nr>=0&&nr<8){const t=nr*8+nf;if(board.getColor(t)!==us)moves.push({from:sq,to:t,captured:board.squares[t],promotion:EMPTY});}}if(us===WHITE&&sq===60){if((board.castlingRights&1)&&board.isEmpty(61)&&board.isEmpty(62))moves.push({from:60,to:62,captured:EMPTY,promotion:EMPTY});if((board.castlingRights&2)&&board.isEmpty(59)&&board.isEmpty(58)&&board.isEmpty(57))moves.push({from:60,to:58,captured:EMPTY,promotion:EMPTY});}else if(us===BLACK&&sq===4){if((board.castlingRights&4)&&board.isEmpty(5)&&board.isEmpty(6))moves.push({from:4,to:6,captured:EMPTY,promotion:EMPTY});if((board.castlingRights&8)&&board.isEmpty(3)&&board.isEmpty(2)&&board.isEmpty(1))moves.push({from:4,to:2,captured:EMPTY,promotion:EMPTY});}}
const SD={'-9':[-1,-1],'-7':[1,-1],'7':[-1,1],'9':[1,1],'-8':[0,-1],'8':[0,1],'-1':[-1,0],'1':[1,0]};
function genSlide(board,sq,us,them,moves,dirs){const f=sq%8,r=Math.floor(sq/8);for(const d of dirs){const[df,dr]=SD[String(d)];let cf=f,cr=r;while(true){cf+=df;cr+=dr;if(cf<0||cf>7||cr<0||cr>7)break;const t=cr*8+cf;const c=board.getColor(t);if(c===us)break;moves.push({from:sq,to:t,captured:board.squares[t],promotion:EMPTY});if(c===them)break;}}}
function makeMove(board,m){const piece=board.squares[m.from];const pt=piece&7;const us=board.sideToMove;const them=us===WHITE?BLACK:WHITE;board.squares[m.from]=EMPTY;if(pt===PAWN&&m.captured!==EMPTY&&board.isEmpty(m.to)){const fwd=us===WHITE?-8:8;board.squares[m.to-fwd]=EMPTY;}if(pt===KING){if(m.from===60&&m.to===62){board.squares[63]=EMPTY;board.squares[61]=ROOK|WHITE;}else if(m.from===60&&m.to===58){board.squares[56]=EMPTY;board.squares[59]=ROOK|WHITE;}else if(m.from===4&&m.to===6){board.squares[7]=EMPTY;board.squares[5]=ROOK|BLACK;}else if(m.from===4&&m.to===2){board.squares[0]=EMPTY;board.squares[3]=ROOK|BLACK;}}board.squares[m.to]=m.promotion!==EMPTY?(m.promotion|us):piece;if(pt===KING){if(us===WHITE)board.castlingRights&=~3;if(us===BLACK)board.castlingRights&=~12;}if(pt===ROOK){if(m.from===63)board.castlingRights&=~1;if(m.from===56)board.castlingRights&=~2;if(m.from===7)board.castlingRights&=~4;if(m.from===0)board.castlingRights&=~8;}if(pt===PAWN&&Math.abs(m.to-m.from)===16){const fwd=us===WHITE?-8:8;board.nextEpTargets|=1n<<BigInt(m.from+fwd);}board.pliesThisTurn+=1;if(board.pliesThisTurn===2){board.pliesThisTurn=0;board.sideToMove=them;board.activeEpTargets=board.nextEpTargets;board.nextEpTargets=0n;}}

function applyAlg(board,alg){const from=sqFromAlg(alg.slice(0,2));const to=sqFromAlg(alg.slice(2,4));const moves=generateMoves(board);const m=moves.find(m=>m.from===from&&m.to===to);if(!m){console.log(`ILLEGAL: ${alg}`);return false;}makeMove(board,m);return true;}

// ---- Current evaluation (no king safety) ----
const PAWN_VAL=10,KNIGHT_VAL=30,BISHOP_VAL=30,ROOK_VAL=50,QUEEN_VAL=90,KING_VAL=10000;
function evaluateCurrent(board){
  let s=0;
  for(let sq=0;sq<64;sq++){
    const p=board.getPiece(sq);if(p===EMPTY)continue;
    const c=board.getColor(sq);const iw=c===WHITE;
    let v=[0,PAWN_VAL,KNIGHT_VAL,BISHOP_VAL,ROOK_VAL,QUEEN_VAL,KING_VAL][p]||0;
    const f=sq%8,r=Math.floor(sq/8);
    if(p===PAWN)v+=iw?(6-r)*1:(r-1)*1;
    else if(p===KNIGHT||p===BISHOP){const cd=Math.abs(3.5-f)+Math.abs(3.5-r);v+=(7-cd)*0.5;}
    s+=iw?v:-v;
  }
  return s;
}

// ---- New evaluation with king safety ----
function evaluateNew(board){
  let s=0;
  let whiteKingSq=-1, blackKingSq=-1;
  
  for(let sq=0;sq<64;sq++){
    const p=board.getPiece(sq);if(p===EMPTY)continue;
    const c=board.getColor(sq);const iw=c===WHITE;
    let v=[0,PAWN_VAL,KNIGHT_VAL,BISHOP_VAL,ROOK_VAL,QUEEN_VAL,KING_VAL][p]||0;
    const f=sq%8,r=Math.floor(sq/8);
    if(p===PAWN)v+=iw?(6-r)*1:(r-1)*1;
    else if(p===KNIGHT||p===BISHOP){const cd=Math.abs(3.5-f)+Math.abs(3.5-r);v+=(7-cd)*0.5;}
    if(p===KING){if(iw)whiteKingSq=sq;else blackKingSq=sq;}
    s+=iw?v:-v;
  }
  
  // King safety: count missing pawns in the 3 squares directly in front of the king
  // In double-move chess, one exposed diagonal = immediate danger
  if(whiteKingSq>=0){
    const kf=whiteKingSq%8;
    let shield=0;
    // Check the row directly in front of the king (rank above for white)
    for(let df=-1;df<=1;df++){
      const sf=kf+df;
      if(sf<0||sf>7)continue;
      const shieldSq=(Math.floor(whiteKingSq/8)-1)*8+sf;
      if(shieldSq>=0&&board.getPiece(shieldSq)===PAWN&&board.getColor(shieldSq)===WHITE)shield++;
    }
    // Penalty: missing pawns in front of king (-15 each)
    s += (shield - 3) * 15;
  }
  if(blackKingSq>=0){
    const kf=blackKingSq%8;
    let shield=0;
    for(let df=-1;df<=1;df++){
      const sf=kf+df;
      if(sf<0||sf>7)continue;
      const shieldSq=(Math.floor(blackKingSq/8)+1)*8+sf;
      if(shieldSq>=0&&shieldSq<64&&board.getPiece(shieldSq)===PAWN&&board.getColor(shieldSq)===BLACK)shield++;
    }
    s -= (shield - 3) * 15;
  }
  
  return s;
}

function scoreMove(board,m){if(m.captured===EMPTY)return 0;const vt=m.captured&7;if(vt===KING)return 10000000;const vals=[0,10,30,30,50,90,10000];return 1000*vals[vt]-vals[board.getPiece(m.from)];}
function qsearch(evaluateFn,board,alpha,beta){
  const sp=evaluateFn(board);if(sp>5000||sp<-5000)return sp;
  const isMax=board.sideToMove===WHITE;
  if(isMax){if(sp>=beta)return beta;if(sp>alpha)alpha=sp;}else{if(sp<=alpha)return alpha;if(sp<beta)beta=sp;}
  let moves=generateMoves(board).filter(m=>m.captured!==EMPTY);if(moves.length===0)return sp;
  moves.sort((a,b)=>scoreMove(board,b)-scoreMove(board,a));
  if(isMax){let mx=sp;for(const m of moves){const c=board.clone();makeMove(c,m);const s=qsearch(evaluateFn,c,alpha,beta);mx=Math.max(mx,s);alpha=Math.max(alpha,s);if(beta<=alpha)break;}return mx;}
  else{let mn=sp;for(const m of moves){const c=board.clone();makeMove(c,m);const s=qsearch(evaluateFn,c,alpha,beta);mn=Math.min(mn,s);beta=Math.min(beta,s);if(beta<=alpha)break;}return mn;}
}
function alphabeta(evaluateFn,board,depth,alpha,beta){
  const se=evaluateFn(board);if(se>5000||se<-5000)return[se>0?se+depth:se-depth,null];
  if(board.pliesThisTurn===0){const mv=generateMoves(board);for(const m of mv){if((m.captured&7)===KING){return[board.sideToMove===WHITE?10000+depth:-10000-depth,null];}}}
  if(depth===0)return[qsearch(evaluateFn,board,alpha,beta),null];
  let moves=generateMoves(board);if(moves.length===0)return[se,null];
  moves.sort((a,b)=>scoreMove(board,b)-scoreMove(board,a));
  const isMax=board.sideToMove===WHITE;let best=null;
  if(isMax){let mx=-2e6;for(const m of moves){const c=board.clone();makeMove(c,m);const[s]=alphabeta(evaluateFn,c,depth-1,alpha,beta);if(s>mx){mx=s;best=m;}alpha=Math.max(alpha,s);if(beta<=alpha)break;}return[mx,best];}
  else{let mn=2e6;for(const m of moves){const c=board.clone();makeMove(c,m);const[s]=alphabeta(evaluateFn,c,depth-1,alpha,beta);if(s<mn){mn=s;best=m;}beta=Math.min(beta,s);if(beta<=alpha)break;}return[mn,best];}
}

// ===================================================
// TEST 1: What does the bot evaluate f7f5 as, at depth 6?
// ===================================================
console.log('=== TEST 1: What does the bot evaluate Black\'s g7g5 f7f5 as? ===\n');

// Position: White played e2e3 d1f3, now it's Black's turn (pliesThisTurn=0)
const pos_blackTurn = new Board();
applyAlg(pos_blackTurn,'e2e3'); applyAlg(pos_blackTurn,'d1f3');

// Simulate g7g5 as Black's first move (mid-turn), then evaluate what second moves look like
console.log('After White e2e3 d1f3, Black is to move...');
console.log('Evaluating Black\'s candidate second move f7f5 (after g7g5):\n');

const after_g7g5 = pos_blackTurn.clone();
applyAlg(after_g7g5, 'g7g5'); // first ply of Black's turn

// Now evaluate f7f5 at different depths
const f7sq = sqFromAlg('f7'), f5sq = sqFromAlg('f5');
const after_f7f5 = after_g7g5.clone();
const f7f5_move = generateMoves(after_g7g5).find(m=>m.from===f7sq&&m.to===f5sq);
makeMove(after_f7f5, f7f5_move);

// Compare: after g7g5 f7f5, what does each evaluator say?
const evalCurrent = evaluateCurrent(after_f7f5);
const evalNew = evaluateNew(after_f7f5);
console.log(`Static eval (current, no king safety) after g7g5 f7f5: ${evalCurrent}`);
console.log(`Static eval (NEW, with king safety)  after g7g5 f7f5: ${evalNew}`);
console.log('');

// Now check alphabeta at depth 6 — does it see the mate?
console.log('Alphabeta depth 5 evaluation of g7g5 f7f5 position:');
const [scoreD5_old] = alphabeta(evaluateCurrent, after_f7f5, 5, -2e6, 2e6);
const [scoreD5_new] = alphabeta(evaluateNew, after_f7f5, 5, -2e6, 2e6);
console.log(`  Current eval: ${scoreD5_old} (>5000 means White is winning)`);
console.log(`  New eval:     ${scoreD5_new}`);
console.log('');

// Compare with a safe alternative: e7e6 g7g6 (keeps pawn shield)
const after_e7e6 = pos_blackTurn.clone();
applyAlg(after_e7e6, 'e7e6');
const after_g7g6 = after_e7e6.clone();
applyAlg(after_g7g6, 'g7g6');
const evalSafe_old = evaluateCurrent(after_g7g6);
const evalSafe_new = evaluateNew(after_g7g6);
console.log(`Static eval after e7e6 g7g6 (safe): current=${evalSafe_old}, new=${evalSafe_new}`);
console.log('');

// ===================================================
// TEST 2: What is the bot's actual best move for Black at depth 6?
// (the opening search uses depth 6 for pliesThisTurn===0)
// ===================================================
console.log('=== TEST 2: Bot\'s best move for Black (depth 6) — OLD vs NEW eval ===\n');

// Black's first move of its turn (pliesThisTurn=0)
console.log('Finding best first ply for Black with OLD evaluation (depth 6)...');
const [score_old, best_old] = alphabeta(evaluateCurrent, pos_blackTurn, 6, -2e6, 2e6);
console.log(`  Old: score=${score_old}, move=${best_old ? moveName(best_old) : 'none'}`);

console.log('Finding best first ply for Black with NEW evaluation (depth 6)...');
const [score_new, best_new] = alphabeta(evaluateNew, pos_blackTurn, 6, -2e6, 2e6);
console.log(`  New: score=${score_new}, move=${best_new ? moveName(best_new) : 'none'}`);
console.log('');

// ===================================================
// TEST 3: Check if depth 6 sees the forced mate at all
// ===================================================
console.log('=== TEST 3: Does depth 6 see the forced mate after g7g5 f7f5? ===\n');

// Position after both turns (White e2e3 d1f3, Black g7g5 f7f5)
// Now White to move. Does depth 5 find the king capture?
const pos_after_blunder = new Board();
applyAlg(pos_after_blunder,'e2e3'); applyAlg(pos_after_blunder,'d1f3');
applyAlg(pos_after_blunder,'g7g5'); applyAlg(pos_after_blunder,'f7f5');

const [mateScore, mateMove] = alphabeta(evaluateCurrent, pos_after_blunder, 5, -2e6, 2e6);
console.log(`After Black blunder, depth-5 White eval: ${mateScore}`);
if(mateMove) console.log(`  Best White move: ${moveName(mateMove)}`);
if(mateScore > 5000) console.log('  ✅ Engine correctly sees forced win!');
else console.log('  ❌ Engine does NOT see the forced win — horizon problem!');
console.log('');

// Try depth 4
const [mateScore4, mateMove4] = alphabeta(evaluateCurrent, pos_after_blunder, 4, -2e6, 2e6);
console.log(`After Black blunder, depth-4 White eval: ${mateScore4}`);
if(mateMove4) console.log(`  Best White move: ${moveName(mateMove4)}`);
if(mateScore4 > 5000) console.log('  ✅ depth-4 sees it');
else console.log('  ❌ depth-4 does NOT see it');

const [mateScore3] = alphabeta(evaluateCurrent, pos_after_blunder, 3, -2e6, 2e6);
console.log(`After Black blunder, depth-3 White eval: ${mateScore3}  ${mateScore3>5000?'✅':'❌'}`);

const [mateScore2] = alphabeta(evaluateCurrent, pos_after_blunder, 2, -2e6, 2e6);
console.log(`After Black blunder, depth-2 White eval: ${mateScore2}  ${mateScore2>5000?'✅':'❌'}`);

// ===================================================
// TEST 4: With NEW eval, does Black avoid the blunder?
// ===================================================
console.log('\n=== TEST 4: Top Black moves scored by NEW eval (depth 4) ===\n');
// Score ALL of Black's moves from the post e2e3 d1f3 position
const allBlackMoves = generateMoves(pos_blackTurn);
const moveEvals = [];
for (const m of allBlackMoves) {
  const child = pos_blackTurn.clone();
  makeMove(child, m);
  const [s] = alphabeta(evaluateNew, child, 3, -2e6, 2e6);
  moveEvals.push([s, m]);
}
// Sort: Black is minimizing (lower = better for Black)
moveEvals.sort((a,b) => a[0] - b[0]);
console.log('Top 10 Black first-ply moves by score (lower = better for Black):');
for (const [s, m] of moveEvals.slice(0, 10)) {
  console.log(`  ${moveName(m)}  score=${s}`);
}
console.log('\nBottom 10 (worst for Black = what current bot might play):');
for (const [s, m] of moveEvals.slice(-10)) {
  console.log(`  ${moveName(m)}  score=${s}`);
}
