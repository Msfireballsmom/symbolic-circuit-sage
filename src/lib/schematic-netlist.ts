import type { DCComponent } from './circuit-solver';

export type SchematicCell = `${number},${number}`;
export type SchematicKind = 'resistor' | 'voltage_source' | 'current_source' | 'wire';

export interface SchematicPart {
  id: string;
  kind: SchematicKind;
  /** First terminal. For a source this is the positive node or the current arrow tail. */
  a: SchematicCell;
  b: SchematicCell;
  value: number;
}

export interface SchematicNetlist {
  components: DCComponent[];
  nodeOf: Record<string, number>;
}

function findRoot(parent: Map<string, string>, cell: string) {
  if (!parent.has(cell)) parent.set(cell, cell);
  let root = cell;
  while (parent.get(root) !== root) root = parent.get(root)!;
  let cursor = cell;
  while (cursor !== root) {
    const next = parent.get(cursor)!;
    parent.set(cursor, root);
    cursor = next;
  }
  return root;
}

export function cellName(row: number, column: number): SchematicCell {
  return `${row},${column}`;
}

/** Merge wires, then stamp every resistor and source for the DC solver. */
export function schematicToDC(parts: readonly SchematicPart[], ground: SchematicCell | null): SchematicNetlist {
  if (!ground) throw new Error('Mark one grid point as ground before solving.');
  if (!parts.length) throw new Error('Place at least one part.');
  const parent = new Map<string, string>();
  for (const part of parts) {
    if (part.a === part.b) throw new Error(`${part.id} starts and ends on the same grid point.`);
    findRoot(parent, part.a);
    findRoot(parent, part.b);
    if (part.kind === 'wire') {
      const left = findRoot(parent, part.a);
      const right = findRoot(parent, part.b);
      if (left !== right) parent.set(left, right);
    }
  }
  findRoot(parent, ground);
  const idOfRoot = new Map<string, number>([[findRoot(parent, ground), 0]]);
  const nodeOf: Record<string, number> = {};
  for (const cell of parent.keys()) {
    const root = findRoot(parent, cell);
    if (!idOfRoot.has(root)) idOfRoot.set(root, idOfRoot.size);
    nodeOf[cell] = idOfRoot.get(root)!;
  }
  const components: DCComponent[] = [];
  for (const part of parts) {
    if (part.kind === 'wire') continue;
    const nodeA = nodeOf[part.a];
    const nodeB = nodeOf[part.b];
    if (nodeA === undefined || nodeB === undefined) throw new Error(`${part.id} is not connected.`);
    if (nodeA === nodeB) throw new Error(`${part.id} is shorted. Remove the wire across it.`);
    if (!Number.isFinite(part.value)) throw new Error(`${part.id} needs a finite value.`);
    if (part.kind === 'resistor' && !(part.value > 0)) throw new Error(`${part.id} needs a positive resistance.`);
    components.push({ type: part.kind, value: part.value, nodeA, nodeB });
  }
  if (!components.length) throw new Error('Add a resistor or a source. Wires alone have no solution.');
  if (!Object.values(nodeOf).includes(0)) throw new Error('Ground is not on the drawing.');
  return { components, nodeOf };
}

export const DIVIDER_EXAMPLE: { parts: SchematicPart[]; ground: SchematicCell } = {
  ground: '2,0',
  parts: [
    { id: 'Vs', kind: 'voltage_source', a: '0,0', b: '2,0', value: 12 },
    { id: 'R1', kind: 'resistor', a: '0,0', b: '0,2', value: 1000 },
    { id: 'R2', kind: 'resistor', a: '0,2', b: '2,2', value: 2000 },
    { id: 'W1', kind: 'wire', a: '2,2', b: '2,0', value: 0 },
  ],
};
