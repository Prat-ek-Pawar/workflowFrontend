let editor;
let monacoLoaded = false;

// Initialize Monaco Editor
require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' } });
require(['vs/editor/editor.main'], function () {
    try {
        editor = monaco.editor.create(document.getElementById('editor'), {
            value: '// Generated n8n workflow will appear here...\n// Click "Send" to generate workflow using AI',
            language: 'json',
            theme: 'vs-dark',
            automaticLayout: true,
            fontSize: 14,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            formatOnPaste: true,
            formatOnType: true
        });

        monacoLoaded = true;
        console.log('Monaco Editor initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Monaco Editor:', error);
        monacoLoaded = false;
    }
});

// DOM elements
const promptInput = document.getElementById('promptInput');
const generateBtn = document.getElementById('generateBtn');
const btnText = document.getElementById('btnText');
const copyBtn = document.getElementById('copyBtn');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');

// Status management
function showStatus(message, type = 'processing') {
    statusText.textContent = message;
    statusIndicator.className = `status-indicator show ${type}`;
    
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            statusIndicator.className = 'status-indicator';
        }, 3000);
    }
}

// Request state management
let isRequestInProgress = false;

function setRequestState(inProgress) {
    isRequestInProgress = inProgress;
    
    // Disable/enable submit button
    generateBtn.disabled = inProgress;
    btnText.textContent = inProgress ? 'Generating...' : 'Send';
    
    // Disable/enable textarea
    promptInput.disabled = inProgress;
    promptInput.style.opacity = inProgress ? '0.6' : '1';
    
    // Disable/enable copy button
    copyBtn.disabled = inProgress;
    
    // Set editor read-only state
    if (editor && editor.updateOptions) {
        editor.updateOptions({ readOnly: inProgress });
    }
    
    // Update status
    if (inProgress) {
        showStatus('Generating workflow...', 'processing');
    } else {
        showStatus('Ready', 'success');
    }
}

// Wait for Monaco Editor to be ready
function waitForMonaco() {
    return new Promise((resolve) => {
        const check = () => {
            if (monacoLoaded && editor) {
                resolve();
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });
}

// API call function
async function generateCode(prompt) {
    // Prevent multiple simultaneous requests
    if (isRequestInProgress) {
        showStatus('Request already in progress...', 'error');
        return;
    }
    
    try {
        setRequestState(true);
        
        // Show the editor section with animation
        const editorSection = document.getElementById('editorSection');
        if (!editorSection.classList.contains('show')) {
            editorSection.classList.add('show');
        }
        
        // Wait for Monaco Editor to be ready before using it
        await waitForMonaco();
        
        // Show loading in editor
        if (editor && editor.setValue) {
            editor.setValue('⏳ Generating n8n workflow, please wait...\n\n• Analyzing your requirements\n• Planning the workflow\n• Generating production-ready code\n\nThis may take 30-60 seconds...');
        }
        
        const response = await fetch('https://workflowgenerator.onrender.com/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            mode: 'cors',
            body: JSON.stringify({ message: prompt })
        });

        if (!response.ok) {
            let errorMessage;
            
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorData.error || `HTTP error! status: ${response.status}`;
            } catch {
                // If we can't parse JSON, create a generic error message
                if (response.status === 402) {
                    errorMessage = 'OpenAI API quota exceeded. Please check your billing settings.';
                } else if (response.status === 429) {
                    errorMessage = 'Rate limit exceeded. Please wait before trying again.';
                } else {
                    errorMessage = `HTTP error! status: ${response.status}`;
                }
            }
            
            throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('API Response:', data);
        
        // The backend now returns the n8n workflow JSON directly
        // No need to access data.code or data.plan - just use the response as is
        const n8nWorkflow = JSON.stringify(data, null, 2);
        
        // Wait for Monaco Editor before setting value
        await waitForMonaco();
        
        if (editor && editor.setValue) {
            editor.setValue(n8nWorkflow);
            
            // Set language to JSON
            if (monaco && monaco.editor && monaco.editor.setModelLanguage) {
                monaco.editor.setModelLanguage(editor.getModel(), 'json');
            }
            
            // Format the JSON
            setTimeout(() => {
                if (editor && editor.getAction) {
                    try {
                        editor.getAction('editor.action.formatDocument').run();
                    } catch (formatError) {
                        console.warn('Format document failed:', formatError);
                    }
                }
            }, 100);
            
            showStatus('Workflow generated successfully!', 'success');
        } else {
            throw new Error('Monaco Editor not ready');
        }
        
    } catch (error) {
        console.error('Error generating code:', error);
        
        // Show the editor section even on error
        const editorSection = document.getElementById('editorSection');
        if (!editorSection.classList.contains('show')) {
            editorSection.classList.add('show');
        }
        
        // Wait for Monaco Editor before setting error value
        await waitForMonaco();
        
        if (editor && editor.setValue) {
            // Create detailed error message based on error type
            let errorDisplay;
            
            if (error.message.includes('quota exceeded')) {
                errorDisplay = `❌ ERROR: OpenAI API Quota Exceeded

${error.message}

🔧 How to fix:
1. Go to https://platform.openai.com/account/billing
2. Add payment method or increase your usage limit
3. Check your current usage and billing status
4. Make sure your API key has sufficient credits

⚠️  Note: Free tier has limited usage. Consider upgrading to a paid plan.`;
            } else if (error.message.includes('Rate limit exceeded') || error.message.includes('rate limit')) {
                errorDisplay = `❌ ERROR: Rate Limit Exceeded

${error.message}

🔧 How to fix:
1. Wait a few minutes before trying again
2. The server has built-in rate limiting protection
3. Avoid making multiple rapid requests
4. Consider upgrading your OpenAI plan for higher limits

⏳ Please wait and try again in a few moments.`;
            } else if (error.message.includes('network') || error.message.includes('fetch')) {
                errorDisplay = `❌ ERROR: Network Connection Issue

${error.message}

🔧 How to fix:
1. Check your internet connection
2. Make sure the server is running on localhost:3000
3. Verify the API endpoint is accessible
4. Try refreshing the page

🌐 Connection troubleshooting required.`;
            } else {
                errorDisplay = `❌ ERROR: ${error.message}

🔧 Please check:
1. The API server is running on localhost:3000
2. Your OpenAI API key is configured in .env file
3. Your OpenAI account has sufficient credits
4. Your network connection is stable

📝 Check the server console for detailed error logs.`;
            }
            
            editor.setValue(errorDisplay);
            
            if (monaco && monaco.editor && monaco.editor.setModelLanguage) {
                monaco.editor.setModelLanguage(editor.getModel(), 'plaintext');
            }
        } else {
            // Fallback if Monaco Editor fails
            const editorDiv = document.getElementById('editor');
            editorDiv.innerHTML = `<pre style="padding: 20px; color: #f85149; font-family: monospace; white-space: pre-wrap;">${error.message}</pre>`;
        }
        
        showStatus('Error occurred', 'error');
    } finally {
        setRequestState(false);
    }
}

// Copy to clipboard function
async function copyToClipboard() {
    try {
        const content = editor.getValue();
        
        // Validate that it's valid JSON before copying
        try {
            JSON.parse(content);
        } catch (e) {
            alert('The content is not valid JSON. Please generate a valid workflow first.');
            return;
        }
        
        await navigator.clipboard.writeText(content);
        
        // Visual feedback
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '✓ Copied!';
        copyBtn.style.background = '#238636';
        
        setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.style.background = '#21262d';
        }, 2000);
        
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = editor.getValue();
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✓ Copied!';
            copyBtn.style.background = '#238636';
            
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.background = '#21262d';
            }, 2000);
        } catch (fallbackError) {
            console.error('Fallback copy failed:', fallbackError);
            alert('Failed to copy to clipboard. Please select and copy manually.');
        } finally {
            document.body.removeChild(textArea);
        }
    }
}

// Event listeners
generateBtn.addEventListener('click', () => {
    if (isRequestInProgress) return;
    
    const prompt = promptInput.value.trim();
    if (prompt) {
        generateCode(prompt);
    } else {
        showStatus('Please enter a workflow description first!', 'error');
        promptInput.focus();
    }
});

copyBtn.addEventListener('click', copyToClipboard);

// Allow Enter key to submit (Ctrl+Enter for new line)
promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey && !isRequestInProgress) {
        e.preventDefault();
        const prompt = promptInput.value.trim();
        if (prompt) {
            generateCode(prompt);
        }
    }
});

// Auto-resize textarea
promptInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.max(120, this.scrollHeight) + 'px';
});

// Prevent form submission during request
document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === 'Return') && isRequestInProgress) {
        e.preventDefault();
    }
});

// Initialize UI state
document.addEventListener('DOMContentLoaded', () => {
    setRequestState(false);
});