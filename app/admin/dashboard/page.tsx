// app/admin/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Signature {
    id: number;
    nationName: string;
    checksum: string; // checksum is still stored in DB but less relevant for display
    signedAt: string;
    flagUrl?: string;
    region?: string;
}

export default function AdminDashboard() {
    const [signatures, setSignatures] = useState<Signature[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const fetchSignatures = async () => {
        try {
            const response = await fetch('/api/admin/signatures');
            if (response.status === 401) {
                router.push('/admin'); // Redirect to login if not authenticated
                return;
            }
            if (!response.ok) {
                throw new Error('Failed to fetch signatures for admin');
            }
            const data: Signature[] = await response.json();
            setSignatures(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSignatures();
    }, []);

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this signature?')) {
            return;
        }
        try {
            const response = await fetch('/api/admin/signatures', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to delete signature for ID: ${id}`);
            }

            // Refresh the list after action
            fetchSignatures();
        } catch (err: any) {
            console.error('Error deleting signature:', err);
            setError(err.message);
        }
    };


    const handleLogout = async () => {
        try {
            const response = await fetch('/api/admin/logout', { method: 'POST' });
            if (response.ok) {
                router.push('/admin');
            } else {
                alert('Failed to log out.');
            }
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    if (loading) {
        return (
            <div style={styles.container}>
                <p>Loading admin dashboard...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div style={styles.container}>
                <p style={styles.errorText}>Error: {error}</p>
                <button onClick={handleLogout} style={styles.logoutButton}>Logout</button>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <main style={styles.main}>
                <div style={styles.header}>
                    <h1 style={styles.title}>Admin Dashboard (All Signatures)</h1>
                    <button onClick={handleLogout} style={styles.logoutButton}>Logout</button>
                </div>

                <h2 style={styles.sectionTitle}>All Signatures ({signatures.length})</h2>
                {signatures.length === 0 ? (
                    <p>No signatures yet.</p>
                ) : (
                    <table style={styles.table}>
                        <thead>
                        <tr>
                            <th style={styles.th}>ID</th>
                            <th style={styles.th}>Flag</th>
                            <th style={styles.th}>Nation Name</th>
                            <th style={styles.th}>Region</th>
                            <th style={styles.th}>Signed At</th>
                            <th style={styles.th}>Actions</th> {/* For delete */}
                        </tr>
                        </thead>
                        <tbody>
                        {signatures.map((signature) => (
                            <tr key={signature.id}>
                                <td style={styles.td}>{signature.id}</td>
                                <td style={styles.td}>
                                    {signature.flagUrl && (
                                        <img src={signature.flagUrl} alt={`${signature.nationName} flag`} style={styles.flagImage} />
                                    )}
                                </td>
                                <td style={styles.td}>{signature.nationName}</td>
                                <td style={styles.td}>{signature.region || 'Unknown'}</td>
                                <td style={styles.td}>{new Date(signature.signedAt).toLocaleString()}</td>
                                <td style={styles.td}>
                                    <button onClick={() => handleDelete(signature.id)} style={styles.deleteButton}>Delete</button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
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
        maxWidth: '900px',
        width: '100%',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        textAlign: 'center',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
    },
    title: {
        fontSize: '2.5rem',
        color: '#2c3e50',
    },
    logoutButton: {
        padding: '8px 15px',
        backgroundColor: '#e74c3c',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        fontSize: '0.9rem',
    },
    sectionTitle: {
        fontSize: '1.8rem',
        marginTop: '2rem',
        marginBottom: '1rem',
        color: '#2c3e50',
        textAlign: 'left',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        marginBottom: '2rem',
    },
    th: {
        border: '1px solid #ddd',
        padding: '8px',
        backgroundColor: '#f2f2f2',
        textAlign: 'left',
    },
    td: {
        border: '1px solid #ddd',
        padding: '8px',
        textAlign: 'left',
        verticalAlign: 'middle', // Align flag and text
    },
    flagImage: {
        width: '24px',
        height: 'auto',
        marginRight: '5px',
        border: '1px solid #ccc',
    },
    deleteButton: {
        padding: '6px 10px',
        backgroundColor: '#e74c3c',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
    },
    errorText: {
        color: 'red',
        fontWeight: 'bold',
    },
};