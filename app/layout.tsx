// app/layout.tsx
import './globals.css';
import { initializeDatabase } from '../lib/db'; // Import the initialization function

export const metadata = {
    title: 'Regarding Separatist Peoples',
    description: 'An open letter to NationStates.',
};

export default async function RootLayout({ // Make RootLayout async
                                             children,
                                         }: {
    children: React.ReactNode;
}) {
    // Ensure database tables exist on server startup/request
    await initializeDatabase(); // Initialize the database

    return (
        <html lang="en">
        <body>{children}</body>
        </html>
    );
}