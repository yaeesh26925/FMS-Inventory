// views/user-management.js
window.userManagementView = {


    // ── Renders the full users table inside the User Management tab ──────────


    renderTab: function () {
        const container = document.getElementById('um-tab-content');
        if (!container) return;

        const users = window.stateManager.get('users');
        const currentUser = window.appEngine.currentUser;

        const roleColor = { Owner: '#f59e0b', Admin: '#6366f1', Standard: '#22c55e' };
        const permLabel = { Non: '✕', View: '👁', Edit: '✏️' };

        const rows = users.map(u => {
            const isCurrentUser = u.phone === currentUser.phone;
            const role = u.userType || 'Standard';
            const rc = badge => `<span style="font-family:monospace; font-size:12px; background:hsla(0,0%,100%,0.07); padding:2px 8px; border-radius:4px;">${badge}</span>`;
            const perms = ['permRestock', 'permProcurement', 'permDetailedInfo', 'permAnalytics', 'permTasks', 'permReports', 'permTakeImmediately', 'permWorkPurposes'];
            const permIcons = perms.map(p => {
                const val = u[p] || 'Non';
                const tip = { permRestock: '📦', permProcurement: '🏢', permDetailedInfo: '📋', permAnalytics: '📊', permTasks: '✅', permReports: '📜', permTakeImmediately: '⚡', permWorkPurposes: '⚙️' }[p];
                return `<span title="${p.replace('perm', '')} — ${val}" style="font-size:12px; opacity:${val === 'Non' ? 0.3 : 1};">${tip}${permLabel[val] || '✕'}</span>`;
            }).join(' ');

            const guard = isCurrentUser ? 'disabled title="Cannot modify yourself"' : '';

            return `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:34px; height:34px; border-radius:50%; background:linear-gradient(135deg, var(--primary), var(--secondary)); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:14px; color:#fff; flex-shrink:0;">
                            ${(u.name || u.phone || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div style="font-weight:600; color:var(--text-main);">${u.name || '—'}</div>
                            <div style="font-size:11px; color:var(--text-muted);">${u.phone || '—'}</div>
                        </div>
                    </div>
                </td>
                <td>${rc(u.rcNumber || '—')}</td>
                <td>
                    <span style="display:inline-block; padding:3px 10px; border-radius:999px; font-size:12px; font-weight:700; background:${roleColor[role]}22; color:${roleColor[role]}; border:1px solid ${roleColor[role]}55;">
                        ${role}
                    </span>
                    ${isCurrentUser ? '<span style="font-size:11px; color:var(--text-muted); margin-left:6px;">(you)</span>' : ''}
                </td>
                <td style="font-size:13px; letter-spacing:2px;">${role === 'Standard' ? '<span style="color:var(--text-muted); font-size:12px;">Basic access only</span>' : (role === 'Owner' ? '<span style="color:#f59e0b; font-size:12px;">Full Access</span>' : permIcons)}</td>
                <td>
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        ${role !== 'Owner' ? `<button class="btn btn-secondary btn-sm" onclick="userManagementView.showEditModal('${u.phone}')" ${guard} style="padding:4px 10px; font-size:12px;">✏️ Edit</button>` : ''}
                        ${!isCurrentUser && role !== 'Owner' ? `<button class="btn btn-sm btn-danger" onclick="userManagementView.deleteUser('${u.phone}')" style="padding:4px 10px; font-size:12px;">🗑 Remove</button>` : ''}
                    </div>
                </td>
            </tr>`;
        }).join('');

        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
                <div>
                    <h2 style="margin:0; font-size:18px;">👥 User Accounts</h2>
                    <p style="margin:4px 0 0; color:var(--text-muted); font-size:13px;">${users.length} registered user${users.length !== 1 ? 's' : ''}. Owners have full access to all modules.</p>
                </div>
                <button class="btn btn-primary" onclick="userManagementView.showCreateModal()" style="width:auto; display:flex; align-items:center; gap:8px;">
                    ➕ Create New User
                </button>
            </div>

            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>RC Number</th>
                            <th>Role</th>
                            <th>Module Permissions</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>${rows || '<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--text-muted);">No users found.</td></tr>'}</tbody>
                </table>
            </div>
        `;
    },

    // ── Create User Modal ────────────────────────────────────────────────────
    showCreateModal: function () {
        document.getElementById('um-create-modal').classList.add('active');
        // Reset fields
        ['um-c-name', 'um-c-phone', 'um-c-rc', 'um-c-password'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const roleEl = document.getElementById('um-c-role');
        if (roleEl) roleEl.value = 'Standard';
        this._togglePermSection();
    },

    hideCreateModal: function () {
        document.getElementById('um-create-modal').classList.remove('active');
    },

    _togglePermSection: function () {
        const role = (document.getElementById('um-c-role')?.value || 'Standard');
        const section = document.getElementById('um-c-perm-section');
        if (section) section.style.display = role === 'Admin' ? 'block' : 'none';
    },

    createUser: function () {
        const name     = (document.getElementById('um-c-name')?.value || '').trim();
        const phone    = (document.getElementById('um-c-phone')?.value || '').trim();
        const rc       = (document.getElementById('um-c-rc')?.value || '').trim();
        const password = (document.getElementById('um-c-password')?.value || '');
        const role     = (document.getElementById('um-c-role')?.value || 'Standard');

        if (!name || !phone || !rc || !password) {
            window.appEngine.showToast('Please fill all required fields.', 'warning');
            return;
        }

        // Normalize phone
        let fmtPhone = phone;
        if (!fmtPhone.startsWith('+')) {
            fmtPhone = fmtPhone.length <= 10 ? '+960' + fmtPhone.replace(/^0+/, '') : '+' + fmtPhone;
        }

        const users = window.stateManager.get('users');
        if (users.find(u => u.phone === fmtPhone || String(u.rcNumber).trim() === rc)) {
            window.appEngine.showToast('Phone or RC Number already in use.', 'danger');
            return;
        }

        // Gather permissions for Admin role
        const permKeys = ['permRestock', 'permProcurement', 'permDetailedInfo', 'permAnalytics', 'permTasks', 'permReports', 'permTakeImmediately', 'permWorkPurposes'];
        const perms = {};
        if (role === 'Admin') {
            permKeys.forEach(k => {
                const el = document.getElementById('um-c-' + k);
                perms[k] = el ? el.value : 'Non';
            });
        } else {
            permKeys.forEach(k => perms[k] = 'Non');
        }

        const newUser = {
            name,
            phone: fmtPhone,
            password: btoa(password),
            rcNumber: rc,
            userType: role,
            requestPerm: role === 'Standard' ? 'View' : 'Edit',
            ...perms
        };

        users.push(newUser);
        window.stateManager.set('users', newUser.rcNumber ? users : users);
        window.stateManager.set('users', users);

        // Keep legacy 'Users' cache in sync
        const UsersTab = window.stateManager.get('Users');
        if (!UsersTab.find(u => String(u['RC Number']).trim() === rc)) {
            UsersTab.push({ 'RC Number': rc, 'Name': name });
            window.stateManager.set('Users', UsersTab);
        }

        window.stateManager.logAudit('USER_CREATED', `Owner created new ${role} user: ${name}`, window.appEngine.currentUser);
        window.appEngine.showToast(`✅ ${name} (${role}) created successfully.`, 'success');
        this.hideCreateModal();
        this.renderTab();
    },

    // ── Edit Permissions Modal ───────────────────────────────────────────────
    _editingPhone: null,

    showEditModal: function (phone) {
        const users = window.stateManager.get('users');
        const user  = users.find(u => u.phone === phone);
        if (!user) return;

        this._editingPhone = phone;

        const modal = document.getElementById('um-edit-modal');
        if (!modal) return;

        // Populate header
        const nameEl = document.getElementById('um-e-username');
        if (nameEl) nameEl.innerText = user.name || user.phone;

        const roleEl = document.getElementById('um-e-role');
        if (roleEl) roleEl.value = user.userType || 'Standard';

        // Populate password (editable but optional)
        const passEl = document.getElementById('um-e-password');
        if (passEl) passEl.value = '';

        const permKeys = ['permRestock', 'permProcurement', 'permDetailedInfo', 'permAnalytics', 'permTasks', 'permReports', 'permTakeImmediately', 'permWorkPurposes'];
        permKeys.forEach(k => {
            const el = document.getElementById('um-e-' + k);
            if (el) el.value = user[k] || 'Non';
        });

        const reqEl = document.getElementById('um-e-requestPerm');
        if (reqEl) reqEl.value = user.requestPerm || 'View';

        this._updateEditPermVisibility(user.userType || 'Standard');
        modal.classList.add('active');
    },

    _updateEditPermVisibility: function (role) {
        const section = document.getElementById('um-e-perm-section');
        if (section) section.style.display = role === 'Admin' ? 'block' : 'none';
    },

    saveEdit: function () {
        const phone = this._editingPhone;
        if (!phone) return;

        const users = window.stateManager.get('users');
        const idx   = users.findIndex(u => u.phone === phone);
        if (idx === -1) return;

        const roleEl = document.getElementById('um-e-role');
        const newRole = roleEl ? roleEl.value : users[idx].userType;

        const passEl  = document.getElementById('um-e-password');
        const newPass = passEl && passEl.value.trim() ? btoa(passEl.value.trim()) : users[idx].password;

        const permKeys = ['permRestock', 'permProcurement', 'permDetailedInfo', 'permAnalytics', 'permTasks', 'permReports', 'permTakeImmediately', 'permWorkPurposes'];
        const perms = {};
        permKeys.forEach(k => {
            const el = document.getElementById('um-e-' + k);
            perms[k] = el ? el.value : (users[idx][k] || 'Non');
        });

        const reqEl = document.getElementById('um-e-requestPerm');
        const reqPerm = reqEl ? reqEl.value : (users[idx].requestPerm || 'View');

        users[idx] = { ...users[idx], userType: newRole, password: newPass, requestPerm: reqPerm, ...perms };
        window.stateManager.set('users', users);
        window.stateManager.logAudit('USER_UPDATED', `Owner updated permissions for ${users[idx].name || phone}`, window.appEngine.currentUser);
        window.appEngine.showToast(`✅ ${users[idx].name || phone} updated successfully.`, 'success');

        this.hideEditModal();
        this.renderTab();
    },

    hideEditModal: function () {
        const modal = document.getElementById('um-edit-modal');
        if (modal) modal.classList.remove('active');
        this._editingPhone = null;
    },

    // ── Delete User ──────────────────────────────────────────────────────────
    deleteUser: function (phone) {
        const users = window.stateManager.get('users');
        const user  = users.find(u => u.phone === phone);
        if (!user) return;

        const confirmed = confirm(`⚠️ Remove user "${user.name || phone}" from the system?\n\nThis cannot be undone.`);
        if (!confirmed) return;

        const updated = users.filter(u => u.phone !== phone);
        window.stateManager.set('users', updated);
        window.stateManager.logAudit('USER_DELETED', `Owner removed user: ${user.name || phone}`, window.appEngine.currentUser);
        window.appEngine.showToast(`🗑 ${user.name || phone} removed from system.`, 'warning');
        this.renderTab();
    }
};
