"""Scan visible Windows displays for SJTU attendance QR codes."""
import argparse
from pathlib import Path
import sys
from time import monotonic, sleep
from urllib.parse import parse_qs, urlsplit

INTERVAL = 1.0
REPEAT_AFTER = 10.0
HOST = "mlearning.sjtu.edu.cn"
SIGNIN_PATH = "/lms/mobile2/forscan"
ALERT_SOUND = Path(__file__).resolve().parents[1] / "edge-signin-monitor" / "alert.wav"


def attendance_code(text):
    if any(not character.isprintable() or character.isspace() for character in text):
        return None
    try:
        url = urlsplit(text)
        if url.scheme != "https" or url.netloc.lower() != HOST:
            return None
        if url.path not in (SIGNIN_PATH, SIGNIN_PATH + "/"):
            return None
        query = parse_qs(url.query, keep_blank_values=True, max_num_fields=32)
    except ValueError:
        return None
    codes = query.get("courseCode", [])
    if query.get("fromType") == ["scanRollCall"] and len(codes) == 1 and codes[0].isalnum():
        return codes[0]
    return None


def new_attendance_links(barcodes, seen, now):
    for code, last_seen in list(seen.items()):
        if now - last_seen >= REPEAT_AFTER:
            del seen[code]
    links = []
    for barcode in barcodes:
        code = attendance_code(barcode.text)
        if code is None:
            continue
        if code not in seen:
            links.append(barcode.text)
        seen[code] = now
    return links


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--show-url", action="store_true", help="Print the full decoded URL locally.")
    parser.add_argument("--test-sound", action="store_true", help="Play the alert and exit.")
    args = parser.parse_args()
    if sys.platform != "win32":
        parser.error("This screen watcher requires Windows.")

    import winsound

    if args.test_sound:
        winsound.PlaySound(str(ALERT_SOUND), winsound.SND_FILENAME | winsound.SND_NODEFAULT)
        return 0

    import zxingcpp
    from PIL import ImageGrab

    seen = {}
    capture_failed = False
    print("Watching all displays for SJTU attendance QR codes. Press Ctrl+C to stop.", flush=True)
    try:
        while True:
            started = monotonic()
            try:
                frame = ImageGrab.grab(all_screens=True)
            except OSError as error:
                if not capture_failed:
                    print(f"Screen capture unavailable; retrying: {error}", file=sys.stderr, flush=True)
                capture_failed = True
            else:
                capture_failed = False
                with frame:
                    barcodes = zxingcpp.read_barcodes(frame, formats=zxingcpp.BarcodeFormat.QRCode)
                links = new_attendance_links(barcodes, seen, monotonic())
                if links:
                    for url in links:
                        print("SJTU attendance QR detected. Confirm attendance on the school page.", flush=True)
                        if args.show_url:
                            print(url, flush=True)
                    try:
                        winsound.PlaySound(
                            str(ALERT_SOUND),
                            winsound.SND_FILENAME | winsound.SND_ASYNC | winsound.SND_NODEFAULT,
                        )
                    except RuntimeError as error:
                        print(f"Unable to play alert: {error}", file=sys.stderr, flush=True)
            sleep(max(0.0, INTERVAL - (monotonic() - started)))
    except KeyboardInterrupt:
        print("\nScreen watcher stopped.", flush=True)
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
