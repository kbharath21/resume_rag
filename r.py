import os
import requests
from openai import OpenAI
from dotenv import load_dotenv
from pdf2image import convert_from_bytes
import pytesseract
from PIL import Image

load_dotenv()

pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

async def process_resume_from_url(url:str):
    try:
        print(f"Downloading PDF from: {url}")
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        file_bytes= response.content

        print("converting PDF to images")
        images = convert_from_bytes(file_bytes)
        print(f"converted to {len(images)} images")

        full_text = ""
        for i, image in enumerate(images):
            print(f"processing image {i+1} of {len(images)}")
            page_text=pytesseract.image_to_string(image)
            full_text += page_text + "\n"

        print(f"extracted text length: {len(full_text)}")

        if len(full_text.strip())<100:
            return False, "Invalid.", ""

        from resume_processesors import summarize_resume
        summary = summarize_resume(full_text)
        print(f"OCR Summary: {summary[:100]}...")

        return True, summary, full_text 


    except Exception as e:
        print(f"OCR fallback failed: {e}")
        return False, str(e), ""










