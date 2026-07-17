#!/usr/bin/env python3
"""
[DEPRECATED] Ensure ONNX model exists - auto-build if missing.

⚠️  THIS SCRIPT IS NO LONGER USED ⚠️

As of November 2025, the Safety Triage Agent has been migrated from 
PyTorch/ONNX to a pure Gemini-based approach with smart caching.

This script is kept for reference only.

Migration Details:
- Old: PyTorch/ONNX ML classifiers (~1GB deployment size)
- New: Gemini API with 3-tier optimization (~1MB deployment size)
- See: docs/PYTORCH_TO_GEMINI_MIGRATION.md

If you see errors related to ONNX models, please update your code to use
the new GeminiSTAClassifier instead:
    from app.agents.sta.gemini_classifier import GeminiSTAClassifier

---

ORIGINAL DOCUMENTATION (DEPRECATED):

This script checks if the ONNX model exists, and if not, automatically
downloads and exports it. Perfect for CI/CD and Docker builds.

Usage:
    python scripts/ensure_onnx_model.py

Features:
- ✅ Auto-downloads from HuggingFace if missing
- ✅ Exports to ONNX format automatically
- ✅ No Git LFS required
- ✅ Works in CI/CD pipelines
- ✅ Idempotent (safe to run multiple times)
"""
import sys
from pathlib import Path

print("⚠️  WARNING: This script is DEPRECATED")
print("   The STA now uses Gemini API instead of ONNX models.")
print("   See: docs/PYTORCH_TO_GEMINI_MIGRATION.md")
print("")
sys.exit(1)

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))


def ensure_onnx_model(
    model_name: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
    output_dir: Path | None = None,
    force_rebuild: bool = False
) -> bool:
    """Ensure ONNX model exists, download and export if missing.
    
    Args:
        model_name: HuggingFace model identifier
        output_dir: Output directory (default: models/onnx/minilm-l12-v2)
        force_rebuild: Force rebuild even if model exists
        
    Returns:
        True if model is ready, False on error
    """
    # Determine output directory
    if output_dir is None:
        output_dir = Path(__file__).parent.parent / "models" / "onnx" / "minilm-l12-v2"
    
    model_file = output_dir / "model.onnx"
    
    # Check if model already exists
    if model_file.exists() and not force_rebuild:
        print(f"✅ ONNX model already exists: {model_file}")
        print(f"   Size: {model_file.stat().st_size / 1e6:.1f} MB")
        print(f"   Use --force to rebuild")
        return True
    
    print("=" * 70)
    print("ONNX Model Auto-Builder")
    print("=" * 70)
    print(f"Model: {model_name}")
    print(f"Output: {output_dir}")
    print(f"Status: {'Rebuilding (forced)' if force_rebuild else 'Not found - building'}")
    print()
    
    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        # Import required libraries
        print("[1/4] Checking dependencies...")
        try:
            import onnxruntime as ort
            from transformers import AutoTokenizer, AutoModel
            import torch
            print(f"      ✅ onnxruntime: {ort.__version__}")
            print(f"      ✅ transformers: {AutoTokenizer.__version__}")
            print(f"      ✅ torch: {torch.__version__}")
        except ImportError as e:
            print(f"      ❌ Missing dependency: {e}")
            print()
            print("Install required packages:")
            print("  pip install onnxruntime transformers torch")
            return False
        
        # Step 1: Download model from HuggingFace
        print("[2/4] Downloading model from HuggingFace...")
        print(f"      Source: {model_name}")
        print(f"      This may take 2-5 minutes on first run...")
        
        model = AutoModel.from_pretrained(model_name)
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        
        print(f"      ✅ Model downloaded")
        
        # Step 2: Export to ONNX
        print("[3/4] Exporting to ONNX format...")
        
        # Create dummy input for export
        dummy_input = tokenizer(
            "This is a test sentence",
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=128
        )
        
        # Export to ONNX
        torch.onnx.export(
            model,
            (dummy_input["input_ids"], dummy_input["attention_mask"]),
            str(model_file),
            export_params=True,
            opset_version=14,
            do_constant_folding=True,
            input_names=['input_ids', 'attention_mask'],
            output_names=['last_hidden_state'],
            dynamic_axes={
                'input_ids': {0: 'batch_size', 1: 'sequence'},
                'attention_mask': {0: 'batch_size', 1: 'sequence'},
                'last_hidden_state': {0: 'batch_size', 1: 'sequence'}
            }
        )
        
        print(f"      ✅ Exported to ONNX")
        
        # Step 3: Save tokenizer
        print("[4/4] Saving tokenizer...")
        tokenizer.save_pretrained(str(output_dir))
        print(f"      ✅ Tokenizer saved")
        
        # Calculate size
        total_size = sum(f.stat().st_size for f in output_dir.rglob('*') if f.is_file())
        size_mb = total_size / 1e6
        
        print()
        print("=" * 70)
        print("✅ MODEL READY")
        print("=" * 70)
        print(f"Location: {output_dir}")
        print(f"Size: {size_mb:.1f} MB")
        print()
        print("Files created:")
        for file in sorted(output_dir.iterdir()):
            if file.is_file():
                file_size = file.stat().st_size / 1e6
                print(f"  - {file.name:30s} {file_size:>6.1f} MB")
        print()
        print("Performance benefits:")
        print("  ⚡ 3-5x faster inference (15-30ms)")
        print("  💾 96% smaller dependencies (30 MB vs 800 MB PyTorch)")
        print("  🎯 Same accuracy (85-95%)")
        print("  🚀 Production-ready")
        print("=" * 70)
        
        return True
        
    except Exception as e:
        print()
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Ensure ONNX model exists - auto-build if missing"
    )
    parser.add_argument(
        "--model",
        default="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
        help="HuggingFace model identifier"
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Output directory (default: models/onnx/minilm-l12-v2)"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force rebuild even if model exists"
    )
    
    args = parser.parse_args()
    
    success = ensure_onnx_model(
        model_name=args.model,
        output_dir=args.output,
        force_rebuild=args.force
    )
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
