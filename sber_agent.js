
require('dotenv').config();
const fs = require('fs').promises; 
const path = require('path');
const crypto = require('crypto');
const fetch = require('node-fetch');

const clientId = process.env.GIGACHAT_CLIENT_ID ;
const clientSecret = process.env.GIGACHAT_CLIENT_SECRET;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; 
let cachedToken = null;

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.value;
  }

  console.log('client IDDDDDD:', clientId, clientSecret); 
  const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const rqUid = crypto.randomUUID(); 

  console.log('authString:', authString); 
const myHeaders = new Headers();
myHeaders.append('Content-Type', 'application/x-www-form-urlencoded');
myHeaders.append('Authorization', `Basic ${authString}`);
myHeaders.append('RqUID', rqUid);

const response = await fetch('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
  method: 'POST',
  headers: myHeaders,
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
  console.log('authString:', authString); 
}


async function sendGigaChatMessage(prompt) {
  try {
    const token = await getAccessToken();
    console.log('Токен получен:', token); 

    const response = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: 'GigaChat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    console.log('Статус ответа:', response.status);
    
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ошибка API GigaChat: ${response.status} — ${errText}`);
    }

    const data = await response.json();
    console.log('Данные от сервера:', data);
    return data.choices[0].message.content;

  } catch (error) {
    console.error(' ошибка:', error.message);
    process.exit(1); 
  }
}


//  функция для чтения и парсинга CSV 
async function readAndParseCSV(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    const lines = data.split('\n');
    
    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue; 

      const values = lines[i].split(',');
      const row = {};

      headers.forEach((header, index) => {
        row[header] = values[index] ? values[index].trim() : '';
      });

      if (Object.values(row).some(val => val !== '')) {
        result.push(row);
      }
    }
    return result;
  } catch (error) {
    throw new Error(`Не удалось прочитать файл: ${error.message}`);
  }
}

async function sendGigaChatMessageFinances(userData) {
  let fileContent = 'Ошибка чтения файла';
  
  try {
    const parsedData = await readAndParseCSV(userData.filePath);
    fileContent = JSON.stringify(parsedData, null, 2); // Преобразуем в красивую строку JSON
  } catch (e) {
    console.warn('предупреждение при чтении файла:', e.message);
  }

  const token = await getAccessToken();

  // Формируем промпт (запрос) для нейросети
  const systemPrompt = `
    Ты — эксперт по финансовому планированию и анализу данных.
    Твоя задача — проанализировать таблицу расходов пользователя и дать рекомендации.
    
    Внимательно изучи данные в формате JSON ниже.
    Данные содержат категории "Доход" и "Расход" (или аналоги).
    
    ШАГИ АНАЛИЗА:
    1. Рассчитай общие суммы доходов и расходов за период.
    2. Вычисли чистый денежный поток (доходы минус расходы).
    3. Найди топ-3 категории самых крупных расходов.
    4. Найди аномалии или резкие скачки трат.
    
    ШАГИ РЕКОМЕНДАЦИЙ:
    5. Предложи процент оптимизации бюджета (например, сократить расходы на X%).
    6. Дай конкретные советы по сокращению трат в топ-категориях.
    7. Предложи стратегию распределения сбережений.
    
    ФОРМАТ ОТВЕТА:
    Дай ответ в структурированном виде, используя заголовки Markdown (#, ##).
    
    Если пользователь оставил комментарий, учти его при формировании советов.
    
    ДАННЫЕ ПОЛЬЗОВАТЕЛЯ:
    ${fileContent}
    
    КОММЕНТАРИЙ ПОЛЬЗОВАТЕЛЯ:
    ${userData.userComment || 'Комментарий отсутствует.'}
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
      temperature: 0.2, // для более точных расчетов
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ошибка API GigaChat: ${response.status} — ${errText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function main() {
  console.log('анализ бюджета запущен...');

  const filePath = path.join(__dirname, 'budget.csv');

  try {
    await fs.access(filePath);
  } catch (error) {
    console.error(` Файл не найден по пути: ${filePath}`);
    console.log(' Создайте файл budget.csv с вашими расходами.');
    return;
  }

  // данные от пользователя
  const userComment = 'Хочу накопить на отпуск к августу, но не хочу сильно экономить на еде.';
  
  try {
    const answer = await sendGigaChatMessage({
      filePath: filePath,
      userComment: userComment,
    });

    console.log('\n--- РЕЗУЛЬТАТ АНАЛИЗА GigaChat ---');
    console.log(answer);

  } catch (error) {
    console.error('критическая ошибка:', error.message);
  }
}

main();