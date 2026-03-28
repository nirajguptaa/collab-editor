const { transform, applyOp, transformAgainstHistory } = require('../src/services/ot.service');

describe('Operational Transformation', () => {

  // ── applyOp ────────────────────────────────────────────────────────────────
  describe('applyOp', () => {
    test('insert at start', () => {
      expect(applyOp('hello', { type: 'insert', position: 0, chars: 'say ' }))
        .toBe('say hello');
    });

    test('insert in middle', () => {
      expect(applyOp('helo', { type: 'insert', position: 3, chars: 'l' }))
        .toBe('hello');
    });

    test('insert at end', () => {
      expect(applyOp('hello', { type: 'insert', position: 5, chars: ' world' }))
        .toBe('hello world');
    });

    test('delete single char', () => {
      expect(applyOp('hello', { type: 'delete', position: 2, length: 1 }))
        .toBe('helo');
    });

    test('delete range', () => {
      expect(applyOp('hello world', { type: 'delete', position: 5, length: 6 }))
        .toBe('hello');
    });
  });

  // ── transform: insert vs insert ─────────────────────────────────────────────
  describe('transform — insert vs insert', () => {
    test('op2 inserts BEFORE op1: op1 position shifts right', () => {
      const op1 = { type: 'insert', position: 5, chars: 'X', userId: 'b' };
      const op2 = { type: 'insert', position: 2, chars: 'AB', userId: 'a' };
      const t   = transform(op1, op2);
      expect(t.position).toBe(7); // shifted by 2 chars
    });

    test('op2 inserts AFTER op1: op1 position unchanged', () => {
      const op1 = { type: 'insert', position: 2, chars: 'X', userId: 'b' };
      const op2 = { type: 'insert', position: 5, chars: 'AB', userId: 'a' };
      const t   = transform(op1, op2);
      expect(t.position).toBe(2);
    });

    test('same position: lower userId wins (deterministic tiebreak)', () => {
      const op1 = { type: 'insert', position: 3, chars: 'X', userId: 'z' };
      const op2 = { type: 'insert', position: 3, chars: 'Y', userId: 'a' };
      const t   = transform(op1, op2);
      // op2.userId ('a') < op1.userId ('z'), so op1 shifts right
      expect(t.position).toBe(4);
    });

    test('convergence: both users insert at same doc, result is identical', () => {
      const doc = 'hello';
      const opA = { type: 'insert', position: 2, chars: 'X', userId: 'alice' };
      const opB = { type: 'insert', position: 2, chars: 'Y', userId: 'bob'   };

      // Server applies opA first, transforms opB against opA
      const opB_t = transform(opB, opA);
      const docAfterA    = applyOp(doc, opA);
      const docAfterAB   = applyOp(docAfterA, opB_t);

      // Client B applied opB first, then receives transformed opA
      const opA_t = transform(opA, opB);
      const docAfterB    = applyOp(doc, opB);
      const docAfterBA   = applyOp(docAfterB, opA_t);

      expect(docAfterAB).toBe(docAfterBA); // convergence!
    });
  });

  // ── transform: delete vs insert ─────────────────────────────────────────────
  describe('transform — delete vs insert', () => {
    test('op2 inserts before delete: delete position shifts right', () => {
      const op1 = { type: 'delete', position: 5, length: 3, userId: 'b' };
      const op2 = { type: 'insert', position: 2, chars: 'AB', userId: 'a' };
      const t   = transform(op1, op2);
      expect(t.position).toBe(7);
    });
  });

  // ── transform: delete vs delete ─────────────────────────────────────────────
  describe('transform — delete vs delete', () => {
    test('op2 deletes before op1: op1 position shrinks', () => {
      const op1 = { type: 'delete', position: 8, length: 2, userId: 'b' };
      const op2 = { type: 'delete', position: 3, length: 4, userId: 'a' };
      const t   = transform(op1, op2);
      expect(t.position).toBe(4);
    });

    test('overlapping deletes: op1 length shrinks correctly', () => {
      // doc: "abcdefghi"
      // op1: delete positions 2-6 (length 5) → "abghi"
      // op2: delete positions 4-6 (length 3) → "abcdhi"
      const op1 = { type: 'delete', position: 2, length: 5, userId: 'b' };
      const op2 = { type: 'delete', position: 4, length: 3, userId: 'a' };
      const t   = transform(op1, op2);
      // op2 deleted 3 chars inside op1's range, so op1 shrinks by 2 (overlap)
      expect(t.length).toBeLessThan(op1.length);
    });
  });

  // ── transformAgainstHistory ─────────────────────────────────────────────────
  describe('transformAgainstHistory', () => {
    test('transforms against multiple historical ops in order', () => {
      const doc = 'abc';
      // Two ops already applied at server
      const history = [
        { type: 'insert', position: 0, chars: 'X', userId: 'a' },  // "Xabc"
        { type: 'insert', position: 0, chars: 'Y', userId: 'b' },  // "YXabc"
      ];
      // Incoming op wants to insert at position 1 (based on "abc")
      const incoming = { type: 'insert', position: 1, chars: 'Z', userId: 'c' };
      const transformed = transformAgainstHistory(incoming, history);

      // After 2 prepended chars, position should be shifted by 2
      expect(transformed.position).toBe(3);
    });
  });
});
