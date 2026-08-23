'use client';

import React from 'react';

export interface JsonLdProps {
  /** One or more schema.org objects, serialized verbatim. */
  data: Record<string, unknown> | Record<string, unknown>[];
}

/**
 * Typed JSON-LD injector — server-renderable (no hooks), CSP-safe
 * ('unsafe-inline' script-src is already granted for the theme bootstrap).
 * Only schemas that accurately describe visible page content belong here.
 */
export const JsonLd: React.FC<JsonLdProps> = ({ data }) => (
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
  />
);
