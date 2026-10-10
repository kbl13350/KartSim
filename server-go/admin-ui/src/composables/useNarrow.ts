import { onBeforeUnmount, onMounted, ref } from 'vue'

/** Whether the window is narrower than `width` (dialogs and drawers go full width). */
export function useNarrow(width = 768) {
  const narrow = ref(window.innerWidth < width)
  const update = () => {
    narrow.value = window.innerWidth < width
  }
  onMounted(() => window.addEventListener('resize', update, { passive: true }))
  onBeforeUnmount(() => window.removeEventListener('resize', update))
  return narrow
}
