import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { authorize, readBody, gatewayFetch, requireGatewayOK, errorResponse, corsHeaders, z, RequestError } from '../_shared/ai-safety.ts';
import { extraction } from '../_shared/extraction-schema.ts';

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await authorize(req, 'extract');
    const body = z.object({ imageBase64: z.string().max(7000000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/).optional(), textPrompt: z.string().min(1).max(20000).optional() }).refine(v => v.imageBase64 || v.textPrompt).safeParse(await readBody(req, 7500000));
    if (!body.success) throw new RequestError(400, 'Provide a supported image or text prompt within size limits.');
    const { imageBase64, textPrompt } = body.data;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new RequestError(503, "AI service is not configured");

    const systemPrompt = `You are an expert circuit analysis engineer. Your job is to extract a complete, structured netlist from circuit problems — whether they come as images (schematics, hand-drawn circuits, textbook screenshots, Multisim screenshots) or text descriptions.

IMPORTANT: You MUST respond by calling the extract_circuit tool. Do NOT respond with plain text.

Extract ALL of the following:
1. Every component: resistors, capacitors, inductors, voltage sources, current sources, op-amps, diodes, transistors (BJT/MOSFET), dependent sources, transformers
2. Node connections for each component (nodeA, nodeB, and for transistors: collector/base/emitter or drain/gate/source)
3. Component values with proper units
4. The analysis method required (nodal, mesh, transient, AC phasor, op-amp, etc.)
5. Initial conditions if specified (v(0), i(0))
6. What the problem asks to find
7. Circuit topology (series, parallel, mixed)
8. Any dependent source relationships (e.g., "Vx = 3*I1")

For op-amps: identify the configuration (inverting, non-inverting, summing, differential, integrator, differentiator).
For diodes: note if ideal or specify the model (forward voltage drop, etc.).
For transistors: note type (NPN/PNP or NMOS/PMOS) and operating region if specified.
For dependent sources: specify the controlling variable and gain.`;

    const userContent: any[] = [];
    
    if (imageBase64) {
      userContent.push({
        type: "image_url",
        image_url: { url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/png;base64,${imageBase64}` }
      });
      userContent.push({
        type: "text",
        text: textPrompt || "Extract all circuit components, connections, and analysis requirements from this circuit diagram. Be thorough — identify every component, node, and connection."
      });
    } else if (textPrompt) {
      userContent.push({ type: "text", text: textPrompt });
    } else {
      throw new Error("Provide imageBase64 or textPrompt");
    }

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
          { role: "user", content: userContent },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_circuit",
            description: "Extract structured circuit data from an image or text description",
            parameters: {
              type: "object",
              properties: {
                components: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["resistor", "capacitor", "inductor", "voltage_source", "current_source", "opamp", "diode", "bjt", "mosfet", "dependent_voltage_source", "dependent_current_source", "transformer", "switch"] },
                      label: { type: "string", description: "Component label e.g. R1, C1, Q1, U1" },
                      value: { type: "number", description: "Value in base SI units (Ω, F, H, V, A)" },
                      valueString: { type: "string", description: "Original value string e.g. '4.7kΩ'" },
                      nodeA: { type: "number", description: "Positive terminal node (0=ground)" },
                      nodeB: { type: "number", description: "Negative terminal node (0=ground)" },
                      nodeC: { type: "number", description: "Third terminal (collector/drain) for transistors" },
                      config: { type: "string", description: "For op-amps: inverting/non-inverting/summing/differential/integrator/differentiator. For diodes: forward/reverse/ideal. For BJT: npn/pnp. For MOSFET: nmos/pmos." },
                      dependentOn: { type: "string", description: "For dependent sources: controlling variable e.g. 'V1' or 'I_R2'" },
                      gain: { type: "number", description: "For dependent sources: gain factor" },
                      meshes: { type: "array", items: { type: "number" }, description: "Which mesh(es) this component belongs to" },
                    },
                    required: ["type", "label", "value", "nodeA", "nodeB"],
                    additionalProperties: false,
                  },
                },
                analysisMethod: { type: "string", enum: ["ohms_law", "voltage_divider", "current_divider", "series_parallel", "thevenin", "norton", "dc_nodal", "mesh", "transient", "rlc", "ac_phasor", "opamp", "superposition", "dependent_source", "diode_analysis", "bjt_analysis", "mosfet_analysis", "two_port", "unknown"] },
                topology: { type: "string", enum: ["series", "parallel", "mixed", "bridge", "ladder", "feedback"] },
                frequency: { type: "number", description: "Frequency in Hz for AC analysis" },
                phase: { type: "number", description: "Source phase in degrees" },
                initialVoltage: { type: "number", description: "v_C(0) or initial voltage" },
                initialCurrent: { type: "number", description: "i_L(0) or initial current" },
                findWhat: { type: "array", items: { type: "string" }, description: "What the problem asks to find" },
                problemDescription: { type: "string", description: "Brief description of the circuit problem" },
                numNodes: { type: "number", description: "Total number of unique nodes" },
                numMeshes: { type: "number", description: "Total number of meshes/loops" },
                confidence: { type: "number", description: "Confidence 0-1 in the extraction accuracy" },
                warnings: { type: "array", items: { type: "string" }, description: "Any ambiguities or issues found" },
              },
              required: ["components", "analysisMethod", "findWhat", "confidence"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_circuit" } },
      }),
    });

    await requireGatewayOK(response);

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) throw new RequestError(422, 'AI did not return structured data; no answer available.');
    const parsed = extraction.safeParse(JSON.parse(toolCall.function.arguments));
    if (!parsed.success) throw new RequestError(502, 'AI returned incomplete or invalid circuit data. Review the original and enter the circuit manually.');
    const extracted = parsed.data;

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return errorResponse(e);
  }
});
