import { Metadata } from 'next';
import SeoAppWrapper from '@/components/SeoAppWrapper';

export const metadata: Metadata = {
    title: 'Azar Alternative - Free Video Chat - No Gems Needed | Skipsee',
    description: 'The best free Azar alternative without gems or subscriptions. Random video chat with people nearby or globally. Completely free.',
    alternates: {
        canonical: 'https://skipsee.com/azar-alternative',
    },
    openGraph: {
        title: 'Like Azar But Free - Skipsee Video Chat',
        description: 'Stop paying for gems. Skipsee is the free Azar alternative for instant video matches.',
        url: 'https://skipsee.com/azar-alternative',
    },
    keywords: ['azar alternative', 'azar like app', 'free video chat', 'no gems', 'random chat'],
};

export default function AzarAlternativePage() {
    return (
        <SeoAppWrapper
            heroText={{
                line1: "LIKE.",
                line2: "AZAR.",
                line3: "BUT FREE."
            }}
            subheadline="No gems. No subscriptions. Just unlimited free random video chat."
        />
    );
}
