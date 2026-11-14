import { RequestStatus } from '@procureflow/shared';
import { describe, expect, it } from 'vitest';
import { AppError } from '../errors/app-error.js';
import {
  REQUEST_STATUS_TRANSITIONS,
  assertRequestStatusTransition,
  canTransitionRequestStatus,
  nextRequestStatuses,
} from '../services/request-state-machine.js';

describe('purchase request state machine', () => {
  it('defines the complete allowed transition graph', () => {
    expect(REQUEST_STATUS_TRANSITIONS).toEqual({
      [RequestStatus.Draft]: [RequestStatus.Submitted],
      [RequestStatus.Submitted]: [RequestStatus.PendingApproval],
      [RequestStatus.PendingApproval]: [
        RequestStatus.Approved,
        RequestStatus.Rejected,
        RequestStatus.ChangesRequested,
      ],
      [RequestStatus.ChangesRequested]: [RequestStatus.Draft, RequestStatus.Submitted],
      [RequestStatus.Approved]: [],
      [RequestStatus.Rejected]: [],
      [RequestStatus.Cancelled]: [],
    });
  });

  it.each([
    [RequestStatus.Draft, RequestStatus.Submitted],
    [RequestStatus.Submitted, RequestStatus.PendingApproval],
    [RequestStatus.PendingApproval, RequestStatus.Approved],
    [RequestStatus.PendingApproval, RequestStatus.Rejected],
    [RequestStatus.PendingApproval, RequestStatus.ChangesRequested],
    [RequestStatus.ChangesRequested, RequestStatus.Draft],
    [RequestStatus.ChangesRequested, RequestStatus.Submitted],
  ])('allows %s -> %s', (from, to) => {
    expect(canTransitionRequestStatus(from, to)).toBe(true);
    expect(() => assertRequestStatusTransition(from, to)).not.toThrow();
  });

  it.each([
    [RequestStatus.Draft, RequestStatus.Approved],
    [RequestStatus.Draft, RequestStatus.PendingApproval],
    [RequestStatus.Submitted, RequestStatus.Approved],
    [RequestStatus.PendingApproval, RequestStatus.Draft],
    [RequestStatus.Approved, RequestStatus.Submitted],
    [RequestStatus.Rejected, RequestStatus.Draft],
    [RequestStatus.Cancelled, RequestStatus.Draft],
  ])('rejects %s -> %s', (from, to) => {
    expect(canTransitionRequestStatus(from, to)).toBe(false);

    try {
      assertRequestStatusTransition(from, to);
      throw new Error('Expected the transition to be rejected.');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('INVALID_STATUS_TRANSITION');
      expect((error as AppError).statusCode).toBe(409);
    }
  });

  it('reports the next statuses for each state', () => {
    expect(nextRequestStatuses(RequestStatus.Draft)).toEqual([RequestStatus.Submitted]);
    expect(nextRequestStatuses(RequestStatus.Approved)).toEqual([]);
    expect(nextRequestStatuses(RequestStatus.Cancelled)).toEqual([]);
  });
});
