import { IProcessingEngine } from './IProcessingEngine';
import { ProcessingEngineV1 } from './v1/ProcessingEngineV1';
import { EngineCapabilities, EngineVersion } from './types';

export * from './types';
export * from './IProcessingEngine';
export * from './v1/ProcessingEngineV1';

class ProcessingEngineRegistry {
  private engines: Map<string, IProcessingEngine> = new Map();
  private defaultEngineVersion: EngineVersion = 'v1';

  constructor() {
    // Automatically register default v1 engine
    this.register(new ProcessingEngineV1());
  }

  /**
   * Register a new or custom processing engine implementation
   */
  public register(engine: IProcessingEngine): void {
    // Register by version and by id
    this.engines.set(engine.version.toLowerCase(), engine);
    this.engines.set(engine.id.toLowerCase(), engine);
  }

  /**
   * Set default active engine version
   */
  public setDefaultVersion(version: EngineVersion): void {
    if (this.engines.has(version.toLowerCase())) {
      this.defaultEngineVersion = version;
    }
  }

  /**
   * Retrieve processing engine instance by version or ID.
   * If version is omitted or not found, returns default engine (v1).
   */
  public getEngine(versionOrId?: EngineVersion): IProcessingEngine {
    if (versionOrId) {
      const key = versionOrId.toLowerCase();
      if (this.engines.has(key)) {
        return this.engines.get(key)!;
      }
    }

    const defaultKey = this.defaultEngineVersion.toLowerCase();
    const defaultEngine = this.engines.get(defaultKey);
    if (!defaultEngine) {
      throw new Error(`No processing engine registered for default version '${this.defaultEngineVersion}'`);
    }

    return defaultEngine;
  }

  /**
   * List all registered processing engine versions and metadata
   */
  public listEngines(): Array<{
    id: string;
    version: EngineVersion;
    name: string;
    description: string;
    capabilities: EngineCapabilities;
  }> {
    const unique = new Map<string, IProcessingEngine>();
    this.engines.forEach((engine) => unique.set(engine.id, engine));

    return Array.from(unique.values()).map((eng) => ({
      id: eng.id,
      version: eng.version,
      name: eng.name,
      description: eng.description,
      capabilities: eng.capabilities,
    }));
  }
}

export const processingEngineRegistry = new ProcessingEngineRegistry();

/**
 * Convenient helper function to get a processing engine instance.
 * Usage:
 * const engine = getProcessingEngine('v1');
 * const engineV2 = getProcessingEngine('v2');
 */
export function getProcessingEngine(versionOrId?: EngineVersion): IProcessingEngine {
  return processingEngineRegistry.getEngine(versionOrId);
}
