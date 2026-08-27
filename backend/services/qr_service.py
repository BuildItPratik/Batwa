"""
TapWallet — QR Code Service
Generates QR code PNGs encoded as base64 strings.
"""

import io
import base64
import qrcode


def generate_qr_base64(card_id: str) -> str:
    """
    Generate a QR code image encoding the given card_id.
    Returns the PNG image as a base64-encoded string.
    """
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(card_id)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)

    return base64.b64encode(buffer.getvalue()).decode("utf-8")
