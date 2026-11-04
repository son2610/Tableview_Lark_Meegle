import { describe, expect, it } from 'vitest';
import { createKeyedQueue, restoreKeys } from '../usePipelineData';

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

describe('createKeyedQueue (one check-and-add at a time per field)', () => {
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('runs tasks with the same key one after another, in call order', async () => {
    const queue = createKeyedQueue();
    const log: string[] = [];
    const task = (name: string) => async () => {
      log.push(`${name}:start`);
      await tick();
      await tick();
      log.push(`${name}:end`);
      return name;
    };
    const results = await Promise.all([queue('path', task('a')), queue('path', task('b'))]);
    expect(results).toEqual(['a', 'b']);
    expect(log).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
  });

  it('lets a task see what the previous one did (no duplicate option)', async () => {
    const queue = createKeyedQueue();
    const options: string[] = [];
    const ensure = (name: string) => async () => {
      const missing = !options.includes(name); // read
      await tick(); // host round trip
      if (missing) options.push(name); // add
    };
    await Promise.all([queue('path', ensure('Hủy')), queue('path', ensure('Hủy'))]);
    expect(options).toEqual(['Hủy']);
  });

  it('does not block other keys and keeps going after a failed task', async () => {
    const queue = createKeyedQueue();
    const log: string[] = [];
    const slow = queue('a', async () => {
      await tick();
      await tick();
      log.push('a');
    });
    await queue('b', async () => {
      log.push('b');
    });
    await slow;
    expect(log).toEqual(['b', 'a']);
    await expect(queue('a', async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await expect(queue('a', async () => 'after')).resolves.toBe('after');
  });
});
