// views/management.js
window.managementView = {
    currentTab: 'purposes',
    render: function() {
        const container = document.getElementById('module-management');
        const user = window.appEngine.currentUser;
        const canAdd = user.userType === 'Owner' || (user.userType === 'Admin' && user.permRestock === 'Edit') || user.permAddItem === 'Edit';
        
        const hasPerm = (key) => {
            if (user.userType === 'Owner') return true;
            const p = user[key];
            return p && p !== 'Non';
        };

        container.innerHTML = `
            <div class="header-row" style="margin-bottom: 24px;">
                <div></div>

                <div style="display:flex; gap:12px; flex-wrap:wrap;">
                    ${canAdd ? `<button class="btn btn-primary" onclick="managementView.showAddModal()" style="width:auto">➕ Add New Inventory Item</button>` : ''}
                </div>
            </div>
            
            <div class="mgmt-btn-grid">
                ${hasPerm('permRestock') ? `<button class="btn btn-primary" onclick="window.appEngine.navigate('correction')">📦 Restock Inventory</button>` : ''}
                ${hasPerm('permProcurement') ? `<button class="btn btn-primary" onclick="window.appEngine.navigate('procurement')">🏢 Open Procurement</button>` : ''}
                ${hasPerm('permDetailedInfo') ? `<button class="btn btn-primary" onclick="window.appEngine.navigate('financials')">📋 Detailed Info</button>` : ''}
                ${hasPerm('permAnalytics') ? `<button class="btn btn-primary" onclick="window.appEngine.navigate('dashboard')">📊 Analytics</button>` : ''}
                ${hasPerm('permTasks') ? `<button class="btn btn-primary" onclick="window.appEngine.navigate('tasks')">📋 Pending Work</button>` : ''}
                ${hasPerm('permReports') ? `<button class="btn btn-primary" onclick="window.appEngine.navigate('reports')">📜 Reports</button>` : ''}
                ${user.userType === 'Owner' ? `<button class="btn btn-primary" onclick="window.appEngine.navigate('inventory-flow')" style="background-color: var(--secondary); border-color: var(--secondary); color: white;">🌊 Inv. Flow</button>` : ''}
            </div>

            <!-- Management Tabs Panel -->
            <div class="card" style="margin-top: 32px;">
                <div class="mgt-tabs-row" style="display:flex; gap:24px; border-bottom:1px solid var(--glass-border); margin-bottom:24px;">
                    ${hasPerm('permWorkPurposes') ? `<div class="mgt-tab-btn" id="mgt-tab-btn-purposes" onclick="managementView.switchTab('purposes')" style="padding:12px 4px; cursor:pointer; font-weight:700; color:var(--primary); border-bottom:2px solid var(--primary);">⚙️ Work Purposes</div>` : ''}
                    ${hasPerm('permAuditLog') ? `<div class="mgt-tab-btn" id="mgt-tab-btn-audit" onclick="managementView.switchTab('audit')" style="padding:12px 4px; cursor:pointer; font-weight:700; color:var(--text-muted);">📜 Audit Log</div>` : ''}
                    ${user.userType === 'Owner' ? `<div class="mgt-tab-btn" id="mgt-tab-btn-users" onclick="managementView.switchTab('users')" style="padding:12px 4px; cursor:pointer; font-weight:700; color:var(--text-muted);">👥 User Management</div>` : ''}
                </div>

                <div id="mgt-tab-purposes" class="mgt-tab-content">
                    <h3>Manage Work Purposes</h3>
                    <p style="color:var(--text-muted); font-size:13px; margin-bottom:20px;">These purposes appear in the inventory request forms.</p>
                    ${(user.userType === 'Owner' || user.permWorkPurposes === 'Edit') ? `
                    <div style="display:flex; gap:12px; margin-bottom:24px; flex-wrap:wrap;">
                        <input type="text" id="mgt-new-purpose" placeholder="e.g. Corrective Maintenance" style="flex:1; min-width:260px; padding:12px; border-radius:var(--radius-md); border:1px solid var(--glass-border); background:hsla(0,0%,100%,0.05); color:var(--text-main);">
                        <button class="btn btn-primary" onclick="managementView.addPurpose()" style="width:auto">➕ Add Purpose</button>
                    </div>
                    ` : ''}
                    <div id="mgt-purposes-list" style="display:flex; flex-wrap:wrap; gap:10px;"></div>
                </div>

                <div id="mgt-tab-audit" class="mgt-tab-content" style="display:none;">
                    <h3>System Audit Log</h3>
                    <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:20px;">
                        <input type="text" id="audit-filter-operator" placeholder="Search Operator..." style="padding:10px; border-radius:var(--radius-md); border:1px solid var(--glass-border); background:hsla(0, 0%, 100%, 0.05); color:var(--text-main); flex:1; min-width:200px;" oninput="managementView.populateAudit()">
                        <select id="audit-filter-action" style="padding:10px; border-radius:var(--radius-md); border:1px solid var(--glass-border); background:hsla(0, 0%, 100%, 0.05); color:var(--text-main); flex:1; min-width:200px; cursor:pointer;" onchange="managementView.populateAudit()">
                            <option value="">All Actions</option>
                        </select>
                        <button class="btn btn-secondary" onclick="managementView.resetAuditFilters()" style="width:auto; padding:8px 16px;">✕</button>
                    </div>
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>Date & Time</th>
                                    <th>Admin</th>
                                    <th>Action</th>
                                    <th>Details</th>
                                </tr>
                            </thead>
                            <tbody id="audit-tbody"></tbody>
                        </table>
                    </div>
                </div>

                <div id="mgt-tab-users" class="mgt-tab-content" style="display:none;">
                    <div id="um-tab-content"></div>
                </div>
            </div>


            <!-- Add Item Modal -->
            <div id="mgt-modal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Add New Inventory Item</h2>
                        <span class="modal-close" onclick="managementView.closeAddModal()">&times;</span>
                    </div>
                    
                    <div class="input-group">
                        <label>Custom Inventory ID</label>
                        <input type="text" id="mgt-add-id" placeholder="e.g. INV-001" style="padding:12px; border-radius:var(--radius-md); border:1px solid var(--glass-border); background:hsla(0, 0%, 100%, 0.05); color:var(--text-main); width:100%">
                        <small style="color:var(--text-muted); font-size:11px;">Leave blank to auto-generate.</small>
                    </div>

                    <div class="input-group">
                        <label id="mgt-add-operator-label">Admin Name logging this item</label>
                        <input type="text" id="mgt-add-operator" placeholder="Your Name" style="padding:12px; border-radius:var(--radius-md); border:1px solid var(--glass-border); background:hsla(0, 0%, 100%, 0.05); color:var(--text-main); width:100%">
                    </div>


                    <div class="input-group">
                        <label>Item Name</label>
                        <input type="text" id="mgt-add-name" placeholder="e.g. Hydraulic Filter">
                    </div>
                    <div class="input-group">
                        <label>Description</label>
                        <input type="text" id="mgt-add-desc" placeholder="e.g. Engine compatible component">
                    </div>
                    <div class="input-group">
                        <label>Item Part Number (Code)</label>
                        <input type="text" id="mgt-add-code" placeholder="e.g. HF-2025">
                    </div>
                    <div class="input-group">
                        <label>GNS Code <span style="font-size:11px; color:var(--text-muted); font-weight:normal;">(Admin-only)</span></label>
                        <input type="text" id="mgt-add-gns" placeholder="e.g. GNS-2025-001" style="padding:12px; border-radius:var(--radius-md); border:1px solid var(--glass-border); background:hsla(0, 0%, 100%, 0.05); color:var(--text-main); width:100%">
                    </div>

                    <div class="input-group">
                        <label>Location</label>
                        <input type="text" id="mgt-add-loc" placeholder="e.g. Warehouse A">
                    </div>
                    <div style="display:flex; gap:16px;">
                        <div class="input-group" style="flex:1">
                            <label>Starting Quantity</label>
                            <input type="number" id="mgt-add-qty" min="0" value="0">
                        </div>
                        <div class="input-group" style="flex:1">
                            <label>Unit of Measure</label>
                            <select id="mgt-add-unit">
                                <option value="pcs">pcs (Pieces)</option>
                                <option value="set">set (Set)</option>
                                <option value="kgs">kgs (Kilograms)</option>
                                <option value="ltrs">ltrs (Litres)</option>
                                <option value="boxes">boxes (Boxes)</option>
                                <option value="rolls">rolls (Rolls)</option>
                                <option value="m">m (Metres)</option>
                                <option value="pair">pair (Pair)</option>
                            </select>
                        </div>
                        <div class="input-group" style="flex:1">
                            <label>Unit Price ($)</label>
                            <input type="number" id="mgt-add-price" min="0" step="0.01" value="0.00">
                        </div>
                    </div>
                    <div class="input-group">
                        <label>⚠️ Low Stock Alert Threshold</label>
                        <input type="number" id="mgt-add-alert" min="0" value="10" placeholder="e.g. 10 — alert when qty falls below this">
                        <small style="color:var(--text-muted); font-size:11px;">Item will be marked as Low Stock when quantity drops below this number.</small>
                    </div>
                    <button class="btn btn-primary mt-3" onclick="managementView.addItem()" style="font-size:16px; padding:12px">Save Part to Inventory</button>
                </div>
            </div>
        `;
        
        this.populateAudit();
        this.populatePurposesList();
        this.switchTab(this.currentTab);
    },

    switchTab: function(tab) {
        this.currentTab = tab;
        // Update button styles
        document.querySelectorAll('.mgt-tab-btn').forEach(btn => {
            btn.style.color = 'var(--text-muted)';
            btn.style.borderBottom = '2px solid transparent';
        });
        const activeBtn = document.getElementById('mgt-tab-btn-' + tab);
        if (activeBtn) {
            activeBtn.style.color = 'var(--primary)';
            activeBtn.style.borderBottom = '2px solid var(--primary)';
        }

        // Show/hide tab panels
        ['purposes', 'audit', 'users'].forEach(t => {
            const el = document.getElementById('mgt-tab-' + t);
            if (el) el.style.display = (t === tab) ? 'block' : 'none';
        });

        // Lazy-render User Management tab
        if (tab === 'users' && window.userManagementView) {
            window.userManagementView.renderTab();
        }
    },

    populatePurposesList: function() {
        const list = document.getElementById('mgt-purposes-list');
        if (!list) return;
        const user = window.appEngine.currentUser;
        const canEdit = user.userType === 'Owner' || user.permWorkPurposes === 'Edit';
        const purposes = window.stateManager.get('purposes').filter(p => p !== 'Other (Manual)');
        if (purposes.length === 0) {
            list.innerHTML = '<span style="color:var(--text-muted); font-size:13px;">No custom purposes yet. Add one above.</span>';
            return;
        }
        list.innerHTML = purposes.map(p => `
            <span style="display:inline-flex; align-items:center; gap:6px; background:hsla(0,0%,100%,0.08); border:1px solid var(--glass-border); border-radius:var(--radius-pill); padding:6px 12px; font-size:13px; font-weight:600; color:var(--text-main);">
                ${p}
                ${canEdit ? `<button onclick="managementView.removePurpose('${p.replace(/'/g,"\\'")}')" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:16px; line-height:1; padding:0; margin:0;">×</button>` : ''}
            </span>
        `).join('');
    },

    addPurpose: function() {
        const user = window.appEngine.currentUser;
        if (user.userType !== 'Owner' && user.permWorkPurposes !== 'Edit') {
            window.appEngine.showToast('Access Denied. You do not have permission to modify purposes.', 'danger');
            return;
        }
        const input = document.getElementById('mgt-new-purpose');
        const val = (input?.value || '').trim();
        if (!val) { window.appEngine.showToast('Please enter a purpose name.', 'warning'); return; }
        const purposes = window.stateManager.get('purposes');
        if (purposes.includes(val)) { window.appEngine.showToast('Purpose already exists.', 'warning'); return; }
        purposes.push(val);
        window.stateManager.set('purposes', purposes);
        if (input) input.value = '';
        this.populatePurposesList();
        window.appEngine.showToast(`"${val}" added to purposes.`, 'success');
    },

    removePurpose: function(purpose) {
        let purposes = window.stateManager.get('purposes');
        purposes = purposes.filter(p => p !== purpose);
        window.stateManager.set('purposes', purposes);
        this.populatePurposesList();
        window.appEngine.showToast(`"${purpose}" removed.`, 'warning');
    },

    populateAudit: function() {
        const audit = window.stateManager.get('audit');
        const tbody = document.getElementById('audit-tbody');
        const actionSelect = document.getElementById('audit-filter-action');
        if (!tbody) return;

        // Populate action category dropdown with unique values
        if (actionSelect) {
            const currentVal = actionSelect.value;
            const uniqueActions = [...new Set(audit.map(l => l.action))].sort();
            actionSelect.innerHTML = '<option value="">All Action Categories</option>' +
                uniqueActions.map(a => `<option value="${a}" ${a === currentVal ? 'selected' : ''}>${a}</option>`).join('');
        }

        const fOp = (document.getElementById('audit-filter-operator')?.value || '').trim().toLowerCase();
        const fAction = actionSelect?.value || '';

        const filtered = audit.filter(log => {
            const opMatch = !fOp || (log.userName || log.username || 'System').toLowerCase().includes(fOp);
            const actionMatch = !fAction || log.action === fAction;
            return opMatch && actionMatch;
        });

        tbody.innerHTML = filtered.map(log => `
            <tr>
                <td style="color:var(--text-muted); font-size:12px">${new Date(log.timestamp).toLocaleString()}</td>
                <td><strong>${log.userName || log.username || 'System'}</strong></td>
                <td><span class="badge">${log.action}</span></td>
                <td>${log.details}</td>
            </tr>
        `).join('') || '<tr><td colspan="4" style="text-align:center; padding:24px; color:var(--text-muted);">No audit entries match your filters.</td></tr>';
    },

    resetAuditFilters: function() {
        const opEl = document.getElementById('audit-filter-operator');
        const actionEl = document.getElementById('audit-filter-action');
        if (opEl) opEl.value = '';
        if (actionEl) actionEl.value = '';
        this.populateAudit();
    },

    showAddModal: function() {
        // Auto-fill admin name if logged in
        const opInput = document.getElementById('mgt-add-operator');
        const opLabel = document.getElementById('mgt-add-operator-label');
        if (window.appEngine && window.appEngine.currentUser) {
            const u = window.appEngine.currentUser;
            const displayName = u.name || u.phone || 'Admin';
            opInput.value = (displayName === 'undefined' || !displayName) ? 'Admin' : displayName;
            opInput.readOnly = true;
            opInput.style.opacity = '0.6';
            if (opLabel) opLabel.innerText = 'Logged in as';
        } else {
            opInput.value = '';
            opInput.readOnly = false;
            opInput.style.opacity = '1';
            if (opLabel) opLabel.innerText = 'Admin Name logging this item';
        }
        document.getElementById('mgt-modal').classList.add('active');
    },

    closeAddModal: function() {
        document.getElementById('mgt-modal').classList.remove('active');
        document.getElementById('mgt-add-id').value = '';
        document.getElementById('mgt-add-name').value = '';
        if(document.getElementById('mgt-add-desc')) document.getElementById('mgt-add-desc').value = '';
        document.getElementById('mgt-add-code').value = '';
        if(document.getElementById('mgt-add-gns')) document.getElementById('mgt-add-gns').value = '';
        document.getElementById('mgt-add-loc').value = '';
        document.getElementById('mgt-add-qty').value = '0';
        document.getElementById('mgt-add-unit').value = 'pcs';
        document.getElementById('mgt-add-price').value = '0.00';
        document.getElementById('mgt-add-alert').value = '10';
    },

    addItem: function() {
        const opName = document.getElementById('mgt-add-operator').value.trim();
        const customId = document.getElementById('mgt-add-id').value.trim();
        const name = document.getElementById('mgt-add-name').value;
        const desc = document.getElementById('mgt-add-desc').value;
        const codeInput = document.getElementById('mgt-add-code').value;
        const gnsCode = (document.getElementById('mgt-add-gns')?.value || '').trim();
        const loc = document.getElementById('mgt-add-loc').value;
        const qty = parseFloat(document.getElementById('mgt-add-qty').value);
        const unit = document.getElementById('mgt-add-unit').value;
        const price = parseFloat(document.getElementById('mgt-add-price').value);
        const alertThreshold = parseInt(document.getElementById('mgt-add-alert').value) || 10;

        if(!name || !opName) return alert('Operator Name and Item Name are required');
        if(qty<0 || price<0) return alert('Values cannot be negative');

        const items = window.stateManager.get('inventory');
            const code = codeInput.trim() !== '' ? codeInput : ('I' + Math.floor(Math.random()*10000).toString().padStart(4, '0'));

             // Check for duplicate Part Number (Code)
            if (codeInput.trim() !== '' && items.some(i => i.code === codeInput)) {
                return alert('This Part Number already exists. Please use a unique Part Number.');
            }

            const finalId = customId !== '' ? customId : ('ID-' + Date.now().toString().substr(-6) + Math.random().toString(36).substr(2,3).toUpperCase());

            const newItem = {
                id: finalId,
                code, name, description: desc, location: loc,
                quantity: qty, unitPrice: price, unit: unit,
                lowStockAlert: alertThreshold,
                gnsCode: gnsCode
            };
            items.push(newItem);
            window.stateManager.set('inventory', items);
            window.stateManager.logAudit('INVENTORY_ADD', `Added new item ${name} (${qty})`, {name: opName}, { itemId: finalId, qty: qty, value: qty * price });
            
            this.closeAddModal();
            window.appEngine.showToast(`${name} added to inventory successfully.`, 'success');
            
            // Refresh
            this.render();
    }
};


