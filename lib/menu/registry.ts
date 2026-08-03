/**
 * MenuRegistry - generic, metadata-driven menu resolution.
 *
 * Modelled on the project's existing registry pattern (see
 * `lib/pipeline/PluginRegistry.ts`). Sections/items register as pure metadata
 * and the drawer resolves them at render time. The UI never hardcodes entries.
 *
 * The processing-pipeline plugin registry cannot represent non-tool sections
 * (Legal, Community, Resources, Developer), so this purpose-built registry is
 * used instead - honouring the "reuse the registry pattern" guidance without
 * forcing menu entries into the execution pipeline.
 */

import type { MenuSectionConfig, ResolvedMenuSection } from './types';

export class MenuRegistry {
  private sections: MenuSectionConfig[] = [];

  /** Register (or replace) a section by id. */
  register(section: MenuSectionConfig): void {
    const idx = this.sections.findIndex((s) => s.id === section.id);
    if (idx >= 0) this.sections[idx] = section;
    else this.sections.push(section);
  }

  /** Remove a section by id. */
  unregister(id: string): void {
    this.sections = this.sections.filter((s) => s.id !== id);
  }

  /** Resolve visible sections/items (drops hidden entries, preserves order). */
  resolve(): ResolvedMenuSection[] {
    return this.sections
      .map((section) => ({
        id: section.id,
        icon: section.icon,
        title: section.title,
        caption: section.caption,
        items: section.items.filter((item) => !item.hidden),
      }))
      .filter((section) => section.items.length > 0);
  }

  /** Detect duplicate section/item ids (developer safeguard). */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const sectionIds = new Set<string>();
    const itemIds = new Set<string>();
    for (const s of this.sections) {
      if (sectionIds.has(s.id)) errors.push(`Duplicate section id: ${s.id}`);
      sectionIds.add(s.id);
      for (const item of s.items) {
        if (itemIds.has(item.id)) errors.push(`Duplicate item id: ${item.id}`);
        itemIds.add(item.id);
      }
    }
    return { valid: errors.length === 0, errors };
  }
}
