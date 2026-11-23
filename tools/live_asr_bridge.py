"""Serve local Qwen audio recognition to one installed Edge extension."""
import argparse
from http.server import BaseHTTPRequestHandler, HTTPServer
from io import BytesIO
import json
from pathlib import Path
import re


KEYWORDS = re.compile(r"签到|簽到|点名|點名|\b(?:attendance|roll[ -]call|sign[ -]in|check[ -]in)\b", re.I)
MAX_AUDIO_BYTES = 1_000_000


def serve(model, allowed_origins):
    import av
    import numpy as np

    class Handler(BaseHTTPRequestHandler):
        def do_OPTIONS(self):
            origin = self.headers.get("Origin")
            if self.path != "/transcribe" or origin not in allowed_origins:
                self.send_error(403)
                return
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "POST")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-SJTU-Audio")
            self.end_headers()

        def do_POST(self):
            origin = self.headers.get("Origin")
            if (self.path != "/transcribe" or origin not in allowed_origins or
                    self.headers.get("X-SJTU-Audio") != "1"):
                self.send_error(403)
                return
            length = self.headers.get("Content-Length", "")
            if not length.isascii() or not length.isdigit() or len(length) > 7:
                self.send_error(400)
                return
            if not 0 < int(length) <= MAX_AUDIO_BYTES:
                self.send_error(413)
                return
            self.connection.settimeout(5)
            media_format = self.media_format()
            if media_format is None:
                self.send_error(415)
                return
            try:
                with av.open(BytesIO(self.rfile.read(int(length))), format=media_format) as audio:
                    resampler = av.AudioResampler(format="fltp", layout="mono", rate=16000)
                    samples = []
                    total = 0
                    for frame in audio.decode(audio=0):
                        for converted in resampler.resample(frame):
                            total += converted.samples
                            if total > 16000 * 12:
                                raise ValueError("Audio clip too long")
                            samples.append(converted.to_ndarray().reshape(-1))
                    samples.extend(frame.to_ndarray().reshape(-1) for frame in resampler.resample(None))
                pcm = np.concatenate(samples)
                result, = model.transcribe(audio=(pcm, 16000), language=None)
                keywords = list(dict.fromkeys(match.lower() for match in KEYWORDS.findall(result.text)))
                payload = json.dumps({"keywords": keywords, "language": result.language}).encode()
            except (ValueError, OSError, IndexError, av.FFmpegError):
                self.send_error(422, "Invalid audio clip")
                return
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            try:
                self.wfile.write(payload)
            except OSError:
                pass

        def media_format(self):
            formats = {"audio/webm": "webm", "audio/wav": "wav"}
            return formats.get(self.headers.get_content_type())

        def log_message(self, *args):
            pass

    with HTTPServer(("127.0.0.1", 18765), Handler) as server:
        print("Qwen ASR ready on 127.0.0.1:18765. Ctrl+C to stop.", flush=True)
        server.serve_forever()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--extension-id", required=True, action="append")
    args = parser.parse_args()
    if any(not re.fullmatch(r"[a-p]{32}", extension_id) for extension_id in args.extension_id):
        parser.error("invalid Edge extension ID")
    if not (args.model / "config.json").is_file():
        parser.error("model directory does not contain config.json")
    import torch
    from qwen_asr import Qwen3ASRModel

    cuda = torch.cuda.is_available()
    model = Qwen3ASRModel.from_pretrained(
        str(args.model.resolve()), local_files_only=True, device_map="cuda" if cuda else "cpu",
        dtype=torch.float16 if cuda else torch.float32, max_new_tokens=128, max_inference_batch_size=1,
    )
    try:
        serve(model, {"chrome-extension://" + extension_id for extension_id in args.extension_id})
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
