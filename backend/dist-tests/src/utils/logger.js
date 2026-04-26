export const logger = {
    info(message, ...args) {
        console.log(`[info] ${message}`, ...args);
    },
    warn(message, ...args) {
        console.warn(`[warn] ${message}`, ...args);
    },
    error(message, ...args) {
        console.error(`[error] ${message}`, ...args);
    },
};
