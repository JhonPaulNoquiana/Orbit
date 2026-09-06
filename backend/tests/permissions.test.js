import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLE_RANK } from '../src/middleware/permissions.js';
import { requireFields, HttpError } from '../src/utils/http.js';

test('roles follow the intended permission hierarchy', () => {
  assert.ok(ROLE_RANK.owner > ROLE_RANK.admin);
  assert.ok(ROLE_RANK.admin > ROLE_RANK.member);
  assert.ok(ROLE_RANK.member > ROLE_RANK.guest);
});

test('required fields reject missing and blank values', () => {
  assert.throws(() => requireFields({ email: '   ' }, ['email']), (error) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.status, 400);
    return true;
  });
  assert.doesNotThrow(() => requireFields({ email: 'person@example.com' }, ['email']));
});
