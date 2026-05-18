// views/requests.js
window.requestsView = {
    _pendingAction: null, // { type: 'approve'|'reject'|'claim', id: string }

    render: function() {
        const container = document.getElementById('module-requests');
        
        container.innerHTML = `
            <div class="header-row">
                <div></div>
            </div>

            
            <div class="card">
                <h2>Pending Requests Queue</h2>
                <div class="table-responsive" style="margin-top: 16px;">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Requested By</th>
                                <th>Item</th>
                                <th>Qty</th>
                                <th>Purpose</th>
                                <th>Status</th>
                                ${window.appEngine && window.appEngine.currentUser ? '<th>Actions</th>' : ''}
                            </tr>
                        </thead>
                        <tbody id="req-tbody"></tbody>
                    </table>
                </div>
            </div>

            <!-- Operator Name Modal for Approve / Reject / Claim -->
            <div id="req-action-modal" class="modal-overlay">
                <div class="modal-content" style="max-width:420px;">
                    <div class="modal-header">
                        <h2 id="req-action-title">Confirm Action</h2>
                        <span class="modal-close" onclick="requestsView.closeActionModal()">&times;</span>
                    </div>
                    <p id="req-action-desc" style="color:var(--text-muted); margin-bottom:16px; font-size:14px;"></p>
                    
                    <div class="input-group" id="req-action-qty-ctr" style="display:none;">
                        <label>Approved Quantity</label>
                        <input type="number" id="req-action-qty" min="1" step="1" style="padding:12px; border-radius:var(--radius-md); border:1px solid var(--primary); background:hsla(var(--h), 100%, 60%, 0.05); color:var(--text-main); width:100%">
                        <small style="color:var(--text-muted); font-size:11px;">You can modify the quantity if inventory is low.</small>
                    </div>

                    <div class="input-group">
                        <label>Your Name (for Audit Log)</label>
                        <input type="text" id="req-action-operator" placeholder="Enter your name" autocomplete="off" style="padding:12px; border-radius:var(--radius-md); border:1px solid var(--glass-border); background:hsla(0, 0%, 100%, 0.05); color:var(--text-main); width:100%">
                    </div>

                    <div id="req-action-error" style="color:var(--danger); font-size:13px; margin-bottom:8px; display:none;"></div>
                    <button class="btn btn-primary mt-3" onclick="requestsView.confirmAction()" style="width:100%;">Confirm</button>
                </div>
            </div>
        `;
        
        this.populateTable();
    },

    populateTable: function() {
        const requests = window.stateManager.get('requests');
        const items = window.stateManager.get('inventory');
        const tbody = document.getElementById('req-tbody');
        const currentUser = window.appEngine && window.appEngine.currentUser;

        if (!tbody || !currentUser) return;

        let visibleRequests = requests;
        
        // Data Visibility Rules
        const isAdmin = ['Admin', 'Owner', 'System Admin'].includes(currentUser.userType);
        if (!isAdmin) {
            visibleRequests = requests.filter(r => 
                (r.userName || r.username) === currentUser.name || 
                (r.userName || r.username) === currentUser.phone ||
                r.userPhone === currentUser.phone
            );
        }

        // Show pending on top
        const sorted = [...visibleRequests].sort((a,b) => {
             if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
             if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
             return new Date(b.timestamp) - new Date(a.timestamp);
        });

        if (sorted.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--text-muted);">No requests yet. Use the Inventory tab to submit a request.</td></tr>`;
            return;
        }

        tbody.innerHTML = sorted.map(req => {
            const item = items.find(i=>i.id === req.itemId);
            const itemName = item ? item.name : 'Unknown Item';
            
            let badge = '';
            if(req.status === 'PENDING') badge = '<span class="status status-yellow">Pending</span>';
            else if(req.status === 'APPROVED') badge = '<span class="status status-green">Approved</span>';
            else if(req.status === 'REJECTED') badge = '<span class="status status-red">Rejected</span>';
            else if(req.status === 'CLAIMED') badge = '<span class="status" style="background:var(--primary); color:white; border:none; box-shadow:var(--shadow-glow)">Claimed (Done)</span>';
            else if(req.status === 'PENDING_OWNER_APPROVAL') {
                if (currentUser && (currentUser.name === req.actionedBy || currentUser.phone === req.actionedBy || currentUser.userType === 'Owner')) {
                    badge = '<span class="status" style="background:var(--secondary); color:white; border:none;">Admin Approved (Pending Owner Financials)</span>';
                } else {
                    badge = '<span class="status status-green">Approved</span>';
                }
            }


            let actions = '<span style="color:var(--text-muted)">—</span>';
            // Owners can always approve/reject; Admins and System Admins need permTakeImmediately === 'Edit'
            const canEdit = currentUser.userType === 'Owner' || (['System Admin', 'Admin'].includes(currentUser.userType) && currentUser.permTakeImmediately === 'Edit');

            if (req.status === 'PENDING' && canEdit) {
                actions = `
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        <button class="btn btn-sm btn-success" style="font-size:11px;" onclick="requestsView.openActionModal('approve','${req.id}','${(itemName).replace(/'/g, "\\'")}',${ req.qty})">✅ Approve</button>
                        <button class="btn btn-sm btn-danger" style="font-size:11px;" onclick="requestsView.openActionModal('reject','${req.id}','${(itemName).replace(/'/g, "\\'")}',${ req.qty})">❌ Reject</button>
                    </div>
                `;
            }

            const shortId = req.id.substr(0, 8);
            return `
                <tr>
                    <td style="font-size:12px; color:var(--text-muted)">${shortId}</td>
                    <td><strong>${req.userName || req.username}</strong></td>
                    <td>${itemName}</td>
                    <td>${req.qty}</td>
                    <td>${req.purpose}</td>
                    <td>${badge}</td>
                    ${window.appEngine && window.appEngine.currentUser ? `<td>${actions}</td>` : ''}
                </tr>
            `;
        }).join('');
    },

    openActionModal: function(type, id, itemName, qty) {
        this._pendingAction = { type, id };
        const titleEl = document.getElementById('req-action-title');
        const descEl  = document.getElementById('req-action-desc');
        const errEl   = document.getElementById('req-action-error');
        const opEl    = document.getElementById('req-action-operator');
        const opLabel = opEl.previousElementSibling;

        errEl.style.display = 'none';

        if (type === 'approve') {
            titleEl.innerText = 'Approve & Fulfill';
            descEl.innerText  = `Approve request for ${qty}x ${itemName}? Stock will be deducted immediately.`;
            document.getElementById('req-action-qty-ctr').style.display = 'block';
            document.getElementById('req-action-qty').value = qty;
        } else if (type === 'reject') {
            titleEl.innerText = 'Reject Request';
            descEl.innerText  = `Reject request for ${qty}x ${itemName}? This action is logged and final.`;
            document.getElementById('req-action-qty-ctr').style.display = 'none';
        }

        // Auto-fill admin name if logged in
        if (window.appEngine && window.appEngine.currentUser) {
            opEl.value = window.appEngine.currentUser.name || window.appEngine.currentUser.phone;
            opEl.readOnly = true;
            opEl.style.opacity = '0.6';
            if (opLabel) opLabel.innerText = 'Logged in as';
        } else {
            opEl.value = '';
            opEl.readOnly = false;
            opEl.style.opacity = '1';
            if (opLabel) opLabel.innerText = 'Admin Name logging this item';
        }

        document.getElementById('req-action-modal').classList.add('active');
        setTimeout(() => opEl.focus(), 100);
    },

    closeActionModal: function() {
        document.getElementById('req-action-modal').classList.remove('active');
        this._pendingAction = null;
    },

    confirmAction: function() {
        const opName = document.getElementById('req-action-operator').value.trim();
        const approvedQty = parseInt(document.getElementById('req-action-qty').value);
        const errEl  = document.getElementById('req-action-error');

        if (!opName) {
            errEl.innerText = 'Name is required for the Audit Log.';
            errEl.style.display = 'block';
            return;
        }
        
        if (this._pendingAction.type === 'approve' && (isNaN(approvedQty) || approvedQty < 1)) {
            errEl.innerText = 'Valid approved quantity is required.';
            errEl.style.display = 'block';
            return;
        }

        errEl.style.display = 'none';

        const { type, id } = this._pendingAction;
        this.closeActionModal();

        if (type === 'approve')      this._doApprove(id, opName, approvedQty);
        else if (type === 'reject')  this._doReject(id, opName);
    },

    _doApprove: function(id, opName, approvedQty) {
        const requests = window.stateManager.get('requests');
        const items    = window.stateManager.get('inventory');
        const req = requests.find(r=>r.id===id);
        if (!req) return;

        const useQty = approvedQty || req.qty;
        const inv = items.find(i=>i.id===req.itemId);
        if (!inv || inv.quantity < useQty) {
            window.appEngine.showToast(`Not enough inventory (${inv ? inv.quantity : 0} available) to fulfill this request!`, 'danger');
            return;
        }

        inv.quantity -= useQty;
        const oldQty = req.qty;
        req.qty = useQty; 
        req.actionedBy = opName;

        const currentUser = window.appEngine && window.appEngine.currentUser;
        const isOwner = currentUser && currentUser.userType === 'Owner';

        if (isOwner) {
            req.status    = 'CLAIMED';
            req.claimedAt = new Date().toISOString();
            req.ownerApprovedAt = new Date().toISOString();

            window.stateManager.set('inventory', items);
            window.stateManager.set('requests', requests);
            
            const details = oldQty !== useQty ? 
                `Approved and fulfilled modified quantity ${useQty}x (was ${oldQty}x) for request ${id.substr(0,8)}.` :
                `Approved and fulfilled ${useQty}x for request ${id.substr(0,8)}.`;
                
            window.stateManager.logAudit('REQUEST_FULFILLED', details, {name: opName}, { itemId: req.itemId, qty: useQty });
            window.appEngine.showToast('Request approved and stock deducted immediately.', 'success');
        } else {
            req.status    = 'PENDING_OWNER_APPROVAL';
            req.claimedAt = new Date().toISOString();

            window.stateManager.set('inventory', items);
            window.stateManager.set('requests', requests);
            
            const details = oldQty !== useQty ? 
                `Admin approved modified quantity ${useQty}x (was ${oldQty}x) for request ${id.substr(0,8)}. Pending Owner financial approval.` :
                `Admin approved ${useQty}x for request ${id.substr(0,8)}. Pending Owner financial approval.`;
                
            window.stateManager.logAudit('REQUEST_ADMIN_APPROVED', details, {name: opName}, { itemId: req.itemId, qty: useQty });
            window.appEngine.showToast('Request approved and stock deducted. Pending Owner financial approval.', 'success');
        }

        this.populateTable();
        if (window.inventoryView) window.inventoryView.populateTable();
    },

    _doReject: function(id, opName) {
        const requests = window.stateManager.get('requests');
        const req = requests.find(r=>r.id===id);
        if (req) {
            req.status = 'REJECTED';
            req.actionedBy = opName;
            window.stateManager.set('requests', requests);
            window.stateManager.logAudit('REQUEST_REJECTED', `Rejected request ${id.substr(0,8)}`, {name: opName});
            this.populateTable();
            window.appEngine.showToast('Request rejected.', 'warning');
        }
    }
};
