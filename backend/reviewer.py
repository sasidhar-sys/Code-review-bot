import os
import json
import time
from google import genai
from google.genai import types
from google.genai.errors import APIError

client = genai.Client()

def review_code(code: str, language: str, context: str) -> dict:
    prompt = f"""
    You are an expert AI Code Reviewer. Review the following code snippet.
    Language: {language}
    Context: {context}

    Code:
    {code}

    Return a JSON object with the following schema exactly:
    {{
      "score": 0, // integer from 0 to 100
      "summary": "string summary of the review",
      "bugs": [
        {{"severity": "low", "line": "10", "title": "short title", "description": "details", "fix": "code fix"}}
      ],
      "security": [],
      "performance": [],
      "style": [],
      "positives": [ "string of something good" ]
    }}
    """
    
    models_to_try = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash']
    max_retries = 3
    
    for model in models_to_try:
        for attempt in range(max_retries):
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                    ),
                )
                result = json.loads(response.text)
                return result
            except APIError as e:
                # If 503 Service Unavailable, wait and retry
                if "503" in str(e) or "UNAVAILABLE" in str(e):
                    time.sleep(2 ** attempt)  # Exponential backoff
                    continue
                else:
                    return {"error": str(e)}
            except Exception as e:
                return {"error": str(e)}
                
    return {"error": "All models are currently experiencing high demand. Please try again in a few minutes."}
