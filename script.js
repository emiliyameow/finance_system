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

let incomeExpenseChartInstance = null;
let categoriesChartInstance = null;

if(document.getElementById('date')) {
    document.getElementById('date').value = new Date().toISOString().split('T')[0];
}

aiForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const text = document.getElementById('ai_question_text').value;
    if(!text) {
        alert('Пожалуйста введите текст');
        return;
    }

    const responseEl = document.getElementById('ai_response');
    try {
        if (responseEl) responseEl.textContent = 'Запрос обрабатывается нейросетью...';
        
        const response = await fetch('http://localhost:3000/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transactions: transactions,
                userComment: text
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Ошибка сервера');

        if (responseEl) {
            if (typeof marked !== 'undefined') {
                responseEl.innerHTML = marked.parse(data.answer);
            } else {
                responseEl.textContent = data.answer;
            }
        }
    } catch (error) {
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

    if (!amount || amount <= 0) return alert('Пожалуйста, введите корректную сумму');
    if (!category) return alert('Пожалуйста, выберите категорию');
    if (!date) return alert('Пожалуйста, выберите дату');

    const newTransaction = {
        id: Date.now().toString(),
        type, amount, category, date, comment
    };

    transactions.push(newTransaction);
    saveAndRefresh();
    
    document.getElementById('amount').value = '';
    document.getElementById('comment').value = '';
    document.getElementById('category').selectedIndex = 0;
});

function updateStats() {
    const currentMonthStr = new Date().toISOString().slice(0, 7);

    const totalBalance = transactions.reduce((acc, t) => t.type === 'income' ? acc + t.amount : acc - t.amount, 0);
    const monthIncome = transactions.filter(t => t.type === 'income' && t.date.startsWith(currentMonthStr)).reduce((sum, t) => sum + t.amount, 0);
    const monthExpenses = transactions.filter(t => t.type === 'expense' && t.date.startsWith(currentMonthStr)).reduce((sum, t) => sum + t.amount, 0);

    if(totalBalanceEl) totalBalanceEl.textContent = totalBalance.toLocaleString('ru-RU') + ' ₽';
    if(monthIncomeEl) monthIncomeEl.textContent = '+' + monthIncome.toLocaleString('ru-RU') + ' ₽';
    if(monthExpensesEl) monthExpensesEl.textContent = '-' + monthExpenses.toLocaleString('ru-RU') + ' ₽';
}


function updateCharts() {
    const currentMonthStr = new Date().toISOString().slice(0, 7);
    
    const monthIncome = transactions.filter(t => t.type === 'income' && t.date.startsWith(currentMonthStr)).reduce((sum, t) => sum + t.amount, 0);
    const monthExpenses = transactions.filter(t => t.type === 'expense' && t.date.startsWith(currentMonthStr)).reduce((sum, t) => sum + t.amount, 0);

    const categoriesData = { 'еда': 0, 'транспорт': 0, 'развлечения': 0, 'учёба': 0, 'другое': 0 };
    transactions.filter(t => t.type === 'expense').forEach(t => {
        if (categoriesData[t.category] !== undefined) {
            categoriesData[t.category] += t.amount;
        } else {
            categoriesData['другое'] += t.amount;
        }
    });

    const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
    const textColor = isDark ? '#f8f9fa' : '#212529';

    const ctxIE = document.getElementById('incomeExpenseChart');
    if (ctxIE) {
        if (incomeExpenseChartInstance) incomeExpenseChartInstance.destroy();
        incomeExpenseChartInstance = new Chart(ctxIE, {
            type: 'bar',
            data: {
                labels: ['Доходы', 'Расходы'],
                datasets: [{
                    data: [monthIncome, monthExpenses],
                    backgroundColor: ['#198754', '#dc3545'],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                },
                scales: {
                    y: { ticks: { color: textColor } },
                    x: { ticks: { color: textColor } }
                }
            }
        });
    }

    const ctxCat = document.getElementById('categoriesChart');
    if (ctxCat) {
        if (categoriesChartInstance) categoriesChartInstance.destroy();
        
        const labels = Object.keys(categoriesData);
        const dataValues = Object.values(categoriesData);
        const hasExpenses = dataValues.some(v => v > 0);

        categoriesChartInstance = new Chart(ctxCat, {
            type: 'doughnut',
            data: {
                labels: hasExpenses ? labels : ['Нет расходов'],
                datasets: [{
                    data: hasExpenses ? dataValues : [1],
                    backgroundColor: hasExpenses ? ['#ffc107', '#0dcaf0', '#fd7e14', '#6f42c1', '#6c757d'] : ['#e9ecef']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: textColor }
                    }
                }
            }
        });
    }
}

function renderTransactions() {
    if (!listContainer) return;
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

    if (emptyState) {
        filtered.length === 0 ? emptyState.classList.remove('d-none') : emptyState.classList.add('d-none');
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
    updateCharts();
}

if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => writeCsv());
}

function writeCsv() {
    if (transactions.length === 0) return alert('Нет данных для экспорта!');

    let csvContent = "\uFEFFДата;Тип;Категория;Сумма;Комментарий\n";
    transactions.forEach(t => {
        const typeRu = t.type === 'income' ? 'Доход' : 'Расход';
        csvContent += `${t.date};${typeRu};${t.category};${t.amount};${t.comment || ''}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "my_finances_" + new Date().toISOString().slice(0,10) + ".csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-bs-theme', savedTheme);
updateThemeIcon(savedTheme);

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-bs-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-bs-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
        updateCharts(); 
    });
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('themeIcon');
    if (!icon) return;
    icon.className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
}

if(filterType) filterType.addEventListener('change', renderTransactions);
if(filterCategory) filterCategory.addEventListener('change', renderTransactions);
if(sortOrder) sortOrder.addEventListener('change', renderTransactions);

window.addEventListener('load', () => {
    updateStats();
    renderTransactions();
    updateCharts(); 
});