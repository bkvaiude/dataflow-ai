#!/usr/bin/env python3
"""
WebSocket Authentication Security Test
Tests the security of WebSocket connections
"""
import socketio
import sys
import time

def test_no_token():
    """Test 1: Connection WITHOUT token should be REJECTED"""
    print("\n" + "="*60)
    print("TEST 1: WebSocket Connection WITHOUT Token")
    print("="*60)

    sio = socketio.Client()

    @sio.event
    def connect():
        print("❌ FAIL: Connected without token (should have been rejected!)")
        sio.disconnect()

    @sio.event
    def connect_error(data):
        print(f"✅ PASS: Connection rejected - {data}")

    try:
        # Try to connect without auth
        sio.connect('http://localhost:8000', transports=['websocket'])
        time.sleep(2)
        sio.disconnect()
    except Exception as e:
        print(f"✅ PASS: Connection failed as expected - {str(e)}")

def test_invalid_token():
    """Test 2: Connection with INVALID token should be REJECTED"""
    print("\n" + "="*60)
    print("TEST 2: WebSocket Connection WITH Invalid Token")
    print("="*60)

    sio = socketio.Client()

    @sio.event
    def connect():
        print("❌ FAIL: Connected with invalid token (should have been rejected!)")
        sio.disconnect()

    @sio.event
    def connect_error(data):
        print(f"✅ PASS: Connection rejected - {data}")

    try:
        # Try to connect with invalid token
        sio.connect(
            'http://localhost:8000',
            auth={'token': 'invalid-fake-token-12345'},
            transports=['websocket']
        )
        time.sleep(2)
        sio.disconnect()
    except Exception as e:
        print(f"✅ PASS: Connection failed as expected - {str(e)}")

def test_user_impersonation(valid_token):
    """Test 3: Client cannot send fake user_id (server uses session user_id)"""
    print("\n" + "="*60)
    print("TEST 3: User Impersonation Protection")
    print("="*60)

    if not valid_token:
        print("⚠️  SKIP: Need valid token for this test")
        print("   To run this test, pass a valid JWT token as argument:")
        print(f"   python3 {sys.argv[0]} <valid-jwt-token>")
        return

    sio = socketio.Client()

    @sio.event
    def connect():
        print("✅ Connected with valid token")
        # Try to send message with fake user_id
        print("📤 Sending message with fake user_id: 'hacker-user-999'")
        sio.emit('chat_message', {
            'message': 'test message for impersonation',
            'user_id': 'hacker-user-999'  # This should be IGNORED by server
        })
        time.sleep(1)
        sio.disconnect()

    @sio.event
    def connect_error(data):
        print(f"❌ FAIL: Connection rejected - {data}")

    @sio.event
    def chat_response(data):
        print(f"📥 Received response: {data.get('message', '')[:50]}...")
        print("✅ PASS: Server processed message (check backend logs for user_id)")
        print("   Backend should log the SESSION user_id, NOT 'hacker-user-999'")

    try:
        sio.connect(
            'http://localhost:8000',
            auth={'token': valid_token},
            transports=['websocket']
        )
        time.sleep(3)
        if sio.connected:
            sio.disconnect()
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    print("\n🔒 WebSocket Security Test Suite")
    print("Testing DataFlow AI Backend Security")

    # Test 1: No token
    test_no_token()

    # Test 2: Invalid token
    test_invalid_token()

    # Test 3: User impersonation (requires valid token)
    valid_token = sys.argv[1] if len(sys.argv) > 1 else None
    test_user_impersonation(valid_token)

    print("\n" + "="*60)
    print("Security Test Suite Complete")
    print("="*60)
    print("\nSummary:")
    print("- Test 1 (No Token): Connection should be rejected ✅")
    print("- Test 2 (Invalid Token): Connection should be rejected ✅")
    print("- Test 3 (User Impersonation): Server should use session user_id")
    print("\nFor Test 3, check backend logs with:")
    print("  docker logs dataflow-ai-backend-1 2>&1 | grep 'Message from'")
    print()
