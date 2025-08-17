import { describe, it, expect } from 'vitest';
import {
  newId,
  newRunId,
  newNodeId,
  newUserId,
  isId,
  isRunId,
  isNodeId,
  isUserId,
  toRunId,
  toNodeId,
  toUserId,
  type RunId,
  type NodeId,
  type UserId,
} from '../src/ids';

describe('IDs Module', () => {
  describe('ID Generation', () => {
    it('should generate valid ULIDs', () => {
      const id1 = newId();
      const id2 = newId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(isId(id1)).toBe(true);
      expect(isId(id2)).toBe(true);
    });

    it('should generate typed IDs', () => {
      const runId = newRunId();
      const nodeId = newNodeId();
      const userId = newUserId();

      expect(runId).toBeDefined();
      expect(nodeId).toBeDefined();
      expect(userId).toBeDefined();

      expect(isRunId(runId)).toBe(true);
      expect(isNodeId(nodeId)).toBe(true);
      expect(isUserId(userId)).toBe(true);
    });
  });

  describe('ID Validation', () => {
    it('should validate correct ULIDs', () => {
      const validId = newId(); // Use a real ULID
      expect(isId(validId)).toBe(true);
    });

    it('should reject invalid ULIDs', () => {
      const invalidIds = [
        'invalid-id',
        '01H8Z9K2P3Q4R5S6T7U8V9W0', // too short
        '01H8Z9K2P3Q4R5S6T7U8V9W0XY', // too long
        '',
        null,
        undefined,
        123,
        {},
      ];

      invalidIds.forEach(id => {
        expect(isId(id)).toBe(false);
      });
    });

    it('should validate typed IDs correctly', () => {
      const validId = newId(); // Use a real ULID

      expect(isRunId(validId)).toBe(true);
      expect(isNodeId(validId)).toBe(true);
      expect(isUserId(validId)).toBe(true);
    });
  });

  describe('ID Conversion', () => {
    it('should convert valid strings to typed IDs', () => {
      const validId = newId(); // Use a real ULID

      const runId = toRunId(validId);
      const nodeId = toNodeId(validId);
      const userId = toUserId(validId);

      expect(runId).toBe(validId);
      expect(nodeId).toBe(validId);
      expect(userId).toBe(validId);
    });

    it('should return null for invalid strings', () => {
      const invalidId = 'invalid-id';

      expect(toRunId(invalidId)).toBeNull();
      expect(toNodeId(invalidId)).toBeNull();
      expect(toUserId(invalidId)).toBeNull();
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety for typed IDs', () => {
      const runId: RunId = newRunId();
      const nodeId: NodeId = newNodeId();
      const userId: UserId = newUserId();

      // These should compile without errors
      expect(typeof runId).toBe('string');
      expect(typeof nodeId).toBe('string');
      expect(typeof userId).toBe('string');
    });
  });
});
