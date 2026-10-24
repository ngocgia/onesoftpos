package vn.pro.giavdn.onesoftpos;

import java.util.Arrays;

public final class EscPosRasterTest {
    public static void main(String[] args) {
        if (!Arrays.equals(EscPosRaster.finish(true), new byte[]{27, 100, 4, 29, 86, 66, 0})) throw new AssertionError("Feed then cut command");
        if (!Arrays.equals(EscPosRaster.finish(false), new byte[]{27, 100, 4})) throw new AssertionError("Disabled cutter must only feed");
        int[] pixels = new int[384 * 64];
        Arrays.fill(pixels, 0xffffffff);
        pixels[0] = pixels[7] = pixels[8] = pixels[pixels.length - 1] = 0xff000000;
        byte[] data = EscPosRaster.encode(pixels, 384, 64);
        if (data.length != 3080 || data[0] != 29 || data[1] != 118 || data[2] != 48 || data[4] != 48 || data[6] != 64) throw new AssertionError("K58 header/length");
        if ((data[8] & 255) != 129 || (data[9] & 255) != 128 || data[data.length - 1] != 1) throw new AssertionError("Bit order/last pixel");
        pixels = new int[576 * 17]; Arrays.fill(pixels, 0xff000000);
        data = EscPosRaster.encode(pixels, 576, 17);
        if (data[4] != 72 || data[6] != 17 || data.length != 1232) throw new AssertionError("K80/final short strip");
        for (int i = 8; i < data.length; i++) if (data[i] != (byte) 255) throw new AssertionError("Black fill");
        boolean rejected = false;
        try { EscPosRaster.encode(new int[8], 7, 1); } catch (IllegalArgumentException expected) { rejected = true; }
        if (!rejected) throw new AssertionError("Invalid dimensions accepted");
        System.out.println("ESC/POS tests passed: K58, K80, bit order, final strip, invalid dimensions, cutter enabled/disabled");
    }
}
