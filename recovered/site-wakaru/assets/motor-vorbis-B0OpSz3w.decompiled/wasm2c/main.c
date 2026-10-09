/*
 * 原生测试程序：直接调用 wasm2c 生成的 C 代码解码 Ogg Vorbis 文件。
 *
 * 构建：
 *   cc -O2 -DWASM_RT_USE_MMAP=0 -o motor_vorbis_test \
 *      main.c motor_vorbis.c wasm-rt-impl.c wasm-rt-mem-simple.c -lm
 * 用法：
 *   ./motor_vorbis_test input.ogg [output.s16le]
 * 输出：frames / channels / rate，若给出第二个参数则写出交错的 16-bit PCM。
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "motor_vorbis.h"

/* wasm 模块只导入这 4 个 WASI 函数，行为与 VorbisDecodeWorker.js 中的实现一致 */
struct w2c_wasi__snapshot__preview1 { w2c_motorvorbis *mod; };

u32 w2c_wasi__snapshot__preview1_fd_prestat_get(struct w2c_wasi__snapshot__preview1 *w, u32 fd, u32 buf) {
  (void)w; (void)fd; (void)buf;
  return 8; /* EBADF：没有预打开目录 */
}
u32 w2c_wasi__snapshot__preview1_fd_prestat_dir_name(struct w2c_wasi__snapshot__preview1 *w, u32 fd, u32 p, u32 n) {
  (void)w; (void)fd; (void)p; (void)n;
  return 8;
}
void w2c_wasi__snapshot__preview1_proc_exit(struct w2c_wasi__snapshot__preview1 *w, u32 code) {
  (void)w;
  fprintf(stderr, "Motor Vorbis decoder exited: %u\n", code);
  exit(1);
}
u32 w2c_wasi__snapshot__preview1_random_get(struct w2c_wasi__snapshot__preview1 *w, u32 p, u32 n) {
  arc4random_buf(w->mod->w2c_memory.data + p, n);
  return 0;
}

static u32 rd32(const u8 *p) { return p[0] | p[1] << 8 | p[2] << 16 | (u32)p[3] << 24; }

int main(int argc, char **argv) {
  if (argc < 2) { fprintf(stderr, "usage: %s input.ogg [output.s16le]\n", argv[0]); return 2; }
  FILE *f = fopen(argv[1], "rb");
  if (!f) { perror(argv[1]); return 1; }
  fseek(f, 0, SEEK_END); long len = ftell(f); fseek(f, 0, SEEK_SET);
  u8 *bytes = malloc(len);
  if (fread(bytes, 1, len, f) != (size_t)len) { perror("fread"); return 1; }
  fclose(f);

  wasm_rt_init();
  w2c_motorvorbis mod;
  struct w2c_wasi__snapshot__preview1 wasi = { &mod };
  wasm2c_motorvorbis_instantiate(&mod, &wasi);
  w2c_motorvorbis_0x5Finitialize(&mod);

  u32 in = w2c_motorvorbis_malloc(&mod, (u32)len);
  if (!in) { fprintf(stderr, "Motor Vorbis input allocation failed\n"); return 1; }
  memcpy(mod.w2c_memory.data + in, bytes, len);

  u32 res = w2c_motorvorbis_decode(&mod, in, (u32)len);
  if (!res) { fprintf(stderr, "Motor Vorbis resource is invalid or incomplete\n"); return 1; }

  /* 返回值布局：{ u32 pcm; u32 frames; u32 channels; u32 rate; } */
  const u8 *r = mod.w2c_memory.data + res;
  u32 pcm = rd32(r), frames = rd32(r + 4), channels = rd32(r + 8), rate = rd32(r + 12);
  printf("%s frames=%u channels=%u rate=%u\n", argv[1], frames, channels, rate);

  if (argc > 2) {
    FILE *o = fopen(argv[2], "wb");
    fwrite(mod.w2c_memory.data + pcm, 2, (size_t)frames * channels, o);
    fclose(o);
  }

  w2c_motorvorbis_release(&mod, res);
  w2c_motorvorbis_free(&mod, in);
  wasm2c_motorvorbis_free(&mod);
  wasm_rt_free();
  free(bytes);
  return 0;
}
