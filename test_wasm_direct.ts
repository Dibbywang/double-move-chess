import * as fs from 'fs';
import { Board, WHITE, BLACK, EMPTY } from "./src/engine/board.ts";
import { generateMoves, makeMove, moveToString } from "./src/engine/moves.ts";
import init from "./src/engine_wasm/engine_v2.js";
import { EngineWrapper } from "./src/engine/search.ts";

async function test() {
  console.log("Loading Wasm manually...");
  const wasmBuffer = fs.readFileSync('./src/engine_wasm/engine_v2_bg.wasm');
  await init(wasmBuffer);
  const wasmEngine = new EngineWrapper();
  
  let b = new Board();
  b.setInitialPosition();
  
  const moves = generateMoves(b);
  const userMove = moves.find(m => moveToString(m).includes("e2e4")) || moves[0];
  console.log("User makes move:", moveToString(userMove));
  
  makeMove(b, userMove);
  console.log("Board after user move:", b.pliesThisTurn, "plies this turn, side to move:", b.sideToMove);
  
  const depth = 4;
  console.log("Calling WASM search with depth", depth, "for Classical...");
  
  try {
    const rustSideToMove = b.sideToMove === WHITE ? 0 : 1;
    // boardToString logic
    let s = "";
    for (let sq = 0; sq < 64; sq++) {
      const p = b.getPiece(sq);
      const c = b.getColor(sq);
      let ch = ".";
      if (p !== EMPTY) {
        ch = ['?', 'p', 'n', 'b', 'r', 'q', 'k'][p] || '.';
        if (c === WHITE) {
          ch = ch.toUpperCase();
        }
      }
      s += ch;
    }

    console.log("set_board args:", s, rustSideToMove, b.pliesThisTurn, b.turnNumber);
    wasmEngine.set_board(s, rustSideToMove, b.pliesThisTurn, b.turnNumber);
    console.log("WASM search...");
    const result = wasmEngine.search(depth);
    console.log("Search finished!", result);
  } catch (e) {
    console.error("Search threw an error:", e);
  }
}

test();
