import importlib.util
from types import SimpleNamespace
import unittest

from tools.screen_qr import attendance_code, new_attendance_links

LINK = "https://mlearning.sjtu.edu.cn/lms/mobile2/forscan/?courseCode=Test123&fromType=scanRollCall"


class ScreenQRTests(unittest.TestCase):
    def test_only_recognizes_school_attendance_links(self):
        self.assertEqual(attendance_code(LINK), "Test123")
        for invalid in (
            LINK.replace("https:", "http:"),
            LINK.replace("sjtu.edu.cn", "sjtu.edu.cn.example.org"),
            LINK.replace("mlearning.", "example.org@mlearning."),
            LINK.replace("scanRollCall", "other"),
            LINK + "&courseCode=Other",
            LINK + "\n",
        ):
            with self.subTest(invalid=invalid):
                self.assertIsNone(attendance_code(invalid))

    def test_deduplication_uses_last_visible_time(self):
        code = SimpleNamespace(text=LINK)
        seen = {}
        self.assertEqual(new_attendance_links([code, code], seen, 10), [LINK])
        self.assertEqual(new_attendance_links([code], seen, 19), [])
        self.assertEqual(new_attendance_links([], seen, 20), [])
        self.assertEqual(new_attendance_links([code], seen, 29), [LINK])

    @unittest.skipUnless(
        importlib.util.find_spec("PIL") and importlib.util.find_spec("zxingcpp"),
        "requires optional screen QR dependencies",
    )
    def test_decodes_generated_qr_in_full_hd_frame(self):
        from PIL import Image
        import zxingcpp

        qr_format = zxingcpp.BarcodeFormat.QRCode
        pixels = memoryview(zxingcpp.write_barcode(qr_format, LINK, width=250, height=250))
        height, width = pixels.shape
        with Image.frombytes("L", (width, height), pixels.tobytes()) as qr:
            with Image.new("RGB", (1920, 1080), "#e3e5ea") as frame:
                frame.paste(qr, (1250, 470))
                results = zxingcpp.read_barcodes(frame, formats=qr_format)
        self.assertEqual(new_attendance_links(results, {}, 0), [LINK])
