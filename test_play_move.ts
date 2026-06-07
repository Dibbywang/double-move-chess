import { Board, WHITE, BLACK, EMPTY } from "./src/engine/board";
import { generateMoves, makeMove, moveToString } from "./src/engine/moves";
import { search, loadWasmEngine, loadModel } from "./src/engine/search";

async function test() {
  console.log("Loading Wasm...");
  try {
    await loadWasmEngine();
  } catch(e) {
    console.log("wasm failed to load (expected in node)", e);
  }
  console.log("Loading Model...");
  try {
    await loadModel();
  } catch(e) {
    console.log("model failed to load", e);
  }
  
  let b = new Board();
  b.setInitialPosition();
  
  // Try to generate moves for the user (White, Turn 0)
  const moves = generateMoves(b);
  // Pick the first move (pawn e2-e4 or something)
  const userMove = moves.find(m => moveToString(m).includes("e2e4")) || moves[0];
  console.log("User makes move:", moveToString(userMove));
  
  makeMove(b, userMove);
  console.log("Board after user move:", b.pliesThisTurn, "plies this turn, side to move:", b.sideToMove);
  
  // Call search exactly as App.tsx does
  const depth = b.pliesThisTurn === 0 ? 4 : 3;
  console.log("Calling search with depth", depth);
  try {
    const [score, bestMove] = await search(b, depth, true);
    console.log("Search finished!", score, bestMove);
  } catch (e) {
    console.error("Search threw an error:", e);
  }
}

test();
