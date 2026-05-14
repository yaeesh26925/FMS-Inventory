// views/tasks.js
window.tasksView = {
    render: function() {
        const container = document.getElementById('module-tasks');
        const user = window.appEngine.currentUser;
        const canEdit = user.permTasks === 'Edit';

        container.innerHTML = `
            <div class="header-row">
                <h1>📋 Pending Work</h1>
                <button class="btn btn-back" onclick="window.appEngine.navigate('management')" style="width:auto">⬅️ Back to Management</button>
            </div>
            <p style="color:var(--text-muted); margin-bottom:24px; font-size:13px;">Track your outstanding tasks. Tasks are synced with Google Sheets.</p>

            ${canEdit ? `
            <div class="card" style="margin-bottom:24px;">
                <h2 style="margin-bottom:16px;">Add New Task</h2>
                <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end;">
                    <div class="input-group" style="flex:1; min-width:220px; margin-bottom:0;">
                        <label>Task Title</label>
                        <input type="text" id="task-new-title" placeholder="e.g. Follow up on PO-2026-005" style="width:100%;">
                    </div>
                    <div class="input-group" style="flex:2; min-width:280px; margin-bottom:0;">
                        <label>Details / Notes (optional)</label>
                        <input type="text" id="task-new-details" placeholder="Any extra notes..." style="width:100%;">
                    </div>
                    <div class="input-group" style="min-width:160px; margin-bottom:0;">
                        <label>Due Date (optional)</label>
                        <input type="date" id="task-new-due" style="width:100%; padding:8px; border-radius:6px; border:1px solid var(--border); background:var(--bg-color); color:var(--text-primary);">
                    </div>
                    <button class="btn btn-primary" onclick="tasksView.addTask()" style="width:auto; padding:10px 20px; white-space:nowrap;">➕ Add Task</button>
                </div>
            </div>
            ` : ''}

            <div class="card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
                    <h2>Task List</h2>
                    <div style="display:flex; gap:8px;">
                        <button class="btn btn-secondary" id="task-filter-pending" onclick="tasksView.setFilter('pending')" style="width:auto; font-size:12px; padding:6px 14px;">⏳ Pending</button>
                        <button class="btn btn-secondary" id="task-filter-all" onclick="tasksView.setFilter('all')" style="width:auto; font-size:12px; padding:6px 14px;">📋 All</button>
                        <button class="btn btn-secondary" id="task-filter-done" onclick="tasksView.setFilter('done')" style="width:auto; font-size:12px; padding:6px 14px;">✅ Completed</button>
                    </div>
                </div>
                <div id="tasks-list-container">
                    <!-- populated by JS -->
                </div>
            </div>
        `;

        this._currentFilter = this._currentFilter || 'pending';
        this.renderList();
    },

    setFilter: function(filter) {
        this._currentFilter = filter;
        this.renderList();
    },

    renderList: function() {
        const container = document.getElementById('tasks-list-container');
        if (!container) return;

        // Highlight active filter button
        ['pending','all','done'].forEach(f => {
            const btn = document.getElementById('task-filter-' + f);
            if (btn) {
                btn.style.background = (f === this._currentFilter) ? 'var(--primary)' : '';
                btn.style.color = (f === this._currentFilter) ? '#fff' : '';
            }
        });

        let tasks = window.stateManager.get('tasks');
        if (this._currentFilter === 'pending') tasks = tasks.filter(t => !t.completed);
        else if (this._currentFilter === 'done') tasks = tasks.filter(t => t.completed);

        if (!tasks.length) {
            container.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:32px;">
                ${this._currentFilter === 'pending' ? '🎉 No pending tasks! All caught up.' : 'No tasks found.'}
            </p>`;
            return;
        }

        const user = window.appEngine.currentUser;
        const canEdit = user.permTasks === 'Edit';

        container.innerHTML = tasks.map(task => {
            const doneStyle = task.completed ? 'text-decoration:line-through; opacity:0.55;' : '';
            const dueStr = task.dueDate ? `<span style="font-size:11px; color:${this._isOverdue(task) ? 'var(--danger)' : 'var(--text-muted)'}; margin-left:8px;">📅 ${task.dueDate}${this._isOverdue(task) ? ' ⚠️ Overdue' : ''}</span>` : '';
            const addedStr = `<span style="font-size:11px; color:var(--text-muted);">Added ${new Date(task.createdAt).toLocaleDateString()}</span>`;
            const completedStr = task.completed ? `<span style="font-size:11px; color:var(--success); margin-left:8px;">✅ Completed ${task.completedAt ? new Date(task.completedAt).toLocaleDateString() : ''}</span>` : '';

            return `
            <div style="display:flex; align-items:flex-start; gap:12px; padding:14px 0; border-bottom:1px solid var(--border);">
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:600; font-size:15px; ${doneStyle}">${this._escape(task.title)}</div>
                    ${task.details ? `<div style="color:var(--text-muted); font-size:13px; margin-top:3px; ${doneStyle}">${this._escape(task.details)}</div>` : ''}
                    <div style="margin-top:6px;">${addedStr}${dueStr}${completedStr}</div>
                </div>
                ${canEdit ? `
                <div style="display:flex; gap:6px; flex-shrink:0;">
                    ${!task.completed ? `<button class="btn btn-primary btn-sm" onclick="tasksView.completeTask('${task.id}')" style="font-size:12px; padding:5px 12px;">✔ Complete</button>` : `<button class="btn btn-secondary btn-sm" onclick="tasksView.undoTask('${task.id}')" style="font-size:12px; padding:5px 12px; opacity:0.7;">↩ Undo</button>`}
                    <button class="btn btn-danger btn-sm" onclick="tasksView.deleteTask('${task.id}')" style="font-size:12px; padding:5px 10px;">🗑</button>
                </div>
                ` : ''}
            </div>`;
        }).join('');
    },

    _isOverdue: function(task) {
        if (!task.dueDate || task.completed) return false;
        return new Date(task.dueDate) < new Date(new Date().toDateString());
    },

    _escape: function(str) {
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    },

    addTask: function() {
        const titleEl = document.getElementById('task-new-title');
        const detailsEl = document.getElementById('task-new-details');
        const dueEl = document.getElementById('task-new-due');

        const title = (titleEl?.value || '').trim();
        if (!title) { alert('Please enter a task title.'); titleEl.focus(); return; }

        const tasks = window.stateManager.get('tasks');
        const newTask = {
            id: 'T-' + Date.now(),
            title: title,
            details: (detailsEl?.value || '').trim(),
            dueDate: dueEl?.value || '',
            completed: false,
            createdAt: new Date().toISOString(),
            completedAt: null
        };

        tasks.unshift(newTask);
        window.stateManager.set('tasks', tasks);

        titleEl.value = '';
        if (detailsEl) detailsEl.value = '';
        if (dueEl) dueEl.value = '';

        this._currentFilter = 'pending';
        this.renderList();
        window.appEngine.showToast('Task added!', 'success');
    },

    completeTask: function(id) {
        const tasks = window.stateManager.get('tasks');
        const t = tasks.find(t => t.id === id);
        if (t) {
            t.completed = true;
            t.completedAt = new Date().toISOString();
            window.stateManager.set('tasks', tasks);
            this.renderList();
            window.appEngine.showToast('Task marked as complete! ✅', 'success');
        }
    },

    undoTask: function(id) {
        const tasks = window.stateManager.get('tasks');
        const t = tasks.find(t => t.id === id);
        if (t) {
            t.completed = false;
            t.completedAt = null;
            window.stateManager.set('tasks', tasks);
            this.renderList();
        }
    },

    deleteTask: function(id) {
        if (!confirm('Delete this task?')) return;
        let tasks = window.stateManager.get('tasks');
        tasks = tasks.filter(t => t.id !== id);
        window.stateManager.set('tasks', tasks);
        this.renderList();
        window.appEngine.showToast('Task deleted.', 'warning');
    }
};
