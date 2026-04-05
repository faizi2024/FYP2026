'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button'; // Adjust based on your UI folder
import LoadingIndicator from '@/components/loading-indicator';

export default function PhotoTryOn() {
  const [userImage, setUserImage] = useState<File | null>(null);
  const [garmentImage, setGarmentImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleProcess = async () => {
    if (!userImage || !garmentImage) return alert("Please upload both images");
    
    setLoading(true);
    try {
      // You will create this API route in Step 2
      const formData = new FormData();
      formData.append('user', userImage);
      formData.append('garment', garmentImage);

      const response = await fetch('/api/tryon', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setResult(data.outputUrl); // Assuming your AI returns an image URL
    } catch (error) {
      console.error("Try-on failed", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 border rounded-xl bg-white shadow-sm">
      <h2 className="text-2xl font-bold mb-4">Virtual Photo Try-On</h2>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="border-dashed border-2 p-4 text-center">
          <p>Your Photo</p>
          <input type="file" onChange={(e) => setUserImage(e.target.files?.[0] || null)} />
        </div>
        <div className="border-dashed border-2 p-4 text-center">
          <p>Garment Photo</p>
          <input type="file" onChange={(e) => setGarmentImage(e.target.files?.[0] || null)} />
        </div>
      </div>

      <Button onClick={handleProcess} disabled={loading} className="w-full">
        {loading ? <LoadingIndicator /> : "Generate Try-On"}
      </Button>

      {result && (
        <div className="mt-6">
          <img src={result} alt="Try-on Result" className="rounded-lg w-full" />
        </div>
      )}
    </div>
  );
}