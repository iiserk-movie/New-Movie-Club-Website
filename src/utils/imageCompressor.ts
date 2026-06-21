/**
 * Client-side utility to resize and compress user-uploaded image files 
 * into lightweight, low-memory Base64 jpeg strings.
 * This prevents browser iframe load crashes, layout thrash, and database limit overflows.
 */
export function compressAndResizeImage(
  file: File, 
  maxWidth = 400, 
  maxHeight = 600, 
  quality = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Compute new dimensions keeping original aspect ratio
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string); // Fallback to raw data url if context failed
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          
          // Export as compressed image/jpeg
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        } catch (err) {
          console.warn('[Image Compressor] Canvas export error:', err);
          resolve(e.target?.result as string); // Fallback
        }
      };
      
      img.onerror = (err) => {
        console.warn('[Image Compressor] Image loading failed:', err);
        resolve(e.target?.result as string); // Fallback
      };

      if (e.target?.result) {
        img.src = e.target.result as string;
      }
    };

    reader.onerror = (err) => {
      reject(err);
    };

    reader.readAsDataURL(file);
  });
}
