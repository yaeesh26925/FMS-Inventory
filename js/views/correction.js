// views/correction.js
window.correctionView = {
    render: function() {
        const container = document.getElementById('module-correction');
        const user = window.appEngine.currentUser;
        const canEdit = user.userType === 'Owner' || user.permRestock === 'Edit';
        
        container.innerHTML = `
            <div class="header-row">
                <div></div>

                <button class="btn btn-back" onclick="window.appEngine.navigate('management')" style="width:auto">⬅️ Back to Management</button>
            </div>
            
            ${canEdit ? `
            <p style="color:var(--text-muted); margin-bottom:16px;">Search for an item to add to existing inventory. All additions are tracked financially.</p>
            
            <div class="card">
                <div style="display:flex; justify-content:space-between; margin-bottom:16px;">
                    <input type="text" id="corr-search" placeholder="Search by name, ID, or part number..." style="padding:8px; border-radius:6px; border:1px solid var(--border); background:var(--bg-color); color:var(--text-primary); width:100%; max-width:400px;" onkeyup="correctionView.populateTable()">
                </div>
                <div class="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Item Name</th>
                                <th>Part #</th>
                                <th>Location</th>
                                <th>Qty</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="corr-tbody"></tbody>
                    </table>
                </div>
            </div>
            ` : `<div class="card"><p style="text-align:center; padding:40px; color:var(--text-muted);">You do not have permission to restock items.</p></div>`}
            
            <!-- Correction Modal -->
            <div id="corr-modal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Add Stock to Item</h2>
                        <span class="modal-close" onclick="correctionView.closeModal()">&times;</span>
                    </div>
                    
                    <p style="margin-bottom:16px; color:var(--warning)" id="corr-itemName"></p>
                    <input type="hidden" id="corr-itemId">
                    
                    <div class="input-group">
                        <label>Your Name (Operator)</label>
                        <input type="text" id="corr-operator" placeholder="Required for Audit Log" required>
                    </div>

                    <div class="input-group">
                        <label>Reference / Reason</label>
                        <input type="text" id="corr-reason" placeholder="e.g. Received new shipment PO-1234" required>
                    </div>

                    <div style="display:flex; gap:16px;">
                        <div class="input-group" style="flex:1">
                            <label>Quantity to Add</label>
                            <input type="number" id="corr-qty" step="0.5" placeholder="e.g. 5">
                        </div>
                        <div class="input-group" style="flex:1">
                            <label>Corrected Location</label>
                            <input type="text" id="corr-location" placeholder="e.g. Warehouse A">
                        </div>
                    </div>
                    <div class="input-group">
                        <label>⚠️ Low Stock Alert Threshold</label>
                        <input type="number" id="corr-alert" min="0" placeholder="e.g. 10">
                        <small style="color:var(--text-muted); font-size:11px;">Item will be marked as Low Stock when quantity drops below this number.</small>
                    </div>

                    <button class="btn btn-primary mt-3" onclick="correctionView.saveCorrection()">Add to Inventory</button>
                </div>
            </div>
        `;
        
        this.populateTable();
    },

    populateTable: function() {
        const items = window.stateManager.get('inventory');
        const searchInput = document.getElementById('corr-search');
        const search = (searchInput?.value || '').toLowerCase();
        
        const filtered = items.filter(item => {
            return (item.name || '').toLowerCase().includes(search) || 
                   (item.code || '').toLowerCase().includes(search) || 
                   (item.id || '').toLowerCase().includes(search);
        });

        const tbody = document.getElementById('corr-tbody');
        if(!tbody) return;

        tbody.innerHTML = filtered.map(item => {
            return `
                <tr>
                    <td>${item.id}</td>
                    <td><strong>${item.name}</strong></td>
                    <td>${item.code}</td>
                    <td>${item.location}</td>
                    <td style="font-weight:bold">${item.quantity} ${item.unit||''}</td>
                    <td>
                        <button class="btn btn-sm btn-secondary" onclick="correctionView.openModal('${item.id}')">Add Stock</button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    openModal: function(id) {
        const items = window.stateManager.get('inventory');
        const item = items.find(i=>i.id===id);
        if(!item) return;

        document.getElementById('corr-itemId').value = item.id;
        document.getElementById('corr-itemName').innerText = "Target: " + item.name + " (" + item.code + ")";
        
        // Auto-fill admin username if logged in
        const opInput = document.getElementById('corr-operator');
        const opLabel = opInput.previousElementSibling;
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
            if (opLabel) opLabel.innerText = 'Your Name (Operator)';
        }
        
        document.getElementById('corr-reason').value = '';
        document.getElementById('corr-qty').value = '';
        document.getElementById('corr-location').value = item.location || '';
        document.getElementById('corr-alert').value = item.lowStockAlert != null ? item.lowStockAlert : 10;

        document.getElementById('corr-modal').classList.add('active');
    },

    closeModal: function() {
        document.getElementById('corr-modal').classList.remove('active');
    },

    saveCorrection: function() {
        const id = document.getElementById('corr-itemId').value;
        const operator = document.getElementById('corr-operator').value.trim();
        const reason = document.getElementById('corr-reason').value.trim();
        const qtyToAdd = parseFloat(document.getElementById('corr-qty').value);
        const newLoc = document.getElementById('corr-location').value;
        const newAlert = parseInt(document.getElementById('corr-alert').value);

        if(!operator || !reason) return alert("Operator Name and Reference/Reason are required for the Audit Log!");
        if(isNaN(qtyToAdd)) return alert("Invalid number for quantity to add");

        const items = window.stateManager.get('inventory');
        const item = items.find(i=>i.id===id);
        if(!item) return;

        // Ensure we are working with numbers
        const currentQty = parseFloat(item.quantity) || 0;
        item.quantity = currentQty + qtyToAdd;
        item.location = newLoc;
        if(!isNaN(newAlert)) item.lowStockAlert = newAlert;

        window.stateManager.set('inventory', items);
        
        const unitPrice = parseFloat(item.unitPrice) || 0;
        const valueAdded = qtyToAdd * unitPrice;
        
        window.stateManager.logAudit('INVENTORY_RESTOCK', `Added ${qtyToAdd} to ${item.name} (${item.id}). New total: ${item.quantity}. Reason: ${reason}`, {name: operator}, { itemId: item.id, qty: qtyToAdd, value: valueAdded });

        this.closeModal();
        this.populateTable();
        window.appEngine.showToast(`Stock added. New quantity is ${item.quantity}.`, 'success');
    }
};
