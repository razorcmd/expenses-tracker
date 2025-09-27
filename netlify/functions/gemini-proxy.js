// /workspaces/expenses-tracker/netlify/functions/gemini-proxy.js
const fetch = require('node-fetch');

exports.handler = async function(event) {
    // Serverless functions di Netlify hanya dieksekusi saat dipanggil.
    // Kita hanya mengizinkan metode POST.
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // Ambil API key dari environment variable di Netlify
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
        console.error("GEMINI_API_KEY tidak diatur di environment variables Netlify.");
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: "Server tidak terkonfigurasi dengan benar." }) 
        };
    }

    try {
        // Body dari request frontend ada di `event.body`
        const { prompt } = JSON.parse(event.body);
        if (!prompt) {
            return { 
                statusCode: 400, 
                body: JSON.stringify({ error: "Permintaan harus menyertakan 'prompt'." }) 
            };
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
        };

        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const data = await apiResponse.json();
        
        // Kembalikan respons dari Gemini API ke frontend
        return {
            statusCode: apiResponse.status,
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error("Error di dalam serverless function:", error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: "Internal Server Error." }) 
        };
    }
};
