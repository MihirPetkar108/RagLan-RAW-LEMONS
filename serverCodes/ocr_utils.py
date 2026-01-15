import os
import pytesseract
from PIL import Image
from pdf2image import convert_from_path

def ocr_image(image_path: str)->str:
    if not os.path.exists(image_path):
        raise FileNotFoundError(image_path)

    img = Image.open(image_path)
    text = pytesseract.image_to_string(img, lang="eng")
    return text.strip()

def ocr_pdf(pdf_path:str)->str:
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(pdf_path)
    pages = convert_from_path(pdf_path)
    full_text=[]

    for i, page in enumerate(pages):
        page_text = pytesseract.image_to_string(page, lang="eng")
        if page_text.strip():
            full_text.append(page_text)
    return "\n".join(full_text)