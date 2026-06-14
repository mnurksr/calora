import { ApiType, shopifyApiProject } from "@shopify/api-codegen-preset";

export default {
  schema: "https://shopify.dev/admin-graphql-direct-proxy",
  documents: ["./app/**/*.{js,ts,jsx,tsx}"],
  projects: {
    default: shopifyApiProject({
      apiType: ApiType.Admin,
      apiVersion: "2025-07",
      documents: ["./app/**/*.{js,ts,jsx,tsx}"],
      outputDir: "./app/types",
    }),
  },
};
