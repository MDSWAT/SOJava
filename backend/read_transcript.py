import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open(r'C:\Users\stefan.serghei\.gemini\antigravity-ide\brain\484dd861-e4d7-4055-b62e-1b15c126f4d3\.system_generated\logs\transcript.jsonl', 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        step = data.get('step_index')
        content = data.get('content')
        if data.get('type') == 'USER_INPUT' and content:
            print(f"\n--- USER INPUT STEP {step} ---")
            print(content)
        elif data.get('type') == 'PLANNER_RESPONSE' and content:
            # check if it mentions browser or console or subagent
            if any(w in content.lower() for w in ['browser', 'console', 'error', 'blank', 'empty', 'balance', 'balant']):
                print(f"\n--- PLANNER RESPONSE STEP {step} ---")
                print(content[:500] + "...")
        elif data.get('tool_calls'):
            for tc in data.get('tool_calls'):
                if tc.get('name') == 'browser_subagent':
                    print(f"\n--- BROWSER SUBAGENT CALL STEP {step} ---")
                    print(json.dumps(tc.get('args'), indent=2))
