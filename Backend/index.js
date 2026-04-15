const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const FormData = require('form-data'); // Import Form-Data
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); 

// --- Route Imports ---
const authRoutes = require('./routes/auth');

// --- Use Routes ---
app.use('/api/auth', authRoutes);

// --- AI Proxy Route ---
app.post('/api/ai/tryon', async (req, res) => {
    try {
        const { personImage, garmentId } = req.body;

        if (!personImage || !garmentId) {
            return res.status(400).json({ error: "Missing image or garment ID" });
        }

        // 1. Convert Base64 string from Next.js to a Buffer
        // We strip the data:image/png;base64 prefix if it exists
        const base64Data = personImage.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // 2. Prepare Form Data for FastAPI
        const form = new FormData();
        form.append('file', imageBuffer, { filename: 'user_pose.png', contentType: 'image/png' });
        form.append('garment_id', garmentId);

        // 3. Forward to Python service (Port 8000)
        // Note: Using 'arraybuffer' because Python returns an image stream
        const pythonResponse = await axios.post('http://127.0.0.1:8000/try-on', form, {
            headers: {
                ...form.getHeaders(),
            },
            responseType: 'arraybuffer' 
        });

        // 4. Convert the raw binary image back to Base64 to send to Frontend
        const resultBase64 = Buffer.from(pythonResponse.data, 'binary').toString('base64');
        
        res.status(200).json({ 
            success: true, 
            image: `data:image/png;base64,${resultBase64}` 
        });

    } catch (error) {
        console.error("AI Proxy Error:", error.response?.data || error.message);
        res.status(500).json({ error: "AI service failed to process the request" });
    }
});

// Database Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected Successfully"))
    .catch(err => console.log("❌ Database Connection Error:", err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});