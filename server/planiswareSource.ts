import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { PlaniswareProjectEntry, PlaniswareSourceStatus, Project } from '../src/types.js';
import { updateWbsMapping } from '../src/utils/wbsMap.js';

export const TARGET_PLANISWARE_FILE = 'export-809912-2109-20261101-191220.xlsx';

let lastLoadedTimestamp: string | null = null;
let currentSourceFileName: string = 'wbsToProjectName.json (baseline)';
let cachedProjectEntries: PlaniswareProjectEntry[] = [];
export let globalOrderedKeys: string[] = [];
export const globalRowOrderMap = new Map<string, number>();
export const globalWbsPairMap = new Map<string, string[]>();

/**
 * Returns all linked Capex and Opex WBS codes for a given project code
 */
export function getLinkedWbsCodes(wbs: string): string[] {
  if (!wbs) return [];
  const clean = wbs.toUpperCase().trim();
  const linked = globalWbsPairMap.get(clean);
  if (linked && linked.length > 0) {
    return linked;
  }
  const parts = clean.split('/');
  if (parts.length > 2) {
    const parent = `${parts[0]}/${parts[1]}`;
    const pLinked = globalWbsPairMap.get(parent);
    if (pLinked && pLinked.length > 0) {
      return Array.from(new Set([clean, parent, ...pLinked]));
    }
  }
  return [clean];
}

/**
 * Locate the Planisware project source file
 * Prioritizes export-809912-2109-20261101-191220.xlsx in root or /data
 */
export function findPlaniswareSourceFile(): { filePath: string | null; filename: string; isTargetFile: boolean } {
  const rootTarget = path.join(process.cwd(), TARGET_PLANISWARE_FILE);
  if (fs.existsSync(rootTarget)) {
    return { filePath: rootTarget, filename: TARGET_PLANISWARE_FILE, isTargetFile: true };
  }

  const dataTarget = path.join(process.cwd(), 'data', TARGET_PLANISWARE_FILE);
  if (fs.existsSync(dataTarget)) {
    return { filePath: dataTarget, filename: TARGET_PLANISWARE_FILE, isTargetFile: true };
  }

  // Look for any export-*.xlsx file in root
  try {
    const rootFiles = fs.readdirSync(process.cwd());
    const exportXlsx = rootFiles.find((f) => f.startsWith('export-') && f.endsWith('.xlsx'));
    if (exportXlsx) {
      return { filePath: path.join(process.cwd(), exportXlsx), filename: exportXlsx, isTargetFile: exportXlsx === TARGET_PLANISWARE_FILE };
    }
  } catch {}

  // Fallbacks: capex-export-CJI3.xlsx (with 'codes match' sheet) or PLW_Portfolio_Export.csv
  const capexExport = path.join(process.cwd(), 'capex-export-CJI3.xlsx');
  if (fs.existsSync(capexExport)) {
    return { filePath: capexExport, filename: 'capex-export-CJI3.xlsx (sheet: codes match)', isTargetFile: false };
  }

  const plwCsv = path.join(process.cwd(), 'PLW_Portfolio_Export.csv');
  if (fs.existsSync(plwCsv)) {
    return { filePath: plwCsv, filename: 'PLW_Portfolio_Export.csv', isTargetFile: false };
  }

  return { filePath: null, filename: TARGET_PLANISWARE_FILE, isTargetFile: false };
}

/**
 * Parses Planisware Excel export or CSV file to extract project names and codes
 */
export function parsePlaniswareExport(fileInput: Buffer | string, sourceName: string): {
  mapping: Record<string, string>;
  projects: PlaniswareProjectEntry[];
  totalParsed: number;
  orderedProjectKeys?: string[];
} {
  let workbook: XLSX.WorkBook;
  if (typeof fileInput === 'string') {
    const fileBuf = fs.readFileSync(fileInput);
    workbook = XLSX.read(fileBuf, { type: 'buffer' });
  } else {
    workbook = XLSX.read(fileInput, { type: 'buffer' });
  }

  const mapping: Record<string, string> = {};
  const projectsMap = new Map<string, PlaniswareProjectEntry>();
  const orderedProjectKeys: string[] = [];

  // Determine best sheet to parse
  let sheetToParse = workbook.SheetNames[0];
  if (workbook.SheetNames.includes('Kerem view')) {
    sheetToParse = 'Kerem view';
  } else if (workbook.SheetNames.includes('codes match')) {
    sheetToParse = 'codes match';
  } else if (workbook.SheetNames.some((s) => /portfolio|projects|export/i.test(s))) {
    sheetToParse = workbook.SheetNames.find((s) => /portfolio|projects|export/i.test(s))!;
  }

  const worksheet = workbook.Sheets[sheetToParse];
  if (!worksheet) {
    return { mapping, projects: [], totalParsed: 0, orderedProjectKeys: [] };
  }


  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  if (rawRows.length === 0) {
    return { mapping, projects: [], totalParsed: 0 };
  }

  // Detect header row index
  let headerRowIdx = -1;
  let nameColIdx = -1;
  let capexColIdx = -1;
  let opexColIdx = -1;
  let pmColIdx = -1;
  let budgetColIdx = -1;

  for (let r = 0; r < Math.min(10, rawRows.length); r++) {
    const row = rawRows[r].map((cell: any) => String(cell || '').trim());
    const rowStr = row.join(' ').toLowerCase();

    const hasProject = row.some((c: string) => /project\s*(id|name|title)?/i.test(c));
    const hasCapex = row.some((c: string) => /capex/i.test(c));
    const hasOpex = row.some((c: string) => /opex/i.test(c));

    if ((hasProject && (hasCapex || hasOpex)) || (hasCapex && hasOpex)) {
      headerRowIdx = r;
      row.forEach((col: string, idx: number) => {
        const lower = col.toLowerCase();
        if (/project\s*capex|capex\s*(id|code|wbs)/i.test(lower) || (lower === 'capex' && capexColIdx === -1)) {
          capexColIdx = idx;
        } else if (/project\s*opex|opex\s*(id|code|wbs)/i.test(lower) || (lower === 'opex' && opexColIdx === -1)) {
          opexColIdx = idx;
        } else if (/project\s*(id|name|title)/i.test(lower) || (lower === 'project' && nameColIdx === -1)) {
          nameColIdx = idx;
        } else if (/pm|manager|owner|lead/i.test(lower) && pmColIdx === -1) {
          pmColIdx = idx;
        } else if (/budget/i.test(lower) && budgetColIdx === -1) {
          budgetColIdx = idx;
        }
      });
      break;
    }
  }

  // Fallback column positions if explicit header not found
  if (headerRowIdx === -1) {
    headerRowIdx = 0;
    nameColIdx = 0;
    capexColIdx = 1;
    opexColIdx = 2;
  } else {
    if (nameColIdx === -1) nameColIdx = 0;
    if (capexColIdx === -1) capexColIdx = 1;
    if (opexColIdx === -1) opexColIdx = 2;
  }

  // Iterate over data rows
  for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    const rawName = String(row[nameColIdx] || '').trim();
    const rawCapex = String(row[capexColIdx] || '').trim();
    const rawOpex = String(row[opexColIdx] || '').trim();
    const rawPm = pmColIdx >= 0 ? String(row[pmColIdx] || '').trim() : '';
    const rawBudget = budgetColIdx >= 0 ? parseFloat(String(row[budgetColIdx] || '0').replace(/[^0-9.-]/g, '')) || undefined : undefined;

    // Filter invalid / placeholder rows
    if (!rawName && !rawCapex && !rawOpex) continue;
    if (/not needed|n\/a|none/i.test(rawCapex) && /not needed|n\/a|none/i.test(rawOpex)) continue;

    const projectName = rawName || `Project ${rawCapex || rawOpex}`;

    // Clean codes
    const cleanCapex = (!/not needed|n\/a/i.test(rawCapex) && rawCapex.length >= 3) ? rawCapex.toUpperCase() : undefined;
    const cleanOpex = (!/not needed|n\/a/i.test(rawOpex) && rawOpex.length >= 3) ? rawOpex.toUpperCase() : undefined;

    if (cleanCapex) {
      mapping[cleanCapex] = projectName;
      // Handle sub-codes (e.g. O7941/2509/1 -> O7941/2509)
      const parts = cleanCapex.split('/');
      if (parts.length > 2) {
        const parent = `${parts[0]}/${parts[1]}`;
        if (!mapping[parent]) mapping[parent] = projectName;
      }
      if (parts.length >= 2 && parts[1]) {
        // Map pure number (e.g. 2513, 2595)
        if (!mapping[parts[1]]) mapping[parts[1]] = projectName;
      }
    }

    if (cleanOpex) {
      mapping[cleanOpex] = projectName;
      const parts = cleanOpex.split('/');
      if (parts.length > 2) {
        const parent = `${parts[0]}/${parts[1]}`;
        if (!mapping[parent]) mapping[parent] = projectName;
      }
      if (parts.length >= 2 && parts[1]) {
        if (!mapping[parts[1]]) mapping[parts[1]] = projectName;
      }
    }

    // Extract any number embedded in name (e.g. "2595 Polaris" or "2689 TACOS")
    const numMatch = projectName.match(/\b(2[0-9]{3}|8[0-9]{3})\b/);
    if (numMatch) {
      const pNum = numMatch[1];
      if (!mapping[pNum]) mapping[pNum] = projectName;
      // Also map standard O7941/2595 and C7941/2595
      if (!mapping[`O7941/${pNum}`]) mapping[`O7941/${pNum}`] = projectName;
      if (!mapping[`C7941/${pNum}`]) mapping[`C7941/${pNum}`] = projectName;
    }

    const rowIdentifiers: string[] = [];
    if (cleanCapex) rowIdentifiers.push(cleanCapex);
    if (cleanOpex) rowIdentifiers.push(cleanOpex);
    if (numMatch) {
      const pNum = numMatch[1];
      rowIdentifiers.push(pNum, `C7941/${pNum}`, `O7941/${pNum}`);
    }

    const rowIdx = projectsMap.size;
    rowIdentifiers.forEach((idKey) => {
      if (idKey) {
        if (!orderedProjectKeys.includes(idKey)) {
          orderedProjectKeys.push(idKey);
        }
        if (!globalRowOrderMap.has(idKey)) {
          globalRowOrderMap.set(idKey, rowIdx);
        }
      }
    });

    // Populate bidirectional WBS linking for Capex & Opex
    const pairedCodes: string[] = [];
    if (cleanCapex) {
      pairedCodes.push(cleanCapex);
      const parts = cleanCapex.split('/');
      if (parts.length > 2) pairedCodes.push(`${parts[0]}/${parts[1]}`);
    }
    if (cleanOpex) {
      pairedCodes.push(cleanOpex);
      const parts = cleanOpex.split('/');
      if (parts.length > 2) pairedCodes.push(`${parts[0]}/${parts[1]}`);
    }
    if (numMatch) {
      const pNum = numMatch[1];
      pairedCodes.push(`O7941/${pNum}`, `C7941/${pNum}`);
    }
    const uniquePairs = Array.from(new Set(pairedCodes));
    uniquePairs.forEach((c) => {
      const existing = globalWbsPairMap.get(c) || [];
      globalWbsPairMap.set(c, Array.from(new Set([...existing, ...uniquePairs])));
    });

    const key = cleanCapex || cleanOpex || projectName;
    if (!projectsMap.has(key)) {
      projectsMap.set(key, {
        projectId: projectName.split(' - ')[0] || key,
        name: projectName,
        capexId: cleanCapex,
        opexId: cleanOpex,
        pm: rawPm || undefined,
        budgetEUR: rawBudget,
      });
    }
  }

  globalOrderedKeys = orderedProjectKeys;

  return {
    mapping,
    projects: Array.from(projectsMap.values()),
    totalParsed: Object.keys(mapping).length,
    orderedProjectKeys,
  };
}

try {
  const targetPath = path.join(process.cwd(), TARGET_PLANISWARE_FILE);
  if (fs.existsSync(targetPath)) {
    console.log('[planiswareSource] Auto-parsing on startup from:', targetPath);
    parsePlaniswareExport(targetPath, TARGET_PLANISWARE_FILE);
    console.log('[planiswareSource] Auto-parsed successfully! RowOrderMap size:', globalRowOrderMap.size);
  } else {
    console.warn('[planiswareSource] Target file not found at:', targetPath);
  }
} catch (e) {
  console.error('[planiswareSource] Auto-parse error on load:', e);
}

export function getCarouselOrderIndex(wbs: string): number {
  if (!wbs) return 999999;
  const clean = wbs.toUpperCase().trim();
  if (globalRowOrderMap.has(clean)) return globalRowOrderMap.get(clean)!;

  const parts = clean.split('/');
  if (parts.length >= 2) {
    const parent = `${parts[0]}/${parts[1]}`;
    if (globalRowOrderMap.has(parent)) return globalRowOrderMap.get(parent)!;
    if (globalRowOrderMap.has(parts[1])) return globalRowOrderMap.get(parts[1])!;
  }

  const numMatch = clean.match(/\b(2[0-9]{3}|8[0-9]{3})\b/);
  if (numMatch && globalRowOrderMap.has(numMatch[1])) {
    return globalRowOrderMap.get(numMatch[1])!;
  }

  return 999999;
}


/**
 * Apply the parsed Planisware project mapping to:
 * 1) src/data/wbsToProjectName.json
 * 2) in-memory runtime map
 * 3) db.projects in store
 */
export function applyPlaniswareMapping(
  mapping: Record<string, string>,
  projectEntries: PlaniswareProjectEntry[],
  sourceFileName: string,
  dbProjects: Project[],
  saveCallback: () => void
): { updatedProjectsCount: number; totalMapped: number } {
  // 1. Write to src/data/wbsToProjectName.json
  const jsonPath = path.join(process.cwd(), 'src', 'data', 'wbsToProjectName.json');
  try {
    // Read existing to preserve any manual overrides
    let existingMap: Record<string, string> = {};
    if (fs.existsSync(jsonPath)) {
      try {
        existingMap = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      } catch {}
    }
    const mergedMap = { ...existingMap, ...mapping };
    fs.writeFileSync(jsonPath, JSON.stringify(mergedMap, null, 2), 'utf8');
  } catch (err) {
    console.warn('Failed writing to wbsToProjectName.json:', err);
  }

  // 2. Update runtime memory map
  updateWbsMapping(mapping);

  // 3. Update existing projects in database
  let updatedProjectsCount = 0;
  dbProjects.forEach((proj) => {
    const cleanWbs = proj.wbs.toUpperCase();
    if (mapping[cleanWbs]) {
      if (proj.name !== mapping[cleanWbs]) {
        proj.name = mapping[cleanWbs];
        updatedProjectsCount++;
      }
    } else {
      // Try parent or alternative
      const parts = cleanWbs.split('/');
      if (parts.length >= 2) {
        const parent = `${parts[0]}/${parts[1]}`;
        if (mapping[parent] && proj.name !== mapping[parent]) {
          proj.name = mapping[parent];
          updatedProjectsCount++;
        } else if (mapping[parts[1]] && proj.name !== mapping[parts[1]]) {
          proj.name = mapping[parts[1]];
          updatedProjectsCount++;
        }
      }
    }
  });

  // Also add any projects from the export that have CAPEX WBS codes
  const existingWbs = new Set(dbProjects.map((p) => p.wbs.toUpperCase()));
  projectEntries.forEach((entry) => {
    if (entry.capexId && !existingWbs.has(entry.capexId.toUpperCase())) {
      existingWbs.add(entry.capexId.toUpperCase());
      dbProjects.push({
        wbs: entry.capexId,
        name: entry.name,
        projectType: 'CAPEX',
        assignedPmId: 'usr-pm-sarah',
        assignedPmName: entry.pm || 'Sarah Jenkins (PM)',
        budgetEUR: entry.budgetEUR || 250000,
        opexMapping: entry.opexId,
      });
      updatedProjectsCount++;
    }
  });

  lastLoadedTimestamp = new Date().toISOString();
  currentSourceFileName = sourceFileName;
  cachedProjectEntries = projectEntries;

  saveCallback();
  return { updatedProjectsCount, totalMapped: Object.keys(mapping).length };
}

/**
 * Returns current status of Planisware source file and mappings
 */
export function getPlaniswareStatus(): PlaniswareSourceStatus {
  const sourceInfo = findPlaniswareSourceFile();
  const rootTarget = path.join(process.cwd(), TARGET_PLANISWARE_FILE);
  const dataTarget = path.join(process.cwd(), 'data', TARGET_PLANISWARE_FILE);
  const fileExists = fs.existsSync(rootTarget) || fs.existsSync(dataTarget);

  let totalMapped = 0;
  try {
    const jsonPath = path.join(process.cwd(), 'src', 'data', 'wbsToProjectName.json');
    if (fs.existsSync(jsonPath)) {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      totalMapped = Object.keys(data).length;
    }
  } catch {}

  // Ensure project entries are populated for UI preview
  if (cachedProjectEntries.length === 0) {
    if (sourceInfo.filePath && fs.existsSync(sourceInfo.filePath)) {
      try {
        const parsed = parsePlaniswareExport(sourceInfo.filePath, sourceInfo.filename);
        cachedProjectEntries = parsed.projects;
        currentSourceFileName = sourceInfo.filename;
        lastLoadedTimestamp = new Date().toISOString();
      } catch {}
    }
    if (cachedProjectEntries.length === 0) {
      try {
        const jsonPath = path.join(process.cwd(), 'src', 'data', 'wbsToProjectName.json');
        if (fs.existsSync(jsonPath)) {
          const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          const seen = new Set<string>();
          const list: PlaniswareProjectEntry[] = [];
          for (const [code, name] of Object.entries(data as Record<string, string>)) {
            if (!seen.has(name)) {
              seen.add(name);
              const isCapex = code.startsWith('O') || code.startsWith('N');
              list.push({
                projectId: name.split(' - ')[0] || code,
                name,
                capexId: isCapex ? code : undefined,
                opexId: !isCapex ? code : undefined,
              });
            }
          }
          cachedProjectEntries = list;
        }
      } catch {}
    }
  }

  return {
    activeSourceFile: currentSourceFileName,
    expectedFilename: TARGET_PLANISWARE_FILE,
    fileExists,
    totalMappedCodes: totalMapped,
    totalProjects: cachedProjectEntries.length,
    lastLoadedAt: lastLoadedTimestamp,
    projects: cachedProjectEntries.slice(0, 500),
  };
}

