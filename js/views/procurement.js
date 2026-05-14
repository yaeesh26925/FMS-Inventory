// views/procurement.js
window.procurementView = {
    charts: {},

    render: function() {
        const container = document.getElementById('module-procurement');

        const user = window.appEngine.currentUser;
        const canEdit = user.permProcurement === 'Edit';

        container.innerHTML = `
            <div class="header-row">
                <h1>PR &amp; PO</h1>
                <div style="display:flex; gap:12px;">
                    ${canEdit ? `<button class="btn btn-primary" onclick="procurementView.showAddModal()" style="width:auto">➕ Create New PR</button>` : ''}
                    <button class="btn btn-secondary" onclick="procurementView.toggleAnalytics()" style="width:auto">📊 Toggle Analytics</button>
                    <button class="btn btn-back" onclick="window.appEngine.navigate('management')" style="width:auto">⬅️ Back to Management</button>
                </div>
            </div>

            <!-- Analytics Section -->
            <div id="proc-analytics-section" class="card" style="display:none; margin-bottom:24px; background:var(--surface);">
                <h2 style="margin-bottom:16px;">Procurement Analytics</h2>
                <div class="grid" style="margin-bottom:16px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
                    <div>
                        <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">Date Range Start (PR Issue Date)</label>
                        <input type="date" id="proc-analytics-start" class="input" style="width:100%; padding:8px; border-radius:6px; background:var(--bg-color); color:var(--text-primary); border:1px solid var(--border);" onchange="procurementView.updateAnalytics()">
                    </div>
                    <div>
                        <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">Date Range End (PR Issue Date)</label>
                        <input type="date" id="proc-analytics-end" class="input" style="width:100%; padding:8px; border-radius:6px; background:var(--bg-color); color:var(--text-primary); border:1px solid var(--border);" onchange="procurementView.updateAnalytics()">
                    </div>
                </div>
                
                <div style="display:flex; flex-direction:column; gap:24px;">
                    <div style="background:var(--bg-color); padding:20px; border-radius:8px; border:1px solid var(--border);">
                        <h3 style="font-size:16px; margin-bottom:16px; color:var(--text-primary);">Actual PO Price ($)</h3>
                        <div style="position: relative; height: 350px; width: 100%;">
                            <canvas id="proc-price-chart"></canvas>
                        </div>
                    </div>
                    <div style="background:var(--bg-color); padding:20px; border-radius:8px; border:1px solid var(--border);">
                        <h3 style="font-size:16px; margin-bottom:16px; color:var(--text-primary);">Procurement Timeline (Days)</h3>
                        <div style="position: relative; height: 350px; width: 100%;">
                            <canvas id="proc-timeline-chart"></canvas>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Main Procurement View -->
            <div id="proc-main-section">
                <div class="card">
                    <div style="margin-bottom:16px;">
                        <input type="text" id="proc-search" placeholder="Search..." 
                            style="padding:8px 12px; border-radius:6px; border:1px solid var(--border); background:var(--bg-color); color:var(--text-primary); width:100%;"
                            onkeyup="procurementView.populateTable()">
                    </div>
                    <div class="table-responsive">
                        <table style="min-width:1400px;">
                            <thead>
                                <tr>
                                    <th>PR NO</th>
                                    <th>DESCRIPTION</th>
                                    <th>PR ISSUED BY</th>
                                    <th>PR CREATED DATE</th>
                                    <th>PR STATUS</th>
                                    <th>TECHNICAL APPROVAL DATE</th>
                                    <th>TECHNICAL APPROVAL STATUS</th>
                                    <th>PO STATUS</th>
                                    <th>PO NO</th>
                                    <th>PO PRICE ($)</th>
                                    <th>PO RECIEVED DATE</th>
                                    <th>REMARKS</th>
                                    <th>Attachment</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="po-tbody"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Add/Edit PR Modal -->
            <div id="proc-modal" class="modal-overlay">
                <div class="modal-content" style="max-width:800px;">
                    <div class="modal-header">
                        <h2 id="proc-modal-title">Create New PR</h2>
                        <span class="modal-close" onclick="procurementView.closeModal()">&times;</span>
                    </div>
                    <div class="grid" style="grid-template-columns: 1fr 1fr; gap:16px;">
                        <div class="input-group">
                            <label>PR NO</label>
                            <input type="text" id="m-pr-no" placeholder="PR12345">
                        </div>
                        <div class="input-group">
                            <label>PR Created Date</label>
                            <input type="date" id="m-pr-date">
                        </div>
                        <div class="input-group" style="grid-column: span 2">
                            <label>Description</label>
                            <input type="text" id="m-desc" placeholder="Details of the procurement...">
                        </div>
                        <div class="input-group">
                            <label>PR Issued By</label>
                            <input type="text" id="m-issued-by">
                        </div>
                        <div class="input-group">
                            <label>PR Status</label>
                            <select id="m-pr-status">
                                <option value="-">-</option>
                                <option value="Pending">Pending</option>
                                <option value="Approved">Approved</option>
                                <option value="Rejected">Rejected</option>
                            </select>
                        </div>
                        
                        <div class="input-group">
                            <label>Technical Approval Date</label>
                            <input type="date" id="m-tech-date">
                        </div>
                        <div class="input-group">
                            <label>Technical Status</label>
                            <select id="m-tech-status">
                                <option value="-">-</option>
                                <option value="Approved">Approved</option>
                                <option value="Rejected">Rejected</option>
                                <option value="Pending">Pending</option>
                            </select>
                        </div>

                        <div class="input-group">
                            <label>PO Number</label>
                            <input type="text" id="m-po-no" placeholder="PO6789">
                        </div>
                        <div class="input-group">
                            <label>PO Price ($)</label>
                            <input type="number" id="m-po-price" step="0.01" value="0.00">
                        </div>
                        <div class="input-group">
                            <label>PO Status</label>
                            <select id="m-po-status">
                                <option value="-">-</option>
                                <option value="Issued">Issued</option>
                                <option value="Pending">Pending</option>
                                <option value="Cancelled">Cancelled</option>
                                <option value="Complete">Complete</option>
                            </select>
                        </div>
                        <div class="input-group">
                            <label>PO Received Date</label>
                            <input type="date" id="m-received-date">
                        </div>
                        <div class="input-group" style="grid-column: span 2">
                            <label>Remarks / Notes</label>
                            <textarea id="m-remarks" style="width:100%; height:60px; padding:8px; border-radius:6px; background:var(--bg-color); color:var(--text-primary); border:1px solid var(--border);"></textarea>
                        </div>
                    </div>
                    <div style="margin-top:20px; display:flex; justify-content:flex-end;">
                        <button class="btn btn-secondary" onclick="procurementView.closeModal()" style="margin-right:12px;">Cancel</button>
                        <button class="btn btn-primary" id="m-save-btn" onclick="procurementView.saveRecord()">Save PR Record</button>
                    </div>
                </div>
            </div>
        `;

        this.populateTable();
        this.initAnalytics();
    },

    toggleAnalytics: function() {
        const el = document.getElementById('proc-analytics-section');
        const main = document.getElementById('proc-main-section');
        if (el.style.display === 'none') {
            el.style.display = 'block';
            main.style.display = 'none';
            this.updateAnalytics();
        } else {
            el.style.display = 'none';
            main.style.display = 'block';
        }
    },

    showAddModal: function() {
        this.editingIndex = -1;
        document.getElementById('proc-modal-title').innerText = "Create New PR Record";
        this.resetModalFields();
        // Set default date to today
        document.getElementById('m-pr-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('m-issued-by').value = window.appEngine.currentUser?.username || '';
        document.getElementById('proc-modal').classList.add('active');
    },

    showEditModal: function(index) {
        this.editingIndex = index;
        const pos = window.stateManager.get('purchaseOrders');
        const po = pos[index];
        
        document.getElementById('proc-modal-title').innerText = "Edit PR Record: " + (po['PR NO'] || 'Unknown');
        
        document.getElementById('m-pr-no').value = po['PR NO'] || '';
        document.getElementById('m-pr-date').value = po['PR CREATED DATE'] ? new Date(po['PR CREATED DATE']).toISOString().split('T')[0] : '';
        document.getElementById('m-desc').value = po['DESCRIPTION'] || '';
        document.getElementById('m-issued-by').value = po['PR ISSUED BY'] || '';
        document.getElementById('m-pr-status').value = po['PR STATUS'] || '-';
        document.getElementById('m-tech-date').value = po['TECHNICAL APPROVAL DATE'] ? new Date(po['TECHNICAL APPROVAL DATE']).toISOString().split('T')[0] : '';
        document.getElementById('m-tech-status').value = po['TECHNICAL APPROVAL STATUS'] || '-';
        document.getElementById('m-po-no').value = po['PO NO'] || '';
        document.getElementById('m-po-price').value = po['PO PRICE'] || '0.00';
        document.getElementById('m-po-status').value = po['PO STATUS'] || '-';
        document.getElementById('m-received-date').value = po['PO RECIEVED DATE'] ? new Date(po['PO RECIEVED DATE']).toISOString().split('T')[0] : '';
        document.getElementById('m-remarks').value = po['REMARKS'] || '';

        document.getElementById('proc-modal').classList.add('active');
    },

    closeModal: function() {
        document.getElementById('proc-modal').classList.remove('active');
    },

    resetModalFields: function() {
        const fields = ['m-pr-no', 'm-pr-date', 'm-desc', 'm-issued-by', 'm-pr-status', 'm-tech-date', 'm-tech-status', 'm-po-no', 'm-po-price', 'm-po-status', 'm-received-date', 'm-remarks'];
        fields.forEach(id => {
            const el = document.getElementById(id);
            if(el.tagName === 'SELECT') el.value = '-';
            else el.value = '';
        });
    },

    saveRecord: function() {
        const prNo = document.getElementById('m-pr-no').value.trim();
        if(!prNo) return alert('PR NO is required.');

        const record = {
            'PR NO': prNo,
            'DESCRIPTION': document.getElementById('m-desc').value,
            'PR ISSUED BY': document.getElementById('m-issued-by').value,
            'PR CREATED DATE': document.getElementById('m-pr-date').value,
            'PR STATUS': document.getElementById('m-pr-status').value,
            'TECHNICAL APPROVAL DATE': document.getElementById('m-tech-date').value,
            'TECHNICAL APPROVAL STATUS': document.getElementById('m-tech-status').value,
            'PO STATUS': document.getElementById('m-po-status').value,
            'PO NO': document.getElementById('m-po-no').value,
            'PO PRICE': parseFloat(document.getElementById('m-po-price').value) || 0,
            'PO RECIEVED DATE': document.getElementById('m-received-date').value,
            'REMARKS': document.getElementById('m-remarks').value
        };

        let pos = window.stateManager.get('purchaseOrders');
        
        if (this.editingIndex >= 0) {
            // Keep pdfUrl if editing
            record.pdfUrl = pos[this.editingIndex].pdfUrl || '';
            pos[this.editingIndex] = record;
            window.appEngine.showToast('PR Record updated successfully.', 'success');
        } else {
            record.pdfUrl = '';
            pos.unshift(record);
            window.appEngine.showToast('New PR Record created.', 'success');
        }

        window.stateManager.set('purchaseOrders', pos);
        this.closeModal();
        this.populateTable();
    },

    uploadPDF: function(prNumber) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/pdf';
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Show loading state
            const btn = document.getElementById('upload-btn-' + prNumber);
            if(btn) btn.innerText = "⏳ Uploading...";
            
            window.stateManager.uploadProcurementPDF(prNumber, file, (url) => {
                if(url) {
                    this.populateTable();
                } else {
                    if(btn) btn.innerText = "📄 Upload";
                }
            });
        };
        input.click();
    },

    populateTable: function() {
        const pos = window.stateManager.get('purchaseOrders');
        const tbody = document.getElementById('po-tbody');
        if (!tbody) return;

        const search = (document.getElementById('proc-search')?.value || '').toLowerCase();

        const filtered = pos.map((po, index) => ({ po, index })).filter(item => {
            const po = item.po;
            const fields = [
                po['PR NO'] || '',
                po['DESCRIPTION'] || '',
                po['PR ISSUED BY'] || '',
                po['PR CREATED DATE'] || '',
                po['PR STATUS'] || '',
                po['TECHNICAL APPROVAL DATE'] || '',
                po['TECHNICAL APPROVAL STATUS'] || '',
                po['PO STATUS'] || '',
                po['PO NO'] || '',
                po['PO RECIEVED DATE'] || ''
            ];
            return fields.some(f => String(f).toLowerCase().includes(search));
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="14" style="text-align:center; padding:32px; color:var(--text-muted);">No procurement records found.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(item => {
            const po = item.po;
            const index = item.index;
            const prNumber    = po['PR NO'] || '-';
            const description = po['DESCRIPTION'] || '-';
            const issuedBy    = po['PR ISSUED BY'] || '-';
            const issuedDate  = po['PR CREATED DATE'] ? new Date(po['PR CREATED DATE']).toLocaleDateString() : '-';
            
            const prStatus    = po['PR STATUS'] || '-';
            const techApprovalDate = po['TECHNICAL APPROVAL DATE'] ? new Date(po['TECHNICAL APPROVAL DATE']).toLocaleDateString() : '-';
            const techEvalStatus = po['TECHNICAL APPROVAL STATUS'] || '-';
            const poStatus    = po['PO STATUS'] || '-';
            const poNumber    = po['PO NO'] || '-';
            const poPrice     = po['PO PRICE'] ? `$${parseFloat(po['PO PRICE']).toLocaleString()}` : '-';
            const receivedDate= po['PO RECIEVED DATE'] ? new Date(po['PO RECIEVED DATE']).toLocaleDateString() : '-';
            const pdfUrl      = po.pdfUrl || '';

            let computedRemarks = po['REMARKS'] || "-";
            const prStatusUpper = (po['PR STATUS'] || '').toString().toUpperCase();
            const techEvalUpper = (po['TECHNICAL APPROVAL STATUS'] || '').toString().toUpperCase();
            const poStatusUpper = (po['PO STATUS'] || '').toString().toUpperCase();

            const isFullyComplete = po['PO NO'] && po['PO RECIEVED DATE'] && po.pdfUrl;
            const rowStyle = isFullyComplete ? 'background-color: rgba(34,197,94,0.1);' : '';

            const prStatusBadge    = this.statusBadge(prStatus);
            const poStatusBadge    = this.statusBadge(poStatus);

            const user = window.appEngine.currentUser;
            const canEdit = user.permProcurement === 'Edit';

            let attachmentHtml = '-';
            if (pdfUrl) {
                attachmentHtml = `<a href="${pdfUrl}" target="_blank" class="btn btn-primary btn-sm" style="text-decoration:none;">🔗 View PDF</a>`;
                if (canEdit) {
                    attachmentHtml += `<div style="margin-top:4px;"><button class="btn btn-secondary btn-sm" style="font-size:10px; padding:2px 4px;" onclick="procurementView.uploadPDF('${prNumber}')">🔄 Update</button></div>`;
                }
            } else if (canEdit) {
                attachmentHtml = `<button id="upload-btn-${prNumber}" class="btn btn-secondary btn-sm" onclick="procurementView.uploadPDF('${prNumber}')">📄 Upload</button>`;
            }

            let poNumHtml = poNumber;
            if (pdfUrl && poNumber !== '-') {
                poNumHtml = `<a href="${pdfUrl}" target="_blank" style="color:var(--primary); font-weight:bold; text-decoration:underline;">${poNumber}</a>`;
            }

            return `<tr style="${rowStyle}">
                <td><strong>${prNumber}</strong></td>
                <td>${description}</td>
                <td>${issuedBy}</td>
                <td style="font-size:12px; color:var(--text-muted)">${issuedDate}</td>
                <td>${prStatusBadge}</td>
                <td style="font-size:12px; color:var(--text-muted)">${techApprovalDate}</td>
                <td>${this.statusBadge(techEvalStatus)}</td>
                <td>${poStatusBadge}</td>
                <td>${poNumHtml}</td>
                <td>${poPrice}</td>
                <td style="font-size:12px; color:var(--text-muted)">${receivedDate}</td>
                <td style="font-size:12px; font-weight:bold;">${computedRemarks}</td>
                <td style="text-align:center;">${attachmentHtml}</td>
                <td>
                    ${canEdit ? `<button class="btn btn-secondary btn-sm" onclick="procurementView.showEditModal(${index})">✏️ Edit</button>` : '-'}
                </td>
            </tr>`;
        }).join('');
    },

    initAnalytics: function() {
        if (this.charts.timeline) this.charts.timeline.destroy();
        if (this.charts.price) this.charts.price.destroy();

        const timelineCtx = document.getElementById('proc-timeline-chart').getContext('2d');
        const priceCtx = document.getElementById('proc-price-chart').getContext('2d');

        Chart.defaults.color = '#94a3b8';
        Chart.defaults.font.family = "'Inter', sans-serif";

        this.charts.timeline = new Chart(timelineCtx, {
            type: 'line',
            data: { labels: [], datasets: [] },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, title: { display: true, text: 'Days' } } }
            }
        });

        this.charts.price = new Chart(priceCtx, {
            type: 'line',
            data: { labels: [], datasets: [] },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, title: { display: true, text: 'Price ($)' } } }
            }
        });
    },

    updateAnalytics: function() {
        const pos = window.stateManager.get('purchaseOrders');
        const startVal = document.getElementById('proc-analytics-start').value;
        const endVal = document.getElementById('proc-analytics-end').value;
        
        let filtered = pos;
        if (startVal || endVal) {
            filtered = pos.filter(po => {
                const dateStr = po['PR CREATED DATE'];
                if (!dateStr) return false;
                const d = new Date(dateStr);
                if (startVal && d < new Date(startVal)) return false;
                if (endVal && d > new Date(endVal)) return false;
                return true;
            });
        }
        
        filtered.sort((a,b) => new Date(a['PR CREATED DATE'] || 0) - new Date(b['PR CREATED DATE'] || 0));

        const labels = filtered.map(po => po['PO NO'] || po['PR NO'] || 'Unknown PO');
        
        const prToReceivedDays = filtered.map(po => {
            if(!po['PR CREATED DATE'] || !po['PO RECIEVED DATE']) return null;
            return (new Date(po['PO RECIEVED DATE']) - new Date(po['PR CREATED DATE'])) / (1000 * 60 * 60 * 24);
        });

        this.charts.timeline.data = {
            labels: labels,
            datasets: [
                {
                    label: 'PR to Received (Days)',
                    data: prToReceivedDays,
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34,197,94,0.1)',
                    tension: 0.3,
                    fill: true
                }
            ]
        };
        this.charts.timeline.update();

        const poPrices = filtered.map(po => parseFloat(po['PO PRICE']) || 0);

        this.charts.price.data = {
            labels: labels,
            datasets: [
                {
                    label: 'Actual PO Price',
                    data: poPrices,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239,68,68,0.1)',
                    tension: 0.3,
                    fill: true
                }
            ]
        };
        this.charts.price.update();
    },

    statusBadge: function(status) {
        if (!status || status === '-') return `<span style="color:var(--text-muted)">-</span>`;
        const s = status.toUpperCase();
        let color = 'var(--text-muted)';
        let bg = 'rgba(255,255,255,0.07)';
        if (s.includes('COMPLETE') || s.includes('RECEIVED') || s.includes('APPROVED') || s.includes('DONE') || s.includes('CLOSED')) {
            color = 'var(--success)'; bg = 'rgba(34,197,94,0.12)';
        } else if (s.includes('PENDING') || s.includes('DRAFT') || s.includes('ONGOING') || s.includes('IN PROGRESS')) {
            color = 'var(--warning)'; bg = 'rgba(234,179,8,0.12)';
        } else if (s.includes('REJECTED') || s.includes('CANCELLED') || s.includes('FAILED')) {
            color = 'var(--danger)'; bg = 'rgba(239,68,68,0.12)';
        } else if (s.includes('ORDERED') || s.includes('SUBMITTED')) {
            color = '#3b82f6'; bg = 'rgba(59,130,246,0.12)';
        }
        return `<span style="padding:2px 8px; border-radius:20px; font-size:11px; font-weight:600; background:${bg}; color:${color};">${status}</span>`;
    }
};
