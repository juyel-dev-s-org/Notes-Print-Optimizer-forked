/**
 * FAQ content layer — intentionally separate from the engine registry so
 * copy edits never touch routing/metadata code. The contract test
 * (tests/unit/faqs.test.ts) enforces that EVERY registry slug has an entry,
 * so adding a tool forces authors to write its FAQs too.
 *
 * Rules (enforced):
 *   - 4–6 questions per tool, unique, non-empty
 *   - answers ≤ 600 chars, front-load the keyword
 *   - claims must match real UI behavior (fact-check before editing)
 *   - visible accordion renders from THIS array; JSON-LD derives from it —
 *     structured data can never drift from what users see.
 */

import type { ToolDefinition } from '@/lib/tools/registry';

export interface FaqItem {
  /** Question as shown in the accordion (and schema `Question.name`). */
  q: string;
  /** Answer paragraph (and schema `acceptedAnswer.text`). */
  a: string;
}

export const TOOL_FAQS: Record<string, FaqItem[]> = {
  'dark-print': [
    {
      q: 'Will this really save printer ink?',
      a: 'Yes — massively. Dark-mode PDFs print a solid black box behind every line; whitening the background removes up to ~90% of toner use while keeping every word readable.',
    },
    {
      q: 'Does colored text stay readable after conversion?',
      a: 'Yes. Light text colors are remapped to darker equivalents tuned for contrast on the new white background, so highlights and keywords stay visible. Page-by-page preview lets you verify before printing.',
    },
    {
      q: 'Does it work on scanned or screenshot PDFs?',
      a: 'Native text-based dark PDFs convert perfectly. Image-based scans also get background whitening, but results depend on scan quality — check the preview first. For faint paper scans, follow up with the Enhance tool.',
    },
    {
      q: 'Are my files uploaded anywhere?',
      a: 'Never. Conversion runs entirely in your browser via WebAssembly — no server, no upload, no account — and works offline once loaded. Safe for confidential material.',
    },
    {
      q: 'Can I process multiple files at once?',
      a: 'Yes — queue several dark PDFs and export them back-to-back. Each keeps its own previews so tricky slides can be checked before committing paper.',
    },
  ],
  'enhance-light-pdf': [
    {
      q: 'My scan printed almost blank — can this fix it?',
      a: 'Usually yes. Faint photocopies and washed-out scans contain text that is technically there but too thin for printers. Enhancement rebuilds stroke thickness and contrast so the next print comes out crisp.',
    },
    {
      q: 'Why does text become this faint anyway?',
      a: 'Low-toner copying, faded receipts, pale pencil scans, or aggressive auto-exposure. This tool rebuilds contrast around the text itself instead of darkening the whole page, keeping backgrounds clean.',
    },
    {
      q: 'Will it blur or add noise?',
      a: 'No — the pass sharpens edges. Because it targets stroke density and local contrast, you get darker text without the gray speckle that brightness and contrast sliders cause.',
    },
    {
      q: 'Is there an intensity control?',
      a: 'Yes — from gentle touch-up to a strong pass for near-invisible text, with live preview to dial it in before export.',
    },
    {
      q: 'Does it help OCR apps read the text?',
      a: 'Often yes — OCR struggles with low-contrast input, and boosted strokes typically lift recognition accuracy. Output stays a normal PDF any OCR tool accepts.',
    },
  ],
  'protect-pdf': [
    {
      q: 'How strong is the protection?',
      a: 'AES-256 encryption — the standard used by banks — applied locally in your browser. Without the password, viewers see only gibberish.',
    },
    {
      q: 'Can I remove the password later?',
      a: 'Yes — reopen the file here, enter the password, and export an unlocked copy anytime. But there is no recovery: nothing leaves your device, so store the password safely first.',
    },
    {
      q: 'What if I forget the password?',
      a: 'There is no reset — by design. Offline encryption means nobody holds your key, including us. Treat it like a physical key and save it in a password manager.',
    },
    {
      q: 'Do recipients need special software?',
      a: 'No. Encrypted PDFs are a universal standard — Adobe Reader, Chrome, Edge, macOS Preview, and phone viewers all prompt for the password and open normally.',
    },
    {
      q: 'Is it safe for confidential documents?',
      a: 'That is the point. Encryption happens on your device even in airplane mode — contracts, medical records, and IDs never touch a network.',
    },
  ],
  'pdf-to-images': [
    {
      q: 'Which image formats can I export to?',
      a: 'PNG for pixel-perfect text, JPG for smaller shareable files. Both render from the original data at your chosen quality — not screenshots.',
    },
    {
      q: 'What resolution are the images?',
      a: 'You control it — standard quality suits chat apps, higher settings produce print-grade output. Match resolution to destination; higher means bigger files.',
    },
    {
      q: 'Can I convert only some pages?',
      a: 'Yes — pick individual pages or ranges (for example 3–7); only those become images. Perfect for pulling one chart from a 40-page report.',
    },
    {
      q: 'Why convert a PDF to images at all?',
      a: 'Chat attachments, slide decks, systems that reject PDFs, or freezing layout against edits — images lock the page exactly as printed.',
    },
    {
      q: 'How are multi-page exports delivered?',
      a: 'Each selected page becomes its own image file so you can insert them individually wherever needed.',
    },
  ],
  'merge-pdf': [
    {
      q: 'How many PDFs can I merge?',
      a: 'Limited only by device memory — dozens of files merge comfortably on typical laptops. No artificial cap, no watermark.',
    },
    {
      q: 'Can I control the order?',
      a: 'Yes — files merge top-to-bottom as listed, and you drag and drop to reorder before merging. Internal page order stays intact.',
    },
    {
      q: 'Will quality drop?',
      a: 'No — pages copy byte-for-byte: text stays selectable, vectors stay sharp, images are untouched. Only the container changes.',
    },
    {
      q: 'Does it work offline?',
      a: 'Fully. Merging is local WebAssembly; after first load you can go airplane mode. Nothing uploads — safe for confidential files.',
    },
    {
      q: 'Can different page sizes combine?',
      a: 'Yes — A4, Letter, slides, mixed orientations; each page keeps its own dimensions, like sheets in a binder.',
    },
  ],
  'split-pdf': [
    {
      q: 'How do I pick pages to extract?',
      a: 'Type ranges like 1-3, 7, 10-12; you get one PDF with exactly those pages in order.',
    },
    {
      q: 'Can I split into single pages?',
      a: 'Yes — every page becomes its own PDF, ideal for handing out one sheet per person from a class set.',
    },
    {
      q: 'Does splitting hurt quality?',
      a: 'None — pages copy into new containers without re-rendering. Text stays searchable; file size scales with the pages you keep.',
    },
    {
      q: 'Is there a page-count limit?',
      a: 'No hard cap — a 500-page book splits as easily as a 2-page receipt; big documents just take proportionally longer since processing is local.',
    },
    {
      q: 'Is splitting safe for private documents?',
      a: 'Completely — browser-only processing, no upload, works offline. Payslips, contracts, and medical results never leave the device.',
    },
  ],
  'image-to-pdf': [
    {
      q: 'Which image types work?',
      a: 'JPG, PNG, and WebP — mixed formats in one batch are fine. iPhone HEIC photos should be converted by your gallery app first.',
    },
    {
      q: 'How is page order decided?',
      a: 'List order becomes page order; drag to rearrange. Renaming files 01-, 02- and so on keeps large batches predictable.',
    },
    {
      q: 'What page size do I get?',
      a: 'Fit to A4 or Letter with margins for printing, or image-sized pages for digital reading.',
    },
    {
      q: 'Will photo quality drop?',
      a: 'Minimal — originals embed at native resolution rather than being re-sampled. Phone photos stay print-sharp.',
    },
    {
      q: 'Can I mix images with existing PDFs?',
      a: 'Convert images to PDF first, then Merge to append or interleave them — the standard flow for attaching signed scan photos to forms.',
    },
  ],
  'password-generator': [
    {
      q: 'How random are these passwords?',
      a: 'They come from your browser’s cryptographic random number generator (crypto.getRandomValues) — the same source used for encryption keys. Nothing is pre-computed, stored, or sent anywhere.',
    },
    {
      q: 'What password length should I use?',
      a: '16+ characters for anything that matters, 12 as an absolute floor. Every extra character multiplies the work an attacker must do — length beats cleverness every time.',
    },
    {
      q: 'Are these passwords safe to use for banking?',
      a: 'Yes — generation happens entirely on your device with crypto-grade randomness, and no password is ever transmitted or logged. Copy it straight into your password manager.',
    },
    {
      q: 'What does the strength meter measure?',
      a: 'Entropy in bits — length times the size of your chosen character pool. Roughly: under 50 bits is weak, 50–80 fair, 80–110 strong, and above 110 is overkill-proof.',
    },
    {
      q: 'Can I generate several passwords at once?',
      a: 'Yes — pick a quantity of up to 10 and copy them individually. Handy for team onboarding, Wi-Fi keys, or seeding multiple accounts in one sitting.',
    },
  ],
  'qr-generator': [
    {
      q: 'What can I put inside a QR code?',
      a: 'Links, plain text, email (mailto:), phone (tel:), or Wi-Fi (WIFI:T:… ) — scanners open links, dial numbers, and offer to join Wi-Fi directly from the code.',
    },
    {
      q: 'How does the scanner work — is my camera uploaded?',
      a: 'Never — scanning runs on-device via your camera or an uploaded image. The BarcodeDetector fast path is used when available, otherwise html5-qrcode (lazy-loaded) decodes locally. Nothing leaves your browser.',
    },
    {
      q: 'Which error correction level should I pick?',
      a: 'M is the sweet spot. Use Q or H when printing small, folding, or adding a logo — higher levels survive damage but hold less data. Styled/logo QRs need Q or H.',
    },
    {
      q: 'PNG or SVG — which should I download?',
      a: 'PNG for chat and docs, SVG for print. In Advanced style mode both carry your rounded dots, gradient and logo — still razor-sharp at any size.',
    },
    {
      q: 'Do QR codes expire or track scans?',
      a: 'Never — these are static, offline-generated codes. The data lives in the pattern itself; no redirect, no expiry, no analytics.',
    },
    {
      q: 'Can I add a logo or brand colors?',
      a: 'Yes — enable Advanced style to pick dot and corner shapes (square/dots/rounded/classy), gradients, and a center logo. The QR stays scannable because error correction is enforced.',
    },
  ],
  'word-counter': [
    {
      q: 'What counts as a word?',
      a: 'Any run of characters separated by spaces or line breaks — the same rule most word processors use. Hyphenated terms like “state-of-the-art” count as one word.',
    },
    {
      q: 'How is reading time calculated?',
      a: 'At 200 words per minute, the average silent-reading speed for adults. Speaking time uses a slower 130 wpm, closer to a comfortable presentation pace.',
    },
    {
      q: 'Do characters include spaces?',
      a: 'Both are shown — one count with spaces (useful for forms and tweet-style limits) and one without (common in print and academic requirements).',
    },
    {
      q: 'What are the top keywords for?',
      a: 'They reveal your most repeated meaningful words, so you can spot overused terms before submitting an essay or article. Common filler words are filtered out.',
    },
    {
      q: 'Is my text uploaded anywhere?',
      a: 'Never — counting happens live in your browser as you type, and nothing is stored after you leave. Safe for drafts, contracts, and unpublished writing.',
    },
  ],
  'case-converter': [
    {
      q: 'What happens to punctuation when converting?',
      a: 'Punctuation and numbers stay untouched — only letter cases change. That keeps emails, code snippets, and URLs recognizable after conversion.',
    },
    {
      q: 'What is the difference between camelCase and PascalCase?',
      a: 'camelCase starts lowercase (myVariable) and is the norm in JavaScript, while PascalCase starts uppercase (MyClass) and is common for class names. Both strip spaces and rejoin words.',
    },
    {
      q: 'When should I use snake_case versus kebab-case?',
      a: 'snake_case (my_variable) dominates Python and databases; kebab-case (my-variable) is idiomatic in CSS classes and many URLs. This tool outputs both instantly.',
    },
    {
      q: 'Will converting affect my formatting?',
      a: 'No line breaks, tabs, or multiple spaces are collapsed or trimmed. Each paragraph keeps its original shape so pasted documents stay tidy.',
    },
    {
      q: 'Is my text sent to a server?',
      a: 'Never — conversion runs entirely in your browser as you type, and nothing is retained after you leave. Safe for source code and confidential notes.',
    },
  ],
};

/** FAQs for a tool slug; empty array for unknown slugs (defensive). */
export function getFaqsForSlug(slug: ToolDefinition['slug']): FaqItem[] {
  return TOOL_FAQS[slug] ?? [];
}

/**
 * FAQPage schema derived from the SAME array the visible accordion renders —
 * Google requires structured data to match on-page content exactly.
 */
export function buildFaqJsonLd(canonicalUrl: string, faqs: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${canonicalUrl}#faq`,
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}
