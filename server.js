import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import crypto from 'crypto';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const clientId = process.env.GIGACHAT_CLIENT_ID ;
const clientSecret = process.env.GIGACHAT_CLIENT_SECRET;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; 

let cachedToken = null;

async function getAccessToken() {
    if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
        return cachedToken.value;
    }
    const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const rqUid = crypto.randomUUID(); 

    const response = await fetch('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${authString}`,
            'RqUID': rqUid
        },
        body: new URLSearchParams({ scope: 'GIGACHAT_API_PERS' }),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Ошибка авторизации: ${response.status} — ${errText}`);
    }

    const data = await response.json();
    cachedToken = {
        value: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000,
    };
    return cachedToken.value;
}

app.post('/api/analyze', async (req, res) => {
    try {
        const { transactions, userComment } = req.body;
        const token = await getAccessToken();

        const systemPrompt = `
        Ты — эксперт по финансовому планированию. Проанализируй данные расходов JSON ниже:
        ${JSON.stringify(transactions, null, 2)}
        
        КОММЕНТАРИЙ ПОЛЬЗОВАТЕЛЯ:
        ${userComment || 'Комментарий отсутствует.'}
        `;

        const response = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                model: 'GigaChat',
                messages: [{ role: 'user', content: systemPrompt }],
                temperature: 0.2,
                max_tokens: 2048,
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            return res.status(500).json({ error: `Ошибка GigaChat: ${errText}` });
        }

        const data = await response.json();
        res.json({ answer: data.choices[0].message.content });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => console.log('Сервер запущен на http://localhost:3000'));