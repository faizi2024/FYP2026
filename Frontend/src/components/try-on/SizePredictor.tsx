import React, { useState } from 'react';

export default function SizePredictor() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Connects to your FastAPI backend at http://127.0.0.1:8000
      const response = await fetch('http://127.0.0.1:8000/predict-size', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error("Error predicting size:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-md mx-auto bg-white rounded-xl shadow-md space-y-4 border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-800">AI Size Predictor</h2>
      
      <input 
        type="file" 
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
      />

      <button 
        onClick={handleUpload}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:bg-blue-300"
      >
        {loading ? "Analyzing Body..." : "Predict My Size"}
      </button>

      {result && (
        <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
          <p className="text-green-800 font-semibold">Suggested Size: {result.suggested_size}</p>
          <p className="text-green-600 text-sm">Shoulder Width: {result.shoulder_width_px}px</p>
        </div>
      )}
    </div>
  );
}