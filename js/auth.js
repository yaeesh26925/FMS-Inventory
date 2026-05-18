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

function initEmailJS() {
    if (window.emailjs && window.CONFIG.EMAILJS_CONFIG && window.CONFIG.EMAILJS_CONFIG.publicKey) {
        emailjs.init({
            publicKey: window.CONFIG.EMAILJS_CONFIG.publicKey,
        });
        console.log("EmailJS SDK initialized successfully.");
    }
}

// Ensure services initialize once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initFirebase();
    initEmailJS();
});

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

function startOTPLogin() {
    document.getElementById('login-step-1').style.display = 'none';
    document.getElementById('login-step-2').style.display = 'none';
    
    // We'll reuse step 1's phone input but show a "Send OTP" button instead
    const step1 = document.getElementById('login-step-1');
    step1.style.display = 'block';
    const btn = step1.querySelector('.btn-primary');
    btn.id = 'btn-send-otp';
    btn.innerText = 'Send OTP';
    btn.onclick = sendFirebaseOTP;

    
    // Add a small label to show we are in OTP mode
    let otpLabel = document.getElementById('otp-mode-label');
    if (!otpLabel) {
        otpLabel = document.createElement('div');
        otpLabel.id = 'otp-mode-label';
        otpLabel.style.cssText = 'background:rgba(59,130,246,0.1); color:var(--primary); padding:8px; border-radius:4px; margin-bottom:16px; font-size:12px; text-align:center; font-weight:600;';
        otpLabel.innerText = '🔐 OTP LOGIN MODE';
        step1.prepend(otpLabel);
    }
    
    // Hide password field
    const passGroup = document.getElementById('login-password').parentElement;
    if (passGroup) passGroup.style.display = 'none';
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
                if (user.isApproved === false) {
                    document.getElementById('login-error').innerText = 'Your account is pending administrator approval.';
                    auth.signOut();
                    return;
                }
                localStorage.setItem('currentUser', JSON.stringify(user));
                window.stateManager.logAudit('USER_LOGIN', 'User authenticated via Firebase OTP (Forgot Password flow)', { name: user.name || user.phone });
                window.appEngine.boot();
                
                // Cleanup OTP UI state for next time
                const otpLabel = document.getElementById('otp-mode-label');
                if (otpLabel) otpLabel.remove();
                const passGroup = document.getElementById('login-password').parentElement;
                if (passGroup) passGroup.style.display = 'block';
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
    console.log("Login attempt started...");
    let phone = document.getElementById('login-phone').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    
    if (!phone || !password) {
        errorEl.innerText = 'Please enter both phone and password.';
        return;
    }

    // Normalize phone number (prepend +960 for local, + for international)
    if (phone && !phone.startsWith('+')) {
        if (phone.length <= 10) {
            phone = '+960' + phone.replace(/^0+/, '');
        } else {
            phone = '+' + phone;
        }
    }
    
    console.log("Searching for normalized phone:", phone);
    const users = window.stateManager.get('users');
    console.log("Total users in system:", users.length);
    
    const hashedPass = btoa(password);
    const user = users.find(u => {
        const storedPhone = String(u.phone || '').trim();
        const phoneMatch = storedPhone === phone || phone.endsWith(storedPhone.replace(/^0+/, '')) || storedPhone.endsWith(phone.replace(/^\+960/, ''));
        const passMatch = (u.password === hashedPass || String(u.password) === String(password));
        return phoneMatch && passMatch;
    });
    
    if (user) {
        if (user.isApproved === false) {
            errorEl.innerText = 'Your account is pending administrator approval.';
            return;
        }
        console.log("User found! Logging in...", user.name);
        localStorage.setItem('currentUser', JSON.stringify(user));
        window.stateManager.logAudit('USER_LOGIN', 'User authenticated to system with password', { name: user.name || user.phone });
        window.appEngine.boot();
    } else {
        console.warn("Login failed: User not found or password mismatch.");
        errorEl.innerText = 'Invalid phone number or password';
    }
}

function logout() {
    if (!confirm('Are you sure you want to log out?')) return;

    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (user && window.stateManager) {
        window.stateManager.logAudit('USER_LOGOUT', 'User logged out', { name: user.name || user.phone });
    }
    
    localStorage.removeItem('currentUser');

    // Sign out from Firebase if initialized
    if (window.firebase && firebase.apps.length) {
        try {
            firebase.auth().signOut().catch(err => console.error("Firebase signOut error:", err));
        } catch (e) {
            console.warn("Firebase auth not ready for signOut");
        }
    }

    if (window.appEngine) {
        window.appEngine.currentUser = null;
        window.appEngine.boot();
        window.appEngine.showToast('Logged out successfully.', 'info');
    } else {
        location.reload();
    }
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

function sendOTPEmail(user, otp) {
    const email = user.email;
    const name = user.name || "User";

    if (!email) {
        console.warn("No email associated with user. Falling back to console OTP logging.");
        window.appEngine.showToast(`[SIMULATION] OTP ${otp} logged to console (No email registered for user)`, 'warning');
        console.log(`[PASS RESET OTP Fallback] User phone: ${user.phone}. Code: ${otp}`);
        return;
    }

    let sentViaEmailJS = false;
    let sentViaFirestore = false;

    // 1. Try sending via EmailJS
    if (window.emailjs && window.CONFIG.EMAILJS_CONFIG && window.CONFIG.EMAILJS_CONFIG.publicKey && window.CONFIG.EMAILJS_CONFIG.serviceId && window.CONFIG.EMAILJS_CONFIG.templateId) {
        emailjs.send(
            window.CONFIG.EMAILJS_CONFIG.serviceId,
            window.CONFIG.EMAILJS_CONFIG.templateId,
            {
                to_email: email,
                to_name: name,
                otp_code: otp,
                app_name: "Fuel Maintenance Inventory"
            }
        ).then(() => {
            console.log(`Email successfully dispatched via EmailJS to ${email}`);
        }).catch(err => {
            console.error("EmailJS dispatch failed:", err);
            window.appEngine.showToast("EmailJS send failed, check browser console.", "danger");
        });
        sentViaEmailJS = true;
    }

    // 2. Try writing to Firestore 'mail' collection (excellent for Firebase Trigger Email extension)
    if (window.firebase && firebase.apps.length && auth) {
        firebase.firestore().collection('mail').add({
            to: email,
            message: {
                subject: 'FMS Inventory - Password Reset OTP',
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; max-width: 480px; margin: 0 auto;">
                        <h2 style="color: #0f172a; margin-top: 0; font-family: 'Outfit', sans-serif;">Fuel Maintenance Inventory</h2>
                        <p style="font-size: 15px; line-height: 1.5; color: #334155;">Hello <strong>${name}</strong>,</p>
                        <p style="font-size: 15px; line-height: 1.5; color: #334155;">You requested to reset your password. Use the following 4-digit verification code:</p>
                        <div style="text-align: center; margin: 24px 0;">
                            <span style="display: inline-block; font-size: 36px; font-weight: 800; color: #3b82f6; letter-spacing: 4px; padding: 8px 24px; border: 2px dashed #3b82f6; border-radius: 6px; background-color: #eff6ff; font-family: monospace;">${otp}</span>
                        </div>
                        <p style="font-size: 14px; line-height: 1.5; color: #64748b;">This verification code is valid only for this session. Do not share this code with anyone.</p>
                        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                        <p style="font-size: 12px; line-height: 1.5; color: #94a3b8; margin-bottom: 0;">If you did not request this password reset, please ignore this email or notify an administrator.</p>
                    </div>
                `
            }
        }).then(() => {
            console.log(`Firestore mail document created successfully for ${email}`);
        }).catch(err => {
            console.error("Firestore 'mail' write failed:", err);
        });
        sentViaFirestore = true;
    }

    // 3. Provide feedback / fallback alert
    if (sentViaEmailJS || sentViaFirestore) {
        window.appEngine.showToast(`OTP Code sent to ${email}`, 'success');
    } else {
        // Fallback simulation when neither service is actively configured
        console.log(`[SIMULATED EMAIL] Send to ${email} (Name: ${name}): Your reset code is ${otp}`);
        window.appEngine.showToast(`[SIMULATION] OTP ${otp} sent to ${email}`, 'info');
    }
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
    
    // Send actual email OTP
    sendOTPEmail(user, currentOTP);
    
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
    const email = document.getElementById('reg-email').value.trim();
    
    if (!phone || !password || !rcNumber || !name || !email) {
        if (window.appEngine) window.appEngine.showToast("Please fill all fields.", 'warning');
        else alert("Please fill all fields.");
        return;
    }
    
    if (!auth) {
        if (window.appEngine) window.appEngine.showToast("Firebase is not configured. Cannot register.", 'danger');
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
    if (users.find(u => u.phone === formattedPhone || String(u.rcNumber).trim() === rcNumber || String(u.email).toLowerCase() === email.toLowerCase())) {
        if (window.appEngine) window.appEngine.showToast("User with this phone, email, or RC Number already exists.", 'danger');
        else alert("User with this phone, email, or RC Number already exists.");
        return;
    }

    if (window.appEngine) window.appEngine.showToast("Registering user...", "info");

    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Signed in temporarily, log out immediately to prevent bypassing approval
            auth.signOut();

            // Default to 'Standard' userType and 'View' requestPerm
            const newUser = {
                phone: formattedPhone,
                password: btoa(password),
                rcNumber: rcNumber,
                name: name,
                email: email,
                userType: 'Standard',
                requestPerm: 'View',
                isApproved: false
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
                window.appEngine.showToast("Registration successful! Your account is pending admin approval.", 'info');
            } else {
                alert("Registration successful! Your account is pending admin approval.");
            }
            
            hideRegistrationModal();
            document.getElementById('login-phone').value = formattedPhone;
        })
        .catch((error) => {
            console.error("Firebase Registration Error", error);
            if (window.appEngine) window.appEngine.showToast("Registration failed: " + error.message, 'danger');
            else alert("Registration failed: " + error.message);
        });
}

// Admin Email Password Reset
function sendAdminPasswordResetLink() {
    const user = window.appEngine.currentUser;
    if (!user || !['Admin', 'Owner', 'System Admin'].includes(user.userType)) {
        window.appEngine.showToast('You must be an admin to use this feature.', 'danger');
        return;
    }
    
    if (!user.email) {
        window.appEngine.showToast('No email address associated with your account. Please update your profile.', 'danger');
        return;
    }

    if (!auth) {
        window.appEngine.showToast('Firebase is not configured. Cannot send password reset email.', 'danger');
        return;
    }

    window.appEngine.showToast('Sending password reset link...', 'info');
    
    auth.sendPasswordResetEmail(user.email)
        .then(() => {
            window.appEngine.showToast(`Password reset link sent securely to ${user.email}`, 'success');
        })
        .catch((error) => {
            console.error("Error sending password reset email", error);
            window.appEngine.showToast("Failed to send reset link: " + error.message, 'danger');
        });
}
