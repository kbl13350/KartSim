import previewIndex from '../assets/vehicle-previews/index.json'
import previewMetadata from '../assets/vehicle-previews/metadata.json'

const previewFiles = import.meta.glob<string>('../assets/vehicle-previews/*.{png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
})

const filenames: Record<string, string> = previewIndex
type PreviewKind = 'card' | 'thumbnail' | 'scene'
const metadata: Record<string, { kind: string }> = previewMetadata

export function vehiclePreviewUrl(id: string): string {
  const filename = filenames[id]
  return filename ? previewFiles[`../assets/vehicle-previews/${filename}`] ?? '' : ''
}

export function vehiclePreviewKind(id: string): PreviewKind | undefined {
  const kind = metadata[id]?.kind
  return kind === 'card' || kind === 'thumbnail' || kind === 'scene' ? kind : undefined
}
