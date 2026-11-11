import { describe, it, expect } from 'vitest';
import { ticketState } from './TicketsPage';

describe('ticketState', () => {
  it('colours a ticket by how ready it is', () => {
    expect(ticketState(0, 0)).toBe('new');
    expect(ticketState(1, 30)).toBe('started');
    expect(ticketState(2, 55)).toBe('half');
    expect(ticketState(1, 71)).toBe('ready');
  });
});
