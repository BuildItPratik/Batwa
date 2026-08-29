"""
Batwa — one-time generator for the pre-recorded audio assets (Ruchir).

Produces the static files under frontend/agent-portal/public/audio/ that the
frontend plays via HTML <audio>. Playback is pre-recorded
files only — no live text-to-speech at runtime. Re-run this script only if a
prompt's wording changes, then commit the regenerated files.

Requirements: pip install gTTS   (network needed), plus ffmpeg on PATH.
Usage:        python scripts/generate_audio.py [--language mr]
"""

import math
import os
import struct
import subprocess
import tempfile
import wave
import argparse

from gtts import gTTS

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO_DIR = os.path.join(ROOT, "frontend", "agent-portal", "public", "audio")

# The five product prompts, per language.
# Keys must match VOICE_PROMPT_KEYS in frontend/agent-portal/src/audio/sounds.ts.
PROMPTS = {
    "en": {
        "enter_amount": "Enter the amount.",
        "scan_card": "Scan your card.",
        "enter_pin": "Enter your PIN.",
        "payment_success": "Payment successful.",
        "payment_failed": "Payment failed. Please try again.",
    },
    "hi": {
        "enter_amount": "\u0930\u093e\u0936\u093f \u0926\u0930\u094d\u091c \u0915\u0930\u0947\u0902\u0964",
        "scan_card": "\u0905\u092a\u0928\u093e \u0915\u093e\u0930\u094d\u0921 \u0938\u094d\u0915\u0948\u0928 \u0915\u0930\u0947\u0902\u0964",
        "enter_pin": "\u0905\u092a\u0928\u093e \u092a\u093f\u0928 \u0926\u0930\u094d\u091c \u0915\u0930\u0947\u0902\u0964",
        "payment_success": "\u092d\u0941\u0917\u0924\u093e\u0928 \u0938\u092b\u0932 \u0939\u0941\u0906\u0964",
        "payment_failed": "\u092d\u0941\u0917\u0924\u093e\u0928 \u0935\u093f\u092b\u0932 \u0939\u0941\u0906\u0964 \u0915\u0943\u092a\u092f\u093e \u092b\u093f\u0930 \u0938\u0947 \u092a\u094d\u0930\u092f\u093e\u0938 \u0915\u0930\u0947\u0902\u0964",
    },
    "ta": {
        "enter_amount": "\u0ba4\u0bca\u0b95\u0bc8\u0baf\u0bc8 \u0b89\u0bb3\u0bcd\u0bb3\u0bbf\u0b9f\u0bc1\u0b99\u0bcd\u0b95\u0bb3\u0bcd.",
        "scan_card": "\u0b89\u0b99\u0bcd\u0b95\u0bb3\u0bcd \u0b85\u0b9f\u0bcd\u0b9f\u0bc8\u0baf\u0bc8 \u0bb8\u0bcd\u0b95\u0bc7\u0ba9\u0bcd \u0b9a\u0bc6\u0baf\u0bcd\u0baf\u0bc1\u0b99\u0bcd\u0b95\u0bb3\u0bcd.",
        "enter_pin": "\u0b89\u0b99\u0bcd\u0b95\u0bb3\u0bcd \u0baa\u0bbf\u0ba9\u0bcd \u0b8e\u0ba3\u0bcd\u0ba3\u0bc8 \u0b89\u0bb3\u0bcd\u0bb3\u0bbf\u0b9f\u0bc1\u0b99\u0bcd\u0b95\u0bb3\u0bcd.",
        "payment_success": "\u0baa\u0ba3\u0bae\u0bcd \u0b9a\u0bc6\u0bb2\u0bc1\u0ba4\u0bcd\u0ba4\u0bc1\u0ba4\u0bb2\u0bcd \u0bb5\u0bc6\u0bb1\u0bcd\u0bb1\u0bbf \u0baa\u0bc6\u0bb1\u0bcd\u0bb1\u0ba4\u0bc1.",
        "payment_failed": "\u0baa\u0ba3\u0bae\u0bcd \u0b9a\u0bc6\u0bb2\u0bc1\u0ba4\u0bcd\u0ba4\u0bc1\u0ba4\u0bb2\u0bcd \u0ba4\u0bcb\u0bb2\u0bcd\u0bb5\u0bbf\u0baf\u0b9f\u0bc8\u0ba8\u0bcd\u0ba4\u0ba4\u0bc1. \u0bae\u0bc0\u0ba3\u0bcd\u0b9f\u0bc1\u0bae\u0bcd \u0bae\u0bc1\u0baf\u0bb1\u0bcd\u0b9a\u0bbf\u0b95\u0bcd\u0b95\u0bb5\u0bc1\u0bae\u0bcd.",
    },
    "mr": {
        "enter_amount": "\u0930\u0915\u094d\u0915\u092e \u092a\u094d\u0930\u0935\u093f\u0937\u094d\u091f \u0915\u0930\u093e.",
        "scan_card": "\u0924\u0941\u092e\u091a\u0947 \u0915\u093e\u0930\u094d\u0921 \u0938\u094d\u0915\u0945\u0928 \u0915\u0930\u093e.",
        "enter_pin": "\u0924\u0941\u092e\u091a\u093e \u092a\u093f\u0928 \u092a\u094d\u0930\u0935\u093f\u0937\u094d\u091f \u0915\u0930\u093e.",
        "payment_success": "\u092a\u0947\u092e\u0947\u0902\u091f \u092f\u0936\u0938\u094d\u0935\u0940 \u091d\u093e\u0932\u0947.",
        "payment_failed": "\u092a\u0947\u092e\u0947\u0902\u091f \u0905\u092f\u0936\u0938\u094d\u0935\u0940 \u091d\u093e\u0932\u0947. \u0915\u0943\u092a\u092f\u093e \u092a\u0941\u0928\u094d\u0939\u093e \u092a\u094d\u0930\u092f\u0924\u094d\u0928 \u0915\u0930\u093e.",
    },
}

SAMPLE_RATE = 44100


def synth_tone(path_wav, notes, volume=0.4):
    """Write a WAV of consecutive sine notes: [(freq_hz, duration_s), ...]."""
    frames = bytearray()
    for freq, duration in notes:
        total = int(SAMPLE_RATE * duration)
        for i in range(total):
            # Short fade in/out per note to avoid clicks.
            envelope = min(1.0, i / 800, (total - i) / 800)
            sample = volume * envelope * math.sin(2 * math.pi * freq * i / SAMPLE_RATE)
            frames += struct.pack("<h", int(sample * 32767))
    with wave.open(path_wav, "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(SAMPLE_RATE)
        handle.writeframes(bytes(frames))


def wav_to_mp3(src, dest):
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-codec:a", "libmp3lame", "-qscale:a", "4", dest],
        check=True,
    )


def main():
    parser = argparse.ArgumentParser(description="Generate Batwa voice prompts and result tones.")
    parser.add_argument("--language", choices=sorted(PROMPTS), help="Generate prompts for one language only.")
    args = parser.parse_args()

    # 1. Voice prompts per language.
    prompt_languages = [args.language] if args.language else PROMPTS
    for lang in prompt_languages:
        prompts = PROMPTS[lang]
        lang_dir = os.path.join(AUDIO_DIR, lang)
        os.makedirs(lang_dir, exist_ok=True)
        for key, text in prompts.items():
            dest = os.path.join(lang_dir, f"{key}.mp3")
            gTTS(text, lang=lang).save(dest)
            print(f"[OK] {os.path.relpath(dest, ROOT)}")

    if args.language:
        return

    # 2. Result tones (language-independent). Success: rising chime.
    #    Failure: low double buzz. Distinct even without speech.
    os.makedirs(AUDIO_DIR, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        success_wav = os.path.join(tmp, "success.wav")
        failure_wav = os.path.join(tmp, "failure.wav")
        synth_tone(success_wav, [(659.25, 0.16), (880.0, 0.28)])            # E5 -> A5
        synth_tone(failure_wav, [(220.0, 0.22), (0.0, 0.08), (185.0, 0.34)])  # A3, rest, F#3
        wav_to_mp3(success_wav, os.path.join(AUDIO_DIR, "success.mp3"))
        wav_to_mp3(failure_wav, os.path.join(AUDIO_DIR, "failure.mp3"))
    print(f"[OK] {os.path.relpath(os.path.join(AUDIO_DIR, 'success.mp3'), ROOT)}")
    print(f"[OK] {os.path.relpath(os.path.join(AUDIO_DIR, 'failure.mp3'), ROOT)}")


if __name__ == "__main__":
    main()
