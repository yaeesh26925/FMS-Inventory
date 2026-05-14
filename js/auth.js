// auth.js

// Firebase State
let auth = null;
let recaptchaVerifier = null;
let confirmationResult = null;

function initFirebase() {
    if (!window.firebase) return;
    if (window.CONFIG.FIREBASE_CONFIG && window.CONFIG.FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY") {
        if (!firebase.apps.length) {
            firebase.initializeApp(window.CONFIG.FIREBASE_CONFIG);
        }
        auth = firebase.auth();
        auth.useDeviceLanguage();
    }
}

// Ensure Firebase initializes once DOM is ready
document.addEventListener('DOMContentLoaded', initFirebase);

function setupRecaptcha() {
    if (!auth) return;
    
    // Check if verifier already exists and is healthy
    if (recaptchaVerifier && document.getElementById('recaptcha-container').innerHTML !== "") {
        return;
    }

    try {
        if (recaptchaVerifier) {
            try { recaptchaVerifier.clear(); } catch(e) {}
        }
        
        recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
            'size': 'invisible', 
            'callback': (response) => {
                // reCAPTCHA solved
            },
            'expired-callback': () => {
                document.getElementById('login-error').innerText = 'reCAPTCHA expired. Please try again.';
            }
        });
        recaptchaVerifier.render();
    } catch (err) {
        console.error("Recaptcha init failed:", err);
    }
}


function sendFirebaseOTP() {
    let phone = document.getElementById('login-phone').value.trim();
    if (!phone) {
        document.getElementById('login-error').innerText = 'Please enter a valid phone number.';
        return;
    }
    
    // Automatically prepend +960 only if it's a short local number
    if (!phone.startsWith('+')) {
        if (phone.length <= 10) {
            phone = '+960' + phone.replace(/^0+/, '');
        } else {
            phone = '+' + phone;
        }
    }
    
    const users = window.stateManager.get('users');
    const userExists = users.some(u => String(u.phone).trim() === phone || phone.endsWith(String(u.phone).trim().replace(/^0+/, '')));
    
    if (!userExists) {
        document.getElementById('login-error').innerHTML = 'Phone number not registered. <a href="#" onclick="showRegistrationModal()" style="color:var(--primary); font-weight:700;">Register here</a>.';
        return;
    }

    if (!auth) {
        document.getElementById('login-error').innerText = 'Firebase is not configured. Admins can still use password login below.';
        return;
    }

    document.getElementById('login-error').innerText = '';
    const btn = document.getElementById('btn-send-otp');
    btn.innerText = 'Sending...';
    btn.disabled = true;

    // We use the formatted phone number for Firebase
    setupRecaptcha();

    auth.signInWithPhoneNumber(phone, recaptchaVerifier)
        .then((result) => {
            confirmationResult = result;
            document.getElementById('login-step-1').style.display = 'none';
            document.getElementById('login-step-2').style.display = 'block';
            document.getElementById('login-error').innerText = '';
            if (window.appEngine) window.appEngine.showToast('OTP Sent successfully', 'success');
        })
        .catch((error) => {
            console.error("SMS Error", error);
            document.getElementById('login-error').innerText = error.message;
            if (recaptchaVerifier) {
                recaptchaVerifier.render().then(widgetId => window.grecaptcha.reset(widgetId));
            }
        })
        .finally(() => {
            btn.innerText = 'Send OTP';
            btn.disabled = false;
        });
}

function verifyFirebaseOTP() {
    const code = document.getElementById('login-otp').value.trim();
    if (!code || !confirmationResult) {
        document.getElementById('login-error').innerText = 'Please enter the OTP.';
        return;
    }

    const btn = document.getElementById('btn-verify-otp');
    btn.innerText = 'Verifying...';
    btn.disabled = true;

    confirmationResult.confirm(code)
        .then((result) => {
            const firebaseUser = result.user;
            const users = window.stateManager.get('users');
            const phone = firebaseUser.phoneNumber; 
            
            let user = users.find(u => String(u.phone).trim() === phone);
            if (!user) {
                 user = users.find(u => phone.endsWith(String(u.phone).trim().replace(/^0+/, '')));
            }

            if (user) {
                localStorage.setItem('currentUser', JSON.stringify(user));
                window.stateManager.logAudit('USER_LOGIN', 'User authenticated via Firebase OTP', { name: user.name || user.phone });
                window.appEngine.boot();
            } else {
                document.getElementById('login-error').innerText = 'User authenticated but not found in system directory.';
                auth.signOut();
            }
        })
        .catch((error) => {
            console.error("OTP Verification Error", error);
            document.getElementById('login-error').innerText = 'Invalid OTP. Please try again.';
        })
        .finally(() => {
            btn.innerText = 'Verify & Login';
            btn.disabled = false;
        });
}

function resetLoginView() {
    document.getElementById('login-step-1').style.display = 'block';
    document.getElementById('login-step-2').style.display = 'none';
    document.getElementById('login-error').innerText = '';
    if (recaptchaVerifier) {
        recaptchaVerifier.render().then(widgetId => window.grecaptcha.reset(widgetId));
    }
}

function loginWithPassword() {
    let phone = document.getElementById('login-phone').value.trim();
    const password = document.getElementById('login-password').value;
    const users = window.stateManager.get('users');
    
    // Normalize phone number (prepend +960 for local, + for international)
    if (phone && !phone.startsWith('+')) {
        if (phone.length <= 10) {
            phone = '+960' + phone.replace(/^0+/, '');
        } else {
            phone = '+' + phone;
        }
    }
    
    const hashedPass = btoa(password);
    const user = users.find(u => String(u.phone).trim() === phone && (u.password === hashedPass || String(u.password) === String(password)));
    
    if (user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
        window.stateManager.logAudit('USER_LOGIN', 'User authenticated to system with password', { name: user.name || user.phone });
        window.appEngine.boot();
    } else {
        document.getElementById('login-error').innerText = 'Invalid phone number or password';
    }
}

function logout() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if(user) window.stateManager.logAudit('USER_LOGOUT', 'User logged out', { name: user.name || user.phone });
    localStorage.removeItem('currentUser');
    
    // Force back to login view
    window.appEngine.boot();
}

// OTP State
let currentResetRC = null;
let currentOTP = null;

function showOTPModal(step) {
    document.querySelectorAll('[id^="otp-modal-"]').forEach(m => m.classList.remove('active'));
    if (step) {
        document.getElementById(`otp-modal-${step}`).classList.add('active');
    }
}

function closeOTPModals() {
    showOTPModal(null);
    currentResetRC = null;
    currentOTP = null;
}

function requestOTP() {
    const rc = document.getElementById('otp-rc-number').value.trim();
    if (!rc) {
        if (window.appEngine) window.appEngine.showToast("Please enter your RC Number", 'warning');
        else alert("Please enter your RC Number");
        return;
    }
    
    const users = window.stateManager.get('users');
    const user = users.find(u => String(u.rcNumber).trim() === rc);
    
    if (!user) {
        if (window.appEngine) window.appEngine.showToast("RC Number not found in system.", 'danger');
        else alert("RC Number not found in system.");
        return;
    }
    
    currentResetRC = rc;
    // Generate simulated 4-digit OTP
    currentOTP = Math.floor(1000 + Math.random() * 9000).toString();
    
    // SIMULATE SMS
    console.log(`[SIMULATED SMS] Send to ${user.phone}: Your reset code is ${currentOTP}`);
    window.appEngine.showToast(`[SIMULATION] OTP ${currentOTP} sent to ${user.phone}`, 'info');
    
    showOTPModal(2);
}

function verifyOTP() {
    const code = document.getElementById('otp-code-input').value.trim();
    if (code === currentOTP) {
        showOTPModal(3);
    } else {
        if (window.appEngine) window.appEngine.showToast("Invalid OTP code.", 'danger');
        else alert("Invalid OTP code.");
    }
}

function submitNewPassword() {
    const newPass = document.getElementById('otp-new-password').value;
    if (!newPass || newPass.length < 4) {
        if (window.appEngine) window.appEngine.showToast("Password too short", 'warning');
        else alert("Password too short");
        return;
    }
    
    window.appEngine.showToast("Updating password...", 'info');
    window.stateManager.resetPassword(currentResetRC, newPass, (success, msg) => {
        if (success) {
            window.appEngine.showToast("Password updated successfully!", 'success');
            closeOTPModals();
        } else {
            if (window.appEngine) window.appEngine.showToast("Failed to update password: " + (msg || "Unknown error"), 'danger');
            else alert("Failed to update password: " + (msg || "Unknown error"));
        }
    });
}

// Registration Functions
function showRegistrationModal() {
    document.getElementById('registration-modal').classList.add('active');
}

function hideRegistrationModal() {
    document.getElementById('registration-modal').classList.remove('active');
}

function registerUser() {
    const phone = document.getElementById('reg-phone').value.trim();
    const password = document.getElementById('reg-password').value;
    const rcNumber = document.getElementById('reg-rc').value.trim();
    const name = document.getElementById('reg-name').value.trim();
    
    if (!phone || !password || !rcNumber || !name) {
        if (window.appEngine) window.appEngine.showToast("Please fill all fields.", 'warning');
        else alert("Please fill all fields.");
        return;
    }
    
    // Automatically prepend +960 if not present
    let formattedPhone = phone;
    if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+960' + formattedPhone.replace(/^0+/, '');
    }

    const users = window.stateManager.get('users');
    const UsersTab = window.stateManager.get('Users');

    // Check if user already exists
    if (users.find(u => u.phone === formattedPhone || String(u.rcNumber).trim() === rcNumber)) {
        if (window.appEngine) window.appEngine.showToast("User with this phone or RC Number already exists.", 'danger');
        else alert("User with this phone or RC Number already exists.");
        return;
    }

    // Default to 'Standard' userType and 'View' requestPerm
    const newUser = {
        phone: formattedPhone,
        password: btoa(password),
        rcNumber: rcNumber,
        name: name,
        userType: 'Standard',
        requestPerm: 'View'
    };

    users.push(newUser);
    window.stateManager.set('users', users);
    
    // Sync with the uppercase Users tab cache if needed
    if(!UsersTab.find(u => String(u['RC Number']).trim() === rcNumber)) {
        UsersTab.push({ 'RC Number': rcNumber, 'Name': name });
        window.stateManager.set('Users', UsersTab);
    }

    window.stateManager.logAudit('USER_REGISTERED', 'New user registered', { name: name, phone: formattedPhone });
    
    if (window.appEngine) {
        window.appEngine.showToast("Registration successful! You can now log in.", 'success');
    } else {
        alert("Registration successful! You can now log in.");
    }
    
    hideRegistrationModal();
    document.getElementById('login-phone').value = formattedPhone;
}
