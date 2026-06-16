import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

# Search the transcript for subagent response content or errors
with open(r'C:\Users\stefan.serghei\.gemini\antigravity-ide\brain\484dd861-e4d7-4055-b62e-1b15c126f4d3\.system_generated\logs\transcript.jsonl', 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        step = data.get('step_index')
        source = data.get('source')
        type_ = data.get('type')
        content = data.get('content')
        
        # We print any subagent step results
        if type_ == 'SUBAGENT_RESPONSE' or 'subagent' in str(type_).lower() or 'subagent' in str(source).lower():
            print(f"\n=== STEP {step} (Type: {type_}, Source: {source}) ===")
            print(content)
        elif content and ('error' in content.lower() or 'exception' in content.lower()) and step >= 2800:
            print(f"\n=== STEP {step} ERROR ===")
            print(content[:1000])
