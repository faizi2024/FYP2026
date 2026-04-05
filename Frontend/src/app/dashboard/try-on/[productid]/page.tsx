'use client';

import { MOCK_GARMENTS } from "@/lib/data";
import { Garment } from "@/lib/types";
import { notFound, useParams } from "next/navigation";
import { TryOnClient } from "@/components/try-on/try-on-client";
import { useEffect, useState } from "react";

// In a real app, you would fetch this from Firestore
async function getProduct(id: string): Promise<Garment | undefined> {
    return MOCK_GARMENTS.find(p => p.id === id);
}

export default function TryOnPage() {
    const params = useParams();
    const productId = params.productId as string;
    const [product, setProduct] = useState<Garment | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (productId) {
            getProduct(productId).then(p => {
                if (p) {
                    setProduct(p);
                }
                setLoading(false);
            });
        } else {
            setLoading(false);
        }
    }, [productId]);

    if (loading) {
        return <div>Loading...</div>;
    }

    if (!product) {
        notFound();
    }

    return (
        <TryOnClient product={product} />
    );
}
