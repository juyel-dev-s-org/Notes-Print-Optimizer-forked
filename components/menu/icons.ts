/**
 * Maps declarative icon keys (used in `menu.config.ts`) to lucide components.
 * Keeping the mapping here means the config stays pure, serializable data.
 */

import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Code2,
  Combine,
  Copyright,
  FileText,
  Globe,
  Heart,
  HelpCircle,
  Info,
  Lock,
  Mail,
  Megaphone,
  MonitorSmartphone,
  Scale,
  ScrollText,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  Wrench,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  merge: Combine,
  monitor: MonitorSmartphone,
  trash: Trash2,
  send: Send,
  users: Users,
  megaphone: Megaphone,
  heart: Heart,
  info: Info,
  book: BookOpen,
  help: HelpCircle,
  sparkles: Sparkles,
  file: FileText,
  mail: Mail,
  lock: Lock,
  scroll: ScrollText,
  scale: Scale,
  copyright: Copyright,
  code: Code2,
  globe: Globe,
  wrench: Wrench,
  shield: ShieldCheck,
};

/** Resolve an icon by key; falls back to Info for unknown keys. */
export function getMenuIcon(name: string): LucideIcon {
  return ICONS[name] ?? Info;
}
