let transactions = JSON.parse(localStorage.getItem('transactions')) || [];

const form = document.getElementById('transactionForm');
const aiForm = document.getElementById('gigachat-form');
const listContainer = document.getElementById('transactionList');
const emptyState = document.getElementById('emptyState');

const totalBalanceEl = document.getElementById('totalBalance');
const monthIncomeEl = document.getElementById('monthIncome');
const monthExpensesEl = document.getElementById('monthExpenses');

const filterType = document.getElementById('filterType');
const filterCategory = document.getElementById('filterCategory');
const sortOrder = document.getElementById('sortOrder');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const themeToggle = document.getElementById('themeToggle');

document.getElementById('date').value = new Date().toISOString().split('T')[0];

aiForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const text = document.getElementById('ai_question_text').value;
    if(!text) {
        alert('Пожалуйста введите текст');
        return;
    }

    try {
        const responseEl = document.getElementById('ai_response');
        if (responseEl) responseEl.textContent = 'Запрос обрабатывается нейросетью...';
        
        const answer = await sendGigaChatMessageFinances({ userComment: text });
        
        if (responseEl) responseEl.textContent = answer;
    } catch (error) {
        const responseEl = document.getElementById('ai_response');
        if (responseEl) responseEl.textContent = 'Ошибка: ' + error.message;
    }
});

form.addEventListener('submit', (e) => {
    e.preventDefault();

    const type = document.querySelector('input[name="type"]:checked').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const category = document.getElementById('category').value;
    const date = document.getElementById('date').value;
    const comment = document.getElementById('comment').value.trim();

    if (!amount || amount <= 0) {
        alert('Пожалуйста, введите корректную сумму');
        return;
    }

    if (!category) {
        alert('Пожалуйста, выберите категорию');
        return;
    }

    if (!date) {
        alert('Пожалуйста, выберите дату');
        return;
    }

    const newTransaction = {
        id: Date.now().toString(),
        type,
        amount,
        category,
        date,
        comment
    };

    transactions.push(newTransaction);
    saveAndRefresh();
    
    document.getElementById('amount').value = '';
    document.getElementById('comment').value = '';
    document.getElementById('category').selectedIndex = 0;
});

function updateStats() {
    const currentMonthStr = new Date().toISOString().slice(0, 7);

    const totalBalance = transactions.reduce((acc, t) => {
        return t.type === 'income' ? acc + t.amount : acc - t.amount;
    }, 0);

    const monthIncome = transactions
        .filter(t => t.type === 'income' && t.date.startsWith(currentMonthStr))
        .reduce((sum, t) => sum + t.amount, 0);

    const monthExpenses = transactions
        .filter(t => t.type === 'expense' && t.date.startsWith(currentMonthStr))
        .reduce((sum, t) => sum + t.amount, 0);

    totalBalanceEl.textContent = totalBalance.toLocaleString('ru-RU') + ' ₽';
    monthIncomeEl.textContent = '+' + monthIncome.toLocaleString('ru-RU') + ' ₽';
    monthExpensesEl.textContent = '-' + monthExpenses.toLocaleString('ru-RU') + ' ₽';
}

function renderTransactions() {
    listContainer.innerHTML = '';

    let filtered = transactions.filter(t => {
        const matchType = filterType.value === 'all' || t.type === filterType.value;
        const matchCategory = filterCategory.value === 'all' || t.category === filterCategory.value;
        return matchType && matchCategory;
    });

    filtered.sort((a, b) => {
        if (sortOrder.value === 'date-desc') return new Date(b.date) - new Date(a.date);
        if (sortOrder.value === 'date-asc') return new Date(a.date) - new Date(b.date);
        if (sortOrder.value === 'amount-desc') return b.amount - a.amount;
        if (sortOrder.value === 'amount-asc') return a.amount - b.amount;
        return 0;
    });

    if (filtered.length === 0) {
        emptyState.classList.remove('d-none');
    } else {
        emptyState.classList.add('d-none');
    }

    filtered.forEach(t => {
        const row = document.createElement('tr');
        
        const formattedDate = new Date(t.date).toLocaleDateString('ru-RU');
        const amountSign = t.type === 'income' ? '+' : '-';
        const amountText = amountSign + ' ' + t.amount.toLocaleString('ru-RU') + ' ₽';

        row.innerHTML = `
            <td class="text-nowrap">${formattedDate}</td>
            <td><span class="badge bg-secondary-subtle text-body border">${t.category}</span></td>
            <td class="text-muted small text-truncate" style="max-width: 150px;">${t.comment || '—'}</td>
            <td class="text-end text-nowrap" data-type="${t.type}">${amountText}</td>
            <td class="text-center">
                <i class="bi bi-trash btn-delete" onclick="deleteTransaction('${t.id}')"></i>
            </td>
        `;
        listContainer.appendChild(row);
    });
}

window.deleteTransaction = function(id) {
    if (confirm('Удалить эту операцию?')) {
        transactions = transactions.filter(t => t.id !== id);
        saveAndRefresh();
    }
};

function saveAndRefresh() {
    localStorage.setItem('transactions', JSON.stringify(transactions));
    updateStats();
    renderTransactions();
}

exportCsvBtn.addEventListener('click', async () => {
    const csvContent = await writeCsv();
    const userData = {
        file: csvContent
    };
});

async function writeCsv() {
    if (transactions.length === 0) {
        alert('Нет данных для экспорта!');
        return;
    }

    let csvContent = "\uFEFFДата;Тип;Категория;Сумма;Комментарий\n";

    transactions.forEach(t => {
        const typeRu = t.type === 'income' ? 'Доход' : 'Расход';
        csvContent += t.date + ';' + typeRu + ';' + t.category + ';' + t.amount + ';' + (t.comment || '') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "my_finances_" + new Date().toISOString().slice(0,10) + ".csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return csvContent;
}

const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-bs-theme', savedTheme);
updateThemeIcon(savedTheme);

themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-bs-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-bs-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
});

function updateThemeIcon(theme) {
    const icon = document.getElementById('themeIcon');
    if (theme === 'dark') {
        icon.className = 'bi bi-sun-fill';
    } else {
        icon.className = 'bi bi-moon-fill';
    }
}

filterType.addEventListener('change', renderTransactions);
filterCategory.addEventListener('change', renderTransactions);
sortOrder.addEventListener('change', renderTransactions);

window.addEventListener('load', () => {
    updateStats();
    renderTransactions();
});
let cachedToken = null;

const clientId = "019e300a-df6e-70f6-8bcf-133c00bece7f";
const clientSecret = "d7b7c90d-0409-435e-b08f-1d7397517728";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; 
require('dotenv').config();
const fs = require('fs').promises; 
const path = require('path');
const crypto = require('crypto');
const fetch = require('node-fetch');



async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.value;
  }
    let Buffer = require("buffer").Buffer;
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
    const parsedData = await writeCsv();
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