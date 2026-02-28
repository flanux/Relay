<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Room - LAN Hub</title>
    <link rel="stylesheet" href="public/style.css">
</head>
<body>
    <div class="room-container">
        <header class="room-header">
            <div>
                <h1>Room: <span id="roomId">Loading...</span></h1>
                <p id="userInfo">Connecting...</p>
            </div>
            <div class="connection-status">
                <span id="connectionStatus" class="status-dot"></span>
                <span id="participantCount">0 participants</span>
            </div>
        </header>
        
        <main class="room-content">
            <div class="polls-panel">
                <h2>Polls & Quizzes</h2>
                
                <div id="createPollForm">
                    <button id="createPollBtn" class="btn-create-poll">+ Create New Poll</button>
                    
                    <div id="pollForm" style="display: none;">
                        <input type="text" id="pollQuestion" placeholder="Enter your question" class="poll-question-input">
                        
                        <div id="pollOptions"></div>
                        
                        <div class="poll-form-actions">
                            <button id="addOptionBtn" class="btn-add-option">+ Add Option</button>
                            <button id="submitPollBtn" class="btn-submit-poll">Create Poll</button>
                            <button id="cancelPollBtn" class="btn-cancel-poll">Cancel</button>
                        </div>
                    </div>
                </div>
                
                <div id="pollsList" class="polls-list">
                    <div class="no-polls">No polls yet</div>
                </div>
            </div>
            
            <div class="notes-panel">
                <h2>Shared Notes</h2>
                <div class="notes-controls">
                    <span id="saveIndicator" style="display: none;"></span>
                    <span id="notesInfo" class="notes-info"></span>
                    <button id="clearNotesBtn" class="btn-clear">Clear Notes</button>
                </div>
                <textarea id="notesTextarea" placeholder="Teacher can type notes here. Students will see them in real-time..."></textarea>
            </div>
            
            <div class="files-panel">
                <h2>Shared Files</h2>
                
                <div id="fileDropZone" class="drop-zone">
                    <div class="drop-zone-content">
                        <p>📁 Drag & drop files here</p>
                        <p>or</p>
                        <button id="browseBtn">Browse Files</button>
                        <input type="file" id="fileInput" multiple style="display: none;">
                    </div>
                </div>
                
                <div id="uploadStatus" class="upload-status" style="display: none;"></div>
                
                <div id="filesList" class="files-list">
                    <div class="no-files">No files shared yet</div>
                </div>
            </div>
            
            <div class="messages-panel">
                <h2>Chat</h2>
                <div id="messageDisplay" class="message-display"></div>
                <div class="message-input-container">
                    <input type="text" id="messageInput" placeholder="Type a message...">
                    <button id="sendMessageBtn">Send</button>
                </div>
            </div>
        </main>
    </div>
    
    <script src="public/app.js"></script>
    <script src="features/files/client.js"></script>
    <script src="features/notes/client.js"></script>
    <script src="features/polls/client.js"></script>
    <script>
        const urlParams = new URLSearchParams(window.location.search);
        const roomId = urlParams.get('id');
        
        if (!roomId) {
            alert('No room ID provided');
            window.location.href = 'index.php';
        }
        
        const username = localStorage.getItem('username') || 'Anonymous';
        const role = localStorage.getItem('role') || 'student';
        
        document.getElementById('roomId').textContent = roomId;
        document.getElementById('userInfo').textContent = `${username} (${role})`;
        
        const app = new App(roomId, username, role);
        app.start();
        
        const filesClient = new FilesClient(app);
        
        const notesClient = new NotesClient(app);
        
        const pollsClient = new PollsClient(app);
        
        app.on('test_message', function(data) {
            const messageDisplay = document.getElementById('messageDisplay');
            if (messageDisplay) {
                const msgDiv = document.createElement('div');
                msgDiv.className = 'message';
                
                const header = document.createElement('div');
                header.className = 'message-header';
                header.textContent = data.username;
                
                const body = document.createElement('div');
                body.className = 'message-body';
                body.textContent = data.message;
                
                const time = document.createElement('div');
                time.className = 'message-time';
                time.textContent = new Date().toLocaleTimeString();
                
                msgDiv.appendChild(header);
                msgDiv.appendChild(body);
                msgDiv.appendChild(time);
                
                messageDisplay.appendChild(msgDiv);
                messageDisplay.scrollTop = messageDisplay.scrollHeight;
                
                while (messageDisplay.children.length > 50) {
                    messageDisplay.removeChild(messageDisplay.firstChild);
                }
            }
        });
        
        const messageInput = document.getElementById('messageInput');
        const sendMessageBtn = document.getElementById('sendMessageBtn');
        
        function sendMessage() {
            const message = messageInput.value.trim();
            if (!message) return;
            
            app.emit('test_message', {
                username: username,
                message: message
            });
            
            messageInput.value = '';
        }
        
        if (sendMessageBtn) {
            sendMessageBtn.addEventListener('click', sendMessage);
        }
        
        if (messageInput) {
            messageInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    sendMessage();
                }
            });
        }
    </script>
</body>
</html>