const CATEGORY_COLORS = {
  'Fitness': '#667eea',
  'Groceries': '#48bb78',
  'Utilities': '#f97316',
  'Shopping': '#9f7aea',
  'Transport': '#4299e1',
  'Other': '#38b2ac',
  'Subscriptions': '#ec4899',
  'Food & Dining': '#eab308',
  'Rent': '#ef4444',
  'Travel': '#8b5cf6',
  'Entertainment': '#06b6d4',
  'Health': '#10b981'
};

// Global state
let currentSummary = null;
let selectedCategories = new Set();
let chartSlices = [];

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  
  const themeBtn = document.querySelector('.btn:nth-child(1)');
  themeBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
  
  if (currentSummary) {
    drawPieChart(currentSummary.byCategory);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const themeBtn = document.querySelector('.btn:nth-child(1)');
  themeBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
});

async function loadStats() {
  const res = await fetch('/api/stats');
  const data = await res.json();
  
  document.getElementById('totalExpenses').textContent = data.totalExpenses;
  document.getElementById('monthsTracked').textContent = data.monthsTracked;
  
  // Get months data
  const monthsRes = await fetch('/api/months');
  const monthsData = await monthsRes.json();
  
  if (monthsData.months.length > 0) {
    const latestMonth = monthsData.months[0];
    const summaryRes = await fetch(`/api/summary/${latestMonth}`);
    const summary = await summaryRes.json();
    
    // Current month total
    document.getElementById('currentMonthTotal').textContent = `$${summary.totalSpent.toFixed(0)}`;
    
    // Top category
    if (summary.byCategory.length > 0) {
      const topCat = summary.byCategory[0];
      document.getElementById('topCategory').textContent = topCat.name;
      document.getElementById('topCategoryAmount').textContent = `$${topCat.total.toFixed(0)} (${topCat.percentage.toFixed(0)}%)`;
      document.getElementById('topCategoryAmount').className = 'stat-trend';
    }
    
    // Compare to previous month
    if (monthsData.months.length > 1) {
      const prevMonth = monthsData.months[1];
      const prevRes = await fetch(`/api/summary/${prevMonth}`);
      const prevSummary = await prevRes.json();
      
      const diff = summary.totalSpent - prevSummary.totalSpent;
      const percentChange = ((diff / prevSummary.totalSpent) * 100).toFixed(1);
      
      const trendEl = document.getElementById('monthTrend');
      if (diff > 0) {
        trendEl.textContent = `↑ $${Math.abs(diff).toFixed(0)} (${percentChange}%) vs last month`;
        trendEl.className = 'stat-trend trend-up';
      } else if (diff < 0) {
        trendEl.textContent = `↓ $${Math.abs(diff).toFixed(0)} (${Math.abs(percentChange)}%) vs last month`;
        trendEl.className = 'stat-trend trend-down';
      } else {
        trendEl.textContent = 'Same as last month';
        trendEl.className = 'stat-trend trend-neutral';
      }
    }
  }
}

async function loadMonths() {
  const res = await fetch('/api/months');
  const data = await res.json();
  
  const select = document.getElementById('monthSelect');
  select.innerHTML = data.months.map(m => 
    `<option value="${m}">${formatMonthDisplay(m)}</option>`
  ).join('');

  if (data.months.length > 0) {
    select.value = data.months[0];
    loadSummary();
  }
}

function formatMonthDisplay(month) {
  const [year, monthNum] = month.split('-');
  const date = new Date(year, monthNum - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

async function loadSummary() {
  const month = document.getElementById('monthSelect').value;
  if (!month) return;

  const res = await fetch(`/api/summary/${month}`);
  const summary = await res.json();
  currentSummary = summary;
  selectedCategories.clear();

  document.getElementById('totalAmount').textContent = `$${summary.totalSpent.toFixed(2)}`;
  document.getElementById('periodLabel').textContent = `Total spent in ${formatMonthDisplay(summary.month)}`;
  document.getElementById('transactionCount').textContent = `${summary.transactionCount} transactions`;

  const maxAmount = Math.max(...summary.byCategory.map(c => c.total));
  const categoryList = document.getElementById('categoryList');
  categoryList.innerHTML = summary.byCategory.map(cat => `
    <div class="category-item" onclick="openCategoryModal('${cat.name.replace(/'/g, "\\'")}')">
      <div class="category-color" style="background: ${CATEGORY_COLORS[cat.name] || '#9ca3af'}"></div>
      <div class="category-name">${cat.name}</div>
      <div class="category-bar">
        <div class="category-bar-fill" style="width: ${(cat.total / maxAmount * 100)}%; background: ${CATEGORY_COLORS[cat.name] || '#9ca3af'}"></div>
      </div>
      <div class="category-amount">$${cat.total.toFixed(2)}</div>
      <div class="category-percent">${cat.percentage.toFixed(1)}%</div>
    </div>
  `).join('');

  drawPieChart(summary.byCategory);
  updateLegend(summary.byCategory);

  const recentTransactions = summary.allTransactions
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3);

  const recentContainer = document.getElementById('recentTransactions');
  if (recentTransactions.length > 0) {
    recentContainer.innerHTML = recentTransactions.map(tx => `
      <div class="recent-item">
        <div class="recent-desc">${tx.description}</div>
        <div class="recent-date">${tx.date}</div>
        <div class="recent-amount">$${tx.amount.toFixed(2)}</div>
      </div>
    `).join('');
  } else {
    recentContainer.innerHTML = '<div class="loading-small">No transactions</div>';
  }

  const tbody = document.getElementById('topExpensesBody');
  tbody.innerHTML = summary.top5Expenses.map(exp => `
    <tr>
      <td>${exp.date}</td>
      <td>${exp.description}</td>
      <td>${exp.category || 'Uncategorized'}</td>
      <td style="text-align: right;" class="amount-positive">$${exp.amount.toFixed(2)}</td>
    </tr>
  `).join('');
}

function updateLegend(categories) {
  const legend = document.getElementById('chartLegend');
  legend.innerHTML = categories.slice(0, 8).map((cat, index) => `
    <div class="legend-item ${selectedCategories.has(cat.name) ? 'active' : ''}" 
         onclick="selectCategoryByName('${cat.name.replace(/'/g, "\\'")}')">
      <div class="legend-color" style="background: ${CATEGORY_COLORS[cat.name] || '#9ca3af'}"></div>
      <span>${cat.name}</span>
      <span class="legend-percent">${cat.percentage.toFixed(1)}%</span>
    </div>
  `).join('');
}

function selectCategoryByName(categoryName) {
  openCategoryModal(categoryName);
  
  // Also highlight the category in the chart
  if (selectedCategories.has(categoryName)) {
    selectedCategories.delete(categoryName);
  } else {
    selectedCategories.add(categoryName);
  }
  
  document.querySelectorAll('.legend-item').forEach(item => {
    const itemName = item.querySelector('span:first-of-type').textContent;
    if (selectedCategories.has(itemName)) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  
  drawPieChart(currentSummary.byCategory);
}

function drawPieChart(categories) {
  const canvas = document.getElementById('pieChart');
  const ctx = canvas.getContext('2d');
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = 100;
  const innerRadius = 65;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let currentAngle = -Math.PI / 2;
  const total = categories.reduce((sum, cat) => sum + cat.total, 0);

  chartSlices = [];

  categories.forEach(cat => {
    const sliceAngle = (cat.total / total) * 2 * Math.PI;
    const endAngle = currentAngle + sliceAngle;
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, currentAngle, endAngle);
    ctx.arc(centerX, centerY, innerRadius, endAngle, currentAngle, true);
    ctx.closePath();
    
    const isSelected = selectedCategories.has(cat.name);
    
    if (selectedCategories.size > 0 && !isSelected) {
      ctx.globalAlpha = 0.3;
    } else {
      ctx.globalAlpha = 1.0;
    }
    
    ctx.fillStyle = CATEGORY_COLORS[cat.name] || '#9ca3af';
    ctx.fill();
    
    ctx.globalAlpha = 1.0;
    
    chartSlices.push({
      name: cat.name,
      startAngle: currentAngle,
      endAngle: endAngle,
      percentage: cat.percentage,
      total: cat.total
    });
    
    currentAngle = endAngle;
  });

  updateCenterText(categories);
  setupClickHandler(canvas, centerX, centerY, innerRadius, radius);
}

function setupClickHandler(canvas, centerX, centerY, innerRadius, radius) {
  canvas.onclick = function(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance >= innerRadius && distance <= radius) {
      let clickAngle = Math.atan2(dy, dx);
      
      for (let i = 0; i < chartSlices.length; i++) {
        const slice = chartSlices[i];
        
        let normalizedAngle = clickAngle;
        let start = slice.startAngle;
        let end = slice.endAngle;
        
        while (normalizedAngle < start) normalizedAngle += 2 * Math.PI;
        while (normalizedAngle > start + 2 * Math.PI) normalizedAngle -= 2 * Math.PI;
        
        if (normalizedAngle >= start && normalizedAngle < end) {
          selectCategoryByName(slice.name);
          return;
        }
      }
    }
  };
}

function updateCenterText(categories) {
  if (selectedCategories.size === 0) {
    document.getElementById('centerPercentage').textContent = '100%';
    document.getElementById('centerLabel').textContent = 'Total';
  } else if (selectedCategories.size === 1) {
    const categoryName = Array.from(selectedCategories)[0];
    const selectedCat = categories.find(c => c.name === categoryName);
    if (selectedCat) {
      document.getElementById('centerPercentage').textContent = `${selectedCat.percentage.toFixed(1)}%`;
      document.getElementById('centerLabel').textContent = selectedCat.name;
    }
  } else {
    let combinedPercentage = 0;
    selectedCategories.forEach(catName => {
      const cat = categories.find(c => c.name === catName);
      if (cat) {
        combinedPercentage += cat.percentage;
      }
    });
    document.getElementById('centerPercentage').textContent = `${combinedPercentage.toFixed(1)}%`;
    document.getElementById('centerLabel').textContent = `${selectedCategories.size} Selected`;
  }
}

function openCategoryModal(categoryName) {
  if (!currentSummary) return;

  const category = currentSummary.byCategory.find(c => c.name === categoryName);
  if (!category) return;

  // Filter transactions for this category
  const categoryTransactions = currentSummary.allTransactions
    .filter(tx => tx.category === categoryName)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const total = category.total;
  const count = categoryTransactions.length;
  const average = count > 0 ? total / count : 0;

  document.getElementById('modalCategoryName').textContent = categoryName;
  document.getElementById('modalCategoryColor').style.background = CATEGORY_COLORS[categoryName] || '#9ca3af';
  document.getElementById('modalTotal').textContent = `$${total.toFixed(2)}`;
  document.getElementById('modalCount').textContent = count;
  document.getElementById('modalAverage').textContent = `$${average.toFixed(2)}`;

  const tbody = document.getElementById('modalTableBody');
  tbody.innerHTML = categoryTransactions.map(tx => `
    <tr>
      <td>${tx.date}</td>
      <td>${tx.description}</td>
      <td style="text-align: right; color: var(--accent-color); font-weight: 600;">$${tx.amount.toFixed(2)}</td>
    </tr>
  `).join('');

  document.getElementById('categoryModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(event) {
  if (!event || event.target.id === 'categoryModal' || event.target.classList.contains('modal-close')) {
    document.getElementById('categoryModal').classList.remove('open');
    document.body.style.overflow = '';
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
  }
});

function exportCSV() {
  if (!currentSummary) {
    alert('Please select a month first');
    return;
  }
  
  let csv = 'Date,Description,Amount,Currency,Category\n';
  
  currentSummary.allTransactions.forEach(tx => {
    const date = tx.date || '';
    const description = (tx.description || '').replace(/"/g, '""');
    const amount = tx.amount || 0;
    const currency = currentSummary.currency || 'USD';
    const category = (tx.category || 'Uncategorized').replace(/"/g, '""');
    
    csv += `${date},"${description}",${amount},${currency},"${category}"\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `expenses_${currentSummary.month}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

loadStats();
loadMonths();