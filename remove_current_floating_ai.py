from pathlib import Path
import re
import shutil

ROOT = Path.cwd()

LAYOUT = ROOT / "src/app/layout.tsx"
FLOATING_COMPONENT = ROOT / "src/components/interpreter/FloatingGoldInterpreter.tsx"
OLD_INTERPRETER_API = ROOT / "src/app/api/interpreter/route.ts"
OLD_INTERPRETER_PAGE = ROOT / "src/app/interpreter/page.tsx"
OLD_MANIFEST = ROOT / "src/lib/interpreterArtifactManifest.ts"

def patch_layout():
    if not LAYOUT.exists():
        print("layout.tsx missing")
        return

    text = LAYOUT.read_text(encoding="utf-8")

    text = re.sub(
        r'import FloatingGoldInterpreter from "@/components/interpreter/FloatingGoldInterpreter";.*\n',
        "",
        text,
    )

    text = re.sub(
        r"\n\s*\{/\* LAYER 3: FLOATING GOLD NEXUS ALPHA INTERPRETER \*/\}\s*\n\s*<FloatingGoldInterpreter />\s*\n",
        "\n",
        text,
        flags=re.S,
    )

    text = re.sub(
        r"\n\s*<FloatingGoldInterpreter />\s*\n",
        "\n",
        text,
    )

    LAYOUT.write_text(text, encoding="utf-8")
    print("Removed FloatingGoldInterpreter from layout.tsx")

def remove_file(path: Path):
    if path.exists():
        path.unlink()
        print(f"Deleted {path}")
    else:
        print(f"Already missing: {path}")

def remove_empty_dirs():
    for folder in [
        ROOT / "src/components/interpreter",
        ROOT / "src/app/api/interpreter",
        ROOT / "src/app/interpreter",
    ]:
        if folder.exists():
            try:
                folder.rmdir()
                print(f"Removed empty folder {folder}")
            except OSError:
                print(f"Folder not empty, kept: {folder}")

def main():
    patch_layout()

    remove_file(FLOATING_COMPONENT)
    remove_file(OLD_INTERPRETER_API)
    remove_file(OLD_INTERPRETER_PAGE)
    remove_file(OLD_MANIFEST)

    remove_empty_dirs()

    print("\nDONE: current old floating/static interpreter removed.")
    print("Next: run npm run dev and confirm no FloatingGoldInterpreter import errors.")

if __name__ == "__main__":
    main()