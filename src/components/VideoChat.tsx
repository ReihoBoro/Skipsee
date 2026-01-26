"use client";
import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';

interface VideoChatProps {
    stream: MediaStream | null;
    remoteStream: MediaStream | null;
    partner: { id: string, country: string } | null;
    isSearching: boolean;
    onSkip: () => void;
    onStop: () => void;
    onToggleMic: () => void;
    onToggleCam: () => void;
    onSendMessage: (msg: string) => void;
    messages: { text: string, isMine: boolean }[];
    micEnabled: boolean;
    camEnabled: boolean;
}

export default function VideoChat({
    stream, remoteStream, partner, isSearching,
    onSkip, onStop, onToggleMic, onToggleCam,
    onSendMessage, messages, micEnabled, camEnabled
}: VideoChatProps) {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [msgText, setMsgText] = useState('');
    const [chatOpen, setChatOpen] = useState(true);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    const EMOJIS = ['😂', '❤️', '😍', '🔥', '👍', '👋', '🎉', '😮', '😢', '😡', '👻', '💩'];

    // PIP Drag State
    const [pipPos, setPipPos] = useState({ x: 0, y: 0 }); // Relative to initial bottom-right
    const pipRef = useRef<HTMLDivElement>(null);
    const constraintsRef = useRef(null);

    useEffect(() => {
        if (localVideoRef.current && stream) {
            localVideoRef.current.srcObject = stream;
        }
    }, [stream]);

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        } else if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }
    }, [remoteStream]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = () => {
        if (msgText.trim()) {
            onSendMessage(msgText);
            setMsgText('');
            setShowEmojiPicker(false);
        }
    };

    const addEmoji = (emoji: string) => {
        setMsgText(prev => prev + emoji);
    };

    return (
        <div className="fixed inset-0 bg-black z-50 overflow-hidden text-white font-outfit">
            {/* Navbar - Minimal & Transparent */}
            <nav className="absolute top-0 left-0 w-full h-20 px-6 md:px-8 flex justify-between items-center z-50 pointer-events-none">
                <div className="flex items-center gap-3 pointer-events-auto">
                    <Image
                        src="/logo (1).svg"
                        alt="Skipsee"
                        width={50}
                        height={50}
                        className="w-12 h-12 object-contain drop-shadow-md"
                    />
                </div>
                <div className="pointer-events-auto flex items-center gap-3">
                    <span className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold border border-white/10 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        LIVE
                    </span>
                </div>
            </nav>

            {/* Video Grid */}
            <div ref={constraintsRef} className="relative w-full h-full">
                {/* Remote Video (Full Screen) */}
                <div className="w-full h-full bg-zinc-900 relative">
                    <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />

                    {/* Partner Info Overlay */}
                    {partner && !isSearching && (
                        <div className="absolute top-8 left-1/2 -translate-x-1/2 md:top-8 bg-black/20 backdrop-blur-xl px-5 py-2 rounded-full flex items-center gap-2 border border-white/10 z-40 shadow-lg">
                            <span className="text-xl drop-shadow-md">{partner.country === 'US' ? '🇺🇸' : partner.country === 'IN' ? '🇮🇳' : '🌍'}</span>
                            <span className="text-sm font-bold text-white drop-shadow-md tracking-wide">Connected</span>
                        </div>
                    )}

                    {/* Searching Spinner */}
                    {isSearching && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-50">
                            <div className="relative w-20 h-20 mb-6">
                                <div className="absolute inset-0 border-4 border-white/10 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                            </div>
                            <p className="text-white text-2xl font-black tracking-tight animate-pulse">FINDING SOMEONE...</p>
                            <p className="text-white/50 text-sm mt-2 font-medium">Matching based on your interests</p>
                        </div>
                    )}
                </div>

                {/* Local Video (PIP) - Draggable */}
                <motion.div
                    drag
                    dragConstraints={constraintsRef}
                    dragElastic={0.1}
                    dragMomentum={false}
                    whileHover={{ scale: 1.05, cursor: "grab" }}
                    whileDrag={{ scale: 1.1, cursor: "grabbing" }}
                    className="absolute right-4 top-24 md:bottom-28 md:right-8 w-[120px] h-[160px] md:w-[180px] md:h-[240px] bg-black/50 rounded-2xl overflow-hidden shadow-2xl border border-white/10 z-50 transition-colors"
                >
                    <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                </motion.div>
            </div>

            {/* Chat Overlay - Mobile Bottom / Desktop Left */}
            <div className={`absolute bottom-24 left-4 right-4 md:left-8 md:right-auto md:w-[380px] md:bottom-32 flex flex-col z-40 transition-all duration-300 ${chatOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                <div className="max-h-[200px] md:max-h-[300px] overflow-y-auto mb-3 flex flex-col gap-2 pr-2 scrollbar-hide mask-image-linear-to-t">
                    {messages.map((m, i) => (
                        <div key={i} className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-sm font-medium backdrop-blur-md shadow-sm ${m.isMine ? 'bg-primary text-black self-end rounded-br-sm' : 'bg-black/60 border border-white/10 text-white self-start rounded-bl-sm'}`}>
                            {m.text}
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
                <div className="flex gap-2 bg-black/60 p-2 rounded-full border border-white/10 backdrop-blur-xl pointer-events-auto">
                    <input
                        type="text"
                        value={msgText}
                        onChange={e => setMsgText(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleSend()}
                        placeholder="Say hello..."
                        className="flex-1 bg-transparent border-none px-4 py-2 text-white outline-none text-sm font-semibold placeholder:text-white/40"
                    />

                    {/* Emoji Toggle */}
                    <div className="relative">
                        <button
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className="w-10 h-10 text-white/70 hover:text-white flex items-center justify-center transition-colors"
                        >
                            <i className="fas fa-smile text-lg"></i>
                        </button>

                        {/* Emoji Picker Popup */}
                        {showEmojiPicker && (
                            <div className="absolute bottom-12 right-0 bg-zinc-900 border border-white/10 rounded-xl p-3 grid grid-cols-4 gap-2 shadow-xl w-48 mb-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                                {EMOJIS.map(emoji => (
                                    <button
                                        key={emoji}
                                        onClick={() => addEmoji(emoji)}
                                        className="text-2xl hover:scale-125 transition-transform p-1"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <button onClick={handleSend} className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center text-sm hover:scale-105 active:scale-95 transition-transform">
                        <i className="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>

            {/* Controls Bar */}
            <div className="absolute bottom-0 left-0 w-full p-4 md:p-8 flex items-center justify-between md:justify-center gap-2 md:gap-4 z-50 bg-gradient-to-t from-black via-black/80 to-transparent pb-6 md:pb-8">
                <div className="flex items-center gap-2 bg-black/40 backdrop-blur-2xl p-2 rounded-full border border-white/10 shrink-0">
                    <button
                        onClick={onToggleMic}
                        className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-base md:text-lg transition-all ${!micEnabled ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-white/10 text-white hover:bg-white/20'}`}
                    >
                        <i className={`fas ${micEnabled ? 'fa-microphone' : 'fa-microphone-slash'}`}></i>
                    </button>
                    <button
                        onClick={onToggleCam}
                        className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-base md:text-lg transition-all ${!camEnabled ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-white/10 text-white hover:bg-white/20'}`}
                    >
                        <i className={`fas ${camEnabled ? 'fa-video' : 'fa-video-slash'}`}></i>
                    </button>
                    <button
                        onClick={() => setChatOpen(!chatOpen)}
                        className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-base md:text-lg transition-all ${!chatOpen ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                    >
                        <i className={`fas ${chatOpen ? 'fa-comment' : 'fa-comment-slash'}`}></i>
                    </button>
                </div>

                <div className="hidden md:block h-8 w-[1px] bg-white/10"></div>

                <button
                    onClick={onSkip}
                    className="flex-1 md:flex-none h-12 md:px-8 rounded-full bg-primary hover:bg-primary-hover text-black font-black text-xs md:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,252,0,0.3)] hover:scale-105 active:scale-95 transition-all mx-2"
                >
                    SKIP <i className="fas fa-forward"></i>
                </button>

                <button
                    onClick={onStop}
                    className="w-12 h-12 rounded-full bg-white/10 border border-white/10 text-white hover:bg-red-500 hover:border-red-500 flex items-center justify-center text-lg transition-all shrink-0"
                >
                    <i className="fas fa-times"></i>
                </button>
            </div>
        </div>
    );
}
