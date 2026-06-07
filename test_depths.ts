import * as fs from 'fs';
import init from "./src/engine_wasm/engine_v2.js";
import { EngineWrapper } from "./src/engine/search.ts";

async function test() {
  console.log("Loading Wasm...");
  const wasmBuffer = fs.readFileSync('./src/engine_wasm/engine_v2_bg.wasm');
  await init(wasmBuffer);
  const wasmEngine = new EngineWrapper();
  
  const boardAfterE2E4 = "rnbqkbnrpppppppp....................P...........PPPP.PPPRNBQKBNR";
  
  for (let depth = 1; depth <= 6; depth++) {
    console.log(`\n--- Depth ${depth} ---`);
    try {
      wasmEngine.set_board(boardAfterE2E4, 1, 0, 1);
      const start = Date.now();
      const result = wasmEngine.search(depth);
      console.log(`Search finished in ${Date.now() - start}ms!`, result);
    } catch (e) {
      console.error(`Search failed at depth ${depth}:`, e);
      break;
    }
  }
}

test();
