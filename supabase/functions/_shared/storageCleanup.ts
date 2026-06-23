type StorageEntry = { id?: string | null; name: string };
type BucketClient = {
  list: (
    prefix: string,
    options: { limit: number; offset: number; sortBy: { column: string; order: string } },
  ) => Promise<{ data: StorageEntry[] | null; error: unknown | null }>;
  remove: (paths: string[]) => Promise<{ error: unknown | null }>;
};
type StorageClient = { from: (bucket: string) => BucketClient };

export async function removeAllUserObjects(
  storage: StorageClient,
  bucket: string,
  userId: string,
) {
  const prefixes = [userId];
  const files: string[] = [];

  while (prefixes.length) {
    const prefix = prefixes.pop()!;
    let offset = 0;
    for (;;) {
      const { data, error } = await storage.from(bucket).list(prefix, {
        limit: 100,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) throw error;
      if (!data?.length) break;

      for (const item of data) {
        const path = `${prefix}/${item.name}`;
        if (item.id) files.push(path);
        else prefixes.push(path);
      }
      if (data.length < 100) break;
      offset += data.length;
    }
  }

  for (let index = 0; index < files.length; index += 100) {
    const { error } = await storage.from(bucket).remove(files.slice(index, index + 100));
    if (error) throw error;
  }
}
