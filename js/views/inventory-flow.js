// views/inventory-flow.js
window['inventory-flowView'] = {
    render: function() {
        const container = document.getElementById('module-inventory-flow');
        if (!container) return;
        
        const users = window.stateManager.get('users');
        const requests = window.stateManager.get('requests');
        const items = window.stateManager.get('inventory');

        // Admins with access to approve requests
        const approverAdmins = users.filter(u => (u.userType === 'Admin' || u.userType === 'Owner') && u.requestPerm === 'Edit');

        let html = `
            <div class="header-row">
                <div></div>

                <button class="btn btn-back" onclick="window.appEngine.navigate('management')" style="width:auto">⬅️ Back to Management</button>
            </div>
            
            <div class="card" style="margin-bottom:24px;">
                <h2>Admins Authorized to Approve Deductions</h2>
                <p style="color:var(--text-muted); font-size:13px; margin-bottom:12px;">The following administrators have the 'requestPerm' set to 'Edit' in Google Sheets.</p>
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
            </div>

            <div class="card">
                <h2>All User Requests & Approvals</h2>
                <div class="table-responsive" style="margin-top: 16px;">
                    <table>
                        <thead>
                            <tr>
                                <th>Request ID</th>
                                <th>Requested By</th>
                                <th>Item Requested</th>
                                <th>Qty</th>
                                <th>Status</th>
                                <th>Actioned By (Admin)</th>
                                <th>Action Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${requests.length > 0 ? [...requests].sort((a,b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)).map(r => {
                                const item = items.find(i => i.id === r.itemId);
                                const itemName = item ? item.name : 'Unknown Item';
                                
                                let badge = '';
                                if(r.status === 'PENDING') badge = '<span class="status status-yellow">Pending</span>';
                                else if(r.status === 'APPROVED') badge = '<span class="status status-green">Approved</span>';
                                else if(r.status === 'REJECTED') badge = '<span class="status status-red">Rejected</span>';
                                else if(r.status === 'CLAIMED') badge = '<span class="status" style="background:#3b82f6;color:white">Claimed (Done)</span>';

                                return `
                                    <tr>
                                        <td style="font-size:12px; color:var(--text-muted)">${r.id.substr(0,8)}</td>
                                        <td><strong>${r.userName || r.username}</strong></td>
                                        <td>${itemName}</td>
                                        <td>${r.qty}</td>
                                        <td>${badge}</td>
                                        <td><strong>${r.actionedBy || '<span style="color:var(--text-muted)">—</span>'}</strong></td>
                                        <td style="font-size:12px; color:var(--text-muted)">${r.claimedAt ? new Date(r.claimedAt).toLocaleString() : (r.status !== 'PENDING' ? 'Logged in Audit' : '—')}</td>
                                    </tr>
                                `;
                            }).join('') : '<tr><td colspan="7" style="text-align:center;">No requests found.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    }
};
