import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";

function generateDiscountCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "CARTCALL-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

interface CreateDiscountOptions {
  admin: AdminApiContext;
  type: "percentage" | "fixed_amount";
  value: number;
  title?: string;
}

export async function createDiscountCode(options: CreateDiscountOptions): Promise<{ code: string; id: string }> {
  const { admin, type, value, title } = options;
  const code = generateDiscountCode();

  const discountValue =
    type === "percentage"
      ? { percentage: value / 100 }
      : { discountAmount: { amount: value, appliesOnEachItem: false } };

  const response = await admin.graphql(
    `#graphql
      mutation CreateDiscountCode($basicCodeDiscount: DiscountCodeBasicInput!) {
        discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
          codeDiscountNode {
            id
            codeDiscount {
              ... on DiscountCodeBasic {
                codes(first: 1) {
                  nodes {
                    code
                  }
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        basicCodeDiscount: {
          title: title || `CartCall Recovery - ${code}`,
          code,
          startsAt: new Date().toISOString(),
          endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
          customerSelection: { all: true },
          customerGets: {
            value: discountValue,
            items: { all: true },
          },
          usageLimit: 1,
          appliesOncePerCustomer: true,
        },
      },
    }
  );

  const data = await response.json();
  const result = data.data?.discountCodeBasicCreate;

  if (result?.userErrors?.length > 0) {
    console.error("[DISCOUNT] Creation errors:", result.userErrors);
    throw new Error(`Failed to create discount: ${result.userErrors[0].message}`);
  }

  return {
    code,
    id: result?.codeDiscountNode?.id || "",
  };
}
