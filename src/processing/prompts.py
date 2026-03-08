"""
LLM Prompt Templates

All prompts used for article processing, TLDR generation,
and knowledge extraction. Centralized here for easy tuning.
"""

ARTICLE_ANALYSIS_SYSTEM = """You are an intelligence analyst for a defense technology company.
Your job is to extract actionable knowledge from articles shared in an internal intelligence group.

You must respond ONLY with valid JSON, no markdown, no preamble, no explanation.
"""

ARTICLE_ANALYSIS_PROMPT = """Analyze the following article and extract structured intelligence.

ARTICLE TITLE: {title}
ARTICLE SOURCE: {url}
ARTICLE DATE: {published_date}

ARTICLE CONTENT:
{content}

Respond with this exact JSON structure:
{{
  "tldr": "A 2-3 sentence summary of the article's key point and why it matters.",
  "key_facts": [
    "Specific fact or data point from the article",
    "Another important fact with numbers if available"
  ],
  "people": [
    {{"name": "Full Name", "role": "Their title/role", "context": "Why they are mentioned"}}
  ],
  "organizations": [
    {{"name": "Org Name", "type": "company|government|military|research|other", "context": "Their role in the article"}}
  ],
  "technologies": [
    {{"name": "Technology/Product Name", "context": "How it's referenced"}}
  ],
  "dates": [
    {{"date": "YYYY-MM-DD or descriptive", "context": "What this date represents"}}
  ],
  "action_items": [
    "Any recommendations, warnings, or action-worthy takeaways"
  ],
  "tags": ["tag1", "tag2"],
  "relevance_score": 3
}}

Rules:
- tldr must be exactly 2-3 sentences, concise and informative
- key_facts should be 3-7 concrete, verifiable facts
- Only include people/orgs/tech that are actually in the article
- tags should be lowercase, general categories (e.g., "defense", "cyber", "geopolitics", "technology", "policy", "industry", "finance")
- relevance_score: 1=low general interest, 3=moderately relevant, 5=critical/urgent
- If a field has no data, use an empty array []
- Respond ONLY with the JSON object, nothing else
"""

WEEKLY_DIGEST_SYSTEM = """You are an intelligence briefing officer. You create concise weekly 
summaries from a collection of processed articles. Be direct and prioritize 
the most important developments."""

WEEKLY_DIGEST_PROMPT = """Create a weekly intelligence digest from the following articles processed this week.

WEEK: {week_start} to {week_end}
TOTAL ARTICLES: {article_count}

ARTICLES:
{articles_summary}

Generate a weekly digest with this JSON structure:
{{
  "executive_summary": "3-5 sentence overview of this week's most important developments.",
  "top_stories": [
    {{
      "title": "Story headline",
      "summary": "1-2 sentence summary",
      "article_ids": ["id1"],
      "importance": "high|medium"
    }}
  ],
  "key_trends": [
    "Trend or pattern observed across multiple articles this week"
  ],
  "watch_list": [
    "Items to monitor going forward based on this week's intelligence"
  ]
}}

Rules:
- executive_summary should give someone who missed the week a complete picture
- top_stories should be 3-5 items max, ranked by importance
- key_trends should identify patterns across articles, not repeat individual stories
- watch_list should be forward-looking action items
- Respond ONLY with the JSON object
"""


MESSAGE_ONLY_PROMPT = """The following is a WhatsApp message that was shared without a link 
to an article. It may contain valuable information on its own.

SENDER: {sender}
DATE: {timestamp}
MESSAGE:
{content}

If this message contains substantive information worth cataloging, respond with:
{{
  "is_substantive": true,
  "tldr": "Brief summary of the information",
  "key_facts": ["fact1", "fact2"],
  "tags": ["tag1"],
  "relevance_score": 2
}}

If the message is just chatter, a greeting, or not informative, respond with:
{{
  "is_substantive": false
}}

Respond ONLY with the JSON object.
"""
