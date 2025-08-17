import { describe, it, expect } from 'vitest';
import {
  RunId,
  NodeId,
  UserId,
  TaskId,
  BrowserActionId,
  SessionId,
  RequestId,
  Role,
  Permission,
  Status,
  RunStatus,
  NodeType,
  UserRole,
  TaskStatus,
  TaskPriority,
  BrowserActionType,
  BrowserActionStatus,
} from '../types.js';
import { HttpStatus, ErrorType } from '../errors.js';

describe('Common Types', () => {
  describe('Identifier Types', () => {
    it('should define identifier types as string aliases', () => {
      // TypeScript type aliases don't exist at runtime, so we can't test them directly
      // But we can verify the module exports are working by checking other exports
      expect(Role).toBeDefined();
      expect(Permission).toBeDefined();
      expect(Status).toBeDefined();
      expect(RunStatus).toBeDefined();
      expect(NodeType).toBeDefined();
      expect(UserRole).toBeDefined();
      expect(TaskStatus).toBeDefined();
      expect(TaskPriority).toBeDefined();
      expect(BrowserActionType).toBeDefined();
      expect(BrowserActionStatus).toBeDefined();
    });
  });

  describe('Role Enum', () => {
    it('should have correct role values', () => {
      expect(Role.ADMIN).toBe('admin');
      expect(Role.USER).toBe('user');
      expect(Role.VIEWER).toBe('viewer');
      expect(Role.SYSTEM).toBe('system');
    });

    it('should have all expected roles', () => {
      const roles = Object.values(Role);
      expect(roles).toContain('admin');
      expect(roles).toContain('user');
      expect(roles).toContain('viewer');
      expect(roles).toContain('system');
      expect(roles).toHaveLength(4);
    });
  });

  describe('Permission Enum', () => {
    it('should have correct permission values', () => {
      expect(Permission.READ).toBe('read');
      expect(Permission.WRITE).toBe('write');
      expect(Permission.DELETE).toBe('delete');
      expect(Permission.EXECUTE).toBe('execute');
      expect(Permission.MANAGE).toBe('manage');
    });

    it('should have all expected permissions', () => {
      const permissions = Object.values(Permission);
      expect(permissions).toContain('read');
      expect(permissions).toContain('write');
      expect(permissions).toContain('delete');
      expect(permissions).toContain('execute');
      expect(permissions).toContain('manage');
      expect(permissions).toHaveLength(5);
    });
  });

  describe('Status Enums', () => {
    it('should have correct Status values', () => {
      expect(Status.ACTIVE).toBe('active');
      expect(Status.INACTIVE).toBe('inactive');
      expect(Status.PENDING).toBe('pending');
      expect(Status.SUSPENDED).toBe('suspended');
      expect(Status.DELETED).toBe('deleted');
    });

    it('should have correct RunStatus values', () => {
      expect(RunStatus.PENDING).toBe('pending');
      expect(RunStatus.RUNNING).toBe('running');
      expect(RunStatus.COMPLETED).toBe('completed');
      expect(RunStatus.FAILED).toBe('failed');
      expect(RunStatus.CANCELLED).toBe('cancelled');
      expect(RunStatus.TIMEOUT).toBe('timeout');
    });
  });

  describe('NodeType Enum', () => {
    it('should have correct node type values', () => {
      expect(NodeType.START).toBe('start');
      expect(NodeType.END).toBe('end');
      expect(NodeType.TASK).toBe('task');
      expect(NodeType.CONDITION).toBe('condition');
      expect(NodeType.PARALLEL).toBe('parallel');
      expect(NodeType.SEQUENCE).toBe('sequence');
      expect(NodeType.API_CALL).toBe('api_call');
      expect(NodeType.BROWSER_ACTION).toBe('browser_action');
      expect(NodeType.AI_TASK).toBe('ai_task');
    });

    it('should have all expected node types', () => {
      const nodeTypes = Object.values(NodeType);
      expect(nodeTypes).toContain('start');
      expect(nodeTypes).toContain('end');
      expect(nodeTypes).toContain('task');
      expect(nodeTypes).toContain('condition');
      expect(nodeTypes).toContain('parallel');
      expect(nodeTypes).toContain('sequence');
      expect(nodeTypes).toContain('api_call');
      expect(nodeTypes).toContain('browser_action');
      expect(nodeTypes).toContain('ai_task');
      expect(nodeTypes).toHaveLength(9);
    });
  });

  describe('UserRole Enum', () => {
    it('should have correct user role values', () => {
      expect(UserRole.ADMIN).toBe('admin');
      expect(UserRole.USER).toBe('user');
      expect(UserRole.VIEWER).toBe('viewer');
    });

    it('should have all expected user roles', () => {
      const userRoles = Object.values(UserRole);
      expect(userRoles).toContain('admin');
      expect(userRoles).toContain('user');
      expect(userRoles).toContain('viewer');
      expect(userRoles).toHaveLength(3);
    });
  });

  describe('TaskStatus Enum', () => {
    it('should have correct task status values', () => {
      expect(TaskStatus.TODO).toBe('todo');
      expect(TaskStatus.IN_PROGRESS).toBe('in_progress');
      expect(TaskStatus.REVIEW).toBe('review');
      expect(TaskStatus.DONE).toBe('done');
      expect(TaskStatus.CANCELLED).toBe('cancelled');
    });

    it('should have all expected task statuses', () => {
      const taskStatuses = Object.values(TaskStatus);
      expect(taskStatuses).toContain('todo');
      expect(taskStatuses).toContain('in_progress');
      expect(taskStatuses).toContain('review');
      expect(taskStatuses).toContain('done');
      expect(taskStatuses).toContain('cancelled');
      expect(taskStatuses).toHaveLength(5);
    });
  });

  describe('TaskPriority Enum', () => {
    it('should have correct task priority values', () => {
      expect(TaskPriority.LOW).toBe('low');
      expect(TaskPriority.MEDIUM).toBe('medium');
      expect(TaskPriority.HIGH).toBe('high');
      expect(TaskPriority.URGENT).toBe('urgent');
    });

    it('should have all expected task priorities', () => {
      const taskPriorities = Object.values(TaskPriority);
      expect(taskPriorities).toContain('low');
      expect(taskPriorities).toContain('medium');
      expect(taskPriorities).toContain('high');
      expect(taskPriorities).toContain('urgent');
      expect(taskPriorities).toHaveLength(4);
    });
  });

  describe('BrowserActionType Enum', () => {
    it('should have correct browser action type values', () => {
      expect(BrowserActionType.NAVIGATE).toBe('navigate');
      expect(BrowserActionType.CLICK).toBe('click');
      expect(BrowserActionType.TYPE).toBe('type');
      expect(BrowserActionType.SCREENSHOT).toBe('screenshot');
      expect(BrowserActionType.EXTRACT).toBe('extract');
      expect(BrowserActionType.WAIT).toBe('wait');
    });

    it('should have all expected browser action types', () => {
      const browserActionTypes = Object.values(BrowserActionType);
      expect(browserActionTypes).toContain('navigate');
      expect(browserActionTypes).toContain('click');
      expect(browserActionTypes).toContain('type');
      expect(browserActionTypes).toContain('screenshot');
      expect(browserActionTypes).toContain('extract');
      expect(browserActionTypes).toContain('wait');
      expect(browserActionTypes).toHaveLength(6);
    });
  });

  describe('BrowserActionStatus Enum', () => {
    it('should have correct browser action status values', () => {
      expect(BrowserActionStatus.PENDING).toBe('pending');
      expect(BrowserActionStatus.RUNNING).toBe('running');
      expect(BrowserActionStatus.COMPLETED).toBe('completed');
      expect(BrowserActionStatus.FAILED).toBe('failed');
    });

    it('should have all expected browser action statuses', () => {
      const browserActionStatuses = Object.values(BrowserActionStatus);
      expect(browserActionStatuses).toContain('pending');
      expect(browserActionStatuses).toContain('running');
      expect(browserActionStatuses).toContain('completed');
      expect(browserActionStatuses).toContain('failed');
      expect(browserActionStatuses).toHaveLength(4);
    });
  });

  describe('HttpStatus Enum', () => {
    it('should have correct HTTP status codes', () => {
      expect(HttpStatus.OK).toBe(200);
      expect(HttpStatus.CREATED).toBe(201);
      expect(HttpStatus.NO_CONTENT).toBe(204);
      expect(HttpStatus.BAD_REQUEST).toBe(400);
      expect(HttpStatus.UNAUTHORIZED).toBe(401);
      expect(HttpStatus.FORBIDDEN).toBe(403);
      expect(HttpStatus.NOT_FOUND).toBe(404);
      expect(HttpStatus.CONFLICT).toBe(409);
      expect(HttpStatus.UNPROCESSABLE_ENTITY).toBe(422);
      expect(HttpStatus.TOO_MANY_REQUESTS).toBe(429);
      expect(HttpStatus.INTERNAL_SERVER_ERROR).toBe(500);
      expect(HttpStatus.BAD_GATEWAY).toBe(502);
      expect(HttpStatus.SERVICE_UNAVAILABLE).toBe(503);
    });
  });

  describe('ErrorType Enum', () => {
    it('should have correct error type values', () => {
      expect(ErrorType.VALIDATION).toBe('VALIDATION');
      expect(ErrorType.AUTHENTICATION).toBe('AUTHENTICATION');
      expect(ErrorType.AUTHORIZATION).toBe('AUTHORIZATION');
      expect(ErrorType.NOT_FOUND).toBe('NOT_FOUND');
      expect(ErrorType.CONFLICT).toBe('CONFLICT');
      expect(ErrorType.RATE_LIMIT).toBe('RATE_LIMIT');
      expect(ErrorType.EXTERNAL_SERVICE).toBe('EXTERNAL_SERVICE');
      expect(ErrorType.INTERNAL).toBe('INTERNAL');
    });

    it('should have all expected error types', () => {
      const errorTypes = Object.values(ErrorType);
      expect(errorTypes).toContain('VALIDATION');
      expect(errorTypes).toContain('AUTHENTICATION');
      expect(errorTypes).toContain('AUTHORIZATION');
      expect(errorTypes).toContain('NOT_FOUND');
      expect(errorTypes).toContain('CONFLICT');
      expect(errorTypes).toContain('RATE_LIMIT');
      expect(errorTypes).toContain('EXTERNAL_SERVICE');
      expect(errorTypes).toContain('INTERNAL');
      expect(errorTypes).toHaveLength(8);
    });
  });
});
