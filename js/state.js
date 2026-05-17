// state.js — Firebase Firestore backend

class StateManager {
    constructor() {
        this.cache = {};
        this.db = null;
        this._firestoreReady = false;
    }

    // ─── Empty defaults (Firestore starts completely empty) ────────────────────

    _getEmptyDefaults() {
        return {
            users: [],
            inventory: [],
            requests: [],
            purchaseOrders: [],
            locations: [],
            purposes: [],
            audit: [],
            tasks: [],
            Users: []
        };
    }

    // ─── Local fallback defaults (minimal admin for offline/dev use) ───────────

    _getLocalDefaults() {
        return {
            users: [
                {
                    phone: '0000000000',
                    password: btoa('admin'),
                    rcNumber: 'RC001',
                    name: 'System Admin',
                    userType: 'Admin',
                    requestPerm: 'Edit'
                }
            ],
            inventory: [],
            requests: [],
            purchaseOrders: [],
            locations: ['Warehouse A', 'Shelf B', 'Storage C'],
            purposes: ['Preventive Maintenance', 'Safety Ensure', 'Breakdown Repair'],
            audit: [],
            tasks: [],
            Users: []
        };
    }

    // ─── Firestore helpers ─────────────────────────────────────────────────────

    _docRef(key) {
        return this.db.collection('appData').doc(key);
    }

    async _firestoreGet(key) {
        try {
            const snap = await this._docRef(key).get();
            if (snap.exists) {
                return snap.data().value;
            }
            return null;
        } catch (e) {
            console.error(`Firestore GET failed for [${key}]:`, e);
            return null;
        }
    }

    async _firestoreSet(key, data) {
        try {
            await this._docRef(key).set({ value: data });
        } catch (e) {
            console.error(`Firestore SET failed for [${key}]:`, e);
        }
    }

    // ─── Load local fallback (offline / dev mode) ──────────────────────────────

    loadLocalFallback(callback) {
        console.warn('Running in LOCAL FALLBACK mode (no Firestore).');
        const defaults = this._getLocalDefaults();
        const keys = Object.keys(defaults);
        keys.forEach(key => {
            if (!localStorage.getItem(key)) {
                localStorage.setItem(key, JSON.stringify(defaults[key]));
            }
            this.cache[key] = JSON.parse(localStorage.getItem(key));
        });
        if (callback) callback();
    }

    // ─── Main init ─────────────────────────────────────────────────────────────

    initializeData(callback) {
        // Try Firestore if Firebase is available and configured
        if (window.firebase && window.CONFIG && window.CONFIG.FIREBASE_CONFIG) {
            try {
                if (!firebase.apps.length) {
                    firebase.initializeApp(window.CONFIG.FIREBASE_CONFIG);
                }
                this.db = firebase.firestore();
                this._firestoreReady = true;
                this._loadFromFirestore(callback);
                return;
            } catch (e) {
                console.error('Firestore init failed, falling back to local:', e);
                this.loadLocalFallback(callback);
                return;
            }
        }

        // No Firebase — local fallback
        this.loadLocalFallback(callback);
    }

    async _loadFromFirestore(callback) {
        const keys = Object.keys(this._getEmptyDefaults());
        let allLoaded = true;

        try {
            const promises = keys.map(async (key) => {
                let value = await this._firestoreGet(key);
                if (value === null) {
                    // Key doesn't exist yet — initialize as empty in Firestore
                    value = this._getEmptyDefaults()[key];
                    await this._firestoreSet(key, value);
                }
                this.cache[key] = value;
                
                // Hook up the realtime listener for this key
                this._setupRealtimeListener(key);
            });

            await Promise.all(promises);
        } catch (e) {
            console.error('Failed to load from Firestore:', e);
            allLoaded = false;
            this.loadLocalFallback(callback);
            return;
        }

        if (allLoaded && callback) callback();
    }

    _setupRealtimeListener(key) {
        if (!this._firestoreReady || !this.db) return;
        
        if (!this._listeners) {
            this._listeners = {};
        }
        
        // Avoid duplicate listeners
        if (this._listeners[key]) return;

        console.log(`Setting up Firestore realtime listener for [${key}]`);
        try {
            this._listeners[key] = this._docRef(key).onSnapshot((doc) => {
                if (doc.exists) {
                    const newValue = doc.data().value || [];
                    
                    // Compare changes to prevent redundant updates
                    const oldStr = JSON.stringify(this.cache[key] || []);
                    const newStr = JSON.stringify(newValue);
                    
                    if (oldStr !== newStr) {
                        console.log(`[Realtime Update] Data changed in Firestore for [${key}]`);
                        
                        // Intelligent live request detection & notification
                        if (key === 'requests') {
                            const oldRequests = this.cache[key] || [];
                            const newRequests = newValue || [];
                            
                            if (newRequests.length > oldRequests.length) {
                                const added = newRequests.filter(nr => !oldRequests.some(or => or.id === nr.id));
                                added.forEach(req => {
                                    const user = window.appEngine && window.appEngine.currentUser;
                                    if (user) {
                                        const isOwner = user.userType === 'Owner';
                                        const isSysAdmin = user.userType === 'System Admin';
                                        const isAdmin = user.userType === 'Admin';
                                        const isPermittedAdmin = isAdmin && user.requestPerm === 'Edit';
                                        
                                        if (isOwner || isSysAdmin || isPermittedAdmin) {
                                            if (window.appEngine) {
                                                const shortId = (req.id || '').substr(0, 8);
                                                window.appEngine.showToast(`🔔 New Request: ${req.userName || req.username} requested ${req.qty}x item(s) (REQ-${shortId})`, 'info');
                                                
                                                // Beep sound alert
                                                try {
                                                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                                                    const osc = audioContext.createOscillator();
                                                    const gain = audioContext.createGain();
                                                    osc.connect(gain);
                                                    gain.connect(audioContext.destination);
                                                    osc.frequency.setValueAtTime(587.33, audioContext.currentTime); // D5
                                                    gain.gain.setValueAtTime(0.1, audioContext.currentTime);
                                                    osc.start();
                                                    osc.stop(audioContext.currentTime + 0.18);
                                                } catch (audioErr) {
                                                    console.warn('Audio Context tone could not play:', audioErr);
                                                }
                                            }
                                        }
                                    }
                                });
                            }
                        }

                        this.cache[key] = newValue;
                        
                        // Dispatch global state-changed event to reactive-render active view
                        window.dispatchEvent(new CustomEvent('state-changed', { detail: { key, data: newValue } }));
                    }
                }
            }, (err) => {
                console.error(`Realtime listener error for [${key}]:`, err);
            });
        } catch (listenerErr) {
            console.error(`Failed to hook Firestore onSnapshot for [${key}]:`, listenerErr);
        }
    }

    // ─── Public API ────────────────────────────────────────────────────────────

    get(key) {
        return this.cache[key] || [];
    }

    set(key, data) {
        this.cache[key] = data;

        if (this._firestoreReady && this.db) {
            this._firestoreSet(key, data).catch(e => console.error('Firestore write error:', e));
        } else {
            localStorage.setItem(key, JSON.stringify(data));
        }

        // Trigger global update
        window.dispatchEvent(new CustomEvent('state-changed', { detail: { key, data } }));
    }


    logAudit(action, details, user, meta = {}) {
        const audit = this.get('audit');
        const entry = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            action,
            details,
            userName: user ? (user.name || user.username || user.phone) : 'System',
            meta: meta
        };
        audit.unshift(entry);
        this.cache['audit'] = audit;

        if (this._firestoreReady && this.db) {
            this._firestoreSet('audit', audit).catch(e => console.error('Audit write error:', e));
        } else {
            localStorage.setItem('audit', JSON.stringify(audit));
        }
    }

    resetPassword(rcNumber, newPassword, callback) {
        const users = this.get('users');
        const user = users.find(u => String(u.rcNumber).trim() === String(rcNumber).trim());
        if (user) {
            user.password = btoa(newPassword);
            this.set('users', users);
            this.logAudit('PASSWORD_RESET', 'User reset password via OTP', { name: user.name || rcNumber });
            if (callback) callback(true);
        } else {
            if (callback) callback(false, 'User not found');
        }
    }

    uploadProcurementPDF(prNumber, file, callback) {
        // PDF upload requires Firebase Storage — simulated here.
        // To enable: add Firebase Storage SDK and implement upload logic.
        console.log('PDF upload simulated for', prNumber);
        const reader = new FileReader();
        reader.onload = () => {
            setTimeout(() => {
                const fakeUrl = 'https://example.com/fake-pdf-url.pdf';
                const pos = this.get('purchaseOrders');
                const po = pos.find(p => p['PR NO'] === prNumber);
                if (po) po.pdfUrl = fakeUrl;
                this.set('purchaseOrders', pos);
                if (callback) callback(fakeUrl);

            }, 800);
        };
        reader.readAsDataURL(file);
    }
}

window.stateManager = new StateManager();
