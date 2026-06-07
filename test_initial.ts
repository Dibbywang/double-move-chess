import * as fs from 'fs';
import init from "./src/engine_wasm/engine_v2.js";
import { EngineWrapper } from "./src/engine/search.ts";

async function test() {
  console.log("Loading Wasm manually...");
  const wasmBuffer = fs.readFileSync('./src/engine_wasm/engine_v2_bg.wasm');
  await init(wasmBuffer);
  const wasmEngine = new EngineWrapper();
  
  // Initial board string:
  // Row 0: rnbqkbnr
  // Row 1: pppppppp
  // Row 2-5: ................................
  // Row 6: PPPPPPPP
  // Row 7: RNBQKBNR
  const initialBoard = "rnbqkbnrpppppppp................................PPPPPPPPRNBQKBNR";
  
  try {
    console.log("Setting board for White to move, turn 0, plies 0...");
    wasmEngine.set_board(initialBoard, 0, 0, 0);
    console.log("Searching at depth 4...");
    const result = wasmEngine.search(4);
    console.log("Search finished!", result);
  } catch (e) {
    console.error("Search threw an error:", e);
  }
}

test();
