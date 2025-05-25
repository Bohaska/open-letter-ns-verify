// app/sign/page.tsx
'use client';

import { useState } from 'react';
import { generateNSToken } from '../../lib/nsApi';
import { useRouter } from 'next/navigation'; // Import useRouter

export default function SignLetter() {
    const [nationName, setNationName] = useState('');
    const [checksum, setChecksum] = useState('');
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter(); // Initialize useRouter

    // The verification URL depends on nationName, so it must be generated client-side
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
                // Redirect to main page after a short delay
                setTimeout(() => {
                    router.push('/');
                }, 2000); // Redirect after 2 seconds
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
            maxWidth: '600px',
            width: '100%',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '3px 3px 12px #999',
            textAlign: 'center',
            margin: '20px 0',
        },
        title: {
            // fontSize: '2rem', /* Global H1 applies */
            marginBottom: '1.5rem',
            // color: '#2c3e50',
        },
        instructions: {
            fontSize: '10pt', /* Base font size */
            marginBottom: '1rem',
            textAlign: 'left',
            lineHeight: '1.5em',
        },
        instructionList: {
            listStyleType: 'decimal',
            textAlign: 'left',
            paddingLeft: '20px',
            marginBottom: '2rem',
            lineHeight: '1.5',
            fontSize: '10pt',
        },
        link: {
            color: 'green', // Default link color from global
            wordBreak: 'break-all',
        },
        form: {
            display: 'flex',
            flexDirection: 'column',
            gap: '15px',
            marginTop: '1rem',
        },
        formGroup: {
            textAlign: 'left',
        },
        label: {
            display: 'block',
            marginBottom: '5px',
            fontWeight: 'bold',
            fontSize: '10pt', /* Base font size */
        },
        input: {
            width: '100%',
            // Styles are mostly global now, just ensure it takes full width
        },
        button: { /* NS button style */
            padding: '0.5em 2.5em',
            backgroundColor: '#EAEAE2',
            color: '#000000',
            border: '1px solid #DADAD2',
            borderRadius: '0.2em',
            fontSize: '1.1rem',
            fontWeight: 'bold',
            boxShadow: '1px 1px 2px rgba(0,0,0,0.1)',
            cursor: 'pointer',
            transition: 'background-color 0.3s ease',
            // No direct hover state for inline styles, rely on global CSS for now
        },
        errorMessage: {
            color: '#FF3333',
            marginTop: '1rem',
            fontWeight: 'bold',
            border: 'solid 2px #CC6666',
            borderRadius: '12px',
            padding: '1em',
            margin: '0.5em auto',
            maxWidth: '75%', /* Adjust based on original NS error margin */
            backgroundColor: 'white',
        },
        successMessage: {
            color: 'green',
            marginTop: '1rem',
            fontWeight: 'bold',
            border: 'solid 2px #696', /* NS info border */
            borderRadius: '12px',
            padding: '1em',
            margin: '0.5em auto',
            maxWidth: '75%',
            backgroundColor: '#F0FFF0', /* NS info background */
        },
    };

    return (
        <div style={styles.container}>
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