import { Metadata } from 'next';
import SeoAppWrapper from '@/components/SeoAppWrapper';

export const metadata: Metadata = {
    title: 'Omegle Alternative - Free Random Video Chat | Skipsee',
    description: 'Looking for a safe Omegle alternative? Skipsee offers free random video chat with strangers. No login required, just instant connections.',
    alternates: {
        canonical: 'https://skipsee.com/omegle-alternative',
    },
    openGraph: {
        title: 'Best Omegle Alternative 2026 - Skipsee',
        description: 'The safest and fastest Omegle alternative. Meet strangers via cam chat instantly.',
        url: 'https://skipsee.com/omegle-alternative',
    },
    keywords: ['omegle alternative', 'random video chat', 'talk to strangers', 'free cam chat'],
};

export default function OmegleAlternativePage() {
    return (
        <SeoAppWrapper
            heroText={{
                line1: "BETTER.",
                line2: "THAN.",
                line3: "OMEGLE."
            }}
            subheadline="The #1 Free Omegle Alternative. Safe, fast, and no login required."
        />
    );
}
