import { File } from 'expo-file-system';

/** Reads a file picked with expo-document-picker as text (phone). The web version is in files.web.ts. */
export async function readPickedText(asset: { uri: string }): Promise<string> {
  return new File(asset.uri).text();
}
