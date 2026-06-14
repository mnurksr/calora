import type { ActionFunctionArgs } from "react-router";
import db from "../db.server";
import { unauthenticated } from "../shopify.server";
import { createDiscountCode } from "../services/discount.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload = await request.json();
    const { message } = payload;

    if (!message || !message.type) {
      return new Response("Invalid payload", { status: 400 });
    }

    console.log(`[VAPI WEBHOOK] Received type: ${message.type}`);

    // Handle tool calls (e.g., create_discount)
    if (message.type === "tool-calls") {
      return handleToolCalls(message.toolWithToolCallList);
    }

    // Handle end of call report
    if (message.type === "end-of-call-report") {
      await handleEndOfCallReport(message);
      return new Response("OK", { status: 200 });
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("[VAPI WEBHOOK] Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
};

async function handleToolCalls(toolCallList: any[]) {
  const results = [];

  for (const call of toolCallList) {
    const { tool, toolCall } = call;
    
    if (tool.function.name === "create_discount") {
      try {
        // Find the checkout based on metadata (we passed this during call creation)
        const callId = toolCall.callId; // Assuming Vapi sends this, or we get it from context
        
        // Find the active call log
        const callLog = await db.callLog.findUnique({
          where: { vapiCallId: callId },
          include: {
            abandonedCheckout: true
          }
        });

        if (!callLog) {
          throw new Error("Call log not found");
        }

        const shop = callLog.shop;
        const settings = await db.shopSettings.findUnique({ where: { shop } });
        
        if (!settings) {
          throw new Error("Shop settings not found");
        }

        const { admin } = await unauthenticated.admin(shop);

        // Create the discount in Shopify
        const { code } = await createDiscountCode({
          admin,
          type: settings.discountType as any,
          value: settings.discountValue,
        });

        // Update the call log with the discount offered
        await db.callLog.update({
          where: { id: callLog.id },
          data: {
            discountCode: code,
            discountType: settings.discountType,
            discountValue: settings.discountValue,
          }
        });

        results.push({
          toolCallId: toolCall.id,
          result: `Discount created successfully. The code is ${code}. Tell the customer they can enter this code at checkout to receive their discount.`,
        });

        console.log(`[VAPI TOOL] Created discount ${code} for call ${callId}`);
      } catch (error) {
        console.error("[VAPI TOOL] Error creating discount:", error);
        results.push({
          toolCallId: toolCall.id,
          result: "Failed to create discount. Please apologize to the customer and tell them we will email them a code later.",
        });
      }
    } else {
      results.push({
        toolCallId: toolCall.id,
        result: "Unknown tool",
      });
    }
  }

  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function handleEndOfCallReport(message: any) {
  const { call, endedReason, transcript, recordingUrl, analysis } = message;
  const callId = call.id;

  try {
    const callLog = await db.callLog.findUnique({
      where: { vapiCallId: callId },
    });

    if (!callLog) {
      console.warn(`[VAPI WEBHOOK] Call log not found for Vapi ID: ${callId}`);
      return;
    }

    // Map Vapi end reasons to our status
    let status = "completed";
    if (endedReason === "customer-did-not-answer" || endedReason === "voicemail") {
      status = "no-answer";
    } else if (endedReason === "assistant-error" || endedReason === "silence-timed-out") {
      status = "failed";
    }

    // Extract structured data from analysis
    const structuredData = analysis?.structuredData || {};
    
    await db.callLog.update({
      where: { id: callLog.id },
      data: {
        status,
        duration: call.durationSeconds || 0,
        transcript: transcript || "",
        recordingUrl: recordingUrl || "",
        callOutcome: structuredData.callOutcome || null,
        abandonReason: structuredData.abandonReason || null,
      },
    });

    // Update the parent checkout record
    await db.abandonedCheckout.update({
      where: { id: callLog.abandonedCheckoutId },
      data: {
        status: status === "completed" ? "called" : status,
      },
    });

    console.log(`[VAPI WEBHOOK] Processed end-of-call for ${callId}. Status: ${status}`);
  } catch (error) {
    console.error(`[VAPI WEBHOOK] Error handling end-of-call for ${callId}:`, error);
  }
}
