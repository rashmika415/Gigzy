import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// Keep the encoded thumbnail well below Firestore's document size limit.
export const MAX_PROFILE_PHOTO_LENGTH = 100000;

export async function prepareProfilePhoto(uri: string): Promise<string> {
  for (const size of [256, 160]) {
    const context = ImageManipulator.manipulate(uri);
    let image;
    try {
      context.resize({ width: size });
      image = await context.renderAsync();
      const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.6, base64: true });
      if (!result.base64) throw new Error('Could not read this photo. Please choose another image.');
      const dataUri = `data:image/jpeg;base64,${result.base64}`;
      if (dataUri.length <= MAX_PROFILE_PHOTO_LENGTH) return dataUri;
    } finally {
      image?.release();
      context.release();
    }
  }
  throw new Error('This photo is too large. Please crop it smaller or choose another image.');
}
