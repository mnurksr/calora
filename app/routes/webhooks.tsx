import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, admin, payload } = await authenticate.webhook(request);

  if (!admin) {
    // The admin context isn't returned if the webhook fired after a shop was uninstalled.
    throw new Response();
  }

  console.log(`[WEBHOOK] Received ${topic} for ${shop}`);

  switch (topic) {
    case "APP_UNINSTALLED":
      if (session) {
        await db.session.deleteMany({ where: { shop } });
      }
      
      // Deactivate shop settings
      await db.shopSettings.update({
        where: { shop },
        data: { isActive: false },
      });
      break;

    case "CUSTOMERS_DATA_REQUEST":
    case "CUSTOMERS_REDACT":
    case "SHOP_REDACT":
      // Handle GDPR requests (required by Shopify)
      // For MVP, we just acknowledge. In production, delete data based on payload.
      break;

    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  throw new Response();
};
