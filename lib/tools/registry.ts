/**
 * Tool registry — single source of truth for the landing tools box and its
 * search. Adding a tool means appending one entry here plus wiring its
 * launch callback in ToolsBox; search, categories and cards follow.
 */

import type { LucideIcon } from 'lucide-react';
import { Combine, Contrast, FileText, ImagePlus, Images, KeyRound, QrCode, Scissors, ShieldCheck } from 'lucide-react';
import type { ToolMode } from '@/lib/enhance/types';

/** Coarse groups used by the shortcut chips (rendered once >1 exists). */
export type ToolCategory = 'pdf' | 'image' | 'security' | 'text' | 'utility';

export interface ToolDefinition {
  id: ToolMode;
  /** Stable public route segment — part of the URL contract, never rename casually. */
  slug: string;
  title: string;
  description: string;
  /** Unique <title> for the tool route (brand suffix comes from the layout template). */
  seoTitle: string;
  /** Unique meta description for the tool route (crawl-facing, not UI copy). */
  seoDescription: string;
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
    slug: 'dark-print',
    title: 'Dark Notes → Print',
    description:
      'Turn dark lecture slides into crisp, print-ready PDFs with auto-whitening and smart N-up layouts.',
    seoTitle: 'Dark Notes to Print-Ready PDF — Auto-Whitening & Smart N-Up',
    seoDescription:
      'Convert dark lecture slides and photos into crisp, ink-saving print-ready PDFs. Auto-whitening, banner removal and smart N-Up layouts — free, private, fully on-device.',
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
    slug: 'enhance-light-pdf',
    title: 'Enhance Light PDF',
    description:
      'Fix faint scans — darken light ink, boost contrast and sharpen handwritten notes so printouts stay readable.',
    seoTitle: 'Enhance Light Scans — Darken Faint Ink & Boost Contrast',
    seoDescription:
      'Fix faint, washed-out scans online free. Darken light ink, boost contrast and sharpen handwriting so every printout stays readable — 100% on-device, no uploads.',
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
    slug: 'protect-pdf',
    title: 'Protect PDF',
    description:
      'Add AES-256 encryption with an open password, or lock printing, copying and editing — fully on-device.',
    seoTitle: 'Password Protect PDF — AES-256 Encryption & Permission Locks',
    seoDescription:
      'Password-protect a PDF with AES-256 encryption in your browser. Add an open password or lock printing, copying and editing — private, free and never uploaded.',
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
    slug: 'pdf-to-images',
    title: 'PDF to Images',
    description:
      'Convert every sheet into crisp JPG, PNG or WebP images — preview each page or export one tidy ZIP.',
    seoTitle: 'PDF to Images — Convert PDF Pages to JPG, PNG or WebP',
    seoDescription:
      'Convert PDF pages to high-resolution JPG, PNG or WebP images right in your browser. Pick a DPI, preview every sheet and download one tidy ZIP — free and on-device.',
    aliases: ['jpg', 'jpeg', 'png', 'webp', 'image converter', 'extract images'],
    keywords: ['convert to image', 'render pages', 'dpi', 'resolution', 'zip export', 'photo', 'save pages as images'],
    category: 'image',
    icon: Images,
    gradient: 'linear-gradient(135deg, #059669 0%, #14B8A6 55%, #06B6D4 100%)',
    chips: ['JPG · PNG · WebP', 'Up to 300 DPI', 'One-click ZIP'],
    cta: 'Convert',
  },
  {
    id: 'merge',
    slug: 'merge-pdf',
    title: 'Merge PDF',
    description:
      'Combine multiple documents into one — drag to arrange the order, smart-arrange series, then merge.',
    seoTitle: 'Merge PDF — Combine Documents Into One, In Your Order',
    seoDescription:
      'Merge multiple PDF files into one document online free. Drag pages into the perfect order, smart-arrange numbered series and export with a custom filename — private and on-device.',
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
    slug: 'split-pdf',
    title: 'Split PDF',
    description:
      'Pull out one page range into its own PDF, or burst the document into fixed-size parts with a ZIP.',
    seoTitle: 'Split PDF — Extract Page Ranges or Burst Into Parts',
    seoDescription:
      'Split a PDF online free: extract one page range into its own file or burst the whole document into fixed-size parts with a single ZIP download — fast and fully on-device.',
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
    slug: 'image-to-pdf',
    title: 'Image to PDF',
    description:
      'Combine photos and screenshots into one tidy PDF — arrange the order, fit each page or use A4.',
    seoTitle: 'Image to PDF — Combine JPG, PNG & WebP Into One Document',
    seoDescription:
      'Turn photos and screenshots into one tidy PDF in your browser. Arrange the order, choose fit-to-image or A4 pages and download a print-ready file — free, private, on-device.',
    aliases: ['jpg to pdf', 'png to pdf', 'photo to pdf', 'scan to pdf', 'pictures', 'upload images', 'add photos'],
    keywords: ['convert images', 'combine photos', 'screenshots', 'one document', 'image', 'gallery'],
    category: 'image',
    icon: ImagePlus,
    gradient: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 55%, #EC4899 100%)',
    chips: ['JPG · PNG · WebP', 'Fit or A4 pages', 'Reorderable'],
    cta: 'Create PDF',
  },
  {
    id: 'password-gen',
    slug: 'password-generator',
    title: 'Password Generator',
    description:
      'Create strong random passwords with crypto-grade randomness — pick length and character sets, copy in one tap.',
    seoTitle: 'Strong Password Generator — Random & Secure, 100% Offline',
    seoDescription:
      'Generate strong, random passwords in your browser with crypto-grade randomness. Choose length, letters, numbers and symbols — free, private and fully offline.',
    aliases: ['password', 'random password', 'strong password', 'passphrase', 'secure'],
    keywords: ['generator', 'random', 'entropy', 'characters', 'symbols', 'security'],
    category: 'security',
    icon: KeyRound,
    gradient: 'linear-gradient(135deg, #0EA5E9 0%, #243BFF 55%, #5B35FF 100%)',
    chips: ['Crypto-random', '8–64 chars', 'Bulk generate'],
    cta: 'Generate',
  },
  {
    id: 'qr-gen',
    slug: 'qr-generator',
    title: 'QR Code Generator',
    description:
      'Turn links, text or Wi-Fi details into a crisp QR code — pick size and colors, then download PNG or SVG.',
    seoTitle: 'QR Code Generator — Download PNG or SVG, 100% Offline',
    seoDescription:
      'Create QR codes for links, text and Wi-Fi in your browser. Choose size, colors and error correction, then download crisp PNG or SVG — free, private, on-device.',
    aliases: ['qr code', 'qrcode', 'barcode', 'scan code', 'link to qr'],
    keywords: ['generator', 'png', 'svg', 'wifi', 'url', 'download', 'error correction'],
    category: 'utility',
    icon: QrCode,
    gradient: 'linear-gradient(135deg, #06B6D4 0%, #0EA5E9 55%, #243BFF 100%)',
    chips: ['PNG · SVG', 'Wi-Fi & URLs', 'Color control'],
    cta: 'Create QR',
  },
];

/** Preferred display order for category chips — keeps Image next to PDF. */
const CATEGORY_ORDER: ToolCategory[] = ['pdf', 'image', 'security', 'utility', 'text'];

/** Unique categories in preferred order — drives the shortcut chip row. */
export function getToolCategories(tools: ToolDefinition[]): ToolCategory[] {
  const seen = new Set<ToolCategory>();
  for (const tool of tools) seen.add(tool.category);
  return CATEGORY_ORDER.filter((c) => seen.has(c));
}

// ---------------------------------------------------------------------------
// Public route contract — slugs are stable, URL-facing identifiers.
// Every tool route (/tools/<slug>/), sitemap entry and card link derives
// from this mapping. Adding a tool = adding a registry entry; nothing else.
// ---------------------------------------------------------------------------

/** Root-relative href for a tool's public route (trailing slash by contract). */
export function toolHref(mode: ToolMode): string {
  const def = TOOL_REGISTRY.find((t) => t.id === mode);
  if (!def) throw new Error(`Unknown ToolMode: ${mode}`);
  return `/tools/${def.slug}/`;
}

/** Registry definition for a public slug, or undefined when unknown. */
export function getToolBySlug(slug: string): ToolDefinition | undefined {
  return TOOL_REGISTRY.find((t) => t.slug === slug);
}

/** Public slug for a ToolMode (throws on unknown mode — programming error). */
export function slugForMode(mode: ToolMode): string {
  const def = TOOL_REGISTRY.find((t) => t.id === mode);
  if (!def) throw new Error(`Unknown ToolMode: ${mode}`);
  return def.slug;
}

/** ToolMode for a public slug, or null when the slug is not a tool route. */
export function modeForSlug(slug: string): ToolMode | null {
  return getToolBySlug(slug)?.id ?? null;
}

/** All public slugs in registry order — feeds generateStaticParams/sitemap. */
export function getAllToolSlugs(): string[] {
  return TOOL_REGISTRY.map((t) => t.slug);
}

export function getToolById(id: ToolMode): ToolDefinition | undefined {
  return TOOL_REGISTRY.find((tool) => tool.id === id);
}
