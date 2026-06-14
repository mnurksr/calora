import db from "../db.server";
import { unauthenticated } from "../shopify.server";
import { makeOutboundCall } from "./vapi.server";
import { decrypt } from "./encryption.server";

interface ProcessResult {
  shop: string;
  checkoutsFound: number;
  callsInitiated: number;
  errors: string[];
}

// Fetch abandoned checkouts from Shopify via GraphQL
async function fetchAbandonedCheckouts(
  admin: any,
  sinceMinutes: number
) {
  const since = new Date(Date.now() - sinceMinutes * 60 * 1000);

  const response = await admin.graphql(
    `#graphql
      query AbandonedCheckouts($query: String) {
        abandonedCheckouts(first: 50, query: $query, sortKey: CREATED_AT, reverse: true) {
          nodes {
            id
            createdAt
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            customer {
              firstName
              lastName
              email
              phone
            }
            lineItems(first: 10) {
              nodes {
                title
                quantity
                variant {
                  price
                  image {
                    url
                  }
                }
              }
            }
            abandonedCheckoutUrl
          }
        }
      }
    `,
    {
      variables: {
        query: `created_at:>='${since.toISOString()}'`,
      },
    }
  );

  const data = await response.json();
  return data.data?.abandonedCheckouts?.nodes || [];
}

// Process a single shop's abandoned checkouts
async function processShop(shop: string): Promise<ProcessResult> {
  const result: ProcessResult = {
    shop,
    checkoutsFound: 0,
    callsInitiated: 0,
    errors: [],
  };

  try {
    const settings = await db.shopSettings.findUnique({ where: { shop } });
    if (!settings || !settings.isActive || !settings.vapiAssistantId || !settings.vapiPhoneNumberId) {
      return result;
    }

    // Get admin API client using offline session
    const { admin } = await unauthenticated.admin(shop);

    // Fetch recent abandoned checkouts (look back 24 hours max)
    const lookbackMinutes = Math.max(settings.callDelayMinutes, 60) * 24;
    const checkouts = await fetchAbandonedCheckouts(admin, lookbackMinutes);
    result.checkoutsFound = checkouts.length;

    for (const checkout of checkouts) {
      try {
        const shopifyId = checkout.id;
        const phone = checkout.customer?.phone;
        const total = parseFloat(checkout.totalPriceSet?.shopMoney?.amount || "0");
        const currency = checkout.totalPriceSet?.shopMoney?.currencyCode || "USD";
        const createdAt = new Date(checkout.createdAt);
        const minutesSinceAbandoned = (Date.now() - createdAt.getTime()) / (1000 * 60);

        // Skip if no phone number
        if (!phone) continue;

        // Skip if too recent (hasn't exceeded delay)
        if (minutesSinceAbandoned < settings.callDelayMinutes) continue;

        // Skip if below minimum cart value
        if (total < settings.minCartValue) continue;

        // Check if already in our DB
        const existing = await db.abandonedCheckout.findUnique({
          where: { shop_shopifyCheckoutId: { shop, shopifyCheckoutId: shopifyId } },
        });

        if (existing && existing.status !== "pending") {
          continue; // Already processed
        }

        // Build cart items summary
        const cartItems = (checkout.lineItems?.nodes || []).map((item: any) => ({
          title: item.title,
          quantity: item.quantity,
          price: item.variant?.price || "0",
          imageUrl: item.variant?.image?.url || "",
        }));

        const cartItemsSummary = cartItems
          .map((item: any) => `${item.title} (x${item.quantity})`)
          .join(", ");

        // Upsert abandoned checkout record
        const checkoutRecord = await db.abandonedCheckout.upsert({
          where: { shop_shopifyCheckoutId: { shop, shopifyCheckoutId: shopifyId } },
          create: {
            shop,
            shopifyCheckoutId: shopifyId,
            customerPhone: phone,
            customerEmail: checkout.customer?.email,
            customerFirstName: checkout.customer?.firstName,
            customerLastName: checkout.customer?.lastName,
            cartTotal: total,
            cartCurrency: currency,
            cartItems: JSON.stringify(cartItems),
            checkoutUrl: checkout.abandonedCheckoutUrl,
            status: "scheduled",
            abandonedAt: createdAt,
          },
          update: {
            status: "scheduled",
          },
        });

        // Extract store name from shop domain
        const storeName = shop.replace(".myshopify.com", "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        const customerName = [checkout.customer?.firstName, checkout.customer?.lastName].filter(Boolean).join(" ") || "there";

        // Make the outbound call via Vapi
        const vapiCallId = await makeOutboundCall({
          assistantId: settings.vapiAssistantId,
          phoneNumberId: settings.vapiPhoneNumberId,
          customerPhone: phone,
          metadata: {
            shop,
            checkoutId: checkoutRecord.id,
            customerName,
            storeName,
            cartItems: cartItemsSummary,
            cartTotal: total.toFixed(2),
            cartCurrency: currency,
          },
        });

        // Create call log
        await db.callLog.create({
          data: {
            shop,
            abandonedCheckoutId: checkoutRecord.id,
            vapiCallId,
            customerPhone: phone,
            customerName,
            status: "initiated",
          },
        });

        // Update checkout status
        await db.abandonedCheckout.update({
          where: { id: checkoutRecord.id },
          data: { status: "calling" },
        });

        result.callsInitiated++;
        console.log(`[PROCESSOR] Call initiated for ${shop} - checkout ${shopifyId}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        result.errors.push(`Checkout ${checkout.id}: ${msg}`);
        console.error(`[PROCESSOR] Error processing checkout:`, error);
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    result.errors.push(msg);
    console.error(`[PROCESSOR] Error processing shop ${shop}:`, error);
  }

  return result;
}

// Process all active shops (called by cron)
export async function processAllShops(): Promise<ProcessResult[]> {
  const activeShops = await db.shopSettings.findMany({
    where: { isActive: true },
    select: { shop: true },
  });

  console.log(`[PROCESSOR] Processing ${activeShops.length} active shop(s)`);

  const results: ProcessResult[] = [];
  for (const { shop } of activeShops) {
    const result = await processShop(shop);
    results.push(result);
    if (result.callsInitiated > 0) {
      console.log(`[PROCESSOR] ${shop}: ${result.callsInitiated} calls initiated`);
    }
  }

  return results;
}
