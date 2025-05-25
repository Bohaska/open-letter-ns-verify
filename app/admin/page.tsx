// app/admin/page.tsx (UPDATED)
// This file can now be a Server Component, as it doesn't use client-side hooks directly.
import LoginForm from './LoginForm'; // Import the new Client Component

export default function AdminLogin() {
    // Styles related to the overall page layout remain here.
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
            maxWidth: '400px',
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
        // Form-specific styles are now in LoginForm.tsx
    };

    return (
        <div style={styles.container}>
            <main style={styles.main}>
                <h1 style={styles.title}>Admin Login</h1>
                <LoginForm /> {/* Render the Client Component */}
            </main>
        </div>
    );
}