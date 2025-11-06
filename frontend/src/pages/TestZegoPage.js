import React, { useState } from 'react';
import { ZegoCloudCall } from '../utils/zegocloud';

function TestZegoPage() {
  const [log, setLog] = useState([]);
  const [zegoInstance, setZegoInstance] = useState(null);

  const addLog = (message) => {
    console.log(message);
    setLog(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  const testInitialization = async () => {
    try {
      addLog('🧪 Testing ZegoCloud Initialization...');
      
      const testUserId = 'test_user_' + Date.now();
      const testRemoteUserId = 'remote_user_123';
      
      addLog(`Creating ZegoCloudCall instance with userId: ${testUserId}`);
      const zegoCall = new ZegoCloudCall(testUserId, testRemoteUserId, 'video');
      
      addLog('Attempting to initialize engine...');
      const initialized = await zegoCall.initializeEngine();
      
      if (initialized) {
        addLog('✅ SUCCESS: ZegoCloud engine initialized successfully!');
        addLog(`AppID used: ${zegoCall.appId}`);
        addLog('Engine instance created: ' + (zegoCall.zg ? 'YES' : 'NO'));
        setZegoInstance(zegoCall);
      } else {
        addLog('❌ FAILED: Engine initialization returned false');
      }
      
    } catch (error) {
      addLog(`❌ ERROR: ${error.message}`);
      addLog(`Stack: ${error.stack}`);
    }
  };

  const testTokenFetch = async () => {
    try {
      addLog('🧪 Testing Token Fetch...');
      
      if (!zegoInstance) {
        addLog('⚠️ No Zego instance. Run initialization test first.');
        return;
      }
      
      addLog('Fetching token from backend...');
      const token = await zegoInstance.fetchToken();
      
      if (token) {
        addLog(`✅ SUCCESS: Token received`);
        addLog(`Token starts with: ${token.substring(0, 10)}...`);
        addLog(`Token length: ${token.length} characters`);
      }
      
    } catch (error) {
      addLog(`❌ ERROR: ${error.message}`);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>ZegoCloud Integration Test</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={testInitialization}
          style={{
            padding: '10px 20px',
            marginRight: '10px',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Test Engine Initialization
        </button>
        
        <button 
          onClick={testTokenFetch}
          style={{
            padding: '10px 20px',
            background: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Test Token Fetch
        </button>
      </div>

      <div style={{
        background: '#000',
        color: '#0f0',
        padding: '15px',
        borderRadius: '4px',
        maxHeight: '500px',
        overflow: 'auto',
        fontFamily: 'Courier New, monospace',
        fontSize: '12px'
      }}>
        <div style={{ marginBottom: '10px', color: '#fff' }}>
          <strong>Console Output:</strong>
        </div>
        {log.map((entry, index) => (
          <div key={index}>{entry}</div>
        ))}
        {log.length === 0 && (
          <div style={{ color: '#666' }}>Click a button to start testing...</div>
        )}
      </div>

      <div style={{ marginTop: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '4px' }}>
        <h3>Configuration:</h3>
        <p>REACT_APP_ZEGO_APP_ID: {process.env.REACT_APP_ZEGO_APP_ID || 'Not set'}</p>
        <p>Backend URL: {process.env.REACT_APP_BACKEND_URL || '/api'}</p>
      </div>
    </div>
  );
}

export default TestZegoPage;
