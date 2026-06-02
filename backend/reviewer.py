import os
import json
import time
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

MODELS = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp']
MAX_RETRIES = 3

def review_code(code: str, language: str, context: str) -> dict:
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
                        temperature=0.3,
                    )
                )
                text = response.text.strip()
                # Strip markdown code fences if present
                if text.startswith("```"):
                    text = text.split("```")[1]
                    if text.startswith("json"):
                        text = text[4:]
                result = json.loads(text)
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
