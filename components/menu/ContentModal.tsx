'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { loadContent, markdownToHtml } from '@/lib/menu';
import type { ContentId } from '@/lib/menu';

/** Human-readable titles for each content document. */
const CONTENT_TITLES: Record<ContentId, string> = {
  'about': 'About',
  'user-guide': 'User Guide',
  'faq': 'Frequently Asked Questions',
  'whats-new': "What's New",
  'changelog': 'Changelog',
  'privacy-policy': 'Privacy Policy',
  'terms-of-use': 'Terms of Use',
  'jsl-license': 'Juyel Source License (JSL) v1.0',
  'copyright-notice': 'Copyright Notice',
};

interface ContentModalProps {
  contentId: ContentId;
  onClose: () => void;
}

/**
 * Read-only document viewer. Loads Markdown from `public/content/` and renders
 * it with the safe built-in renderer - content is never duplicated in React.
 */
export const ContentModal: React.FC<ContentModalProps> = ({ contentId, onClose }) => {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHtml(null);
    setError(null);
    loadContent(contentId)
      .then((md) => {
        if (cancelled) return;
        if (md === null) {
          setError('This document could not be loaded.');
        } else {
          setHtml(markdownToHtml(md));
        }
      })
      .catch(() => {
        if (!cancelled) setError('This document could not be loaded.');
      });
    return () => {
      cancelled = true;
    };
  }, [contentId]);

  return (
    <Modal title={CONTENT_TITLES[contentId]} onClose={onClose}>
      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2.5 text-xs text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : html === null ? (
        <div className="flex items-center justify-center gap-2 py-10 text-xs text-ink-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading…</span>
        </div>
      ) : (
        <div
          className="text-[13px] leading-relaxed text-ink"
          // Safe: markdownToHtml escapes all input before applying a whitelist.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </Modal>
  );
};
