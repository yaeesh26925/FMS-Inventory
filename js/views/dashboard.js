// views/dashboard.js
window.dashboardView = {
    render: function() {
        const container = document.getElementById('module-dashboard');
        
        // Defaults: Period A = Last 30 days, Period B = Previous 30 days
        const now = new Date();
        const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(now.getDate() - 30);
        const sixtyDaysAgo = new Date(); sixtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const formatYMD = (d) => d.toISOString().split('T')[0];

        container.innerHTML = `
            <div class="header-row">
                <div></div>

                <div style="display:flex; gap:8px;">
                    <button class="btn btn-secondary" onclick="dashboardView.calculateMetrics()">🔄 Refresh Data</button>
                    <button class="btn btn-back" onclick="window.appEngine.navigate('management')" style="width:auto">⬅️ Back to Management</button>
                </div>
            </div>
            
            <p style="color:var(--text-muted); margin-bottom:24px;">Advanced analytics mapping the entire system audit and request logs.</p>

            <div class="card" style="margin-bottom:24px; display:flex; flex-wrap:wrap; gap:16px;">
                <div style="flex:1; min-width:250px;">
                    <h3 style="margin-bottom:12px;">Advanced Filters</h3>
                    <div style="display:flex; gap:16px; flex-wrap:wrap;">
                        <input type="text" id="dash-filter-item" placeholder="Filter by Item (ID, Name, Desc, Part #)" style="padding:12px; border-radius:var(--radius-md); border:1px solid var(--glass-border); background:hsla(0, 0%, 100%, 0.05); color:var(--text-main); flex:1; min-width:200px;">
                        <input type="text" id="dash-filter-operator" placeholder="Filter by Operator Name" style="padding:12px; border-radius:var(--radius-md); border:1px solid var(--glass-border); background:hsla(0, 0%, 100%, 0.05); color:var(--text-main); flex:1; min-width:200px;">
                    </div>
                </div>
            </div>

            <div class="card" style="margin-bottom:24px; display:flex; flex-wrap:wrap; gap:16px; background: linear-gradient(135deg, var(--surface), hsla(var(--h), 100%, 60%, 0.05)); border-color: hsla(var(--h), 100%, 60%, 0.2);">
                <div style="flex:1; min-width:250px;">
                    <h3 style="margin-bottom:12px; color:var(--primary)">Primary Period (A)</h3>
                    <div style="display:flex; gap:8px;">
                        <input type="date" id="dash-start-a" class="input-group" style="padding:12px; border-radius:var(--radius-md); border:1px solid var(--glass-border); background:hsla(0, 0%, 100%, 0.05); color:var(--text-main); width:100%" value="${formatYMD(thirtyDaysAgo)}">
                        <input type="date" id="dash-end-a" class="input-group" style="padding:12px; border-radius:var(--radius-md); border:1px solid var(--glass-border); background:hsla(0, 0%, 100%, 0.05); color:var(--text-main); width:100%" value="${formatYMD(now)}">
                    </div>
                </div>
                <div style="flex:1; min-width:250px;">
                    <h3 style="margin-bottom:12px; color:var(--text-muted)">Comparison Period (B)</h3>
                    <div style="display:flex; gap:8px;">
                        <input type="date" id="dash-start-b" class="input-group" style="padding:12px; border-radius:var(--radius-md); border:1px solid var(--glass-border); background:hsla(0, 0%, 100%, 0.05); color:var(--text-main); width:100%" value="${formatYMD(sixtyDaysAgo)}">
                        <input type="date" id="dash-end-b" class="input-group" style="padding:12px; border-radius:var(--radius-md); border:1px solid var(--glass-border); background:hsla(0, 0%, 100%, 0.05); color:var(--text-main); width:100%" value="${formatYMD(thirtyDaysAgo)}">
                    </div>
                </div>
            </div>


            <div class="grid" id="dash-metrics">
                <!-- Metrics populated via JS -->
            </div>

            <div class="card" style="margin-top:24px;">
                <h2>Period Comparison Chart</h2>
                <div style="position:relative; height:300px; width:100%; margin-top:16px;">
                    <canvas id="dash-chart"></canvas>
                </div>
            </div>

            <div style="display:flex; gap:24px; margin-top:24px; flex-wrap:wrap;">
                <div class="card" style="flex:1; min-width:300px;">
                    <h2>Top Operators (Period A)</h2>
                    <div class="table-responsive" style="margin-top:16px;">
                        <table style="width:100%">
                            <thead><tr><th>Staff Name</th><th>Actions Logged</th></tr></thead>
                            <tbody id="dash-top-staff"></tbody>
                        </table>
                    </div>
                </div>

                <div class="card" style="flex:1; min-width:300px;">
                    <h2>High Velocity Items (Period A)</h2>
                    <div class="table-responsive" style="margin-top:16px;">
                        <table style="width:100%">
                            <thead><tr><th>Item Name</th><th>Total Qty Taken</th></tr></thead>
                            <tbody id="dash-top-items"></tbody>
                        </table>
                    </div>
                </div>
            </div>
            
            <div class="card" style="margin-top:24px;">
                <h2>Financial Report: Items Taken (Period A)</h2>
                <p style="color:var(--text-muted); margin-bottom:16px; font-size:12px;">Detailed view of item value utilized, matching selected filters.</p>
                <div class="table-responsive">
                    <table style="width:100%">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Item Name</th>
                                <th>Operator</th>
                                <th>Qty</th>
                                <th>Unit Price</th>
                                <th>Total Value</th>
                            </tr>
                        </thead>
                        <tbody id="dash-fin-taken"></tbody>
                    </table>
                </div>
            </div>

            <div class="card" style="margin-top:24px;">
                <h2>Financial Report: Stock Added (Period A)</h2>
                <p style="color:var(--text-muted); margin-bottom:16px; font-size:12px;">Detailed view of item value added to inventory, matching selected filters.</p>
                <div class="table-responsive">
                    <table style="width:100%">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Item Name</th>
                                <th>Operator</th>
                                <th>Qty Added</th>
                                <th>Unit Price</th>
                                <th>Total Value</th>
                            </tr>
                        </thead>
                        <tbody id="dash-fin-added"></tbody>
                    </table>
                </div>
            </div>
        `;
        
        this.calculateMetrics();
    },

    parseData: function(start, end, fItem = '', fOp = '') {
        const audit = window.stateManager.get('audit');
        const reqs = window.stateManager.get('requests');
        const itemsList = window.stateManager.get('inventory');
        
        const sd = new Date(start).getTime();
        const ed = new Date(end).getTime() + 86400000; // End of day

        const filterDate = (item) => {
            const t = new Date(item.timestamp || item.dateRequested).getTime();
            return t >= sd && t < ed;
        };

        const isItemMatch = (itemId) => {
            if(!fItem) return true;
            const inv = itemsList.find(i => i.id === itemId);
            if(!inv) return false;
            return (inv.name.toLowerCase().includes(fItem) || 
                    inv.id.toLowerCase().includes(fItem) || 
                    inv.code.toLowerCase().includes(fItem) || 
                    (inv.description && inv.description.toLowerCase().includes(fItem)));
        };

        let periodAudit = audit.filter(filterDate);
        let periodReqs = reqs.filter(filterDate);
        
        if (fOp) {
            periodAudit = periodAudit.filter(a => {
                const name = (a.userName || a.username || 'System').toLowerCase();
                return name.includes(fOp);
            });
            periodReqs = periodReqs.filter(r => {
                const name = (r.userName || r.requestedBy || 'Unknown').toLowerCase();
                return name.includes(fOp);
            });
        }

        if (fItem) {
            periodReqs = periodReqs.filter(r => isItemMatch(r.itemId));
        }

        // Items taken 
        let itemsTakenQty = 0;
        const itemsMap = {};
        const financialTaken = [];

        periodReqs.forEach(r => {
            if(r.status === 'CLAIMED' || r.status === 'APPROVED') {
                const qty = parseInt(r.qty || 0); // BUG FIX
                itemsTakenQty += qty;
                // Try finding item name from inventory cache
                const inv = itemsList.find(i => i.id === r.itemId);
                const name = inv ? inv.name : ('Unknown (' + r.itemId + ')');
                if(!itemsMap[name]) itemsMap[name] = 0;
                itemsMap[name] += qty;
                
                financialTaken.push({
                    date: r.timestamp || r.dateRequested,
                    itemName: name,
                    operator: r.userName || r.requestedBy || 'Unknown',
                    qty: qty,
                    price: inv ? (inv.unitPrice || 0) : 0,
                    value: qty * (inv ? (inv.unitPrice || 0) : 0)
                });
            }
        });

        // Staff actions map — normalize to lowercase for case-insensitive deduplication
        const staffMap = {};
        periodAudit.forEach(a => {
            const raw = a.userName || a.username || 'System';
            if(raw === 'admin' || raw === 'System') return; // Hide backend
            const name = raw.toLowerCase();
            if(!staffMap[name]) staffMap[name] = 0;
            staffMap[name]++;
        });
        periodReqs.forEach(r => {
            const raw = r.userName || r.requestedBy || 'Unknown';
            const name = raw.toLowerCase();
            if(!staffMap[name]) staffMap[name] = 0;
            staffMap[name]++;
        });

        // Financials Added
        const financialAdded = [];
        periodAudit.forEach(a => {
            if (a.action === 'INVENTORY_ADD' || a.action === 'INVENTORY_RESTOCK') {
                let m = a.meta;
                // Fallback for older entries where meta wasn't saved to sheets
                if (!m) {
                    if (a.action === 'INVENTORY_ADD') {
                        const match = a.details.match(/Added new item (.*?) \((\d+(\.\d+)?)\)/);
                        if (match) {
                            const n = match[1];
                            const q = parseFloat(match[2]);
                            const inv = itemsList.find(i => i.name === n);
                            if (inv) m = { itemId: inv.id, qty: q, value: q * (inv.unitPrice || 0) };
                        }
                    } else if (a.action === 'INVENTORY_RESTOCK') {
                        const match = a.details.match(/Added (\d+(\.\d+)?) to .*?\((.*?)\)/);
                        if (match) {
                            const q = parseFloat(match[1]);
                            const id = match[3];
                            const inv = itemsList.find(i => i.id === id);
                            if (inv) m = { itemId: id, qty: q, value: q * (inv.unitPrice || 0) };
                        }
                    }
                }

                if (m && m.itemId) {
                    if (fItem && !isItemMatch(m.itemId)) return;
                    const inv = itemsList.find(i => i.id === m.itemId);
                    financialAdded.push({
                        date: a.timestamp,
                        itemName: inv ? inv.name : m.itemId,
                        operator: a.userName || a.username || 'System',
                        qty: m.qty || 0,
                        price: inv ? (inv.unitPrice || 0) : 0,
                        value: m.value || 0
                    });
                }
            }
        });

        return {
            totalActions: periodAudit.length + periodReqs.length,
            itemsTaken: itemsTakenQty,
            uniqueStaff: Object.keys(staffMap).length,
            staffMap,
            itemsMap,
            financialTaken,
            financialAdded
        };
    },

    calculateMetrics: function() {
        const sa = document.getElementById('dash-start-a').value;
        const ea = document.getElementById('dash-end-a').value;
        const sb = document.getElementById('dash-start-b').value;
        const eb = document.getElementById('dash-end-b').value;
        const fItem = (document.getElementById('dash-filter-item')?.value || '').toLowerCase();
        const fOp = (document.getElementById('dash-filter-operator')?.value || '').toLowerCase();

        if(!sa || !ea || !sb || !eb) return alert("All date fields are required!");

        const A = this.parseData(sa, ea, fItem, fOp);
        const B = this.parseData(sb, eb, fItem, fOp);

        const renderTrend = (valA, valB) => {
            if(valB === 0 && valA === 0) return '<span style="font-size:12px; color:var(--text-muted)">0% (No Data)</span>';
            if(valB === 0) return '<span style="font-size:12px; color:var(--success)">+100% ▲</span>';
            const pct = ((valA - valB) / valB) * 100;
            const color = pct >= 0 ? 'var(--success)' : 'var(--danger)';
            const icon = pct >= 0 ? '▲' : '▼';
            return `<span style="font-size:12px; color:${color}; font-weight:600">${pct > 0 ? '+' : ''}${pct.toFixed(1)}% ${icon}</span>`;
        };

        const metricsHtml = `
            <div class="stat-card">
                <h3>Total Logged Actions</h3>
                <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                    <div class="val">${A.totalActions}</div>
                    ${renderTrend(A.totalActions, B.totalActions)}
                </div>
            </div>
            <div class="stat-card">
                <h3>Total Items Taken/Approved</h3>
                <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                    <div class="val" style="color:var(--warning)">${A.itemsTaken}</div>
                    ${renderTrend(A.itemsTaken, B.itemsTaken)}
                </div>
            </div>
            <div class="stat-card">
                <h3>Unique Active Operators</h3>
                <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                    <div class="val" style="color:var(--primary)">${A.uniqueStaff}</div>
                    ${renderTrend(A.uniqueStaff, B.uniqueStaff)}
                </div>
            </div>
        `;

        document.getElementById('dash-metrics').innerHTML = metricsHtml;

        // Populate Top Staff A (display as title-case for readability)
        const toTitleCase = (s) => s.replace(/\b\w/g, c => c.toUpperCase());
        const sortedStaff = Object.keys(A.staffMap).map(k => ({name: toTitleCase(k), val: A.staffMap[k]})).sort((a,b)=>b.val-a.val);
        document.getElementById('dash-top-staff').innerHTML = sortedStaff.slice(0, 5).map(s => `
            <tr>
                <td><strong>${s.name}</strong></td>
                <td><span class="badge">${s.val} Actions</span></td>
            </tr>
        `).join('') || '<tr><td colspan="2" style="color:var(--text-muted)">No staff activity found.</td></tr>';

        // Populate Top Items A
        const sortedItems = Object.keys(A.itemsMap).map(k => ({name: k, val: A.itemsMap[k]})).sort((a,b)=>b.val-a.val);
        document.getElementById('dash-top-items').innerHTML = sortedItems.slice(0, 5).map(i => `
            <tr>
                <td><strong>${i.name}</strong></td>
                <td style="color:var(--danger); font-weight:bold">${i.val} Taken</td>
            </tr>
        `).join('') || '<tr><td colspan="2" style="color:var(--text-muted)">No item movement found.</td></tr>';
        
        // Populate Financial Taken Table
        document.getElementById('dash-fin-taken').innerHTML = A.financialTaken.sort((a,b) => new Date(b.date) - new Date(a.date)).map(f => `
            <tr>
                <td style="font-size:12px; color:var(--text-muted)">${new Date(f.date).toLocaleDateString()}</td>
                <td><strong>${f.itemName}</strong></td>
                <td>${f.operator}</td>
                <td>${f.qty}</td>
                <td>$${f.price.toFixed(2)}</td>
                <td style="color:var(--danger); font-weight:bold">-$${f.value.toFixed(2)}</td>
            </tr>
        `).join('') || '<tr><td colspan="6" style="color:var(--text-muted)">No items taken matching filters in this period.</td></tr>';
        
        // Populate Financial Added Table
        document.getElementById('dash-fin-added').innerHTML = A.financialAdded.sort((a,b) => new Date(b.date) - new Date(a.date)).map(f => `
            <tr>
                <td style="font-size:12px; color:var(--text-muted)">${new Date(f.date).toLocaleDateString()}</td>
                <td><strong>${f.itemName}</strong></td>
                <td>${f.operator}</td>
                <td>${f.qty}</td>
                <td>$${f.price.toFixed(2)}</td>
                <td style="color:var(--success); font-weight:bold">+$${f.value.toFixed(2)}</td>
            </tr>
        `).join('') || '<tr><td colspan="6" style="color:var(--text-muted)">No stock added matching filters in this period.</td></tr>';
        
        this.renderChart(A, B);
    },

    renderChart: function(A, B) {
        const ctx = document.getElementById('dash-chart');
        if(!ctx) return;
        
        if(window.dashChartInstance) {
            window.dashChartInstance.destroy();
        }

        const data = {
            labels: ['Total Actions', 'Items Taken', 'Unique Operators'],
            datasets: [
                {
                    label: 'Primary Period (A)',
                    data: [A.totalActions, A.itemsTaken, A.uniqueStaff],
                    backgroundColor: 'hsla(var(--h), 100%, 60%, 0.8)',
                    borderColor: 'hsl(var(--h), 100%, 60%)',
                    borderWidth: 1
                },
                {
                    label: 'Comparison Period (B)',
                    data: [B.totalActions, B.itemsTaken, B.uniqueStaff],
                    backgroundColor: 'hsla(260, 85%, 65%, 0.5)',
                    borderColor: 'hsl(260, 85%, 65%)',
                    borderWidth: 1
                }

            ]
        };

        window.dashChartInstance = new Chart(ctx, {
            type: 'bar',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }
};
