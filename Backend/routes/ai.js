const express = require('express');
const axios = require('axios');
const router = express.Router();

// Proxy route to Python AI Service
router.post('/tryon', async (req, res) => {
    try {
        const { person_image, garment_image } = req.body;

        // This calls your Python service (main.py/processor.py)
        // Adjust the port if your Python server uses something other than 5000
        const pythonResponse = await axios.post('http://127.0.0.1:5000/predict', {
            image: person_image,
            garment: garment_image
        });

        // Send the processed result back to the Next.js frontend
        res.status(200).json(pythonResponse.data);
    } catch (error) {
        console.error("Error communicating with AI service:", error.message);
        res.status(500).json({ error: "AI Service is currently unreachable." });
    }
});

module.exports = router;