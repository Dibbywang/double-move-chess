import * as fs from 'fs';
import init from "./src/engine_wasm/engine_v2.js";
import { EngineWrapper } from "./src/engine/search.ts";

async function test() {
  const wasmBuffer = fs.readFileSync('./src/engine_wasm/engine_v2_bg.wasm');
  await init(wasmBuffer);
  const wasmEngine = new EngineWrapper();
  
  async function search1() {
    console.log("Search 1: starting...");
    wasmEngine.set_board("rnbqkbnrpppppppp....................P...........PPPP.PPPRNBQKBNR", 1, 0, 1);
    const result = wasmEngine.search(4);
    console.log("Search 1: finished.");
    return result;
  }

  async function search2() {
    console.log("Search 2: starting...");
    wasmEngine.set_board("rnbqkbnrpppppppp................................PPPPPPPPRNBQKBNR", 0, 0, 0);
    const result = wasmEngine.search(4);
    console.log("Search 2: finished.");
    return result;
  }

  try {
    const p1 = search1();
    // Simulate user clicking reset during the sync block or microtasks?
    // Wait, search1() is fully synchronous!
    // We can't even run search2() until search1() finishes!
    const p2 = search2();
    await Promise.all([p1, p2]);
    console.log("Success!");
  } catch (e) {
    console.error("Caught error:", e.message);
  }
}
test();
