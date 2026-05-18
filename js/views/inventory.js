// views/inventory.js
window.inventoryView = {
    render: function() {
        const container = document.getElementById('module-inventory');
        const user = window.appEngine.currentUser;
        const isAdmin = user && ['Admin', 'Owner', 'System Admin'].includes(user.userType);
        
        container.innerHTML = `
            <div class="header-row">
                <div></div>

                <div style="display:flex; gap:8px;"></div>
            </div>
            
            <div class="grid">
                <div class="stat-card">
                    <h3>Total Items Count</h3>
                    <div class="val" id="inv-stat-total">0</div>
                </div>
                ${isAdmin ? `
                <div class="stat-card">
                    <h3>Low Stock Alerts</h3>
                    <div class="val" id="inv-stat-low">0</div>
                </div>` : ''}
            </div>

            <div class="card">
                <div style="display:flex; justify-content:space-between; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
                    <input type="text" id="inv-search" placeholder="Search all fields..." style="padding:12px 18px; border-radius:var(--radius-md); border:1px solid var(--glass-border); background:hsla(0, 0%, 100%, 0.05); color:var(--text-main); flex:1; min-width:240px; font-size:15px;" onkeyup="inventoryView.populateTable()">
                    <select id="inv-sort-id" style="padding:12px; border-radius:var(--radius-md); border:1px solid var(--glass-border); background:hsla(0, 0%, 100%, 0.05); color:var(--text-main); cursor:pointer;" onchange="inventoryView.populateTable()">
                        <option value="default">Sort by ID: Default</option>
                        <option value="asc">Sort by ID: A → Z</option>
                        <option value="desc">Sort by ID: Z → A</option>
                    </select>
                    ${isAdmin ? `
                    <select id="inv-status-filter" style="padding:12px; border-radius:var(--radius-md); border:1px solid var(--glass-border); background:hsla(0, 0%, 100%, 0.05); color:var(--text-main); cursor:pointer;" onchange="inventoryView.populateTable()">
                        <option value="All">All Status</option>
                        <option value="In Stock">In Stock</option>
                        <option value="Low Stock">Low Stock</option>
                        <option value="Out of Stock">Out of Stock</option>
                    </select>
                    ` : ''}
                </div>
                <div class="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>Inventory ID</th>
                                <th>Item Name</th>
                                <th>Description</th>
                                <th>Part #</th>
                                <th>Location</th>
                                <th>Qty Available</th>
                                ${isAdmin ? '<th>Status</th>' : ''}
                                <th>Actions</th>
                            </tr>
                            <!-- Removed column filters from headers as per request -->
                        </thead>
                        <tbody id="inventory-tbody"></tbody>
                    </table>
                </div>
            </div>

            
            <!-- Unified Request / Take Modal -->
            <div id="inv-req-modal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Request / Take Item</h2>
                        <span class="modal-close" onclick="inventoryView.closeReqModal()">&times;</span>
                    </div>
                    <p style="margin-bottom:16px; color:var(--primary)" id="inv-req-itemName"></p>
                    <input type="hidden" id="inv-req-itemId">
                    
                    <div class="input-group">
                        <label>RC Number</label>
                        <input type="text" id="inv-req-rc" placeholder="Enter RC Number" oninput="inventoryView.lookupRC(this.value)">
                    </div>

                    <div class="input-group">
                        <label>Your Name</label>
                        <input type="text" id="inv-req-name" placeholder="Name will appear here" readonly style="background:var(--bg-muted); opacity:0.8; cursor:not-allowed;">
                    </div>

                    <div class="input-group">
                        <label>Action</label>
                        <select id="inv-req-action">
                            <option value="request">Submit Request (Wait for Approval)</option>
                            <option value="take">Take Immediately (Subtract Stock)</option>
                        </select>
                    </div>

                    <div class="input-group">
                        <label>Quantity</label>
                        <input type="number" id="inv-req-qty" min="1" value="1">
                    </div>

                    <div class="input-group">
                        <label>Work Purpose</label>
                        <select id="inv-req-purpose" onchange="inventoryView.toggleCustomPurpose(this.value, 'inv-req-custom-purpose-ctr')"></select>
                    </div>
                    
                    <div class="input-group" id="inv-req-custom-purpose-ctr" style="display:none; margin-top:-8px; margin-bottom:16px;">
                        <input type="text" id="inv-req-custom-purpose" placeholder="Type custom purpose here...">
                    </div>

                    <button class="btn btn-primary mt-3" onclick="inventoryView.submitFastAction()">Confirm Action</button>
                </div>
            </div>
        `;
        
        this.populateLocations();
        this.populateTable();
        this.populatePurposes('inv-req-purpose');
    },

    populatePurposes: function(selectId) {
        let purposes = window.stateManager.get('purposes');
        if(!purposes.includes('Other (Manual)')) purposes.push('Other (Manual)');
        const purposeSelect = document.getElementById(selectId);
        if(purposeSelect) {
            purposeSelect.innerHTML = purposes.map(p => `<option value="${p}">${p}</option>`).join('');
        }
    },

    toggleCustomPurpose: function(val, targetCtrId) {
        document.getElementById(targetCtrId).style.display = (val === 'Other (Manual)') ? 'block' : 'none';
    },

    populateLocations: function() {
        // Status filter is static — no population needed
    },

    populateTable: function() {
        const user = window.appEngine.currentUser;
        const isAdmin = user && ['Admin', 'Owner', 'System Admin'].includes(user.userType);
        const items = window.stateManager.get('inventory');
        const search = (document.getElementById('inv-search')?.value || '').toLowerCase();
        const statusFilter = document.getElementById('inv-status-filter')?.value || 'All';

        // Gather per-column filter values
        const colFilters = {};
        document.querySelectorAll('.inv-col-filter').forEach(input => {
            const col = input.dataset.col;
            colFilters[col] = input.value.toLowerCase();
        });

        const getStatus = (item) => {
            const threshold = item.lowStockAlert != null ? item.lowStockAlert : 10;
            if (item.quantity === 0) return 'Out of Stock';
            if (item.quantity < threshold) return 'Low Stock';
            return 'In Stock';
        };
        
        let lowStockCount = 0;

        const filtered = items.filter(item => {
            const itemStatus = getStatus(item);

            // Global search
            const searchFields = [
                item.id,
                item.name,
                item.description || '',
                item.code,
                item.location || '',
                String(item.quantity),
                item.unit || ''
            ];
            if (isAdmin) searchFields.push(itemStatus);
            
            const matchSearch = !search || searchFields.some(field => String(field || '').toLowerCase().includes(search));

            const matchStatus = statusFilter === 'All' || itemStatus === statusFilter;

            // Per-column filters
            const colValues = [
                item.id,
                item.name,
                item.description || '',
                item.code,
                item.location || '',
                String(item.quantity) + ' ' + (item.unit || ''),
                itemStatus
            ];
            const matchCols = Object.keys(colFilters).every(col => {
                const f = colFilters[col];
                if (!f) return true;
                return String(colValues[col] || '').toLowerCase().includes(f);
            });

            return matchSearch && matchStatus && matchCols;
        });

        // Sort by Inventory ID
        const sortId = document.getElementById('inv-sort-id')?.value || 'default';
        if (sortId === 'asc') {
            filtered.sort((a, b) => a.id.localeCompare(b.id, undefined, {numeric: true, sensitivity: 'base'}));
        } else if (sortId === 'desc') {
            filtered.sort((a, b) => b.id.localeCompare(a.id, undefined, {numeric: true, sensitivity: 'base'}));
        }

        const tbody = document.getElementById('inventory-tbody');
        if(!tbody) return;

        tbody.innerHTML = filtered.map(item => {
            const itemStatus = getStatus(item);
            if(itemStatus === 'Low Stock') lowStockCount++;
            
            let statusBadge = '<span class="status status-green">In Stock</span>';
            if (itemStatus === 'Out of Stock') statusBadge = '<span class="status status-red">Out of Stock</span>';
            else if (itemStatus === 'Low Stock') statusBadge = '<span class="status status-yellow">Low Stock</span>';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.id}</td>
                <td><strong>${item.name}</strong></td>
                <td>${item.description || ''}</td>
                <td>${item.code}</td>
                <td>${item.location}</td>
                <td style="font-weight:bold; color:${item.quantity===0?'var(--danger)':'inherit'}">${item.quantity} ${item.unit||''}</td>
                ${isAdmin ? `<td>${statusBadge}</td>` : ''}
                <td>
                    <button class="btn btn-sm btn-success" onclick="inventoryView.openReqModal('${item.id}', '${item.name}', ${item.quantity})" ${item.quantity===0?'disabled':''}>Request / Take</button>
                </td>
            `;
            return tr.outerHTML;
        }).join('');

        document.getElementById('inv-stat-total').innerText = items.length;
        const lowEl = document.getElementById('inv-stat-low');
        if (lowEl) {
            const oosCount = items.filter(i => getStatus(i) === 'Out of Stock').length;
            lowEl.innerHTML = `<span style="color:var(--warning)">${lowStockCount}</span>` + (oosCount > 0 ? ` <span style="color:var(--danger)">(${oosCount} OOS)</span>` : '');
        }
    },

    openReqModal: function(id, name, availableQty) {
        document.getElementById('inv-req-itemId').value = id;
        document.getElementById('inv-req-itemName').innerText = "Target: " + name;
        const qtyEl = document.getElementById('inv-req-qty');
        qtyEl.value = 1;
        qtyEl.max = availableQty;
        document.getElementById('inv-req-custom-purpose').value = '';
        this.toggleCustomPurpose(document.getElementById('inv-req-purpose').value, 'inv-req-custom-purpose-ctr');
        
        // Handle RC and Name field states
        const nameInput = document.getElementById('inv-req-name');
        const rcInput = document.getElementById('inv-req-rc');
        const nameLabel = nameInput.previousElementSibling;
        const rcGroup = rcInput.parentElement;
        
        if (window.appEngine && window.appEngine.currentUser) {
            const u = window.appEngine.currentUser;
            const displayName = u.name || u.phone || 'Admin';
            nameInput.value = (displayName === 'undefined' || !displayName) ? 'Admin' : displayName;
            rcGroup.style.display = 'none';
            if (nameLabel) nameLabel.innerText = 'Logged in as';
        } else {
            nameInput.value = '';
            rcInput.value = '';
            rcGroup.style.display = 'block';
            if (nameLabel) nameLabel.innerText = 'Your Name';
        }
        
        const actionSelect = document.getElementById('inv-req-action');
        const user = window.appEngine.currentUser;
        if (!user) return;

        // Owners can take immediately; Admins and System Admins need permTakeImmediately === 'Edit'; Standard needs requestPerm === 'Edit'
        const canTake = (user.userType === 'Owner') || 
                        (['System Admin', 'Admin'].includes(user.userType) && user.permTakeImmediately === 'Edit') || 
                        (user.userType === 'Standard' && user.requestPerm === 'Edit');
        
        if (!user || !canTake) {
            actionSelect.innerHTML = '<option value="request">Submit Request (Wait for Approval)</option>';
        } else {
            actionSelect.innerHTML = `
                <option value="request">Submit Request (Wait for Approval)</option>
                <option value="take">Take Immediately (Subtract Stock)</option>
            `;
        }
        
        document.getElementById('inv-req-modal').classList.add('active');
    },

    closeReqModal: function() {
        document.getElementById('inv-req-modal').classList.remove('active');
    },

    submitFastAction: function() {
        const itemId = document.getElementById('inv-req-itemId').value;
        const qty = parseInt(document.getElementById('inv-req-qty').value);
        let purpose = document.getElementById('inv-req-purpose').value;
        const opName = document.getElementById('inv-req-name').value.trim();
        const actionType = document.getElementById('inv-req-action').value;

        if(purpose === 'Other (Manual)') {
            purpose = document.getElementById('inv-req-custom-purpose').value.trim() || 'Unspecified Manual Purpose';
        }

        if(!itemId || qty < 1 || !opName) {
            window.appEngine.showToast('Please fill out all required fields including Name!', 'warning');
            return;
        }

        const makeId = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).substr(2, 9));

        const processAction = () => {
            const requests = window.stateManager.get('requests');
            const items = window.stateManager.get('inventory');
            const inv = items.find(i=>i.id===itemId);
            
            if(!inv) return;

            // Restrict everyone to request for more than available qty
            if (qty > inv.quantity) {
                window.appEngine.showToast(`Cannot request ${qty} items. Only ${inv.quantity} available.`, 'danger');
                return;
            }

            if(actionType === 'take') {
                if(inv.quantity < qty) {
                    window.appEngine.showToast('Not enough inventory to take!', 'danger');
                    return;
                }
                inv.quantity -= qty;
                
                const currentUser = window.appEngine && window.appEngine.currentUser;
                const isOwner = currentUser && currentUser.userType === 'Owner';
                const status = isOwner ? 'CLAIMED' : 'PENDING_OWNER_APPROVAL';
                
                requests.push({
                    id: makeId(),
                    timestamp: new Date().toISOString(),
                    username: 'system',
                    userName: opName,
                    itemId, qty, purpose,
                    status: status,
                    actionedBy: opName,
                    claimedAt: new Date().toISOString()
                });
                
                window.stateManager.set('inventory', items);
                window.stateManager.set('requests', requests);
                window.stateManager.logAudit('ITEM_TAKEN', `Instantly took ${qty} of ${inv.name} for ${purpose}`, {name: opName}, { itemId: itemId, qty: qty });
                
                if (status === 'PENDING_OWNER_APPROVAL') {
                    window.appEngine.showToast(`${qty}x ${inv.name} deducted from inventory. Pending Owner financial approval.`, 'success');
                } else {
                    window.appEngine.showToast(`${qty}x ${inv.name} deducted from inventory.`, 'success');
                }
            } else {
                requests.push({
                    id: makeId(),
                    timestamp: new Date().toISOString(),
                    username: 'system',
                    userName: opName,
                    itemId, qty, purpose,
                    status: 'PENDING'
                });
                window.stateManager.set('requests', requests);
                window.stateManager.logAudit('REQUEST_SUBMIT', `Submitted request for ${inv.name} (Qty: ${qty})`, {name: opName});
                window.appEngine.showToast(`Request for ${inv.name} submitted to queue.`, 'info');
            }
            
            this.closeReqModal();
            this.populateTable();
        };

        processAction();
    },

    lookupRC: function(val) {
        const nameInput = document.getElementById('inv-req-name');
        if (!val) {
            nameInput.value = '';
            return;
        }

        const users = window.stateManager.get('users');
        // Search by rcNumber column
        const user = users.find(u => String(u.rcNumber || u['RC Number']).toLowerCase() === String(val).toLowerCase());
        
        if (user) {
            nameInput.value = user.name || user['Name'] || '';
            nameInput.style.borderColor = 'var(--success)';
        } else {
            nameInput.value = '';
            nameInput.style.borderColor = 'var(--border)';
        }
    }
};
