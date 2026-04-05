import type { Garment } from '@/lib/types';
import { PlaceHolderImages } from './placeholder-images';

function findImage(id: string) {
    const img = PlaceHolderImages.find(p => p.id === id);
    if (!img) {
        return { imageUrl: "https://picsum.photos/seed/error/500/500", imageHint: "placeholder" };
    }
    return { imageUrl: img.imageUrl, imageHint: img.imageHint };
}

export const MOCK_GARMENTS: Garment[] = [
  {
    id: '1',
    name: 'Nebula Bomber Jacket',
    type: 'Jacket',
    price: 299.99,
    ...findImage('garment-1'),
    measurements: {
      chestCm: 102,
      waistCm: 98,
      lengthCm: 65,
    },
  },
  {
    id: '2',
    name: 'Cyberslate Cargo Pants',
    type: 'Pants',
    price: 179.99,
    ...findImage('garment-2'),
    measurements: {
      chestCm: 0, // Not applicable
      waistCm: 84,
      lengthCm: 105,
    },
  },
  {
    id: '3',
    name: 'Quantum Tee',
    type: 'T-Shirt',
    price: 79.99,
    ...findImage('garment-3'),
    measurements: {
      chestCm: 98,
      waistCm: 94,
      lengthCm: 70,
    },
  },
  {
    id: '4',
    name: 'Holosheen Dress',
    type: 'Dress',
    price: 349.99,
    ...findImage('garment-4'),
    measurements: {
      chestCm: 90,
      waistCm: 70,
      lengthCm: 110,
    },
  },
  {
    id: '5',
    name: 'AR-Enhanced Hoodie',
    type: 'Hoodie',
    price: 249.99,
    ...findImage('garment-5'),
    measurements: {
      chestCm: 110,
      waistCm: 106,
      lengthCm: 72,
    },
  },
  {
    id: '6',
    name: 'Glow-Grid Shorts',
    type: 'Shorts',
    price: 89.99,
    ...findImage('garment-6'),
    measurements: {
      chestCm: 0, // Not applicable
      waistCm: 80,
      lengthCm: 45,
    },
  },
];
