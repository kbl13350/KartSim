import { deflate, inflate } from "pako";
import type { KsvCompression } from "../game/ghost/ksv-codec";

/**
 * The release embeds Pako's zlib codec for the KRData envelope. Keep its
 * compressed byte stream stable so imported and exported KSV files match.
 */
export const ksvCompression: KsvCompression = {
  deflate(bytes, options) {
    return deflate(bytes, { level: options.level as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 });
  },
  inflate(bytes) {
    return inflate(bytes);
  },
};
