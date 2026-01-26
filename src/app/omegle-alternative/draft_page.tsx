import LandingPage from '@/components/LandingPage';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Omegle Alternative - Free Random Video Chat | Skipsee',
    description: 'Looking for an Omegle alternative? Skipsee offers free random video chat with strangers. No login required, just instant connections.',
    alternates: {
        canonical: 'https://skipsee.com/omegle-alternative',
    },
    openGraph: {
        title: 'Best Omegle Alternative 2026 - Skipsee',
        description: 'The safest and fastest Omegle alternative. Meet strangers via cam chat instantly.',
        url: 'https://skipsee.com/omegle-alternative',
    }
};

export default function OmegleAlternativePage() {
    const handleStart = (settings: any) => {
        // Redirect logic or same logic as home
        console.log("Start from Omegle Alt", settings);
        // In a real app we might pass this up or handle navigation
        // typically we just render the LandingPage which handles logic internally via Client Component
        // Wait, LandingPage takes an onStart prop. The HOME page passes logic to it.
        // We need to replicate that logic or import it.
        // Since this is a server component wrapper, we need to make sure LandingPage works.
        // Actually, the HOME page.tsx usually handles the "Game" state vs "Landing" state.
        // This is tricky without duplicating the Home page logic.
        // The safest way is to make THIS page.tsx just render the Home Page Logic but with different initial props?
        // No, Home Page `page.tsx` likely contains the state (VideoChat vs LandingPage).
        // Let's check `src/app/page.tsx` first to see how it uses LandingPage.
    };

    return (
        // Placeholder until I check page.tsx
        <div />
    );
}
