// app.js
var appEngine = null;
class AppEngine {
    constructor() {
        this.currentUser = null;
        this.syncTimer = null;
        
        // Load stored theme
        if (localStorage.getItem('theme') === 'light') {
            document.body.classList.add('light-theme');
        }

        this.updateChartDefaults();

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW failed:', err));
        }
        this.initDOM();
        this.initPWA();
    }

    updateChartDefaults() {
        if (window.Chart) {
            const isLight = document.body.classList.contains('light-theme');
            // Explicit high-contrast colors for chart text based on theme
            Chart.defaults.color = isLight ? '#546880' : '#8ba3be';
            Chart.defaults.font.family = "'Inter', sans-serif";
            Chart.defaults.responsive = true;
            Chart.defaults.maintainAspectRatio = false;
        }
    }

    toggleTheme() {
        document.body.classList.toggle('light-theme');
        const isLight = document.body.classList.contains('light-theme');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        
        this.updateChartDefaults();
        this.updateTopbar();
        
        // Re-render current module if it has a chart
        const currentModule = document.querySelector('.module.active')?.id.replace('module-', '');
        if (['dashboard', 'procurement'].includes(currentModule)) {
            const view = window[currentModule + 'View'];
            if (view && typeof view.render === 'function') view.render();
        }
    }

    initPWA() {
        let deferredPrompt = null;
        const installBtns = [
            document.getElementById('pwa-install-btn'),
            document.getElementById('pwa-install-btn-mobile')
        ];
        
        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            deferredPrompt = e;
        });

        installBtns.forEach(installBtn => {
            if (installBtn) {
                installBtn.addEventListener('click', async () => {
                    if (deferredPrompt) {
                        // Show the prompt
                        deferredPrompt.prompt();
                        // Wait for the user to respond to the prompt
                        const { outcome } = await deferredPrompt.userChoice;
                        console.log(`User response to the install prompt: ${outcome}`);
                        // We've used the prompt, and can't use it again, throw it away
                        deferredPrompt = null;
                        installBtns.forEach(btn => { if(btn) btn.style.display = 'none'; });
                    } else {
                        alert("To install this app on your device, tap the Share icon (iOS) or Menu icon (Android/Chrome) and select 'Add to Home Screen'. Direct install is currently unavailable in this environment.");
                    }
                });
            }
        });
    }

    toggleMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (sidebar) sidebar.classList.toggle('active');
        if (backdrop) backdrop.classList.toggle('active');
    }

    initDOM() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigate(e.target.dataset.target);
            });
        });
    }

    boot() {
        console.log("AppEngine boot started...");
        const storedUser = localStorage.getItem('currentUser');
        console.log("Stored user found:", !!storedUser);
        
        if (storedUser) {
            try {
                const tempUser = JSON.parse(storedUser);
                console.log("Parsing stored user...");
                
                // Refresh currentUser from stateManager to get latest permissions
                const allUsers = window.stateManager.get('users');
                console.log("Total users in system cache:", allUsers.length);
                
                const refreshedUser = allUsers.find(u => String(u.phone || '').trim() === String(tempUser.phone || '').trim());
                console.log("Refreshed user found in cache:", !!refreshedUser);
                
                this.currentUser = refreshedUser || tempUser;
                localStorage.setItem('currentUser', JSON.stringify(this.currentUser));

                const nameEl = document.getElementById('current-user-name');
                if (nameEl) nameEl.innerText = this.currentUser.name || this.currentUser.phone;
                
                const btn = document.getElementById('auth-btn');
                if(btn) {
                    btn.innerText = 'Logout';
                    btn.className = 'btn btn-danger btn-sm mt-3';
                    btn.onclick = () => window.logout();
                }
                
                console.log("Updating UI components...");
                this.updateTopbar();
                this.setupNavigation();
                
                console.log("Switching views...");
                const loginView = document.getElementById('view-login');
                const appView = document.getElementById('view-app');
                
                if (loginView) loginView.classList.remove('active');
                if (appView) appView.classList.add('active');
                
                const activeModule = document.querySelector('.module.active');
                const currentModule = activeModule ? activeModule.id.replace('module-', '') : null;
                console.log("Current module detected:", currentModule);
                
                if(!currentModule || currentModule === 'login') {
                    console.log("Navigating to default: inventory");
                    this.navigate('inventory');
                } else {
                    console.log("Resuming module:", currentModule);
                    this.navigate(currentModule);
                }
                console.log("Boot sequence complete!");
            } catch (err) {
                console.error("CRITICAL ERROR during boot:", err);
                this.showLogin();
            }
        } else {
            console.log("No user stored, showing login.");
            this.currentUser = null;
            this.showLogin();
        }
    }

    updateTopbar() {
        const avatarEl   = document.getElementById('topbar-avatar');
        const usernameEl = document.getElementById('topbar-username');
        const themeBtn   = document.getElementById('theme-toggle-btn');

        if (avatarEl && usernameEl) {
            if (this.currentUser) {
                const initial = (this.currentUser.name || this.currentUser.phone || '?').charAt(0).toUpperCase();
                avatarEl.innerText   = initial;
                usernameEl.innerText = this.currentUser.name || this.currentUser.phone;
            } else {
                avatarEl.innerText   = '👤';
                usernameEl.innerText = 'Guest';
            }
        }

        if (themeBtn) {
            themeBtn.innerText = document.body.classList.contains('light-theme') ? '🌙' : '☀️';
        }
    }

    syncWithFirestore(silent = false) {
        if (!silent) this.showToast('Syncing with Firestore...', 'info');
        window.stateManager.initializeData(() => {
            // Re-run boot to refresh currentUser from latest users list and setup nav
            this.boot();
            
            if (!silent) this.showToast('Data synchronized successfully.', 'success');
            // Re-render current view is handled by boot() calling navigate()
        });
    }

    showLogin() {
        document.getElementById('view-app').classList.remove('active');
        document.getElementById('view-login').classList.add('active');
    }

    setupNavigation() {
        const user = this.currentUser;
        if (!user) return;
        
        const isAdmin = user.userType === 'Admin' || user.userType === 'Owner';
        const toggleNav = (id, visible) => {
            const el = document.getElementById('nav-' + id);
            if (el) el.style.display = visible ? 'block' : 'none';
        };

        // Only Inventory, Requests, and Management are visible in sidebar
        toggleNav('inventory', true);
        toggleNav('requests', true);
        toggleNav('management', isAdmin);
    }

    navigate(moduleName) {
        const user = this.currentUser;
        if (!user) {
            this.showLogin();
            return;
        }

        const isAdmin = user.userType === 'Admin' || user.userType === 'Owner';
        const publicModules = ['inventory', 'requests'];
        
        if (!publicModules.includes(moduleName)) {
            if (!isAdmin) {
                alert('Access Denied. You do not have permission to view this module.');
                return;
            }

            // Granular Admin Permissions
            const permMap = {
                'correction': 'permRestock',
                'procurement': 'permProcurement',
                'financials': 'permDetailedInfo',
                'dashboard': 'permAnalytics',
                'tasks': 'permTasks',
                'reports': 'permReports'
            };

            const permKey = permMap[moduleName];
            if (user.userType !== 'Owner' && permKey && (user[permKey] === 'Non' || !user[permKey])) {
                alert('Access Denied. You do not have permission for this module.');
                this.navigate('management');
                return;
            }
        }

        this.doNavigate(moduleName);
    }

    doNavigate(moduleName) {
        // UI Nav states
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        const navEl = document.getElementById('nav-' + moduleName);
        if(navEl) navEl.classList.add('active');
        else {
            // Keep Management active if it's a sub-module
            if(['procurement', 'financials', 'correction', 'dashboard', 'tasks', 'reports', 'inventory-flow'].includes(moduleName)) {
                document.getElementById('nav-management').classList.add('active');
            }
        }
        
        // Hide all modules, show selected
        document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
        document.getElementById('module-' + moduleName).classList.add('active');

        // Fire rendering object if exists
        const renderObj = window[moduleName + 'View'];
        if(renderObj && typeof renderObj.render === 'function') {
            renderObj.render();
        }

        // Close mobile menu if open
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (sidebar && sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
            if (backdrop) backdrop.classList.remove('active');
        }
    }



    showToast(message, type = 'success') {
        const existing = document.getElementById('app-toast');
        if (existing) existing.remove();

        const config = {
            success: { border: 'var(--success)', icon: '✨' },
            warning: { border: 'var(--warning)', icon: '⚠️' },
            danger:  { border: 'var(--danger)',  icon: '🚫' },
            info:    { border: 'var(--primary)', icon: 'ℹ️' }
        };
        const c = config[type] || config.success;

        const toast = document.createElement('div');
        toast.id = 'app-toast';
        toast.innerHTML = `<span style="font-size:18px">${c.icon}</span> <span>${message}</span>`;
        toast.style.cssText = `
            position: fixed;
            bottom: 32px;
            right: 32px;
            background: var(--surface);
            backdrop-filter: var(--glass-blur);
            border: 1px solid ${c.border};
            color: var(--text-main);
            padding: 16px 24px;
            border-radius: var(--radius-md);
            font-size: 15px;
            font-weight: 600;
            z-index: 10000;
            box-shadow: var(--shadow-hard);
            display: flex;
            align-items: center;
            gap: 12px;
            pointer-events: none;
        `;

        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 1, 1)';
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px) scale(0.9)';
            setTimeout(() => toast.remove(), 450);
        }, 3500);
    }

}

window.addEventListener('DOMContentLoaded', () => {
    // Instantiate engine immediately so UI clicks don't throw errors
    const engine = new AppEngine();
    window.appEngine = engine;
    appEngine = engine;
    
    // Show a loading indication if you want, or just wait for data
    window.stateManager.initializeData(() => {
        engine.boot();
    });
});
