/*
 * motor_vorbis_decoder.c —— 从 motor-vorbis-B0OpSz3w.wasm 反编译还原的源码
 *
 * 这个 wasm 由三部分静态链接而成：
 *   1. 本文件：项目自定义的包装层（decode / release 及内存读取回调）——唯一的“业务代码”
 *   2. Tremor（Xiph 官方整数版 Vorbis 解码器 libvorbisidec），以 _LOW_ACCURACY_ 编译
 *   3. libogg（>= 1.3.4，带 slice-by-8 CRC）+ wasi-libc（malloc 为 emmalloc 实现）
 *
 * 第 2、3 部分是开源库原样编译，不需要反编译，直接用官方源码即可：
 *   Tremor : https://gitlab.xiph.org/xiph/tremor
 *   libogg : https://gitlab.xiph.org/xiph/ogg
 *
 * 本文件是根据 wasm 中 func 6/7/9/28/29/30 以及数据段 0x1000000 处的回调表
 * 手工还原的，行为与原 wasm 一致（检查顺序、边界值、内存布局均按字节码还原）。
 * 变量名、函数拆分方式是推测的，原始符号已被 strip。
 *
 * 推测的构建命令（wasi-sdk）：
 *   clang --target=wasm32-wasi -mexec-model=reactor -O2 -flto -D_LOW_ACCURACY_ \
 *     -Itremor -Ilibogg/include \
 *     motor_vorbis_decoder.c \
 *     tremor/{block,codebook,floor0,floor1,info,mapping0,mdct,registry,res012, \
 *             sharedbook,synthesis,vorbisfile,window}.c \
 *     libogg/src/{framing,bitwise}.c \
 *     -Wl,--export=malloc -Wl,--export=free -Wl,--strip-all \
 *     -o motor-vorbis.wasm
 *
 * JS 侧用法见 VorbisDecodeWorker-*.js：
 *   ptr = malloc(len); 拷入文件字节; res = decode(ptr, len);
 *   读取 res 处 16 字节 {pcm, frames, channels, sampleRate}; release(res); free(ptr);
 */

#include <limits.h>
#include <stdint.h>
#include <stdio.h> /* SEEK_SET / SEEK_CUR / SEEK_END */
#include <stdlib.h>
#include <string.h>

#include "ivorbiscodec.h"
#include "ivorbisfile.h"

#if defined(__wasm__)
#define WASM_EXPORT(name) __attribute__((export_name(name)))
#else
#define WASM_EXPORT(name)
#endif

/* ------------------------------------------------------------------------ */
/* 内存数据源：让 vorbisfile 直接从 wasm 线性内存里的字节数组读取            */
/* ------------------------------------------------------------------------ */

/* 在 decode() 栈帧 sp+672 处，12 字节 */
typedef struct {
  const unsigned char *data; /* +0 */
  size_t size;               /* +4 */
  size_t pos;                /* +8 */
} MemorySource;

/* func 9 —— 函数表索引 2 */
static size_t mem_read(void *ptr, size_t size, size_t nmemb, void *datasource) {
  MemorySource *src = (MemorySource *)datasource;
  size_t avail, bytes;

  if (size == 0) return 0;

  avail = (src->size - src->pos) / size;
  if (nmemb > avail) nmemb = avail;

  bytes = nmemb * size;
  memcpy(ptr, src->data + src->pos, bytes);
  src->pos += bytes;
  return nmemb;
}

/* func 7 —— 函数表索引 1 */
static int mem_seek(void *datasource, ogg_int64_t offset, int whence) {
  MemorySource *src = (MemorySource *)datasource;
  size_t base;

  switch (whence) {
    case SEEK_SET: base = 0; break;
    case SEEK_CUR: base = src->pos; break;
    case SEEK_END: base = src->size; break;
    default:       base = (size_t)-1; break; /* 非法 whence：让下面的范围检查失败 */
  }

  /* 目标位置必须落在 [0, size] 内 */
  if (offset < -(ogg_int64_t)base) return -1;
  if (offset > (ogg_int64_t)src->size - (ogg_int64_t)base) return -1;

  src->pos = base + (size_t)offset;
  return 0;
}

/* func 28 —— 函数表索引 7 */
static int mem_close(void *datasource) {
  (void)datasource;
  return 0;
}

/* func 29 —— 函数表索引 8 */
static long mem_tell(void *datasource) {
  return (long)((MemorySource *)datasource)->pos;
}

/* 数据段 0x1000000：{ 2, 1, 7, 8 }（即上面四个函数在函数表中的下标） */
static const ov_callbacks kMemoryCallbacks = {
  mem_read, mem_seek, mem_close, mem_tell
};

/* ------------------------------------------------------------------------ */
/* 导出接口                                                                  */
/* ------------------------------------------------------------------------ */

/* decode() 的返回值，calloc(1, 16)。JS 用 DataView 按小端读取这 4 个 u32 */
typedef struct {
  ogg_int16_t *pcm;     /* +0  交错排列的 16-bit 有符号 PCM，长度 frames*channels */
  uint32_t frames;      /* +4  每声道采样数 */
  uint32_t channels;    /* +8  1 或 2 */
  uint32_t sample_rate; /* +12 8000 ~ 96000 */
} MotorPcm;

#define MOTOR_MIN_RATE 8000
#define MOTOR_MAX_RATE 96000

/*
 * func 6 —— 导出 "decode"
 *
 * 把一整个 Ogg Vorbis 文件一次性解码成 16-bit PCM。
 * 任何不满足条件的输入都返回 NULL（JS 侧报 "resource is invalid or incomplete"）：
 *   - 不是合法的 Ogg Vorbis
 *   - 声道数不是 1/2，采样率不在 [8000, 96000]
 *   - 串联(chained)的多段流之间声道数或采样率不一致
 *   - 总长度为 0，或 PCM 字节数超过 INT_MAX
 *   - 实际解出的数据比 ov_pcm_total() 少（文件被截断），或者多（后面还有音频）
 */
WASM_EXPORT("decode")
MotorPcm *decode(const unsigned char *data, size_t size) {
  MemorySource src = { data, size, 0 };
  OggVorbis_File vf;
  MotorPcm *out;
  vorbis_info *vi;
  ogg_int64_t total;
  int channels, i;
  long rate;
  size_t bytes;

  /* 失败时 ov_open_callbacks 内部已经 ov_clear 过，这里直接返回 */
  if (ov_open_callbacks(&src, &vf, NULL, 0, kMemoryCallbacks) != 0)
    return NULL;

  total = ov_pcm_total(&vf, -1);
  vi = ov_info(&vf, 0);

  if (vi == NULL) goto fail;
  channels = vi->channels;
  rate = vi->rate;
  if (channels != 1 && channels != 2) goto fail;
  if (rate < MOTOR_MIN_RATE || rate > MOTOR_MAX_RATE) goto fail;
  if (total < 1) goto fail;

  /* 所有串联的逻辑流必须和第一段格式完全一致 */
  for (i = 1; i < ov_streams(&vf); i++) {
    vorbis_info *link = ov_info(&vf, i);
    if (link == NULL || link->channels != channels || link->rate != rate)
      goto fail;
  }

  if (total > (ogg_int64_t)(INT_MAX / (channels * sizeof(ogg_int16_t))))
    goto fail;

  out = (MotorPcm *)calloc(1, sizeof(*out));
  if (out == NULL) goto fail;

  bytes = (size_t)total * channels * sizeof(ogg_int16_t);
  out->pcm = (ogg_int16_t *)malloc(bytes);
  if (out->pcm != NULL) {
    out->channels = channels;
    out->frames = (uint32_t)total;
    out->sample_rate = vi->rate;

    {
      size_t done = 0;
      int bitstream;
      while (done < bytes) {
        long n = ov_read(&vf, (char *)out->pcm + done, (int)(bytes - done), &bitstream);
        if (n <= 0) goto fail_free; /* 出错或提前结束：数据不完整 */
        done += (size_t)n;
      }
    }

    {
      /* 必须恰好读到流末尾，多出来的数据也视为非法 */
      char tail[4];
      int bitstream;
      if (ov_read(&vf, tail, sizeof(tail), &bitstream) == 0) {
        ov_clear(&vf);
        return out;
      }
    }

  fail_free:
    free(out->pcm);
  }
  free(out);

fail:
  ov_clear(&vf);
  return NULL;
}

/* func 30 —— 导出 "release"：释放 decode() 的返回值 */
WASM_EXPORT("release")
void release(MotorPcm *result) {
  if (result == NULL) return;
  free(result->pcm);
  free(result);
}

/* malloc / free 直接导出 libc 的实现（func 26 / func 15，emmalloc） */
