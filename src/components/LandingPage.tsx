"use client";
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, useScroll, useTransform } from 'framer-motion';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { jwtDecode } from "jwt-decode";
import { GoogleOAuthProvider } from '@react-oauth/google';

interface GoogleUser {
    name?: string;
    given_name?: string;
    picture?: string;
    [key: string]: unknown;
}

interface LandingPageProps {
    onStart: (settings: { gender: string, identity: string, interests: string[], country: string }) => void;
    heroText?: { line1: string, line2: string, line3: string };
    subheadline?: string;
}

export default function LandingPage({ onStart, heroText, subheadline }: LandingPageProps) {
    const [modalStep, setModalStep] = useState(0); // 0=Closed, 1=Age, 2=Gender
    const [myGender, setMyGender] = useState<'male' | 'female' | null>(null);

    const [liveCount, setLiveCount] = useState(0);
    const [interests, setInterests] = useState('');
    const [country, setCountry] = useState('Global');
    const [gender, setGender] = useState('all'); // Target Preference

    // VIP System State
    const [showVipModal, setShowVipModal] = useState(false);
    const [isVip, setIsVip] = useState(false);
    const [freeMatchesLeft, setFreeMatchesLeft] = useState(2);

    // Auth & Guest Limits
    const [user, setUser] = useState<GoogleUser | null>(null); // Google User
    const [guestUsage, setGuestUsage] = useState(0);
    const [showLoginModal, setShowLoginModal] = useState(false); // Limit reached modal
    const [showAuthChoice, setShowAuthChoice] = useState(false); // Initial choice modal

    useEffect(() => {
        // Load VIP state and free matches from local storage on mount
        const storedVip = localStorage.getItem('skipsee_is_vip');
        const storedFreeMatches = localStorage.getItem('skipsee_free_matches');

        // Guest Limit Check
        const today = new Date().toDateString();
        const storedGuestDate = localStorage.getItem('skipsee_guest_date');
        const storedGuestUsage = localStorage.getItem('skipsee_guest_usage');

        if (storedGuestDate !== today) {
            // Reset if new day
            localStorage.setItem('skipsee_guest_date', today);
            localStorage.setItem('skipsee_guest_usage', '0');
            // eslint-disable-next-line
            setGuestUsage(0);
        } else if (storedGuestUsage) {
            setGuestUsage(parseInt(storedGuestUsage));
        }

        if (storedVip === 'true') setIsVip(true);
        if (storedFreeMatches) setFreeMatchesLeft(parseInt(storedFreeMatches));
    }, []);

    const handleGoogleSuccess = (credentialResponse: CredentialResponse) => {
        if (credentialResponse.credential) {
            const decoded = jwtDecode(credentialResponse.credential) as GoogleUser;
            setUser(decoded);
            console.log("Logged in:", decoded);
            setShowLoginModal(false); // Close limit modal if open
            setShowAuthChoice(false); // Close choice modal if open

            // If they were logging in from the start flow, proceed to next step
            if (showAuthChoice) {
                setModalStep(1);
            }
        }
    };

    const handleGenderSelect = (selectedGender: string) => {
        if (selectedGender === 'all') {
            setGender('all');
            return;
        }

        // Logic for Male/Female selection
        if (isVip) {
            setGender(selectedGender);
        } else {
            if (freeMatchesLeft > 0) {
                // Use a free match (Note: We deduct when they actually START chatting usually, 
                // but simpler to deduct on selection or warn them. 
                // User requirement: "get that feature only 2 times used".
                // I will deduct it when they confirm start if they have selected a gender filter,
                // OR I can deduct it here. Deducting here locks it immediately if they mis-click.
                // Better approach: Allow selection here if > 0. Deduct on "Start Matching".
                // However, to show the "Lock" UI state, we need to check here.
                setGender(selectedGender);
            } else {
                // Limit reached, show VIP modal
                setShowVipModal(true);
            }
        }
    };

    const buyVip = (_plan: string) => {
        // Redirect to Buy Me a Coffee (Payment remains pending)
        window.open('https://buymeacoffee.com/Reiho45', '_blank');
    };

    // Simulate live count (mock)
    useEffect(() => {
        const interval = setInterval(() => {
            setLiveCount(prev => Math.floor(Math.random() * 50) + 1200);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleStartClick = () => {
        // If already logged in, proceed
        if (user) {
            setModalStep(1);
            return;
        }

        // If not logged in, show Auth Choice (Google vs Guest)
        setShowAuthChoice(true);
    };

    const handleGuestContinue = () => {
        // Check Guest Limit
        if (guestUsage >= 3) {
            setShowAuthChoice(false);
            setShowLoginModal(true); // Show limit reached logic
            return;
        }
        setShowAuthChoice(false);
        setModalStep(1);
    };

    const confirmAge = () => {
        setModalStep(2); // Move to Gender Selection
    };

    const confirmStart = () => {
        if (!myGender) {
            alert("Please select your gender to continue.");
            return;
        }

        // Check Guest Limit again (security)
        if (!user && guestUsage >= 3) {
            setShowLoginModal(true);
            return;
        }

        // Increment Guest Usage if not logged in
        if (!user) {
            const newUsage = guestUsage + 1;
            setGuestUsage(newUsage);
            localStorage.setItem('skipsee_guest_usage', newUsage.toString());
        }

        // Deduct free match credit if using a filter and not VIP
        if (gender !== 'all' && !isVip) {
            if (freeMatchesLeft > 0) {
                const newCount = freeMatchesLeft - 1;
                setFreeMatchesLeft(newCount);
                localStorage.setItem('skipsee_free_matches', newCount.toString());
            } else {
                // Should not happen if UI is correct, but double check
                setShowVipModal(true);
                return;
            }
        }

        const interestList = interests.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0);

        // Send BOTH Preference (gender) and Identity (myGender)
        onStart({
            gender: gender, // Who I want to meet (all/male/female)
            identity: myGender, // Who I am (male/female)
            interests: interestList,
            country
        });
    };

    // Parallax logic for phone
    const { scrollY } = useScroll();
    const yPhone = useTransform(scrollY, [0, 500], [0, -100]);
    const rotatePhone = useTransform(scrollY, [0, 500], [-12, 0]);

    return (
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID_PLACEHOLDER"}>
            <div className="min-h-screen w-full bg-dark-bg text-white font-outfit selection:bg-primary selection:text-black overflow-x-hidden relative">

                {/* Auth Choice Modal */}
                {showAuthChoice && (
                    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-in fade-in duration-300">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-zinc-900 border border-white/10 p-8 rounded-3xl max-w-sm w-full shadow-2xl relative text-center"
                        >
                            <button onClick={() => setShowAuthChoice(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                                <i className="fas fa-times text-xl"></i>
                            </button>

                            <h2 className="text-2xl font-black text-white mb-2">Welcome to Skipsee</h2>
                            <p className="text-gray-400 text-sm mb-6">
                                Join the community for unlimited access or continue as a guest.
                            </p>

                            <div className="flex flex-col gap-4">
                                <div className="flex justify-center w-full">
                                    <GoogleLogin
                                        onSuccess={handleGoogleSuccess}
                                        onError={() => console.log('Login Failed')}
                                        theme="filled_black"
                                        shape="pill"
                                        width="100%"
                                    />
                                </div>

                                <div className="relative flex items-center py-2">
                                    <div className="flex-grow border-t border-white/10"></div>
                                    <span className="flex-shrink px-4 text-gray-500 text-xs uppercase font-bold">Or</span>
                                    <div className="flex-grow border-t border-white/10"></div>
                                </div>

                                <button
                                    onClick={handleGuestContinue}
                                    className="w-full py-2.5 bg-white/5 border border-white/10 text-white font-bold text-sm rounded-full hover:bg-white/10 transition-colors"
                                >
                                    Continue as Guest
                                </button>
                                <p className="text-[10px] text-gray-500">Guest accounts are limited to 3 chats/day</p>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Login Modal */}
                {showLoginModal && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-in fade-in duration-300">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-zinc-900 border border-white/10 p-8 rounded-3xl max-w-sm w-full shadow-2xl relative text-center"
                        >
                            <button onClick={() => setShowLoginModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                                <i className="fas fa-times text-xl"></i>
                            </button>

                            <h2 className="text-2xl font-black text-white mb-2">Daily Limit Reached</h2>
                            <p className="text-gray-400 text-sm mb-6">
                                Guest accounts are limited to 3 video chats per day. Login with Google to continue chatting for free!
                            </p>

                            <div className="flex justify-center">
                                <GoogleLogin
                                    onSuccess={handleGoogleSuccess}
                                    onError={() => {
                                        console.log('Login Failed');
                                    }}
                                    theme="filled_black"
                                    shape="pill"
                                />
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* VIP Modal */}
                {showVipModal && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-in fade-in duration-300">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-zinc-900 border border-yellow-500/50 p-6 md:p-8 rounded-3xl max-w-md w-full shadow-2xl relative overflow-hidden"
                        >
                            <button onClick={() => setShowVipModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                                <i className="fas fa-times text-xl"></i>
                            </button>

                            <div className="text-center mb-8">
                                <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-yellow-500/50">
                                    <i className="fas fa-crown text-4xl text-yellow-500"></i>
                                </div>
                                <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">
                                    Go <span className="text-yellow-500">VIP</span>
                                </h2>
                                <p className="text-gray-400 text-sm mt-2">
                                    Unlock Gender Matching & Unlimited Skips!
                                </p>
                            </div>

                            <div className="flex flex-col gap-3">
                                {[
                                    { name: 'Weekly', price: '₹399', label: '/ week' },
                                    { name: 'Monthly', price: '₹1,900', label: '/ month', best: true },
                                    { name: 'Yearly', price: '₹5,000', label: '/ year' },
                                ].map((plan) => (
                                    <button
                                        key={plan.name}
                                        onClick={() => buyVip(plan.name)}
                                        className={`relative flex items-center justify-between p-4 rounded-xl border transition-all ${plan.best ? 'bg-yellow-500 text-black border-yellow-500 hover:scale-[1.02]' : 'bg-zinc-800 border-white/10 hover:border-yellow-500/50 hover:bg-zinc-700'}`}
                                    >
                                        {plan.best && (
                                            <div className="absolute -top-3 right-4 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
                                                Best Value
                                            </div>
                                        )}
                                        <div className="flex flex-col items-start">
                                            <span className={`font-bold text-sm uppercase tracking-wide ${plan.best ? 'text-black' : 'text-gray-400'}`}>{plan.name}</span>
                                        </div>
                                        <div className="flex items-end gap-1">
                                            <span className={`text-2xl font-black ${plan.best ? 'text-black' : 'text-white'}`}>{plan.price}</span>
                                            <span className={`text-xs font-bold mb-1.5 ${plan.best ? 'text-black/70' : 'text-gray-500'}`}>{plan.label}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <p className="text-center text-[10px] text-gray-500 mt-6">
                                Recurring billing, cancel anytime. By continuing you agree to our Terms.
                            </p>
                        </motion.div>
                    </div>
                )}

                {/* 18+ & Gender Modal Overlay */}
                {/* Modal Overlay Multi-Step */}
                {modalStep > 0 && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">

                        {/* Step 1: Age Verification */}
                        {modalStep === 1 && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-zinc-900 border border-white/10 p-8 rounded-3xl max-w-sm w-full shadow-2xl relative overflow-hidden text-center"
                            >
                                <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>

                                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="text-2xl font-black text-red-500">18+</span>
                                </div>

                                <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">
                                    Age Restricted
                                </h2>
                                <p className="text-gray-400 text-sm mb-8 font-medium leading-relaxed">
                                    This platform is strictly for adults (18+). Are you over 18?
                                </p>

                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={confirmAge}
                                        className="w-full py-3 bg-white text-black font-black text-sm uppercase tracking-wider rounded-xl hover:scale-[1.02] transition-transform"
                                    >
                                        Yes, I am 18+
                                    </button>
                                    <button
                                        onClick={() => setModalStep(0)}
                                        className="w-full py-3 bg-zinc-800 text-gray-400 font-bold text-sm uppercase tracking-wider rounded-xl hover:bg-zinc-700 hover:text-white transition-colors"
                                    >
                                        No, Exit
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* Step 2: Gender Selection */}
                        {modalStep === 2 && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-zinc-900 border border-white/10 p-8 rounded-3xl max-w-md w-full shadow-2xl relative overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-full h-1 bg-primary"></div>

                                <h2 className="text-2xl font-black text-white mb-6 uppercase italic tracking-tighter text-center">
                                    Who are you?
                                </h2>

                                <div className="flex flex-col gap-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={() => setMyGender('male')}
                                            className={`py-6 rounded-2xl border-2 font-black uppercase text-sm transition-all flex flex-col items-center gap-2 ${myGender === 'male' ? 'border-primary bg-primary/10 text-primary scale-105 shadow-xl' : 'border-white/10 bg-black/20 text-gray-500 hover:border-white/30'}`}
                                        >
                                            <i className="fas fa-mars text-3xl mb-1"></i>
                                            Male
                                        </button>
                                        <button
                                            onClick={() => setMyGender('female')}
                                            className={`py-6 rounded-2xl border-2 font-black uppercase text-sm transition-all flex flex-col items-center gap-2 ${myGender === 'female' ? 'border-primary bg-primary/10 text-primary scale-105 shadow-xl' : 'border-white/10 bg-black/20 text-gray-500 hover:border-white/30'}`}
                                        >
                                            <i className="fas fa-venus text-3xl mb-1"></i>
                                            Female
                                        </button>
                                    </div>

                                    <div className="relative group">
                                        <div className="absolute -inset-1 bg-gradient-to-r from-primary to-orange-500 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                                        <button
                                            onClick={confirmStart}
                                            className="relative w-full py-4 bg-white text-black font-black text-lg uppercase tracking-wider rounded-xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-transform"
                                        >
                                            Start Matching <i className="fas fa-arrow-right ml-2"></i>
                                        </button>
                                    </div>

                                    <button
                                        onClick={() => setModalStep(0)}
                                        className="text-xs font-bold text-gray-600 hover:text-white mt-2 uppercase tracking-widest self-center"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </div>
                )}

                {/* Minimal Header */}
                <header className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-6 py-5 lg:px-12 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
                    <div className="flex items-center gap-2 pointer-events-auto">
                        <Image
                            src="/logo (1).svg"
                            alt="Skipsee Logo"
                            width={50}
                            height={50}
                            className="h-12 w-auto object-contain drop-shadow-md"
                        />
                        <span className="font-pacifico text-2xl tracking-wide" style={{ fontFamily: 'var(--font-pacifico), cursive' }}>
                            <span className="text-yellow-400">Skip</span><span className="text-white">see</span>
                        </span>
                    </div>
                    <div className="flex items-center gap-6 pointer-events-auto">
                        <div className="hidden md:flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/90 drop-shadow-sm">
                            <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse ring-2 ring-white/20"></div>
                            {liveCount.toLocaleString()} Online
                        </div>

                        {/* Login / Profile Section */}
                        {user ? (
                            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 pl-2 pr-4 py-1.5 rounded-full pointer-events-auto">
                                {user.picture ? (
                                    <Image src={user.picture} alt="Profile" width={28} height={28} className="rounded-full border border-white/50" />
                                ) : (
                                    <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center text-black font-bold text-xs uppercase">
                                        {user.name?.[0] || 'U'}
                                    </div>
                                )}
                                <span className="text-xs font-bold text-white hidden md:block">{user.given_name || user.name}</span>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowAuthChoice(true)}
                                className="bg-white text-black text-xs font-black uppercase tracking-wider px-5 py-2.5 rounded-full hover:scale-105 transition-transform shadow-lg pointer-events-auto"
                            >
                                Login
                            </button>
                        )}
                    </div>
                </header>

                {/* Main Section */}
                <main className="relative w-full min-h-screen md:h-screen flex flex-col items-center justify-center px-4 overflow-x-hidden md:overflow-hidden pt-24">
                    {/* Background Image: Friends at Sunset */}
                    <div className="absolute inset-0 z-0">
                        <Image
                            src="/hero_bg_v5.png"
                            alt="Background"
                            fill
                            className="object-cover opacity-90 scale-105"
                            priority
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30"></div>
                    </div>

                    <div className="relative z-10 w-full max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-16 md:gap-12 h-full justify-center pb-20 md:pb-0">

                        {/* Left: Content */}
                        <div className="flex-1 text-center md:text-left flex flex-col gap-4 relative z-20">
                            <motion.h1
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                                className="text-6xl md:text-[5rem] lg:text-[6.5rem] font-black tracking-tighter leading-[0.85] text-white drop-shadow-xl"
                            >
                                {heroText ? (
                                    <>
                                        {heroText.line1} <br />
                                        {heroText.line2} <br />
                                        <span className="text-primary">{heroText.line3}</span>
                                    </>
                                ) : (
                                    <>
                                        SNAP. <br />
                                        CHAT. <br />
                                        <span className="text-primary">LIVE.</span>
                                    </>
                                )}
                            </motion.h1>

                            <motion.p
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                                className="text-xl text-white/90 font-bold max-w-md mx-auto md:mx-0 drop-shadow-md"
                            >
                                {subheadline ? (
                                    subheadline
                                ) : (
                                    <>The fastest way to meet new friends. <br /> Just tap to start.</>
                                )}
                            </motion.p>

                            {/* Control Box - Snapchat Style */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.6, delay: 0.4 }}
                                className="mt-2 p-1"
                            >
                                <div className="bg-black/60 backdrop-blur-xl rounded-3xl p-5 flex flex-col gap-4 border border-white/10 shadow-2xl max-w-md mx-auto md:mx-0">

                                    {/* Country & Gender Row */}
                                    <div className="flex gap-3 h-12">
                                        {/* Country Select */}
                                        <div className="relative flex-1 h-full">
                                            <select
                                                value={country}
                                                onChange={(e) => setCountry(e.target.value)}
                                                className="w-full h-full bg-white/10 text-white font-bold text-xs uppercase tracking-wider rounded-xl px-4 appearance-none outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
                                            >
                                                <option value="Global" className="bg-zinc-900 text-white">Global 🌍</option>
                                                <option value="United States" className="bg-zinc-900 text-white">United States 🇺🇸</option>
                                                <option value="India" className="bg-zinc-900 text-white">India 🇮🇳</option>
                                                <option value="United Kingdom" className="bg-zinc-900 text-white">United Kingdom 🇬🇧</option>
                                                <option value="Canada" className="bg-zinc-900 text-white">Canada 🇨🇦</option>
                                            </select>
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/50 text-xs">
                                                <i className="fas fa-chevron-down"></i>
                                            </div>
                                        </div>

                                        {/* Gender Preference Select */}
                                        <div className="flex-[2] grid grid-cols-3 gap-2 bg-white/5 p-1 rounded-xl h-full">
                                            {['all', 'male', 'female'].map(g => {
                                                const isLocked = g !== 'all' && !isVip && freeMatchesLeft <= 0;
                                                return (
                                                    <button
                                                        key={g}
                                                        onClick={() => handleGenderSelect(g)}
                                                        className={`h-full text-[10px] font-black uppercase tracking-wider rounded-lg transition-all relative overflow-hidden ${gender === g
                                                            ? 'bg-primary text-black shadow-lg'
                                                            : 'text-white/70 hover:bg-white/10'
                                                            }`}
                                                    >
                                                        {isLocked && g !== 'all' && (
                                                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                                                                <i className="fas fa-lock text-yellow-500 text-xs"></i>
                                                            </div>
                                                        )}
                                                        {g === 'all' ? 'Both' : g}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Interests Input */}
                                    <div className="relative">
                                        <input
                                            type="text"
                                            className="w-full bg-white/10 border border-white/10 rounded-xl py-3.5 px-5 text-white placeholder:text-gray-400 outline-none focus:border-primary/50 focus:bg-white/20 transition-all font-semibold"
                                            placeholder="Add interests (e.g. #music)..."
                                            value={interests}
                                            onChange={(e) => setInterests(e.target.value)}
                                        />
                                        <i className="fas fa-hashtag absolute right-5 top-1/2 -translate-y-1/2 text-white/30"></i>
                                    </div>

                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={handleStartClick}
                                        className="w-full py-4 bg-primary hover:bg-primary-hover text-black font-black text-lg uppercase tracking-wider rounded-2xl shadow-lg shadow-primary/20 transition-all"
                                    >
                                        Start Chatting
                                    </motion.button>
                                </div>
                            </motion.div>
                        </div>

                        {/* Right: Phone Animation (Framer Motion) */}
                        <motion.div
                            style={{ y: yPhone, rotateY: rotatePhone }}
                            initial={{ opacity: 0, x: 100, rotateY: -30 }}
                            animate={{ opacity: 1, x: 0, rotateY: -12 }}
                            transition={{ duration: 1.2, ease: "easeOut" }}
                            className="flex-1 flex justify-center perspective-[1200px] relative h-[500px] md:h-[600px] items-center md:items-start z-20"
                        >
                            {/* Floating Animation Wrapper */}
                            <motion.div
                                animate={{
                                    y: [0, -20, 0],
                                    rotate: [0, 2, 0]
                                }}
                                transition={{
                                    duration: 6,
                                    ease: "easeInOut",
                                    repeat: Infinity,
                                }}
                                className="relative w-[250px] h-[500px] md:w-[300px] md:h-[600px] bg-black rounded-[40px] border-[8px] border-black shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden ring-1 ring-white/10"
                            >
                                {/* Dynamic Island */}
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 h-8 w-28 bg-black z-30 rounded-full flex items-center justify-center">
                                    <div className="w-16 h-4 bg-black rounded-full grid grid-cols-[1fr,4fr] gap-1 items-center px-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500/80"></div>
                                    </div>
                                </div>

                                {/* Screen Content */}
                                <div className="relative w-full h-full bg-zinc-800">
                                    <Image
                                        src="/phone_screen_v3.png"
                                        alt="App Interface"
                                        fill
                                        className="object-cover"
                                    />

                                    {/* Overlay UI */}
                                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/60">
                                        {/* Top Bar */}
                                        <div className="flex justify-between items-center p-5 pt-8">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white text-xs">
                                                    <i className="fas fa-flag"></i>
                                                </div>
                                                <span className="text-white/80 text-xs font-bold drop-shadow-md">United States</span>
                                            </div>
                                        </div>

                                        {/* Bottom Controls */}
                                        <div className="absolute bottom-0 left-0 w-full p-4 flex flex-col gap-3">

                                            {/* Chat Bubble */}
                                            <div className="bg-black/40 backdrop-blur-md rounded-xl p-3 self-start mb-2 border border-white/10 max-w-[85%]">
                                                <p className="text-white text-xs font-medium">From California! 🌴</p>
                                            </div>

                                            {/* Input & Skip */}
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 h-12 bg-black/50 backdrop-blur-xl rounded-full border border-white/10 flex items-center px-4">
                                                    <span className="text-white/50 text-xs font-semibold text-white/70">Type...</span>
                                                </div>
                                                <button className="h-12 px-5 bg-white text-black font-black text-xs uppercase tracking-wider rounded-full shadow-[0_0_15px_rgba(255,255,255,0.3)] hover:scale-105 transition-transform flex items-center gap-1">
                                                    SKIP <i className="fas fa-forward"></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>

                    </div>
                </main>

                {/* Features Section (Zig-Zag Layout) */}
                <section className="relative z-10 w-full bg-black py-32 px-6 lg:px-12">
                    <div className="max-w-7xl mx-auto flex flex-col gap-32">

                        {/* Feature 1: Interest Based Matching */}
                        <div className="flex flex-col md:flex-row items-center gap-12 lg:gap-24">
                            <motion.div
                                initial={{ opacity: 0, x: -50 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true, margin: "-100px" }}
                                transition={{ duration: 0.8 }}
                                className="flex-1"
                            >
                                <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(255,252,0,0.3)]">
                                    <i className="fas fa-heart text-2xl text-black"></i>
                                </div>
                                <h2 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight">
                                    MATCH BY <br />
                                    <span className="text-primary">INTERESTS.</span>
                                </h2>
                                <p className="text-gray-400 text-lg leading-relaxed mb-8">
                                    Why talk to randoms when you can find your tribe? Enter your hobbies, favorite music, or trending topics, and we'll connect you with people who vibe with the same stuff.
                                </p>
                                <ul className="space-y-4">
                                    {['Smart Matching Algorithm', 'Tag-based Filtering', 'Shared Hobbies'].map((item, i) => (
                                        <li key={i} className="flex items-center gap-3 text-white font-bold">
                                            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-primary text-xs">
                                                <i className="fas fa-check"></i>
                                            </div>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0, x: 50, rotate: 5 }}
                                whileInView={{ opacity: 1, x: 0, rotate: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.8 }}
                                className="flex-1 relative h-[500px] w-full bg-zinc-900 rounded-3xl overflow-hidden border border-white/10"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent"></div>
                                <div className="absolute inset-0">
                                    <Image
                                        src="/match_interests.png"
                                        alt="Match by Interests Visual"
                                        fill
                                        className="object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                                </div>
                                <div className="absolute bottom-0 left-0 w-full p-8 flex flex-col items-center text-center z-10">
                                    <div className="flex gap-2 justify-center mb-4">
                                        <span className="px-3 py-1 bg-primary text-black font-bold rounded-full text-xs uppercase shadow-lg border border-black">#Music</span>
                                        <span className="px-3 py-1 bg-white text-black font-bold rounded-full text-xs uppercase shadow-lg">#Travel</span>
                                    </div>
                                    <h3 className="text-2xl font-black text-white mb-2 drop-shadow-lg">It's a Match!</h3>
                                    <p className="text-white/90 text-sm font-medium drop-shadow-md">You both love <span className="text-primary">Music</span> & <span className="text-primary">Travel</span>.</p>
                                </div>
                            </motion.div>
                        </div>

                        {/* Feature 2: Instant Zig-Zag Random Chat */}
                        <div className="flex flex-col md:flex-row-reverse items-center gap-12 lg:gap-24">
                            <motion.div
                                initial={{ opacity: 0, x: 50 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true, margin: "-100px" }}
                                transition={{ duration: 0.8 }}
                                className="flex-1"
                            >
                                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                                    <i className="fas fa-bolt text-2xl text-black"></i>
                                </div>
                                <h2 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight">
                                    INSTANT <br />
                                    <span className="text-white decoration-primary underline decoration-4 underline-offset-4">CONNECTIONS.</span>
                                </h2>
                                <p className="text-gray-400 text-lg leading-relaxed mb-8">
                                    No waiting rooms, no signups, no hassle. One click and you're face-to-face with someone new. If it's awkward? Just skip. It's fast, fun, and addictive.
                                </p>
                                <div className="flex gap-4">
                                    <div className="p-4 bg-zinc-900 rounded-2xl border border-white/10 text-center flex-1">
                                        <h4 className="text-3xl font-black text-primary mb-1">0s</h4>
                                        <p className="text-xs text-gray-400 uppercase tracking-widest">Latency</p>
                                    </div>
                                    <div className="p-4 bg-zinc-900 rounded-2xl border border-white/10 text-center flex-1">
                                        <h4 className="text-3xl font-black text-white mb-1">1M+</h4>
                                        <p className="text-xs text-gray-400 uppercase tracking-widest">Users</p>
                                    </div>
                                </div>
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0, x: -50, rotate: -5 }}
                                whileInView={{ opacity: 1, x: 0, rotate: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.8 }}
                                className="flex-1 relative h-[500px] w-full bg-zinc-900 rounded-3xl overflow-hidden border border-white/10"
                            >
                                <div className="absolute inset-0">
                                    <Image
                                        src="/instant_connections.png"
                                        alt="Instant Connections Visual"
                                        fill
                                        className="object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center z-10">
                                    <div className="w-24 h-24 bg-white/10 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(255,255,255,0.2)] animate-pulse">
                                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-xl">
                                            <i className="fas fa-bolt text-3xl text-black"></i>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>

                    </div>
                </section>

                {/* Professional Footer */}
                <footer className="relative z-10 bg-black border-t border-white/10 pt-20 pb-10 px-6 lg:px-12">
                    <div className="max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                            <div className="col-span-1 md:col-span-1">
                                <h3 className="text-3xl font-black text-white mb-6">Skipsee.</h3>
                                <p className="text-gray-500 text-sm leading-relaxed mb-6">
                                    The world's most popular random video chat platform. Connect, share, and discover new friends from around the globe in seconds.
                                </p>
                                <div className="flex gap-4">
                                    {['twitter', 'instagram', 'tiktok', 'youtube'].map(social => (
                                        <a key={social} href="#" className="w-10 h-10 rounded-full bg-white/5 hover:bg-white text-white hover:text-black flex items-center justify-center transition-all">
                                            <i className={`fab fa-${social}`}></i>
                                        </a>
                                    ))}
                                </div>
                            </div>
                            <div className="col-span-1">
                                <h4 className="text-white font-bold uppercase tracking-widest mb-6 text-sm">Company</h4>
                                <ul className="space-y-4 text-gray-500 text-sm">
                                    {['About Us', 'Careers', 'Blog', 'Press'].map(item => (
                                        <li key={item}><a href="#" className="hover:text-primary transition-colors">{item}</a></li>
                                    ))}
                                </ul>
                            </div>
                            <div className="col-span-1">
                                <h4 className="text-white font-bold uppercase tracking-widest mb-6 text-sm">Legal</h4>
                                <ul className="space-y-4 text-gray-500 text-sm">
                                    {['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'Safety Center'].map(item => (
                                        <li key={item}><a href="#" className="hover:text-primary transition-colors">{item}</a></li>
                                    ))}
                                </ul>
                            </div>
                            <div className="col-span-1">
                                <h4 className="text-white font-bold uppercase tracking-widest mb-6 text-sm">Download</h4>
                                <p className="text-gray-500 text-sm mb-6">Experience Skipsee on mobile. Coming soon to iOS and Android.</p>
                                <button className="w-full py-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-3 hover:bg-white hover:text-black transition-all group">
                                    <i className="fab fa-apple text-xl"></i>
                                    <span className="font-bold text-sm">App Store</span>
                                </button>
                            </div>
                        </div>
                        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                            <p className="text-gray-600 text-xs">© 2026 Skipsee Inc. All rights reserved.</p>
                            <div className="flex gap-6 text-gray-600 text-xs">
                                <span>English (US)</span>
                                <span>Support</span>
                            </div>
                        </div>
                    </div>
                </footer>
            </div>
        </GoogleOAuthProvider>
    );
}
