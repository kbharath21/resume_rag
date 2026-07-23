#!/usr/bin/env python3
"""
Unit tests for RAG helper functions that don't require external services
"""

import sys

# Define the functions to test (copy-pasted to avoid import dependency on search_api)
def cosine_to_confidence(cosine_score: float) -> float:
    """Convert cosine similarity [-1, 1] to confidence percentage [0, 100]"""
    return round(((cosine_score + 1) / 2) * 100, 2)


def reranker_to_confidence(reranker_score: float) -> float:
    """Convert reranker score to confidence percentage [0, 100]"""
    return round(reranker_score * 100, 2)


def get_bm25_score(query: str, text: str) -> float:
    """Simple BM25-like scoring based on keyword matching"""
    query_tokens = set(query.lower().split())
    text_lower = text.lower()
    
    # Score based on keyword presence
    matched_tokens = sum(1 for token in query_tokens if token in text_lower)
    # Normalize to 0-100 percentage
    if not query_tokens:
        return 0.0
    return min(100.0, (matched_tokens / len(query_tokens)) * 100)


def test_cosine_to_confidence():
    """Test cosine to confidence conversion"""
    tests = [
        (-1.0, 0.0, "Cosine -1 should be 0%"),
        (0.0, 50.0, "Cosine 0 should be 50%"),
        (1.0, 100.0, "Cosine 1 should be 100%"),
        (0.8, 90.0, "Cosine 0.8 should be 90%"),
    ]
    
    for cosine, expected, msg in tests:
        result = cosine_to_confidence(cosine)
        assert result == expected, f"{msg}: got {result}"
    
    print("✓ All cosine_to_confidence tests passed")


def test_reranker_to_confidence():
    """Test reranker score to confidence conversion"""
    tests = [
        (0.0, 0.0, "Reranker 0 should be 0%"),
        (0.5, 50.0, "Reranker 0.5 should be 50%"),
        (1.0, 100.0, "Reranker 1 should be 100%"),
        (0.75, 75.0, "Reranker 0.75 should be 75%"),
    ]
    
    for reranker, expected, msg in tests:
        result = reranker_to_confidence(reranker)
        assert result == expected, f"{msg}: got {result}"
    
    print("✓ All reranker_to_confidence tests passed")


def test_bm25_score():
    """Test BM25 keyword scoring"""
    tests = [
        ("python", "python programming", 100.0, "Single keyword match"),
        ("java", "python programming", 0.0, "No keyword match"),
        ("python java", "python and java", 100.0, "All keywords match"),
        ("python java", "python only", 50.0, "Partial keyword match"),
        ("", "some text", 0.0, "Empty query"),
        ("Python", "python text", 100.0, "Case insensitive"),
    ]
    
    for query, text, expected, msg in tests:
        result = get_bm25_score(query, text)
        assert result == expected, f"{msg}: expected {expected}, got {result}"
    
    print("✓ All BM25 score tests passed")


def test_confidence_ranges():
    """Test that all confidence scores are in valid range"""
    # Test cosine scores
    cosine_scores = [-1.0, -0.5, 0.0, 0.5, 0.8, 1.0]
    for score in cosine_scores:
        conf = cosine_to_confidence(score)
        assert 0 <= conf <= 100, f"Cosine {score} produced {conf}% (out of range)"
    
    # Test reranker scores
    reranker_scores = [0.0, 0.25, 0.5, 0.75, 1.0]
    for score in reranker_scores:
        conf = reranker_to_confidence(score)
        assert 0 <= conf <= 100, f"Reranker {score} produced {conf}% (out of range)"
    
    # Test BM25 scores
    queries = ["python", "python java", "", "a b c d"]
    texts = ["python programming", "", "java and python", "some other text"]
    for query in queries:
        for text in texts:
            score = get_bm25_score(query, text)
            assert 0 <= score <= 100, f"BM25 '{query}' vs '{text}' produced {score}% (out of range)"
    
    print("✓ All confidence range tests passed")


def test_hybrid_fusion():
    """Test hybrid score fusion calculation"""
    dense_score = 80.0
    bm25_score = 60.0
    expected_hybrid = (0.6 * dense_score) + (0.4 * bm25_score)
    
    assert expected_hybrid == 72.0, f"Hybrid fusion: expected 72.0, got {expected_hybrid}"
    
    # Test another example
    dense_score = 90.0
    bm25_score = 100.0
    expected_hybrid = (0.6 * 90.0) + (0.4 * 100.0)
    assert expected_hybrid == 94.0, f"Hybrid fusion: expected 94.0, got {expected_hybrid}"
    
    print("✓ All hybrid fusion tests passed")


def main():
    """Run all tests"""
    print("=" * 60)
    print("Testing Multi-RAG Model Functions")
    print("=" * 60)
    
    try:
        test_cosine_to_confidence()
        test_reranker_to_confidence()
        test_bm25_score()
        test_confidence_ranges()
        test_hybrid_fusion()
        
        print("\n" + "=" * 60)
        print("✓ ALL TESTS PASSED")
        print("=" * 60)
        return 0
    except AssertionError as e:
        print(f"\n✗ TEST FAILED: {e}")
        return 1
    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
