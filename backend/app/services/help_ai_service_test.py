import pytest
from unittest.mock import MagicMock
from app.services.help_ai_service import answer_chat, _text
from app.schemas.help import AIChatRequest

# Helper function to create a mock DB session (not used in current logic)
def get_mock_session():
    return MagicMock()

@pytest.fixture
def mock_db():
    return get_mock_session()

def test_greeting_response(mock_db):
    request = AIChatRequest(message="hi")
    response = answer_chat(mock_db, request, None)
    assert response.reply == _text("en", "greeting")

def test_valid_guide_response(mock_db):
    # Query that should match the Task Management guide
    request = AIChatRequest(message="How do I create a task?")
    response = answer_chat(mock_db, request, None)
    # Ensure the response is not the unsupported message
    assert response.reply != _text("en", "no_guide")
    # Check that a known section title from the guide appears in the answer
    assert "Creating Tasks" in response.reply

def test_unsupported_question(mock_db):
    request = AIChatRequest(message="What is the meaning of life?")
    response = answer_chat(mock_db, request, None)
    assert response.reply == _text("en", "no_guide")
