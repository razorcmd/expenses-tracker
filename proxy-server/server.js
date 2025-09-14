// /workspaces/expenses-tracker/proxy-server/server.js

// Memuat variabel lingkungan dari file .env untuk pengembangan lokal
require('dotenv').config(); 
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
// Render akan menyediakan variabel PORT secara otomatis. Untuk lokal, kita gunakan 3001.
const PORT = process.env.PORT || 3001; 

// Middleware
app.use(cors()); // Mengizinkan permintaan dari frontend Anda
app.use(express.json()); // Mem-parsing body permintaan sebagai JSON

// Endpoint utama untuk proxy
app.post('/call-gemini', async (req, res) => {
    // Mengambil kunci API dari environment variable (ini yang membuatnya aman)
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
        console.error("Kunci API Gemini tidak diatur di environment variables.");
        return res.status(500).json({ error: "Server tidak terkonfigurasi dengan benar." });
    }

    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: "Permintaan harus menyertakan 'prompt'." });
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`;
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
    };

    try {
        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const data = await apiResponse.json();
        if (!apiResponse.ok) {
            console.error("Error dari Gemini API:", data);
            return res.status(apiResponse.status).json(data);
        }
        
        res.status(200).json(data);
    } catch (error) {
        console.error("Error saat memanggil proxy Gemini:", error);
        res.status(500).json({ error: "Internal Server Error." });
    }
});

app.listen(PORT, () => {
    console.log(`Proxy server berjalan di port ${PORT}`);
});
