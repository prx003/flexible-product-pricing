import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/head";
import { TaxonomyPage } from "@/components/common/taxonomy-page";

export const Route = createFileRoute("/categories")({
  head: () => pageHead("Categories", "Organise your grocery catalogue into categories."),
  component: () => <TaxonomyPage kind="categories" />,
});
