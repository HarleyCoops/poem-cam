import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' })); // base64 images can be large
app.use(express.static(__dirname)); // serve static files

app.post('/api/poem', async (req, res) => {
  try {
    const { image_b64 } = req.body;
    if (!image_b64) return res.status(400).json({ error: 'image_b64 missing' });

    const mySecret = process.env['OPENAI_API_KEY'];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mySecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "user",
            content: [
              { 
                type: "text", 
                text: "Write a very short, warm, poetic haiku that matches this photo. No hashtags, no emojis, just pure poetry." 
              },
              {
                type: "image_url",
                image_url: {
                  url: image_b64,
                  detail: "low"
                }
              }
            ]
          }
        ],
        max_tokens: 100
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('OpenAI error', data);
      return res.status(500).json({ error: 'OpenAI error', detail: data });
    }

    const poem = data?.choices?.[0]?.message?.content?.trim() || '(no poem)';
    res.json({ poem });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API listening on :${PORT}`)); 