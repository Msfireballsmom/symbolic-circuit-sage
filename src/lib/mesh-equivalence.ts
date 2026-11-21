// Row-of-meshes realization. Mesh currents are defined by KVL; this file never
// builds that resistance matrix. It lays the same elements out as a nodal
// netlist (a single row: each mesh shares branches only with its neighbors)
// so solveDC can cross-check the currents.

import type { DCComponent } from './circuit-solver';
import { solveDC } from './circuit-solver';
import type { MeshComponent } from './mesh-solver';

export interface MeshExpectation {
  dcIndex: number;
  label: string;
  expected: (currents: number[]) => number;
}

export interface MeshSketchEdge {
  label: string;
  nodeA: number;
  nodeB: number;
  kind: MeshComponent['type'] | 'wire';
}

export interface MeshRealization {
  dc: DCComponent[];
  expectations: MeshExpectation[];
  edges: MeshSketchEdge[];
  positions: { node: number; x: number; y: number }[];
}

interface Item { index: number; comp: MeshComponent }

function near(actual: number, expected: number) {
  return Number.isFinite(actual) && Number.isFinite(expected)
    && Math.abs(actual - expected) <= 1e-6 * Math.max(1e-9, Math.abs(actual), Math.abs(expected));
}

export function meshPath(numMeshes: number, components: MeshComponent[]): number[] {
  const adj = Array.from({ length: numMeshes + 1 }, () => new Set<number>());
  for (const c of components) {
    if (c.meshes.length === 2) {
      adj[c.meshes[0]].add(c.meshes[1]);
      adj[c.meshes[1]].add(c.meshes[0]);
    }
  }
  if (numMeshes === 1) return [1];
  for (let m = 1; m <= numMeshes; m++) {
    if (adj[m].size === 0) {
      throw new Error(`Mesh ${m} shares no branch with another mesh. Verified mesh solves one connected row; use DC Nodal for separate circuits.`);
    }
    if (adj[m].size > 2) {
      throw new Error(`Mesh ${m} shares branches with more than two neighbors. Verified mesh solves a single row. Enter this circuit in DC Nodal.`);
    }
  }
  const ends: number[] = [];
  for (let m = 1; m <= numMeshes; m++) if (adj[m].size === 1) ends.push(m);
  if (ends.length !== 2) {
    throw new Error('These meshes share branches in a loop. Verified mesh solves a single row, where each mesh shares only with the meshes beside it. Enter this circuit in DC Nodal.');
  }
  ends.sort((a, b) => a - b);
  const path = [ends[0]];
  const seen = new Set<number>([ends[0]]);
  while (path.length < numMeshes) {
    const next = [...adj[path[path.length - 1]]].find(n => !seen.has(n));
    if (next === undefined) throw new Error('Mesh sharing is not a single row. Enter this circuit in DC Nodal.');
    seen.add(next);
    path.push(next);
  }
  return path;
}

export function realizeMesh(numMeshes: number, components: MeshComponent[]): MeshRealization {
  const path = meshPath(numMeshes, components);
  const dc: DCComponent[] = [];
  const expectations: MeshExpectation[] = [];
  const edges: MeshSketchEdge[] = [];
  const pos = new Map<number, { x: number; y: number }>();
  let nextNode = 1;
  const ground = 0;

  const items = (pred: (c: MeshComponent) => boolean): Item[] => {
    const found: Item[] = [];
    components.forEach((comp, index) => { if (pred(comp)) found.push({ index, comp }); });
    return found;
  };

  const span = 140;
  const junctions: number[] = [];
  for (let k = 0; k < path.length - 1; k++) {
    const id = nextNode++;
    junctions.push(id);
    pos.set(id, { x: 48 + (k + 1) * span, y: 42 });
  }
  pos.set(ground, { x: 48 + (path.length * span) / 2, y: 168 });

  const place = (nodeA: number, nodeB: number, kind: MeshSketchEdge['kind'], label: string, value: number, expected?: (currents: number[]) => number) => {
    const dcIndex = dc.length;
    if (kind === 'wire') dc.push({ type: 'voltage_source', value: 0, nodeA, nodeB });
    else dc.push({ type: kind, value, nodeA, nodeB });
    edges.push({ label, nodeA, nodeB, kind });
    if (expected) expectations.push({ dcIndex, label, expected });
  };

  const lay = (start: number, end: number, chain: Item[], current: (i: number[]) => number, forward: number) => {
    if (chain.length === 0) {
      if (start !== end) place(end, start, 'wire', 'wire', 0);
      return;
    }
    if (start === end && chain.length < 2) {
      throw new Error('A one-mesh loop needs at least two series elements. Add the source and the resistors in that mesh.');
    }
    let cursor = start;
    chain.forEach((item, idx) => {
      const last = idx === chain.length - 1;
      let next = end;
      if (!last) {
        next = nextNode++;
        if (start === end) {
          const angle = Math.PI / 2 + (2 * Math.PI * (idx + 1)) / chain.length;
          pos.set(next, { x: 140 + 78 * Math.cos(angle), y: 100 + 78 * Math.sin(angle) });
        } else {
          const a = pos.get(start)!;
          const b = pos.get(end)!;
          const t = (idx + 1) / chain.length;
          pos.set(next, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        }
      }
      const label = item.comp.label || `${item.comp.type === 'resistor' ? 'R' : 'V'}${item.index + 1}`;
      if (item.comp.type === 'resistor') {
        place(cursor, next, 'resistor', label, item.comp.value, current);
      } else {
        const signed = item.comp.meshes[0] === forward ? item.comp.value : -item.comp.value;
        // Downstream terminal is the chain's head. Branch current out of that
        // terminal is the opposite of the chain current.
        place(next, cursor, 'voltage_source', label, signed, (i) => -current(i));
      }
      cursor = next;
    });
  };

  const exclusive = (mesh: number) => items(c => c.meshes.length === 1 && c.meshes[0] === mesh);
  const shared = (a: number, b: number) => items(c => c.meshes.length === 2 && c.meshes.includes(a) && c.meshes.includes(b));

  if (path.length === 1) {
    const only = exclusive(path[0]);
    if (only.length === 0) throw new Error('Mesh 1 has no elements.');
    lay(ground, ground, only, (i) => i[path[0] - 1], path[0]);
  } else {
    const first = exclusive(path[0]);
    const last = exclusive(path[path.length - 1]);
    if (first.length === 0 || last.length === 0) {
      throw new Error('Each end mesh needs at least one element that belongs only to it, so its loop can close. Use DC Nodal when a mesh is only a shared branch.');
    }
    lay(ground, junctions[0], first, (i) => i[path[0] - 1], path[0]);
    for (let k = 0; k < path.length - 1; k++) {
      const left = path[k];
      const right = path[k + 1];
      const boundary = shared(left, right);
      if (boundary.length === 0) throw new Error(`Meshes ${left} and ${right} are neighbors with no shared element.`);
      lay(junctions[k], ground, boundary, (i) => i[left - 1] - i[right - 1], left);
    }
    for (let k = 1; k < path.length - 1; k++) {
      const mesh = path[k];
      lay(junctions[k - 1], junctions[k], exclusive(mesh), (i) => i[mesh - 1], mesh);
    }
    lay(junctions[path.length - 2], ground, last, (i) => i[path[path.length - 1] - 1], path[path.length - 1]);
  }

  return { dc, expectations, edges, positions: [...pos.entries()].map(([node, p]) => ({ node, ...p })) };
}

export function assertMeshMatchesNodal(numMeshes: number, components: MeshComponent[], currents: number[]) {
  const realized = realizeMesh(numMeshes, components);
  let solved;
  try {
    solved = solveDC(realized.dc);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unverified: the mesh row has no independent nodal solution (${message}). Answer withheld.`);
  }
  for (const item of realized.expectations) {
    const nodal = solved.branchCurrents[item.dcIndex]?.current;
    const expected = item.expected(currents);
    if (!near(nodal, expected)) {
      throw new Error(`Unverified: ${item.label} disagrees with the independent nodal solution (nodal ${nodal} A, mesh ${expected} A). Answer withheld.`);
    }
  }
}
