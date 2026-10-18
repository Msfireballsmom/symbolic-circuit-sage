// ============ PROBLEM TEXT PARSER ============
// Extracts circuit components, analysis type, and parameters from plain text
// Zero AI — pure regex + pattern matching for deterministic extraction
import { parseQuantity } from './quantity';

export interface ParsedComponent {
  type: 'resistor' | 'voltage_source' | 'current_source' | 'capacitor' | 'inductor' | 'opamp' | 'diode' | 'bjt' | 'mosfet' | 'dependent_voltage_source' | 'dependent_current_source' | 'transformer' | 'switch';
  label: string;
  value: number;       // in base units (Ω, V, A, F, H)
  nodeA?: number;
  nodeB?: number;
  meshes?: number[];
  config?: string;
  gain?: number;
  dependentOn?: string;
}

export type AnalysisMethod =
  | 'ohms_law' | 'voltage_divider' | 'current_divider'
  | 'series_parallel' | 'thevenin' | 'power'
  | 'dc_nodal' | 'mesh' | 'transient' | 'rlc'
  | 'ac_phasor' | 'superposition' | 'unknown'
  | 'opamp' | 'diode_analysis' | 'dependent_source'
  | 'bjt_analysis' | 'mosfet_analysis' | 'two_port';

export interface ParsedProblem {
  components: ParsedComponent[];
  method: AnalysisMethod;
  frequency?: number;      // Hz for AC
  phase?: number;          // degrees
  initialVoltage?: number; // v(0) for transient
  initialCurrent?: number; // i(0) for transient
  sourceVoltage?: number;
  sourceCurrent?: number;
  topology?: 'series' | 'parallel';
  findWhat: string[];      // what the problem asks for
  rawText: string;
  confidence: number;      // 0-1 how confident the parse is
  warnings: string[];
  outputNode?: number;
  blockingReasons?: string[];
}

// SI prefixes are case-sensitive: M is mega, m is milli.
function parseValueWithUnit(valStr: string, unitStr: string): number {
  const n = Number(valStr), prefix = unitStr.trim()[0] ?? '';
  const factors: Record<string, number> = { G: 1e9, M: 1e6, k: 1e3, K: 1e3, m: 1e-3, u: 1e-6, μ: 1e-6, µ: 1e-6, n: 1e-9, p: 1e-12 };
  return n * (factors[prefix] ?? 1);
}

// Extract all resistors, sources, caps, inductors from text
function extractComponents(text: string): ParsedComponent[] {
  const components: ParsedComponent[] = [];
  const lowerText = text.toLowerCase();

  // Pattern: R1 = 4kΩ, R₁ = 4 kΩ, R1=4kohm, R = 100Ω, etc.
  const rPatterns = [
    /r[₁₂₃₄₅₆₇₈₉]?\s*[=:]\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*([kKmMgGμuUnNpP]?)\s*(?:Ω|ohm|ω)/gi,
    /r(\d+)\s*[=:]\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*([kKmMgGμuUnNpP]?)\s*(?:Ω|ohm|ω)?/gi,
    /([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*([kKmMgGμuUnNpP]?)\s*(?:Ω|ohm|ω)\s*resistor/gi,
    /resistor[^=]*?[=:of]*\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*([kKmMgGμuUnNpP]?)\s*(?:Ω|ohm|ω)?/gi,
  ];

  // Subscript digit mapping
  const subDigit: Record<string, string> = { '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', '₀': '0' };

  // Normalize subscripts
  let normText = text;
  Object.entries(subDigit).forEach(([sub, dig]) => {
    normText = normText.replace(new RegExp(sub, 'g'), dig);
  });

  // Extract R values: "R1 = 4kΩ" style
  const rAssign = /[Rr](\d*)\s*[=:]\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*([kKmMμuUnNpP]?)\s*(?:Ω|ohm|ohms|ω)?/g;
  let match: RegExpExecArray | null;
  const foundLabels = new Set<string>();

  while ((match = rAssign.exec(normText)) !== null) {
    const idx = match[1] || String(components.filter(c => c.type === 'resistor').length + 1);
    const label = `R${idx}`;
    if (foundLabels.has(label)) continue;
    foundLabels.add(label);
    const value = parseValueWithUnit(match[2], match[3] || '');
    if (value >= 0) components.push({ type: 'resistor', label, value });
  }

  // Extract standalone "4.7kΩ" or "100 ohm" values if no R= found
  if (components.filter(c => c.type === 'resistor').length === 0) {
    const standalone = /([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*([kKmMμuUnNpP]?)\s*(?:Ω|ohm|ohms|ω)/g;
    while ((match = standalone.exec(normText)) !== null) {
      const rIdx = components.filter(c => c.type === 'resistor').length + 1;
      const value = parseValueWithUnit(match[1], match[2] || '');
      if (value >= 0) components.push({ type: 'resistor', label: `R${rIdx}`, value });
    }
  }

  // Voltage sources: "Vs = 12V", "V1 = 24V", "12V source", "voltage source of 12V"
  const explicitSources = /\b([VI](?:s|\d+)?)\s*[=:]\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*([kMmμuµn]?)\s*([VA])\b/gi;
  while ((match = explicitSources.exec(normText)) !== null) {
    const label = match[1], isVoltage = label[0].toUpperCase() === 'V';
    if (match[4].toUpperCase() !== (isVoltage ? 'V' : 'A') || foundLabels.has(label)) continue;
    foundLabels.add(label);
    components.push({ type: isVoltage ? 'voltage_source' : 'current_source', label, value: parseValueWithUnit(match[2], match[3]) });
  }
  const vPatterns = [
    /[Vv][sS₁₂₃]?\s*[=:]\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*([kKmM]?)\s*[Vv]/g,
    /([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*([kKmM]?)\s*[Vv]\s*(?:source|supply|battery)/gi,
    /(?:voltage\s*source|supply|battery)\s*(?:of|[=:])?\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*([kKmM]?)\s*[Vv]\b/gi,
  ];

  for (const pat of vPatterns) {
    if (components.some(c => c.type === 'voltage_source')) break;
    while ((match = pat.exec(normText)) !== null) {
      const vIdx = components.filter(c => c.type === 'voltage_source').length + 1;
      const label = `Vs${vIdx > 1 ? vIdx : ''}`;
      if (foundLabels.has(label)) continue;
      foundLabels.add(label);
      const value = parseValueWithUnit(match[1], match[2] || '');
      if (Number.isFinite(value)) components.push({ type: 'voltage_source', label, value, nodeA: 1, nodeB: 0 });
    }
    if (components.some(c => c.type === 'voltage_source')) break;
  }

  // Current sources: "Is = 2mA", "5A current source"
  const iPatterns = [
    /[Ii][sS]?\s*[=:]\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*([kKmMμuUnNpP]?)\s*[Aa]/g,
    /([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*([kKmMμuUnNpP]?)\s*[Aa]\s*(?:current\s*source)/gi,
  ];

  for (const pat of iPatterns) {
    if (components.some(c => c.type === 'current_source')) break;
    while ((match = pat.exec(normText)) !== null) {
      const iIdx = components.filter(c => c.type === 'current_source').length + 1;
      const label = `Is${iIdx > 1 ? iIdx : ''}`;
      if (foundLabels.has(label)) continue;
      foundLabels.add(label);
      const value = parseValueWithUnit(match[1], match[2] || '');
      if (Number.isFinite(value)) components.push({ type: 'current_source', label, value, nodeA: 1, nodeB: 0 });
    }
    if (components.some(c => c.type === 'current_source')) break;
  }

  // Capacitors: "C = 10μF", "C1 = 100nF"
  const cPattern = /[Cc](\d*)\s*[=:]\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*([kKmMμuUnNpP]?)\s*[Ff]/g;
  while ((match = cPattern.exec(normText)) !== null) {
    const idx = match[1] || String(components.filter(c => c.type === 'capacitor').length + 1);
    const label = `C${idx}`;
    if (foundLabels.has(label)) continue;
    foundLabels.add(label);
    const value = parseValueWithUnit(match[2], match[3] + 'F');
    if (value > 0) components.push({ type: 'capacitor', label, value });
  }

  // Inductors: "L = 100mH", "L1 = 50mH"
  const lPattern = /[Ll](\d*)\s*[=:]\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*([kKmMμuUnNpP]?)\s*[Hh]/g;
  while ((match = lPattern.exec(normText)) !== null) {
    const idx = match[1] || String(components.filter(c => c.type === 'inductor').length + 1);
    const label = `L${idx}`;
    if (foundLabels.has(label)) continue;
    foundLabels.add(label);
    const value = parseValueWithUnit(match[2], match[3] + 'H');
    if (value > 0) components.push({ type: 'inductor', label, value });
  }

  // Extract node assignments from text: "R1 between node 1 and node 2"
  const nodePattern = /([RrVvIiCcLl]\w*)(?:\s*[=:]\s*[^,;\n]*?)?\s*(?:between|from|connects?)\s*(?:node\s*)?(\d+|ground|gnd)\s*(?:and|to)\s*(?:node\s*)?(\d+|ground|gnd)/gi;
  while ((match = nodePattern.exec(normText)) !== null) {
    const label = match[1].toUpperCase();
    const comp = components.find(c => c.label.toUpperCase() === label);
    if (comp) {
      comp.nodeA = /ground|gnd/i.test(match[2]) ? 0 : Number(match[2]);
      comp.nodeB = /ground|gnd/i.test(match[3]) ? 0 : Number(match[3]);
    }
  }

  // Extract mesh assignments: "R1 in mesh 1", "R2 shared between mesh 1 and mesh 2"
  const meshPattern = /([RrVvIi]\w*)\s*(?:in|belongs?\s*to)\s*mesh\s*(\d+)/gi;
  while ((match = meshPattern.exec(normText)) !== null) {
    const label = match[1].toUpperCase();
    const comp = components.find(c => c.label.toUpperCase() === label);
    if (comp) {
      comp.meshes = [parseInt(match[2])];
    }
  }

  const sharedMesh = /([RrVvIi]\w*)\s*shared\s*(?:between)?\s*mesh\s*(\d+)\s*(?:and)\s*mesh\s*(\d+)/gi;
  while ((match = sharedMesh.exec(normText)) !== null) {
    const label = match[1].toUpperCase();
    const comp = components.find(c => c.label.toUpperCase() === label);
    if (comp) {
      comp.meshes = [parseInt(match[2]), parseInt(match[3])];
    }
  }

  return components;
}

function detectMethod(text: string, components: ParsedComponent[]): AnalysisMethod {
  const lower = text.toLowerCase();
  
  const hasR = components.some(c => c.type === 'resistor');
  const hasC = components.some(c => c.type === 'capacitor');
  const hasL = components.some(c => c.type === 'inductor');
  const hasV = components.some(c => c.type === 'voltage_source');
  const hasI = components.some(c => c.type === 'current_source');
  const rCount = components.filter(c => c.type === 'resistor').length;

  // Explicit method mentions — advanced types first
  if (/op[- ]?amp|operational\s*amplif|inverting|non[- ]inverting|summing\s*amp|differential\s*amp|integrator|differentiator|buffer|voltage\s*follower/i.test(lower)) return 'opamp';
  if (/diode|rectif|clipper|clamper|zener/i.test(lower)) return 'diode_analysis';
  if (/dependent\s*source|vcvs|vccs|ccvs|cccs|controlled\s*source/i.test(lower)) return 'dependent_source';
  if (/bjt|transistor.*npn|transistor.*pnp|common\s*emitter|common\s*base|common\s*collector/i.test(lower)) return 'bjt_analysis';
  if (/mosfet|nmos|pmos|common\s*source|common\s*drain|common\s*gate/i.test(lower)) return 'mosfet_analysis';
  if (/two[- ]port|h[- ]param|z[- ]param|y[- ]param|abcd/i.test(lower)) return 'two_port';

  if (/mesh\s*(analysis|current|method)/i.test(lower)) return 'mesh';
  if (/nodal\s*(analysis|voltage|method)/i.test(lower) || /node\s*voltage/i.test(lower)) return 'dc_nodal';
  if (/superposition/i.test(lower)) return 'superposition';
  if (/th[eé]venin|norton/i.test(lower)) return 'thevenin';
  if (/voltage\s*divid/i.test(lower)) return 'voltage_divider';
  if (/current\s*divid/i.test(lower)) return 'current_divider';
  if (/bode|frequency\s*response/i.test(lower)) return 'ac_phasor';
  if (/phasor|ac\s*analysis|impedance/i.test(lower)) return 'ac_phasor';
  if (/laplace|s[- ]domain|transfer\s*function/i.test(lower)) return 'ac_phasor';
  if (/transient|time\s*constant|τ|tau|switch|t\s*[=<>]\s*0/i.test(lower)) {
    return (hasR && hasL && hasC) ? 'rlc' : 'transient';
  }
  if (/rlc|second[- ]order|2nd[- ]order|underdamp|overdamp|critically/i.test(lower)) return 'rlc';
  if (/ohm'?s?\s*law/i.test(lower)) return 'ohms_law';
  if (/power\s*(dissipat|absorb|deliver|balanc)/i.test(lower)) return 'power';
  if (/series.*parallel|parallel.*series|equivalent\s*resist/i.test(lower)) return 'series_parallel';

  // Infer from components
  if (components.some(c => c.type === 'opamp')) return 'opamp';
  if (components.some(c => c.type === 'diode')) return 'diode_analysis';
  if (components.some(c => c.type === 'dependent_voltage_source' || c.type === 'dependent_current_source')) return 'dependent_source';

  if (hasR && hasL && hasC) return 'rlc';
  if ((hasR && hasC) || (hasR && hasL)) {
    if (/frequency|hz|ω|omega|ac|phasor/i.test(lower)) return 'ac_phasor';
    return 'transient';
  }
  if (hasR && rCount === 2 && hasV && !hasI) return 'voltage_divider';
  if (hasR && rCount === 2 && hasI && !hasV) return 'current_divider';
  if (hasR && rCount >= 2) return 'series_parallel';
  if (hasR && (hasV || hasI)) return 'ohms_law';
  if (hasR) return 'ohms_law';

  return 'unknown';
}

function detectTopology(text: string): 'series' | 'parallel' | undefined {
  const lower = text.toLowerCase();
  if (/parallel/i.test(lower)) return 'parallel';
  if (/series/i.test(lower)) return 'series';
  return undefined;
}

function extractFrequency(text: string): number | undefined {
  const match = text.match(/([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*([kKmMgG]?)\s*[Hh]z/);
  if (match) return parseValueWithUnit(match[1], match[2] || '');
  const omegaMatch = text.match(/[ωw]\s*[=:]\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)/i);
  if (omegaMatch) return parseFloat(omegaMatch[1]) / (2 * Math.PI);
  return undefined;
}

function extractInitials(text: string): { voltage?: number; current?: number } {
  const result: { voltage?: number; current?: number } = {};
  for (const [symbol, unit, key] of [['v', 'V', 'voltage'], ['i', 'A', 'current']] as const) {
    const match = text.match(new RegExp(`${symbol}[_cl(]*0[⁺+)]*\\s*[=:]\\s*([+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?\\s*[kMmμuµn]?[VA]?)`, 'i'));
    if (match) {
      try { result[key] = parseQuantity(match[1].trim(), unit); }
      catch { result[key] = NaN; }
    }
  }
  return result;
}

function extractFindWhat(text: string): string[] {
  const finds: string[] = [];
  const lower = text.toLowerCase();
  if (/find.*voltage|voltage.*find|calculate.*voltage|determine.*voltage/i.test(lower)) finds.push('voltage');
  if (/find.*current|current.*find|calculate.*current|determine.*current/i.test(lower)) finds.push('current');
  if (/find.*power|power.*find|calculate.*power|determine.*power/i.test(lower)) finds.push('power');
  if (/find.*resistance|equivalent.*resist|total.*resist/i.test(lower)) finds.push('resistance');
  if (/find.*impedance|total.*impedance/i.test(lower)) finds.push('impedance');
  if (/find.*time\s*const|calculate.*tau/i.test(lower)) finds.push('time_constant');
  if (/thevenin|norton/i.test(lower)) finds.push('equivalent_circuit');
  if (finds.length === 0) finds.push('all'); // solve everything
  return finds;
}

export function parseProblem(text: string): ParsedProblem {
  const warnings: string[] = [];
  const blockingReasons: string[] = [];
  // A malformed assignment must not disappear while the remaining circuit solves.
  for (const match of text.matchAll(/\b([RCLVI](?:s|\d+)?)\s*[=:]\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?\s*(?:(?!between\b|from\b|in\b|shared\b)[a-zA-ZμµΩω]+)?|[^\s,;]+)/gi)) {
    const value = match[2].trim();
    const units: Record<string, string> = { R: 'Ω', C: 'F', L: 'H', V: 'V', I: 'A' };
    try {
      const kind = match[1][0].toUpperCase();
      const magnitude = parseQuantity(value, units[kind]);
      if ((kind === 'R' && magnitude < 0) || (['C', 'L'].includes(kind) && magnitude <= 0)) throw new Error('Invalid passive value');
    }
    catch { blockingReasons.push(`${match[1]} has an invalid or dimensionally inconsistent assignment. Re-enter its value with units.`); }
  }
  const components = extractComponents(text);
  const method = detectMethod(text, components);
  const topology = detectTopology(text);
  const frequency = extractFrequency(text);
  const initials = extractInitials(text);
  const findWhat = extractFindWhat(text);

  // Calculate confidence
  let confidence = 0;
  if (components.length > 0) confidence += 0.4;
  if (method !== 'unknown') confidence += 0.3;
  if (components.length >= 2) confidence += 0.15;
  if (findWhat.length > 0 && findWhat[0] !== 'all') confidence += 0.15;

  // Warnings
  if (components.length === 0) warnings.push('No circuit components detected. Try formats like "R1 = 4kΩ" or "Vs = 12V".');
  if (method === 'unknown' && components.length > 0) warnings.push('Could not determine analysis method. Defaulting based on components.');

  // Extract source values for convenience
  const vSource = components.find(c => c.type === 'voltage_source');
  const iSource = components.find(c => c.type === 'current_source');

  // Draft suggestions are explicit, never overwrite stated connections.
  const unresolved = components.filter(c => c.nodeA === undefined || c.nodeB === undefined);
  if (unresolved.length) {
    warnings.push('Connections were not fully stated. Draft topology suggestions require confirmation; correct every node before solving.');
    const passive = components.filter(c => !['voltage_source', 'current_source'].includes(c.type));
    if (topology === 'parallel' || method === 'current_divider') {
      passive.forEach(c => { c.nodeA ??= 1; c.nodeB ??= 0; });
    } else if (topology === 'series' || ['ohms_law', 'power', 'voltage_divider', 'transient'].includes(method)) {
      passive.forEach((c, i) => { c.nodeA ??= i + 1; c.nodeB ??= i === passive.length - 1 ? 0 : i + 2; });
    }
  }

  return {
    components,
    method,
    frequency,
    phase: 0,
    initialVoltage: initials.voltage,
    initialCurrent: initials.current,
    sourceVoltage: vSource?.value,
    sourceCurrent: iSource?.value,
    topology,
    findWhat,
    rawText: text,
    confidence,
    warnings,
    blockingReasons,
  };
}

// Format a parsed problem into a readable summary
export function formatParsedSummary(parsed: ParsedProblem): string[] {
  const lines: string[] = [];
  lines.push(`═══ PARSED CIRCUIT PROBLEM ═══`);
  lines.push(``);
  
  lines.push(`Analysis method: ${formatMethod(parsed.method)}`);
  if (parsed.topology) lines.push(`Topology: ${parsed.topology}`);
  lines.push(`Confidence: ${(parsed.confidence * 100).toFixed(0)}%`);
  lines.push(``);

  lines.push(`Components found:`);
  parsed.components.forEach(c => {
    const unitMap: Record<string, string> = {
      resistor: 'Ω', voltage_source: 'V', current_source: 'A',
      capacitor: 'F', inductor: 'H', opamp: '', diode: 'V',
      bjt: '', mosfet: '', dependent_voltage_source: 'V/V',
      dependent_current_source: 'A/V', transformer: '', switch: '',
    };
    const formatted = formatEngineering(c.value, unitMap[c.type]);
    lines.push(`  ${c.label} = ${formatted} (${c.type.replace('_', ' ')})`);
  });

  if (parsed.findWhat.length > 0) {
    lines.push(``);
    lines.push(`Solving for: ${parsed.findWhat.join(', ')}`);
  }

  if (parsed.warnings.length > 0) {
    lines.push(``);
    parsed.warnings.forEach(w => lines.push(`⚠ ${w}`));
  }

  return lines;
}

function formatMethod(method: AnalysisMethod): string {
  const map: Record<AnalysisMethod, string> = {
    ohms_law: "Ohm's Law",
    voltage_divider: "Voltage Divider",
    current_divider: "Current Divider",
    series_parallel: "Series/Parallel Combination",
    thevenin: "Thévenin/Norton",
    power: "Power Analysis",
    dc_nodal: "DC Nodal Analysis (KCL)",
    mesh: "Mesh Analysis (KVL)",
    transient: "First-Order Transient",
    rlc: "Second-Order RLC",
    ac_phasor: "AC Phasor Analysis",
    superposition: "Superposition",
    opamp: "Op-Amp Analysis",
    diode_analysis: "Diode Circuit Analysis",
    dependent_source: "Dependent Source (MNA)",
    bjt_analysis: "BJT Analysis",
    mosfet_analysis: "MOSFET Analysis",
    two_port: "Two-Port Network",
    unknown: "Auto-detect"
  };
  return map[method] || method;
}

function formatEngineering(value: number, unit: string): string {
  if (value >= 1e9) return `${(value / 1e9).toPrecision(4)} G${unit}`;
  if (value >= 1e6) return `${(value / 1e6).toPrecision(4)} M${unit}`;
  if (value >= 1e3) return `${(value / 1e3).toPrecision(4)} k${unit}`;
  if (value >= 1) return `${value.toPrecision(4)} ${unit}`;
  if (value >= 1e-3) return `${(value * 1e3).toPrecision(4)} m${unit}`;
  if (value >= 1e-6) return `${(value * 1e6).toPrecision(4)} μ${unit}`;
  if (value >= 1e-9) return `${(value * 1e9).toPrecision(4)} n${unit}`;
  return `${(value * 1e12).toPrecision(4)} p${unit}`;
}

export { formatMethod, formatEngineering };
