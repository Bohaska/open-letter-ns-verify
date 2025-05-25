// app/page.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState, useCallback } from 'react'; // Import useCallback

interface Signature {
    id: number;
    nationName: string;
    signedAt: string; // This is the ISO string from the DB
    flagUrl?: string;
    region?: string;
}

// IMPORTANT: Replace this with the actual embed URL you get from Google Docs
const GOOGLE_DOC_EMBED_URL = 'https://docs.google.com/document/d/e/2PACX-1vQ-QkQswHsv3OGbX21qYsQ49t1VbLcHiPRzZA_CWvODPCDwmkP8XHEqvt2Tq2NlXhsD_UTjlYN9tf1X/pub?embedded=true'; // Your actual URL

// Import the time formatting utility
import { formatTimeAgo } from '../lib/utils';

export default function Home() {
    const [signatures, setSignatures] = useState<Signature[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(Date.now()); // State to trigger re-renders for time updates

    // Function to fetch signatures, wrapped in useCallback for efficiency
    const fetchSignatures = useCallback(async () => {
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
    }, []); // Empty dependency array means this function is created once

    useEffect(() => {
        fetchSignatures(); // Initial fetch

        // Set up interval for refreshing the "time ago" string
        const intervalId = setInterval(() => {
            setCurrentTime(Date.now()); // Update state to trigger re-render of time strings
        }, 10 * 1000); // Update every 10 seconds

        return () => clearInterval(intervalId); // Cleanup interval on component unmount
    }, [fetchSignatures]); // Re-run effect if fetchSignatures changes (though it won't with useCallback)

    const styles: { [key: string]: React.CSSProperties } = {
        container: {
            minHeight: '100vh',
            padding: '0 0.5rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#EAEAE2',
            color: 'black',
        },
        main: {
            padding: '16px',
            maxWidth: '800px',
            width: '100%',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '3px 3px 12px #999',
            textAlign: 'center',
            margin: '20px 0',
        },
        title: {
            marginBottom: '1.5rem',
        },
        letterContentEmbed: {
            width: '100%',
            height: '600px',
            marginBottom: '2rem',
            border: '1px solid #CCC',
            borderRadius: '8px',
            overflow: 'hidden',
            backgroundColor: '#F9F9F9',
        },
        iframe: {
            width: '100%',
            height: '100%',
            border: 'none',
        },
        signButton: {
            display: 'inline-block',
            padding: '0.5em 2.5em',
            backgroundColor: '#EAEAE2',
            color: '#000000',
            textDecoration: 'none',
            borderRadius: '0.2em',
            fontSize: '1.1rem',
            fontWeight: 'bold',
            boxShadow: '1px 1px 2px rgba(0,0,0,0.1)',
            cursor: 'pointer',
            transition: 'background-color 0.3s ease',
            marginBottom: '2rem',
        },
        signaturesHeader: {
            marginBottom: '1rem',
        },
        signatureList: {
            listStyleType: 'none',
            textAlign: 'left',
            backgroundColor: '#F9F9F9',
            border: '1px solid #DDD',
            borderRadius: '8px',
            padding: '0.5em',
            marginRight: '10%',
            marginLeft: 'auto',
            maxWidth: 'calc(100% - 20%)',
        },
        signatureItem: {
            padding: '8px 0',
            borderBottom: '1px dashed #DDD',
            display: 'flex',
            alignItems: 'center',
            fontSize: '10pt',
            color: 'black',
        },
        flagImageWrapper: {
            height: '24px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            overflow: 'hidden',
            marginRight: '10px',
            border: '1px solid #999',
            filter: 'drop-shadow(0 0 1.2px #999)',
            flexShrink: 0,
        },
        flagImage: {
            height: '100%',
            width: 'auto',
            objectFit: 'contain',
        },
        errorText: {
            color: '#FF3333',
            fontWeight: 'bold',
            border: 'solid 2px #CC6666',
            borderRadius: '12px',
            padding: '1em',
            margin: '0.5em auto',
            maxWidth: '75%',
            backgroundColor: 'white',
        },
        // Style for the time element
        signedAtTime: {
            fontSize: '90%', // Smaller font size for timestamp
            color: '#666', // Greyed out color
            marginLeft: 'auto', // Push it to the right
            whiteSpace: 'nowrap', // Prevent wrapping
        }
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
                                            width={100}
                                            height={24}
                                            style={styles.flagImage}
                                            unoptimized={true}
                                        />
                                    </div>
                                )}
                                <span style={{flexGrow: 1, textAlign: 'left'}}>
                                    <b>{signature.nationName}</b> ({signature.region || 'Unknown'})
                </span>
                                {/* Use the <time> element as requested */}
                                <time dateTime={signature.signedAt} style={styles.signedAtTime}>
                                    {formatTimeAgo(new Date(signature.signedAt))}
                                </time>
                            </li>
                        ))}
                    </ul>
                )}
            </main>
        </div>
    );
}