import { z } from 'zod';
export const ExtractionSchema = z.object({
  components: z.array(z.object({
    type: z.enum(['resistor', 'capacitor', 'inductor', 'voltage_source', 'current_source', 'opamp', 'diode', 'bjt', 'mosfet', 'dependent_voltage_source', 'dependent_current_source', 'transformer', 'switch']),
    label: z.string().min(1).max(80), value: z.number().finite(),
    nodeA: z.number().int().min(0).max(10000), nodeB: z.number().int().min(0).max(10000),
    gain: z.number().finite().optional(), dependentOn: z.string().optional(),
    config: z.string().optional(), meshes: z.array(z.number().int()).optional(),
  })).min(1).max(100),
  analysisMethod: z.enum(['ohms_law', 'voltage_divider', 'current_divider', 'series_parallel', 'thevenin', 'power', 'dc_nodal', 'mesh', 'transient', 'rlc', 'ac_phasor', 'opamp', 'superposition', 'dependent_source', 'diode_analysis', 'bjt_analysis', 'mosfet_analysis', 'two_port', 'unknown']),
  topology: z.enum(['series', 'parallel', 'mixed', 'bridge', 'ladder', 'feedback']).optional(),
  frequency: z.number().finite().positive().optional(), phase: z.number().finite().optional(),
  initialVoltage: z.number().finite().optional(), initialCurrent: z.number().finite().optional(),
  findWhat: z.array(z.string()).min(1).max(30), confidence: z.number().min(0).max(1),
  problemDescription: z.string().max(20000).optional(), warnings: z.array(z.string()).default([]),
}).superRefine((value, ctx) => {
  const labels = value.components.map(c => c.label);
  if (new Set(labels).size !== labels.length) ctx.addIssue({ code: 'custom', message: 'Duplicate component labels.' });
});