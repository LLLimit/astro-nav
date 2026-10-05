import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readdir } from "node:fs/promises";
import path from "node:path";

export class UploadError extends Error {}

export async function saveUpload(
  file: File,
  kind: "icons" | "logos" | "backgrounds",
) {
  if (file.size === 0) throw new UploadError("请选择非空图片文件");
  if (file.size > (kind === "backgrounds" ? 5_000_000 : 2_000_000)) throw new UploadError(`图片不能超过 ${kind === "backgrounds" ? 5 : 2} MB`);
  const bytes = Buffer.from(await file.arrayBuffer());
  const extension =
    file.type === "image/png" &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ? "png"
      : file.type === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216
        ? "jpg"
        : file.type === "image/webp" &&
            bytes.toString("ascii", 0, 4) === "RIFF" &&
            bytes.toString("ascii", 8, 12) === "WEBP"
          ? "webp"
          : ["", "application/octet-stream", "image/x-icon", "image/vnd.microsoft.icon"].includes(file.type) &&
              bytes.length >= 6 &&
              bytes[0] === 0 &&
              bytes[1] === 0 &&
              bytes[2] === 1 && bytes[3] === 0 && bytes.readUInt16LE(4) > 0
            ? "ico"
            : null;
  if (!extension) throw new UploadError("只支持 PNG、JPEG、WebP 或 ICO 图片");
  const sourceExtension = path.extname(file.name).toLowerCase();
  if (
    !(
      { png: [".png"], jpg: [".jpg", ".jpeg"], webp: [".webp"], ico: [".ico"] }[
        extension
      ] as string[]
    ).includes(sourceExtension)
  )
    throw new UploadError("文件扩展名与内容不一致");
  const directory = path.resolve(process.cwd(), "data", kind);
  await mkdir(directory, { recursive: true });
  if ((await readdir(directory)).length >= 5000)
    throw new UploadError("文件数量已达上限");
  const name = `${randomUUID()}.${extension}`;
  await writeFile(path.join(directory, name), bytes, { flag: "wx" });
  return `/media/${kind}/${name}`;
}
