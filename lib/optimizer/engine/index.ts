import { IProcessingEngine } from './IProcessingEngine';
import { ProcessingEngineV1 } from './v1/ProcessingEngineV1';
import { ProcessingEngineV2 } from './v2/ProcessingEngineV2';
import { EngineCapabilities, EngineVersion } from './types';
import { MainThreadImageProcessor } from '../processor/MainThreadImageProcessor';
import { WorkerPoolImageProcessor } from '../processor/WorkerPoolImageProcessor';

export * from './types';
export * from './IProcessingEngine';
export * from './v1/ProcessingEngineV1';

class ProcessingEngineRegistry {
  private engines: Map<string, IProcessingEngine> = new Map();
  private defaultEngineVersion: EngineVersion = 'v1';

  private ensureEngines(): void {
    if (this.engines.size > 0) return;
    const mainThreadProc = new MainThreadImageProcessor();
    this.engines.set('v1', new ProcessingEngineV1(mainThreadProc));
    this.engines.set('pw-pixel-v1', new ProcessingEngineV1(new WorkerPoolImageProcessor()));
    this.engines.set('v2', new ProcessingEngineV2());
    this.engines.set('pw-pixel-v2', this.engines.get('v2')!);
  }

  public register(engine: IProcessingEngine): void {
    this.engines.set(engine.version.toLowerCase(), engine);
    this.engines.set(engine.id.toLowerCase(), engine);
  }

  public setDefaultVersion(version: EngineVersion): void {
    this.ensureEngines();
    if (this.engines.has(version.toLowerCase())) {
      this.defaultEngineVersion = version;
    }
  }

  public getEngine(versionOrId?: EngineVersion): IProcessingEngine {
    this.ensureEngines();
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

  public listEngines(): Array<{
    id: string;
    version: EngineVersion;
    name: string;
    description: string;
    capabilities: EngineCapabilities;
  }> {
    this.ensureEngines();
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

export function getProcessingEngine(versionOrId?: EngineVersion): IProcessingEngine {
  return processingEngineRegistry.getEngine(versionOrId);
}
