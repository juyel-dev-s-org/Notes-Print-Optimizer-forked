/**
 * Tool registry — single source of truth for the landing tools box and its
 * search. Adding a tool means appending one entry here plus wiring its
 * launch callback in ToolsBox; search, categories and cards follow.
 */

import type { LucideIcon } from 'lucide-react';
import { CaseSensitive, Combine, Contrast, FileText, ImagePlus, Images, KeyRound, LayoutGrid, QrCode, Scissors, ShieldCheck, Type } from 'lucide-react';
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
    gradient: 'linear-gradient(135deg, #10B981 0%, #14B8A6 55%, #06B6D4 100%)',
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
    gradient: 'linear-gradient(135deg, #0E7490 0%, #14B8A6 55%, #06B6D4 100%)',
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
    gradient: 'linear-gradient(135deg, #047857 0%, #0F766E 55%, #0891B2 100%)',
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
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #14B8A6 55%, #0891B2 100%)',
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
    gradient: 'linear-gradient(135deg, #EF4444 0%, #14B8A6 55%, #0891B2 100%)',
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
    gradient: 'linear-gradient(135deg, #10B981 0%, #0E7490 55%, #0891B2 100%)',
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
    gradient: 'linear-gradient(135deg, #06B6D4 0%, #0EA5E9 55%, #14B8A6 100%)',
    chips: ['Crypto-random', '8–64 chars', 'Bulk generate'],
    cta: 'Generate',
  },
  {
    id: 'qr-gen',
    slug: 'qr-generator',
    title: 'QR Studio',
    description:
      'Generate & scan QR codes in one place — styled dots, gradients & logos, plus camera, image & paste scanning, all on-device.',
    seoTitle: 'QR Code Generator + Scanner — Generate & Scan, Styled, 100% Offline',
    seoDescription:
      'Generate & scan QR codes on-device. Create styled QR codes (dots, gradients, logo) and scan via camera, image or paste — links, Wi-Fi, contacts — free, private.',
    aliases: ['qr code', 'qrcode', 'qr scanner', 'qr reader', 'scan code', 'link to qr'],
    keywords: ['generator', 'scanner', 'png', 'svg', 'wifi', 'url', 'qr scan', 'qr code styling', 'camera'],
    category: 'utility',
    icon: QrCode,
    gradient: 'linear-gradient(135deg, #14B8A6 0%, #06B6D4 55%, #0EA5E9 100%)',
    chips: ['Generate + Scan', 'Styled QR', 'Camera & image'],
    cta: 'Open Studio',
  },
  {
    id: 'word-count',
    slug: 'word-counter',
    title: 'Word Counter',
    description:
      'Count words, characters, sentences and reading time as you type — with top-keyword insight, fully offline.',
    seoTitle: 'Word Counter — Words, Characters, Sentences & Reading Time',
    seoDescription:
      'Count words, characters with and without spaces, sentences, paragraphs and reading time live as you type. Top keywords included — free, private, fully offline.',
    aliases: ['word count', 'character count', 'letter count', 'reading time', 'text length'],
    keywords: ['words', 'characters', 'sentences', 'paragraphs', 'essay', 'keywords', 'speaking time'],
    category: 'text',
    icon: Type,
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 55%, #14B8A6 100%)',
    chips: ['Live stats', 'Reading time', 'Top keywords'],
    cta: 'Count',
  },
  {
    id: 'case-convert',
    slug: 'case-converter',
    title: 'Case Converter',
    description:
      'Switch text between UPPERCASE, lowercase, Title Case, camelCase, snake_case and more — one tap each.',
    seoTitle: 'Case Converter — UPPER, lower, Title, camel, snake & kebab',
    seoDescription:
      'Convert text between UPPERCASE, lowercase, Title Case, Sentence case, camelCase, PascalCase, snake_case and kebab-case instantly — free, private, on-device.',
    aliases: ['uppercase', 'lowercase', 'title case', 'camelcase', 'snake case', 'kebab case', 'capitalize'],
    keywords: ['convert case', 'text transform', 'sentence case', 'pascalcase', 'alternating', 'inverse'],
    category: 'text',
    icon: CaseSensitive,
    gradient: 'linear-gradient(135deg, #14B8A6 0%, #059669 55%, #06B6D4 100%)',
    chips: ['11 formats', 'One-tap copy', 'Live convert'],
    cta: 'Convert',
  },
  {
    id: 'nup',
    slug: 'n-up',
    title: 'N-up PDF',
    description: 'Put 2, 4, 6 or 9 pages on one sheet — upload one or many PDFs, merge if needed, then export.',
    seoTitle: 'N-up PDF — 2, 4, 6, 9 Pages Per Sheet, Merge + Layout',
    seoDescription:
      'N-up PDFs on-device: upload one or many files (auto-merged), pick 1/2/4/6/9 per sheet, A4/Letter, portrait/landscape — export a print-ready N-up PDF instantly.',
    aliases: ['nup', 'n-up', 'pages per sheet', 'handout', '2 up', '4 up', 'imposition'],
    keywords: ['n-up', 'layout', 'handout', 'multiple pages', 'merge', 'sheets', 'print'],
    category: 'pdf',
    icon: LayoutGrid,
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #F97316 55%, #EF4444 100%)',
    chips: ['Auto-merge', '1/2/4/6/9-up', 'A4/Letter'],
    cta: 'N-up',
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
