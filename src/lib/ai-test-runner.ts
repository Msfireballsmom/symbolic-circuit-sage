// AI-Generated Novel Problem Test Runner
// Generates fresh circuit problems via AI, solves with deterministic engine, verifies with physics

import { supabase } from "@/integrations/supabase/client";
import {
  solveOhmsLaw, solveSeriesParallel, solveVoltageDivider,
  solveCurrentDivider, solveThevenin, solvePower, solveDC,
  solveTransient, solveAC, solveRLC,
} from './circuit-solver';
import { solveMesh } from './mesh-solver';
import { solveLaplace } from './laplace-solver';
import { solveFourier } from './fourier-solver';
import { solveOpAmp } from './advanced-solvers';

export interface AITestResult {
  id: string;
  title: string;
  category: string;
  sourceStyle: string;
  problemDescription: string;
  difficulty: string;
  status: 'pass' | 'fail' | 'error' | 'running' | 'pending';
  solverOutput: string;
  expectedAnswers: { label: string; value: number; unit: string }[];
  actualAnswers: { label: string; value: number }[];
  verificationMethod: string;
  steps?: string[];
  error?: string;
  durationMs: number;
}

export interface AITestReport {
  results: AITestResult[];
  totalTests: number;
  passed: number;
  failed: number;
  errors: number;
  overallScore: string;
  durationMs: number;
  timestamp: string;
}

const AI_TEST_CATEGORIES = [
  'dc_nodal',
  'mesh',
  'ac_phasor',
  'rc_transient',
  'opamp',
  'laplace',
  'thevenin',
  'fourier',
  'rlc_transient',
  'power',
];

function approx(actual: number, expected: number, tolerance = 0.05): boolean {
  if (Math.abs(expected) < 1e-10) return Math.abs(actual) < tolerance;
  return Math.abs((actual - expected) / expected) < tolerance;
}

async function fetchAIProblem(category: string): Promise<any> {
  const { data, error } = await supabase.functions.invoke('generate-test-problems', {
    body: { category },
  });
  if (error) throw new Error(`Failed to generate problem: ${error.message}`);
  if (data?.error) throw new Error(data.error);
  return data;
}

function solveProblem(problem: any): { results: { label: string; value: number }[]; steps: string[]; verified: boolean; verificationMethod: string } {
  const method = problem.analysis_method;
  const params = problem.parameters || {};
  const components = problem.components || [];

  if (method !== 'dc_nodal' && method !== 'mesh') throw new Error(`Unsupported/unverified generated domain: ${method}. No default values or topology will be invented.`);
  if (!components.length || components.some((c: any) => !['resistor', 'voltage_source', 'current_source'].includes(c.type) || !Number.isFinite(c.value))) throw new Error('Missing or unsupported generated circuit data.');
  if (method === 'dc_nodal') {
    const r = solveDC(components);
    return { results: r.nodeVoltages.map(nv => ({ label: `V${nv.node}`, value: nv.voltage })), steps: r.steps, verified: r.powerBalance.balanced && r.residuals.every(check => check.pass), verificationMethod: 'Independent branch tableau + MNA, KCL and power residuals' };
  }
  if (!Number.isInteger(params.numMeshes) || components.some((c: any) => !Array.isArray(c.meshes))) throw new Error('Missing explicit mesh count/membership.');
  const r = solveMesh(params.numMeshes, components);
  return { results: r.meshCurrents.map(mc => ({ label: `i${mc.mesh}`, value: mc.current })), steps: r.steps, verified: false, verificationMethod: 'KVL/power checked; generated mesh has no independent runtime reference — unverified' };
}

export async function runAITests(
  onProgress: (result: AITestResult) => void,
  categories?: string[],
): Promise<AITestReport> {
  const cats = categories || ['dc_nodal', 'mesh'];
  const results: AITestResult[] = [];
  const startTime = performance.now();

  for (let i = 0; i < cats.length; i++) {
    const category = cats[i];
    const testId = `ai_${category}_${Date.now()}`;

    // Signal running
    onProgress({
      id: testId, title: `Generating ${category} problem...`, category,
      sourceStyle: '', problemDescription: '', difficulty: '',
      status: 'running', solverOutput: '', expectedAnswers: [], actualAnswers: [],
      verificationMethod: '', durationMs: 0,
    });

    await new Promise(r => setTimeout(r, 100));

    const t0 = performance.now();
    let result: AITestResult;

    try {
      // Step 1: Generate problem via AI
      const problem = await fetchAIProblem(category);

      // Step 2: Solve with deterministic engine
      const solution = solveProblem(problem);

      // Step 3: Compare with AI's expected answers
      let allMatch = solution.verified && Array.isArray(problem.expected_answers) && problem.expected_answers.length > 0;
      const matchDetails: string[] = [];

      if (problem.expected_answers && solution.results.length > 0) {
        for (const expected of problem.expected_answers) {
          const actual = solution.results.find(r =>
            r.label === expected.label
          );
          if (actual) {
            const match = Number.isFinite(expected.value) && expected.unit === (problem.analysis_method === 'mesh' ? 'A' : 'V') && Math.abs(actual.value - expected.value) <= 1e-8 * Math.max(1e-12, Math.abs(expected.value), Math.abs(actual.value));
            allMatch = allMatch && match;
            matchDetails.push(`${expected.label}: expected=${expected.value}${expected.unit}, got=${actual.value.toFixed(6)} → ${match ? '✓' : '✗'}`);
          } else { allMatch = false; matchDetails.push(`Unmatched AI answer: ${expected.label}.`); }
        }
      }

      result = {
        id: testId,
        title: problem.title || `${category} Problem`,
        category,
        sourceStyle: problem.source_style || 'AI-Generated',
        problemDescription: problem.description || '',
        difficulty: problem.difficulty || 'medium',
        status: allMatch ? 'pass' : 'fail',
        solverOutput: allMatch ? matchDetails.join('\n') : 'Unverified: AI answers missing, unmatched or disagreeing, or independent verification absent. Final output withheld.',
        expectedAnswers: problem.expected_answers || [],
        actualAnswers: allMatch ? solution.results : [],
        verificationMethod: solution.verificationMethod,
        steps: allMatch ? solution.steps : [],
        durationMs: performance.now() - t0,
      };
    } catch (e: any) {
      result = {
        id: testId,
        title: `${category} Problem`,
        category,
        sourceStyle: 'AI-Generated',
        problemDescription: '',
        difficulty: '',
        status: 'error',
        solverOutput: '',
        expectedAnswers: [],
        actualAnswers: [],
        verificationMethod: '',
        error: e.message || String(e),
        durationMs: performance.now() - t0,
      };
    }

    results.push(result);
    onProgress(result);
    if (result.status === 'error') break; // Do not continue spending after authentication, policy or generation failure.
  }

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const errors = results.filter(r => r.status === 'error').length;

  return {
    results,
    totalTests: results.length,
    passed,
    failed,
    errors,
    overallScore: `${passed}/${results.length}`,
    durationMs: performance.now() - startTime,
    timestamp: new Date().toISOString(),
  };
}
