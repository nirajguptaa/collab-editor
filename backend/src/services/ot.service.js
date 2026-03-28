/**
 * Operational Transformation Engine
 *
 * Core idea: when two users edit simultaneously, their ops are based on the
 * same document revision. The server must TRANSFORM one op against the other
 * before applying it so both clients converge to the same state.
 *
 * This is a simplified but interview-ready OT implementation.
 * For production, swap with the 'ot' npm package which handles full Unicode
 * and more complex composition rules.
 *
 * Interview talking point: "I implemented the transform() function which adjusts
 * the position of incoming operations based on concurrent operations that were
 * committed since the client's base revision. This guarantees convergence."
 */

/**
 * @typedef {{ type: 'insert'|'delete', position: number, chars?: string, length?: number, revision: number, userId: string }} Op
 */

/**
 * Transform op1 against op2 (op2 was applied first).
 * Returns a new op1 with adjusted position.
 *
 * @param {Op} op1  - the incoming operation to transform
 * @param {Op} op2  - the operation already applied to the document
 * @returns {Op}
 */
function transform(op1, op2) {
  const result = { ...op1 };

  if (op2.type === 'insert') {
    if (op1.type === 'insert') {
      // Both insertions: if op2 inserted before op1's position, shift op1 right
      if (op2.position < op1.position) {
        result.position += op2.chars.length;
      } else if (op2.position === op1.position && op2.userId < op1.userId) {
        // Tiebreak: deterministic ordering by userId so all servers agree
        result.position += op2.chars.length;
      }
    } else if (op1.type === 'delete') {
      if (op2.position <= op1.position) {
        result.position += op2.chars.length;
      }
    }
  } else if (op2.type === 'delete') {
    if (op1.type === 'insert') {
      if (op2.position < op1.position) {
        result.position = Math.max(op2.position, op1.position - op2.length);
      }
    } else if (op1.type === 'delete') {
      if (op2.position < op1.position) {
        result.position -= Math.min(op2.length, op1.position - op2.position);
      } else if (op2.position < op1.position + op1.length) {
        // op2 deleted inside op1's range — shrink op1's length
        result.length = Math.max(0, op1.length - (Math.min(op2.position + op2.length, op1.position + op1.length) - Math.max(op2.position, op1.position)));
      }
    }
  }

  return result;
}

/**
 * Apply op to document content string.
 * Returns the new content string.
 *
 * @param {string} doc
 * @param {Op} op
 * @returns {string}
 */
function applyOp(doc, op) {
  if (op.type === 'insert') {
    return doc.slice(0, op.position) + op.chars + doc.slice(op.position);
  }
  if (op.type === 'delete') {
    return doc.slice(0, op.position) + doc.slice(op.position + op.length);
  }
  return doc;
}

/**
 * Transform incoming op against a list of already-applied ops (op history
 * since the client's base revision). Returns the transformed op ready to apply.
 *
 * @param {Op} incomingOp
 * @param {Op[]} opsToTransformAgainst   - ops applied since client's base rev
 * @returns {Op}
 */
function transformAgainstHistory(incomingOp, opsToTransformAgainst) {
  let op = incomingOp;
  for (const historicOp of opsToTransformAgainst) {
    op = transform(op, historicOp);
  }
  return op;
}

module.exports = { transform, applyOp, transformAgainstHistory };
