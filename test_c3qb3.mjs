// Targeted test: after White c2c3 d1b3, what does Black's search pick?
// Also diagnose WHY the fix may not be working for the 2-ply queen attack.

const EMPTY=0,PAWN=1,KNIGHT=2,BISHOP=3,ROOK=4,QUEEN=5,KING=6,WHITE=8,BLACK=16;
const FILES=['a','b','c','d','e','f','g','h'];
const RANKS=['8','7','6','5','4','3','2','1'];
function sqName(sq){return FILES[sq%8]+RANKS[Math.floor(sq/8)];}
function sqFromAlg(a){return(8-parseInt(a[1]))*8+(a.charCodeAt(0)-97);}
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

// Evaluation WITH king safety
const PAWN_VAL=10,KNIGHT_VAL=30,BISHOP_VAL=30,ROOK_VAL=50,QUEEN_VAL=90,KING_VAL=10000;
const KING_SAFETY_PENALTY=20;
function evaluate(board){
  let score=0; let wks=-1; let bks=-1;
  for(let sq=0;sq<64;sq++){
    const p=board.getPiece(sq);if(p===EMPTY)continue;
    const c=board.getColor(sq);const iw=c===WHITE;
    let v=[0,PAWN_VAL,KNIGHT_VAL,BISHOP_VAL,ROOK_VAL,QUEEN_VAL,KING_VAL][p]||0;
    const f=sq%8,r=Math.floor(sq/8);
    if(p===KING){if(iw)wks=sq;else bks=sq;}
    if(p===PAWN)v+=iw?(6-r)*1:(r-1)*1;
    else if(p===KNIGHT||p===BISHOP){const cd=Math.abs(3.5-f)+Math.abs(3.5-r);v+=(7-cd)*0.5;}
    score+=iw?v:-v;
  }
  // King safety
  if(wks>=0){const kr=Math.floor(wks/8),kf=wks%8;let sh=0;for(let df=-1;df<=1;df++){const sf=kf+df;const ssq=(kr-1)*8+sf;if(sf>=0&&sf<=7&&kr>0&&board.getPiece(ssq)===PAWN&&board.getColor(ssq)===WHITE)sh++;}score+=(sh-3)*KING_SAFETY_PENALTY;}
  if(bks>=0){const kr=Math.floor(bks/8),kf=bks%8;let sh=0;for(let df=-1;df<=1;df++){const sf=kf+df;const ssq=(kr+1)*8+sf;if(sf>=0&&sf<=7&&kr<7&&board.getPiece(ssq)===PAWN&&board.getColor(ssq)===BLACK)sh++;}score-=(sh-3)*KING_SAFETY_PENALTY;}
  return score;
}

function scoreMove(board,m){if(m.captured===EMPTY)return 0;const vt=m.captured&7;if(vt===KING)return 10000000;const vals=[0,10,30,30,50,90,10000];return 1000*vals[vt]-vals[board.getPiece(m.from)];}
function qsearch(board,alpha,beta){
  const sp=evaluate(board);if(sp>5000||sp<-5000)return sp;
  const isMax=board.sideToMove===WHITE;
  if(isMax){if(sp>=beta)return beta;if(sp>alpha)alpha=sp;}else{if(sp<=alpha)return alpha;if(sp<beta)beta=sp;}
  let moves=generateMoves(board).filter(m=>m.captured!==EMPTY);if(moves.length===0)return sp;
  moves.sort((a,b)=>scoreMove(board,b)-scoreMove(board,a));
  if(isMax){let mx=sp;for(const m of moves){const c=board.clone();makeMove(c,m);const s=qsearch(c,alpha,beta);mx=Math.max(mx,s);alpha=Math.max(alpha,s);if(beta<=alpha)break;}return mx;}
  else{let mn=sp;for(const m of moves){const c=board.clone();makeMove(c,m);const s=qsearch(c,alpha,beta);mn=Math.min(mn,s);beta=Math.min(beta,s);if(beta<=alpha)break;}return mn;}
}

// OLD alphabeta (pliesThisTurn==0 guard)
function alphabetaOLD(board,depth,alpha,beta){
  const se=evaluate(board);if(se>5000||se<-5000)return[se>0?se+depth:se-depth,null];
  if(board.pliesThisTurn===0){
    const mv=generateMoves(board);
    for(const m of mv){if((m.captured&7)===KING){return[board.sideToMove===WHITE?10000+depth:-10000-depth,null];}}
  }
  if(depth===0)return[qsearch(board,alpha,beta),null];
  let moves=generateMoves(board);if(moves.length===0)return[se,null];
  moves.sort((a,b)=>scoreMove(board,b)-scoreMove(board,a));
  const isMax=board.sideToMove===WHITE;let best=null;
  if(isMax){let mx=-2e6;for(const m of moves){const c=board.clone();makeMove(c,m);const[s]=alphabetaOLD(c,depth-1,alpha,beta);if(s>mx){mx=s;best=m;}alpha=Math.max(alpha,s);if(beta<=alpha)break;}return[mx,best];}
  else{let mn=2e6;for(const m of moves){const c=board.clone();makeMove(c,m);const[s]=alphabetaOLD(c,depth-1,alpha,beta);if(s<mn){mn=s;best=m;}beta=Math.min(beta,s);if(beta<=alpha)break;}return[mn,best];}
}

// NEW alphabeta (always checks king capture)
function alphabetaNEW(board,depth,alpha,beta){
  const se=evaluate(board);if(se>5000||se<-5000)return[se>0?se+depth:se-depth,null];
  {const mv=generateMoves(board);for(const m of mv){if((m.captured&7)===KING){return[board.sideToMove===WHITE?10000+depth:-10000-depth,null];}}}
  if(depth===0)return[qsearch(board,alpha,beta),null];
  let moves=generateMoves(board);if(moves.length===0)return[se,null];
  moves.sort((a,b)=>scoreMove(board,b)-scoreMove(board,a));
  const isMax=board.sideToMove===WHITE;let best=null;
  if(isMax){let mx=-2e6;for(const m of moves){const c=board.clone();makeMove(c,m);const[s]=alphabetaNEW(c,depth-1,alpha,beta);if(s>mx){mx=s;best=m;}alpha=Math.max(alpha,s);if(beta<=alpha)break;}return[mx,best];}
  else{let mn=2e6;for(const m of moves){const c=board.clone();makeMove(c,m);const[s]=alphabetaNEW(c,depth-1,alpha,beta);if(s<mn){mn=s;best=m;}beta=Math.min(beta,s);if(beta<=alpha)break;}return[mn,best];}
}

// === Build position: White c2c3 d1b3 ===
const pos = new Board();
applyAlg(pos,'c2c3'); applyAlg(pos,'d1b3');

console.log('=== After White c2c3 d1b3 ===');
console.log('Board:');
const pieceChars=['.','P','N','B','R','Q','K'];
for(let r=0;r<8;r++){let row=`${8-r} `;for(let f=0;f<8;f++){const sq=r*8+f;const p=pos.getPiece(sq);const c=pos.getColor(sq);row+=(p===EMPTY?'.':c===WHITE?pieceChars[p]:pieceChars[p].toLowerCase())+' ';}console.log(row);}
console.log('  a b c d e f g h');

// === Verify the threat exists ===
console.log('\n=== Threat verification ===');
const b3=sqFromAlg('b3'),f7=sqFromAlg('f7'),e8=sqFromAlg('e8');
console.log(`White queen on: ${sqName(b3)} (piece=${pos.getPiece(b3)}, color=${pos.getColor(b3)===WHITE?'White':'Black'})`);
console.log(`Black king on: ${sqName(e8)} (piece=${pos.getPiece(e8)}, color=${pos.getColor(e8)===WHITE?'White':'Black'})`);

// Manual check: after Black plays any 2 moves, can White do b3->f7->e8?
const testPos = pos.clone();
// Simulate Black plays two random safe moves
applyAlg(testPos,'a7a6'); applyAlg(testPos,'h7h6');
// Now it's White's turn
const whiteMoves = generateMoves(testPos);
const wm1 = whiteMoves.find(m=>m.from===b3&&m.to===f7);
if(wm1){
  console.log(`✅ White can play b3->f7 (captures: ${wm1.captured!==EMPTY?'yes':'no'})`);
  const testPos2 = testPos.clone();
  makeMove(testPos2, wm1);
  const whiteMoves2 = generateMoves(testPos2);
  const wm2 = whiteMoves2.find(m=>m.from===f7&&m.to===e8);
  if(wm2){
    console.log(`✅ White can then play f7->e8 (captures: king=${wm2.captured!==EMPTY})`);
    console.log(`   CONFIRMED: b3->f7->e8 is a legal 2-ply king capture in one White turn!`);
  } else {
    console.log(`❌ f7->e8 NOT found after b3->f7`);
    console.log(`   Available from f7: ${generateMoves(testPos2).filter(m=>m.from===f7).map(m=>sqName(m.to)).join(', ')}`);
  }
} else {
  console.log(`❌ b3->f7 not found. Queen is on: ${pos.squares.findIndex((s,i)=>pos.getPiece(i)===QUEEN&&pos.getColor(i)===WHITE)}`);
}

// === Score every Black first-ply move with OLD and NEW alphabeta ===
console.log('\n=== Black first-ply moves: OLD vs NEW alphabeta (depth 6) ===');
console.log('Side to move:', pos.sideToMove===WHITE?'White':'Black', '| pliesThisTurn:', pos.pliesThisTurn);

const allBlackMoves = generateMoves(pos);
const results = [];

for(const m of allBlackMoves){
  const child = pos.clone();
  makeMove(child, m);
  const [s_old] = alphabetaOLD(child, 5, -2e6, 2e6);
  const [s_new] = alphabetaNEW(child, 5, -2e6, 2e6);
  results.push({move: moveName(m), old: s_old, new: s_new});
}

// Sort by new score (ascending = best for Black)
results.sort((a,b)=>a.new-b.new);
console.log('\nTop 15 by NEW score (lower = better for Black):');
console.log('Move    | OLD score | NEW score | Difference');
console.log('--------|-----------|-----------|----------');
for(const r of results.slice(0,15)){
  const diff = r.new - r.old;
  const flag = r.old>5000&&r.new<=100?'🛡️ FIXED':r.new>5000?'💀 LOSES KING':r.old>5000?'✅':'';
  console.log(`${r.move.padEnd(7)} | ${String(r.old).padStart(9)} | ${String(r.new).padStart(9)} | ${String(diff).padStart(9)} ${flag}`);
}
console.log('\nBottom 10 by NEW score (worst for Black):');
for(const r of results.slice(-10)){
  const flag = r.new>5000?'💀 LOSES KING':'';
  console.log(`${r.move.padEnd(7)} | ${String(r.old).padStart(9)} | ${String(r.new).padStart(9)} ${flag}`);
}

// === Direct verification: does alphabetaNEW detect the mate at depth 2? ===
console.log('\n=== Depth verification: At what depth does each alphabeta see the b3->f7->e8 mate? ===');
// After Black plays a7a6 h7h6 (does nothing), White should have a forced win
const dummyPos = pos.clone();
applyAlg(dummyPos,'a7a6'); applyAlg(dummyPos,'h7h6'); // Black wastes moves
console.log('After Black plays a7a6 h7h6 (wasted moves):');
for(let d=1;d<=5;d++){
  const [sOld] = alphabetaOLD(dummyPos,d,-2e6,2e6);
  const [sNew, bm] = alphabetaNEW(dummyPos,d,-2e6,2e6);
  console.log(`  depth=${d}: OLD=${sOld}(${sOld>5000?'WIN':'?'}), NEW=${sNew}(${sNew>5000?'WIN':'?'}) bestMove=${bm?moveName(bm):'none'}`);
}
