// Deeper analysis: Why does this sequence work?
// Specifically — could the bot have defended at each step?

// [Paste all the engine code first]
const EMPTY = 0; const PAWN = 1; const KNIGHT = 2; const BISHOP = 3;
const ROOK = 4; const QUEEN = 5; const KING = 6;
const WHITE = 8; const BLACK = 16;
const FILES = ['a','b','c','d','e','f','g','h'];
const RANKS = ['8','7','6','5','4','3','2','1'];
function sqName(sq) { return FILES[sq%8]+RANKS[Math.floor(sq/8)]; }
function sqFromAlg(alg) { return (8-parseInt(alg[1]))*8 + (alg.charCodeAt(0)-97); }

class Board {
  constructor() {
    this.squares = new Uint8Array(64);
    this.sideToMove = WHITE; this.pliesThisTurn = 0;
    this.activeEpTargets = 0n; this.nextEpTargets = 0n; this.castlingRights = 15;
    this.setInitialPosition();
  }
  setInitialPosition() {
    this.squares.fill(EMPTY);
    const bp=[ROOK|BLACK,KNIGHT|BLACK,BISHOP|BLACK,QUEEN|BLACK,KING|BLACK,BISHOP|BLACK,KNIGHT|BLACK,ROOK|BLACK];
    for (let i=0;i<8;i++){this.squares[i]=bp[i]; this.squares[8+i]=PAWN|BLACK;}
    const wp=[ROOK|WHITE,KNIGHT|WHITE,BISHOP|WHITE,QUEEN|WHITE,KING|WHITE,BISHOP|WHITE,KNIGHT|WHITE,ROOK|WHITE];
    for (let i=0;i<8;i++){this.squares[48+i]=PAWN|WHITE; this.squares[56+i]=wp[i];}
  }
  clone(){const b=new Board();b.squares.set(this.squares);b.sideToMove=this.sideToMove;
    b.pliesThisTurn=this.pliesThisTurn;b.activeEpTargets=this.activeEpTargets;
    b.nextEpTargets=this.nextEpTargets;b.castlingRights=this.castlingRights;return b;}
  getPiece(sq){return this.squares[sq]&7;}
  getColor(sq){return this.squares[sq]&24;}
  isEmpty(sq){return this.squares[sq]===EMPTY;}
}

function generateMoves(board) {
  const moves=[]; const us=board.sideToMove; const them=us===WHITE?BLACK:WHITE;
  for(let sq=0;sq<64;sq++){
    if(board.getColor(sq)===us){
      const p=board.getPiece(sq);
      if(p===PAWN) genPawn(board,sq,us,them,moves);
      else if(p===KNIGHT) genKnight(board,sq,us,moves);
      else if(p===BISHOP) genSlide(board,sq,us,them,moves,[-9,-7,7,9]);
      else if(p===ROOK) genSlide(board,sq,us,them,moves,[-8,-1,1,8]);
      else if(p===QUEEN) genSlide(board,sq,us,them,moves,[-9,-8,-7,-1,1,7,8,9]);
      else if(p===KING) genKing(board,sq,us,moves);
    }
  }
  return moves;
}
function genPawn(board,sq,us,them,moves){
  const fwd=us===WHITE?-8:8; const sr=us===WHITE?6:1; const pr=us===WHITE?0:7;
  const rk=Math.floor(sq/8); const s=sq+fwd;
  if(s>=0&&s<64&&board.isEmpty(s)){
    if(Math.floor(s/8)===pr) moves.push({from:sq,to:s,captured:EMPTY,promotion:QUEEN});
    else{moves.push({from:sq,to:s,captured:EMPTY,promotion:EMPTY});
      if(rk===sr){const d=sq+2*fwd;if(board.isEmpty(d))moves.push({from:sq,to:d,captured:EMPTY,promotion:EMPTY});}}
  }
  for(const o of[-1,1]){
    if((sq%8===0&&o===-1)||(sq%8===7&&o===1))continue;
    const cs=sq+fwd+o;
    if(cs>=0&&cs<64){
      const tc=board.getColor(cs);
      if(tc===them){const cap=board.squares[cs];
        if(Math.floor(cs/8)===pr)moves.push({from:sq,to:cs,captured:cap,promotion:QUEEN});
        else moves.push({from:sq,to:cs,captured:cap,promotion:EMPTY});}
      else if(tc===EMPTY&&(board.activeEpTargets&(1n<<BigInt(cs)))!==0n){
        const eps=cs-fwd;
        if(board.squares[eps]===(PAWN|them))moves.push({from:sq,to:cs,captured:PAWN|them,promotion:EMPTY});}
    }
  }
}
function genKnight(board,sq,us,moves){
  const offs=[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  const f=sq%8,r=Math.floor(sq/8);
  for(const[df,dr]of offs){const nf=f+df,nr=r+dr;
    if(nf>=0&&nf<8&&nr>=0&&nr<8){const t=nr*8+nf;if(board.getColor(t)!==us)moves.push({from:sq,to:t,captured:board.squares[t],promotion:EMPTY});}}
}
function genKing(board,sq,us,moves){
  const offs=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  const f=sq%8,r=Math.floor(sq/8);
  for(const[df,dr]of offs){const nf=f+df,nr=r+dr;
    if(nf>=0&&nf<8&&nr>=0&&nr<8){const t=nr*8+nf;if(board.getColor(t)!==us)moves.push({from:sq,to:t,captured:board.squares[t],promotion:EMPTY});}}
  if(us===WHITE&&sq===60){
    if((board.castlingRights&1)&&board.isEmpty(61)&&board.isEmpty(62))moves.push({from:60,to:62,captured:EMPTY,promotion:EMPTY});
    if((board.castlingRights&2)&&board.isEmpty(59)&&board.isEmpty(58)&&board.isEmpty(57))moves.push({from:60,to:58,captured:EMPTY,promotion:EMPTY});
  } else if(us===BLACK&&sq===4){
    if((board.castlingRights&4)&&board.isEmpty(5)&&board.isEmpty(6))moves.push({from:4,to:6,captured:EMPTY,promotion:EMPTY});
    if((board.castlingRights&8)&&board.isEmpty(3)&&board.isEmpty(2)&&board.isEmpty(1))moves.push({from:4,to:2,captured:EMPTY,promotion:EMPTY});
  }
}
const slideDeltas={'-9':[-1,-1],'-7':[1,-1],'7':[-1,1],'9':[1,1],'-8':[0,-1],'8':[0,1],'-1':[-1,0],'1':[1,0]};
function genSlide(board,sq,us,them,moves,dirs){
  const f=sq%8,r=Math.floor(sq/8);
  for(const d of dirs){const[df,dr]=slideDeltas[String(d)];
    let cf=f,cr=r;
    while(true){cf+=df;cr+=dr;if(cf<0||cf>7||cr<0||cr>7)break;
      const t=cr*8+cf;const c=board.getColor(t);
      if(c===us)break;
      moves.push({from:sq,to:t,captured:board.squares[t],promotion:EMPTY});
      if(c===them)break;}}
}
function makeMove(board,m){
  const piece=board.squares[m.from];const pt=piece&7;
  const us=board.sideToMove;const them=us===WHITE?BLACK:WHITE;
  board.squares[m.from]=EMPTY;
  if(pt===PAWN&&m.captured!==EMPTY&&board.isEmpty(m.to)){const fwd=us===WHITE?-8:8;board.squares[m.to-fwd]=EMPTY;}
  if(pt===KING){
    if(m.from===60&&m.to===62){board.squares[63]=EMPTY;board.squares[61]=ROOK|WHITE;}
    else if(m.from===60&&m.to===58){board.squares[56]=EMPTY;board.squares[59]=ROOK|WHITE;}
    else if(m.from===4&&m.to===6){board.squares[7]=EMPTY;board.squares[5]=ROOK|BLACK;}
    else if(m.from===4&&m.to===2){board.squares[0]=EMPTY;board.squares[3]=ROOK|BLACK;}
  }
  board.squares[m.to]=m.promotion!==EMPTY?(m.promotion|us):piece;
  if(pt===KING){if(us===WHITE)board.castlingRights&=~3;if(us===BLACK)board.castlingRights&=~12;}
  if(pt===ROOK){if(m.from===63)board.castlingRights&=~1;if(m.from===56)board.castlingRights&=~2;
    if(m.from===7)board.castlingRights&=~4;if(m.from===0)board.castlingRights&=~8;}
  if(pt===PAWN&&Math.abs(m.to-m.from)===16){const fwd=us===WHITE?-8:8;board.nextEpTargets|=1n<<BigInt(m.from+fwd);}
  board.pliesThisTurn+=1;
  if(board.pliesThisTurn===2){board.pliesThisTurn=0;board.sideToMove=them;
    board.activeEpTargets=board.nextEpTargets;board.nextEpTargets=0n;}
}

function applyAlg(board,alg){
  const from=sqFromAlg(alg.slice(0,2));const to=sqFromAlg(alg.slice(2,4));
  const moves=generateMoves(board);
  const m=moves.find(m=>m.from===from&&m.to===to);
  if(!m){console.log(`ILLEGAL: ${alg}`);return false;}
  makeMove(board,m);return true;
}

// ----- Evaluation + alphabeta -----
const PAWN_VAL=10,KNIGHT_VAL=30,BISHOP_VAL=30,ROOK_VAL=50,QUEEN_VAL=90,KING_VAL=10000;
function evaluate(board){
  let s=0;
  for(let sq=0;sq<64;sq++){
    const p=board.getPiece(sq);if(p===EMPTY)continue;
    const c=board.getColor(sq);const iw=c===WHITE;
    let v=[0,PAWN_VAL,KNIGHT_VAL,BISHOP_VAL,ROOK_VAL,QUEEN_VAL,KING_VAL][p]||0;
    const f=sq%8,r=Math.floor(sq/8);
    if(p===PAWN) v+=iw?(6-r)*1:(r-1)*1;
    else if(p===KNIGHT||p===BISHOP){const cd=Math.abs(3.5-f)+Math.abs(3.5-r);v+=(7-cd)*0.5;}
    s+=iw?v:-v;
  }
  return s;
}

function scoreMove(board,m){
  if(m.captured===EMPTY)return 0;
  const vt=m.captured&7;const at=board.getPiece(m.from);
  if(vt===KING)return 10000000;
  const vals=[0,10,30,30,50,90,10000];
  return 1000*vals[vt]-vals[at];
}

function qsearch(board,alpha,beta){
  const sp=evaluate(board);
  if(sp>5000||sp<-5000)return sp;
  const isMax=board.sideToMove===WHITE;
  if(isMax){if(sp>=beta)return beta;if(sp>alpha)alpha=sp;}
  else{if(sp<=alpha)return alpha;if(sp<beta)beta=sp;}
  let moves=generateMoves(board).filter(m=>m.captured!==EMPTY);
  if(moves.length===0)return sp;
  moves.sort((a,b)=>scoreMove(board,b)-scoreMove(board,a));
  if(isMax){let mx=sp;for(const m of moves){const c=board.clone();makeMove(c,m);const s=qsearch(c,alpha,beta);mx=Math.max(mx,s);alpha=Math.max(alpha,s);if(beta<=alpha)break;}return mx;}
  else{let mn=sp;for(const m of moves){const c=board.clone();makeMove(c,m);const s=qsearch(c,alpha,beta);mn=Math.min(mn,s);beta=Math.min(beta,s);if(beta<=alpha)break;}return mn;}
}

function alphabeta(board,depth,alpha,beta){
  const se=evaluate(board);
  if(se>5000||se<-5000){return[se>0?se+depth:se-depth,null];}
  if(board.pliesThisTurn===0){
    const mv=generateMoves(board);
    for(const m of mv){if((m.captured&7)===KING){return[board.sideToMove===WHITE?10000+depth:-10000-depth,null];}}
  }
  if(depth===0)return[qsearch(board,alpha,beta),null];
  let moves=generateMoves(board);
  if(moves.length===0)return[se,null];
  moves.sort((a,b)=>scoreMove(board,b)-scoreMove(board,a));
  const isMax=board.sideToMove===WHITE;
  let best=null;
  if(isMax){let mx=-2e6;for(const m of moves){const c=board.clone();makeMove(c,m);const[s]=alphabeta(c,depth-1,alpha,beta);if(s>mx){mx=s;best=m;}alpha=Math.max(alpha,s);if(beta<=alpha)break;}return[mx,best];}
  else{let mn=2e6;for(const m of moves){const c=board.clone();makeMove(c,m);const[s]=alphabeta(c,depth-1,alpha,beta);if(s<mn){mn=s;best=m;}beta=Math.min(beta,s);if(beta<=alpha)break;}return[mn,best];}
}

// ============================
// QUESTION 1: After Black plays g7g5 f7f5, can White force mate?
// Try all possible White move-pairs at turn 2 and check which lead to forced mate
// ============================

console.log('==========================================');
console.log('ANALYSIS: Is this a FORCED checkmate?');
console.log('==========================================');

// Build position after turn1
const pos1 = new Board();
applyAlg(pos1, 'e2e3'); applyAlg(pos1, 'd1f3');
applyAlg(pos1, 'g7g5'); applyAlg(pos1, 'f7f5');
console.log('\nPosition after Turn 1 (White: e2e3 d1f3, Black: g7g5 f7f5):');

// At this point it's White to move (pliesThisTurn=0)
// White plays f3f5 (queen captures f5 pawn) then f5d3 — but is there a FASTER mate?
// Let's search all White two-move sequences that immediately threaten/achieve mate on turn 3

console.log('\n--- Searching for immediate 1-turn White wins from this position ---');
const allMoves1 = generateMoves(pos1);
let foundKingCaptures = [];
let kingSafeMoveCandidates = [];

for (const m1 of allMoves1) {
  const mid = pos1.clone();
  makeMove(mid, m1);
  
  // After first ply (mid-turn), check if king can be captured
  const midMoves = generateMoves(mid);
  for(const m2 of midMoves) {
    if((m2.captured & 7) === KING) {
      foundKingCaptures.push(`${sqName(m1.from)}${sqName(m1.to)} + ${sqName(m2.from)}${sqName(m2.to)} (king capture!)`);
    }
  }
  
  // Complete turn 2 for white
  for (const m2 of midMoves) {
    if((m2.captured & 7) === KING) continue; // already found
    const after = mid.clone();
    makeMove(after, m2);
    
    // Now it's Black's turn. Check if white threatens king capture after each black response
    const blackMoves1 = generateMoves(after);
    let allBlackResponsesLoseKing = true;
    let anyBlackResponse = false;
    
    for (const bm1 of blackMoves1.slice(0, 15)) { // limit for speed
      const bMid = after.clone();
      makeMove(bMid, bm1);
      
      const bMidMoves = generateMoves(bMid);
      for (const bm2 of bMidMoves.slice(0, 15)) {
        const bAfter = bMid.clone();
        makeMove(bAfter, bm2);
        anyBlackResponse = true;
        
        // Can white capture the king on turn 3?
        const wm3 = generateMoves(bAfter);
        let whiteCanCaptureKing = false;
        for (const wm3_1 of wm3) {
          const wMid3 = bAfter.clone();
          makeMove(wMid3, wm3_1);
          const wm3_2 = generateMoves(wMid3);
          for (const wm3_2m of wm3_2) {
            if((wm3_2m.captured & 7) === KING) {
              whiteCanCaptureKing = true;
              break;
            }
          }
          if(whiteCanCaptureKing) break;
          // Also check if king capture happened on first ply of turn 3
          if((wm3_1.captured & 7) === KING) { whiteCanCaptureKing = true; break; }
        }
        
        if(!whiteCanCaptureKing) { allBlackResponsesLoseKing = false; break; }
      }
      if(!allBlackResponsesLoseKing) break;
    }
    
    if(anyBlackResponse && allBlackResponsesLoseKing) {
      kingSafeMoveCandidates.push(`White turn2: ${sqName(m1.from)}${sqName(m1.to)} ${sqName(m2.from)}${sqName(m2.to)} → appears forced`);
    }
  }
}

if(foundKingCaptures.length > 0) {
  console.log('White can capture the king IMMEDIATELY on turn 2:');
  foundKingCaptures.forEach(s => console.log('  ' + s));
} else {
  console.log('No immediate king capture on turn 2.');
}

if(kingSafeMoveCandidates.length > 0) {
  console.log('\nPotential forced-mate White continuations:');
  kingSafeMoveCandidates.forEach(s => console.log('  ' + s));
} else {
  console.log('\nNo sampled forced-mate continuation found (sample limited).');
}

// ============================
// QUESTION 2: At Black's turn 2, was f8g7 + e8f8 forced? Or could Black survive?
// ============================
console.log('\n==========================================');
console.log('ANALYSIS: At Black turn 2, were f8g7 + e8f8 FORCED?');
console.log('==========================================');

// Build position after White's turn 2 (f3f5 f5d3)
const pos2 = new Board();
applyAlg(pos2,'e2e3');applyAlg(pos2,'d1f3');
applyAlg(pos2,'g7g5');applyAlg(pos2,'f7f5');
applyAlg(pos2,'f3f5');applyAlg(pos2,'f5d3');

console.log('\nWhite Queen is on d3, threatening f5 diagonal (g6, h7?) or diagonal attacks...');
console.log('White can play d3->f5 next turn (one ply) then f5->f8 (two plies) = KING CAPTURE!');
console.log('\nChecking if Black can prevent d3-f5-f8 threat in 1 turn...');

// White threatens d3f5 f5f8 - Black needs to prevent this
// f5 square: a piece on d3 going to f5 requires the f5 square to be reachable AND f8 from f5
// The issue: queen on d3 can go f5 (diagonal), then f5->f8 (diagonal)

// Let's check all Black two-move pairs and see if any of them stop the d3->f5->f8 threat
let blackCanSurvive = [];
let blackLoses = [];

const blackMoves = generateMoves(pos2); // Black's turn

for (const bm1 of blackMoves) {
  const bMid = pos2.clone();
  makeMove(bMid, bm1);
  
  const bMoves2 = generateMoves(bMid);
  for (const bm2 of bMoves2) {
    const bAfter = bMid.clone();
    makeMove(bAfter, bm2);
    
    // Now check if White can still capture king in turn 3 (2 plies)
    // Try d3f5 f5f8 specifically:
    const wMoves3 = generateMoves(bAfter);
    
    // Try the specific threat: d3->f5->f8
    const d3=sqFromAlg('d3'), f5=sqFromAlg('f5'), f8=sqFromAlg('f8');
    let threat1 = wMoves3.find(m=>m.from===d3&&m.to===f5);
    let canDoThreat = false;
    
    if(threat1) {
      const wMid3 = bAfter.clone();
      makeMove(wMid3, threat1);
      const wMoves3b = generateMoves(wMid3);
      const threat2 = wMoves3b.find(m=>m.from===f5&&m.to===f8);
      if(threat2 && (threat2.captured & 7) === KING) {
        canDoThreat = true;
      }
    }
    
    // Also check ANY king capture in 2 plies
    let anyKingCapture = false;
    for(const wm3_1 of wMoves3) {
      const wMid3 = bAfter.clone();
      makeMove(wMid3, wm3_1);
      if((wm3_1.captured & 7) === KING) { anyKingCapture = true; break; }
      const wMoves3b = generateMoves(wMid3);
      for(const wm3_2 of wMoves3b) {
        if((wm3_2.captured & 7) === KING) { anyKingCapture = true; break; }
      }
      if(anyKingCapture) break;
    }
    
    if(!anyKingCapture) {
      blackCanSurvive.push(`Black: ${sqName(bm1.from)}${sqName(bm1.to)} ${sqName(bm2.from)}${sqName(bm2.to)} → survives turn 3!`);
    } else {
      blackLoses.push(`Black: ${sqName(bm1.from)}${sqName(bm1.to)} ${sqName(bm2.from)}${sqName(bm2.to)} → loses king`);
    }
  }
}

if(blackCanSurvive.length > 0) {
  console.log(`\n✅ Black has ${blackCanSurvive.length} surviving response(s):`);
  blackCanSurvive.slice(0, 20).forEach(s => console.log('  ' + s));
  if(blackCanSurvive.length > 20) console.log(`  ... and ${blackCanSurvive.length-20} more`);
} else {
  console.log(`\n❌ Black has NO surviving responses — this IS forced checkmate!`);
}
if(blackLoses.length > 0) {
  console.log(`\nBlack responses that lose the king (${blackLoses.length} total):`);
  blackLoses.slice(0, 10).forEach(s => console.log('  ' + s));
}
