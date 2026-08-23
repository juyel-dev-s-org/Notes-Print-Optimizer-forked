import { PersistentShell } from '@/components/shell/PersistentShell';

/**
 * Route group layout — mounts the persistent client shell exactly once.
 * Every page inside the group (landing + all tool routes) renders inside
 * this shell, so session state survives soft navigation while each route
 * still ships its own prerendered HTML.
 */
export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return <PersistentShell>{children}</PersistentShell>;
}
