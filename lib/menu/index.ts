/**
 * Settings & Information Center - public facade.
 *
 * Modular, dependency-driven menu system:
 *
 *   types.ts         -> declarative menu model
 *   menu.config.ts   -> single source of truth for sections/items
 *   registry.ts      -> metadata resolution (mirrors PluginRegistry pattern)
 *   markdown.ts      -> safe, dependency-free document rendering
 *   contentLoader.ts -> loads Markdown from public/content/
 *   actions.ts       -> side-effect handlers (clear cache, ...)
 *
 * UI and workflow code should import from this module only.
 */

import { MenuRegistry } from './registry';
import { MENU_CONFIG } from './menu.config';

export type {
  ContentId,
  MenuAction,
  MenuItemConfig,
  MenuSectionConfig,
  ResolvedMenuItem,
  ResolvedMenuSection,
} from './types';

export { MenuRegistry } from './registry';
export { MENU_CONFIG } from './menu.config';
export { markdownToHtml } from './markdown';
export { loadContent, clearContentCache } from './contentLoader';
export { clearAppCaches } from './actions';

/** Shared registry pre-populated from the declarative config. */
export const menuRegistry = new MenuRegistry();
for (const section of MENU_CONFIG) {
  menuRegistry.register(section);
}
