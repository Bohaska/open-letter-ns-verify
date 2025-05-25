// app/page.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';

interface Signature {
    id: number;
    nationName: string;
    signedAt: string;
    flagUrl?: string;
    region?: string;
}

const GOOGLE_DOC_EMBED_URL = 'https://docs.google.com/document/d/e/2PACX-1vQ5p8p_eY6V4j0xZ2a5n0a8W0mYc6S_3Q7W7R2m_9cZ0jX1g2k0V5r2q4q8M0a9w0c1h2/pub?embedded=true'; // Your actual URL

export default function Home() {
    const [signatures, setSignatures] = useState<Signature[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchSignatures() {
            try {
                const response = await fetch('/api/signatures');
                if (!response.ok) {
                    throw new Error('Failed to fetch signatures');
                }
                const data: Signature[] = await response.json();
                setSignatures(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        fetchSignatures();
    }, []);

    const styles: { [key: string]: React.CSSProperties } = {
        container: {
            minHeight: '100vh',
            padding: '0 0.5rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#EAEAE2', /* NS main background */
            color: 'black', /* Ensure text is visible */
        },
        main: {
            padding: '16px', /* NS content padding */
            maxWidth: '800px',
            width: '100%',
            backgroundColor: 'white', /* NS content background */
            borderRadius: '8px', /* NS fieldset/table radius */
            boxShadow: '3px 3px 12px #999', /* NS shiny table shadow */
            textAlign: 'center',
            margin: '20px 0', /* Add some vertical margin */
        },
        title: { /* Overridden by global H1, but keep specific styles if needed */
            // fontSize: '2.5rem',
            marginBottom: '1.5rem',
            // color: '#2c3e50',
        },
        letterContentEmbed: {
            width: '100%',
            height: '600px',
            marginBottom: '2rem',
            border: '1px solid #CCC', /* NS border */
            borderRadius: '8px', /* NS fieldset radius */
            overflow: 'hidden',
            backgroundColor: '#F9F9F9', /* NS fieldset background */
        },
        iframe: {
            width: '100%',
            height: '100%',
            border: 'none',
        },
        signButton: { /* NS button style */
            display: 'inline-block',
            padding: '0.5em 2.5em', /* NS widebutton */
            backgroundColor: '#EAEAE2',
            color: '#000000',
            textDecoration: 'none',
            borderRadius: '0.2em', /* NS button radius */
            fontSize: '1.1rem',
            fontWeight: 'bold',
            boxShadow: '1px 1px 2px rgba(0,0,0,0.1)',
            cursor: 'pointer',
            transition: 'background-color 0.3s ease',
            marginBottom: '2rem',
            // No direct hover state for inline styles, rely on global CSS for now
        },
        signaturesHeader: {
            // fontSize: '1.8rem', /* Global H2 applies */
            marginBottom: '1rem',
            // color: '#2c3e50',
        },
        signatureList: {
            listStyleType: 'none',
            textAlign: 'left',
            backgroundColor: '#F9F9F9', /* Minorinfo background */
            border: '1px solid #DDD', /* Minorinfo border */
            borderRadius: '8px', /* Minorinfo radius */
            padding: '0.5em',
            marginRight: '10%', /* Minorinfo margin */
            marginLeft: 'auto', /* Center if possible */
            maxWidth: 'calc(100% - 20%)', /* Adjust based on margin */
        },
        signatureItem: {
            padding: '8px 0',
            borderBottom: '1px dashed #eee',
            display: 'flex',
            alignItems: 'center',
            fontSize: '10pt', /* Default body font size */
            color: 'black',
        },
        flagImageWrapper: {
            width: '30px',
            height: '20px',
            position: 'relative',
            marginRight: '10px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
            border: '1px solid #999', /* NS flag border */
            filter: 'drop-shadow(0 0 1.2px #999)', /* NS smallflag filter */
        },
        flagImage: {
            objectFit: 'contain',
            width: '100%',
            height: '100%',
        },
        errorText: {
            color: '#FF3333', /* NS error color */
            fontWeight: 'bold',
            border: 'solid 2px #CC6666', /* NS error border */
            borderRadius: '12px', /* NS error radius */
            padding: '1em',
            margin: '0.5em',
            marginRight: '25%', /* NS error margin */
            marginLeft: 'auto',
            backgroundColor: 'white', /* Default background, or specific error background if desired */
        },
    };

    return (
        <div style={styles.container}>
            <main style={styles.main}>
                <h1 style={styles.title}>Regarding Separatist Peoples</h1>

                <div style={styles.letterContentEmbed}>
                    <iframe
                        src={GOOGLE_DOC_EMBED_URL}
                        style={styles.iframe}
                        frameBorder="0"
                        allowFullScreen
                    ></iframe>
                </div>

                <Link href="/sign" passHref style={styles.signButton}>
                    Sign the Letter
                </Link>

                <h2 style={styles.signaturesHeader}>Signatures:</h2>
                {loading ? (
                    <p>Loading signatures...</p>
                ) : error ? (
                    <p style={styles.errorText}>Error: {error}</p>
                ) : signatures.length === 0 ? (
                    <p>No signatures yet. Be the first to sign!</p>
                ) : (
                    <ul style={styles.signatureList}>
                        {signatures.map((signature) => (
                            <li key={signature.id} style={styles.signatureItem}>
                                {signature.flagUrl && (
                                    <div style={styles.flagImageWrapper}>
                                        <Image
                                            src={signature.flagUrl}
                                            alt={`${signature.nationName} flag`}
                                            width={32}
                                            height={24}
                                            style={styles.flagImage}
                                            unoptimized={true}
                                        />
                                    </div>
                                )}
                                <span style={{flexGrow: 1, textAlign: 'left'}}>
                                    <b>{signature.nationName}</b> ({signature.region || 'Unknown'}) - Signed on {new Date(signature.signedAt).toLocaleDateString()}
                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </main>
        </div>
    );
}