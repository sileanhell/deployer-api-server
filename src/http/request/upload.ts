import { join } from "node:path";

export interface UploadedArchive {
  path: string;
  sha256: string;
  size: number;
}

/**
 * Сохраняет тело запроса в dir/upload.zip, считая sha256 на лету.
 * Пишет на диск по мере приёма — память не растёт с размером архива, лимита нет.
 */
export async function receiveArchive(req: Request, dir: string): Promise<UploadedArchive> {
  if (!req.body) throw new Error("пустое тело запроса");

  const path = join(dir, "upload.zip");
  const writer = Bun.file(path).writer();
  const hasher = new Bun.CryptoHasher("sha256");
  let size = 0;

  for await (const chunk of req.body) {
    size += chunk.byteLength;
    hasher.update(chunk);
    writer.write(chunk);
    await writer.flush();
  }
  await writer.end();

  return { path, sha256: hasher.digest("hex"), size };
}
