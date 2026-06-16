import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

# Let's search the transcript for any output messages from SYSTEM or subagent execution
with open(r'C:\Users\stefan.serghei\.gemini\antigravity-ide\brain\484dd861-e4d7-4055-b62e-1b15c126f4d3\.system_generated\logs\transcript.jsonl', 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        step = data.get('step_index')
        # We look for steps around 2815 or higher, or where browser subagent finished
        if step is not None and step >= 2810:
            print(f"\n=== STEP {step} ({data.get('type')}, {data.get('source')}) ===")
            if data.get('content'):
                print("CONTENT:", data.get('content')[:1000])
            if data.get('tool_calls'):
                print("TOOL_CALLS:", data.get('tool_calls'))
            if data.get('status'):
                print("STATUS:", data.get('status'))
