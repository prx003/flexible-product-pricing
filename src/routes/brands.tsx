import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/head";
import { TaxonomyPage } from "@/components/common/taxonomy-page";

export const Route = createFileRoute("/brands")({
  head: () => pageHead("Brands", "Manage the brands you stock in your grocery shop."),
  component: () => <TaxonomyPage kind="brands" />,
});
