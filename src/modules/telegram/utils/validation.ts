import * as crypto from 'crypto';

export function validateTelegramWebAppData(initData: string, botToken: string): boolean {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');

    if (!hash) return false;

    const dataCheckString = Array.from(urlParams.entries())
        .filter(([key]) => key !== 'hash')
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

    const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(botToken)
        .digest();

    const hmac = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

    return hmac === hash;
}

export function parseTelegramWebAppData(initData: string): any {
    const urlParams = new URLSearchParams(initData);
    const user = urlParams.get('user');
    return {
        user: user ? JSON.parse(user) : null,
        auth_date: urlParams.get('auth_date'),
        query_id: urlParams.get('query_id'),
        hash: urlParams.get('hash'),
    };
}
