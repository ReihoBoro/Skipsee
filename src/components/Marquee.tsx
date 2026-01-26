"use client";
import React from 'react';
import Image from 'next/image';

const mockProfiles = [
    { name: "Sarah", age: 23, flag: "🇺🇸", img: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400" },
    { name: "John", age: 26, flag: "🇬🇧", img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400" },
    { name: "Emma", age: 21, flag: "🇨🇦", img: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400" },
    { name: "Mike", age: 28, flag: "🇩🇪", img: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400" },
    { name: "Jess", age: 22, flag: "🇦🇺", img: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400" },
    { name: "David", age: 25, flag: "🇫🇷", img: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400" },
    { name: "Anna", age: 24, flag: "🇪🇸", img: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400" },
    { name: "Tom", age: 29, flag: "🇮🇹", img: "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=400" },
    { name: "Sofia", age: 20, flag: "🇧🇷", img: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=400" },
    { name: "Alex", age: 30, flag: "🇷🇺", img: "https://images.unsplash.com/photo-1463453091185-61582044d556?auto=format&fit=crop&w=400" },
    { name: "Maria", age: 27, flag: "🇲🇽", img: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=400" },
    { name: "Chris", age: 26, flag: "🇺🇸", img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400" },
];

export default function Marquee() {
    // Split profiles for columns
    const col1 = [...mockProfiles.slice(0, 4), ...mockProfiles.slice(0, 4)];
    const col2 = [...mockProfiles.slice(4, 8), ...mockProfiles.slice(4, 8)];
    const col3 = [...mockProfiles.slice(8, 12), ...mockProfiles.slice(8, 12)];

    return (
        <div className="w-full h-full relative flex justify-center gap-5 px-5 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_15%,black_85%,transparent)]">
            <MarqueeColumn profiles={col1} duration="40s" direction="up" />
            <MarqueeColumn profiles={col2} duration="35s" direction="down" />
            <MarqueeColumn profiles={col3} duration="45s" direction="up" className="hidden md:block" />
        </div>
    );
}

function MarqueeColumn({ profiles, duration, direction, className = "" }: { profiles: typeof mockProfiles, duration: string, direction: 'up' | 'down', className?: string }) {
    return (
        <div className={`flex-1 max-w-[220px] h-full relative ${className}`}>
            <div className={`flex flex-col gap-6 w-full pb-6 animate-${direction === 'up' ? 'scrollUp' : 'scrollDown'}`} style={{ animationDuration: duration }}>
                {profiles.map((p, i) => (
                    <div key={i} className="w-full aspect-[9/13] relative rounded-3xl overflow-hidden shadow-2xl bg-[#222] transition-transform duration-300 hover:scale-[1.03] hover:z-10 group">
                        <Image src={p.img} alt={p.name} fill className="object-cover brightness-90" />

                        {/* Status */}
                        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-semibold border border-white/10 z-10">
                            <span className="w-1.5 h-1.5 bg-[#00ff88] rounded-full animate-pulse relative">
                                <span className="absolute inset-0 bg-[#00ff88] rounded-full animate-ping opacity-60"></span>
                            </span>
                            Online
                        </div>

                        {/* Info */}
                        <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/95 via-black/50 to-transparent flex items-center gap-2.5 z-10">
                            <span className="text-2xl">{p.flag}</span>
                            <span className="text-base font-bold tracking-wide drop-shadow-md">{p.name}, {p.age}</span>
                        </div>
                    </div>
                ))}
            </div>
            {/* Inline Styles for Animation Keyframes since Tailwind arbitrary values for keyframes are tricky */}
            <style jsx global>{`
                @keyframes scrollUp {
                    0% { transform: translateY(0); }
                    100% { transform: translateY(-50%); }
                }
                @keyframes scrollDown {
                    0% { transform: translateY(-50%); }
                    100% { transform: translateY(0); }
                }
                .animate-scrollUp { animation: scrollUp linear infinite; }
                .animate-scrollDown { animation: scrollDown linear infinite; }
            `}</style>
        </div>
    );
}
