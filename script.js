let transactions = JSON.parse(localStorage.getItem('transactions')) || [];

const form = document.getElementById('transactionForm');
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

exportCsvBtn.addEventListener('click', () => {
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
});

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