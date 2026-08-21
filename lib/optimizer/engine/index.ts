import { ProcessingEngineV2 } from './v2/ProcessingEngineV2';
import type { IProcessingEngine } from './IProcessingEngine';
import type { EngineVersion } from './types';

export * from './types';
export * from './IProcessingEngine';

/** The one production engine. Kept behind a lazy singleton so importers
 *  never pay construction cost until a document is actually processed. */
let engineInstance: IProcessingEngine | null = null;

export const ENGINE_VERSION: EngineVersion = 'v2';

export function getProcessingEngine(): IProcessingEngine {
  if (!engineInstance) engineInstance = new ProcessingEngineV2();
  return engineInstance;
}
