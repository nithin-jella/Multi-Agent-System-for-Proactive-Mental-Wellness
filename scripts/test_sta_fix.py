#!/usr/bin/env python3
"""
Test script for STA crisis detection fix.

This script tests the updated SafetyTriageClassifier to ensure
it correctly detects the original issue: "I really really want to die u know"

Run with: python test_sta_fix.py
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app.agents.sta.classifiers import SafetyTriageClassifier
from app.agents.sta.schemas import STAClassifyRequest


async def test_original_issue():
    """Test the exact message that failed."""
    classifier = SafetyTriageClassifier()
    
    # Original failing message
    payload = STAClassifyRequest(
        session_id="test-session",
        text="I really really want to die u know"
    )
    
    result = await classifier.classify(payload)
    
    print("=" * 60)
    print("TEST: Original Issue - 'I really really want to die u know'")
    print("=" * 60)
    print(f"Risk Level: {result.risk_level} (expected: 3)")
    print(f"Intent: {result.intent} (expected: crisis_support)")
    print(f"Next Step: {result.next_step} (expected: human)")
    print(f"Handoff: {result.handoff} (expected: True)")
    print(f"Diagnostic: {result.diagnostic_notes}")
    print()
    
    # Verify
    assert result.risk_level == 3, f"Expected risk_level=3, got {result.risk_level}"
    assert result.intent == "crisis_support", f"Expected intent=crisis_support, got {result.intent}"
    assert result.next_step == "human", f"Expected next_step=human, got {result.next_step}"
    assert result.handoff is True, f"Expected handoff=True, got {result.handoff}"
    
    print("✅ PASS: Original issue now correctly detected as crisis!")
    print()


async def test_variations():
    """Test various crisis message variations."""
    classifier = SafetyTriageClassifier()
    
    test_cases = [
        # English variations
        ("wanna die", 3, "crisis_support"),
        ("wish i was dead", 3, "crisis_support"),
        ("don't want to live anymore", 3, "crisis_support"),
        ("can't go on", 3, "crisis_support"),
        ("ready to die", 3, "crisis_support"),
        ("ending it all", 3, "crisis_support"),
        ("kill myself", 3, "crisis_support"),
        
        # Indonesian variations
        ("pengen mati aja", 3, "crisis_support"),
        ("ga mau hidup lagi", 3, "crisis_support"),
        ("mau mati", 3, "crisis_support"),
        
        # Non-crisis (should be low risk)
        ("I want to diet", 0, "general_support"),
        ("dying to know the answer", 0, "general_support"),
        ("this deadline is killing me", 0, "general_support"),
        
        # Academic stress (moderate)
        ("I'm so stressed about my skripsi", 1, "academic_stress"),
    ]
    
    print("=" * 60)
    print("TEST: Variations and Edge Cases")
    print("=" * 60)
    
    passed = 0
    failed = 0
    
    for text, expected_risk, expected_intent in test_cases:
        payload = STAClassifyRequest(session_id="test-session", text=text)
        result = await classifier.classify(payload)
        
        success = (result.risk_level == expected_risk and result.intent == expected_intent)
        status = "✅" if success else "❌"
        
        if success:
            passed += 1
        else:
            failed += 1
        
        print(f"{status} '{text[:40]}...'")
        print(f"   Expected: risk={expected_risk}, intent={expected_intent}")
        print(f"   Got:      risk={result.risk_level}, intent={result.intent}")
        if result.diagnostic_notes:
            print(f"   Notes:    {result.diagnostic_notes}")
        print()
    
    print("=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)
    
    return failed == 0


async def main():
    print("\n🔍 Testing STA Crisis Detection Fix\n")
    
    try:
        # Test 1: Original issue
        await test_original_issue()
        
        # Test 2: Variations
        all_passed = await test_variations()
        
        if all_passed:
            print("\n🎉 All tests passed! Crisis detection is working correctly.\n")
            return 0
        else:
            print("\n⚠️  Some tests failed. Review the output above.\n")
            return 1
            
    except Exception as e:
        print(f"\n❌ Test failed with exception: {e}\n")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
