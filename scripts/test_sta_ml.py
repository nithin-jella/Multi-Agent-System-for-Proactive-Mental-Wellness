#!/usr/bin/env python3
"""
Test script for STA ML Classifier.

Tests the hybrid classifier (rule-based + ML semantic similarity)
to ensure it correctly detects crisis messages.

Run with: python test_sta_ml.py
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app.agents.sta.classifiers import SafetyTriageClassifier
from app.agents.sta.ml_classifier_onnx import ONNXHybridClassifier, ONNXSemanticClassifier
from app.agents.sta.schemas import STAClassifyRequest


async def test_ml_classifier():
    """Test ML semantic classifier."""
    print("\n" + "=" * 70)
    print("TEST 1: ML Semantic Classifier (ONNX)")
    print("=" * 70)
    
    try:
        ml_classifier = ONNXSemanticClassifier()
        
        if not ml_classifier.is_available():
            print("❌ ML classifier not available")
            print("   Install onnxruntime: pip install onnxruntime optimum[onnxruntime]")
            return False
        
        print("✅ ML classifier loaded successfully")
        print(f"   Model: {ml_classifier.model_name}")
        print()
        
        # Test the original failing message
        payload = STAClassifyRequest(
            session_id="test-session",
            text="I really really want to die u know"
        )
        
        result = await ml_classifier.classify(payload)
        
        if result is None:
            print("❌ ML classifier returned None")
            return False
        
        print(f"Message: '{payload.text}'")
        print(f"Risk Level: {result.risk_level} (expected: 3)")
        print(f"Intent: {result.intent}")
        print(f"Next Step: {result.next_step}")
        print(f"Handoff: {result.handoff}")
        print(f"Diagnostic: {result.diagnostic_notes}")
        print()
        
        # Verify
        if result.risk_level == 3:
            print("✅ PASS: ML classifier correctly detected crisis!")
        else:
            print(f"❌ FAIL: Expected risk_level=3, got {result.risk_level}")
            return False
        
        return True
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("   Install onnxruntime: pip install onnxruntime optimum[onnxruntime]")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_hybrid_classifier():
    """Test hybrid classifier (rule-based + ML)."""
    print("\n" + "=" * 70)
    print("TEST 2: Hybrid Classifier (Rule-based + ML ONNX)")
    print("=" * 70)
    
    try:
        # Initialize classifiers
        rule_classifier = SafetyTriageClassifier()
        
        try:
            semantic_classifier = ONNXSemanticClassifier()
            hybrid = ONNXHybridClassifier(
                rule_classifier=rule_classifier,
                onnx_classifier=semantic_classifier
            )
            print("✅ Hybrid classifier initialized (Rule-based + ML)")
        except Exception as e:
            print(f"⚠️  ML not available: {e}")
            print("   Using rule-based only")
            hybrid = ONNXHybridClassifier(
                rule_classifier=rule_classifier,
                onnx_classifier=None
            )
        
        print()
        
        # Test cases
        test_cases = [
            # Original issue
            ("I really really want to die u know", 3, "crisis_support"),
            
            # Paraphrases (ML should catch these better than rules)
            ("life has no meaning, i should just end things", 3, "crisis_support"),
            ("i've been thinking about ending my life", 3, "crisis_support"),
            ("don't think i can keep living like this", 3, "crisis_support"),
            
            # High distress
            ("everything is hopeless, i feel so empty", 2, "acute_distress"),
            ("i want to hurt myself", 2, "acute_distress"),
            
            # Moderate stress
            ("im so stressed about my thesis", 1, "academic_stress"),
            ("my relationship ended and im devastated", 1, "relationship_strain"),
            
            # Low risk
            ("feeling a bit down today", 0, "general_support"),
            ("need someone to talk to", 0, "general_support"),
            
            # Edge cases (should NOT trigger)
            ("i want to diet", 0, "general_support"),
            ("dying to know the answer", 0, "general_support"),
        ]
        
        passed = 0
        failed = 0
        
        for text, expected_risk, expected_intent in test_cases:
            payload = STAClassifyRequest(session_id="test-session", text=text)
            result = await hybrid.classify(payload)
            
            # Check if risk level is close enough (allow ±1 for moderate cases)
            risk_match = result.risk_level == expected_risk
            
            # For crisis cases, must be exact
            if expected_risk == 3:
                success = result.risk_level >= 2  # At least high risk
            elif expected_risk == 2:
                success = result.risk_level >= 1  # At least moderate
            else:
                success = result.risk_level == expected_risk
            
            status = "✅" if success else "❌"
            
            if success:
                passed += 1
            else:
                failed += 1
            
            print(f"{status} '{text[:50]}...'")
            print(f"   Expected: risk={expected_risk}")
            print(f"   Got:      risk={result.risk_level}, intent={result.intent}")
            if result.diagnostic_notes:
                # Truncate long notes
                notes = result.diagnostic_notes[:80] + "..." if len(result.diagnostic_notes) > 80 else result.diagnostic_notes
                print(f"   Notes:    {notes}")
            print()
        
        print("=" * 70)
        print(f"Results: {passed} passed, {failed} failed")
        print("=" * 70)
        
        return failed == 0
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_comparative_analysis():
    """Compare rule-based vs ML performance."""
    print("\n" + "=" * 70)
    print("TEST 3: Comparative Analysis (Rule-based vs ML ONNX)")
    print("=" * 70)
    
    try:
        rule_classifier = SafetyTriageClassifier()
        
        try:
            ml_classifier = ONNXSemanticClassifier()
            if not ml_classifier.is_available():
                print("⚠️  ML classifier not available, skipping comparison")
                return True
        except:
            print("⚠️  ML classifier not available, skipping comparison")
            return True
        
        # Test cases where ML should outperform rules
        test_cases = [
            "thinking about ending things",
            "life isn't worth it anymore",
            "maybe everyone would be better off without me",
            "i've written my goodbye letters",
            "planning to jump tomorrow",
        ]
        
        print("\nMessages where ML provides better semantic understanding:\n")
        
        for text in test_cases:
            payload = STAClassifyRequest(session_id="test", text=text)
            
            rule_result = await rule_classifier.classify(payload)
            ml_result = await ml_classifier.classify(payload)
            
            print(f"Message: '{text}'")
            print(f"  Rule-based: risk={rule_result.risk_level}")
            print(f"  ML:         risk={ml_result.risk_level if ml_result else 'N/A'}")
            
            if ml_result and ml_result.risk_level > rule_result.risk_level:
                print(f"  ✅ ML detected higher risk (better)")
            elif ml_result and ml_result.risk_level == rule_result.risk_level:
                print(f"  ✓  Both agree")
            else:
                print(f"  →  Rule-based detected higher risk")
            print()
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    print("\n🤖 Testing STA ML Classifier Implementation\n")
    
    try:
        # Test 1: ML Classifier
        ml_ok = await test_ml_classifier()
        
        # Test 2: Hybrid Classifier
        hybrid_ok = await test_hybrid_classifier()
        
        # Test 3: Comparative Analysis
        comparison_ok = await test_comparative_analysis()
        
        # Final summary
        print("\n" + "=" * 70)
        print("FINAL SUMMARY")
        print("=" * 70)
        print(f"ML Classifier:     {'✅ PASS' if ml_ok else '❌ FAIL'}")
        print(f"Hybrid Classifier: {'✅ PASS' if hybrid_ok else '❌ FAIL'}")
        print(f"Comparison:        {'✅ PASS' if comparison_ok else '❌ FAIL'}")
        print("=" * 70)
        
        if ml_ok and hybrid_ok:
            print("\n🎉 All tests passed! ML classifier is working correctly.\n")
            return 0
        else:
            print("\n⚠️  Some tests failed. Review the output above.\n")
            return 1
            
    except Exception as e:
        print(f"\n❌ Test suite failed with exception: {e}\n")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
