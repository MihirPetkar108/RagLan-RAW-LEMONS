import fitz
from PIL import Image
"""
This module has been deprecated and is no longer used in the project.
"""
import numpy as np

def analyze_pdf_visuals(pdf_path: str):
    results = []

    doc = fitz.open(pdf_path)

    for page_index, page in enumerate(doc):
        images = page.get_images(full=True)

        for img_index, img in enumerate(images):
            xref = img[0]
            base_image = doc.extract_image(xref)
            image_bytes = base_image["image"]

            image = Image.open(io.BytesIO(image_bytes))

            decoded_text, barcode_type = decode_pdf417(image)

            if decoded_text:
                results.append({
                    "page": page_index + 1,
                    "image_index": img_index,
                    "barcode_type": barcode_type,
                    "data": decoded_text
                })

    return results


def decode_pdf417(image_pil: Image.Image):
    img = np.array(image_pil.convert("RGB"))
    img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

    detector = cv2.barcode_BarcodeDetector()
    ok, decoded_info, decoded_type, _ = detector.detectAndDecode(img)

    if ok and decoded_info:
        return decoded_info, decoded_type

    return [], []
