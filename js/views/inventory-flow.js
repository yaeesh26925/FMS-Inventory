// views/inventory-flow.js
window['inventory-flowView'] = {
    // Save filter state globally on the view object to survive database updates/re-renders
    _filters: {
        user: 'All',
        purpose: 'All',
        startDate: '',
        endDate: ''
    },

    render: function() {
        const container = document.getElementById('module-inventory-flow');
        if (!container) return;
        
        const users = window.stateManager.get('users');
        const requests = window.stateManager.get('requests');
        const items = window.stateManager.get('inventory');

        // Extract and deduplicate users who have actually requested or taken items
        const rawRequesters = requests.map(r => r.userName || r.username).filter(Boolean);
        const registeredUserNames = users.map(u => u.name).filter(Boolean);
        const combinedRequesters = [...new Set([...rawRequesters, ...registeredUserNames])];
        combinedRequesters.sort((a, b) => a.localeCompare(b));

        // Extract and deduplicate work purposes (from state default and actual requests)
        const statePurposes = window.stateManager.get('purposes') || [];
        const rawRequestPurposes = requests.map(r => r.purpose).filter(Boolean);
        const combinedPurposes = [...new Set([...statePurposes, ...rawRequestPurposes])];
        combinedPurposes.sort((a, b) => a.localeCompare(b));

        // Admins with access to approve requests
        const approverAdmins = users.filter(u => (['System Admin', 'Admin', 'Owner'].includes(u.userType)) && u.requestPerm === 'Edit');

        let html = `
            <div class="header-row">
                <div></div>
                <button class="btn btn-back" onclick="window.appEngine.navigate('management')" style="width:auto">⬅️ Back to Management</button>
            </div>

            <!-- PREMIUM METRIC CARDS ROW -->
            <div class="grid" style="margin-bottom: 24px;">
                <div class="stat-card" style="background: linear-gradient(135deg, var(--surface), rgba(59,130,246,0.12)); border: 1px solid var(--glass-border);">
                    <h3>Total Released Value</h3>
                    <div class="val" id="flow-consumption-value" style="color:var(--primary); font-size:32px; font-weight:900;">$0.00</div>
                    <p style="color:var(--text-muted); font-size:12px; margin-top:6px;">Calculated from item unit costs (claimed requests).</p>
                </div>
                <div class="stat-card" style="background: linear-gradient(135deg, var(--surface), rgba(34,197,94,0.12)); border: 1px solid var(--glass-border);">
                    <h3>Total Released Quantity</h3>
                    <div class="val" id="flow-consumption-qty" style="color:var(--success); font-size:32px; font-weight:900;">0 units</div>
                    <p style="color:var(--text-muted); font-size:12px; margin-top:6px;">Aggregated physical stock distributed.</p>
                </div>
            </div>

            <!-- DYNAMIC CONSUMPTION FILTERS CARD -->
            <div class="card" style="margin-bottom: 24px; padding: 24px;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:18px;">
                    <h2 style="margin:0;">📊 Consumption & Spend Analysis</h2>
                    <button class="btn btn-secondary btn-sm" onclick="window['inventory-flowView'].clearFilters()" style="padding:6px 12px; font-size:12px; border-radius:6px; border:1px solid var(--glass-border); color:var(--text-main); cursor:pointer;">🧹 Clear Filters</button>
                </div>
                
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px;">
                    <div class="input-group" style="margin-bottom:0;">
                        <label style="font-size:12px; color:var(--text-muted); font-weight:600; margin-bottom:6px; display:block;">👤 Filter by Requester</label>
                        <select id="flow-filter-user" style="width:100%; padding:10px; border-radius:var(--radius-md); border:1px solid var(--glass-border); background:var(--surface); color:var(--text-main); font-weight:500;" onchange="window['inventory-flowView'].updateFilter('user', this.value)">
                            <option value="All">All Requesters</option>
                            ${combinedRequesters.map(u => `<option value="${u}">${u}</option>`).join('')}
                        </select>
                    </div>

                    <div class="input-group" style="margin-bottom:0;">
                        <label style="font-size:12px; color:var(--text-muted); font-weight:600; margin-bottom:6px; display:block;">🛠️ Filter by Work Purpose</label>
                        <select id="flow-filter-purpose" style="width:100%; padding:10px; border-radius:var(--radius-md); border:1px solid var(--glass-border); background:var(--surface); color:var(--text-main); font-weight:500;" onchange="window['inventory-flowView'].updateFilter('purpose', this.value)">
                            <option value="All">All Purposes</option>
                            ${combinedPurposes.map(p => `<option value="${p}">${p}</option>`).join('')}
                        </select>
                    </div>

                    <div class="input-group" style="margin-bottom:0;">
                        <label style="font-size:12px; color:var(--text-muted); font-weight:600; margin-bottom:6px; display:block;">📅 Start Date</label>
                        <input type="date" id="flow-filter-start" style="width:100%; padding:10px; border-radius:var(--radius-md); border:1px solid var(--glass-border); background:var(--surface); color:var(--text-main); font-weight:500;" onchange="window['inventory-flowView'].updateFilter('startDate', this.value)">
                    </div>

                    <div class="input-group" style="margin-bottom:0;">
                        <label style="font-size:12px; color:var(--text-muted); font-weight:600; margin-bottom:6px; display:block;">📅 End Date</label>
                        <input type="date" id="flow-filter-end" style="width:100%; padding:10px; border-radius:var(--radius-md); border:1px solid var(--glass-border); background:var(--surface); color:var(--text-main); font-weight:500;" onchange="window['inventory-flowView'].updateFilter('endDate', this.value)">
                    </div>
                </div>
            </div>

            <!-- DETAILED CONSUMPTION REGISTER -->
            <div class="card" style="margin-bottom: 24px;">
                <h2 style="margin-bottom:16px;">Detailed Consumption Register</h2>
                <div class="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Requested By</th>
                                <th>Item Name</th>
                                <th>Qty Released</th>
                                <th>Unit Price</th>
                                <th>Total Cost</th>
                                <th>Work Purpose</th>
                                <th>Fulfillment Admin</th>
                            </tr>
                        </thead>
                        <tbody id="flow-consumption-tbody">
                            <!-- Injected by filterConsumption -->
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Expandable Admins Section (Moved to maintain cleaner page focus) -->
            <div class="card" style="border-left: 3px solid var(--primary); padding: 16px;">
                <details>
                    <summary style="cursor:pointer; outline:none; user-select:none; font-weight:bold; color:var(--primary);">
                        🛡️ Admins Authorized to Approve Deductions (${approverAdmins.length})
                    </summary>
                    <p style="color:var(--text-muted); font-size:13px; margin: 12px 0;">The following administrators have permissions to approve deductions directly.</p>
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Phone</th>
                                    <th>RC Number</th>
                                    <th>User Type</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${approverAdmins.length > 0 ? approverAdmins.map(a => `
                                    <tr>
                                        <td><strong>${a.name || 'N/A'}</strong></td>
                                        <td>${a.phone || 'N/A'}</td>
                                        <td>${a.rcNumber || 'N/A'}</td>
                                        <td><span class="badge" style="background:var(--primary); color:white;">${a.userType}</span></td>
                                    </tr>
                                `).join('') : '<tr><td colspan="4" style="text-align:center;">No authorized admins found.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </details>
            </div>
        `;
        
        container.innerHTML = html;

        // Restore active selections in the DOM controls
        document.getElementById('flow-filter-user').value = this._filters.user;
        document.getElementById('flow-filter-purpose').value = this._filters.purpose;
        document.getElementById('flow-filter-start').value = this._filters.startDate;
        document.getElementById('flow-filter-end').value = this._filters.endDate;

        // Run calculation and filtering
        this.filterConsumption();
    },

    updateFilter: function(key, value) {
        this._filters[key] = value;
        this.filterConsumption();
    },

    clearFilters: function() {
        this._filters = {
            user: 'All',
            purpose: 'All',
            startDate: '',
            endDate: ''
        };

        // Update DOM inputs directly
        document.getElementById('flow-filter-user').value = 'All';
        document.getElementById('flow-filter-purpose').value = 'All';
        document.getElementById('flow-filter-start').value = '';
        document.getElementById('flow-filter-end').value = '';

        this.filterConsumption();
    },

    filterConsumption: function() {
        const requests = window.stateManager.get('requests');
        const items = window.stateManager.get('inventory');
        const tbody = document.getElementById('flow-consumption-tbody');
        if (!tbody) return;

        // Parse filters
        const fUser = this._filters.user;
        const fPurpose = this._filters.purpose;
        const fStartStr = this._filters.startDate;
        const fEndStr = this._filters.endDate;

        // Establish Date Objects for local timezone day boundary checks
        const fStart = fStartStr ? new Date(fStartStr + 'T00:00:00') : null;
        const fEnd = fEndStr ? new Date(fEndStr + 'T23:59:59') : null;

        // Filter for "Released" items (CLAIMED or APPROVED status)
        const releasedRequests = requests.filter(r => ['CLAIMED', 'APPROVED'].includes(r.status));

        // Match filters
        const filtered = releasedRequests.filter(req => {
            // User filter
            const reqUser = req.userName || req.username;
            if (fUser !== 'All' && reqUser !== fUser) return false;

            // Purpose filter
            if (fPurpose !== 'All' && req.purpose !== fPurpose) return false;

            // Date filter
            const reqDate = req.claimedAt ? new Date(req.claimedAt) : new Date(req.timestamp);
            if (fStart && reqDate < fStart) return false;
            if (fEnd && reqDate > fEnd) return false;

            return true;
        });

        // Sort by Date (newest released first)
        filtered.sort((a, b) => {
            const dateA = a.claimedAt ? new Date(a.claimedAt) : new Date(a.timestamp);
            const dateB = b.claimedAt ? new Date(b.claimedAt) : new Date(b.timestamp);
            return dateB - dateA;
        });

        // Compute metrics
        let totalValue = 0;
        let totalQty = 0;

        const rowsHTML = filtered.map(req => {
            const item = items.find(i => i.id === req.itemId);
            const itemName = item ? item.name : 'Unknown Item';
            const unitPrice = item ? (item.unitPrice || 0) : 0;
            const lineCost = req.qty * unitPrice;

            totalValue += lineCost;
            totalQty += req.qty;

            const dateStr = req.claimedAt ? new Date(req.claimedAt).toLocaleString() : (req.timestamp ? new Date(req.timestamp).toLocaleString() : 'N/A');

            return `
                <tr>
                    <td style="font-size:12px; color:var(--text-muted)">${dateStr}</td>
                    <td><strong>${req.userName || req.username}</strong></td>
                    <td>${itemName}</td>
                    <td style="font-weight:bold;">${req.qty}</td>
                    <td>$${unitPrice.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                    <td style="color:var(--primary); font-weight:bold;">$${lineCost.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                    <td><span class="badge" style="background:hsla(210, 100%, 60%, 0.1); color:var(--primary); border:none; padding:4px 8px; border-radius:4px; font-size:11px;">${req.purpose || 'N/A'}</span></td>
                    <td><strong>${req.actionedBy || '—'}</strong></td>
                </tr>
            `;
        }).join('');

        // Inject table rows
        tbody.innerHTML = rowsHTML || `<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--text-muted);">No matching consumption records found.</td></tr>`;

        // Update metric display elements
        const valEl = document.getElementById('flow-consumption-value');
        const qtyEl = document.getElementById('flow-consumption-qty');

        if (valEl) {
            valEl.innerText = '$' + totalValue.toLocaleString(undefined, {minimumFractionDigits: 2});
        }
        if (qtyEl) {
            qtyEl.innerText = totalQty.toLocaleString() + ' units';
        }
    }
};
