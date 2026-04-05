import { PageHeader } from "@/components/shared/page-header";
import { ProductCard } from "@/components/catalog/product-card";
import { MOCK_GARMENTS } from "@/lib/data";
import type { Garment } from "@/lib/types";

// In a real app, you would fetch this data from Firestore
async function getProducts(): Promise<Garment[]> {
    // For now, we'll just return a subset of the mock garments
    return MOCK_GARMENTS.slice(0, 3);
}

export default async function WardrobePage() {
    const products = await getProducts();

    return (
        <div className="space-y-8">
            <PageHeader
                title="My Wardrobe"
                description="These are the items you've saved or tried on."
            />
            {products.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {products.map(product => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>
            ) : (
                <div className="flex items-center justify-center text-center py-16">
                    <div className="max-w-md">
                        <h3 className="text-xl font-semibold">Your wardrobe is empty</h3>
                        <p className="text-muted-foreground mt-2">
                            Browse the catalog to find items you like and add them to your wardrobe.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
