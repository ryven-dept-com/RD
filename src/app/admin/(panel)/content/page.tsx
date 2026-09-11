import { getCmsData } from "@/lib/cms";
import { getProductOptions } from "@/lib/admin-queries";
import { ContentEditor } from "./content-editor";

export const dynamic = "force-dynamic";

export const metadata = { title: "Content" };

export default async function ContentPage() {
  const [cms, products] = await Promise.all([getCmsData(), getProductOptions()]);

  return <ContentEditor cms={cms} products={products} />;
}
