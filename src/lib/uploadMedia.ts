import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { validateMediaFile } from './validation';

export const uploadMedia = async (file: Blob | string, path: string): Promise<string> => {
  let blobToUpload: Blob;

  if (typeof file === 'string') {
    // base64 data URL — convert to Blob
    const response = await fetch(file);
    blobToUpload = await response.blob();
  } else {
    blobToUpload = file;
  }

  // Validate file type and size for File objects (not raw Blobs from base64)
  if (blobToUpload instanceof File) {
    const check = validateMediaFile(blobToUpload);
    if (!check.valid) {
      throw new Error(check.error || 'Invalid file');
    }
  }

  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blobToUpload);
  const downloadURL = await getDownloadURL(storageRef);
  return downloadURL;
};
