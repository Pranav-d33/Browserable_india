module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Allow simple messages like "Lint errors" by disabling type enforcement
    'type-enum': [0],
    'type-empty': [0],
    // Allow any subject casing or even single-word subjects
    'subject-case': [0],
    'subject-empty': [0],
    'subject-full-stop': [0],
    // Keep a sane header length limit
    'header-max-length': [2, 'always', 72],
  },
};
