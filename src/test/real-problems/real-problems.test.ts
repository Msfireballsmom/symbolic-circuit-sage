// Real homework-style problems, answered independently (reference.py) and run
// through the app's real text pipeline (parse → confirm → model → guard →
// preflight → solve → independent DC agreement + power balance) and the RLC tab.
//
// Two scores, kept separate:
//   interpretation — did the parser read the right parts, values, connections
//                    (and initial conditions / topology for transients)?
//   solving        — did the numbers the app displays as verified match the
//                    independent reference within REL_TOL (1e-6 relative)?
//
// KNOWN_GAPS documents today's failures with their cause. They run with
// `it.fails`, so the real assertion still executes: when a gap is fixed the test
// starts failing and the entry must be removed. A wrong answer under a Verified
// badge is never accepted outside KNOWN_GAPS.
import { describe, it, expect } from 'vitest';
import { scoreAll, type Row } from './score';

const KNOWN_GAPS: Record<string, { interpretation?: string; solving?: string }> = {
  'PLAIN-1': {
    interpretation: 'BUG: the standalone-resistor pattern (problem-parser.ts extractComponents, "Extract standalone" block) reads every "3 kΩ" occurrence as a new resistor, so restating a value in the question adds a phantom R3 in series.',
    solving: 'BUG (consequence of the parser bug): if the student confirms the 3-resistor draft, the card shows 3.75 V as Verified; the textbook answer is 6 V.',
  },
  'PLAIN-5': { interpretation: 'GAP: "5 V is applied across" is not recognised as a source (needs "Vs =", "source", "supply" or "battery"). Honestly withheld.' },
  'PLAIN-6': { interpretation: 'GAP: "the supply is 9 V" and "starts uncharged" are not read; the source and v(0) = 0 are missing. Honestly withheld.' },
  'PLAIN-7': { interpretation: 'GAP: "inductor of 100 mH", "a 10 V DC source" and "initially no current" are not read. Honestly withheld.' },
  'PLAIN-8': { interpretation: 'GAP: "capacitor charged to 10 V" is not read as v_C(0) = 10 V. The RLC tab answer with typed values is correct.' },
};

const rows = scoreAll();
const byId = new Map(rows.map(r => [r.id, r]));

describe('real problems — interpretation', () => {
  for (const r of rows.filter(r => r.kind !== 'refusal')) {
    const gap = KNOWN_GAPS[r.id]?.interpretation;
    (gap ? it.fails : it)(`${r.id} [${r.tag}] ${r.topic}${gap ? ` — KNOWN: ${gap}` : ''}`, () => {
      expect(r.interpretation, r.notes.join(' | ')).toBe(true);
    });
  }
});

describe('real problems — solving against the independent reference', () => {
  for (const r of rows.filter(r => r.kind !== 'refusal')) {
    const gap = KNOWN_GAPS[r.id]?.solving;
    if (r.solving === null) {
      it(`${r.id} is withheld, never answered wrong`, () => {
        expect(r.shown).toBe(false);
        expect(KNOWN_GAPS[r.id], `${r.id} became withheld without a documented reason: ${r.notes.join(' | ')}`).toBeDefined();
      });
      continue;
    }
    (gap ? it.fails : it)(`${r.id} matches the reference${gap ? ` — KNOWN: ${gap}` : ''}`, () => {
      expect(r.solving, r.notes.join(' | ')).toBe(true);
      expect(r.verifiedWrong).toBe(false);
    });
  }
});

describe('problems that must be refused are honestly withheld', () => {
  for (const r of rows.filter(r => r.kind === 'refusal')) {
    it(`${r.id} (${r.topic}) — ${r.notes.join(' | ')}`, () => {
      expect(r.shown).toBe(false);
    });
  }
});

describe('benchmark summary', () => {
  const pct = (n: number, d: number) => d ? `${(100 * n / d).toFixed(1)}% (${n}/${d})` : 'n/a';
  const summarise = (set: Row[]) => {
    const pos = set.filter(r => r.kind !== 'refusal');
    const answered = pos.filter(r => r.solving !== null);
    return {
      interpretation: pct(pos.filter(r => r.interpretation).length, pos.length),
      solvingOfAnswered: pct(answered.filter(r => r.solving).length, answered.length),
      endToEnd: pct(pos.filter(r => r.interpretation && r.solving).length, pos.length),
      refusalsWithheld: pct(set.filter(r => r.kind === 'refusal' && !r.shown).length, set.filter(r => r.kind === 'refusal').length),
      verifiedWrong: set.filter(r => r.verifiedWrong).map(r => r.id),
    };
  };
  it('prints both accuracy scores and never regresses below the recorded baseline', () => {
    const original = summarise(rows.filter(r => r.tag === 'original'));
    const et310 = summarise(rows.filter(r => r.tag === 'ET310-sourced'));
    console.log('\nREAL-PROBLEM BENCHMARK');
    console.table(rows.map(r => ({ id: r.id, tag: r.tag, expected: r.expected, app: r.app, interp: r.interpretation ? 'pass' : 'FAIL', solve: r.solving === null ? 'withheld' : r.solving ? 'pass' : 'FAIL' })));
    console.log('original', original);
    console.log('ET310-sourced', et310);
    // Baseline recorded at the commit that added this file. Raise it when gaps close.
    const n = (s: string) => Number(s.split('%')[0]);
    expect(n(original.interpretation)).toBeGreaterThanOrEqual(88.3);
    expect(n(original.solvingOfAnswered)).toBeGreaterThanOrEqual(97.5);
    expect(n(et310.interpretation)).toBe(100);
    expect(n(et310.solvingOfAnswered)).toBe(100);
    expect(original.verifiedWrong).toEqual(['PLAIN-1']);
    expect(et310.verifiedWrong).toEqual([]);
    expect(byId.size).toBeGreaterThanOrEqual(56);
  });
});
