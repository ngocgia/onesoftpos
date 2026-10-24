package vn.pro.giavdn.onesoftpos;

/** Pure encoder so byte packing can be verified without Android hardware. */
final class EscPosRaster {
    static byte[] finish(boolean autoCut) {
        // ESC d 4: feed four lines. GS V 66 0: feed to cutter, then partial cut.
        // Send once, after all text, QR and footer; never between raster strips.
        return autoCut ? new byte[]{27, 100, 4, 29, 86, 66, 0} : new byte[]{27, 100, 4};
    }

    static byte[] encode(int[] pixels, int width, int height) {
        if (width <= 0 || width % 8 != 0 || height <= 0 || height > 65535 || pixels.length < width * height) throw new IllegalArgumentException("Invalid raster dimensions");
        int bytesPerRow = width / 8;
        byte[] data = new byte[8 + bytesPerRow * height];
        data[0] = 29; data[1] = 118; data[2] = 48; data[3] = 0;
        data[4] = (byte) bytesPerRow; data[5] = (byte) (bytesPerRow >> 8);
        data[6] = (byte) height; data[7] = (byte) (height >> 8);
        for (int y = 0; y < height; y++) for (int x = 0; x < width; x++) {
            int pixel = pixels[y * width + x];
            int luminance = (299 * ((pixel >> 16) & 255) + 587 * ((pixel >> 8) & 255) + 114 * (pixel & 255)) / 1000;
            if (luminance < 180) data[8 + y * bytesPerRow + x / 8] |= (byte) (128 >> (x % 8));
        }
        return data;
    }
}
