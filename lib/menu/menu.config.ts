/**
 * Settings & Information Center - declarative menu configuration.
 *
 * This is the single source of truth for the drawer. To add, remove or edit a
 * menu entry, change this file only - the drawer renders whatever is declared
 * here. No UI component hardcodes these items.
 *
 * Links marked `external: true` open in a new tab.
 */

import type { MenuSectionConfig } from './types';

const GITHUB_REPO = 'https://github.com/juyel-dev/Notes-Print-Optimizer';
const OFFICIAL_SITE = 'https://juyel-dev.github.io/Notes-Print-Optimizer';
const TELEGRAM_COMMUNITY = 'https://t.me/PrintOptimizer_chat';
const TELEGRAM_CHANNEL = 'https://t.me/PrintOptimizer';
const CONTACT_EMAIL = 'myself.juyel.dev@gmail.com';

export const MENU_CONFIG: MenuSectionConfig[] = [
  {
    id: 'tools',
    icon: 'wrench',
    title: 'Tools',
    items: [
      {
        id: 'tools.merge',
        icon: 'merge',
        title: 'Merge PDFs',
        description: 'Combine multiple PDFs into one document.',
        action: { type: 'app', name: 'goto-merge' },
      },
    ],
  },

  {
    id: 'privacy',
    icon: 'shield',
    title: 'Privacy',
    items: [
      {
        id: 'privacy.local',
        icon: 'monitor',
        title: '100% Local Processing',
        description: 'Files never leave your device.',
        action: { type: 'content', contentId: 'privacy-policy' },
      },
      {
        id: 'privacy.clear-cache',
        icon: 'trash',
        title: 'Clear Cache',
        description: 'Remove stored data and cached files.',
        action: { type: 'clear-cache' },
      },
    ],
  },

  {
    id: 'community',
    icon: 'users',
    title: 'Community',
    items: [
      {
        id: 'community.feedback',
        icon: 'send',
        title: 'Send Feedback',
        description: 'Share thoughts or report an issue.',
        action: { type: 'feedback' },
      },
      {
        id: 'community.telegram-group',
        icon: 'users',
        title: 'Join Telegram Community',
        description: 'Chat with other users.',
        action: { type: 'link', href: TELEGRAM_COMMUNITY, external: true },
      },
      {
        id: 'community.telegram-channel',
        icon: 'megaphone',
        title: 'Join Telegram Channel',
        description: 'Get updates and announcements.',
        action: { type: 'link', href: TELEGRAM_CHANNEL, external: true },
      },
      {
        id: 'community.support',
        icon: 'heart',
        title: 'Support Development',
        description: 'Help keep this project alive.',
        badge: 'Soon',
        disabled: true,
        action: { type: 'noop' },
      },
    ],
  },

  {
    id: 'resources',
    icon: 'book',
    title: 'Resources',
    items: [
      {
        id: 'resources.about',
        icon: 'info',
        title: 'About',
        action: { type: 'content', contentId: 'about' },
      },
      {
        id: 'resources.user-guide',
        icon: 'book',
        title: 'User Guide',
        action: { type: 'content', contentId: 'user-guide' },
      },
      {
        id: 'resources.faq',
        icon: 'help',
        title: 'FAQ',
        action: { type: 'content', contentId: 'faq' },
      },
      {
        id: 'resources.whats-new',
        icon: 'sparkles',
        title: "What's New",
        action: { type: 'content', contentId: 'whats-new' },
      },
      {
        id: 'resources.changelog',
        icon: 'file',
        title: 'Changelog',
        action: { type: 'content', contentId: 'changelog' },
      },
      {
        id: 'resources.contact',
        icon: 'mail',
        title: 'Contact Developer',
        action: { type: 'link', href: `mailto:${CONTACT_EMAIL}`, external: false },
      },
    ],
  },

  {
    id: 'legal',
    icon: 'scale',
    title: 'Legal',
    items: [
      {
        id: 'legal.privacy-policy',
        icon: 'lock',
        title: 'Privacy Policy',
        action: { type: 'content', contentId: 'privacy-policy' },
      },
      {
        id: 'legal.jsl-license',
        icon: 'scroll',
        title: 'JSL License',
        action: { type: 'content', contentId: 'jsl-license' },
      },
      {
        id: 'legal.terms',
        icon: 'scale',
        title: 'Terms of Use',
        action: { type: 'content', contentId: 'terms-of-use' },
      },
      {
        id: 'legal.copyright',
        icon: 'copyright',
        title: 'Copyright Notice',
        action: { type: 'content', contentId: 'copyright-notice' },
      },
    ],
  },

  {
    id: 'developer',
    icon: 'code',
    title: 'Developer',
    items: [
      {
        id: 'developer.github',
        icon: 'code',
        title: 'GitHub Repository',
        action: { type: 'link', href: GITHUB_REPO, external: true },
      },
      {
        id: 'developer.website',
        icon: 'globe',
        title: 'Official Website',
        action: { type: 'link', href: OFFICIAL_SITE, external: true },
      },
    ],
  },
];
