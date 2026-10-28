import previewIndex from '../assets/track-previews/index.json'
import previewMetadata from '../assets/track-previews/metadata.json'

const previewFiles = import.meta.glob<string>('../assets/track-previews/*.{png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
})

const filenames: Record<string, string> = previewIndex
type PreviewKind = 'card' | 'thumbnail' | 'map' | 'scene'
const metadata: Record<string, { kind: string }> = previewMetadata

export function trackPreviewUrl(id: string): string {
  const filename = filenames[id]
  return filename ? previewFiles[`../assets/track-previews/${filename}`] ?? '' : ''
}

export function trackPreviewKind(id: string): PreviewKind | undefined {
  const kind = metadata[id]?.kind
  return kind === 'card' || kind === 'thumbnail' || kind === 'map' || kind === 'scene' ? kind : undefined
}
