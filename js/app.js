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

        this.initDOM();
        this.initEventListeners();
        this.initPWAInstallPrompt();
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
        // Trigger synchronized smooth CSS transition
        document.body.classList.add('theme-transitioning');

        document.body.classList.toggle('light-theme');
        const isLight = document.body.classList.contains('light-theme');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        
        this.updateChartDefaults();
        this.updateTopbar();
        
        // Update mobile theme button icon
        const mobileThemeBtn = document.getElementById('mobile-theme-btn');
        if (mobileThemeBtn) mobileThemeBtn.textContent = isLight ? '\uD83C\uDF19' : '\u2600\uFE0F';
        
        // Re-render current module if it has a chart
        const currentModule = document.querySelector('.module.active')?.id.replace('module-', '');
        if (['dashboard', 'procurement'].includes(currentModule)) {
            const view = window[currentModule + 'View'];
            if (view && typeof view.render === 'function') view.render();
        }

        // Clean up theme-transitioning class after transition completes
        setTimeout(() => {
            document.body.classList.remove('theme-transitioning');
        }, 400);
    }

    initPWAInstallPrompt() {
        let deferredPrompt = null;

        // Listen for beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('beforeinstallprompt event fired!');
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            deferredPrompt = e;
            
            // Check if user has already dismissed it in this session or permanently
            if (localStorage.getItem('pwa-install-dismissed') === 'true') {
                // Still show sidebar button so they have a way to install if they change their mind
                const sidebarInstallBtn = document.getElementById('pwa-sidebar-install');
                if (sidebarInstallBtn) {
                    sidebarInstallBtn.style.display = 'inline-flex';
                }
                return;
            }

            // Show the custom popup/banner after a short delay so it feels natural
            setTimeout(() => {
                this.showInstallPopup(deferredPrompt);
            }, 3000);

            // Show the sidebar button for manual installation anytime
            const sidebarInstallBtn = document.getElementById('pwa-sidebar-install');
            if (sidebarInstallBtn) {
                sidebarInstallBtn.style.display = 'inline-flex';
            }
        });

        // Set up manual trigger from the sidebar button
        const sidebarInstallBtn = document.getElementById('pwa-sidebar-install');
        if (sidebarInstallBtn) {
            sidebarInstallBtn.addEventListener('click', async () => {
                if (deferredPrompt) {
                    sidebarInstallBtn.disabled = true;
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    console.log(`User response to the install prompt: ${outcome}`);
                    deferredPrompt = null;
                    sidebarInstallBtn.style.display = 'none';
                    sidebarInstallBtn.disabled = false;
                    
                    const popup = document.getElementById('pwa-install-popup');
                    if (popup) {
                        popup.classList.remove('active');
                        setTimeout(() => popup.remove(), 400);
                    }
                } else {
                    this.showToast('Install prompt not available. Please ensure you are using Chrome or Edge and the app is not already installed.', 'info');
                }
            });
        }

        // Listen for successful installation
        window.addEventListener('appinstalled', (evt) => {
            console.log('App was successfully installed!');
            // Hide the popup if it's currently showing
            const popup = document.getElementById('pwa-install-popup');
            if (popup) {
                popup.classList.remove('active');
                setTimeout(() => popup.remove(), 400);
            }
            // Hide sidebar install button
            const sidebarInstallBtn = document.getElementById('pwa-sidebar-install');
            if (sidebarInstallBtn) sidebarInstallBtn.style.display = 'none';
            
            this.showToast('App installed successfully to your desktop!', 'success');
        });
    }

    showInstallPopup(deferredPrompt) {
        // Create popup element if it doesn't exist
        if (document.getElementById('pwa-install-popup')) return;

        const popup = document.createElement('div');
        popup.id = 'pwa-install-popup';
        popup.innerHTML = `
            <div class="pwa-popup-header">
                <div class="pwa-popup-logo">
                    <img src="assets/favicon.png" alt="App Logo">
                </div>
                <div class="pwa-popup-title-block">
                    <div class="pwa-popup-title">Install Fuel Maintenance Inventory</div>
                    <div class="pwa-popup-subtitle">Get the Desktop App</div>
                </div>
            </div>
            <div class="pwa-popup-body">
                Access the inventory system instantly from your desktop with offline support and a fast, distraction-free window.
            </div>
            <div class="pwa-popup-actions">
                <button class="pwa-popup-btn-install" id="pwa-popup-install-btn">💻 Install App</button>
                <button class="pwa-popup-btn-dismiss" id="pwa-popup-dismiss-btn">Maybe Later</button>
            </div>
        `;

        document.body.appendChild(popup);

        // Force a reflow to trigger the entry animation
        setTimeout(() => {
            popup.classList.add('active');
        }, 100);

        // Bind install action
        const installBtn = document.getElementById('pwa-popup-install-btn');
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                deferredPrompt = null;
                popup.classList.remove('active');
                setTimeout(() => popup.remove(), 400);
                
                const sidebarInstallBtn = document.getElementById('pwa-sidebar-install');
                if (sidebarInstallBtn) sidebarInstallBtn.style.display = 'none';
            }
        });

        // Bind dismiss action
        const dismissBtn = document.getElementById('pwa-popup-dismiss-btn');
        dismissBtn.addEventListener('click', () => {
            localStorage.setItem('pwa-install-dismissed', 'true');
            popup.classList.remove('active');
            setTimeout(() => popup.remove(), 400);
        });
    }



    mobileNavigate(moduleName) {
        this.navigate(moduleName);
    }

    initDOM() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigate(e.target.dataset.target);
            });
        });
    }

    initEventListeners() {
        window.addEventListener('state-changed', (e) => {
            console.log('State changed, refreshing active view...');
            const activeModule = document.querySelector('.module.active');
            if (activeModule) {
                const moduleName = activeModule.id.replace('module-', '');
                const view = window[moduleName + 'View'];
                if (view && typeof view.render === 'function') {
                    // Avoid full re-render for input focus stability if possible, 
                    // but for dashboard/inventory it's usually fine.
                    view.render();
                }
            }
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
                const displayName = this.currentUser.name || this.currentUser.phone || 'User';
                if (nameEl) nameEl.innerText = (displayName === 'undefined' || !displayName) ? 'User' : displayName;
                
                const btn = document.getElementById('auth-btn');
                if(btn) {
                    btn.innerText = 'Logout';
                    btn.className = 'btn btn-logout btn-sm';
                    btn.style.display = 'inline-flex'; // Ensure visible on desktop
                    btn.onclick = () => this.logout();
                }

                // Mobile Sidebar Logout
                const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
                if (mobileLogoutBtn) {
                    mobileLogoutBtn.onclick = () => this.logout();
                    // Hide the regular auth-btn on mobile when logged in to avoid duplicate buttons
                    if (window.innerWidth <= 850 && btn) btn.style.display = 'none';
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
                const nameStr = this.currentUser.name || this.currentUser.phone || '?';
                let initial = '?';
                if (nameStr !== '?') {
                    const parts = nameStr.trim().split(/\\s+/);
                    if (parts.length > 1) {
                        initial = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                    } else {
                        initial = parts[0].substring(0, 2).toUpperCase();
                    }
                }
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
        
        const isAdmin = ['Admin', 'Owner', 'System Admin'].includes(user.userType);
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

        const isAdmin = ['Admin', 'Owner', 'System Admin'].includes(user.userType);
        const publicModules = ['inventory', 'requests'];
        
        if (!publicModules.includes(moduleName)) {
            if (!isAdmin) {
                alert('Access Denied. You do not have permission to view this module.');
                return;
            }

            const permMap = {
                'correction': 'permRestock',
                'procurement': 'permProcurement',
                'financials': 'permDetailedInfo',
                'dashboard': 'permAnalytics',
                'tasks': 'permTasks',
                'reports': 'permReports',
                'purposes': 'permWorkPurposes',
                'audit': 'permAuditLog',
                'users': 'permUserManagement',
                'inventory-flow': 'permInventoryFlow'
            };

            const permKey = permMap[moduleName];
            if (user.userType !== 'Owner' && permKey) {
                const val = user[permKey];
                const isBlocked = (user.userType === 'System Admin') ? val === 'Non' : (val === 'Non' || !val);
                if (isBlocked) {
                    alert('Access Denied. You do not have permission for this module.');
                    this.navigate('management');
                    return;
                }
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
                const mgmtNav = document.getElementById('nav-management');
                if (mgmtNav) mgmtNav.classList.add('active');
            }
        }



        // Update topbar title
        const titleMap = {
            'inventory': 'Inventory',
            'requests': 'Requests',
            'management': 'Management',
            'procurement': 'Procurement',
            'financials': 'Detailed Info',
            'correction': 'Restock',
            'dashboard': 'Analytics',
            'tasks': 'Pending Work',
            'reports': 'Reports',
            'inventory-flow': 'Inv. Flow'
        };

        const titleEl = document.getElementById('topbar-title');
        if (titleEl && titleMap[moduleName]) titleEl.textContent = titleMap[moduleName];
        
        // Hide all modules, show selected
        document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
        document.getElementById('module-' + moduleName).classList.add('active');

        // Fire rendering object if exists
        const renderObj = window[moduleName + 'View'];
        if(renderObj && typeof renderObj.render === 'function') {
            renderObj.render();
        }

        // Auto-close mobile menu after navigation
        const sidebar = document.getElementById('sidebar');
        if (window.innerWidth <= 850 && sidebar && sidebar.classList.contains('mobile-active')) {
            this.toggleMobileMenu();
        }
    }

    toggleMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (!sidebar) return;

        sidebar.classList.toggle('mobile-active');
        if (backdrop) backdrop.classList.toggle('active');

        // Change hamburger icon to X if active
        const btn = document.querySelector('.mobile-menu-btn');
        if (btn) {
            btn.innerText = sidebar.classList.contains('mobile-active') ? '✕' : '☰';
        }
    }

    logout() {
        // Use global logout if available, otherwise fallback to local logic
        if (typeof window.logout === 'function') {
            window.logout();
        } else {
            if (!confirm('Are you sure you want to log out?')) return;
            localStorage.removeItem('currentUser');
            this.currentUser = null;
            this.showLogin();
            this.showToast('Logged out successfully.', 'info');
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

// Register Service Worker for PWA support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registered successfully with scope:', reg.scope))
            .catch(err => console.error('Service Worker registration failed:', err));
    });
}
