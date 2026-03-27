import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

export const uploadMedia = async (file: Blob | string, path: string): Promise<string> => {
  let blobToUpload: Blob;

  if (typeof file === 'string') {
    // If it's a base64 string, convert to Blob
    const response = await fetch(file);
    blobToUpload = await response.blob();
  } else {
    blobToUpload = file;
  }

  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blobToUpload);
  const downloadURL = await getDownloadURL(storageRef);
  return downloadURL;
};
