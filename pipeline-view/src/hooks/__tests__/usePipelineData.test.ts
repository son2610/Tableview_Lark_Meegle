import { describe, expect, it } from 'vitest';
import { restoreKeys } from '../usePipelineData';

describe('restoreKeys (undo of a failed optimistic write)', () => {
  const S0 = { id: 's0', text: 'Not started' };
  const S1 = { id: 's1', text: 'Doing' };
  const S2 = { id: 's2', text: 'Done' };

  it('puts back the previous value of cells that still hold the written value', () => {
    const written = { status: S1, note: 'x' };
    const current = { status: S1, note: 'x', other: 1 };
    expect(restoreKeys(current, { status: S0, other: 1 }, ['status', 'note'], written)).toEqual({ status: S0, other: 1 });
  });

  it('keeps a newer value that replaced the write meanwhile (remote change or a later local write)', () => {
    const written = { status: S1 };
    expect(restoreKeys({ status: S2 }, { status: S0 }, ['status'], written)).toEqual({ status: S2 });
    // A deep-equal copy fetched from the host is a different value object: the host has it, keep it.
    expect(restoreKeys({ status: { ...S1 } }, { status: S0 }, ['status'], written)).toEqual({ status: S1 });
  });
});
