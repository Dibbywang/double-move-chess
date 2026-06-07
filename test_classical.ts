import { Board, WHITE, BLACK, EMPTY } from "./src/engine/board";
import { generateMoves, makeMove, moveToString } from "./src/engine/moves";
import { search, loadWasmEngine, loadModel } from "./src/engine/search";

async function test() {
  let b = new Board();
  b.setInitialPosition();
  
  const moves = generateMoves(b);
  const userMove = moves.find(m => moveToString(m).includes("e2e4")) || moves[0];
  console.log("User makes move:", moveToString(userMove));
  
  makeMove(b, userMove);
  console.log("Board after user move:", b.pliesThisTurn, "plies this turn, side to move:", b.sideToMove);
  
  const depth = b.pliesThisTurn === 0 ? 4 : 3;
  console.log("Calling search with depth", depth, "for Classical (WASM/TS fallback)...");
  try {
    const start = Date.now();
    const [score, bestMove] = await search(b, depth, false);
    console.log(`Search finished in ${Date.now() - start}ms!`, score, bestMove);
  } catch (e) {
    console.error("Search threw an error:", e);
  }
}

test();
