export type UserProfile = {
  uid: string;
  email: string | null;
  name: string | null;
  photoURL: string | null;
  measurements?: {
    heightCm: number;
    weightKg: number;
    chestCm: number;
    waistCm: number;
  };
};

export type Garment = {
  id: string;
  name: string;
  type: string;
  imageUrl: string;
  imageHint: string;
  price: number;
  measurements: {
    chestCm: number;
    waistCm: number;
    lengthCm: number;
  };
};
