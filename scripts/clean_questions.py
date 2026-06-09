from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


def main() -> int:
    workspace = Path(__file__).resolve().parents[1]
    input_path = workspace / "downloadQuestionAll.doc"
    output_path = workspace / "questions.cleaned.json"
    ps_script = workspace / "scripts" / "generate_questions.ps1"

    cmd = [
        "powershell",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        str(ps_script),
        "-InputPath",
        str(input_path),
        "-OutputPath",
        str(output_path),
    ]

    completed = subprocess.run(cmd, capture_output=True, text=True)
    if completed.returncode != 0:
        sys.stderr.write(completed.stderr)
        return completed.returncode

    payload = json.loads(output_path.read_text(encoding="utf-8"))
    print(
        f"Generated {output_path.name} with {len(payload['questions'])} questions "
        f"across {len(payload['chapterCatalog'])} chapters."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
