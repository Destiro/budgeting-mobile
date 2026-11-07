/** Reads a file picked with expo-document-picker as text (browser). */
export async function readPickedText(asset: { uri: string; file?: Blob }): Promise<string> {
  if (asset.file) return asset.file.text();
  const res = await fetch(asset.uri);
  return res.text();
}
