'use client';


// pages/page.tsx
import Head from 'next/head';
import { useState } from 'react';
import { generateNSToken } from '../../lib/nsApi'; // Import the token generator

export default function SignLetter() {
    const [nationName, setNationName] = useState('');
    const [checksum, setChecksum] = useState('');
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const verificationUrl = `https://www.nationstates.net/page=verify_login?token=${encodeURIComponent(generateNSToken(nationName))}`;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');
        setIsError(false);
        setIsLoading(true);

        if (!nationName || !checksum) {
            setMessage('Please enter both your nation name and the checksum code.');
            setIsError(true);
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetch('/api/sign', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ nationName, checksum }),
            });

            const data = await response.json();

            if (response.ok) {
                setMessage(data.message);
                setIsError(false);
                setNationName('');
                setChecksum('');
            } else {
                setMessage(data.error || 'An unexpected error occurred.');
                setIsError(true);
            }
        } catch (error) {
            console.error('Error signing letter:', error);
            setMessage('Network error or server unavailable.');
            setIsError(true);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <Head>
                <title>Sign the Open Letter</title>
            </Head>

            <main style={styles.main}>
                <h1 style={styles.title}>Sign the Open Letter</h1>

                <p style={styles.instructions}>
                    To sign the open letter, please verify your NationStates nation:
                </p>

                <ol style={styles.instructionList}>
                    <li>
                        Go to the NationStates verification page: <br />
                        <a href={verificationUrl} target="_blank" rel="noopener noreferrer" style={styles.link}>
                            {verificationUrl.length > 70 ? `${verificationUrl.substring(0, 67)}...` : verificationUrl}
                        </a>
                        <br />
                        (Make sure you are logged into NationStates as **{nationName || '[Your Nation Name]'}**.)
                    </li>
                    <li>
                        Copy the **checksum code** displayed on that page.
                    </li>
                    <li>
                        Enter your Nation name and the checksum code below.
                    </li>
                </ol>

                <form onSubmit={handleSubmit} style={styles.form}>
                    <div style={styles.formGroup}>
                        <label htmlFor="nationName" style={styles.label}>Your Nation Name:</label>
                        <input
                            type="text"
                            id="nationName"
                            value={nationName}
                            onChange={(e) => setNationName(e.target.value)}
                            required
                            style={styles.input}
                            placeholder="e.g., The United Island Tribes"
                        />
                    </div>

                    <div style={styles.formGroup}>
                        <label htmlFor="checksum" style={styles.label}>Checksum Code:</label>
                        <input
                            type="text"
                            id="checksum"
                            value={checksum}
                            onChange={(e) => setChecksum(e.target.value)}
                            required
                            style={styles.input}
                            placeholder="e.g., 1234567890abcdefg"
                        />
                    </div>

                    <button type="submit" disabled={isLoading} style={styles.button}>
                        {isLoading ? 'Verifying...' : 'Submit Signature'}
                    </button>
                </form>

                {message && (
                    <p style={isError ? styles.errorMessage : styles.successMessage}>
                        {message}
                    </p>
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
        maxWidth: '600px',
        width: '100%',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        textAlign: 'center',
    },
    title: {
        fontSize: '2rem',
        marginBottom: '1.5rem',
        color: '#2c3e50',
    },
    instructions: {
        fontSize: '1.1rem',
        marginBottom: '1rem',
        textAlign: 'left',
    },
    instructionList: {
        listStyleType: 'decimal',
        textAlign: 'left',
        paddingLeft: '20px',
        marginBottom: '2rem',
        lineHeight: '1.5',
    },
    link: {
        color: '#3498db',
        wordBreak: 'break-all',
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
    },
    formGroup: {
        textAlign: 'left',
    },
    label: {
        display: 'block',
        marginBottom: '5px',
        fontWeight: 'bold',
    },
    input: {
        width: '100%',
        padding: '10px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        fontSize: '1rem',
    },
    button: {
        padding: '12px 25px',
        backgroundColor: '#2ecc71',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        fontSize: '1.1rem',
        fontWeight: 'bold',
        cursor: 'pointer',
        transition: 'background-color 0.3s ease',
    },
    errorMessage: {
        color: 'red',
        marginTop: '1rem',
        fontWeight: 'bold',
    },
    successMessage: {
        color: 'green',
        marginTop: '1rem',
        fontWeight: 'bold',
    },
};