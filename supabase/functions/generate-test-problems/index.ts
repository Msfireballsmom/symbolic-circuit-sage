import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { category } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a professor of electrical engineering at MIT. Generate a realistic circuit analysis problem that would appear on a university exam or homework assignment.

CRITICAL: You MUST call the generate_problem tool. Do NOT respond with plain text.

Requirements:
- The problem must be solvable with standard circuit analysis techniques
- Include specific numerical values (realistic component values)
- The problem must have a unique, deterministic solution
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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      const content = data.choices?.[0]?.message?.content;
      return new Response(JSON.stringify({ error: "AI did not return structured data", rawContent: content }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const problem = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(problem), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-test-problems error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
