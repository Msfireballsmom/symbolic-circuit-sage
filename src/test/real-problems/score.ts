import { REAL_PROBLEMS } from './expected';
import { runSage, runRLCTab, rlcTabValueAt } from './pipeline';

export const REL_TOL = 1e-6;   // DC, τ, x(0+), x(∞), α, ω0, roots
export const WAVE_TOL = 1e-6;  // RLC waveform samples, relative to the response scale
const close = (a: number, b: number, scale = Math.abs(b), tol = REL_TOL) => Math.abs(a - b) <= tol * Math.max(scale, 1e-9) + 1e-12;

type Net = readonly (readonly [string, string, number, number, number])[];
const TYPE: Record<string, string> = { resistor: 'R', voltage_source: 'V', current_source: 'I', capacitor: 'C', inductor: 'L' };

/** Same parts, same values, same connections up to renaming non-ground nodes; source polarity must match. */
export function interpret(parsedComps: { type: string; label: string; value: number; nodeA?: number; nodeB?: number }[], net: Net) {
  const notes: string[] = [];
  const got = parsedComps.map(c => ({ t: TYPE[c.type] ?? c.type, label: c.label, value: c.value, a: c.nodeA, b: c.nodeB }));
  if (got.length !== net.length) notes.push(`parsed ${got.length} parts, expected ${net.length}: [${got.map(g => `${g.label}=${g.value}`).join(', ')}]`);
  for (const [t, label, value] of net) {
    const g = got.find(x => x.label.toUpperCase() === label.toUpperCase());
    if (!g) { notes.push(`${label} missing`); continue; }
    if (g.t !== t) notes.push(`${label} read as ${g.t}, expected ${t}`);
    if (!close(g.value, value)) notes.push(`${label} = ${g.value}, expected ${value}`);
  }
  // Node mapping search (≤ 6 non-ground nodes in this set).
  const expNodes = [...new Set(net.flatMap(c => [c[3], c[4]]))].filter(n => n !== 0);
  const gotNodes = [...new Set(got.flatMap(g => [g.a, g.b]))].filter(n => n !== 0 && n !== undefined) as number[];
  let mapping: Map<number, number> | null = null;
  if (!notes.length && expNodes.length === gotNodes.length && got.every(g => g.a !== undefined && g.b !== undefined)) {
    const perms = (xs: number[]): number[][] => xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map(p => [x, ...p]));
    for (const p of perms(gotNodes)) {
      const m = new Map<number, number>([[0, 0], ...expNodes.map((n, i) => [n, p[i]] as [number, number])]);
      const ok = net.every(([t, label, , a, b]) => {
        const g = got.find(x => x.label.toUpperCase() === label.toUpperCase())!;
        const [ma, mb] = [m.get(a), m.get(b)];
        return (t === 'V' || t === 'I') ? (g.a === ma && g.b === mb) : ((g.a === ma && g.b === mb) || (g.a === mb && g.b === ma));
      });
      if (ok) { mapping = m; break; }
    }
  }
  if (!notes.length && !mapping) notes.push(`topology differs: parsed ${got.map(g => `${g.label}(${g.a}-${g.b})`).join(' ')}`);
  return { ok: notes.length === 0, notes, mapping };
}

export interface Row {
  id: string; tag: string; topic: string; kind: string;
  expected: string; app: string;
  interpretation: boolean; solving: boolean | null; // null = withheld (not answered)
  shown: boolean; verifiedWrong: boolean; notes: string[];
}

const fmt = (x: number) => Number.isFinite(x) ? Number(x.toPrecision(6)).toString() : String(x);

export function scoreAll(): Row[] {
  const rows: Row[] = [];
  for (const p of REAL_PROBLEMS as any[]) {
    if (p.kind === 'dc' || p.kind === 'first_order') {
      const run = runSage(p.text);
      const it = interpret(run.parsed.components, p.netlist);
      const notes = [...it.notes];
      if (p.kind === 'first_order') {
        const want = p.storage[0] === 'C' ? run.parsed.initialVoltage : run.parsed.initialCurrent;
        if (want === undefined || !close(want, p.init)) { notes.push(`initial condition read as ${want}, expected ${p.init}`); }
        if (run.parsed.method !== 'transient') notes.push(`method ${run.parsed.method}, expected transient`);
      }
      const interpretation = notes.length === 0;
      const gotVals: number[] = [];
      let solving: boolean | null = null;
      if (run.shown) {
        const nodeV = (n: string) => n === 'gnd' ? 0 : run.answers.find(a => a.question.target.type === 'node' && a.question.target.ref === n && a.question.kind === 'solve')?.result?.numeric;
        solving = true;
        for (const e of p.expected) {
          let v: number | undefined;
          if (p.kind === 'first_order') {
            const x = run.answers[0]?.result?.extras;
            v = e.kind === 'tau' ? x?.tau : e.kind === 'x0' ? x?.x0 : x?.xinf;
          } else if (e.kind === 'N') {
            const appNode = it.mapping?.get(e.ref);
            v = appNode === undefined ? undefined : nodeV(`n${appNode}`);
          } else {
            const term = run.terminals[e.ref];
            if (e.kind === 'V' && term) { const a = nodeV(term[0]), b = nodeV(term[1]); v = a === undefined || b === undefined ? undefined : Math.abs(a - b); }
            if (e.kind === 'I') { const r = run.answers.find(a => a.question.kind === 'solve' && a.question.target.ref === e.ref)?.result?.numeric; v = r === undefined ? undefined : Math.abs(r); }
            if (e.kind === 'P') v = run.answers.find(a => a.question.kind === 'power' && a.question.target.ref === e.ref)?.result?.numeric;
          }
          gotVals.push(v ?? NaN);
          if (v === undefined || !close(v, e.value, Math.max(Math.abs(e.value), ...p.expected.filter((x: any) => x.unit === e.unit).map((x: any) => Math.abs(x.value))))) {
            solving = false; notes.push(`${e.q}: app ${v === undefined ? 'not given' : fmt(v)} vs ref ${fmt(e.value)} ${e.unit}`);
          }
        }
      } else notes.push(`withheld — ${run.withheldBy}`);
      rows.push({
        id: p.id, tag: p.tag, topic: p.mirrors, kind: p.kind,
        expected: p.expected.map((e: any) => `${e.q}=${fmt(e.value)} ${e.unit}`).join('; '),
        app: run.shown ? gotVals.map(fmt).join('; ') : 'withheld',
        interpretation, solving, shown: run.shown, verifiedWrong: run.shown && solving === false, notes,
      });
    } else if (p.kind === 'rlc') {
      const s = p.rlc;
      const parsed = runSage(p.text);
      const notes: string[] = [];
      const pc = parsed.parsed;
      if (pc.method !== 'rlc') notes.push(`method ${pc.method}, expected rlc`);
      if (pc.topology !== s.topology) notes.push(`topology ${pc.topology}, expected ${s.topology}`);
      for (const [t, v] of [['resistor', s.R], ['inductor', s.L], ['capacitor', s.C]] as const) {
        const c = pc.components.filter(x => x.type === t);
        if (c.length !== 1 || !close(c[0].value, v)) notes.push(`${t} read as [${c.map(x => x.value).join(', ')}], expected ${v}`);
      }
      if (s.excitation === 'step' && s.topology === 'series') {
        const vs = pc.components.filter(x => x.type === 'voltage_source');
        if (vs.length !== 1 || !close(vs[0].value, s.Vs)) notes.push(`Vs read as [${vs.map(x => x.value).join(', ')}], expected ${s.Vs}`);
      }
      if (!close(pc.initialVoltage ?? 0, s.vC0)) notes.push(`v_C(0) read as ${pc.initialVoltage}, expected ${s.vC0}`);
      if (!close(pc.initialCurrent ?? 0, s.iL0)) notes.push(`i_L(0) read as ${pc.initialCurrent}, expected ${s.iL0}`);
      const sageSafe = !parsed.shown; // the text path must not print a DC answer for an RLC question
      if (!sageSafe) notes.push('Snap & Solve displayed a verified DC answer for a second-order transient question');
      const interpretation = notes.length === 0;
      const input = { topology: s.topology, excitation: s.excitation, R: s.R, L: s.L, C: s.C, Vs: s.Vs, vC0: s.vC0, iL0: s.iL0 };
      const tab = runRLCTab(input);
      let solving: boolean | null = null; let app = 'withheld';
      const e = p.expected;
      if (tab.result) {
        const r = tab.result; solving = true;
        const w0 = e.omega0;
        const chk = (name: string, a: number, b: number, scale: number) => { if (!close(a, b, scale)) { solving = false; notes.push(`${name}: app ${fmt(a)} vs ref ${fmt(b)}`); } };
        chk('alpha', r.alpha, e.alpha, e.alpha); chk('omega0', r.omega0, w0, w0);
        if (r.dampingType !== e.damping) { solving = false; notes.push(`damping ${r.dampingType} vs ${e.damping}`); }
        const roots = [[r.s1.re, r.s1.im], [r.s2.re, r.s2.im]].sort((x, y) => y[0] - x[0] || y[1] - x[1]);
        const ref = [e.s1, e.s2];
        roots.forEach((z, i) => { chk(`s${i + 1}.re`, z[0], ref[i][0], w0); chk(`s${i + 1}.im`, z[1], ref[i][1], w0); });
        const vScale = Math.max(Math.abs(s.Vs), Math.abs(s.vC0), ...e.samples.map((x: any) => Math.abs(x.vC)));
        const iScale = Math.max(Math.abs(s.iL0), ...e.samples.map((x: any) => Math.abs(x.iL)), 1e-12);
        for (const smp of e.samples.slice(1)) {
          const v = rlcTabValueAt(input, smp.t);
          if ('error' in v) { solving = false; notes.push(`t=${fmt(smp.t)}: ${v.error}`); continue; }
          if (!close(v.vC, smp.vC, vScale, WAVE_TOL)) { solving = false; notes.push(`vC(${fmt(smp.t)}): app ${fmt(v.vC)} vs ref ${fmt(smp.vC)}`); }
          if (!close(v.iL, smp.iL, iScale, WAVE_TOL)) { solving = false; notes.push(`iL(${fmt(smp.t)}): app ${fmt(v.iL)} vs ref ${fmt(smp.iL)}`); }
        }
        app = `${r.dampingType}; s1=${fmt(roots[0][0])}${roots[0][1] ? `±j${fmt(Math.abs(roots[0][1]))}` : ''}, s2=${fmt(roots[1][0])}`;
      } else notes.push(`RLC tab withheld — ${tab.error}`);
      rows.push({
        id: p.id, tag: p.tag, topic: p.mirrors, kind: 'rlc',
        expected: `${e.damping}; s1=${fmt(e.s1[0])}${e.s1[1] ? `±j${fmt(Math.abs(e.s1[1]))}` : ''}, s2=${fmt(e.s2[0])}; 10 waveform samples`,
        app, interpretation, solving, shown: !!tab.result, verifiedWrong: !!tab.result && solving === false, notes,
      });
    } else {
      // Must be refused.
      const run = runSage(p.text);
      const notes = [`sage: ${run.shown ? 'SHOWN AS VERIFIED' : `withheld — ${run.withheldBy}`}`];
      let shown = run.shown;
      if (p.path === 'rlc') {
        const tab = runRLCTab(p.rlc);
        notes.push(`RLC tab: ${tab.result ? 'ANSWERED' : `withheld — ${tab.error}`}`);
        shown = shown || !!tab.result;
      }
      rows.push({ id: p.id, tag: p.tag, topic: p.mirrors, kind: 'refusal', expected: 'withheld', app: shown ? 'ANSWERED' : 'withheld', interpretation: true, solving: null, shown, verifiedWrong: shown, notes });
    }
  }
  return rows;
}
