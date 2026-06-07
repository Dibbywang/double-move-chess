import * as fs from 'fs';
import init from "./src/engine_wasm/engine_v2.js";
import { EngineWrapper } from "./src/engine/search.ts";

async function test() {
  const wasmBuffer = fs.readFileSync('./src/engine_wasm/engine_v2_bg.wasm');
  await init(wasmBuffer);
  const wasmEngine = new EngineWrapper();
  
  async function doSearch() {
    wasmEngine.set_board("rnbqkbnrpppppppp....................P...........PPPP.PPPRNBQKBNR", 1, 0, 1);
    const result = wasmEngine.search(4);
    return result;
  }
  
  try {
    // Call concurrently
    await Promise.all([
      doSearch(),
      doSearch(),
      doSearch()
    ]);
    console.log("Success!");
  } catch (e) {
    console.error("Caught error:", e.message);
  }
}
test();
