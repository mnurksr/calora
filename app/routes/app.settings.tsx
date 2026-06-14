import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  TextField,
  Button,
  Banner,
  Select,
  ChoiceList,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await db.shopSettings.findUnique({ where: { shop: session.shop } });
  return { settings };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  
  try {
    await db.shopSettings.update({
      where: { shop: session.shop },
      data: {
        isActive: formData.get("isActive") === "true",
        callDelayMinutes: parseInt(formData.get("callDelayMinutes") as string) || 60,
        minCartValue: parseFloat(formData.get("minCartValue") as string) || 0,
        discountType: formData.get("discountType") as string || "percentage",
        discountValue: parseFloat(formData.get("discountValue") as string) || 10,
      },
    });
    return { success: true };
  } catch (error) {
    return { error: "Failed to save settings" };
  }
};

export default function Settings() {
  const { settings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  const [isActive, setIsActive] = useState(settings?.isActive ? "true" : "false");
  const [delay, setDelay] = useState(String(settings?.callDelayMinutes || 60));
  const [minValue, setMinValue] = useState(String(settings?.minCartValue || 0));
  const [discountType, setDiscountType] = useState(settings?.discountType || "percentage");
  const [discountValue, setDiscountValue] = useState(String(settings?.discountValue || 10));

  return (
    <Page title="Settings">
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {actionData?.success && (
              <Banner tone="success">Settings saved successfully.</Banner>
            )}
            {actionData?.error && (
              <Banner tone="critical">{actionData.error}</Banner>
            )}

            <Form method="post">
              <BlockStack gap="400">
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">General</Text>
                    <Select
                      label="App Status"
                      name="isActive"
                      options={[
                        { label: "Active - Calls will be made", value: "true" },
                        { label: "Paused - No calls will be made", value: "false" },
                      ]}
                      value={isActive}
                      onChange={setIsActive}
                    />
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">Call Rules</Text>
                    <TextField
                      label="Wait time before calling (minutes)"
                      name="callDelayMinutes"
                      type="number"
                      value={delay}
                      onChange={setDelay}
                      helpText="We recommend waiting at least 60 minutes after a cart is abandoned."
                      autoComplete="off"
                    />
                    <TextField
                      label="Minimum cart value"
                      name="minCartValue"
                      type="number"
                      value={minValue}
                      onChange={setMinValue}
                      prefix="$"
                      helpText="Only call if the cart total is above this amount."
                      autoComplete="off"
                    />
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">Discount Strategy</Text>
                    <Text as="p" tone="subdued">
                      The AI will only offer this discount if the customer expresses concern about price.
                    </Text>
                    <ChoiceList
                      title="Discount Type"
                      name="discountType"
                      choices={[
                        { label: 'Percentage (%)', value: 'percentage' },
                        { label: 'Fixed Amount ($)', value: 'fixed_amount' },
                      ]}
                      selected={[discountType]}
                      onChange={(val) => setDiscountType(val[0])}
                    />
                    <TextField
                      label="Discount Value"
                      name="discountValue"
                      type="number"
                      value={discountValue}
                      onChange={setDiscountValue}
                      autoComplete="off"
                      suffix={discountType === 'percentage' ? '%' : undefined}
                      prefix={discountType === 'fixed_amount' ? '$' : undefined}
                    />
                  </BlockStack>
                </Card>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button submit variant="primary" loading={isSaving}>
                    Save Settings
                  </Button>
                </div>
              </BlockStack>
            </Form>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
