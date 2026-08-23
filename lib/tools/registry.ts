/**
 * Tool registry — single source of truth for the landing tools box and its
 * search. Adding a tool means appending one entry here plus wiring its
 * launch callback in ToolsBox; search, categories and cards follow.
 */

import type { LucideIcon } from 'lucide-react';
import { Combine, Contrast, FileText, ImagePlus, Images, Scissors, ShieldCheck } from 'lucide-react';
import type { ToolMode } from '@/lib/enhance/types';

/** Coarse groups used by the shortcut chips (rendered once >1 exists). */
export type ToolCategory = 'pdf' | 'security';

export interface ToolDefinition {
  id: ToolMode;
  title: string;
  description: string;
  /** Alternative names users may type ("lock", "password", …). */
  aliases: string[];
  /** Extra searchable terms that are not shown anywhere. */
  keywords: string[];
  category: ToolCategory;
  icon: LucideIcon;
  gradient: string;
  chips: string[];
  cta: string;
}

export const TOOL_REGISTRY: ToolDefinition[] = [
  {
    id: 'dark-print',
    title: 'Dark Notes → Print',
    description:
      'Turn dark lecture slides into crisp, print-ready PDFs with auto-whitening and smart N-up layouts.',
    aliases: ['whiten', 'dark slides', 'print', 'n-up', 'ink saver'],
    keywords: ['optimize', 'convert', 'banner removal', 'slides'],
    category: 'pdf',
    icon: FileText,
    gradient: 'linear-gradient(135deg, #243BFF 0%, #0EA5E9 55%, #06B6D4 100%)',
    chips: ['Auto-whiten', 'Banner removal', 'Up to 10-up'],
    cta: 'Convert',
  },
  {
    id: 'enhance',
    title: 'Enhance Light PDF',
    description:
      'Fix faint scans — darken light ink, boost contrast and sharpen handwritten notes so printouts stay readable.',
    aliases: ['faint scan', 'light ink', 'scan fix', 'darken'],
    keywords: ['contrast', 'sharpen', 'handwritten notes', 'clean background'],
    category: 'pdf',
    icon: Contrast,
    gradient: 'linear-gradient(135deg, #5B35FF 0%, #A12CFF 55%, #EC4899 100%)',
    chips: ['Darken ink', 'Contrast', 'Sharpen'],
    cta: 'Enhance',
  },
  {
    id: 'protect',
    title: 'Protect PDF',
    description:
      'Add AES-256 encryption with an open password, or lock printing, copying and editing — fully on-device.',
    aliases: ['password', 'lock', 'encrypt', 'security', 'read only', 'copy protection'],
    keywords: ['aes', 'owner password', 'restrict', 'iso 32000', 'permissions'],
    category: 'security',
    icon: ShieldCheck,
    gradient: 'linear-gradient(135deg, #06B6D4 0%, #243BFF 55%, #5B35FF 100%)',
    chips: ['AES-256', 'Open password', 'Print/Copy locks'],
    cta: 'Protect',
  },
  {
    id: 'to-images',
    title: 'PDF to Images',
    description:
      'Convert every sheet into crisp JPG, PNG or WebP images — preview each page or export one tidy ZIP.',
    aliases: ['jpg', 'jpeg', 'png', 'webp', 'image converter', 'extract images'],
    keywords: ['convert to image', 'render pages', 'dpi', 'resolution', 'zip export', 'photo', 'save pages as images'],
    category: 'pdf',
    icon: Images,
    gradient: 'linear-gradient(135deg, #059669 0%, #14B8A6 55%, #06B6D4 100%)',
    chips: ['JPG · PNG · WebP', 'Up to 300 DPI', 'One-click ZIP'],
    cta: 'Convert',
  },
  {
    id: 'merge',
    title: 'Merge PDF',
    description:
      'Combine multiple documents into one — drag to arrange the order, smart-arrange series, then merge.',
    aliases: ['combine', 'join pdfs', 'unite', 'concatenate', 'stitch'],
    keywords: ['multiple pdfs', 'one file', 'order', 'sequence'],
    category: 'pdf',
    icon: Combine,
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #EC4899 55%, #A12CFF 100%)',
    chips: ['Up to 10 files', 'Smart Arrange', 'Custom filename'],
    cta: 'Merge',
  },
  {
    id: 'split',
    title: 'Split PDF',
    description:
      'Pull out one page range into its own PDF, or burst the document into fixed-size parts with a ZIP.',
    aliases: ['cut pdf', 'divide', 'separate pages', 'break pdf'],
    keywords: ['extract pages', 'page range', 'parts', 'burst'],
    category: 'pdf',
    icon: Scissors,
    gradient: 'linear-gradient(135deg, #F43F5E 0%, #EC4899 55%, #A12CFF 100%)',
    chips: ['Extract range', 'Burst every N', 'ZIP export'],
    cta: 'Split',
  },
  {
    id: 'to-pdf',
    title: 'Image to PDF',
    description:
      'Combine photos and screenshots into one tidy PDF — arrange the order, fit each page or use A4.',
    aliases: ['jpg to pdf', 'png to pdf', 'photo to pdf', 'scan to pdf', 'pictures', 'upload images', 'add photos'],
    keywords: ['convert images', 'combine photos', 'screenshots', 'one document', 'image', 'gallery'],
    category: 'pdf',
    icon: ImagePlus,
    gradient: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 55%, #EC4899 100%)',
    chips: ['JPG · PNG · WebP', 'Fit or A4 pages', 'Reorderable'],
    cta: 'Create PDF',
  },
];

/** Unique categories in registry order — drives the shortcut chip row. */
export function getToolCategories(tools: ToolDefinition[]): ToolCategory[] {
  const seen = new Set<ToolCategory>();
  for (const tool of tools) seen.add(tool.category);
  return Array.from(seen);
}

export function getToolById(id: ToolMode): ToolDefinition | undefined {
  return TOOL_REGISTRY.find((tool) => tool.id === id);
}
