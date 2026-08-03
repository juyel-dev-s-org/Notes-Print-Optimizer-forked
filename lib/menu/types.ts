/**
 * Settings & Information Center - menu model.
 *
 * The drawer UI is a generic renderer. It never hardcodes entries; every
 * section and item is contributed declaratively by `menu.config.ts` (or, in
 * future, by individual feature modules registering metadata here). Editing
 * the menu therefore only requires editing configuration, never the drawer.
 */

/** Actions an item can trigger. Pure data - no components, no closures. */
export type MenuAction =
  /** Open a URL (optionally in a new tab). */
  | { type: 'link'; href: string; external?: boolean }
  /** Open a read-only Markdown document from `public/content/`. */
  | { type: 'content'; contentId: ContentId }
  /** Open the existing feedback form in a modal. */
  | { type: 'feedback' }
  /** Clear browser/app caches (privacy action). */
  | { type: 'clear-cache' }
  /** Delegate to an app-level handler by name (e.g. 'goto-merge'). */
  | { type: 'app'; name: string }
  /** Placeholder - does nothing (used with `disabled`/`badge`). */
  | { type: 'noop' };

/** Identifiers of Markdown documents served from `public/content/`. */
export type ContentId =
  | 'about'
  | 'user-guide'
  | 'faq'
  | 'whats-new'
  | 'changelog'
  | 'privacy-policy'
  | 'terms-of-use'
  | 'jsl-license'
  | 'copyright-notice';

export interface MenuItemConfig {
  /** Stable unique id (used as React key and for analytics). */
  id: string;
  /** Icon key resolved by `components/menu/icons.ts`. */
  icon: string;
  /** Primary label. */
  title: string;
  /** Optional secondary line under the title. */
  description?: string;
  /** Small pill label (e.g. 'Soon', 'New'). */
  badge?: string;
  /** Renders the item but blocks interaction. */
  disabled?: boolean;
  /** Removes the item entirely when true. */
  hidden?: boolean;
  /** Behavior when activated. */
  action: MenuAction;
}

export interface MenuSectionConfig {
  /** Stable unique id. */
  id: string;
  /** Icon key for the accordion header. */
  icon: string;
  /** Section heading. */
  title: string;
  /** Optional short caption shown beside the heading. */
  caption?: string;
  /** Ordered items in this section. */
  items: MenuItemConfig[];
}

/** Resolved (visible-only) models handed to the renderer. */
export interface ResolvedMenuItem extends MenuItemConfig {}
export interface ResolvedMenuSection {
  id: string;
  icon: string;
  title: string;
  caption?: string;
  items: ResolvedMenuItem[];
}
