/** Tipagem mínima da biblioteca de Web Push (o pacote não publica .d.ts). */
declare module "webpush-webcrypto" {
  export class ApplicationServerKeys {
    constructor(publicKey: CryptoKey, privateKey: CryptoKey);
    static fromJSON(json: { publicKey: string; privateKey: string }): Promise<ApplicationServerKeys>;
  }

  export function generatePushHTTPRequest(opcoes: {
    applicationServerKeys: ApplicationServerKeys;
    payload: string;
    target: { endpoint: string; keys: { p256dh: string; auth: string } };
    adminContact: string;
    ttl?: number;
    urgency?: "very-low" | "low" | "normal" | "high";
  }): Promise<{ headers: Record<string, string>; body: ArrayBuffer; endpoint: string }>;
}
