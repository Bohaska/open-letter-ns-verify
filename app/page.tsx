// app/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Signature {
    id: number;
    nationName: string;
    signedAt: string;
    flagUrl?: string; // Optional, in case fetching fails
    region?: string;  // Optional, in case fetching fails
}

// IMPORTANT: Replace this with the actual embed URL you get from Google Docs
const GOOGLE_DOC_EMBED_URL = 'https://docs.google.com/document/d/e/2PACX-1vQ5p8p_eY6V4j0xZ2a5n0a8W0mYc6S_3Q7W7R2m_9cZ0jX1g2k0V5r2q4q8M0a9w0c1h2/pub?embedded=true'; // Example: Replace with your actual URL!


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

                <Link href="/sign" style={styles.signButton}>
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
                                    <img src={signature.flagUrl} alt={`${signature.nationName} flag`} style={styles.flagImage} />
                                )}
                                {signature.nationName} ({signature.region || 'Unknown'}) - Signed on {new Date(signature.signedAt).toLocaleDateString()}
                            </li>
                        ))}
                    </ul>
                )}
            </main>
        </div>
    );
}

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        minHeight: '100vh',
        padding: '0 0.5rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'Arial, sans-serif',
        backgroundColor: '#f0f2f5',
        color: '#333',
    },
    main: {
        padding: '2rem',
        maxWidth: '800px',
        width: '100%',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        textAlign: 'center',
    },
    title: {
        fontSize: '2.5rem',
        marginBottom: '1.5rem',
        color: '#2c3e50',
    },
    letterContentEmbed: {
        width: '100%',
        height: '600px', // Set a fixed height or use responsive techniques
        marginBottom: '2rem',
        border: '1px solid #ddd',
        borderRadius: '5px',
        overflow: 'hidden',
    },
    iframe: {
        width: '100%',
        height: '100%',
        border: 'none',
    },
    signButton: {
        display: 'inline-block',
        padding: '12px 25px',
        backgroundColor: '#3498db',
        color: 'white',
        textDecoration: 'none',
        borderRadius: '5px',
        fontSize: '1.1rem',
        fontWeight: 'bold',
        transition: 'background-color 0.3s ease',
        cursor: 'pointer',
        marginBottom: '2rem',
    },
    signaturesHeader: {
        fontSize: '1.8rem',
        marginBottom: '1rem',
        color: '#2c3e50',
    },
    signatureList: {
        listStyleType: 'none',
        padding: '0',
        textAlign: 'left',
    },
    signatureItem: {
        padding: '8px 0',
        borderBottom: '1px dashed #eee',
        display: 'flex', // For flag and text alignment
        alignItems: 'center',
    },
    flagImage: {
        width: '24px', // Adjust size as needed
        height: 'auto',
        marginRight: '10px',
        border: '1px solid #ccc', // Optional: for better visibility of flag borders
    },
    errorText: {
        color: 'red',
        fontWeight: 'bold',
    },
};