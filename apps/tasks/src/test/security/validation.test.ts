import { describe, it, expect } from 'vitest';
import { 
  createTaskSchema, 
  inputSchema, 
  agentSchema, 
  metaSchema,
  sanitizeOutput,
  validateAndSanitizeRequest 
} from '../../schemas/validation.js';

describe('Security Validation', () => {
  describe('createTaskSchema', () => {
    it('should accept valid task creation request', () => {
      const validRequest = {
        agent: 'echo',
        input: 'Hello, world!',
        meta: { source: 'test', priority: 'high' },
      };

      const result = createTaskSchema.parse(validRequest);
      expect(result).toEqual(validRequest);
    });

    it('should reject unknown fields', () => {
      const invalidRequest = {
        agent: 'echo',
        input: 'Hello, world!',
        unknownField: 'should be rejected',
      };

      expect(() => createTaskSchema.parse(invalidRequest)).toThrow();
    });

    it('should reject invalid agent', () => {
      const invalidRequest = {
        agent: 'invalid-agent',
        input: 'Hello, world!',
      };

      expect(() => createTaskSchema.parse(invalidRequest)).toThrow();
    });

    it('should use default agent when not provided', () => {
      const request = {
        input: 'Hello, world!',
      };

      const result = createTaskSchema.parse(request);
      expect(result.agent).toBe('echo');
    });
  });

  describe('inputSchema', () => {
    it('should accept valid input', () => {
      const validInput = 'Hello, world!';
      const result = inputSchema.parse(validInput);
      expect(result).toBe(validInput);
    });

    it('should reject empty input', () => {
      expect(() => inputSchema.parse('')).toThrow('Input is required');
    });

    it('should reject input that is too long', () => {
      const longInput = 'A'.repeat(10001);
      expect(() => inputSchema.parse(longInput)).toThrow('Input too long');
    });

    it('should reject XSS attempts', () => {
      const xssAttempts = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(\'xss\')">',
        '<iframe src="javascript:alert(\'xss\')"></iframe>',
        '<object data="javascript:alert(\'xss\')"></object>',
        '<embed src="javascript:alert(\'xss\')">',
        '<form action="javascript:alert(\'xss\')"></form>',
        '<input onfocus="alert(\'xss\')">',
        '<textarea onblur="alert(\'xss\')"></textarea>',
        '<select onchange="alert(\'xss\')"></select>',
        '<button onclick="alert(\'xss\')"></button>',
        '<link rel="stylesheet" href="javascript:alert(\'xss\')">',
        '<meta http-equiv="refresh" content="0;url=javascript:alert(\'xss\')">',
        '<style>body{background:url(javascript:alert(\'xss\'))}</style>',
        '<base href="javascript:alert(\'xss\')">',
        '<title><script>alert("xss")</script></title>',
        '<head><script>alert("xss")</script></head>',
        '<body onload="alert(\'xss\')"></body>',
        '<html><script>alert("xss")</script></html>',
        '<xml><script>alert("xss")</script></xml>',
        '<svg><script>alert("xss")</script></svg>',
        '<math><script>alert("xss")</script></math>',
        '<applet code="javascript:alert(\'xss\')"></applet>',
        '<bgsound src="javascript:alert(\'xss\')">',
        '<xmp><script>alert("xss")</script></xmp>',
        '<plaintext><script>alert("xss")</script></plaintext>',
        '<listing><script>alert("xss")</script></listing>',
        '<marquee onstart="alert(\'xss\')"></marquee>',
        '<nobr><script>alert("xss")</script></nobr>',
        '<noembed><script>alert("xss")</script></noembed>',
        '<noframes><script>alert("xss")</script></noframes>',
        '<noscript><script>alert("xss")</script></noscript>',
        '<wbr><script>alert("xss")</script></wbr>',
      ];

      xssAttempts.forEach(attempt => {
        expect(() => inputSchema.parse(attempt)).toThrow('Input contains potentially dangerous content');
      });
    });

    it('should accept safe HTML-like content', () => {
      const safeContent = [
        'Hello <world>',
        'This is a test with > and < symbols',
        'Normal text with quotes " and \'',
        'Text with slashes / and \\',
      ];

      safeContent.forEach(content => {
        expect(() => inputSchema.parse(content)).not.toThrow();
      });
    });
  });

  describe('agentSchema', () => {
    it('should accept valid agents', () => {
      const validAgents = ['echo', 'browser', 'llm'];
      
      validAgents.forEach(agent => {
        const result = agentSchema.parse(agent);
        expect(result).toBe(agent);
      });
    });

    it('should reject invalid agents', () => {
      const invalidAgents = ['invalid', 'hacker', 'malicious'];
      
      invalidAgents.forEach(agent => {
        expect(() => agentSchema.parse(agent)).toThrow();
      });
    });

    it('should use default when not provided', () => {
      const result = agentSchema.parse(undefined);
      expect(result).toBe('echo');
    });
  });

  describe('metaSchema', () => {
    it('should accept valid metadata', () => {
      const validMeta = {
        source: 'api',
        priority: 'high',
        tags: ['test', 'demo'],
        userId: 'user123',
        sessionId: 'session456',
        requestId: 'req789',
        timestamp: '2024-01-01T00:00:00.000Z',
      };

      const result = metaSchema.parse(validMeta);
      expect(result).toEqual(validMeta);
    });

    it('should reject unknown fields', () => {
      const invalidMeta = {
        source: 'api',
        unknownField: 'should be rejected',
      };

      expect(() => metaSchema.parse(invalidMeta)).toThrow();
    });

    it('should accept empty object', () => {
      const result = metaSchema.parse({});
      expect(result).toEqual({});
    });

    it('should use default when not provided', () => {
      const result = metaSchema.parse(undefined);
      expect(result).toEqual({});
    });
  });

  describe('sanitizeOutput', () => {
    it('should sanitize HTML entities in strings', () => {
      const input = '<script>alert("xss")</script>';
      const expected = '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;';
      
      const result = sanitizeOutput(input);
      expect(result).toBe(expected);
    });

    it('should redact sensitive fields', () => {
      const input = {
        username: 'john',
        password: 'secret123',
        token: 'abc123',
        apiKey: 'xyz789',
        authorization: 'Bearer token',
        normalField: 'value',
      };

      const result = sanitizeOutput(input) as Record<string, unknown>;
      
      expect(result.username).toBe('john');
      expect(result.password).toBe('[REDACTED]');
      expect(result.token).toBe('[REDACTED]');
      expect(result.apiKey).toBe('[REDACTED]');
      expect(result.authorization).toBe('[REDACTED]');
      expect(result.normalField).toBe('value');
    });

    it('should handle arrays', () => {
      const input = ['<script>', 'normal', 'javascript:alert()'];
      const expected = ['&lt;script&gt;', 'normal', 'javascript:alert()'];
      
      const result = sanitizeOutput(input);
      expect(result).toEqual(expected);
    });

    it('should handle nested objects', () => {
      const input = {
        user: {
          name: 'John',
          password: 'secret',
          data: {
            token: 'abc123',
            info: 'normal info',
          },
        },
      };

      const result = sanitizeOutput(input) as Record<string, unknown>;
      
      expect(result.user).toEqual({
        name: 'John',
        password: '[REDACTED]',
        data: {
          token: '[REDACTED]',
          info: 'normal info',
        },
      });
    });

    it('should handle non-string values', () => {
      const input = {
        number: 123,
        boolean: true,
        null: null,
        undefined: undefined,
      };

      const result = sanitizeOutput(input);
      expect(result).toEqual(input);
    });
  });

  describe('validateAndSanitizeRequest', () => {
    it('should validate and sanitize request data', () => {
      const input = {
        agent: 'echo',
        input: '<script>alert("xss")</script>',
        meta: { source: 'test' },
      };

      const result = validateAndSanitizeRequest(createTaskSchema, input);
      
      expect(result.agent).toBe('echo');
      expect(result.input).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(result.meta).toEqual({ source: 'test' });
    });

    it('should throw on invalid data', () => {
      const invalidInput = {
        agent: 'invalid',
        input: 'test',
      };

      expect(() => validateAndSanitizeRequest(createTaskSchema, invalidInput)).toThrow();
    });
  });
});
