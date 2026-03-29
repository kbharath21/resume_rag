import os
import io
import fitz  # PyMuPDF
import requests
from openai import OpenAI
from pymilvus import Collection
from dotenv import load_dotenv
import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image
from fastapi import Depends, FastAPI, HTTPException

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def detect_file_type_from_bytes(file_bytes: bytes) -> str:
    """
    Look at first few bytes (magic bytes)
    to detect file type
    """
    # PDF magic bytes start with %PDF
    if file_bytes[:4] == b'%PDF':
        return 'pdf'
    # DOCX magic bytes (zip format)
    elif file_bytes[:4] == b'PK\x03\x04':
        return 'docx'
    # JPG magic bytes
    elif file_bytes[:3] == b'\xff\xd8\xff':
        return 'jpg'
    # PNG magic bytes
    elif file_bytes[:8] == b'\x89PNG\r\n\x1a\n':
        return 'png'
    else:
        return 'pdf'  # default to pdf

def summarize_resume(raw_text: str) -> str:
    prompt = f"""
    You are an expert resume parser.
    
    Extract ONLY the following from this resume:
    - Full name
    - Technical skills (programming languages, frameworks, tools)
    - Years of experience
    - Job titles held
    - Companies worked at
    - Education (degree, college)
    - Key projects
    - Location
    
    IGNORE:
    - Hobbies and interests
    - Personal statements
    - References
    - Filler text
    
    If this is not a resume or has insufficient information,
    respond with exactly:
    "The provided text does not contain sufficient resume information to generate a resume summary."
    
    Resume text:
    {raw_text}
    """
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {
                "role": "system",
                "content": "You are an expert resume parser. Extract only relevant professional information."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        max_tokens=1000,
        temperature=0,

    )
    return response.choices[0].message.content

def extract_text_with_pymupdf(file_bytes: bytes)->str:
    pdf_document= fitz.open(stream=file_bytes, filetype="pdf")

    full_text = ""
    for page_num in range(len(pdf_document)):
        page = pdf_document[page_num]
        full_text += page.get_text()

    pdf_document.close()   
    return full_text.strip()

async def process_resume_with_ocr_fallback(url: str):
    try:
        print(f"Downloading PDF from: {url}")
        response = requests.get(url, timeout=30)  
        response.raise_for_status()
        file_bytes = response.content

        file_type = detect_file_type_from_bytes(file_bytes)
        print(f"Detected file type: {file_type}")

        raw_text = extract_text_with_pymupdf(file_bytes)
        print(f"Extracted text length: {len(raw_text)}")

        # Step 4: Check if text extraction worked
        if not raw_text or len(raw_text.strip()) < 100:
            return False, "Invalid.", ""

        # Step 5: Summarize with GPT
        summary = summarize_resume(raw_text)
        print(f"Summary generated: {summary[:100]}...")

        return True, summary, raw_text

    except Exception as e:
        print(f"Error in process_resume_with_ocr_fallback: {e}")
        return False, str(e), ""



def embed_text(text: str) -> list:
    """
    Convert text to vector using Ada
    Returns list of 1536 floats
    """
    response = client.embeddings.create(
        model="text-embedding-ada-002",
        input=text
    )
    return response.data[0].embedding


async def store_into_milvus(summary: str, full_resume_text: str, user_id: int, name: str, email: str, phone: str, is_active: int = 1):
    collection_name = os.getenv("MILVUS_COLLECTION_NAME", "hybrid_search006")
    print("Embedding summary...")
    embedding = embed_text(summary)

    collection = Collection(collection_name)
    collection.load()
    data=[
        [user_id],
        [name],
        [email],
        [phone],
        [embedding],
        [full_resume_text],
        [summary],
        [is_active],
    ]

    collection.insert(data)

    collection.flush()
    print(f"✅ Stored profile_id {user_id} in Milvus!")




    



