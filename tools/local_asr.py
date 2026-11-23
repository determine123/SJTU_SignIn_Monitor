"""Transcribe local audio with an already downloaded Qwen3-ASR model."""
import argparse
import json
from pathlib import Path
from time import perf_counter


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("audio", type=Path, nargs="+")
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--language", help="For example, Chinese. Default: detect automatically.")
    parser.add_argument("--device", choices=("auto", "cpu", "cuda"), default="auto")
    parser.add_argument("--keyword", action="append", default=[])
    args = parser.parse_args()
    for audio in args.audio:
        if not audio.is_file():
            parser.error(f"Audio file does not exist: {audio}")
    if not (args.model / "config.json").is_file():
        parser.error("--model must point to a downloaded Qwen3-ASR model directory")

    import torch
    from qwen_asr import Qwen3ASRModel

    device = args.device
    if device == "auto":
        device = "cuda" if torch.cuda.is_available() else "cpu"
    if device == "cuda" and not torch.cuda.is_available():
        parser.error("CUDA is unavailable in the installed PyTorch runtime")
    start = perf_counter()
    model = Qwen3ASRModel.from_pretrained(
        str(args.model.resolve()),
        local_files_only=True,
        device_map=device,
        dtype=torch.float16 if device == "cuda" else torch.float32,
        max_inference_batch_size=1,
        max_new_tokens=512,
    )
    load_seconds = perf_counter() - start
    for audio in args.audio:
        start = perf_counter()
        result, = model.transcribe(audio=str(audio.resolve()), language=args.language)
        print(json.dumps({
            "audio": audio.name,
            "device": device,
            "language": result.language,
            "text": result.text,
            "matched_keywords": [word for word in dict.fromkeys(args.keyword) if word and word in result.text],
            "model_load_seconds": round(load_seconds, 3),
            "inference_seconds": round(perf_counter() - start, 3),
        }, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
