// lib/utils.ts

/**
 * Formats a Date object into a "time ago" string or a full date string.
 * @param date The Date object to format.
 * @returns A formatted string (e.g., "5 minutes ago", "1 day ago", "May 25, 2025").
 */
export function formatTimeAgo(date: Date): string {
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) {
        return "Seconds ago";
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    }

    const days = Math.floor(hours / 24);
    if (days < 30) {
        return `${days} day${days === 1 ? '' : 's'} ago`;
    }

    // More than 30 days, show full date
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}