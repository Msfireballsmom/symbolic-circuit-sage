import type { CircuitModel } from './circuit-model';

/** Independent branch tableau: every branch current and node voltage is unknown.
 * No MNA stamps, matrix routines or math helpers are imported from the app solver. */
export function independentDC(model: CircuitModel): Record<string, number> {
  const ground = model.nodes.find(n => n.isGround)?.id ?? model.meta.referenceNode;
  const nodes = model.nodes.map(n => n.id).filter(id => id !== ground);
  const branches = model.components.filter(c => c.kind !== 'ground');
  const n = nodes.length + branches.length;
  const rows: number[][] = [];
  const voltage = (row: number[], a: string, b: string, factor = 1) => {
    for (const [id, sign] of [[a, 1], [b, -1]] as const) {
      if (id === ground) continue;
      const i = nodes.indexOf(id);
      if (i < 0) throw new Error(`Undeclared node ${id}.`);
      row[i] += factor * sign;
    }
  };
  nodes.forEach(node => {
    const row = new Array(n + 1).fill(0);
    branches.forEach((c, j) => { row[nodes.length + j] = (c.terminals[0] === node ? 1 : 0) - (c.terminals[1] === node ? 1 : 0); });
    rows.push(row);
  });
  branches.forEach((c, j) => {
    const row = new Array(n + 1).fill(0), col = nodes.length + j;
    const [a, b] = c.terminals;
    if (c.kind === 'resistor' && c.value.magnitude !== Infinity) {
      voltage(row, a, b); row[col] = -c.value.magnitude;
    } else if (c.kind === 'capacitor' || c.kind === 'resistor') row[col] = 1;
    else if (c.kind === 'inductor') voltage(row, a, b);
    else if (c.kind === 'vsource') { voltage(row, a, b); row[n] = c.value.magnitude; }
    else if (c.kind === 'isource') { row[col] = 1; row[n] = -c.value.magnitude; }
    else {
      const ctl = c.control;
      if (!ctl) throw new Error(`Missing control for ${c.id}.`);
      const currentSource = c.kind === 'vccs' || c.kind === 'cccs';
      if (currentSource) row[col] = 1; else voltage(row, a, b);
      const gain = currentSource ? ctl.gain : -ctl.gain;
      if (ctl.type === 'voltage-across' && ctl.across) voltage(row, ctl.across[0], ctl.across[1], gain);
      else {
        const control = branches.findIndex(branch => branch.id === ctl.through);
        if (control < 0) throw new Error(`Unresolved control for ${c.id}.`);
        row[nodes.length + control] += gain;
      }
    }
    rows.push(row);
  });
  // Row normalization avoids mixing ohms and volts in a global pivot threshold.
  for (const row of rows) {
    const scale = Math.max(...row.slice(0, n).map(Math.abs));
    if (!(scale > 0)) throw new Error('Independent equations are singular.');
    for (let j = 0; j <= n; j++) row[j] /= scale;
  }
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let i = col + 1; i < n; i++) if (Math.abs(rows[i][col]) > Math.abs(rows[pivot][col])) pivot = i;
    if (Math.abs(rows[pivot][col]) < 1e-14) throw new Error('Independent equations are singular or ill-conditioned.');
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    const divisor = rows[col][col];
    for (let j = col; j <= n; j++) rows[col][j] /= divisor;
    for (let i = 0; i < n; i++) if (i !== col) {
      const factor = rows[i][col];
      for (let j = col; j <= n; j++) rows[i][j] -= factor * rows[col][j];
    }
  }
  return Object.fromEntries([[ground, 0], ...nodes.map((node, i) => [node, rows[i][n]])]);
}

export function requireIndependentAgreement(model: CircuitModel, actual: Record<string, number>) {
  const reference = independentDC(model);
  for (const [node, expected] of Object.entries(reference)) {
    if (!Number.isFinite(actual[node]) || !Number.isFinite(expected) || Math.abs(actual[node] - expected) > 1e-8 * Math.max(1e-12, Math.abs(expected), Math.abs(actual[node]))) {
      throw new Error(`Unverified: independent branch equations disagree at ${node}; answer withheld.`);
    }
  }
}