// app/admin/dashboard/page.tsx (UPDATED)
// This file can now be a Server Component.
import DashboardContent from './DashboardContent'; // Import the new Client Component

export default function AdminDashboardPage() {
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
            maxWidth: '900px',
            width: '100%',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            textAlign: 'center',
        },
    };

    return (
        <div style={styles.container}>
            <main style={styles.main}>
                <DashboardContent /> {/* Render the Client Component */}
            </main>
        </div>
    );
}