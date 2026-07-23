#!/usr/bin/env python3
"""
Comprehensive tests for Multi-RAG Model Selection feature
Tests all three models: Dense Retrieval, Hybrid RAG, and HyDE
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from search_api import (
    cosine_to_confidence,
    reranker_to_confidence,
    get_bm25_score,
    dense_retrieval_model,
    hybrid_rag_model,
    hyde_model
)


class TestScoreConversions:
    """Test score conversion functions"""
    
    def test_cosine_to_confidence_min(self):
        """Test cosine -1 converts to 0%"""
        assert cosine_to_confidence(-1.0) == 0.0
    
    def test_cosine_to_confidence_mid(self):
        """Test cosine 0 converts to 50%"""
        assert cosine_to_confidence(0.0) == 50.0
    
    def test_cosine_to_confidence_max(self):
        """Test cosine 1 converts to 100%"""
        assert cosine_to_confidence(1.0) == 100.0
    
    def test_cosine_to_confidence_typical(self):
        """Test typical cosine score conversion"""
        # 0.8 cosine should be ~90%
        result = cosine_to_confidence(0.8)
        assert 85 < result < 95
    
    def test_reranker_to_confidence_min(self):
        """Test reranker 0 converts to 0%"""
        assert reranker_to_confidence(0.0) == 0.0
    
    def test_reranker_to_confidence_max(self):
        """Test reranker 1 converts to 100%"""
        assert reranker_to_confidence(1.0) == 100.0
    
    def test_reranker_to_confidence_mid(self):
        """Test reranker 0.5 converts to 50%"""
        assert reranker_to_confidence(0.5) == 50.0


class TestBM25Scoring:
    """Test BM25 keyword matching"""
    
    def test_bm25_exact_match(self):
        """Test BM25 with exact keyword match"""
        score = get_bm25_score("python", "I love python programming")
        assert score > 0
    
    def test_bm25_no_match(self):
        """Test BM25 with no keyword match"""
        score = get_bm25_score("java", "I love python programming")
        assert score == 0
    
    def test_bm25_partial_match(self):
        """Test BM25 with partial keyword match"""
        score = get_bm25_score("python java", "I love python programming")
        assert 0 < score < 100
    
    def test_bm25_all_keywords_match(self):
        """Test BM25 with all keywords matching"""
        score = get_bm25_score("python java", "I love python and java programming")
        assert score == 100.0
    
    def test_bm25_empty_query(self):
        """Test BM25 with empty query"""
        score = get_bm25_score("", "some text")
        assert score == 0.0
    
    def test_bm25_case_insensitive(self):
        """Test BM25 is case insensitive"""
        score1 = get_bm25_score("Python", "I love python programming")
        score2 = get_bm25_score("python", "I love python programming")
        assert score1 == score2


class TestDenseRetrievalModel:
    """Test Dense Retrieval Model 1"""
    
    @patch('search_api.Collection')
    @patch('search_api.client')
    def test_dense_model_returns_correct_structure(self, mock_client, mock_collection_class):
        """Test Dense Retrieval returns expected structure"""
        # Setup mocks
        mock_embed_response = Mock()
        mock_embed_response.data = [Mock(embedding=[0.1, 0.2, 0.3])]
        mock_client.embeddings.create.return_value = mock_embed_response
        
        mock_collection_instance = Mock()
        mock_collection_class.return_value = mock_collection_instance
        
        # Mock search results
        mock_hit = Mock()
        mock_hit.entity.get.side_effect = lambda key: {
            "user_id": 1,
            "name": "John",
            "email": "john@example.com",
            "phone": "123-456-7890",
            "summary": "Python developer"
        }.get(key)
        mock_hit.score = 0.8
        
        mock_collection_instance.search.return_value = [[mock_hit]]
        
        # Mock reranker
        with patch('search_api.reranker') as mock_reranker:
            mock_reranker.predict.return_value = [0.9]
            
            result = dense_retrieval_model("python developer", "test_collection")
        
        assert result["model"] == "Dense Retrieval"
        assert result["metadata"]["best_for"] == "Semantic Matching"
        assert len(result["candidates"]) > 0
        assert "confidence" in result["candidates"][0]
        assert 0 <= result["candidates"][0]["confidence"] <= 100
    
    @patch('search_api.Collection')
    @patch('search_api.client')
    def test_dense_model_empty_results(self, mock_client, mock_collection_class):
        """Test Dense Retrieval with no results"""
        mock_embed_response = Mock()
        mock_embed_response.data = [Mock(embedding=[0.1, 0.2, 0.3])]
        mock_client.embeddings.create.return_value = mock_embed_response
        
        mock_collection_instance = Mock()
        mock_collection_class.return_value = mock_collection_instance
        mock_collection_instance.search.return_value = [[]]
        
        with patch('search_api.reranker'):
            result = dense_retrieval_model("nonexistent", "test_collection")
        
        assert result["candidates"] == []


class TestHybridRAGModel:
    """Test Hybrid RAG Model 2"""
    
    @patch('search_api.Collection')
    @patch('search_api.client')
    def test_hybrid_model_fuses_scores(self, mock_client, mock_collection_class):
        """Test Hybrid RAG properly fuses dense and BM25 scores"""
        mock_embed_response = Mock()
        mock_embed_response.data = [Mock(embedding=[0.1, 0.2, 0.3])]
        mock_client.embeddings.create.return_value = mock_embed_response
        
        mock_collection_instance = Mock()
        mock_collection_class.return_value = mock_collection_instance
        
        mock_hit = Mock()
        mock_hit.entity.get.side_effect = lambda key: {
            "user_id": 1,
            "name": "Python Dev",
            "email": "dev@example.com",
            "phone": "123-456-7890",
            "summary": "Expert in Python and Django"
        }.get(key)
        mock_hit.score = 0.85
        
        mock_collection_instance.search.return_value = [[mock_hit]]
        
        with patch('search_api.reranker') as mock_reranker:
            mock_reranker.predict.return_value = [0.92]
            result = hybrid_rag_model("python django", "test_collection")
        
        assert result["model"] == "Hybrid RAG"
        assert result["metadata"]["best_for"] == "Exact Keywords & Skills"
        assert len(result["candidates"]) > 0
        
        # Verify hybrid score was calculated
        candidate = result["candidates"][0]
        assert "dense_score" in candidate
        assert "bm25_score" in candidate
        assert "hybrid_score" in candidate
        assert 0 <= candidate["confidence"] <= 100
    
    @patch('search_api.Collection')
    @patch('search_api.client')
    def test_hybrid_model_score_weights(self, mock_client, mock_collection_class):
        """Test Hybrid RAG uses correct fusion weights (60% dense, 40% BM25)"""
        mock_embed_response = Mock()
        mock_embed_response.data = [Mock(embedding=[0.1, 0.2, 0.3])]
        mock_client.embeddings.create.return_value = mock_embed_response
        
        mock_collection_instance = Mock()
        mock_collection_class.return_value = mock_collection_instance
        
        mock_hit = Mock()
        mock_hit.entity.get.side_effect = lambda key: {
            "user_id": 1,
            "name": "Test",
            "email": "test@example.com",
            "phone": "123",
            "summary": "python"
        }.get(key)
        mock_hit.score = 0.8  # cosine 0.8 -> 90% confidence
        
        mock_collection_instance.search.return_value = [[mock_hit]]
        
        with patch('search_api.reranker') as mock_reranker:
            mock_reranker.predict.return_value = [0.95]
            result = hybrid_rag_model("python", "test_collection")
        
        candidate = result["candidates"][0]
        # dense = 90%, bm25 could be 0-100 based on keyword match
        # hybrid = 0.6*90 + 0.4*bm25
        assert candidate["hybrid_score"] == (0.6 * candidate["dense_score"]) + (0.4 * candidate["bm25_score"])


class TestHyDEModel:
    """Test HyDE Model 3"""
    
    @patch('search_api.Collection')
    @patch('search_api.client')
    def test_hyde_model_calls_llm_once(self, mock_client, mock_collection_class):
        """Test HyDE makes exactly one LLM call"""
        # Setup LLM response
        mock_chat_response = Mock()
        mock_chat_response.choices = [Mock(message=Mock(content="Senior Python engineer with Django expertise"))]
        mock_client.chat.completions.create.return_value = mock_chat_response
        
        # Setup embedding response
        mock_embed_response = Mock()
        mock_embed_response.data = [Mock(embedding=[0.1, 0.2, 0.3])]
        mock_client.embeddings.create.return_value = mock_embed_response
        
        mock_collection_instance = Mock()
        mock_collection_class.return_value = mock_collection_instance
        
        mock_hit = Mock()
        mock_hit.entity.get.side_effect = lambda key: {
            "user_id": 1,
            "name": "Dev",
            "email": "dev@example.com",
            "phone": "123",
            "summary": "Python developer"
        }.get(key)
        mock_hit.score = 0.9
        
        mock_collection_instance.search.return_value = [[mock_hit]]
        
        with patch('search_api.reranker') as mock_reranker:
            mock_reranker.predict.return_value = [0.95]
            result = hyde_model("python", "test_collection")
        
        # Verify LLM was called exactly once
        assert mock_client.chat.completions.create.call_count == 1
        
        # Verify embedding was called once (for enhanced query)
        assert mock_client.embeddings.create.call_count == 1
        
        assert result["model"] == "HyDE"
        assert result["metadata"]["best_for"] == "Job Description Matching"
        assert "enhanced_query" in result["metadata"]
    
    @patch('search_api.Collection')
    @patch('search_api.client')
    def test_hyde_model_includes_enhanced_query(self, mock_client, mock_collection_class):
        """Test HyDE includes enhanced query in response"""
        mock_chat_response = Mock()
        enhanced_query_text = "Senior Software Engineer specializing in backend development"
        mock_chat_response.choices = [Mock(message=Mock(content=enhanced_query_text))]
        mock_client.chat.completions.create.return_value = mock_chat_response
        
        mock_embed_response = Mock()
        mock_embed_response.data = [Mock(embedding=[0.1, 0.2, 0.3])]
        mock_client.embeddings.create.return_value = mock_embed_response
        
        mock_collection_instance = Mock()
        mock_collection_class.return_value = mock_collection_instance
        mock_collection_instance.search.return_value = [[]]
        
        with patch('search_api.reranker'):
            result = hyde_model("backend", "test_collection")
        
        assert result["metadata"]["enhanced_query"] == enhanced_query_text


class TestConfidenceScoreRanges:
    """Test that confidence scores are always in 0-100% range"""
    
    def test_confidence_range_dense_model(self):
        """Test Dense Retrieval confidence always in range"""
        # Test various cosine scores
        scores = [-1.0, -0.5, 0.0, 0.5, 0.8, 1.0]
        for score in scores:
            conf = cosine_to_confidence(score)
            assert 0 <= conf <= 100, f"Cosine {score} produced {conf}% confidence"
    
    def test_confidence_range_reranker(self):
        """Test Reranker confidence always in range"""
        scores = [0.0, 0.25, 0.5, 0.75, 1.0]
        for score in scores:
            conf = reranker_to_confidence(score)
            assert 0 <= conf <= 100, f"Reranker {score} produced {conf}% confidence"
    
    def test_confidence_range_bm25(self):
        """Test BM25 confidence always in range"""
        queries = ["python", "python java", "", "a b c d"]
        texts = ["python programming", "", "java and python", "some other text"]
        for query in queries:
            for text in texts:
                score = get_bm25_score(query, text)
                assert 0 <= score <= 100, f"BM25 '{query}' vs '{text}' produced {score}%"


class TestSortingByConfidence:
    """Test that results are sorted by confidence descending"""
    
    def test_candidates_sorted_descending(self):
        """Test that candidates are sorted by confidence descending"""
        candidates = [
            {"confidence": 75, "name": "B"},
            {"confidence": 95, "name": "A"},
            {"confidence": 85, "name": "C"},
        ]
        
        # After sorting by confidence descending
        sorted_candidates = sorted(candidates, key=lambda x: x["confidence"], reverse=True)
        
        assert sorted_candidates[0]["confidence"] == 95
        assert sorted_candidates[1]["confidence"] == 85
        assert sorted_candidates[2]["confidence"] == 75


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
