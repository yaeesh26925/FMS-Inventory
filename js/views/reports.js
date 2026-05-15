// views/reports.js
window.reportsView = {
    _lastReportData: null,

    render: function() {
        const container = document.getElementById('module-reports');
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        const formatDate = (date) => date.toISOString().split('T')[0];

        const user = window.appEngine.currentUser;
        const canEdit = user.userType === 'Owner' || user.permReports === 'Edit';

        container.innerHTML = `
            <div class="header-row">
                <div></div>

                <button class="btn btn-back" onclick="window.appEngine.navigate('management')" style="width:auto">⬅️ Back to Management</button>
            </div>

            ${canEdit ? `
            <div class="grid">
                <div class="card" style="grid-column: span 2;">
                    <h2>Generate Analysis Report</h2>
                    <p style="color:var(--text-muted); margin-bottom:24px; font-size:14px;">Select a date range for a deep dive into inventory movements and financial impact.</p>
                    <div style="display:flex; gap:16px; flex-wrap:wrap; align-items:flex-end; margin-bottom:24px;">
                        <div class="input-group" style="margin-bottom:0; flex:1; min-width:180px;">
                            <label>Start Date</label>
                            <input type="date" id="report-start-date" value="${formatDate(thirtyDaysAgo)}">
                        </div>
                        <div class="input-group" style="margin-bottom:0; flex:1; min-width:180px;">
                            <label>End Date</label>
                            <input type="date" id="report-end-date" value="${formatDate(now)}">
                        </div>
                        <button class="btn btn-secondary" onclick="reportsView.previewReport()" style="height:45px; min-width:160px;">👁️ Preview Report</button>
                        <button class="btn btn-primary" id="btn-download-pdf-top" onclick="reportsView.generatePDF()" style="height:45px; min-width:160px; display:none;">📥 Download PDF</button>
                    </div>
                </div>

                <div class="stat-card" style="background: linear-gradient(135deg, var(--surface), rgba(59,130,246,0.1)); height:fit-content;">
                    <h3>Audit Coverage</h3>
                    <div class="val" id="rep-stat-audit">0 Logs</div>
                    <p style="font-size:12px; color:var(--text-muted); margin-top:8px;">Available for processing</p>
                </div>
            </div>

            <div id="report-preview-container" style="display:none; margin-top:32px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                    <h2 style="font-size:24px;">Report Preview</h2>
                    <button class="btn btn-primary" onclick="reportsView.generatePDF()">📥 Download PDF Document</button>
                </div>
                <div id="report-preview-content" class="card" style="padding:40px; background:var(--bg-color); border:1px solid var(--border-solid); color:var(--text-primary); font-family: 'Inter', sans-serif;">
                    <!-- Preview content injected here -->
                </div>
            </div>
            ` : `<div class="card"><p style="text-align:center; padding:40px; color:var(--text-muted);">You do not have permission to generate reports.</p></div>`}
        `;

        this.updateStats();
    },

    updateStats: function() {
        const audit = window.stateManager.get('audit') || [];
        const el = document.getElementById('rep-stat-audit');
        if (el) el.innerText = audit.length + ' Logs';
    },

    prepareData: function() {
        const startVal = document.getElementById('report-start-date').value;
        const endVal = document.getElementById('report-end-date').value;
        if (!startVal || !endVal) return null;

        const startDate = new Date(startVal);
        const endDate = new Date(endVal);
        endDate.setHours(23, 59, 59, 999);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            window.appEngine.showToast('Please select valid dates.', 'warning');
            return null;
        }

        const inventory = window.stateManager.get('inventory') || [];
        const audit = window.stateManager.get('audit') || [];
        const purchaseOrders = window.stateManager.get('purchaseOrders') || [];
        const requests = window.stateManager.get('requests') || [];

        // 1. FILTER AUDIT LOGS FOR RANGE
        const rangeAudit = audit.filter(log => {
            const ts = new Date(log.timestamp);
            return ts >= startDate && ts <= endDate;
        });

        // 2. INITIALIZE METRICS
        let totalReleased = 0;
        let totalAdded = 0;
        let newItemsAddedCount = 0;
        const itemsStats = {};
        const addedItemsList = [];
        const newItemsList = [];

        // 3. PROCESS AUDIT LOGS
        rangeAudit.forEach(log => {
            const details = log.details || '';
            // Priority: meta.itemId > regex match in details > name/code fallback
            let itemId = log.meta?.itemId || (details.match(/ID: ([^, \)]+)/) || details.match(/ID-([^, \)]+)/) || [])[1] || null;

            if (!itemId && details) {
                const nameMatch = details.match(/for ([^, \(\)]+)/i) || details.match(/of ([^, \(\)]+)/i) || details.match(/item ([^, \(\)]+)/i);
                if (nameMatch && nameMatch[1]) {
                    const term = nameMatch[1].trim().toLowerCase();
                    const found = inventory.find(i =>
                        (i.name != null && String(i.name).toLowerCase() === term) ||
                        (i.code != null && String(i.code).toLowerCase() === term)
                    );
                    if (found) itemId = found.id;
                }
            }

            if (log.action === 'ITEM_TAKEN' || log.action === 'REQUEST_FULFILLED') {
                const qty = log.meta?.qty || parseInt(details.match(/(\d+)/)?.[0] || 0);
                totalReleased += qty;
                if (itemId) {
                    if (!itemsStats[itemId]) itemsStats[itemId] = { added: 0, released: 0, lastActivity: null };
                    itemsStats[itemId].released += qty;
                    itemsStats[itemId].lastActivity = log.timestamp;
                }
            } else if (log.action === 'INVENTORY_RESTOCK') {
                const qty = log.meta?.qty || parseInt(details.match(/(\d+)/)?.[0] || 0);
                totalAdded += qty;
                const itemName = inventory.find(i => i.id === itemId)?.name || (details.match(/restock ([^, \(\)]+)/i) || details.match(/of ([^, \(\)]+)/i) || [])[1] || 'Unknown Item';
                addedItemsList.push({
                    date: new Date(log.timestamp).toLocaleDateString(),
                    item: String(itemName).trim(),
                    qty: qty,
                    reason: details.split('Reason:')[1] || 'Restock'
                });
                if (itemId) {
                    if (!itemsStats[itemId]) itemsStats[itemId] = { added: 0, released: 0, lastActivity: null };
                    itemsStats[itemId].added += qty;
                    itemsStats[itemId].lastActivity = log.timestamp;
                }
            } else if (log.action === 'INVENTORY_ADD') {
                newItemsAddedCount++;
                const qty = log.meta?.qty || parseInt(details.match(/\((\d+)\)/)?.[1] || 0);
                totalAdded += qty;
                const itemName = inventory.find(i => i.id === itemId)?.name || (details.match(/Added new item (.*?) \(/i) || details.match(/item (.*?) \(/i) || details.match(/item ([^, \(\)]+)/i) || [])[1] || 'New Item';
                newItemsList.push({
                    date: new Date(log.timestamp).toLocaleDateString(),
                    name: String(itemName).trim(),
                    code: inventory.find(i => i.id === itemId)?.code || '-',
                    qty: qty
                });
                if (itemId) {
                    if (!itemsStats[itemId]) itemsStats[itemId] = { added: 0, released: 0, lastActivity: null };
                    itemsStats[itemId].added += qty;
                    itemsStats[itemId].lastActivity = log.timestamp;
                }
            }
        });

        // 4. ASSET REGISTER ROWS
        const invTableRows = inventory.map(item => {
            const stats = itemsStats[item.id] || { added: 0, released: 0, lastActivity: null };
            let lastActivity = stats.lastActivity;
            if (!lastActivity) {
                const globalLog = audit.find(l => l.meta?.itemId === item.id);
                if (globalLog) lastActivity = globalLog.timestamp;
            }
            return [
                item.name,
                item.code,
                stats.added,
                stats.released,
                `${item.quantity} ${item.unit || ''}`,
                lastActivity ? new Date(lastActivity).toLocaleDateString() : 'N/A'
            ];
        });

        // 5. PROCUREMENT ROWS
        const poTableRows = purchaseOrders.filter(po => {
            const dateStr = po['PR CREATED DATE'] || po['TECHNICAL APPROVAL DATE'] || po['PO RECIEVED DATE'] || po.issuedDate || po.poDate || po.timestamp;
            if (!dateStr) return false;
            const date = new Date(dateStr);
            return !isNaN(date.getTime()) && date >= startDate && date <= endDate;
        }).map(po => [
            po['PR NO'] || po.prNumber || '-',
            po['PO NO'] || po.poNumber || '-',
            po['DESCRIPTION'] || po.description || '-',
            po['PO STATUS'] || po['PR STATUS'] || po.poStatus || po.prStatus || '-',
            `$${(parseFloat(po['PO PRICE'] || po.poPrice || po.price || 0)).toLocaleString(undefined, {minimumFractionDigits:2})}`,
            po['PR CREATED DATE'] ? new Date(po['PR CREATED DATE']).toLocaleDateString() : (po.issuedDate || po.poDate || '-')
        ]);

        // 6. RELEASE LOG GROUPED BY PURPOSE
        const purposeGroups = {};
        requests.filter(req => {
            const st = (req.status || '').toUpperCase();
            if (st !== 'CLAIMED' && st !== 'APPROVED') return false;
            const ts = new Date(req.claimedAt || req.approvedAt || req.timestamp);
            if (isNaN(ts.getTime())) return false;
            return ts >= startDate && ts <= endDate;
        }).forEach(req => {
            const purpose = req.purpose || 'Unspecified';
            if (!purposeGroups[purpose]) purposeGroups[purpose] = { items: [], totalValue: 0 };
            const item = inventory.find(i => i.id === req.itemId);
            const unitPrice = item ? (parseFloat(item.unitPrice) || 0) : 0;
            const qty = parseFloat(req.qty) || 0;
            const totalPrice = isNaN(qty * unitPrice) ? 0 : qty * unitPrice;
            purposeGroups[purpose].items.push({
                date: new Date(req.claimedAt || req.approvedAt || req.timestamp).toLocaleDateString(),
                item: item ? (item.name || 'Unknown') : 'Unknown',
                qty: qty,
                requestedBy: req.userName || req.username || '-',
                value: totalPrice
            });
            purposeGroups[purpose].totalValue += totalPrice;
        });

        return {
            startDate, endDate,
            totalReleased, totalAdded, newItemsAddedCount,
            inventoryValue: inventory.reduce((s, i) => s + ((parseFloat(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0)), 0),
            invTableRows, poTableRows, purposeGroups, newItemsList, addedItemsList
        };
    },

    previewReport: function() {
        let data;
        try {
            data = this.prepareData();
        } catch(e) {
            window.appEngine.showToast('Error preparing report data: ' + e.message, 'error');
            console.error('prepareData error:', e);
            return;
        }
        if (!data) return;
        this._lastReportData = data;

        const previewContent = document.getElementById('report-preview-content');
        const previewCtr = document.getElementById('report-preview-container');
        const downloadBtn = document.getElementById('btn-download-pdf-top');

        try {
            const TH = 'padding:10px; text-align:left; color:#fff; border:1px solid rgba(255,255,255,0.2);';
            const TH_SM = 'padding:8px; text-align:left; color:#fff; border:1px solid rgba(255,255,255,0.2);';
            const TD = 'padding:10px; border:1px solid var(--border-solid); color:var(--text-primary);';
            const TD_SM = 'padding:8px; border:1px solid var(--border-solid); color:var(--text-primary);';
            const H3 = 'margin-top:32px; margin-bottom:16px; padding-bottom:8px; border-bottom:2px solid var(--primary); color:var(--text-primary);';
            const THEAD_ROW = 'background:var(--primary);';

            previewContent.innerHTML = `
                <div style="text-align:center; margin-bottom:40px; border-bottom:2px solid var(--primary); padding-bottom:20px;">
                    <h1 style="color:var(--primary); margin-bottom:8px;">Inventory Status &amp; Analysis Report</h1>
                    <p style="color:var(--text-secondary);">Reporting Period: <strong style="color:var(--text-primary);">${data.startDate.toLocaleDateString()}</strong> to <strong style="color:var(--text-primary);">${data.endDate.toLocaleDateString()}</strong></p>
                    <p style="font-size:12px; color:var(--text-secondary); margin-top:4px;">System Timestamp: ${new Date().toLocaleString()}</p>
                </div>

                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:40px;">
                    <div style="padding:16px; background:rgba(59,130,246,0.1); border-radius:8px; border-left:4px solid var(--primary);">
                        <div style="font-size:12px; color:var(--text-secondary);">Total Released</div>
                        <div style="font-size:32px; font-weight:bold; color:var(--primary);">${data.totalReleased}</div>
                    </div>
                    <div style="padding:16px; background:rgba(34,197,94,0.1); border-radius:8px; border-left:4px solid #22c55e;">
                        <div style="font-size:12px; color:var(--text-secondary);">Stock Added</div>
                        <div style="font-size:32px; font-weight:bold; color:#22c55e;">${data.totalAdded}</div>
                    </div>
                    <div style="padding:16px; background:rgba(234,179,8,0.1); border-radius:8px; border-left:4px solid #eab308;">
                        <div style="font-size:12px; color:var(--text-secondary);">New Items</div>
                        <div style="font-size:32px; font-weight:bold; color:#eab308;">${data.newItemsAddedCount}</div>
                    </div>
                    <div style="padding:16px; background:rgba(139,92,246,0.1); border-radius:8px; border-left:4px solid #8b5cf6;">
                        <div style="font-size:12px; color:var(--text-secondary);">Total Inventory Value</div>
                        <div style="font-size:32px; font-weight:bold; color:#8b5cf6;">$${data.inventoryValue.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
                    </div>
                </div>

                <h3 style="${H3}">1. Inventory Asset Register (Movement Status)</h3>
                <div class="table-responsive">
                    <table style="width:100%; border-collapse:collapse; font-size:13px; margin-bottom:32px;">
                        <thead><tr style="${THEAD_ROW}">
                            <th style="${TH}">Item Name</th><th style="${TH}">Part #</th><th style="${TH}">Added</th><th style="${TH}">Released</th><th style="${TH}">Stock</th><th style="${TH}">Last Activity</th>
                        </tr></thead>
                        <tbody>
                            ${data.invTableRows.map(row => `<tr>${row.map(cell => `<td style="${TD}">${cell}</td>`).join('')}</tr>`).join('')}
                        </tbody>
                    </table>
                </div>

                <h3 style="${H3}">2. Procurement Summary</h3>
                <div class="table-responsive">
                    <table style="width:100%; border-collapse:collapse; font-size:13px; margin-bottom:32px;">
                        <thead><tr style="${THEAD_ROW}">
                            <th style="${TH}">PR #</th><th style="${TH}">PO #</th><th style="${TH}">Description</th><th style="${TH}">Status</th><th style="${TH}">Price</th><th style="${TH}">Date</th>
                        </tr></thead>
                        <tbody>
                            ${data.poTableRows.length > 0
                                ? data.poTableRows.map(row => `<tr>${row.map(cell => `<td style="${TD}">${cell}</td>`).join('')}</tr>`).join('')
                                : `<tr><td colspan="6" style="padding:20px; text-align:center; color:var(--text-secondary);">No procurement data for this period.</td></tr>`}
                        </tbody>
                    </table>
                </div>

                <h3 style="${H3}">3. Detailed Release Log (Grouped by Purpose)</h3>
                ${Object.keys(data.purposeGroups).length > 0
                    ? Object.keys(data.purposeGroups).map(purpose => `
                        <div style="margin-bottom:24px;">
                            <div style="display:flex; justify-content:space-between; background:rgba(59,130,246,0.12); padding:10px 16px; border-radius:6px; border-left:3px solid var(--primary); margin-bottom:8px;">
                                <strong style="color:#60a5fa; font-size:14px;">${purpose}</strong>
                                <span style="font-weight:bold; color:var(--text-primary);">Total: $${data.purposeGroups[purpose].totalValue.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                            </div>
                            <div class="table-responsive">
                                <table style="width:100%; border-collapse:collapse; font-size:12px;">
                                    <thead><tr style="${THEAD_ROW}">
                                        <th style="${TH_SM}">Date</th><th style="${TH_SM}">Item</th><th style="${TH_SM}">Qty</th><th style="${TH_SM}">Requested By</th><th style="${TH_SM}">Financial Info</th>
                                    </tr></thead>
                                    <tbody>
                                        ${data.purposeGroups[purpose].items.map(item => `
                                            <tr>
                                                <td style="${TD_SM}">${item.date}</td>
                                                <td style="${TD_SM}"><strong>${item.item}</strong></td>
                                                <td style="${TD_SM}">${item.qty}</td>
                                                <td style="${TD_SM}">${item.requestedBy}</td>
                                                <td style="padding:8px; border:1px solid var(--border-solid); color:#22c55e; font-weight:bold;">$${item.value.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `).join('')
                    : '<p style="padding:20px; text-align:center; color:var(--text-secondary);">No releases found for this period.</p>'}

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:24px; margin-top:32px;">
                    <div>
                        <h3 style="margin-bottom:12px; padding-bottom:8px; border-bottom:2px solid var(--primary); color:var(--text-primary);">4. New Items Added</h3>
                        <table style="width:100%; border-collapse:collapse; font-size:12px;">
                            <thead><tr style="${THEAD_ROW}"><th style="${TH_SM}">Date</th><th style="${TH_SM}">Item Name</th><th style="${TH_SM}">Initial Qty</th></tr></thead>
                            <tbody>
                                ${data.newItemsList.length > 0
                                    ? data.newItemsList.map(i => `<tr><td style="${TD_SM}">${i.date}</td><td style="${TD_SM}">${i.name}</td><td style="${TD_SM}">${i.qty}</td></tr>`).join('')
                                    : `<tr><td colspan="3" style="padding:12px; text-align:center; color:var(--text-secondary);">None in this period</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                    <div>
                        <h3 style="margin-bottom:12px; padding-bottom:8px; border-bottom:2px solid var(--primary); color:var(--text-primary);">5. Restocks</h3>
                        <table style="width:100%; border-collapse:collapse; font-size:12px;">
                            <thead><tr style="${THEAD_ROW}"><th style="${TH_SM}">Date</th><th style="${TH_SM}">Item</th><th style="${TH_SM}">Qty Added</th></tr></thead>
                            <tbody>
                                ${data.addedItemsList.length > 0
                                    ? data.addedItemsList.map(i => `<tr><td style="${TD_SM}">${i.date}</td><td style="${TD_SM}">${i.item}</td><td style="${TD_SM}">${i.qty}</td></tr>`).join('')
                                    : `<tr><td colspan="3" style="padding:12px; text-align:center; color:var(--text-secondary);">None in this period</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            previewCtr.style.display = 'block';
            if (downloadBtn) downloadBtn.style.display = 'block';
            previewCtr.scrollIntoView({ behavior: 'smooth' });
        } catch(e) {
            window.appEngine.showToast('Error rendering preview: ' + e.message, 'error');
            console.error('previewReport render error:', e);
        }
    },

    generatePDF: function() {
        const data = this._lastReportData || this.prepareData();
        if (!data) return;

        window.appEngine.showToast('Generating PDF...', 'info');

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const primary = [15, 23, 42];
        const accent = [59, 130, 246];

        doc.setFillColor(...primary);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('Fuel Maintenance Inventory Report', 15, 20);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Period: ${data.startDate.toLocaleDateString()} to ${data.endDate.toLocaleDateString()}`, 15, 28);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 15, 34);

        let y = 50;
        doc.setTextColor(...primary);
        doc.setFontSize(14);
        doc.text('Executive Summary', 15, y);
        y += 10;

        doc.autoTable({
            startY: y,
            head: [['Metric', 'Value']],
            body: [
                ['Total Items Released', data.totalReleased.toString()],
                ['Stock Added', data.totalAdded.toString()],
                ['New Items Created', data.newItemsAddedCount.toString()],
                ['Current Inventory Value', '$' + data.inventoryValue.toLocaleString(undefined, {minimumFractionDigits:2})]
            ],
            theme: 'striped',
            headStyles: { fillColor: accent },
            margin: { left: 15, right: 15 }
        });

        y = doc.lastAutoTable.finalY + 15;
        doc.setFontSize(14);
        doc.text('1. Inventory Asset Register', 15, y);
        y += 6;

        doc.autoTable({
            startY: y,
            head: [['Item Name', 'Part #', 'Added', 'Released', 'Stock', 'Last Activity']],
            body: data.invTableRows,
            theme: 'grid',
            headStyles: { fillColor: accent },
            styles: { fontSize: 8 },
            margin: { left: 15, right: 15 }
        });

        y = doc.lastAutoTable.finalY + 15;
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFontSize(14);
        doc.text('2. Procurement Summary', 15, y);
        y += 6;

        doc.autoTable({
            startY: y,
            head: [['PR #', 'PO #', 'Description', 'Status', 'Price', 'Date']],
            body: data.poTableRows.length > 0 ? data.poTableRows : [['-', '-', 'No data for period', '-', '-', '-']],
            theme: 'grid',
            headStyles: { fillColor: primary },
            styles: { fontSize: 8 },
            margin: { left: 15, right: 15 }
        });

        y = doc.lastAutoTable.finalY + 15;
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFontSize(14);
        doc.text('3. Detailed Release Log (By Purpose)', 15, y);
        y += 6;

        Object.keys(data.purposeGroups).forEach(purpose => {
            if (y > 240) { doc.addPage(); y = 20; }
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(`${purpose} - Total: $${data.purposeGroups[purpose].totalValue.toLocaleString(undefined, {minimumFractionDigits:2})}`, 15, y);
            y += 4;
            doc.autoTable({
                startY: y,
                head: [['Date', 'Item', 'Qty', 'Requested By', 'Financial Info']],
                body: data.purposeGroups[purpose].items.map(i => [i.date, i.item, i.qty, i.requestedBy, `$${i.value.toLocaleString(undefined, {minimumFractionDigits:2})}`]),
                theme: 'striped',
                headStyles: { fillColor: accent },
                styles: { fontSize: 7 },
                margin: { left: 15, right: 15 }
            });
            y = doc.lastAutoTable.finalY + 10;
        });

        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFontSize(14);
        doc.text('4. New Items & Restocks', 15, y);
        y += 6;

        doc.autoTable({
            startY: y,
            head: [['Category', 'Date', 'Item', 'Qty']],
            body: [
                ...data.newItemsList.map(i => ['New Item', i.date, i.name, i.qty]),
                ...data.addedItemsList.map(i => ['Restock', i.date, i.item, i.qty])
            ],
            theme: 'grid',
            headStyles: { fillColor: primary },
            styles: { fontSize: 8 },
            margin: { left: 15, right: 15 }
        });

        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Fuel Maintenance Inventory System - Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
        }

        const filename = `Inventory_Analysis_Report_${data.startDate.toISOString().split('T')[0]}.pdf`;
        doc.save(filename);
        window.appEngine.showToast('PDF saved!', 'success');
    }
};
