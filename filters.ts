import type { VideoFilter } from '@/types';

export interface FilterOption {
  id: VideoFilter;
  label: string;
  css: string;
}

export const FILTERS: FilterOption[] = [
  { id: 'normal', label: 'Normal', css: 'none' },
  { id: 'grayscale', label: 'Grayscale', css: 'grayscale(1)' },
  { id: 'sepia', label: 'Sepia', css: 'sepia(0.8)' },
  { id: 'contrast', label: 'High Contrast', css: 'contrast(1.6) saturate(1.2)' },
  { id: 'vintage', label: 'Vintage', css: 'sepia(0.4) contrast(1.1) brightness(0.9) saturate(1.3)' },
];

export function getFilterCss(filter: VideoFilter | undefined): string {
  if (!filter) return 'none';
  return FILTERS.find((f) => f.id === filter)?.css ?? 'none';
}
