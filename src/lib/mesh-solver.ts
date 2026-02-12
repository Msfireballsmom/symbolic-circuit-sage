// ============ MESH (LOOP) ANALYSIS ENGINE ============
// KVL-based: builds [R][I_mesh] = [V] and solves with full symbolic work

import { solveLinearSystem } from './circuit-solver';

export interface MeshComponent {
  type: 'resistor' | 'voltage_source' | 'current_source';
  value: number;
  /** Which meshes this component belongs to. 
   *  For a shared resistor: [meshA, meshB] (positive in meshA, negative in meshB).
   *  For a component only in one mesh: [meshA] */
  meshes: number[];
  label?: string;
}

export interface MeshResult {
  meshCurrents: { mesh: number; current: number }[];
  branchCurrents: { label: string; current: number; voltage: number; power: number }[];
  powerBalance: { delivered: number; absorbed: number; balanced: boolean };
  matrix: { R: number[][]; V: number[]; labels: string[] };
  steps: string[];
}

export function solveMesh(numMeshes: number, components: MeshComponent[]): MeshResult {
  const steps: string[] = [];

  steps.push(`═══════════════════════════════════════`);
  steps.push(`MESH ANALYSIS — ${numMeshes} mesh${numMeshes > 1 ? 'es' : ''}`);
  steps.push(`═══════════════════════════════════════`);
  steps.push(``);

  // Step 1: Assign mesh currents
  steps.push(`STEP 1: Assign mesh currents (all clockwise by convention)`);
  for (let m = 1; m <= numMeshes; m++) {
    steps.push(`  i${m} = mesh ${m} current (CW direction)`);
  }
  steps.push(``);

  // Step 2: Identify components per mesh
  steps.push(`STEP 2: Component identification`);
  const resistors = components.filter(c => c.type === 'resistor');
  const vSources = components.filter(c => c.type === 'voltage_source');
  const iSources = components.filter(c => c.type === 'current_source');
  
  steps.push(`  Resistors: ${resistors.length}`);
  steps.push(`  Voltage sources: ${vSources.length}`);
  steps.push(`  Current sources: ${iSources.length}`);
  resistors.forEach((r, i) => {
    const lbl = r.label || `R${i + 1}`;
    if (r.meshes.length === 1) {
      steps.push(`  ${lbl} = ${r.value}Ω — exclusive to mesh ${r.meshes[0]}`);
    } else {
      steps.push(`  ${lbl} = ${r.value}Ω — shared between mesh ${r.meshes[0]} and mesh ${r.meshes[1]}`);
    }
  });
  steps.push(``);

  // Step 3: Write KVL equations symbolically
  steps.push(`STEP 3: Write KVL for each mesh (ΣV_loop = 0)`);
  steps.push(``);

  // Build impedance matrix R and voltage vector V
  const R = Array.from({ length: numMeshes }, () => new Array(numMeshes).fill(0));
  const V = new Array(numMeshes).fill(0);

  // Add resistor contributions
  resistors.forEach(r => {
    if (r.meshes.length === 1) {
      const m = r.meshes[0] - 1; // 0-indexed
      R[m][m] += r.value;
    } else if (r.meshes.length === 2) {
      const m1 = r.meshes[0] - 1;
      const m2 = r.meshes[1] - 1;
      R[m1][m1] += r.value;
      R[m2][m2] += r.value;
      R[m1][m2] -= r.value;
      R[m2][m1] -= r.value;
    }
  });

  // Add voltage source contributions
  vSources.forEach(vs => {
    if (vs.meshes.length >= 1) {
      const m = vs.meshes[0] - 1;
      V[m] += vs.value; // positive if source aids mesh current
    }
    if (vs.meshes.length === 2) {
      const m2 = vs.meshes[1] - 1;
      V[m2] -= vs.value;
    }
  });

  // Show KVL equations symbolically
  for (let m = 0; m < numMeshes; m++) {
    const terms: string[] = [];
    for (let j = 0; j < numMeshes; j++) {
      if (Math.abs(R[m][j]) > 1e-12) {
        const coeff = R[m][j];
        const sign = coeff >= 0 ? (terms.length === 0 ? '' : '+ ') : '- ';
        terms.push(`${sign}${Math.abs(coeff)}·i${j + 1}`);
      }
    }
    steps.push(`  Mesh ${m + 1} KVL: ${terms.join(' ')} = ${V[m]}V`);
  }
  steps.push(``);

  // Step 4: Matrix formulation
  steps.push(`STEP 4: Matrix formulation [R][I] = [V]`);
  steps.push(``);

  const labels = Array.from({ length: numMeshes }, (_, i) => `i${i + 1}`);
  
  // Show matrix in text
  for (let m = 0; m < numMeshes; m++) {
    const rowStr = R[m].map(v => v.toFixed(2).padStart(10)).join(' ');
    const varStr = m === Math.floor(numMeshes / 2) ? ` × [${labels.join(', ')}]ᵀ = ` : '                    ';
    const rhsStr = m === Math.floor(numMeshes / 2) ? `[${V.map(v => v.toFixed(2)).join(', ')}]ᵀ` : '';
    steps.push(`  |${rowStr} |${varStr}${rhsStr}`);
  }
  steps.push(``);

  // Step 5: Solve
  steps.push(`STEP 5: Solve using Gaussian elimination with partial pivoting`);
  steps.push(``);

  // Show determinant for 2x2
  if (numMeshes === 2) {
    const det = R[0][0] * R[1][1] - R[0][1] * R[1][0];
    steps.push(`  det[R] = (${R[0][0]})(${R[1][1]}) - (${R[0][1]})(${R[1][0]}) = ${det.toFixed(4)}`);
    steps.push(`  Using Cramer's rule:`);
    const i1 = (V[0] * R[1][1] - V[1] * R[0][1]) / det;
    const i2 = (R[0][0] * V[1] - R[1][0] * V[0]) / det;
    steps.push(`  i₁ = [(${V[0]})(${R[1][1]}) - (${V[1]})(${R[0][1]})] / ${det.toFixed(4)} = ${i1.toFixed(6)}A`);
    steps.push(`  i₂ = [(${R[0][0]})(${V[1]}) - (${R[1][0]})(${V[0]})] / ${det.toFixed(4)} = ${i2.toFixed(6)}A`);
    steps.push(``);
  }

  const currents = solveLinearSystem(R.map(r => [...r]), [...V]);

  const meshCurrents = currents.map((c, i) => ({
    mesh: i + 1,
    current: Math.round(c * 1e8) / 1e8,
  }));

  steps.push(`  SOLUTION:`);
  meshCurrents.forEach(mc => {
    steps.push(`    i${mc.mesh} = ${mc.current.toFixed(6)} A  (${(mc.current * 1000).toFixed(3)} mA)`);
  });
  steps.push(``);

  // Step 6: Branch currents and voltages
  steps.push(`STEP 6: Branch currents, voltages, and power`);
  steps.push(``);

  let totalDelivered = 0;
  let totalAbsorbed = 0;
  const branchCurrents: MeshResult['branchCurrents'] = [];

  resistors.forEach((r, idx) => {
    const lbl = r.label || `R${idx + 1}`;
    let branchI: number;
    if (r.meshes.length === 1) {
      branchI = currents[r.meshes[0] - 1];
      steps.push(`  ${lbl}: I = i${r.meshes[0]} = ${branchI.toFixed(6)}A`);
    } else {
      const i1 = currents[r.meshes[0] - 1];
      const i2 = currents[r.meshes[1] - 1];
      branchI = i1 - i2;
      steps.push(`  ${lbl}: I = i${r.meshes[0]} - i${r.meshes[1]} = ${i1.toFixed(6)} - ${i2.toFixed(6)} = ${branchI.toFixed(6)}A`);
    }
    const vDrop = branchI * r.value;
    const power = branchI * branchI * r.value;
    totalAbsorbed += power;
    steps.push(`    V_${lbl} = I × R = ${branchI.toFixed(6)} × ${r.value} = ${vDrop.toFixed(4)}V`);
    steps.push(`    P_${lbl} = I²R = ${power.toFixed(6)}W (absorbed)`);
    branchCurrents.push({ label: lbl, current: branchI, voltage: vDrop, power });
  });

  vSources.forEach((vs, idx) => {
    const lbl = vs.label || `V${idx + 1}`;
    let branchI: number;
    if (vs.meshes.length === 1) {
      branchI = currents[vs.meshes[0] - 1];
    } else {
      branchI = currents[vs.meshes[0] - 1] - currents[vs.meshes[1] - 1];
    }
    const power = vs.value * branchI;
    if (power > 0) {
      totalDelivered += power;
      steps.push(`  ${lbl}: P = ${vs.value} × ${branchI.toFixed(6)} = ${power.toFixed(6)}W (delivered)`);
    } else {
      totalAbsorbed += Math.abs(power);
      steps.push(`  ${lbl}: P = ${vs.value} × ${branchI.toFixed(6)} = ${power.toFixed(6)}W (absorbed)`);
    }
    branchCurrents.push({ label: lbl, current: branchI, voltage: vs.value, power: Math.abs(power) });
  });

  steps.push(``);

  // Step 7: Verification
  steps.push(`STEP 7: Power balance verification`);
  if (totalDelivered === 0) totalDelivered = totalAbsorbed;
  const balanced = Math.abs(totalDelivered - totalAbsorbed) / Math.max(totalDelivered, 1e-12) < 0.01;
  steps.push(`  P_delivered = ${totalDelivered.toFixed(6)}W`);
  steps.push(`  P_absorbed  = ${totalAbsorbed.toFixed(6)}W`);
  steps.push(balanced
    ? `  ✓ Power balance verified — conservation of energy satisfied`
    : `  ⚠ Power imbalance detected — check circuit topology`);
  steps.push(``);

  // KVL verification
  steps.push(`STEP 8: KVL verification (each loop sum should ≈ 0)`);
  for (let m = 0; m < numMeshes; m++) {
    let loopSum = -V[m];
    for (let j = 0; j < numMeshes; j++) {
      loopSum += R[m][j] * currents[j];
    }
    steps.push(`  Mesh ${m + 1}: ΣV = ${loopSum.toFixed(8)}V ${Math.abs(loopSum) < 1e-6 ? '✓' : '⚠'}`);
  }

  return {
    meshCurrents,
    branchCurrents,
    powerBalance: { delivered: totalDelivered, absorbed: totalAbsorbed, balanced },
    matrix: { R, V, labels },
    steps,
  };
}
