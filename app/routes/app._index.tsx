import { useEffect } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  CalloutCard,
  Icon,
  Badge,
  DataTable,
} from "@shopify/polaris";
import { PhoneIcon, CheckCircleIcon, AlertCircleIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const settings = await db.shopSettings.findUnique({ where: { shop } });

  if (!settings || settings.setupStep < 3) {
    return { needsSetup: true, stats: null, recentCalls: [] };
  }

  // Get some basic stats
  const totalCalls = await db.callLog.count({ where: { shop } });
  const recovered = await db.abandonedCheckout.count({
    where: { shop, status: "recovered" },
  });
  
  const recoveredRevenue = await db.callLog.aggregate({
    where: { shop, recoveredAmount: { not: null } },
    _sum: { recoveredAmount: true },
  });

  const recentCalls = await db.callLog.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      abandonedCheckout: {
        select: {
          cartTotal: true,
          cartCurrency: true,
        }
      }
    }
  });

  return {
    needsSetup: false,
    isActive: settings.isActive,
    stats: {
      totalCalls,
      recovered,
      revenue: recoveredRevenue._sum.recoveredAmount || 0,
      conversionRate: totalCalls > 0 ? ((recovered / totalCalls) * 100).toFixed(1) : "0",
    },
    recentCalls: recentCalls.map(call => ({
      id: call.id,
      customer: call.customerName || call.customerPhone,
      outcome: call.callOutcome || call.status,
      value: `${call.abandonedCheckout.cartTotal} ${call.abandonedCheckout.cartCurrency}`,
      date: new Date(call.createdAt).toLocaleDateString(),
    })),
  };
};

export default function Index() {
  const { needsSetup, isActive, stats, recentCalls } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  useEffect(() => {
    if (needsSetup) {
      navigate("/app/setup");
    }
  }, [needsSetup, navigate]);

  if (needsSetup) return null;

  return (
    <Page title="Dashboard">
      <BlockStack gap="500">
        {!isActive && (
          <CalloutCard
            title="CartCall AI is currently paused"
            illustration="https://cdn.shopify.com/s/assets/admin/checkout/settings-customizecart-705f57c725ac05be5a34ec20c05b94298cb8afd10bf56bd423c6dae858dbaf7f.svg"
            primaryAction={{
              content: "Go to Settings",
              url: "/app/settings",
            }}
          >
            <p>Your AI assistant is paused and won't make calls for new abandoned checkouts. Go to settings to activate it.</p>
          </CalloutCard>
        )}

        <Layout>
          <Layout.Section>
            <InlineStack gap="400" wrap={false}>
              <div style={{ flex: 1 }}>
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm" tone="subdued">Calls Made</Text>
                    <Text as="p" variant="headingXl">{stats?.totalCalls}</Text>
                  </BlockStack>
                </Card>
              </div>
              <div style={{ flex: 1 }}>
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm" tone="subdued">Carts Recovered</Text>
                    <Text as="p" variant="headingXl">{stats?.recovered}</Text>
                  </BlockStack>
                </Card>
              </div>
              <div style={{ flex: 1 }}>
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm" tone="subdued">Recovered Revenue</Text>
                    <Text as="p" variant="headingXl">${stats?.revenue.toFixed(2)}</Text>
                  </BlockStack>
                </Card>
              </div>
              <div style={{ flex: 1 }}>
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm" tone="subdued">Conversion Rate</Text>
                    <Text as="p" variant="headingXl">{stats?.conversionRate}%</Text>
                  </BlockStack>
                </Card>
              </div>
            </InlineStack>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">Recent Calls</Text>
                  <Button url="/app/calls" variant="plain">View all</Button>
                </InlineStack>
                
                {recentCalls?.length > 0 ? (
                  <DataTable
                    columnContentTypes={['text', 'text', 'text', 'text']}
                    headings={['Customer', 'Cart Value', 'Outcome', 'Date']}
                    rows={recentCalls.map((call: any) => [
                      call.customer,
                      call.value,
                      <Badge tone={call.outcome === 'interested' || call.outcome === 'recovered' ? 'success' : 'info'}>
                        {call.outcome}
                      </Badge>,
                      call.date
                    ])}
                  />
                ) : (
                  <BlockStack inlineAlign="center" gap="200">
                    <Text as="p" tone="subdued">No calls made yet.</Text>
                  </BlockStack>
                )}
              </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
