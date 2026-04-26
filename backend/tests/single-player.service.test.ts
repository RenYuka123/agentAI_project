import test from "node:test";
import assert from "node:assert/strict";

import { PNG } from "pngjs";

import { llmConfig } from "../src/config/llm.ts";
import { singlePlayerService } from "../src/services/draw/core/single-player.service.ts";

const createSampleImageDataUrl = (): string => {
  const png = new PNG({ width: 12, height: 12 });

  // 留下幾筆深色筆觸，讓 heuristic 模式能判定成非空白畫布。
  for (let y = 3; y < 9; y += 1) {
    for (let x = 3; x < 9; x += 1) {
      const index = (png.width * y + x) << 2;
      png.data[index] = 40;
      png.data[index + 1] = 40;
      png.data[index + 2] = 40;
      png.data[index + 3] = 255;
    }
  }

  const buffer = PNG.sync.write(png);
  return `data:image/png;base64,${buffer.toString("base64")}`;
};

test("single player heuristic guessing is deterministic for identical input", async () => {
  const originalApiKey = llmConfig.apiKey;
  llmConfig.apiKey = "";

  try {
    const imageDataUrl = createSampleImageDataUrl();
    const input = {
      answer: "貓",
      imageDataUrl,
      timedOut: false,
    };

    const firstResult = await singlePlayerService.guessDrawing(input);
    const secondResult = await singlePlayerService.guessDrawing(input);

    assert.deepEqual(secondResult, firstResult);
  } finally {
    llmConfig.apiKey = originalApiKey;
  }
});
