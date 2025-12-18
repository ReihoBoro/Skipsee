import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    FacebookAuthProvider,
    signInAnonymously
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// ----------------------------------------------------
// 1. PASTE YOUR FIREBASE CONFIG HERE
// ----------------------------------------------------
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// DOM Elements
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const emailBtn = document.getElementById('email-submit-btn');
const googleBtn = document.getElementById('google-btn');
const facebookBtn = document.getElementById('facebook-btn');
const guestBtn = document.getElementById('guest-btn');
const errorMsgEl = document.getElementById('error-message');

// Helper: Handle Success
const handleLoginSuccess = (user) => {
    console.log("Logged in as:", user.email || "Anonymous");
    emailBtn.innerHTML = `<span class="inline-block animate-pulse">REDIRECTING...</span>`;
    // Redirect to main chat app
    window.location.href = "index.html";
};

// Helper: Handle Errors
const handleError = (error) => {
    console.error(error);
    errorMsgEl.textContent = error.message.replace("Firebase: ", "");
    errorMsgEl.classList.remove('hidden');

    // Reset button states
    emailBtn.disabled = false;
    emailBtn.innerText = "ENTER";
    googleBtn.disabled = false;
    facebookBtn.disabled = false;
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

// --- 3. Facebook Login ---
facebookBtn.addEventListener('click', () => {
    errorMsgEl.classList.add('hidden');
    const provider = new FacebookAuthProvider();
    signInWithPopup(auth, provider)
        .then((result) => handleLoginSuccess(result.user))
        .catch((error) => handleError(error));
});

// --- 4. Guest Login (Anonymous) ---
guestBtn.addEventListener('click', () => {
    errorMsgEl.classList.add('hidden');
    guestBtn.innerHTML = "Accessing Void...";
    signInAnonymously(auth)
        .then((result) => handleLoginSuccess(result.user))
        .catch((error) => handleError(error));
});
