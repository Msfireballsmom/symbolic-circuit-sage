// Circuit Sage v2 — canonical model. See spec §3.
// The extraction function returns this and nothing else.
// The solver never looks at the photograph, never re-parses text.

export type Unit =
  | "ohm"
  | "farad"
  | "henry"
  | "volt"
  | "amp"
  | "hertz"
  | "second"
  | "watt"
  | "joule"
  | "unitless"; // e.g. gains, turns ratios

export type Prefix =
  | "p" | "n" | "u" | "m" | "" | "k" | "M" | "G";

/**
 * A physical quantity. Magnitude is ALWAYS in base SI units.
 * `prefix` is view-only — it exists so the UI can render "4.7kΩ" instead of "4700 Ω".
 * The solver reads `magnitude` and ignores `prefix`.
 */
export interface Quantity {
  magnitude: number;
  unit: Unit;
  prefix?: Prefix;
}

export type ComponentKind =
  | "resistor"
  | "capacitor"
  | "inductor"
  | "vsource"
  | "isource"
  | "vcvs"
  | "vccs"
  | "ccvs"
  | "cccs"
  | "opamp"
  | "switch"
  | "transformer"
  | "ground";

export type WaveformShape =
  | "dc"
  | "sine"
  | "cosine"
  | "square"
  | "triangle"
  | "sawtooth"
  | "pulse"
  | "step"
  | "impulse"
  | "exponential";

export interface Waveform {
  shape: WaveformShape;
  amplitude: Quantity;
  frequency?: Quantity;   // Hz
  phase?: number;         // degrees
  isRMS?: boolean;        // amplitude was stated as RMS
  offset?: Quantity;
}

export type ControlType =
  | "voltage-across"
  | "current-through";

/**
 * A reference to a controlling variable for a dependent source.
 * Required for every dependent source (§3).
 */
export interface ControlRef {
  type: ControlType;
  /** Component or node pair the control samples. */
  across?: [string, string]; // [nodeA, nodeB]
  through?: string;          // component id
  /** Dimensionless gain, transconductance (S), transresistance (Ω), or current gain. */
  gain: number;
}

export interface NodeRef {
  id: string;
  /** Component ids that terminate at this node. */
  connects: string[];
  isGround?: boolean;
  position?: { x: number; y: number };
}

export interface Port {
  id: string;
  node: string;
  label: string; // 'a', 'b', 'in+', etc.
}

export interface Coupling {
  inductors: [string, string]; // component ids
  /** Coupling coefficient (0..1). Either k or M must be provided. */
  k?: number;
  /** Mutual inductance in henries. */
  M?: Quantity;
  /** Which terminal of each inductor carries the dot (0 or 1). */
  dots: [0 | 1, 0 | 1];
}

export interface Switching {
  /** Time (s) at which the switch closes. */
  closesAt?: number | "unknown";
  /** Time (s) at which the switch opens. */
  opensAt?: number | "unknown";
}

/** Two separate reads — see §3. */
export interface Confidence {
  exists: number; // 0..1 — that this component exists on the page
  value: number;  // 0..1 — that its value was read correctly
}

export interface Provenance {
  region?: { page: number; bbox: [number, number, number, number] };
  from: "drawing" | "text" | "both";
}

export interface Component {
  id: string; // R1, C2, V1 — stable across every view, step, and drawing
  kind: ComponentKind;
  /** Ordered node ids. Polarity is meaningful for sources, caps, opamps. */
  terminals: string[];
  value: Quantity;
  tolerance?: number | null;      // percent — §6
  rating?: { power?: Quantity; voltage?: Quantity; current?: Quantity } | null;
  tempco?: number | null;         // ppm/°C
  initial?: Quantity | null;      // v(0) for caps, i(0) for inductors
  waveform?: Waveform | null;
  control?: ControlRef | null;    // required for dependent sources
  switching?: Switching | null;
  confidence: Confidence;
  provenance: Provenance;
  position?: { x: number; y: number }; // view-only
}

export type AnalysisKind =
  | "solve"
  | "thevenin"
  | "norton"
  | "superposition"
  | "maxpower"
  | "transient"
  | "phasor"
  | "power"
  | "three-phase"
  | "transfer-function"
  | "poles-zeros"
  | "frequency-response"
  | "resonance"
  | "two-port"
  | "fourier-series"
  | "fourier-transform"
  | "sensitivity"
  | "worst-case"
  | "synthesize";

/** First-class time targets — 0⁻, 0⁺, and ∞ are the whole lesson of transients. */
export type TimeTarget = "0-" | "0+" | "inf" | number | "expression";

export interface AnalysisRequest {
  label: string; // 'a', 'b', 'c' — preserved from the source
  kind: AnalysisKind;
  /** Node id, component id, port id, or a symbolic expression. */
  target: { type: "node" | "component" | "port" | "expression"; ref: string };
  at?: TimeTarget | { frequency: Quantity };
  deliverable: "number" | "expression" | "plot" | "diagram" | "circuit" | "document";
  sourceText: string; // the question, verbatim
  /** Superposition only: the independent source whose contribution is asked for. */
  source?: string;
}

export type SourceGenre =
  | "typed-problem-sheet"
  | "textbook-photo"
  | "simulation-screenshot"
  | "printed-with-handwriting"
  | "handwritten"
  | "typed-netlist"
  | "text-only";

export interface SourceRegion {
  kind:
    | "header"
    | "question-number"
    | "prose"
    | "schematic"
    | "sub-part-list"
    | "student-work";
  page: number;
  bbox: [number, number, number, number];
  text?: string;
}

export interface SourceDocument {
  genre: SourceGenre;
  pages: number;
  regions: SourceRegion[];
  /** The raw prose extracted from the document, joined across regions. */
  prose?: string;
}

export interface CircuitModel {
  components: Component[];
  nodes: NodeRef[];
  ports: Port[];
  couplings: Coupling[];
  questions: AnalysisRequest[];
  source: SourceDocument;
  meta: {
    referenceNode: string;
    readAt: string; // ISO timestamp
    genre: SourceGenre;
    revision: number;
  };
}
