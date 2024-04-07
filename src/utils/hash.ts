import crypto from 'node:crypto';

export const sha256 = (input: string) =>  crypto.createHash("sha256").update(input).digest("hex");