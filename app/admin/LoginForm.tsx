// app/admin/LoginForm.tsx
'use client'; // This directive is essential here, as this component uses client-side hooks.

import { useState } from 'react';
import { useRouter } from 'next/navigation'; // Correct import for App Router

export default function LoginForm() {
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const router = useRouter(); // useRouter is called here, within the client component.

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');

        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password }),
            });

            const data = await response.json();

            if (response.ok) {
                setMessage('Login successful! Redirecting...');
                // router.push is called in an event handler, which executes after client-side hydration.
                router.push('/admin/dashboard');
            } else {
                setMessage(data.error || 'Login failed.');
            }
        } catch (error) {
            console.error('Login error:', error);
            setMessage('Network error or server unavailable.');
        }
    };

    // Define styles relevant to the form here, or in a shared CSS module if you have one.
    const styles: { [key: string]: React.CSSProperties } = {
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
            padding: '10px 20px',
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            fontSize: '1rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'background-color 0.3s ease',
        },
        message: {
            marginTop: '1rem',
            color: '#333',
        },
    };

    return (
        <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.formGroup}>
                <label htmlFor="password" style={styles.label}>Password:</label>
                <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={styles.input}
                />
            </div>
            <button type="submit" style={styles.button}>Login</button>
            {message && <p style={styles.message}>{message}</p>}
        </form>
    );
}