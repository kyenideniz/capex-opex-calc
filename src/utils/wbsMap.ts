import wbsMappingData from '../data/wbsToProjectName.json';

const normMap: Record<string, string> = {};
for (const [k, v] of Object.entries(wbsMappingData as Record<string, string>)) {
  normMap[k.toUpperCase()] = v;
}

/**
 * Update WBS name mapping dynamically at runtime
 */
export function updateWbsMapping(newMap: Record<string, string>) {
  for (const [k, v] of Object.entries(newMap)) {
    normMap[k.toUpperCase()] = v;
  }
}

/**
 * Return current mapping snapshot
 */
export function getWbsMapping(): Record<string, string> {
  return { ...normMap };
}

/**
 * Resolves WBS Element code to its exact Portfolio Project Name
 * imported from export-809912-2109-20261101-191220.xlsx / Planisware export
 */
export function resolveProjectName(wbs: string, fallbackName?: string): string {
  if (!wbs) return fallbackName || '';
  const clean = wbs.trim().toUpperCase();

  // 1. Exact match
  if (normMap[clean]) {
    return normMap[clean];
  }

  // 2. Try parent base code (e.g. O7941/2509/1 -> O7941/2509)
  const parts = clean.split('/');
  if (parts.length > 2) {
    const parent = `${parts[0]}/${parts[1]}`;
    if (normMap[parent]) {
      return normMap[parent];
    }
  }

  // 3. Try alternate OPEX / CAPEX prefix (C vs O)
  if (clean.startsWith('C')) {
    const alt = 'O' + clean.substring(1);
    if (normMap[alt]) return normMap[alt];
  } else if (clean.startsWith('O')) {
    const alt = 'C' + clean.substring(1);
    if (normMap[alt]) return normMap[alt];
  }

  // 4. Try matching by sub-project code (e.g. 2595, 2689)
  if (parts.length >= 2 && parts[1]) {
    const numPart = parts[1];
    if (normMap[numPart]) return normMap[numPart];
  }

  return fallbackName || `Project ${wbs}`;
}

