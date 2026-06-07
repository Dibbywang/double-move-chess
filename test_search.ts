import { Board, WHITE, BLACK, EMPTY } from "./src/engine/board";
import { generateMoves, makeMove } from "./src/engine/moves";
import { search, loadWasmEngine, loadModel } from "./src/engine/search";

async function test() {
  console.log("Loading Wasm...");
  await loadWasmEngine();
  console.log("Wasm loaded.");
  
  let b = new Board();
  b.setInitialPosition();
  console.log("Generating moves...");
  
  console.log("Searching classical (WASM)...");
  try {
    let [score, move] = await search(b, 2, false);
    console.log("WASM search result:", score, move);
  } catch (e) {
    console.error("WASM search error:", e);
  }
}

test();
