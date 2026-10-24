package vn.pro.giavdn.onesoftpos;

public final class PrinterNetworkAddressTest {
    public static void main(String[] args) {
        if (!"192.168.1.27".equals(PrinterNetworkAddress.parse(" 192.168.1.27 "))) throw new AssertionError("Printer IP");
        if (!"192.168.1.27".equals(PrinterNetworkAddress.parse("192.168.001.027"))) throw new AssertionError("Canonical numeric address");
        for (String invalid : new String[]{null, "", "http://192.168.1.27", "192.168.1.27:9100", "192.168.1.999", "printer.local", "224.0.0.1", "0.0.0.0", "192.168.1.255"}) {
            boolean rejected = false;
            try { PrinterNetworkAddress.parse(invalid); } catch (IllegalArgumentException expected) { rejected = true; }
            if (!rejected) throw new AssertionError("Invalid address accepted: " + invalid);
        }
        System.out.println("LAN printer IPv4 validation passed");
    }
}
