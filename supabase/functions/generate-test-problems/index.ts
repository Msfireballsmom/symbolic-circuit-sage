import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { authorize, readBody, gatewayFetch, requireGatewayOK, errorResponse, corsHeaders, z, RequestError } from '../_shared/ai-safety.ts';

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await authorize(req, 'generate');
    const body = z.object({ category: z.enum(['dc_nodal', 'mesh']) }).safeParse(await readBody(req, 2000));
    if (!body.success) throw new RequestError(400, 'Only DC nodal and explicit resistor/voltage-source mesh generation are supported; other domains are unverified.');
    const { category } = body.data;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new RequestError(503, "AI service is not configured");

    const systemPrompt = `Generate original synthetic circuit exercises; never claim a university, course, textbook or answer-key source. Generate a realistic circuit analysis problem that would appear on a university exam or homework assignment.

CRITICAL: You MUST call the generate_problem tool. Do NOT respond with plain text.

Requirements:
- The problem must be solvable with standard circuit analysis techniques
- Include specific numerical values (realistic component values)
- The problem must have a unique, deterministic solution. For mesh use only resistors and voltage sources, explicit numMeshes and memberships. Expected DC labels must be V1, V2 etc in V; mesh labels i1, i2 etc in A. Expected answers are untrusted draft checks, not certification.
- Provide the complete structured netlist so a solver can compute the answer
- Also provide the correct answer so it can be verified
- Make the problem challenging but solvable (sophomore/junior level)
- Use realistic component values (e.g., resistors in Ω-MΩ range, capacitors in pF-mF, inductors in μH-H)`;

    const categoryPrompts: Record<string, string> = {
      dc_nodal: "Generate a DC nodal analysis problem with 3-4 nodes, at least 2 voltage sources and 4-6 resistors. The problem should require solving a system of equations using KCL at each node.",
      mesh: "Generate a mesh analysis problem with 2-3 meshes, voltage sources, and shared resistors between meshes. The problem should require KVL around each mesh.",
      ac_phasor: "Generate an AC phasor analysis problem with a sinusoidal source, resistors, inductors, and/or capacitors in series or parallel. Include frequency. Ask for impedance, current magnitude, power factor, or real/reactive power.",
      rlc_transient: "Generate a second-order RLC transient analysis problem (series or parallel). Include initial conditions. Ask for the damping type, natural frequency, or the response at a specific time.",
      rc_transient: "Generate a first-order RC or RL transient problem with a step input. Include initial conditions. Ask for the time constant and the response at a specific time.",
      opamp: "Generate an op-amp circuit problem (inverting, non-inverting, summing, or differential amplifier). Include specific resistor values and input voltage. Ask for output voltage and gain.",
      laplace: "Generate a Laplace transform / transfer function problem. Provide numerator and denominator polynomial coefficients. Ask for poles, zeros, stability, DC gain, or step response characteristics.",
      thevenin: "Generate a Thévenin/Norton equivalent problem. Include a circuit with sources and resistors. Ask for V_th, R_th, and I_N.",
      power: "Generate a power analysis problem. Include voltage, current, and/or resistance values. Ask for real power, apparent power, reactive power, or power factor.",
      fourier: "Generate a Fourier series problem for a periodic waveform (square, triangle, sawtooth, or pulse). Ask for specific harmonic coefficients, DC component, or THD.",
    };

    const userPrompt = categoryPrompts[category] || categoryPrompts.dc_nodal;

    const response = await gatewayFetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_problem",
            description: "Generate a structured circuit problem with solution",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Short title for the problem" },
                description: { type: "string", description: "Full problem statement as it would appear on an exam" },
                difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                category: { type: "string" },
                source_style: { type: "string", description: "What kind of source this resembles, e.g. 'MIT 6.002 Exam 2', 'Stanford EE101 HW3'" },
                components: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["resistor", "capacitor", "inductor", "voltage_source", "current_source", "opamp", "diode"] },
                      label: { type: "string" },
                      value: { type: "number", description: "Value in base SI units" },
                      nodeA: { type: "number" },
                      nodeB: { type: "number" },
                      meshes: { type: "array", items: { type: "number" } },
                    },
                    required: ["type", "label", "value", "nodeA", "nodeB"],
                    additionalProperties: false,
                  },
                },
                analysis_method: { type: "string", enum: ["dc_nodal", "mesh", "ac_phasor", "transient_rc", "transient_rl", "rlc", "opamp_inverting", "opamp_noninverting", "opamp_summing", "laplace", "thevenin", "power", "fourier", "voltage_divider", "current_divider"] },
                parameters: {
                  type: "object",
                  description: "Additional parameters needed for solving",
                  properties: {
                    frequency: { type: "number" },
                    phase: { type: "number" },
                    Vm: { type: "number" },
                    initialVoltage: { type: "number" },
                    initialCurrent: { type: "number" },
                    tFinal: { type: "number" },
                    Vs: { type: "number" },
                    topology: { type: "string", enum: ["series", "parallel"] },
                    numMeshes: { type: "number" },
                    numerator: { type: "array", items: { type: "number" } },
                    denominator: { type: "array", items: { type: "number" } },
                    inputType: { type: "string", enum: ["step", "impulse"] },
                    waveform: { type: "string", enum: ["square", "triangle", "sawtooth"] },
                    amplitude: { type: "number" },
                    period: { type: "number" },
                    numHarmonics: { type: "number" },
                    Rf: { type: "number" },
                    Rin: { type: "number" },
                    Vin: { type: "number" },
                    R: { type: "number" },
                    L: { type: "number" },
                    C: { type: "number" },
                  },
                  additionalProperties: false,
                },
                expected_answers: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      label: { type: "string", description: "What this answer is for, e.g. 'V2', 'I_R3', 'tau'" },
                      value: { type: "number" },
                      unit: { type: "string" },
                    },
                    required: ["label", "value", "unit"],
                    additionalProperties: false,
                  },
                },
                solution_steps: {
                  type: "array",
                  items: { type: "string" },
                  description: "Step-by-step solution explanation",
                },
              },
              required: ["title", "description", "difficulty", "category", "source_style", "components", "analysis_method", "expected_answers", "solution_steps"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_problem" } },
      }),
    });

    await requireGatewayOK(response);

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) throw new RequestError(422, 'AI did not return structured data; no answer available.');
    const schema = z.object({ title: z.string().min(1).max(200), description: z.string().min(1).max(20000), difficulty: z.enum(['easy','medium','hard']), category: z.string().max(100), source_style: z.string().max(200), components: z.array(z.object({ type: z.enum(['resistor','voltage_source','current_source']), label: z.string().min(1).max(80), value: z.number().finite(), nodeA: z.number().int().min(0).max(10000), nodeB: z.number().int().min(0).max(10000), meshes: z.array(z.number().int().min(1).max(20)).optional() })).min(1).max(100), analysis_method: z.enum(['dc_nodal','mesh']), parameters: z.object({ numMeshes: z.number().int().min(1).max(20).optional() }).optional(), expected_answers: z.array(z.object({ label: z.string().min(1).max(80), value: z.number().finite(), unit: z.enum(['V','A']) })).min(1).max(100), solution_steps: z.array(z.string().max(2000)).max(100) });
    const parsed = schema.safeParse(JSON.parse(toolCall.function.arguments));
    if (!parsed.success) throw new RequestError(502, 'Generated problem is incomplete or outside supported scope.');
    const problem = { ...parsed.data, source_style: 'Original AI-generated draft — not textbook provenance', solution_steps: [] };


    return new Response(JSON.stringify(problem), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return errorResponse(e);
  }
});
