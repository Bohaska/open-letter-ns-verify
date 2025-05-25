// lib/nsRateLimiter.ts

// NationStates Standard API Rate Limit: 50 requests per 30 seconds
// This means one request every 30/50 = 0.6 seconds (600ms).
// We'll set a slightly more conservative default to be safe.
const DEFAULT_MIN_DELAY_MS = 700; // 0.7 seconds per request

let lastRequestTime = 0; // Timestamp of the last successful request
let nextAvailableTime = 0; // Earliest time the next request can be made
let retryAfterMs = 0; // Value from NS API's Retry-After header

const requestQueue: (() => void)[] = []; // Queue for pending requests

/**
 * Executes a function after ensuring the NationStates API rate limit is respected.
 * If the rate limit is hit, it will queue the request and retry later based on Retry-After header.
 * @param apiCall A function that returns a Promise (e.g., your fetch call).
 * @returns A Promise that resolves with the result of apiCall.
 */
export async function throttledNsFetch<T>(
    apiCall: () => Promise<T>,
    urlForLogging: string // For better logging
): Promise<T> {
    return new Promise((resolve, reject) => {
        const enqueue = () => {
            requestQueue.push(async () => {
                const now = Date.now();
                const requiredDelay = retryAfterMs > 0 ? retryAfterMs : DEFAULT_MIN_DELAY_MS;
                const timeToWait = Math.max(0, nextAvailableTime - now, requiredDelay - (now - lastRequestTime));

                if (timeToWait > 0) {
                    console.log(`NS API Throttler: Waiting for ${timeToWait}ms before next call to ${urlForLogging.split('?')[0]}.`);
                }

                setTimeout(async () => {
                    try {
                        const result = await apiCall();
                        lastRequestTime = Date.now();
                        // Reset retryAfterMs if the call was successful
                        retryAfterMs = 0;
                        // Update nextAvailableTime for the next request in the queue
                        nextAvailableTime = lastRequestTime + requiredDelay;
                        resolve(result);
                    } catch (error: any) {
                        // Check for 429 status from error, or from a structured response
                        const responseStatus = error?.response?.status; // If you wrap fetch and get the response object
                        const retryHeader = error?.response?.headers?.get('Retry-After'); // If you can access headers from error

                        if (responseStatus === 429 && retryHeader) {
                            const parsedRetryAfter = parseInt(retryHeader, 10) * 1000; // NS API gives seconds
                            retryAfterMs = parsedRetryAfter > 0 ? parsedRetryAfter : DEFAULT_MIN_DELAY_MS * 5; // Fallback if header is weird
                            console.warn(`NS API Rate Limit hit! Retrying ${urlForLogging.split('?')[0]} after ${retryAfterMs}ms.`);
                            // Re-enqueue the request to be retried after the new delay
                            enqueue(); // Re-add self to queue
                        } else {
                            reject(error); // Reject for other errors
                        }
                    } finally {
                        // Process the next item in the queue
                        if (requestQueue.length > 0) {
                            const nextRequest = requestQueue.shift();
                            if (nextRequest) nextRequest();
                        }
                    }
                }, timeToWait);
            });
        };

        // If the queue is empty, start processing immediately
        // Otherwise, it will be picked up by the finally block of the previous request
        if (requestQueue.length === 0) {
            enqueue();
            const firstRequest = requestQueue.shift();
            if (firstRequest) firstRequest();
        } else {
            enqueue(); // Just add to queue if already processing
        }
    });
}

// Function to reset the throttler state (useful for testing or if you need to clear state)
export function resetNsThrottler() {
    lastRequestTime = 0;
    nextAvailableTime = 0;
    retryAfterMs = 0;
    // Clear the queue, but be careful as this will discard pending requests
    requestQueue.length = 0; // Clears the array
    console.log("NS API Throttler reset.");
}

// Helper to make fetch errors more informative with response
export class FetchError extends Error {
    response: Response;
    constructor(message: string, response: Response) {
        super(message);
        this.name = "FetchError";
        this.response = response;
    }
}