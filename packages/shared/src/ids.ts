import { ulid } from 'ulid';

// Type definitions for different ID types
export type RunId = string & { readonly __brand: 'RunId' };
export type NodeId = string & { readonly __brand: 'NodeId' };
export type UserId = string & { readonly __brand: 'UserId' };

// Generic ID type
export type Id<T> = string & { readonly __brand: T };

// ULID pattern for validation
const ULID_PATTERN = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

/**
 * Creates a new ULID-based ID
 */
export function newId(): string {
  return ulid();
}

/**
 * Creates a new typed ID
 */
export function newTypedId<T>(): Id<T> {
  return ulid() as Id<T>;
}

/**
 * Creates a new RunId
 */
export function newRunId(): RunId {
  return ulid() as RunId;
}

/**
 * Creates a new NodeId
 */
export function newNodeId(): NodeId {
  return ulid() as NodeId;
}

/**
 * Creates a new UserId
 */
export function newUserId(): UserId {
  return ulid() as UserId;
}

/**
 * Validates if a string is a valid ULID
 */
export function isId(value: unknown): value is string {
  return typeof value === 'string' && ULID_PATTERN.test(value);
}

/**
 * Validates if a string is a valid typed ID
 */
export function isTypedId<T>(value: unknown): value is Id<T> {
  return isId(value);
}

/**
 * Validates if a string is a valid RunId
 */
export function isRunId(value: unknown): value is RunId {
  return isId(value);
}

/**
 * Validates if a string is a valid NodeId
 */
export function isNodeId(value: unknown): value is NodeId {
  return isId(value);
}

/**
 * Validates if a string is a valid UserId
 */
export function isUserId(value: unknown): value is UserId {
  return isId(value);
}

/**
 * Safely converts a string to a typed ID if valid
 */
export function toTypedId<T>(value: string): Id<T> | null {
  return isId(value) ? (value as Id<T>) : null;
}

/**
 * Safely converts a string to a RunId if valid
 */
export function toRunId(value: string): RunId | null {
  return isRunId(value) ? value : null;
}

/**
 * Safely converts a string to a NodeId if valid
 */
export function toNodeId(value: string): NodeId | null {
  return isNodeId(value) ? value : null;
}

/**
 * Safely converts a string to a UserId if valid
 */
export function toUserId(value: string): UserId | null {
  return isUserId(value) ? value : null;
}
