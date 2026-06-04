import os
import json
import time
import hashlib
import sqlite3
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-3.5-flash', 'gemini-2.5-pro']
MAX_RETRIES = 3

# Initialize SQLite database cache in the backend directory
DB_PATH = os.path.join(os.path.dirname(__file__), "review_cache.db")

def init_cache_db():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS reviews (
                hash TEXT PRIMARY KEY,
                result TEXT
            )
        """)
        conn.commit()
        conn.close()
    except Exception as e:
        print("Failed to initialize SQLite cache:", e)

init_cache_db()

def get_cached_review(code: str, language: str, context: str) -> dict:
    try:
        # Create a unique SHA256 key based on input code, language, and context
        key_src = f"{code.strip()}||{language.strip()}||{context.strip()}"
        key_hash = hashlib.sha256(key_src.encode("utf-8")).hexdigest()
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT result FROM reviews WHERE hash = ?", (key_hash,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return json.loads(row[0])
    except Exception as e:
        print("Cache lookup error:", e)
    return None

def save_to_cache(code: str, language: str, context: str, result: dict):
    try:
        key_src = f"{code.strip()}||{language.strip()}||{context.strip()}"
        key_hash = hashlib.sha256(key_src.encode("utf-8")).hexdigest()
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT OR REPLACE INTO reviews (hash, result) VALUES (?, ?)",
            (key_hash, json.dumps(result))
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print("Cache write error:", e)

def review_code(code: str, language: str, context: str) -> dict:
    # 1. Try to read from cache first
    cached = get_cached_review(code, language, context)
    if cached:
        return cached

    prompt = f"""
You are an expert AI Code Reviewer. Review the following code snippet carefully.
Language: {language}
Context: {context}

Code:
{code}

Return ONLY a valid JSON object with this exact schema:
{{
  "score": 75,
  "language": "python",
  "summary": "Brief overall assessment of the code quality.",
  "bugs": [
    {{"severity": "high", "line": "5", "title": "SQL Injection vulnerability", "description": "Detailed description.", "fix": "suggested fix code"}}
  ],
  "security": [],
  "performance": [],
  "style": [],
  "positives": ["Something the code does well"],
  "refactored": "// full refactored version of the code"
}}

Use severity values: critical, high, medium, low.
Return ONLY the JSON, no markdown, no explanation.
"""
    for model_name in MODELS:
        for attempt in range(MAX_RETRIES):
            try:
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(
                    prompt,
                    generation_config=genai.GenerationConfig(
                        response_mime_type="application/json",
                        temperature=0.0,  # Set temperature to 0.0 for deterministic output
                    )
                )
                text = response.text.strip()
                # Strip markdown code fences if present
                if text.startswith("```"):
                    text = text.split("```")[1]
                    if text.startswith("json"):
                        text = text[4:]
                result = json.loads(text)
                
                # 2. Save response to cache
                save_to_cache(code, language, context, result)
                return result
            except Exception as e:
                err_str = str(e)
                if "503" in err_str or "UNAVAILABLE" in err_str or "overloaded" in err_str.lower():
                    time.sleep(2 ** attempt)
                    continue
                elif "429" in err_str or "quota" in err_str.lower():
                    time.sleep(5)
                    continue
                else:
                    break  # Try next model

    return {"error": "All models are currently unavailable. Please try again in a moment."}
