/*
 * 精简版线性内存实现（Homebrew 的 wabt 包未附带 wasm-rt-mem-impl.c）。
 * 基于 calloc/realloc，需配合 -DWASM_RT_USE_MMAP=0 编译（使用软件边界检查）。
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "wasm-rt.h"

void wasm_rt_allocate_memory(wasm_rt_memory_t *mem, uint64_t initial_pages,
                             uint64_t max_pages, bool is64, uint32_t page_size) {
  uint64_t size = initial_pages * page_size;
  mem->data = calloc(size ? size : 1, 1);
  if (!mem->data) { fprintf(stderr, "out of memory\n"); abort(); }
  mem->data_end = mem->data + size;
  mem->page_size = page_size;
  mem->pages = initial_pages;
  mem->max_pages = max_pages;
  mem->size = size;
  mem->is64 = is64;
}

uint64_t wasm_rt_grow_memory(wasm_rt_memory_t *mem, uint64_t delta) {
  uint64_t old_pages = mem->pages, new_pages = old_pages + delta;
  if (new_pages < old_pages || new_pages > mem->max_pages) return (uint64_t)-1;
  uint64_t old_size = mem->size, new_size = new_pages * mem->page_size;
  uint8_t *p = realloc(mem->data, new_size ? new_size : 1);
  if (!p) return (uint64_t)-1;
  memset(p + old_size, 0, new_size - old_size);
  mem->data = p;
  mem->data_end = p + new_size;
  mem->pages = new_pages;
  mem->size = new_size;
  return old_pages;
}

void wasm_rt_free_memory(wasm_rt_memory_t *mem) {
  free(mem->data);
  mem->data = mem->data_end = NULL;
}
