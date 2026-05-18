// views/procurement.js
window.procurementView = {
    charts: {},

    render: function() {
        const container = document.getElementById('module-procurement');

        const user = window.appEngine.currentUser;
        const canEdit = user.userType === 'Owner' || (['System Admin', 'Admin'].includes(user.userType) && user.permProcurement === 'Edit');

        container.innerHTML = `
            <div class="header-row">
                <div></div>

                <div style="display:flex; gap:12px; flex-wrap:wrap;">
                    ${canEdit ? `
                        <button class="btn btn-primary" onclick="procurementView.showAddModal()" style="width:auto">➕ Add PR &amp; PO</button>
                    ` : ''}

                    <button class="btn btn-secondary" onclick="procurementView.toggleAnalytics()" style="width:auto">📊 Analytics</button>
                    <button class="btn btn-secondary" onclick="procurementView.toggleDeletedRecords()" style="width:auto">🗑️ Deleted Records</button>

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
                                    <th>Folder</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="po-tbody"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Details Folder Section -->
            <div id="proc-details-section" style="display:none;">
                <div class="card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                        <h2 id="details-title">Procurement Details</h2>
                        <button class="btn btn-secondary" onclick="procurementView.closeDetails()">⬅️ Back</button>
                    </div>
                    <div id="details-content" style="background:var(--bg-color); padding:16px; border-radius:8px; border:1px solid var(--border); margin-bottom:24px;"></div>
                    
                    <h3>Attachments</h3>
                    <div style="background:var(--bg-color); padding:16px; border-radius:8px; border:1px solid var(--border); margin-top:16px;">
                        <div id="details-attachments-list" style="margin-bottom:16px; display:flex; flex-direction:column; gap:8px;"></div>
                        
                        <div class="input-group" style="margin-top:16px;">
                            <label>Add More Files</label>
                            <div style="display:flex; gap:12px; align-items:center;">
                                <input type="file" id="details-pdf-file" accept="application/pdf" multiple style="flex:1; padding:8px; border:1px dashed var(--glass-border); border-radius:var(--radius-md);">
                                <button class="btn btn-primary" id="details-upload-btn" onclick="procurementView.uploadAttachments()">Upload</button>
                                <div id="details-upload-status" style="font-size:12px; color:var(--success);"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Deleted Records Section -->
            <div id="proc-deleted-section" style="display:none;">
                <div class="card">
                    <h2 style="margin-bottom:16px;">Deleted PR & PO Records</h2>
                    <div class="table-responsive">
                        <table style="min-width:1200px;">
                            <thead>
                                <tr>
                                    <th>PR NO</th>
                                    <th>DESCRIPTION</th>
                                    <th>DELETED BY</th>
                                    <th>REASON FOR DELETION</th>
                                    <th>DELETED DATE</th>
                                    <th>ORIGINAL ISSUED BY</th>
                                </tr>
                            </thead>
                            <tbody id="po-deleted-tbody"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Delete Reason Modal -->
            <div id="proc-delete-modal" class="modal-overlay">
                <div class="modal-content" style="max-width:400px;">
                    <div class="modal-header">
                        <h2>Delete PR Record</h2>
                        <span class="modal-close" onclick="document.getElementById('proc-delete-modal').classList.remove('active')">&times;</span>
                    </div>
                    <p style="color:var(--text-muted); margin-bottom:16px; font-size:14px;">Please provide a clear reason for deleting this procurement record. This action cannot be undone.</p>
                    
                    <div class="input-group">
                        <label>Reason for Deletion</label>
                        <textarea id="proc-delete-reason" style="width:100%; height:80px; padding:8px; border-radius:6px; background:var(--bg-color); color:var(--text-primary); border:1px solid var(--border);" placeholder="Type reason here..."></textarea>
                    </div>

                    <div style="margin-top:20px; display:flex; justify-content:flex-end;">
                        <button class="btn btn-secondary" onclick="document.getElementById('proc-delete-modal').classList.remove('active')" style="margin-right:12px;">Cancel</button>
                        <button class="btn btn-danger" onclick="procurementView.confirmDeleteRecord()">Confirm Delete</button>
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
                        <div class="input-group" style="grid-column: span 2">
                            <label>PDF Attachment (PO Document)</label>
                            <div style="display:flex; gap:12px; align-items:center;">
                                <input type="file" id="m-pdf-file" accept="application/pdf" style="flex:1; padding:8px; border:1px dashed var(--glass-border); border-radius:var(--radius-md);">
                                <div id="m-pdf-status" style="font-size:12px; color:var(--success);"></div>
                            </div>
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
        const deletedSec = document.getElementById('proc-deleted-section');
        if (el.style.display === 'none') {
            el.style.display = 'block';
            main.style.display = 'none';
            if (deletedSec) deletedSec.style.display = 'none';
            this.updateAnalytics();
        } else {
            el.style.display = 'none';
            main.style.display = 'block';
            if (deletedSec) deletedSec.style.display = 'none';
        }
    },

    showAddModal: function() {
        this.editingIndex = -1;
        document.getElementById('proc-modal-title').innerText = "Create New PR & PO Record";
        this.resetModalFields();
        // Set default date to today
        document.getElementById('m-pr-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('m-issued-by').value = window.appEngine.currentUser?.name || window.appEngine.currentUser?.username || '';
        
        setTimeout(() => document.getElementById('m-pr-no').focus(), 100);

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
        document.getElementById('m-pdf-file').value = '';
        document.getElementById('m-pdf-status').innerText = '';
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
        
        // Handle PDF upload if selected
        const fileInput = document.getElementById('m-pdf-file');
        if (fileInput && fileInput.files[0]) {
            const statusEl = document.getElementById('m-pdf-status');
            statusEl.innerText = "⏳ Uploading PDF...";
            window.stateManager.uploadProcurementPDF(prNo, fileInput.files[0], (url) => {
                statusEl.innerText = "✅ Uploaded";
                this.populateTable();
            });
        }

        this.closeModal();
        this.populateTable();
    },


    showDetails: function(index) {
        this.currentDetailsIndex = index;
        const pos = window.stateManager.get('purchaseOrders');
        const po = pos[index];
        if (!po) return;

        document.getElementById('proc-main-section').style.display = 'none';
        document.getElementById('proc-analytics-section').style.display = 'none';
        document.getElementById('proc-deleted-section').style.display = 'none';
        document.getElementById('proc-details-section').style.display = 'block';

        const content = document.getElementById('details-content');
        content.innerHTML = `
            <div class="grid" style="grid-template-columns: 1fr 1fr 1fr; gap:16px;">
                <div><span style="color:var(--text-muted); font-size:12px;">PR NO</span><br><strong>${po['PR NO'] || '-'}</strong></div>
                <div><span style="color:var(--text-muted); font-size:12px;">PR STATUS</span><br>${this.statusBadge(po['PR STATUS'])}</div>
                <div><span style="color:var(--text-muted); font-size:12px;">PO NO</span><br><strong>${po['PO NO'] || '-'}</strong></div>
                <div style="grid-column: span 3;"><span style="color:var(--text-muted); font-size:12px;">DESCRIPTION</span><br>${po['DESCRIPTION'] || '-'}</div>
                <div><span style="color:var(--text-muted); font-size:12px;">ISSUED BY</span><br>${po['PR ISSUED BY'] || '-'}</div>
                <div><span style="color:var(--text-muted); font-size:12px;">CREATED DATE</span><br>${po['PR CREATED DATE'] || '-'}</div>
                <div><span style="color:var(--text-muted); font-size:12px;">PO RECIEVED DATE</span><br>${po['PO RECIEVED DATE'] || '-'}</div>
                <div><span style="color:var(--text-muted); font-size:12px;">TECHNICAL STATUS</span><br>${this.statusBadge(po['TECHNICAL APPROVAL STATUS'])}</div>
                <div><span style="color:var(--text-muted); font-size:12px;">PO STATUS</span><br>${this.statusBadge(po['PO STATUS'])}</div>
                <div><span style="color:var(--text-muted); font-size:12px;">PRICE ($)</span><br>${po['PO PRICE'] || '0.00'}</div>
                <div style="grid-column: span 3;"><span style="color:var(--text-muted); font-size:12px;">REMARKS</span><br>${po['REMARKS'] || '-'}</div>
            </div>
        `;

        this.renderDetailsAttachments(po);
    },

    closeDetails: function() {
        this.currentDetailsIndex = -1;
        document.getElementById('proc-details-section').style.display = 'none';
        document.getElementById('proc-main-section').style.display = 'block';
        this.populateTable();
    },

    renderDetailsAttachments: function(po) {
        const listContainer = document.getElementById('details-attachments-list');
        const attachments = po.attachments || [];
        
        // Include legacy pdfUrl if present and not already in attachments
        if (po.pdfUrl && attachments.length === 0) {
            attachments.push({
                name: 'Legacy PO Document.pdf',
                url: po.pdfUrl,
                uploadedAt: po['PR CREATED DATE'] || new Date().toISOString(),
                uploadedBy: po['PR ISSUED BY'] || 'System'
            });
        }

        if (attachments.length === 0) {
            listContainer.innerHTML = '<div style="color:var(--text-muted); font-size:14px; text-align:center; padding:12px;">No files attached to this record.</div>';
            return;
        }

        listContainer.innerHTML = attachments.map(att => {
            const dateStr = new Date(att.uploadedAt).toLocaleString();
            return `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:hsla(0,0%,100%,0.02); border:1px solid var(--border); border-radius:6px;">
                    <div>
                        <div style="font-weight:600; color:var(--text-main); margin-bottom:4px;">📄 ${att.name}</div>
                        <div style="font-size:11px; color:var(--text-muted);">Uploaded by ${att.uploadedBy} on ${dateStr}</div>
                    </div>
                    <div>
                        <a href="${att.url}" target="_blank" class="btn btn-secondary btn-sm" style="text-decoration:none;">🔗 View</a>
                    </div>
                </div>
            `;
        }).join('');
    },

    uploadAttachments: function() {
        const fileInput = document.getElementById('details-pdf-file');
        const statusEl = document.getElementById('details-upload-status');
        const files = fileInput.files;

        if (!files || files.length === 0) {
            window.appEngine.showToast('Please select at least one file to upload.', 'warning');
            return;
        }

        const pos = window.stateManager.get('purchaseOrders');
        const po = pos[this.currentDetailsIndex];
        if (!po) return;

        const prNumber = po['PR NO'];
        statusEl.innerText = "⏳ Uploading...";
        
        let uploadedCount = 0;
        
        // Process each file sequentially for simulation (can be parallelized)
        const processFile = (index) => {
            if (index >= files.length) {
                statusEl.innerText = "✅ Upload complete";
                fileInput.value = '';
                // Reload state to get updated attachments
                const updatedPos = window.stateManager.get('purchaseOrders');
                this.renderDetailsAttachments(updatedPos[this.currentDetailsIndex]);
                setTimeout(() => { statusEl.innerText = ""; }, 3000);
                return;
            }

            window.stateManager.uploadProcurementPDF(prNumber, files[index], (url) => {
                uploadedCount++;
                statusEl.innerText = `⏳ Uploading... (${uploadedCount}/${files.length})`;
                processFile(index + 1);
            });
        };

        processFile(0);
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
            const canEdit = user.userType === 'Owner' || (['System Admin', 'Admin'].includes(user.userType) && user.permProcurement === 'Edit');


            const attachmentsCount = (po.attachments && po.attachments.length) ? po.attachments.length : (pdfUrl ? 1 : 0);
            
            let attachmentHtml = `<button class="btn btn-primary btn-sm" onclick="procurementView.showDetails(${index})">📂 Details (${attachmentsCount})</button>`;

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
                <td style="display:flex; gap:6px;">
                    ${canEdit ? `
                        <button class="btn btn-secondary btn-sm" onclick="procurementView.showEditModal(${index})">✏️ Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="procurementView.deleteRecord(${index})" style="padding:5px 10px;">🗑️</button>
                    ` : '-'}
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
    },

    deleteRecord: function(index) {
        try {
            const pos = window.stateManager.get('purchaseOrders');
            if (index < 0 || index >= pos.length) {
                console.error('Invalid index for procurement deletion:', index);
                return;
            }

            this.pendingDeleteIndex = index;
            document.getElementById('proc-delete-reason').value = '';
            document.getElementById('proc-delete-modal').classList.add('active');
            
        } catch (err) {
            console.error('Error initiating delete:', err);
            window.appEngine.showToast('Failed to initiate delete.', 'danger');
        }
    },

    confirmDeleteRecord: function() {
        try {
            const pos = window.stateManager.get('purchaseOrders');
            const deletedPos = window.stateManager.get('deletedPurchaseOrders');
            const index = this.pendingDeleteIndex;

            if (index === undefined || index < 0 || index >= pos.length) {
                return;
            }

            const po = pos[index];
            const reason = document.getElementById('proc-delete-reason').value.trim();

            if (!reason) {
                window.appEngine.showToast('A reason is required to delete.', 'warning');
                return;
            }

            const user = window.appEngine.currentUser;
            const deletedBy = user ? (user.name || user.username || user.phone) : 'System';

            // Add deletion metadata
            po.deleteReason = reason;
            po.deletedBy = deletedBy;
            po.deletedDate = new Date().toISOString();

            // Log audit before state change
            window.stateManager.logAudit('PROCUREMENT_DELETE', `Deleted PR Record: ${po['PR NO'] || 'Unknown'}. Reason: ${reason}`, user);

            // Move to deleted list
            deletedPos.unshift(po);
            window.stateManager.set('deletedPurchaseOrders', deletedPos);

            // Remove from active list
            pos.splice(index, 1);
            window.stateManager.set('purchaseOrders', pos);
            
            document.getElementById('proc-delete-modal').classList.remove('active');
            this.pendingDeleteIndex = undefined;

            window.appEngine.showToast('Record deleted successfully.', 'warning');
            
            const analyticsSection = document.getElementById('proc-analytics-section');
            if (analyticsSection && analyticsSection.style.display !== 'none') {
                this.updateAnalytics();
            }
            if (document.getElementById('proc-deleted-section').style.display !== 'none') {
                this.populateDeletedTable();
            }
        } catch (err) {
            console.error('Error deleting procurement record:', err);
            window.appEngine.showToast('Failed to delete record.', 'danger');
        }
    },

    toggleDeletedRecords: function() {
        const deletedSec = document.getElementById('proc-deleted-section');
        const mainSec = document.getElementById('proc-main-section');
        const analyticsSec = document.getElementById('proc-analytics-section');
        
        if (deletedSec.style.display === 'none') {
            deletedSec.style.display = 'block';
            mainSec.style.display = 'none';
            analyticsSec.style.display = 'none';
            this.populateDeletedTable();
        } else {
            deletedSec.style.display = 'none';
            mainSec.style.display = 'block';
        }
    },

    populateDeletedTable: function() {
        const deletedPos = window.stateManager.get('deletedPurchaseOrders');
        const tbody = document.getElementById('po-deleted-tbody');
        if (!tbody) return;

        if (!deletedPos || deletedPos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--text-muted);">No deleted records found.</td></tr>`;
            return;
        }

        tbody.innerHTML = deletedPos.map(po => {
            const prNumber    = po['PR NO'] || '-';
            const description = po['DESCRIPTION'] || '-';
            const deletedBy   = po.deletedBy || 'Unknown';
            const reason      = po.deleteReason || 'No reason provided';
            const deletedDate = po.deletedDate ? new Date(po.deletedDate).toLocaleString() : '-';
            const issuedBy    = po['PR ISSUED BY'] || '-';

            return `<tr>
                <td><strong>${prNumber}</strong></td>
                <td>${description}</td>
                <td><span style="font-weight:600; color:var(--text-main);">${deletedBy}</span></td>
                <td style="color:var(--danger);">${reason}</td>
                <td style="font-size:12px; color:var(--text-muted)">${deletedDate}</td>
                <td style="font-size:12px; color:var(--text-muted)">${issuedBy}</td>
            </tr>`;
        }).join('');
    }
};
