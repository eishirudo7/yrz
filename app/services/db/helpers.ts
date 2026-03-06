/**
 * Database helpers — shared utilities for all DB operations
 */

// Fungsi helper untuk retry dengan exponential backoff
export async function withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await operation();
            if (attempt > 1) {
                console.log(`Berhasil setelah percobaan ke-${attempt}`);
            }
            return result;
        } catch (error) {
            lastError = error;
            if (attempt === maxRetries) {
                console.error(`Gagal setelah ${maxRetries} percobaan:`, error);
                break;
            }

            const nextDelay = delayMs * Math.pow(2, attempt - 1);
            console.log(`Percobaan ke-${attempt} gagal, mencoba lagi dalam ${nextDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, nextDelay));
        }
    }

    throw lastError;
}
