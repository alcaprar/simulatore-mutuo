import type { MortgageInput } from '../types.js';

export interface ShareData {
  mortgages?: Array<{
    nome: string;
    input: MortgageInput;
  }>;
  virtualMortgages?: Array<{
    nome: string;
    sourceIds: string[];
  }>;
}

export class URLShareService {
  /**
   * Encode mortgage data to URL-safe base64 string
   */
  static encode(data: ShareData): string {
    const json = JSON.stringify(data);
    return btoa(encodeURIComponent(json));
  }

  /**
   * Decode URL parameter to ShareData
   */
  static decode(param: string): ShareData | null {
    try {
      const json = decodeURIComponent(atob(param));
      return JSON.parse(json);
    } catch (e) {
      console.error('Failed to decode share data:', e);
      return null;
    }
  }

  /**
   * Generate shareable URL for current page with data
   */
  static generateShareURL(data: ShareData): string {
    const encoded = this.encode(data);
    const baseURL = window.location.origin + window.location.pathname;
    return `${baseURL}?share=${encoded}`;
  }
}
