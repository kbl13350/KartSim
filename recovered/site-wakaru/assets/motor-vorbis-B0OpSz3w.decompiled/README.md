# motor-vorbis-B0OpSz3w.wasm 反编译结果

## 结论

`motor-vorbis-B0OpSz3w.wasm`（90,081 字节）是一个 **Ogg Vorbis 解码器**，由三部分静态链接而成：

| 组成 | 说明 |
|---|---|
| 自定义包装层 | `decode` / `release` + 内存读取回调，约 150 行 C。**这是唯一的项目自有代码** |
| Tremor (libvorbisidec) | Xiph 官方的整数版 Vorbis 解码器，用 `_LOW_ACCURACY_` 编译（查找表为 8 位），整个 wasm 里没有任何浮点指令 |
| libogg ≥ 1.3.4 + wasi-libc | Ogg 封装解析（slice-by-8 CRC）、`memcpy`/`qsort` 等，`malloc` 用的是 emmalloc |

虽然名字叫 “Motor Vorbis”，但输入就是**标准的 Ogg Vorbis 文件**，没有自定义容器或加密，普通 `.ogg` 可以直接解码。

## 文件说明

| 文件 | 内容 | 可读性 |
|---|---|---|
| `motor_vorbis_decoder.c` | **手工还原的包装层源码**，配合官方 Tremor + libogg 源码即可重新编译出同样功能的 wasm | ★★★ 推荐先看这个 |
| `motor-vorbis.dcmp` | `wasm-decompile` 生成的类 C 伪代码（全部 79 个函数，已带还原后的函数名） | ★★ |
| `motor-vorbis.wat` | 完整的 WebAssembly 文本格式反汇编（带函数名），不丢任何信息 | ★ |
| `motor-vorbis.named.wasm` | 在原文件末尾注入了 `name` 段（函数名）的 wasm，代码完全不变，可以用 Chrome DevTools / Ghidra 等工具打开，看到的是函数名而不是 `func123` | — |
| `wasm2c/` | `wasm2c` 机械翻译出的 **可编译 C 代码** + 运行时 + 测试程序 `main.c` | ★（机器生成） |

### 需要说明的限制

- 原 wasm 已经 strip 掉了全部符号，还开了 LTO，大量函数被内联合并（例如 `ov_open_callbacks` 整个被内联进了 `decode`，`mapping0_inverse` 和 `mdct_backward` 被内联进了 `vorbis_synthesis`）。所以**不可能逐字还原出原始 C 文件**，函数名是根据签名、调用关系、常量和数据表推断出来的。
- Tremor / libogg / wasi-libc 部分是开源库原样编译，反编译出来的伪代码没有官方源码好读，建议直接看官方源码：
  - Tremor：https://gitlab.xiph.org/xiph/tremor
  - libogg：https://gitlab.xiph.org/xiph/ogg

## 验证

1. **WAT 往返**：`wat2wasm motor-vorbis.wat` 重新汇编后，代码段、数据段与原文件完全一致（只有 LEB128 填充字节和 name 段不同）。
2. **wasm2c 等价性**：把 `wasm2c/` 编译成本机程序，和原 wasm（Node.js 中按 `VorbisDecodeWorker.js` 的方式调用）对 13 个测试文件分别解码，帧数、声道、采样率以及 PCM 的 SHA-256 **全部一致**。测试覆盖了：单声道、立体声、8k/44.1k/48k/96k 采样率、6k 采样率（拒绝）、截断文件（拒绝）、尾部有垃圾数据（接受）、串联流格式一致（接受，帧数相加）、串联流采样率不一致、声道数不一致、serialno 重复（三者都拒绝）。
3. **手工还原的 `motor_vorbis_decoder.c`**：上面这些边界行为都和源码里的检查逻辑一一对应；用 clang 做过语法检查（`-Wall -Wextra` 零警告）。因为本机没有 Tremor 源码，**没有实际链接运行过**。

## 导出接口（与 JS 的约定）

```c
void      _initialize(void);                         // wasi reactor 初始化，实例化后调用一次
void     *malloc(size_t);  void free(void *);         // 给 JS 分配输入缓冲区用
MotorPcm *decode(const uint8_t *ogg, size_t len);     // 失败返回 NULL
void      release(MotorPcm *);

typedef struct {          // 16 字节，小端
  int16_t  *pcm;          // +0  交错的 16-bit PCM
  uint32_t  frames;       // +4
  uint32_t  channels;     // +8  只接受 1 或 2
  uint32_t  sample_rate;  // +12 只接受 8000 ~ 96000
} MotorPcm;
```

`decode` 返回 NULL 的条件：不是合法的 Ogg Vorbis；声道数不是 1/2；采样率不在 [8000, 96000]；串联流之间格式不一致；总长度为 0 或 PCM 超过 2GB；解出的数据比 `ov_pcm_total` 少（截断）或多。

导入只有 4 个 WASI 函数：`fd_prestat_get`、`fd_prestat_dir_name`（wasi-libc 启动时探测预打开目录，JS 返回 8=EBADF 即可）、`proc_exit`、`random_get`。

## 函数对照表

`func` 编号与 `.wat` / `.dcmp` 中一致。“表”列是函数在间接调用表（`elem`）中的下标，即 Tremor 内部的函数指针。

| func | 还原名 | 来源 | 表 |
|---:|---|---|---:|
| 0 | wasi_fd_prestat_get | 导入 | |
| 1 | wasi_fd_prestat_dir_name | 导入 | |
| 2 | wasi_proc_exit | 导入 | |
| 3 | wasi_random_get | 导入 | |
| 4 | __wasm_call_ctors | 链接器 | |
| 5 | _initialize | wasi-libc（导出） | |
| 6 | **decode** | 包装层（导出），内联了 ov_open_callbacks / _ov_open1 / _ov_open2 / _open_seekable2 / ov_raw_seek / ov_info | |
| 7 | **mem_seek** | 包装层 | 1 |
| 8 | memset | libc | |
| 9 | **mem_read** | 包装层 | 2 |
| 10 | calloc | libc | |
| 11 | ogg_stream_init | libogg framing.c | |
| 12 | _fetch_headers | Tremor vorbisfile.c | |
| 13 | ov_clear | Tremor vorbisfile.c | |
| 14 | memcpy | libc | |
| 15 | free | emmalloc（导出） | |
| 16 | _initial_pcmoffset | Tremor vorbisfile.c | |
| 17 | _get_prev_page_serial | Tremor vorbisfile.c | |
| 18 | _bisect_forward_serialno | Tremor vorbisfile.c | |
| 19 | vorbis_dsp_clear | Tremor block.c | |
| 20 | vorbis_block_clear | Tremor block.c | |
| 21 | vorbis_packet_blocksize | Tremor synthesis.c | |
| 22 | ogg_stream_packetout | libogg framing.c | |
| 23 | _get_next_page | Tremor vorbisfile.c（内联 ogg_sync_pageseek） | |
| 24 | ov_pcm_total | Tremor vorbisfile.c | |
| 25 | ogg_stream_pagein | libogg framing.c | |
| 26 | malloc | emmalloc（导出） | |
| 27 | ov_read | Tremor vorbisfile.c（内联 _fetch_and_process_packet、pcmout 等） | |
| 28 | **mem_close** | 包装层 | 7 |
| 29 | **mem_tell** | 包装层 | 8 |
| 30 | **release** | 包装层（导出） | |
| 31 | emmalloc_memalign | emmalloc | |
| 32 | emmalloc_attempt_allocate | emmalloc | |
| 33 | realloc | emmalloc | |
| 34 | vorbis_synthesis_init | Tremor block.c（内联 _vds_init） | |
| 35 | vorbis_book_init_decode | Tremor sharedbook.c | |
| 36 | mapping0_look | Tremor mapping0.c | |
| 37 | mapping0_free_look | Tremor mapping0.c | |
| 38 | vorbis_comment_clear | Tremor info.c | |
| 39 | vorbis_info_clear | Tremor info.c | |
| 40 | mapping0_free_info | Tremor mapping0.c | |
| 41 | vorbis_synthesis_headerin | Tremor info.c | |
| 42 | _vorbis_unpack_info | Tremor info.c | |
| 43 | _vorbis_unpack_comment | Tremor info.c | |
| 44 | _vorbis_unpack_books | Tremor info.c（内联 vorbis_staticbook_unpack） | |
| 45 | oggpack_read | libogg bitwise.c | |
| 46 | _book_maptype1_quantvals | Tremor sharedbook.c | |
| 47 | mapping0_unpack | Tremor mapping0.c | |
| 48 | floor1_unpack | Tremor floor1.c | 15 |
| 49 | floor1_icomp | Tremor floor1.c（qsort 比较函数） | 4 |
| 50 | qsort | wasi-libc（musl smoothsort） | |
| 51 | floor1_look | Tremor floor1.c | 16 |
| 52 | floor1_free_info | Tremor floor1.c | 17 |
| 53 | floor1_free_look | Tremor floor1.c | 18 |
| 54 | floor1_inverse1 | Tremor floor1.c | 19 |
| 55 | decode_packed_entry_number | Tremor codebook.c | |
| 56 | floor1_inverse2 | Tremor floor1.c | 20 |
| 57 | qsort_trinkle | wasi-libc（musl smoothsort） | |
| 58 | vorbis_lsp_to_curve | Tremor floor0.c | |
| 59 | floor0_unpack | Tremor floor0.c | 9 |
| 60 | floor0_look | Tremor floor0.c | 10 |
| 61 | floor0_free_info | Tremor floor0.c | 11 |
| 62 | floor0_free_look | Tremor floor0.c | 12 |
| 63 | floor0_inverse1 | Tremor floor0.c | 13 |
| 64 | floor0_inverse2 | Tremor floor0.c | 14 |
| 65 | _os_update_crc | libogg framing.c（slice-by-8） | |
| 66 | memmove | libc | |
| 67 | vorbis_synthesis | Tremor synthesis.c（内联 mapping0_inverse、mdct_backward） | |
| 68 | __wasi_proc_exit | wasi-libc | |
| 69 | __wasilibc_populate_preopens | wasi-libc | |
| 70 | _Exit | wasi-libc | |
| 71 | res0_free_info | Tremor res012.c | 23 |
| 72 | res0_free_look | Tremor res012.c | 24 |
| 73 | res0_unpack | Tremor res012.c | 21 |
| 74 | res0_look | Tremor res012.c | 22 |
| 75 | res0_inverse | Tremor res012.c | 25 |
| 76 | vorbis_book_decodevs_add | Tremor codebook.c | 5 |
| 77 | _01inverse | Tremor res012.c | |
| 78 | res1_inverse | Tremor res012.c | 26 |
| 79 | vorbis_book_decodev_add | Tremor codebook.c | 6 |
| 80 | res2_inverse | Tremor res012.c | 27 |
| 81 | sharedbook_sort32a | Tremor sharedbook.c（qsort 比较函数） | 3 |
| 82 | __init_random_seed | libc 构造函数：用 random_get 写入一个随机种子，与解码无关 | |

## 数据段布局

| 地址 | 内容 |
|---|---|
| `0x1000000` | `kMemoryCallbacks` = {2, 1, 7, 8}（mem_read / mem_seek / mem_close / mem_tell 的表下标） |
| `0x1000010` | `sincos_lookup0[1026]`（8 位，`_LOW_ACCURACY_`） |
| `0x1000420` | `sincos_lookup1[1024]` |
| `0x1000820` | MDCT `bitrev[16]` |
| `0x1000830` | 窗函数表 `vwin64` … `vwin8192`（8 位） |
| `0x1002810` | `FLOOR_fromdB_LOOKUP[256]` |
| `0x10031E8` | `_floor_P[2]` / `0x10031F0` `_residue_P[3]`（指向下面的 exportbundle） |
| `0x1003200` | libogg `crc_lookup[8][256]` |
| `0x1005200` | libogg bitwise `mask[33]` |
| `0x1005290` | 第 2 个数据段：emmalloc 空闲链表桶（64 × 16 字节） |
| `0x1005690` | `floor0/floor1_exportbundle`、`residue0/1/2_exportbundle`（函数表下标 9–27） |

## 自己编译 wasm2c 版本

```bash
cd wasm2c
cc -O2 -DWASM_RT_USE_MMAP=0 -o motor_vorbis_test main.c motor_vorbis.c wasm-rt-impl.c wasm-rt-mem-simple.c -lm
./motor_vorbis_test some.ogg out.s16le
```

`wasm-rt*.{h,c,inc}` 来自 wabt 1.0.42（Apache-2.0）；Homebrew 的 wabt 没带 `wasm-rt-mem-impl.c`，所以用 `wasm-rt-mem-simple.c` 代替。

## 使用的工具

- wabt 1.0.42（Homebrew）：`wasm2wat`、`wasm2c`、`wasm-objdump`、`wat2wasm`
- wabt 1.0.39（npm）：`wasm-decompile`（1.0.42 已移除这个工具）
- 函数名注入：自己写的脚本，往 wasm 末尾追加标准 `name` 自定义段
