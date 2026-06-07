import * as fs from 'fs';
import { Board, WHITE, BLACK, EMPTY } from "./src/engine/board.ts";
import { generateMoves, makeMove, moveToString } from "./src/engine/moves.ts";
import init from "./src/engine_wasm/engine_v2.js";
import { EngineWrapper } from "./src/engine/search.ts";

async function testAllMoves() {
  const wasmBuffer = fs.readFileSync('./src/engine_wasm/engine_v2_bg.wasm');
  await init(wasmBuffer);
  
  let b = new Board();
  b.setInitialPosition();
  
  const moves = generateMoves(b);
  console.log(`Testing ${moves.length} opening moves...`);
  
  for (const m of moves) {
    const wasmEngine = new EngineWrapper();
    let testBoard = b.clone();
    makeMove(testBoard, m);
    
    const rustSideToMove = testBoard.sideToMove === WHITE ? 0 : 1;
    let s = "";
    for (let sq = 0; sq < 64; sq++) {
      const p = testBoard.getPiece(sq);
      const c = testBoard.getColor(sq);
      let ch = ".";
      if (p !== EMPTY) {
        ch = ['?', 'p', 'n', 'b', 'r', 'q', 'k'][p] || '.';
        if (c === WHITE) ch = ch.toUpperCase();
      }
      s += ch;
    }

    try {
      wasmEngine.set_board(s, rustSideToMove, testBoard.pliesThisTurn, testBoard.turnNumber);
      wasmEngine.search(4);
    } catch (e) {
      console.error(`PANIC ON MOVE ${moveToString(m)}:`, e);
    }
  }
  console.log("Finished testing all opening moves.");
}

testAllMoves();
