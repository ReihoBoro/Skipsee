import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signInAnonymously,
    RecaptchaVerifier,
    signInWithPhoneNumber
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

// ----------------------------------------------------
// 1. PASTE YOUR FIREBASE CONFIG HERE
// ----------------------------------------------------
const firebaseConfig = {
    apiKey: "AIzaSyDuphzfY9CyUIYgoCrcfRL0yIOVtg1_z3g",
    authDomain: "skipsee-72e20.firebaseapp.com",
    projectId: "skipsee-72e20",
    storageBucket: "skipsee-72e20.firebasestorage.app",
    messagingSenderId: "87321092232",
    appId: "1:87321092232:web:c0fe03b57da21b88497f3d",
    measurementId: "G-38PHB4NL4L"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.useDeviceLanguage(); // Use device language for ReCaptcha

// DOM Elements
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const emailBtn = document.getElementById('email-submit-btn');
const googleBtn = document.getElementById('google-btn');
const guestBtn = document.getElementById('guest-btn');
const errorMsgEl = document.getElementById('error-message');

// Phone Auth Elements
const phoneBtn = document.getElementById('phone-btn');
const phoneLoginContainer = document.getElementById('phone-login-container');
const phoneInputGroup = document.getElementById('phone-input-group');
const otpInputGroup = document.getElementById('otp-input-group');
const phoneNumberInput = document.getElementById('phone-number');
const otpInput = document.getElementById('otp-code');
const sendCodeBtn = document.getElementById('send-code-btn');
const verifyCodeBtn = document.getElementById('verify-code-btn');
const cancelPhoneBtn = document.getElementById('cancel-phone-btn');
const retryPhoneBtn = document.getElementById('retry-phone-btn');

// --- Global Variables ---
window.confirmationResult = null;
let recaptchaVerifier;

// Helper: Handle Success
const handleLoginSuccess = (user) => {
    console.log("Logged in as:", user.email || user.phoneNumber || "Anonymous");
    // Show visual feedback
    if (emailBtn) emailBtn.innerHTML = `<span class="inline-block animate-pulse">REDIRECTING...</span>`;
    if (verifyCodeBtn) verifyCodeBtn.innerHTML = `<span class="inline-block animate-pulse">SUCCESS...</span>`;

    // Redirect to main chat app
    window.location.href = "index.html";
};

// Helper: Handle Errors
const handleError = (error) => {
    console.error(error);
    errorMsgEl.textContent = error.message.replace("Firebase: ", "");
    errorMsgEl.classList.remove('hidden');

    // Reset button states
    if (emailBtn) {
        emailBtn.disabled = false;
        emailBtn.innerText = "ENTER";
    }
    if (googleBtn) googleBtn.disabled = false;
    if (phoneBtn) phoneBtn.disabled = false;
    if (sendCodeBtn) {
        sendCodeBtn.disabled = false;
        sendCodeBtn.innerText = "Send Code";
    }
    if (verifyCodeBtn) {
        verifyCodeBtn.disabled = false;
        verifyCodeBtn.innerText = "Verify & Login";
    }
};

// --- 1. Email Login ---
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    errorMsgEl.classList.add('hidden');
    emailBtn.disabled = true;
    emailBtn.innerHTML = `<span class="inline-block animate-pulse">CONNECTING...</span>`;

    const email = emailInput.value;
    const password = passwordInput.value;

    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => handleLoginSuccess(userCredential.user))
        .catch((error) => handleError(error));
});

// --- 2. Google Login ---
googleBtn.addEventListener('click', () => {
    errorMsgEl.classList.add('hidden');
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
        .then((result) => handleLoginSuccess(result.user))
        .catch((error) => handleError(error));
});

// --- 3. Phone Login Logic ---

// A. Initialize ReCaptcha
const initRecaptcha = () => {
    if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            'size': 'normal',
            'callback': (response) => {
                // ReCAPTCHA solved, allow signIn
                sendCodeBtn.disabled = false;
            },
            'expired-callback': () => {
                // Response expired
                sendCodeBtn.disabled = true;
            }
        });
        window.recaptchaVerifier.render();
    }
}

// B. Show Phone Inputs
phoneBtn.addEventListener('click', () => {
    phoneBtn.classList.add('hidden');
    phoneInputGroup.classList.remove('hidden');
    // Init captcha when user intent is clear
    initRecaptcha();
});

// C. Cancel / Retry
cancelPhoneBtn.addEventListener('click', () => {
    phoneInputGroup.classList.add('hidden');
    phoneBtn.classList.remove('hidden');
    errorMsgEl.classList.add('hidden');
});

retryPhoneBtn.addEventListener('click', () => {
    otpInputGroup.classList.add('hidden');
    phoneInputGroup.classList.remove('hidden');
    errorMsgEl.classList.add('hidden');
    otpInput.value = '';
});

// D. Send OTP
sendCodeBtn.addEventListener('click', () => {
    const phoneNumber = phoneNumberInput.value;
    if (!phoneNumber) {
        handleError({ message: "Please enter a valid phone number (e.g. +1...)" });
        return;
    }

    errorMsgEl.classList.add('hidden');
    sendCodeBtn.disabled = true;
    sendCodeBtn.innerText = "Sending...";

    const appVerifier = window.recaptchaVerifier;

    signInWithPhoneNumber(auth, phoneNumber, appVerifier)
        .then((confirmationResult) => {
            // SMS sent. Prompt user to type the code.
            window.confirmationResult = confirmationResult;
            phoneInputGroup.classList.add('hidden');
            otpInputGroup.classList.remove('hidden');

            // Focus OTP input
            otpInput.focus();
        }).catch((error) => {
            handleError(error);
            // Reset captcha on failure
            if (window.recaptchaVerifier) {
                window.recaptchaVerifier.render().then(widgetId => {
                    grecaptcha.reset(widgetId);
                });
            }
        });
});

// E. Verify OTP
verifyCodeBtn.addEventListener('click', () => {
    const code = otpInput.value;
    if (!code || code.length < 6) {
        handleError({ message: "Please enter the 6-digit code." });
        return;
    }

    verifyCodeBtn.disabled = true;
    verifyCodeBtn.innerText = "Verifying...";

    window.confirmationResult.confirm(code).then((result) => {
        // User signed in successfully.
        const user = result.user;
        handleLoginSuccess(user);
    }).catch((error) => {
        handleError(error);
    });
});

// --- 4. Guest Login (Anonymous) ---
guestBtn.addEventListener('click', () => {
    errorMsgEl.classList.add('hidden');
    guestBtn.innerHTML = "Accessing Void...";
    signInAnonymously(auth)
        .then((result) => handleLoginSuccess(result.user))
        .catch((error) => handleError(error));
});
