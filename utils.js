export async function copyFile(pod, path, destDir) {
  const dest = `${destDir}/${path}`;
  const f = await pod.createFile(dest, "binary");
  const resp = await fetch(`/${path}`);
  if (!resp.ok)
    throw new Error(`copyFile: failed to fetch /${path} (${resp.status})`);
  await f.write(await resp.arrayBuffer());
  await f.close();
}
