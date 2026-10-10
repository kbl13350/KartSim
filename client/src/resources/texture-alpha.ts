/** Restores alpha and edge colors for legacy booster and enchant textures. */
export function normalizeLegacyTextureAlpha(pixels: Uint8Array,
  width: number, height: number): void {
  let hasAlpha = false;
  for (let channel = 3; channel < pixels.length; channel += 4) {
    if (pixels[channel] !== 255) { hasAlpha = true; break; }
  }
  let hasBlack = false;
  if (!hasAlpha) {
    for (let offset = 0; offset < pixels.length; offset += 4) {
      if (pixels[offset] === 0 && pixels[offset + 1] === 0 && pixels[offset + 2] === 0) {
        hasBlack = true;
        break;
      }
    }
  }
  if (hasBlack) {
    for (let offset = 0; offset < pixels.length; offset += 4) {
      const alpha = Math.max(pixels[offset]!, pixels[offset + 1]!, pixels[offset + 2]!);
      pixels[offset + 3] = alpha;
      if (alpha !== 0) {
        pixels[offset] = Math.round((pixels[offset]! * 255) / alpha);
        pixels[offset + 1] = Math.round((pixels[offset + 1]! * 255) / alpha);
        pixels[offset + 2] = Math.round((pixels[offset + 2]! * 255) / alpha);
      }
    }
  }
  fillTransparentEdges(pixels, width, height);
}

function fillTransparentEdges(pixels: Uint8Array, width: number, height: number): void {
  const count = width * height;
  if (pixels.length !== count * 4 || count === 0) return;
  const visited = new Uint8Array(count);
  const queue = new Int32Array(count);
  let read = 0, write = 0;
  for (let index = 0; index < count; index++) {
    if (pixels[index * 4 + 3] !== 0) {
      visited[index] = 1;
      queue[write++] = index;
    }
  }
  while (read < write) {
    const index = queue[read++]!;
    const x = index % width, y = Math.trunc(index / width);
    const neighbors = [
      x > 0 ? index - 1 : -1,
      x + 1 < width ? index + 1 : -1,
      y > 0 ? index - width : -1,
      y + 1 < height ? index + width : -1,
    ];
    for (const neighbor of neighbors) {
      if (neighbor < 0 || visited[neighbor]) continue;
      visited[neighbor] = 1;
      if (pixels[neighbor * 4 + 3] === 0) {
        pixels[neighbor * 4] = pixels[index * 4]!;
        pixels[neighbor * 4 + 1] = pixels[index * 4 + 1]!;
        pixels[neighbor * 4 + 2] = pixels[index * 4 + 2]!;
      }
      queue[write++] = neighbor;
    }
  }
}
