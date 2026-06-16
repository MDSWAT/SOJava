import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open(r'C:\Users\stefan.serghei\.gemini\antigravity-ide\brain\484dd861-e4d7-4055-b62e-1b15c126f4d3\.system_generated\logs\transcript.jsonl', 'r', encoding='utf-8') as f:
    for line in f:
        if 'check_balance_issue' in line:
            data = json.loads(line)
            step = data.get('step_index')
            print(f"\n=== STEP {step} ===")
            print("TYPE:", data.get('type'))
            print("SOURCE:", data.get('source'))
            content = data.get('content')
            if content:
                print("CONTENT:", content[:2000])
            tool_calls = data.get('tool_calls')
            if tool_calls:
                print("TOOL_CALLS:", tool_calls)
