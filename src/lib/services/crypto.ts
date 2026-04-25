import CryptoJS from 'crypto-js';
import { PUBLIC_STORAGE_ENCRYPTION_KEY } from '$env/static/public';

const STORAGE_KEY = 'jitori_config';
const ENCRYPTION_KEY = PUBLIC_STORAGE_ENCRYPTION_KEY || 'jitori-local-dev-fallback-key';

export function encryptData<T>(data: T): string {
	const jsonString = JSON.stringify(data);
	return CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();
}

export function decryptData<T>(encryptedData: string): T | null {
	try {
		const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
		const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
		if (!decryptedString) {
			console.error('[Storage] decrypted payload is empty');
			return null;
		}
		return JSON.parse(decryptedString) as T;
	} catch (error) {
		console.error('[Storage] failed to decrypt payload', { error });
		return null;
	}
}

export function saveToStorage<T>(data: T): void {
	if (typeof window === 'undefined') return;
	try {
		const encrypted = encryptData(data);
		localStorage.setItem(STORAGE_KEY, encrypted);
		console.info('[Storage] configuration saved');
	} catch (error) {
		console.error('[Storage] failed to save configuration', { error });
	}
}

export function loadFromStorage<T>(): T | null {
	if (typeof window === 'undefined') return null;
	try {
		const encrypted = localStorage.getItem(STORAGE_KEY);
		if (!encrypted) {
			console.info('[Storage] no saved configuration found');
			return null;
		}
		const loaded = decryptData<T>(encrypted);
		console.info('[Storage] configuration loaded', { valid: Boolean(loaded) });
		return loaded;
	} catch (error) {
		console.error('[Storage] failed to load configuration', { error });
		return null;
	}
}
