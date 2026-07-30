import type { PluginId, IPlugin, PluginRegistration } from './plugin/types';

export class PluginRegistry {
  private plugins = new Map<PluginId, PluginRegistration>();
  private executionOrder: PluginId[] = [];
  private dirty = true;

  register(plugin: IPlugin, config?: Record<string, unknown>): void {
    this.plugins.set(plugin.manifest.id, { plugin, enabled: true, config });
    this.dirty = true;
  }

  unregister(id: PluginId): void {
    this.plugins.delete(id);
    this.dirty = true;
  }

  setEnabled(id: PluginId, enabled: boolean): void {
    const reg = this.plugins.get(id);
    if (reg) { reg.enabled = enabled; this.dirty = true; }
  }

  get(id: PluginId): IPlugin | undefined {
    return this.plugins.get(id)?.plugin;
  }

  resolveOrder(): PluginId[] {
    if (!this.dirty) return this.executionOrder;

    const enabled = Array.from(this.plugins.values()).filter(r => r.enabled);
    const adjacency = new Map<PluginId, PluginId[]>();
    const inDegree = new Map<PluginId, number>();

    for (const { plugin } of enabled) {
      const id = plugin.manifest.id;
      adjacency.set(id, []);
      inDegree.set(id, 0);
    }

    for (const { plugin } of enabled) {
      const deps = plugin.manifest.dependsOn ?? [];
      for (const dep of deps) {
        if (inDegree.has(dep)) {
          adjacency.get(dep)!.push(plugin.manifest.id);
          inDegree.set(plugin.manifest.id, (inDegree.get(plugin.manifest.id) ?? 0) + 1);
        }
      }
    }

    const queue: PluginId[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    const order: PluginId[] = [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      order.push(id);
      for (const neighbor of adjacency.get(id) ?? []) {
        const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) queue.push(neighbor);
      }
    }

    this.executionOrder = order;
    this.dirty = false;
    return order;
  }

  getActivePipeline(): IPlugin[] {
    const order = this.resolveOrder();
    return order.map(id => this.plugins.get(id)!.plugin).filter(Boolean);
  }

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const allIds = new Set(this.plugins.keys());

    for (const { plugin } of this.plugins.values()) {
      for (const dep of plugin.manifest.dependsOn ?? []) {
        if (!allIds.has(dep)) {
          errors.push(`Plugin "${plugin.manifest.id}" depends on missing "${dep}"`);
        }
      }
    }

    const order = this.resolveOrder();
    if (order.length < this.plugins.size) {
      const ordered = new Set(order);
      for (const id of allIds) {
        if (!ordered.has(id) && this.plugins.get(id)?.enabled) {
          errors.push(`Plugin "${id}" has circular dependency or missing deps`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
