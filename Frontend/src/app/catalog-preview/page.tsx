import { PageHeader } from "@/components/shared/page-header";
import { ProductCard } from "@/components/catalog/product-card";
import { MOCK_GARMENTS } from "@/lib/data";
import type { Garment } from "@/lib/types";
import Logo from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Scan } from "lucide-react";

// In a real app, you would fetch this data from Firestore
async function getProducts(): Promise<Garment[]> {
    return MOCK_GARMENTS;
}

export default async function CatalogPreviewPage() {
    const products = await getProducts();

    return (
        <div className="flex flex-col min-h-screen">
             <header className="container mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
                <Logo />
                <div className="flex items-center gap-2">
                    <Button asChild variant="ghost">
                        <Link href="/login">Log In</Link>
                    </Button>
                    <Button asChild>
                        <Link href="/signup">Sign Up</Link>
                    </Button>
                </div>
            </header>
            <main className="container mx-auto px-4 sm:px-6 lg:px-8 flex-grow">
                <div className="space-y-8">
                    <PageHeader
                        title="Explore the Collection"
                        description="Discover the latest in futuristic fashion."
                    />
                    <Alert className="bg-primary/10 border-primary/20 text-primary-foreground">
                        <Scan className="h-4 w-4 text-primary" />
                        <AlertTitle className="text-primary font-bold">Want to try these on?</AlertTitle>
                        <AlertDescription>
                            <Link href="/signup" className="underline font-semibold">Create an account</Link> to use our Virtual Try-On feature.
                        </AlertDescription>
                    </Alert>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {products.map(product => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                </div>
            </main>
            <footer className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-muted-foreground text-sm">
                <p>&copy; {new Date().getFullYear()} VirtuFit. All rights reserved.</p>
            </footer>
        </div>
    );
}
