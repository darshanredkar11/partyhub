import { describe, expect, it } from 'vitest';
import { generateInvitationToken, hashInvitationToken, whatsappShareUrl } from './invitations';

describe('invitation utilities', () => {
  it('generates URL-safe 256-bit invitation tokens', () => {
    const first = generateInvitationToken();
    const second = generateInvitationToken();
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
  });

  it('hashes tokens to a 32-byte SHA-256 digest', async () => {
    const token = generateInvitationToken();
    const first = await hashInvitationToken(token);
    const second = await hashInvitationToken(token);
    expect(first).toHaveLength(32);
    expect(Array.from(first)).toEqual(Array.from(second));
  });

  it('creates a WhatsApp share URL with an encoded message', () => {
    const message = 'You are invited! RSVP: https://partyhub.example/invite/abc';
    const url = whatsappShareUrl(message);
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(url.split('text=')[1])).toBe(message);
  });
});
