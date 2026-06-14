import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import {
  Page,
  Layout,
  Card,
  DataTable,
  Badge,
  Text,
  BlockStack,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  const calls = await db.callLog.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    include: {
      abandonedCheckout: true
    },
    take: 50,
  });

  return { calls };
};

export default function Calls() {
  const { calls } = useLoaderData<typeof loader>();

  return (
    <Page title="Call History">
      <Layout>
        <Layout.Section>
          <Card padding="0">
            {calls.length > 0 ? (
              <DataTable
                columnContentTypes={[
                  'text',
                  'text',
                  'text',
                  'text',
                  'text',
                  'text',
                ]}
                headings={[
                  'Date',
                  'Customer',
                  'Phone',
                  'Cart Value',
                  'Status',
                  'Outcome',
                ]}
                rows={calls.map((call) => [
                  new Date(call.createdAt).toLocaleString(),
                  call.customerName || 'Unknown',
                  call.customerPhone,
                  `${call.abandonedCheckout.cartTotal} ${call.abandonedCheckout.cartCurrency}`,
                  <Badge tone={
                    call.status === 'completed' ? 'success' : 
                    call.status === 'failed' ? 'critical' : 'info'
                  }>{call.status}</Badge>,
                  call.callOutcome ? (
                    <Badge tone={call.callOutcome === 'interested' ? 'success' : undefined}>
                      {call.callOutcome}
                    </Badge>
                  ) : '-',
                ])}
              />
            ) : (
              <BlockStack inlineAlign="center" padding="400">
                <Text as="p" tone="subdued">No calls have been made yet.</Text>
              </BlockStack>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
