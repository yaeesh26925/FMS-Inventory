// views/financials.js  — now "Detailed Inventory Info"
window.financialsView = {
    render: function() {
        const container = document.getElementById('module-financials');
        const isAdmin = !!(window.appEngine && window.appEngine.currentUser);
        
        const items = window.stateManager.get('inventory');
        let totalValue = 0;
        items.forEach(i => { totalValue += i.quantity * i.unitPrice; });

        const getStatus = (item) => {
            const threshold = item.lowStockAlert != null ? item.lowStockAlert : 10;
            if (item.quantity === 0) return 'Out of Stock';
            if (item.quantity < threshold) return 'Low Stock';
            return 'In Stock';
        };

        const lowStockItems = items.filter(i => getStatus(i) === 'Low Stock');
        const outOfStockItems = items.filter(i => getStatus(i) === 'Out of Stock');

        container.innerHTML = `
            <div class="header-row">
                <h1>Detailed Inventory Info</h1>
                <button class="btn btn-back" onclick="window.appEngine.navigate('management')" style="width:auto">⬅️ Back to Management</button>
            </div>
            
            <div class="grid">
                <div class="stat-card" style="background: linear-gradient(135deg, var(--surface), rgba(59,130,246,0.1));">
                    <h3>Estimated Inventory Value</h3>
                    <div class="val" style="color:var(--primary)">$${totalValue.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
                </div>
                <div class="stat-card" style="background: linear-gradient(135deg, var(--surface), rgba(34,197,94,0.1));">
                    <h3>Filtered Selection Value</h3>
                    <div class="val" style="color:var(--success)" id="fin-filtered-value">$${totalValue.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
                </div>
                <div class="stat-card" style="background: linear-gradient(135deg, var(--surface), rgba(234,179,8,0.1));">
                    <h3>Low Stock Items</h3>
                    <div class="val" style="color:var(--warning)">${lowStockItems.length}</div>
                </div>
                <div class="stat-card" style="background: linear-gradient(135deg, var(--surface), rgba(239,68,68,0.1));">
                    <h3>Out of Stock Items</h3>
                    <div class="val" style="color:var(--danger)">${outOfStockItems.length}</div>
                </div>
            </div>

            <!-- Low Stock Table -->
            ${lowStockItems.length > 0 ? `
            <div class="card" style="margin-top:24px; border-left: 3px solid var(--warning);">
                <details>
                    <summary style="cursor:pointer; outline:none; user-select:none;">
                        <h2 style="color:var(--warning); margin-bottom:4px; display:inline-block; margin-top:0;">⚠️ Low Stock Items</h2>
                    </summary>
                    <p style="color:var(--text-muted); font-size:12px; margin-top:8px; margin-bottom:16px;">Items approaching depletion — restock recommended.</p>
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>Inventory ID</th>
                                    <th>Item Name</th>
                                    <th>Part #</th>
                                    <th>Location</th>
                                    <th>Qty Available</th>
                                    <th>Alert Threshold</th>
                                    <th>Unit Price</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${lowStockItems.map(item => `
                                <tr>
                                    <td>${item.id}</td>
                                    <td><strong>${item.name}</strong></td>
                                    <td>${item.code}</td>
                                    <td>${item.location}</td>
                                    <td style="color:var(--warning); font-weight:bold;">${item.quantity} ${item.unit||''}</td>
                                    <td>${item.lowStockAlert ?? 10}</td>
                                    <td>$${(item.unitPrice||0).toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                </details>
            </div>` : ''}

            <!-- Out of Stock Table -->
            ${outOfStockItems.length > 0 ? `
            <div class="card" style="margin-top:24px; border-left: 3px solid var(--danger);">
                <details>
                    <summary style="cursor:pointer; outline:none; user-select:none;">
                        <h2 style="color:var(--danger); margin-bottom:4px; display:inline-block; margin-top:0;">🔴 Out of Stock Items</h2>
                    </summary>
                    <p style="color:var(--text-muted); font-size:12px; margin-top:8px; margin-bottom:16px;">These items have zero quantity — immediate restock required.</p>
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>Inventory ID</th>
                                    <th>Item Name</th>
                                    <th>Part #</th>
                                    <th>Location</th>
                                    <th>Unit Price</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${outOfStockItems.map(item => `
                                <tr>
                                    <td>${item.id}</td>
                                    <td><strong>${item.name}</strong></td>
                                    <td>${item.code}</td>
                                    <td>${item.location}</td>
                                    <td>$${(item.unitPrice||0).toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                </details>
            </div>` : ''}

            <div class="card" style="margin-top:24px;">
                <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                        <h2>Complete Asset Register</h2>
                        <div style="display:flex; gap:12px; flex:1; max-width:600px; justify-content:flex-end;">
                            <select id="fin-sort-id" style="padding:8px; border-radius:6px; border:1px solid var(--border); background:var(--bg-color); color:var(--text-primary); min-width:140px;" onchange="financialsView.populateTable()">
                                <option value="default">Sort ID: Default</option>
                                <option value="asc">Sort ID: A → Z</option>
                                <option value="desc">Sort ID: Z → A</option>
                            </select>
                            <input type="text" id="financial-search" placeholder="Search all fields..." style="padding:8px; border-radius:6px; border:1px solid var(--border); background:var(--bg-color); color:var(--text-primary); flex:1; max-width:300px;" onkeyup="financialsView.populateTable()">
                        </div>
                    </div>
                    <p style="color:var(--text-muted); font-size:12px;">This detailed asset register isolates financial data from general operators. Modifications to average unit cost can be performed directly on Google Sheets.</p>
                </div>
                <div class="table-responsive">
                    <table id="fin-asset-table">
                        <thead>
                            <tr>
                                <th>Inventory ID</th>
                                <th>Item Name</th>
                                <th>Description</th>
                                <th>Part Number</th>
                                ${isAdmin ? '<th>GNS Code</th>' : ''}
                                <th>Location</th>
                                <th>Qty Available</th>
                                <th>Status</th>
                                <th>Unit Price ($)</th>
                                <th>Total Line Value</th>
                            </tr>
                            <tr id="fin-header-filter-row" style="background:var(--bg-color);">
                                <td><input type="text" placeholder="Filter ID..." data-col="id" class="fin-col-filter" style="width:100%; padding:4px 6px; border-radius:4px; border:1px solid var(--border); background:var(--surface); color:var(--text-primary); font-size:11px;" oninput="financialsView.populateTable()"></td>
                                <td><input type="text" placeholder="Filter Name..." data-col="name" class="fin-col-filter" style="width:100%; padding:4px 6px; border-radius:4px; border:1px solid var(--border); background:var(--surface); color:var(--text-primary); font-size:11px;" oninput="financialsView.populateTable()"></td>
                                <td><input type="text" placeholder="Filter Desc..." data-col="description" class="fin-col-filter" style="width:100%; padding:4px 6px; border-radius:4px; border:1px solid var(--border); background:var(--surface); color:var(--text-primary); font-size:11px;" oninput="financialsView.populateTable()"></td>
                                <td><input type="text" placeholder="Filter Part #..." data-col="code" class="fin-col-filter" style="width:100%; padding:4px 6px; border-radius:4px; border:1px solid var(--border); background:var(--surface); color:var(--text-primary); font-size:11px;" oninput="financialsView.populateTable()"></td>
                                ${isAdmin ? '<td><input type="text" placeholder="Filter GNS..." data-col="gnsCode" class="fin-col-filter" style="width:100%; padding:4px 6px; border-radius:4px; border:1px solid var(--border); background:var(--surface); color:var(--text-primary); font-size:11px;" oninput="financialsView.populateTable()"></td>' : ''}
                                <td><input type="text" placeholder="Filter Location..." data-col="location" class="fin-col-filter" style="width:100%; padding:4px 6px; border-radius:4px; border:1px solid var(--border); background:var(--surface); color:var(--text-primary); font-size:11px;" oninput="financialsView.populateTable()"></td>
                                <td><input type="text" placeholder="Filter Qty..." data-col="quantity" class="fin-col-filter" style="width:100%; padding:4px 6px; border-radius:4px; border:1px solid var(--border); background:var(--surface); color:var(--text-primary); font-size:11px;" oninput="financialsView.populateTable()"></td>
                                <td><input type="text" placeholder="Filter Status..." data-col="status" class="fin-col-filter" style="width:100%; padding:4px 6px; border-radius:4px; border:1px solid var(--border); background:var(--surface); color:var(--text-primary); font-size:11px;" oninput="financialsView.populateTable()"></td>
                                <td><input type="text" placeholder="Filter Price..." data-col="unitPrice" class="fin-col-filter" style="width:100%; padding:4px 6px; border-radius:4px; border:1px solid var(--border); background:var(--surface); color:var(--text-primary); font-size:11px;" oninput="financialsView.populateTable()"></td>
                                <td><input type="text" placeholder="Filter Value..." data-col="totalValue" class="fin-col-filter" style="width:100%; padding:4px 6px; border-radius:4px; border:1px solid var(--border); background:var(--surface); color:var(--text-primary); font-size:11px;" oninput="financialsView.populateTable()"></td>
                            </tr>
                        </thead>
                        <tbody id="financial-inventory-tbody"></tbody>
                    </table>
                </div>
            </div>
        `;

        this.populateTable();
    },

    populateTable: function() {
        const isAdmin = !!(window.appEngine && window.appEngine.currentUser);
        const items = window.stateManager.get('inventory');
        const search = (document.getElementById('financial-search')?.value || '').toLowerCase();

        const getStatus = (item) => {
            const threshold = item.lowStockAlert != null ? item.lowStockAlert : 10;
            if (item.quantity === 0) return 'Out of Stock';
            if (item.quantity < threshold) return 'Low Stock';
            return 'In Stock';
        };

        // Gather per-column filter values
        const colFilters = {};
        document.querySelectorAll('.fin-col-filter').forEach(input => {
            colFilters[input.dataset.col] = (input.value || '').toLowerCase();
        });

        const filtered = items.filter(item => {
            const status = getStatus(item);
            const totalPrice = item.quantity * item.unitPrice;

            // Global search — includes ALL fields including gnsCode and description
            const searchFields = [
                item.id,
                item.name,
                item.description || '',
                item.code,
                item.location || '',
                String(item.quantity),
                item.unit || '',
                item.unitPrice.toString(),
                totalPrice.toString(),
                item.gnsCode || '',
                status
            ];
            const matchSearch = !search || searchFields.some(f => String(f || '').toLowerCase().includes(search));

            // Per-column filters
            const colData = {
                id: item.id,
                name: item.name,
                description: item.description || '',
                code: item.code,
                gnsCode: item.gnsCode || '',
                location: item.location || '',
                quantity: String(item.quantity) + ' ' + (item.unit || ''),
                status: status,
                unitPrice: item.unitPrice.toFixed(2),
                totalValue: totalPrice.toFixed(2)
            };
            const matchCols = Object.keys(colFilters).every(col => {
                const f = colFilters[col];
                if (!f) return true;
                return String(colData[col] || '').toLowerCase().includes(f);
            });

            return matchSearch && matchCols;
        });

        // Sort by Inventory ID
        const sortId = document.getElementById('fin-sort-id')?.value || 'default';
        if (sortId === 'asc') {
            filtered.sort((a, b) => a.id.localeCompare(b.id, undefined, {numeric: true, sensitivity: 'base'}));
        } else if (sortId === 'desc') {
            filtered.sort((a, b) => b.id.localeCompare(a.id, undefined, {numeric: true, sensitivity: 'base'}));
        } else {
            // Default sort: highest total value first
            filtered.sort((a,b) => (b.quantity*b.unitPrice)-(a.quantity*a.unitPrice));
        }

        // Update filtered value card
        const filteredTotal = filtered.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
        const filteredCard = document.getElementById('fin-filtered-value');
        if (filteredCard) filteredCard.innerText = '$' + filteredTotal.toLocaleString(undefined, {minimumFractionDigits:2});

        const tbody = document.getElementById('financial-inventory-tbody');
        if(!tbody) return;

        tbody.innerHTML = filtered.map(item => {
            const totalPrice = item.quantity * item.unitPrice;
            const status = getStatus(item);
            let statusBadge = '<span class="status status-green">In Stock</span>';
            if (status === 'Out of Stock') statusBadge = '<span class="status status-red">Out of Stock</span>';
            else if (status === 'Low Stock') statusBadge = '<span class="status status-yellow">Low Stock</span>';

            return `
                <tr>
                    <td>${item.id}</td>
                    <td><strong>${item.name}</strong></td>
                    <td style="font-size:12px; color:var(--text-secondary); max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${item.description||''}">${item.description || '-'}</td>
                    <td>${item.code}</td>
                    ${isAdmin ? `<td style="color:var(--primary); font-weight:600;">${item.gnsCode || '-'}</td>` : ''}
                    <td>${item.location}</td>
                    <td style="font-weight:bold; color:${item.quantity===0?'var(--danger)':'inherit'}">${item.quantity} ${item.unit||''}</td>
                    <td>${statusBadge}</td>
                    <td>$${item.unitPrice.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                    <td style="color:var(--primary); font-weight:bold;">$${totalPrice.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                </tr>
            `;
        }).join('') || `<tr><td colspan="${isAdmin ? 9 : 8}" style="text-align:center; padding:16px; color:var(--text-muted);">No matching assets found.</td></tr>`;
    }
};
