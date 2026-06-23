import { removeAllUserObjects } from '../../../supabase/functions/_shared/storageCleanup';

describe('storage cleanup', () => {
  it('paginates and removes more than 100 objects in bounded batches', async () => {
    const entries = Array.from({ length: 205 }, (_, index) => ({
      id: `id-${index}`,
      name: `file-${String(index).padStart(3, '0')}.json`,
    }));
    const removed: string[][] = [];
    const bucketClient = {
      list: jest.fn(async (_prefix: string, options: { limit: number; offset: number }) => ({
        data: entries.slice(options.offset, options.offset + options.limit),
        error: null,
      })),
      remove: jest.fn(async (paths: string[]) => {
        removed.push(paths);
        return { error: null };
      }),
    };
    const storage = { from: jest.fn(() => bucketClient) };

    await removeAllUserObjects(storage, 'bucket', 'user-id');

    expect(bucketClient.list).toHaveBeenCalledTimes(3);
    expect(removed.map((batch) => batch.length)).toEqual([100, 100, 5]);
    expect(removed.flat()).toHaveLength(205);
  });

  it('fails closed when listing storage fails', async () => {
    const failure = new Error('storage unavailable');
    const storage = {
      from: () => ({
        list: async () => ({ data: null, error: failure }),
        remove: async () => ({ error: null }),
      }),
    };
    await expect(removeAllUserObjects(storage, 'bucket', 'user-id')).rejects.toBe(failure);
  });
});
