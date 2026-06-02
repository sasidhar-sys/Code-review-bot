import hmac
import hashlib
import os
import requests
from reviewer import review_code

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
WEBHOOK_SECRET = os.environ.get("GITHUB_WEBHOOK_SECRET", "")

def verify_signature(payload: bytes, signature: str) -> bool:
    if not WEBHOOK_SECRET:
        return True  # Skip verification if no secret set
    mac = hmac.new(WEBHOOK_SECRET.encode(), msg=payload, digestmod=hashlib.sha256)
    expected = f"sha256={mac.hexdigest()}"
    return hmac.compare_digest(expected, signature)

def get_pr_diff(owner: str, repo: str, pr_number: int) -> str:
    url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}"
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3.diff"
    }
    res = requests.get(url, headers=headers, timeout=15)
    return res.text if res.status_code == 200 else ""

def get_pr_files(owner: str, repo: str, pr_number: int) -> list:
    url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/files"
    headers = {"Authorization": f"token {GITHUB_TOKEN}"}
    res = requests.get(url, headers=headers, timeout=15)
    return res.json() if res.status_code == 200 else []

def post_pr_comment(owner: str, repo: str, pr_number: int, body: str):
    url = f"https://api.github.com/repos/{owner}/{repo}/issues/{pr_number}/comments"
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json"
    }
    requests.post(url, json={"body": body}, headers=headers, timeout=15)

def format_review_comment(review: dict, pr_title: str = "") -> str:
    score = review.get("score", 0)
    emoji = "🟢" if score >= 80 else "🟡" if score >= 50 else "🔴"

    lines = [
        f"## 🤖 AI Code Review{f' — {pr_title}' if pr_title else ''}",
        f"",
        f"**Score:** {emoji} {score}/100",
        f"",
        f"**Summary:** {review.get('summary', 'N/A')}",
        f"",
    ]

    for category, icon in [("bugs", "🐛"), ("security", "🔒"), ("performance", "⚡"), ("style", "🎨")]:
        items = review.get(category, [])
        if items:
            lines.append(f"### {icon} {category.capitalize()} Issues ({len(items)})")
            for item in items:
                sev = item.get("severity", "low").upper()
                lines.append(f"- **[{sev}]** `Line {item.get('line', '?')}` — {item.get('title', '')}")
                lines.append(f"  {item.get('description', '')}")
                if item.get("fix"):
                    lines.append(f"  ```\n  {item['fix']}\n  ```")
            lines.append("")

    positives = review.get("positives", [])
    if positives:
        lines.append("### ✅ What's Good")
        for p in positives:
            lines.append(f"- {p}")
        lines.append("")

    lines.append("---")
    lines.append("*Reviewed by DocMind AI Code Reviewer · Powered by Gemini 1.5 Flash*")
    return "\n".join(lines)

def handle_pr_event(payload: dict) -> dict:
    action = payload.get("action")
    if action not in ("opened", "synchronize", "reopened"):
        return {"skipped": True, "reason": f"Action '{action}' not reviewable"}

    pr = payload.get("pull_request", {})
    repo_data = payload.get("repository", {})
    owner = repo_data.get("owner", {}).get("login", "")
    repo = repo_data.get("name", "")
    pr_number = pr.get("number")
    pr_title = pr.get("title", "")

    if not all([owner, repo, pr_number]):
        return {"error": "Missing PR data"}

    # Get changed files and build code context
    files = get_pr_files(owner, repo, pr_number)
    code_snippets = []
    for f in files[:5]:  # Limit to 5 files to stay within token limits
        filename = f.get("filename", "")
        patch = f.get("patch", "")
        if patch:
            code_snippets.append(f"# File: {filename}\n{patch}")

    if not code_snippets:
        return {"error": "No reviewable code found in PR"}

    combined_code = "\n\n".join(code_snippets)
    context = f"PR #{pr_number}: {pr_title}. Reviewing git diff/patch format."

    review = review_code(combined_code, "auto", context)
    if "error" in review:
        return {"error": review["error"]}

    comment = format_review_comment(review, pr_title)
    post_pr_comment(owner, repo, pr_number, comment)

    return {"success": True, "pr": pr_number, "score": review.get("score")}