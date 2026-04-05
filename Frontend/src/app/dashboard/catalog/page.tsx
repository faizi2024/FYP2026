import { PageHeader } from "@/components/shared/page-header";
import { ProductCard } from "@/components/catalog/product-card";
import { MOCK_GARMENTS } from "@/lib/data";
import type { Garment } from "@/lib/types";

// In a real app, you would fetch this data from Firestore
async function getProducts(): Promise<Garment[]> {
    return MOCK_GARMENTS;
}

export default async function CatalogPage() {
    const products = await getProducts();

    return (
        <div className="space-y-8">
            <PageHeader
                title="Product Catalog"
                description="Explore the future of fashion. Select an item to try it on."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {products.map(product => (
                    <ProductCard key={product.id} product={product} />
                ))}
            </div>
        </div>
    );
}
