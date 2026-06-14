const VAPI_BASE_URL = "https://api.vapi.ai";

function getApiKey(): string {
  const key = process.env.VAPI_API_KEY;
  if (!key) throw new Error("VAPI_API_KEY environment variable is not set");
  return key;
}

async function vapiRequest(path: string, options: RequestInit = {}) {
  const response = await fetch(`${VAPI_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[VAPI] Error ${response.status} on ${path}:`, errorBody);
    throw new Error(`Vapi API error: ${response.status} - ${errorBody}`);
  }

  return response.json();
}

// --- Phone Number Management ---

export async function importTwilioNumber(
  twilioAccountSid: string,
  twilioAuthToken: string,
  phoneNumber: string
): Promise<string> {
  const result = await vapiRequest("/phone-number", {
    method: "POST",
    body: JSON.stringify({
      provider: "twilio",
      number: phoneNumber,
      twilioAccountSid,
      twilioAuthToken,
    }),
  });
  return result.id;
}

export async function deletePhoneNumber(phoneNumberId: string): Promise<void> {
  await vapiRequest(`/phone-number/${phoneNumberId}`, { method: "DELETE" });
}

// --- Assistant Management ---

interface AssistantConfig {
  storeName: string;
  discountType: string;
  discountValue: number;
  serverUrl: string;
}

export async function createRecoveryAssistant(
  config: AssistantConfig
): Promise<string> {
  const systemPrompt = buildSystemPrompt(config);

  const result = await vapiRequest("/assistant", {
    method: "POST",
    body: JSON.stringify({
      name: `CartCall Recovery - ${config.storeName}`,
      model: {
        provider: "openai",
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
        ],
      },
      voice: {
        provider: "11labs",
        voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel - friendly, professional
      },
      transcriber: {
        provider: "deepgram",
        model: "nova-2",
        language: "en",
      },
      firstMessage:
        "Hi! This is a quick call from {{storeName}}. I noticed you were browsing our store earlier and had some items in your cart. I just wanted to check in and see if there was anything I could help with?",
      endCallMessage: "Thank you so much for your time! Have a wonderful day. Goodbye!",
      serverUrl: config.serverUrl,
      maxDurationSeconds: 180,
      silenceTimeoutSeconds: 30,
      endCallPhrases: ["goodbye", "bye", "end call", "hang up", "not interested"],
      analysisPlan: {
        summaryPrompt:
          "Summarize the call in 2-3 sentences. Include the customer's reason for abandoning the cart and whether they showed interest in completing the purchase.",
        structuredDataPrompt:
          "Extract the following from the conversation.",
        structuredDataSchema: {
          type: "object",
          properties: {
            callOutcome: {
              type: "string",
              enum: [
                "interested",
                "not_interested",
                "callback_requested",
                "wrong_number",
                "objection",
                "voicemail",
              ],
              description: "The outcome of the call",
            },
            abandonReason: {
              type: "string",
              description:
                "The customer's stated reason for abandoning their cart (e.g., price too high, shipping costs, just browsing, found elsewhere, technical issue)",
            },
            discountOffered: {
              type: "boolean",
              description: "Whether a discount code was offered during the call",
            },
            customerSentiment: {
              type: "string",
              enum: ["positive", "neutral", "negative"],
              description: "Overall customer sentiment during the call",
            },
          },
        },
      },
      tools: [
        {
          type: "function",
          function: {
            name: "create_discount",
            description:
              "Create a personalized discount code for the customer. Use this when the customer expresses interest but has concerns about price or wants an incentive to complete their purchase.",
            parameters: {
              type: "object",
              properties: {
                reason: {
                  type: "string",
                  description: "The reason for offering the discount",
                },
              },
              required: ["reason"],
            },
          },
          server: {
            url: config.serverUrl,
          },
        },
      ],
    }),
  });

  return result.id;
}

export async function updateAssistant(
  assistantId: string,
  config: AssistantConfig
): Promise<void> {
  const systemPrompt = buildSystemPrompt(config);

  await vapiRequest(`/assistant/${assistantId}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: `CartCall Recovery - ${config.storeName}`,
      model: {
        provider: "openai",
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
        ],
      },
      serverUrl: config.serverUrl,
      tools: [
        {
          type: "function",
          function: {
            name: "create_discount",
            description:
              "Create a personalized discount code for the customer. Use this when the customer expresses interest but has concerns about price or wants an incentive to complete their purchase.",
            parameters: {
              type: "object",
              properties: {
                reason: {
                  type: "string",
                  description: "The reason for offering the discount",
                },
              },
              required: ["reason"],
            },
          },
          server: {
            url: config.serverUrl,
          },
        },
      ],
    }),
  });
}

export async function deleteAssistant(assistantId: string): Promise<void> {
  await vapiRequest(`/assistant/${assistantId}`, { method: "DELETE" });
}

// --- Call Management ---

interface OutboundCallConfig {
  assistantId: string;
  phoneNumberId: string;
  customerPhone: string;
  metadata: {
    shop: string;
    checkoutId: string;
    customerName: string;
    storeName: string;
    cartItems: string;
    cartTotal: string;
    cartCurrency: string;
  };
}

export async function makeOutboundCall(
  config: OutboundCallConfig
): Promise<string> {
  const result = await vapiRequest("/call/phone", {
    method: "POST",
    body: JSON.stringify({
      assistantId: config.assistantId,
      phoneNumberId: config.phoneNumberId,
      customer: {
        number: config.customerPhone,
      },
      assistantOverrides: {
        variableValues: {
          storeName: config.metadata.storeName,
          customerName: config.metadata.customerName,
          cartItems: config.metadata.cartItems,
          cartTotal: config.metadata.cartTotal,
          cartCurrency: config.metadata.cartCurrency,
        },
        metadata: config.metadata,
      },
    }),
  });

  return result.id;
}

export async function getCallDetails(callId: string) {
  return vapiRequest(`/call/${callId}`);
}

// --- Prompt Builder ---

function buildSystemPrompt(config: AssistantConfig): string {
  const discountDescription =
    config.discountType === "percentage"
      ? `${config.discountValue}% off`
      : `$${config.discountValue} off`;

  return `[Identity]
You are a friendly customer experience representative calling on behalf of {{storeName}}. Your name is Sarah.

[Style]
- Be warm, conversational, and empathetic
- Keep responses brief and natural (this is a phone call, not an essay)
- Never be pushy or aggressive — if the customer isn't interested, respect that
- Use natural speech patterns with occasional filler words
- Sound genuinely helpful, not scripted

[Context]
The customer had items in their shopping cart but didn't complete the purchase.
Cart items: {{cartItems}}
Cart total: {{cartTotal}} {{cartCurrency}}

[Goals]
1. Politely ask if they had any trouble during checkout
2. Listen to their reason for not completing the purchase
3. Address their concern if possible
4. If they mention price concerns or hesitation, offer them a discount using the create_discount tool
5. Thank them regardless of the outcome

[Discount Policy]
You can offer ${discountDescription} using the create_discount tool.
- Only offer a discount if the customer mentions price, cost, budget, or shows hesitation
- Do NOT offer the discount immediately — first understand their concern
- When you create a discount, tell them the code and that they can use it at checkout
- Only offer the discount once per call

[Rules]
- Never mention you are an AI or automated system
- If asked if you're a robot/AI, say you're calling from the customer support team
- Maximum call duration: 3 minutes
- If the customer asks to be removed from the call list, apologize and end the call
- Never ask for payment information or personal details
- If the customer is upset, apologize sincerely and offer to not call again`;
}
